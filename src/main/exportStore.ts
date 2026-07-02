import fs from "node:fs";
import path from "node:path";
import {
  ChatRecord,
  Checkpoint,
  ExportMode,
  ExportStats,
  FileRecord,
  NetworkEventRecord,
  QueueItemsSnapshot,
  TeamsMessageEnvelope
} from "../shared/types";
import { ensureInside, makeTimestampSlug, messageKey, safeFilename } from "../shared/utils";

interface ExistingState {
  checkpoint: Checkpoint;
  messageKeys: Set<string>;
  chatIds: Set<string>;
  fileStatuses: Map<string, FileRecord>;
}

export class ExportStore {
  readonly exportRoot: string;
  readonly exportId: string;
  private readonly chatsFile: string;
  private readonly messagesFile: string;
  private readonly filesFile: string;
  private readonly networkFile: string;
  private readonly manifestFile: string;
  private readonly checkpointFile: string;
  private checkpoint: Checkpoint;
  private messageKeys = new Set<string>();
  private chatIds = new Set<string>();
  private fileStatuses = new Map<string, FileRecord>();

  constructor(exportRoot: string, mode: ExportMode, resume: boolean) {
    this.exportRoot = exportRoot;
    this.chatsFile = path.join(exportRoot, "chats.jsonl");
    this.messagesFile = path.join(exportRoot, "chat_messages.jsonl");
    this.filesFile = path.join(exportRoot, "files.jsonl");
    this.networkFile = path.join(exportRoot, "network_events.jsonl");
    this.manifestFile = path.join(exportRoot, "manifest.json");
    this.checkpointFile = path.join(exportRoot, "checkpoint.json");

    fs.mkdirSync(exportRoot, { recursive: true });
    fs.mkdirSync(path.join(exportRoot, "files"), { recursive: true });

    const existing = resume ? this.loadExistingState(mode) : null;
    this.exportId = existing?.checkpoint.exportId ?? makeTimestampSlug();
    this.messageKeys = existing?.messageKeys ?? new Set();
    this.chatIds = existing?.chatIds ?? new Set();
    this.fileStatuses = existing?.fileStatuses ?? new Map();
    this.checkpoint = existing?.checkpoint ?? this.createCheckpoint(mode);
    this.checkpoint.mode = mode;
    this.checkpoint.phase = "starting";
    this.checkpoint.exportRoot = exportRoot;
    this.writeManifest(mode);
    this.writeCheckpoint();
  }

  get stats(): ExportStats {
    return this.checkpoint.stats;
  }

  get fileStatusRecords(): FileRecord[] {
    return Array.from(this.fileStatuses.values());
  }

  getQueueItems(limit = 2000): QueueItemsSnapshot {
    const pending = Array.from(this.fileStatuses.values())
      .filter((file) => file.status === "queued" || file.status === "downloading" || file.status === "manual")
      .sort((a, b) => {
        if (a.status === "manual" && b.status !== "manual") return 1;
        if (b.status === "manual" && a.status !== "manual") return -1;
        if (a.status !== b.status) return a.status === "downloading" ? -1 : 1;
        return a.queuedAt.localeCompare(b.queuedAt);
      });

    return {
      total: pending.length,
      showing: Math.min(limit, pending.length),
      items: pending.slice(0, limit).map((file) => ({
        fileId: file.fileId,
        status: file.status,
        kind: file.kind,
        chatTopic: file.chatTopic,
        messageId: file.messageId,
        name: file.name,
        localPath: file.localPath,
        contentUrl: file.contentUrl,
        attempts: file.attempts,
        queuedAt: file.queuedAt,
        updatedAt: file.updatedAt,
        error: file.error
      }))
    };
  }

  get processedChatKeys(): Set<string> {
    return new Set(this.checkpoint.processedChatKeys);
  }

  hasMessage(chatId: string, id: string): boolean {
    return this.messageKeys.has(messageKey(chatId, id));
  }

  hasFile(fileId: string): boolean {
    const status = this.fileStatuses.get(fileId)?.status;
    return status === "queued" || status === "downloading" || status === "downloaded" || status === "manual";
  }

  fileStatus(fileId: string): FileRecord["status"] | null {
    return this.fileStatuses.get(fileId)?.status ?? null;
  }

  appendChat(chat: ChatRecord): boolean {
    fs.mkdirSync(this.resolveExportPath(`files/${safeFilename(chat.topic, "chat")}`), { recursive: true });
    if (this.chatIds.has(chat.id)) return false;
    this.chatIds.add(chat.id);
    this.appendJsonl(this.chatsFile, chat);
    this.checkpoint.stats.chats = this.chatIds.size;
    return true;
  }

  appendMessage(envelope: TeamsMessageEnvelope): boolean {
    const key = messageKey(envelope.chatId, envelope.message.id);
    if (this.messageKeys.has(key)) return false;
    this.messageKeys.add(key);
    const record = { ...envelope };
    delete record.attachmentFiles;
    this.appendJsonl(this.messagesFile, record);
    this.checkpoint.stats.messages = this.messageKeys.size;
    return true;
  }

  recordFile(file: FileRecord): void {
    this.fileStatuses.set(file.fileId, file);
    this.appendJsonl(this.filesFile, file);
    if (file.status === "downloaded") this.markMatchingManualFilesDownloaded(file);
    this.refreshFileStats();
  }

  appendNetworkEvent(record: NetworkEventRecord): void {
    this.appendJsonl(this.networkFile, record);
  }

  markChatProgress(chatId: string | null, processedChatKeys: Set<string>): void {
    this.checkpoint.currentChatId = chatId;
    this.checkpoint.processedChatKeys = Array.from(processedChatKeys);
  }

  setPhase(phase: Checkpoint["phase"]): void {
    this.checkpoint.phase = phase;
  }

  writeCheckpoint(): void {
    this.checkpoint.updatedAt = new Date().toISOString();
    this.checkpoint.messageKeys = Array.from(this.messageKeys);
    this.checkpoint.fileStatuses = Object.fromEntries(this.fileStatuses);
    this.refreshFileStats();
    fs.writeFileSync(this.checkpointFile, `${JSON.stringify(this.checkpoint, null, 2)}\n`);
  }

  resolveExportPath(relativePath: string): string {
    const absolute = ensureInside(this.exportRoot, relativePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    return absolute;
  }

  static createDefaultRoot(downloadsPath: string): string {
    return path.join(downloadsPath, "teams-web-backup", makeTimestampSlug());
  }

  static readCheckpoint(exportRoot: string): Checkpoint | null {
    const file = path.join(exportRoot, "checkpoint.json");
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as Checkpoint;
  }

  private createCheckpoint(mode: ExportMode): Checkpoint {
    const now = new Date().toISOString();
    return {
      exportId: this.exportId ?? makeTimestampSlug(),
      exportRoot: this.exportRoot,
      startedAt: now,
      updatedAt: now,
      mode,
      phase: "starting",
      currentChatId: null,
      processedChatKeys: [],
      messageKeys: [],
      fileStatuses: {},
      stats: {
        chats: 0,
        messages: 0,
        filesQueued: 0,
        filesDownloaded: 0,
        filesFailed: 0,
        filesQueuedByKind: { file: 0, image: 0, pdf: 0, avatar: 0, link: 0 },
        filesDownloading: 0,
        filesManual: 0
      }
    };
  }

  private loadExistingState(mode: ExportMode): ExistingState | null {
    const checkpoint = ExportStore.readCheckpoint(this.exportRoot);
    const messageKeys = new Set<string>();
    const chatIds = new Set<string>();
    const fileStatuses = new Map<string, FileRecord>();

    for (const chat of this.readJsonl<ChatRecord>(this.chatsFile)) {
      chatIds.add(chat.id);
    }
    for (const envelope of this.readJsonl<TeamsMessageEnvelope>(this.messagesFile)) {
      messageKeys.add(messageKey(envelope.chatId, envelope.message.id));
    }
    for (const file of this.readJsonl<FileRecord>(this.filesFile)) {
      fileStatuses.set(file.fileId, file);
    }

    if (!checkpoint) {
      const fallback = this.createCheckpoint(mode);
      fallback.stats.chats = chatIds.size;
      fallback.stats.messages = messageKeys.size;
      fallback.fileStatuses = Object.fromEntries(fileStatuses);
      fallback.processedChatKeys = [];
      return { checkpoint: fallback, messageKeys, chatIds, fileStatuses };
    }

    checkpoint.stats.chats = Math.max(checkpoint.stats.chats, chatIds.size);
    checkpoint.stats.messages = Math.max(checkpoint.stats.messages, messageKeys.size);
    return { checkpoint, messageKeys, chatIds, fileStatuses };
  }

  private writeManifest(mode: ExportMode): void {
    const manifest = {
      exportId: this.exportId,
      source: "teams-web-dom",
      mode,
      exportRoot: this.exportRoot,
      createdOrResumedAt: new Date().toISOString(),
      files: {
        chats: "chats.jsonl",
        messages: "chat_messages.jsonl",
        fileEvents: "files.jsonl",
        networkEvents: "network_events.jsonl",
        checkpoint: "checkpoint.json"
      },
      note: "DOM extraction is authoritative. Network events are opportunistic diagnostics."
    };
    fs.writeFileSync(this.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  private appendJsonl(file: string, record: unknown): void {
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
  }

  private markMatchingManualFilesDownloaded(downloaded: FileRecord): void {
    const manualRecords = Array.from(this.fileStatuses.values())
      .filter((manual) => manual.fileId !== downloaded.fileId && manual.status === "manual");
    const exactMatches = manualRecords.filter((manual) => this.isSameFileUrl(downloaded, manual));
    const fallbackMatches = exactMatches.length > 0 ? exactMatches : this.uniqueFilenameMatch(downloaded, manualRecords);

    for (const manual of fallbackMatches) {
      const resolved: FileRecord = {
        ...manual,
        status: "downloaded",
        absolutePath: downloaded.absolutePath,
        error: undefined,
        updatedAt: new Date().toISOString()
      };
      this.fileStatuses.set(resolved.fileId, resolved);
      this.appendJsonl(this.filesFile, resolved);
    }
  }

  private isSameFileUrl(a: FileRecord, b: FileRecord): boolean {
    const sameChat = a.chatId === b.chatId || a.chatTopic === b.chatTopic;
    if (!sameChat) return false;
    return this.normalizedContentUrl(a.contentUrl) === this.normalizedContentUrl(b.contentUrl);
  }

  private uniqueFilenameMatch(downloaded: FileRecord, manuals: FileRecord[]): FileRecord[] {
    const downloadedName = safeFilename(downloaded.name, "file").toLowerCase();
    const matches = manuals.filter((manual) => {
      const sameChat = downloaded.chatId === manual.chatId || downloaded.chatTopic === manual.chatTopic;
      if (!sameChat) return false;
      return safeFilename(manual.name, "file").toLowerCase() === downloadedName
        || this.urlBasename(downloaded.contentUrl) === this.urlBasename(manual.contentUrl);
    });
    return matches.length === 1 ? matches : [];
  }

  private normalizedContentUrl(value: string): string {
    try {
      const url = new URL(value);
      url.hash = "";
      url.hostname = url.hostname.toLowerCase();
      url.protocol = url.protocol.toLowerCase();
      url.searchParams.delete("download");
      url.searchParams.sort();
      return url.toString();
    } catch {
      return value;
    }
  }

  private urlBasename(value: string): string {
    try {
      const url = new URL(value);
      return safeFilename(decodeURIComponent(url.pathname.split("/").pop() || ""), "file").toLowerCase();
    } catch {
      return "";
    }
  }

  private readJsonl<T>(file: string): T[] {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as T];
        } catch {
          return [];
        }
      });
  }

  private refreshFileStats(): void {
    let queued = 0;
    let downloaded = 0;
    let failed = 0;
    let downloading = 0;
    let manual = 0;
    const byKind = { file: 0, image: 0, pdf: 0, avatar: 0, link: 0 };
    for (const file of this.fileStatuses.values()) {
      if (file.status === "downloaded") downloaded += 1;
      else if (file.status === "failed") failed += 1;
      else if (file.status === "manual") manual += 1;
      else {
        queued += 1;
        if (file.status === "downloading") downloading += 1;
        byKind[file.kind] += 1;
      }
    }
    this.checkpoint.stats.filesQueued = queued;
    this.checkpoint.stats.filesDownloaded = downloaded;
    this.checkpoint.stats.filesFailed = failed;
    this.checkpoint.stats.filesQueuedByKind = byKind;
    this.checkpoint.stats.filesDownloading = downloading;
    this.checkpoint.stats.filesManual = manual;
  }
}
