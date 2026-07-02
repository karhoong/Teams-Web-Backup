import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadQueue } from "../main/downloadQueue";
import { FileRecord } from "../shared/types";

function fileRecord(patch: Partial<FileRecord> = {}): FileRecord {
  return {
    fileId: "f1",
    chatId: "c1",
    chatTopic: "Ops",
    messageId: "m1",
    name: "a.txt",
    kind: "file",
    shouldDownload: true,
    contentType: null,
    contentUrl: "https://example.invalid/a.txt",
    localPath: "files/Ops/a.txt",
    source: "teams-web-dom",
    status: "downloading",
    attempts: 1,
    queuedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch
  };
}

describe("DownloadQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requeues interrupted downloads on resume", () => {
    const events: string[] = [];
    const fakeSession = {
      on: () => undefined,
      downloadURL: () => events.push("download")
    };
    const queue = new DownloadQueue({
      session: fakeSession as never,
      resolvePath: (relativePath) => `/tmp/${relativePath}`,
      onRecord: (record) => events.push(record.status),
      onProgress: () => undefined
    });
    queue.seed([fileRecord()]);
    queue.resumePending();
    expect(events).toContain("downloading");
    expect(events).toContain("download");
  });

  it("moves Microsoft authorization downloads to manual instead of opening a save dialog", () => {
    const events: string[] = [];
    let willDownload: ((event: { preventDefault(): void }, item: unknown) => void) | undefined;
    let prevented = false;
    const fakeSession = {
      on: (eventName: string, handler: typeof willDownload) => {
        if (eventName === "will-download") willDownload = handler;
      },
      downloadURL: () => undefined
    };
    const queue = new DownloadQueue({
      session: fakeSession as never,
      downloadURL: () => undefined,
      resolvePath: (relativePath) => `/tmp/${relativePath}`,
      onRecord: (record) => events.push(`${record.status}:${record.error ?? ""}`),
      onProgress: () => undefined
    });

    queue.enqueue(fileRecord({ status: "queued", attempts: 0 }));
    willDownload?.(
      { preventDefault: () => { prevented = true; } },
      {
        getURL: () => "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize",
        getFilename: () => "authorize.html",
        setSavePath: () => {
          throw new Error("authorization downloads should not be saved");
        },
        once: () => undefined
      }
    );

    expect(prevented).toBe(true);
    expect(events.some((event) => event.startsWith("manual:Download redirected to Microsoft sign-in"))).toBe(true);
  });

  it("moves browser downloads to manual when they do not complete", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const fakeSession = {
      on: () => undefined,
      downloadURL: () => undefined
    };
    const queue = new DownloadQueue({
      session: fakeSession as never,
      downloadURL: () => undefined,
      browserDownloadTimeoutMs: 5000,
      resolvePath: (relativePath) => `/tmp/${relativePath}`,
      onRecord: (record) => events.push(`${record.status}:${record.error ?? ""}`),
      onProgress: () => undefined
    });

    queue.enqueue(fileRecord({ status: "queued", attempts: 0 }));
    await vi.advanceTimersByTimeAsync(5000);

    expect(events.some((event) => event.startsWith("manual:Browser download did not finish"))).toBe(true);
  });

  it("tracks Teams UI downloads without blocking normal queue worker slots", () => {
    const events: string[] = [];
    const downloads: string[] = [];
    const fakeSession = {
      on: () => undefined,
      downloadURL: (url: string) => downloads.push(url)
    };
    const queue = new DownloadQueue({
      session: fakeSession as never,
      maxConcurrent: 1,
      resolvePath: (relativePath) => `/tmp/${relativePath}`,
      onRecord: (record) => events.push(`${record.fileId}:${record.status}`),
      onProgress: () => undefined
    });

    queue.expectBrowserDownload(fileRecord({ fileId: "shared", contentUrl: "https://example.invalid/shared.zip" }));
    queue.enqueue(fileRecord({ fileId: "file", status: "queued", attempts: 0, contentUrl: "https://example.invalid/file.txt" }));

    expect(events).toContain("file:downloading");
    expect(downloads).toContain("https://example.invalid/file.txt");
  });
});
