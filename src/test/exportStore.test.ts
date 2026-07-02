import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExportStore } from "../main/exportStore";
import { FileRecord, TeamsMessageEnvelope } from "../shared/types";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "teams-web-backup-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function message(id: string): TeamsMessageEnvelope {
  return {
    sourceType: "chat",
    chatId: "chat-1",
    chatTopic: "Ops",
    chatType: "group",
    message: {
      id,
      replyToId: null,
      etag: null,
      messageType: "message",
      createdDateTime: "2026-01-01T00:00:00.000Z",
      lastModifiedDateTime: null,
      lastEditedDateTime: null,
      deletedDateTime: null,
      subject: null,
      summary: null,
      chatId: "chat-1",
      importance: "normal",
      locale: null,
      webUrl: "https://teams.microsoft.com",
      from: {
        user: { id: null, displayName: "Ava", userIdentityType: "unknownFutureValue" },
        application: null,
        device: null
      },
      body: { contentType: "html", content: "<p>Hello</p>" },
      attachments: [],
      mentions: [],
      reactions: []
    },
    webExtraction: {
      source: "teams-web-dom",
      extractedAt: "2026-01-01T00:00:00.000Z",
      url: "https://teams.microsoft.com"
    }
  };
}

describe("ExportStore", () => {
  it("dedupes messages and resumes existing state", () => {
    const store = new ExportStore(dir, "current", false);
    expect(store.appendMessage(message("m1"))).toBe(true);
    expect(store.appendMessage(message("m1"))).toBe(false);
    store.writeCheckpoint();

    const resumed = new ExportStore(dir, "all", true);
    expect(resumed.hasMessage("chat-1", "m1")).toBe(true);
    expect(resumed.stats.messages).toBe(1);
  });

  it("records file status transitions in checkpoint", () => {
    const store = new ExportStore(dir, "current", false);
    const file: FileRecord = {
      fileId: "f1",
      chatId: "chat-1",
      chatTopic: "Ops",
      messageId: "m1",
      name: "notes.txt",
      kind: "file",
      shouldDownload: true,
      contentType: null,
      contentUrl: "https://example.invalid/notes.txt",
      localPath: "files/Ops/notes.txt",
      source: "teams-web-dom",
      status: "downloaded",
      attempts: 1,
      queuedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    store.recordFile(file);
    store.writeCheckpoint();

    const checkpoint = ExportStore.readCheckpoint(dir);
    expect(checkpoint?.stats.filesDownloaded).toBe(1);
    expect(checkpoint?.fileStatuses.f1.status).toBe("downloaded");
  });

  it("returns queued and downloading items with active downloads first", () => {
    const store = new ExportStore(dir, "current", false);
    const base: FileRecord = {
      fileId: "queued",
      chatId: "chat-1",
      chatTopic: "Ops",
      messageId: "m1",
      name: "image.jpg",
      kind: "image",
      shouldDownload: true,
      contentType: null,
      contentUrl: "https://example.invalid/image.jpg",
      localPath: "files/Ops/image.jpg",
      source: "teams-web-dom",
      status: "queued",
      attempts: 0,
      queuedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    store.recordFile(base);
    store.recordFile({ ...base, fileId: "done", status: "downloaded", name: "done.jpg" });
    store.recordFile({ ...base, fileId: "active", status: "downloading", name: "active.jpg", attempts: 1 });

    const snapshot = store.getQueueItems();
    expect(snapshot.total).toBe(2);
    expect(snapshot.items.map((item) => item.fileId)).toEqual(["active", "queued"]);
  });

  it("exposes file status for retry decisions", () => {
    const store = new ExportStore(dir, "shared-all", false);
    const file: FileRecord = {
      fileId: "manual",
      chatId: "chat-1",
      chatTopic: "Ops",
      messageId: "shared-files",
      name: "notes.zip",
      kind: "file",
      shouldDownload: true,
      contentType: null,
      contentUrl: "https://example.invalid/notes.zip",
      localPath: "files/Ops/notes.zip",
      source: "teams-web-dom",
      status: "manual",
      attempts: 1,
      queuedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    store.recordFile(file);
    expect(store.fileStatus("manual")).toBe("manual");
    expect(store.fileStatus("missing")).toBeNull();
  });

  it("removes matching manual items when a Shared download succeeds", () => {
    const store = new ExportStore(dir, "current", false);
    const manual: FileRecord = {
      fileId: "manual",
      chatId: "chat-1",
      chatTopic: "Ops",
      messageId: "m1",
      name: "notes.zip",
      kind: "file",
      shouldDownload: true,
      contentType: null,
      contentUrl: "https://example.invalid/notes.zip",
      localPath: "files/Ops/m1-notes.zip",
      source: "teams-web-dom",
      status: "manual",
      attempts: 1,
      queuedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      error: "manual"
    };
    store.recordFile(manual);
    store.recordFile({
      ...manual,
      fileId: "shared",
      messageId: "shared-files",
      localPath: "files/Ops/shared-notes.zip",
      status: "downloaded",
      absolutePath: path.join(dir, "files/Ops/shared-notes.zip"),
      error: undefined
    });

    const checkpoint = ExportStore.readCheckpoint(dir);
    store.writeCheckpoint();
    const written = ExportStore.readCheckpoint(dir);
    expect(checkpoint).not.toBeNull();
    expect(written?.fileStatuses.manual.status).toBe("downloaded");
    expect(written?.stats.filesManual).toBe(0);
  });

  it("pairs Shared downloads to manual files by exact URL before filename", () => {
    const store = new ExportStore(dir, "current", false);
    const base: FileRecord = {
      fileId: "manual-a",
      chatId: "chat-1",
      chatTopic: "Ops",
      messageId: "m1",
      name: "report.pdf",
      kind: "pdf",
      shouldDownload: true,
      contentType: "application/pdf",
      contentUrl: "https://tenant.sharepoint.com/sites/a/report-a.pdf?download=1",
      localPath: "files/Ops/m1-report.pdf",
      source: "teams-web-dom",
      status: "manual",
      attempts: 1,
      queuedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      error: "manual"
    };

    store.recordFile(base);
    store.recordFile({
      ...base,
      fileId: "manual-b",
      messageId: "m2",
      contentUrl: "https://tenant.sharepoint.com/sites/a/report-b.pdf?download=1",
      localPath: "files/Ops/m2-report.pdf"
    });
    store.recordFile({
      ...base,
      fileId: "shared",
      messageId: "shared-files",
      contentUrl: "https://tenant.sharepoint.com/sites/a/report-a.pdf",
      localPath: "files/Ops/shared-report.pdf",
      status: "downloaded",
      absolutePath: path.join(dir, "files/Ops/shared-report.pdf"),
      error: undefined
    });

    store.writeCheckpoint();
    const written = ExportStore.readCheckpoint(dir);
    expect(written?.fileStatuses["manual-a"].status).toBe("downloaded");
    expect(written?.fileStatuses["manual-b"].status).toBe("manual");
    expect(written?.stats.filesManual).toBe(1);
  });

  it("does not clear ambiguous manual files that only match by filename", () => {
    const store = new ExportStore(dir, "current", false);
    const base: FileRecord = {
      fileId: "manual-a",
      chatId: "chat-1",
      chatTopic: "Ops",
      messageId: "m1",
      name: "report.pdf",
      kind: "pdf",
      shouldDownload: true,
      contentType: "application/pdf",
      contentUrl: "https://tenant.sharepoint.com/sites/a/report-a.pdf",
      localPath: "files/Ops/m1-report.pdf",
      source: "teams-web-dom",
      status: "manual",
      attempts: 1,
      queuedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      error: "manual"
    };

    store.recordFile(base);
    store.recordFile({
      ...base,
      fileId: "manual-b",
      messageId: "m2",
      contentUrl: "https://tenant.sharepoint.com/sites/a/report-b.pdf",
      localPath: "files/Ops/m2-report.pdf"
    });
    store.recordFile({
      ...base,
      fileId: "shared",
      messageId: "shared-files",
      contentUrl: "https://tenant.sharepoint.com/sites/a/generated-download-url",
      localPath: "files/Ops/shared-report.pdf",
      status: "downloaded",
      absolutePath: path.join(dir, "files/Ops/shared-report.pdf"),
      error: undefined
    });

    store.writeCheckpoint();
    const written = ExportStore.readCheckpoint(dir);
    expect(written?.fileStatuses["manual-a"].status).toBe("manual");
    expect(written?.fileStatuses["manual-b"].status).toBe("manual");
    expect(written?.stats.filesManual).toBe(2);
  });
});
