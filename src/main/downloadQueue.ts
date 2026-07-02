import { Session } from "electron";
import type { DownloadItem, Event } from "electron";
import fs from "node:fs/promises";
import { FileRecord, PendingFileRecord } from "../shared/types";
import { sleep } from "../shared/utils";

interface DownloadQueueOptions {
  session: Session;
  resolvePath(relativePath: string): string;
  onRecord(record: FileRecord): void;
  onProgress(): void;
  downloadURL?: (url: string) => void;
  maxAttempts?: number;
  maxConcurrent?: number;
  browserDownloadTimeoutMs?: number;
}

export class DownloadQueue {
  private readonly session: Session;
  private readonly resolvePath: (relativePath: string) => string;
  private readonly onRecord: (record: FileRecord) => void;
  private readonly onProgress: () => void;
  private readonly downloadURL: (url: string) => void;
  private readonly maxAttempts: number;
  private readonly maxConcurrent: number;
  private readonly browserDownloadTimeoutMs: number;
  private readonly records = new Map<string, FileRecord>();
  private active = new Set<string>();
  private slotActive = new Set<string>();
  private browserDownloadOrder: string[] = [];
  private browserDownloadTimers = new Map<string, NodeJS.Timeout>();
  private stopped = false;

  constructor(options: DownloadQueueOptions) {
    this.session = options.session;
    this.resolvePath = options.resolvePath;
    this.onRecord = options.onRecord;
    this.onProgress = options.onProgress;
    this.downloadURL = options.downloadURL ?? ((url) => this.session.downloadURL(url));
    this.maxAttempts = options.maxAttempts ?? 3;
    this.maxConcurrent = Math.min(10, Math.max(1, Math.floor(options.maxConcurrent ?? 5)));
    this.browserDownloadTimeoutMs = Math.max(5000, options.browserDownloadTimeoutMs ?? 45000);
    this.session.on("will-download", (event, item) => this.handleBrowserDownload(event, item));
  }

  seed(records: FileRecord[]): void {
    for (const record of records) {
      this.records.set(record.fileId, record);
    }
  }

  resumePending(): void {
    for (const record of this.records.values()) {
      if (record.status === "downloading") {
        this.records.set(record.fileId, { ...record, status: "queued", updatedAt: new Date().toISOString() });
      }
    }
    void this.pump();
  }

  getDiagnostics(): {
    total: number;
    queued: number;
    downloading: number;
    active: number;
    workerSlots: number;
    browserPending: number;
    manual: number;
    failed: number;
    downloaded: number;
  } {
    const records = Array.from(this.records.values());
    return {
      total: records.length,
      queued: records.filter((record) => record.status === "queued").length,
      downloading: records.filter((record) => record.status === "downloading").length,
      active: this.active.size,
      workerSlots: this.slotActive.size,
      browserPending: this.browserDownloadOrder.length,
      manual: records.filter((record) => record.status === "manual").length,
      failed: records.filter((record) => record.status === "failed").length,
      downloaded: records.filter((record) => record.status === "downloaded").length
    };
  }

  enqueue(file: PendingFileRecord): void {
    if (!file.shouldDownload) return;
    const existing = this.records.get(file.fileId);
    if (existing && (existing.status === "queued" || existing.status === "downloading" || existing.status === "downloaded" || existing.status === "manual")) return;

    const now = new Date().toISOString();
    const record: FileRecord = {
      ...file,
      status: "queued",
      attempts: existing?.attempts ?? 0,
      queuedAt: existing?.queuedAt ?? now,
      updatedAt: now,
      absolutePath: existing?.absolutePath,
      error: existing?.error
    };
    this.records.set(record.fileId, record);
    this.onRecord(record);
    void this.pump();
  }

  expectBrowserDownload(file: PendingFileRecord): boolean {
    if (!file.shouldDownload) return false;
    const existing = this.records.get(file.fileId);
    if (existing && (existing.status === "queued" || existing.status === "downloading" || existing.status === "downloaded")) return false;

    const now = new Date().toISOString();
    const record: FileRecord = {
      ...file,
      status: "downloading",
      attempts: (existing?.attempts ?? 0) + 1,
      queuedAt: existing?.queuedAt ?? now,
      updatedAt: now,
      absolutePath: existing?.absolutePath,
      error: undefined
    };
    this.records.set(record.fileId, record);
    this.active.add(record.fileId);
    this.browserDownloadOrder.push(record.fileId);
    this.armBrowserDownloadTimeout(record.fileId);
    this.onRecord(record);
    this.onProgress();
    return true;
  }

  markManual(fileId: string, error: string): void {
    this.moveToManual(fileId, error);
    this.onProgress();
  }

  async drain(timeoutMs?: number): Promise<boolean> {
    const deadline = timeoutMs ? Date.now() + timeoutMs : Number.POSITIVE_INFINITY;
    while (!this.stopped && (this.hasQueued() || this.active.size > 0)) {
      if (Date.now() >= deadline) return false;
      await this.pump();
      await sleep(500);
    }
    return true;
  }

  markPendingManual(error: string): void {
    for (const record of Array.from(this.records.values())) {
      if (record.status === "queued" || record.status === "downloading") {
        this.moveToManual(record.fileId, `${error}. Try this URL manually: ${record.contentUrl}`);
      }
    }
    this.onProgress();
  }

  stop(): void {
    this.stopped = true;
    this.slotActive.clear();
    for (const timeout of this.browserDownloadTimers.values()) clearTimeout(timeout);
    this.browserDownloadTimers.clear();
  }

  private async pump(): Promise<void> {
    if (this.stopped) return;
    for (const record of this.records.values()) {
      if (this.slotActive.size >= this.maxConcurrent) return;
      if (record.status !== "queued") continue;
      this.active.add(record.fileId);
      this.slotActive.add(record.fileId);
      this.update(record.fileId, { status: "downloading", attempts: record.attempts + 1, error: undefined });
      try {
        if (this.shouldFetchDirectly(record)) {
          void this.fetchDirectly(record);
        } else {
          this.browserDownloadOrder.push(record.fileId);
          this.armBrowserDownloadTimeout(record.fileId);
          this.downloadURL(record.contentUrl);
        }
      } catch (error) {
        this.untrackBrowserDownload(record.fileId);
        this.clearBrowserDownloadTimeout(record.fileId);
        this.clearActive(record.fileId);
        await this.retryOrFail(record.fileId, error instanceof Error ? error.message : String(error));
      }
    }
  }

  private shouldFetchDirectly(record: FileRecord): boolean {
    return record.kind === "image"
      || record.kind === "avatar"
      || /^https:\/\/as-prod\.asyncgw\.teams\.microsoft\.com\//i.test(record.contentUrl);
  }

  private async fetchDirectly(record: FileRecord): Promise<void> {
    const absolutePath = this.resolvePath(record.localPath);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await this.session.fetch(record.contentUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0) throw new Error("Downloaded image was empty");
      await fs.writeFile(absolutePath, buffer);
      this.clearActive(record.fileId);
      this.update(record.fileId, { status: "downloaded", absolutePath });
    } catch (error) {
      this.clearActive(record.fileId);
      await this.retryOrFail(record.fileId, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  private handleBrowserDownload(event: Event, item: DownloadItem): void {
    const record = this.claimBrowserDownload(item.getURL());
    if (!record) {
      event.preventDefault();
      return;
    }

    if (this.isAuthorizationDownload(item)) {
      event.preventDefault();
      this.moveToManual(record.fileId, `Download redirected to Microsoft sign-in instead of the file. Try this URL manually: ${record.contentUrl}`);
      void this.pump();
      return;
    }

    const absolutePath = this.resolvePath(record.localPath);
    item.setSavePath(absolutePath);
    item.once("done", (_doneEvent, state) => {
      this.clearBrowserDownloadTimeout(record.fileId);
      this.clearActive(record.fileId);
      if (state === "completed") {
        this.update(record.fileId, { status: "downloaded", absolutePath });
      } else {
        void this.retryOrFail(record.fileId, `Download ${state}`);
      }
    });
  }

  private claimBrowserDownload(url: string): FileRecord | null {
    const exact = Array.from(this.records.values()).find((candidate) => candidate.contentUrl === url && candidate.status === "downloading");
    if (exact) {
      this.untrackBrowserDownload(exact.fileId);
      return exact;
    }

    while (this.browserDownloadOrder.length > 0) {
      const fileId = this.browserDownloadOrder.shift();
      if (!fileId) continue;
      const record = this.records.get(fileId);
      if (record?.status === "downloading") return record;
    }

    return null;
  }

  private untrackBrowserDownload(fileId: string): void {
    this.browserDownloadOrder = this.browserDownloadOrder.filter((candidate) => candidate !== fileId);
  }

  private armBrowserDownloadTimeout(fileId: string): void {
    this.clearBrowserDownloadTimeout(fileId);
    const timeout = setTimeout(() => {
      const record = this.records.get(fileId);
      if (!record || record.status !== "downloading") return;
      this.moveToManual(fileId, `Browser download did not finish in ${Math.round(this.browserDownloadTimeoutMs / 1000)} seconds. Try this URL manually: ${record.contentUrl}`);
      void this.pump();
    }, this.browserDownloadTimeoutMs);
    this.browserDownloadTimers.set(fileId, timeout);
  }

  private clearBrowserDownloadTimeout(fileId: string): void {
    const timeout = this.browserDownloadTimers.get(fileId);
    if (timeout) clearTimeout(timeout);
    this.browserDownloadTimers.delete(fileId);
  }

  private clearActive(fileId: string): void {
    this.active.delete(fileId);
    this.slotActive.delete(fileId);
  }

  private isAuthorizationDownload(item: DownloadItem): boolean {
    const url = item.getURL();
    const filename = item.getFilename();
    return /^https:\/\/login\.microsoftonline\.com\//i.test(url)
      || /^authorize\.html?$/i.test(filename);
  }

  private async retryOrFail(fileId: string, error: string): Promise<void> {
    const record = this.records.get(fileId);
    if (!record) return;
    if (record.attempts < this.maxAttempts && !this.stopped) {
      this.update(fileId, { status: "queued", error });
      await sleep(Math.min(30000, 1000 * 2 ** record.attempts));
      await this.pump();
      return;
    }
    if (record.kind === "file" || record.kind === "pdf") {
      this.moveToManual(fileId, `${error}. Try this URL manually: ${record.contentUrl}`);
      return;
    }
    this.update(fileId, { status: "failed", error });
  }

  private moveToManual(fileId: string, error: string): void {
    this.untrackBrowserDownload(fileId);
    this.clearBrowserDownloadTimeout(fileId);
    this.clearActive(fileId);
    this.update(fileId, { status: "manual", error });
  }

  private update(fileId: string, patch: Partial<FileRecord>): void {
    const current = this.records.get(fileId);
    if (!current) return;
    const next: FileRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      localPath: patch.localPath ?? current.localPath,
      absolutePath: patch.absolutePath ?? current.absolutePath
    };
    this.records.set(fileId, next);
    this.onRecord(next);
    this.onProgress();
  }

  private hasQueued(): boolean {
    return Array.from(this.records.values()).some((record) => record.status === "queued");
  }
}
