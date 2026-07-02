import { app, BrowserView, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell, session } from "electron";
import type { IpcMainEvent, MenuItemConstructorOptions } from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DownloadQueue } from "./downloadQueue";
import { ExportStore } from "./exportStore";
import { NetworkCapture } from "./networkCapture";
import {
  ChatListItem,
  ChatRecord,
  DiagnosticEvent,
  DiagnosticLevel,
  DiagnosticSource,
  DiagnosticsSnapshot,
  ExportProgress,
  ExportStartOptions,
  FileRecord,
  PendingFileRecord,
  ScrollResult,
  VisibleMessageBatch
} from "../shared/types";
import { sleep } from "../shared/utils";

const TEAMS_URL = "https://teams.cloud.microsoft/";
const TEAMS_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0";
const TEAMS_PARTITION = "persist:teams-web-backup-v2";
const PANEL_HEIGHT = 176;
const DEFAULT_DOWNLOAD_CONCURRENCY = 5;
const APP_NAME = "Teams Web Backup";
const APP_ID = "com.karhoong.teamswebbackup";

interface TeamsDomReply<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

let mainWindow: BrowserWindow | null = null;
let teamsView: BrowserView | null = null;
let exportStore: ExportStore | null = null;
let downloadQueue: DownloadQueue | null = null;
let networkCapture: NetworkCapture | null = null;
let queueWindow: BrowserWindow | null = null;
let diagnosticsWindow: BrowserWindow | null = null;
let running = false;
let stopRequested = false;
let lastExportRoot: string | null = null;
let selectedBaseFolder: string | null = null;
let appQuitting = false;
let lastProgressAt: string | null = null;
let lastProgressMessage = "";
let lastCurrentChat: string | undefined;
let lastPhase: ExportProgress["phase"] | "unknown" = "unknown";
let watchdogTimer: NodeJS.Timeout | null = null;
let lastWatchdogWarningAt = 0;
const diagnosticsLog: DiagnosticEvent[] = [];
const MAX_DIAGNOSTICS = 500;
const WATCHDOG_WARNING_MS = 90000;
const MAX_EXPORT_ROUNDS_PER_CHAT = 2500;
const MAX_CHAT_LIST_FAILURES = 3;
const MAX_CHAT_LIST_SWEEPS = 3;
const MAX_QUEUE_DRAIN_MS = 10 * 60 * 1000;

app.setName(APP_NAME);
if (process.platform === "win32") app.setAppUserModelId(APP_ID);

function appIconPath(): string {
  return path.join(app.getAppPath(), "build", process.platform === "win32" ? "icon.ico" : "icon.png");
}

function createApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{
      label: APP_NAME,
      submenu: [
        { role: "about" as const },
        { type: "separator" as const },
        { role: "hide" as const },
        { role: "hideOthers" as const },
        { role: "unhide" as const },
        { type: "separator" as const },
        { role: "quit" as const }
      ]
    }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open Export Folder",
          click: () => {
            if (lastExportRoot) void shell.openPath(lastExportRoot);
          }
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function diagnosticDetails(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`.trim();
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function addDiagnostic(level: DiagnosticLevel, source: DiagnosticSource, message: string, details?: unknown): DiagnosticEvent {
  const event: DiagnosticEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    level,
    source,
    message,
    details: diagnosticDetails(details),
    exportRoot: exportStore?.exportRoot ?? lastExportRoot ?? undefined,
    currentChat: lastCurrentChat
  };
  diagnosticsLog.push(event);
  if (diagnosticsLog.length > MAX_DIAGNOSTICS) diagnosticsLog.splice(0, diagnosticsLog.length - MAX_DIAGNOSTICS);
  safeSend(mainWindow, "diagnostics:event", event);
  safeSend(queueWindow, "diagnostics:event", event);
  safeSend(diagnosticsWindow, "diagnostics:event", event);
  return event;
}

function safeSend(window: BrowserWindow | null, channel: string, ...args: unknown[]): void {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  window.webContents.send(channel, ...args);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    title: APP_NAME,
    icon: appIconPath(),
    backgroundColor: "#f5f5f7",
    webPreferences: {
      preload: path.join(__dirname, "../preload/appPreload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(app.getAppPath(), "src/renderer/index.html"));

  teamsView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "../preload/teamsPreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: TEAMS_PARTITION
    }
  });
  mainWindow.setBrowserView(teamsView);
  layoutTeamsView();
  const teamsSession = session.fromPartition(TEAMS_PARTITION);
  teamsSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["User-Agent"] = TEAMS_USER_AGENT;
    callback({ requestHeaders: details.requestHeaders });
  });
  teamsView.webContents.setUserAgent(TEAMS_USER_AGENT);
  teamsView.webContents.loadURL(TEAMS_URL, { userAgent: TEAMS_USER_AGENT });
  teamsView.webContents.on("console-message", (details) => {
    console.log(`[teams:console:${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`);
    const level = details.level === "error" ? "error" : details.level === "warning" ? "warning" : "debug";
    addDiagnostic(level, "teams", details.message, `${details.sourceId}:${details.lineNumber}`);
  });
  teamsView.webContents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) {
      console.log(`[teams:navigate] ${url}`);
      addDiagnostic("info", "teams", `Navigating Teams page`, url);
    }
  });
  teamsView.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      console.error(`[teams:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
      addDiagnostic("error", "teams", `Teams page failed to load: ${errorDescription}`, { errorCode, validatedURL });
    }
  });
  teamsView.webContents.on("did-finish-load", () => {
    console.log(`[teams:loaded] ${teamsView?.webContents.getURL()}`);
    addDiagnostic("info", "teams", "Teams page loaded", teamsView?.webContents.getURL());
    void continueFromClassicTeamsInterstitial();
  });
  teamsView.webContents.on("did-navigate", () => {
    void continueFromClassicTeamsInterstitial();
  });
  networkCapture = new NetworkCapture(teamsView.webContents, () => exportStore);

  mainWindow.on("resize", layoutTeamsView);
  mainWindow.on("closed", () => {
    networkCapture?.stop();
    queueWindow?.destroy();
    diagnosticsWindow?.destroy();
    queueWindow = null;
    diagnosticsWindow = null;
    mainWindow = null;
    teamsView = null;
  });
}

function layoutTeamsView(): void {
  if (!mainWindow || !teamsView) return;
  const [width, height] = mainWindow.getContentSize();
  teamsView.setBounds({ x: 0, y: PANEL_HEIGHT, width, height: Math.max(0, height - PANEL_HEIGHT) });
  teamsView.setAutoResize({ width: true, height: true });
}

function sendProgress(event: ExportProgress): void {
  lastProgressAt = new Date().toISOString();
  lastProgressMessage = event.message;
  lastCurrentChat = event.currentChat ?? lastCurrentChat;
  lastPhase = event.phase;
  safeSend(mainWindow, "export:progress", event);
  safeSend(queueWindow, "export:progress", event);
  safeSend(diagnosticsWindow, "export:progress", event);
  if (event.phase === "error") addDiagnostic("error", "export", event.message, event.error);
}

function sendQueueVisibility(open: boolean): void {
  safeSend(mainWindow, "queue:visibility", open);
  safeSend(queueWindow, "queue:visibility", open);
}

function sendDiagnosticsVisibility(open: boolean): void {
  safeSend(mainWindow, "diagnostics:visibility", open);
  safeSend(diagnosticsWindow, "diagnostics:visibility", open);
}

function createQueueWindow(): BrowserWindow {
  if (queueWindow && !queueWindow.isDestroyed()) return queueWindow;
  const parentBounds = mainWindow?.getBounds();
  const viewer = new BrowserWindow({
    width: 980,
    height: 360,
    minWidth: 520,
    minHeight: 240,
    x: parentBounds ? parentBounds.x + Math.max(24, parentBounds.width - 1020) : undefined,
    y: parentBounds ? parentBounds.y + PANEL_HEIGHT + 24 : undefined,
    title: "Download Queue",
    icon: appIconPath(),
    parent: mainWindow ?? undefined,
    resizable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    backgroundColor: "#fbfbfd",
    webPreferences: {
      preload: path.join(__dirname, "../preload/appPreload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  queueWindow = viewer;
  viewer.loadFile(path.join(app.getAppPath(), "src/renderer/queue.html"));
  viewer.on("close", (event) => {
    if (appQuitting) return;
    if (!viewer.isDestroyed()) {
      event.preventDefault();
      viewer.hide();
      sendQueueVisibility(false);
    }
  });
  viewer.on("closed", () => {
    queueWindow = null;
    if (!appQuitting) sendQueueVisibility(false);
  });
  return viewer;
}

function createDiagnosticsWindow(): BrowserWindow {
  if (diagnosticsWindow && !diagnosticsWindow.isDestroyed()) return diagnosticsWindow;
  const parentBounds = mainWindow?.getBounds();
  const viewer = new BrowserWindow({
    width: 1080,
    height: 520,
    minWidth: 640,
    minHeight: 320,
    x: parentBounds ? parentBounds.x + Math.max(24, parentBounds.width - 1120) : undefined,
    y: parentBounds ? parentBounds.y + PANEL_HEIGHT + 64 : undefined,
    title: "Diagnostics",
    icon: appIconPath(),
    parent: mainWindow ?? undefined,
    resizable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    backgroundColor: "#fbfbfd",
    webPreferences: {
      preload: path.join(__dirname, "../preload/appPreload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  diagnosticsWindow = viewer;
  viewer.loadFile(path.join(app.getAppPath(), "src/renderer/diagnostics.html"));
  viewer.on("close", (event) => {
    if (appQuitting) return;
    if (!viewer.isDestroyed()) {
      event.preventDefault();
      viewer.hide();
      sendDiagnosticsVisibility(false);
    }
  });
  viewer.on("closed", () => {
    diagnosticsWindow = null;
    if (!appQuitting) sendDiagnosticsVisibility(false);
  });
  return viewer;
}

function setQueueWindowOpen(open: boolean): void {
  if (open) {
    const viewer = createQueueWindow();
    if (viewer.isMinimized()) viewer.restore();
    viewer.show();
    viewer.focus();
    sendQueueVisibility(true);
    return;
  }
  queueWindow?.hide();
  sendQueueVisibility(false);
}

function setDiagnosticsWindowOpen(open: boolean): void {
  if (open) {
    const viewer = createDiagnosticsWindow();
    if (viewer.isMinimized()) viewer.restore();
    viewer.show();
    viewer.focus();
    sendDiagnosticsVisibility(true);
    return;
  }
  diagnosticsWindow?.hide();
  sendDiagnosticsVisibility(false);
}

async function callTeams<T>(method: string, args: unknown[] = [], timeoutMs = 15000): Promise<T> {
  if (!teamsView) throw new Error("Teams view is not ready.");
  const view = teamsView;
  const id = randomUUID();
  const replyChannel = `teams-dom:reply:${id}`;

  return await new Promise<T>((resolve, reject) => {
    let timeout: NodeJS.Timeout;
    const listener = (_event: IpcMainEvent, reply: TeamsDomReply<T>) => {
      clearTimeout(timeout);
      if (reply?.ok) resolve(reply.value as T);
      else {
        const error = new Error(reply?.error || `Teams helper ${method} failed.`);
        addDiagnostic("error", "export", `Teams helper ${method} failed`, error);
        reject(error);
      }
    };

    timeout = setTimeout(() => {
      ipcMain.removeListener(replyChannel, listener);
      const error = new Error(`Teams helper ${method} did not respond. Reload Teams and try again.`);
      addDiagnostic("error", "export", `Teams helper ${method} timed out`, error);
      reject(error);
    }, timeoutMs);

    ipcMain.once(replyChannel, listener);
    view.webContents.send("teams-dom:call", { id, method, args });
  });
}

function fallbackChatRecord(chatHint?: ChatListItem, currentChat?: string | null): ChatRecord {
  const title = currentChat || chatHint?.title || chatHint?.key || "Current chat";
  return {
    id: chatHint?.key || title,
    topic: title,
    chatType: chatHint?.key?.includes("@thread.v2") ? "group" : "unknown",
    webUrl: teamsView?.webContents.isDestroyed() ? TEAMS_URL : teamsView?.webContents.getURL() || TEAMS_URL,
    source: "teams-web-dom",
    extractedAt: new Date().toISOString()
  };
}

async function continueFromClassicTeamsInterstitial(): Promise<void> {
  if (!teamsView) return;
  try {
    await teamsView.webContents.executeJavaScript(`
      (() => {
        const bodyText = document.body?.innerText || "";
        if (!/Classic Teams is no longer available/i.test(bodyText)) return false;
        const candidates = Array.from(document.querySelectorAll("button, a"));
        const target = candidates.find((el) => /Use Teams on the web/i.test(el.textContent || el.getAttribute("aria-label") || ""));
        if (!target) return false;
        target.click();
        return true;
      })();
    `, true);
  } catch {
    // Best-effort navigation helper only.
  }
}

function normalizeDownloadConcurrency(value: number | undefined): number {
  return Math.min(10, Math.max(1, Math.floor(value ?? DEFAULT_DOWNLOAD_CONCURRENCY)));
}

function createDownloadQueue(store: ExportStore, downloadConcurrency: number): DownloadQueue {
  const teamsSession = session.fromPartition(TEAMS_PARTITION);
  const queue = new DownloadQueue({
    session: teamsSession,
    maxConcurrent: downloadConcurrency,
    downloadURL: (url) => {
      if (teamsView && !teamsView.webContents.isDestroyed()) {
        teamsView.webContents.downloadURL(url);
        return;
      }
      teamsSession.downloadURL(url);
    },
    resolvePath: (relativePath) => store.resolveExportPath(relativePath),
    onRecord: (record) => {
      store.recordFile(record);
      store.writeCheckpoint();
      if (record.status === "manual") addDiagnostic("warning", "download", `Manual download needed: ${record.name}`, record.error);
      else if (record.status === "failed") addDiagnostic("error", "download", `Download failed: ${record.name}`, record.error);
      else if (record.status === "downloaded") addDiagnostic("info", "download", `Downloaded: ${record.name}`, record.localPath);
    },
    onProgress: () => {
      sendProgress({
        phase: "downloading",
        message: "Downloading queued files...",
        exportRoot: store.exportRoot,
        stats: store.stats
      });
    }
  });
  queue.seed(store.fileStatusRecords);
  queue.resumePending();
  return queue;
}

function diagnosticsSnapshot(): DiagnosticsSnapshot {
  return {
    running,
    stopRequested,
    phase: lastPhase,
    currentChat: lastCurrentChat,
    exportRoot: exportStore?.exportRoot ?? lastExportRoot ?? undefined,
    lastProgressAt: lastProgressAt ?? undefined,
    lastProgressMessage: lastProgressMessage || undefined,
    teamsUrl: teamsView?.webContents.getURL(),
    queue: downloadQueue?.getDiagnostics(),
    events: diagnosticsLog.slice().reverse()
  };
}

function startWatchdog(): void {
  if (watchdogTimer) clearInterval(watchdogTimer);
  lastWatchdogWarningAt = 0;
  watchdogTimer = setInterval(() => {
    if (!running || !lastProgressAt) return;
    const idleMs = Date.now() - new Date(lastProgressAt).getTime();
    if (idleMs < WATCHDOG_WARNING_MS) return;
    if (Date.now() - lastWatchdogWarningAt < WATCHDOG_WARNING_MS) return;
    lastWatchdogWarningAt = Date.now();
    const queue = downloadQueue?.getDiagnostics();
    addDiagnostic("warning", "app", `No visible progress for ${Math.round(idleMs / 1000)} seconds`, {
      phase: lastPhase,
      lastProgressMessage,
      currentChat: lastCurrentChat,
      queue,
      teamsUrl: teamsView?.webContents.getURL()
    });
  }, 30000);
}

function stopWatchdog(): void {
  if (!watchdogTimer) return;
  clearInterval(watchdogTimer);
  watchdogTimer = null;
}

async function startExport(options: ExportStartOptions): Promise<{ exportRoot: string }> {
  if (running) throw new Error("An export is already running.");
  if (!teamsView) throw new Error("Teams view is not ready.");

  const exportRoot = options.exportRoot
    ?? path.join(selectedBaseFolder ?? app.getPath("downloads"), "teams-web-backup", new Date().toISOString().replace(/[:.]/g, "-"));

  exportStore = new ExportStore(exportRoot, options.mode, Boolean(options.resume));
  const downloadConcurrency = normalizeDownloadConcurrency(options.downloadConcurrency);
  downloadQueue = createDownloadQueue(exportStore, downloadConcurrency);
  lastExportRoot = exportRoot;
  running = true;
  stopRequested = false;
  addDiagnostic("info", "export", `Export started: ${options.mode}`, { exportRoot, downloadConcurrency, resume: Boolean(options.resume) });
  startWatchdog();
  networkCapture?.start();

  void runExport(options.mode, exportStore, downloadQueue).catch((error) => {
    exportStore?.setPhase("error");
    exportStore?.writeCheckpoint();
    sendProgress({
      phase: "error",
      message: error instanceof Error ? error.message : String(error),
      exportRoot,
      stats: exportStore?.stats,
      error: error instanceof Error ? error.message : String(error)
    });
  }).finally(() => {
    running = false;
    stopWatchdog();
    addDiagnostic("info", "export", "Export task ended", diagnosticsSnapshot().queue);
  });

  return { exportRoot };
}

async function runExport(mode: ExportStartOptions["mode"], store: ExportStore, queue: DownloadQueue): Promise<void> {
  store.setPhase("exporting");
  store.writeCheckpoint();
  sendProgress({ phase: "starting", message: "Starting Teams Web export...", exportRoot: store.exportRoot, stats: store.stats });

  if (mode === "current") {
    await exportOpenedChat(store, queue, store.processedChatKeys);
  } else if (mode === "shared-current") {
    await exportCurrentSharedOnly(store, queue, store.processedChatKeys);
  } else if (mode === "shared-all") {
    await exportAllChats(store, queue, true);
  } else {
    await exportAllChats(store, queue, false);
  }

  if (stopRequested) {
    store.setPhase("stopped");
    store.writeCheckpoint();
    sendProgress({ phase: "stopped", message: "Export stopped. Resume from this folder later.", exportRoot: store.exportRoot, stats: store.stats });
    return;
  }

  store.setPhase("downloading");
  store.writeCheckpoint();
  const completionLabel = mode === "shared-current" || mode === "shared-all" ? "Shared file export pass complete" : "Message export complete";
  sendProgress({ phase: "downloading", message: `${completionLabel}. Waiting for queued downloads...`, exportRoot: store.exportRoot, stats: store.stats });
  const drained = await queue.drain(MAX_QUEUE_DRAIN_MS);
  if (!drained) {
    const message = `Download queue did not finish within ${Math.round(MAX_QUEUE_DRAIN_MS / 60000)} minutes; marking remaining files manual and finishing.`;
    addDiagnostic("warning", "download", message, diagnosticsSnapshot().queue);
    queue.markPendingManual(message);
    store.writeCheckpoint();
  }

  store.setPhase("done");
  store.markChatProgress(null, store.processedChatKeys);
  store.writeCheckpoint();
  sendProgress({ phase: "done", message: "Export complete.", exportRoot: store.exportRoot, stats: store.stats });
}

async function exportAllChats(store: ExportStore, queue: DownloadQueue, sharedOnly: boolean): Promise<void> {
  const processed = store.processedChatKeys;
  const failedOpenCounts = new Map<string, number>();
  let chatListFailures = 0;
  for (let sweep = 1; !stopRequested && sweep <= MAX_CHAT_LIST_SWEEPS; sweep += 1) {
    let sweepNew = 0;
    let noNewRounds = 0;
    try {
      await callTeams<void>("scrollChatListTop", [], 20000);
    } catch (error) {
      addDiagnostic("warning", "export", "Could not scroll chat list to top; continuing from current position", error);
    }

    while (!stopRequested && noNewRounds < 3) {
      let items: ChatListItem[] = [];
      try {
        items = await callTeams<ChatListItem[]>("listChatItems");
        chatListFailures = 0;
      } catch (error) {
        chatListFailures += 1;
        addDiagnostic("warning", "export", `Could not read chat list; ${chatListFailures >= MAX_CHAT_LIST_FAILURES ? "ending this pass" : "will try next list scroll"}`, error);
        if (chatListFailures >= MAX_CHAT_LIST_FAILURES) return;
        try {
          await callTeams<ScrollResult>("scrollChatListDown", [], 20000);
        } catch (scrollError) {
          addDiagnostic("warning", "export", "Could not advance chat list after read failure", scrollError);
        }
        noNewRounds += 1;
        continue;
      }
      let roundNew = 0;

      for (const item of items) {
        if (stopRequested) break;
        const processedKey = processedChatKey(item.key, sharedOnly);
        if (!item.key || processed.has(processedKey)) continue;
        roundNew += 1;
        sweepNew += 1;
        sendProgress({ phase: "exporting", message: `${sharedOnly ? "Scanning Shared files in" : "Opening"} ${item.title || item.key}...`, exportRoot: store.exportRoot, currentChat: item.title, stats: store.stats });
        const opened = await callTeams<boolean>("openChat", [item.key], 45000);
        if (!opened) {
          const failures = (failedOpenCounts.get(processedKey) ?? 0) + 1;
          failedOpenCounts.set(processedKey, failures);
          const message = `Could not open chat: ${item.title || item.key}`;
          if (failures >= 3) {
            addDiagnostic("error", "export", `${message}. Skipping after ${failures} attempts.`, item.key);
            processed.add(processedKey);
            store.markChatProgress(null, processed);
            store.writeCheckpoint();
          } else {
            addDiagnostic("warning", "export", `${message}. It may have moved in the Teams list; will retry.`, item.key);
          }
          continue;
        }
        failedOpenCounts.delete(processedKey);
        try {
          if (sharedOnly) {
            await exportSharedFiles(store, queue, processed, item, item.title);
          } else {
            await exportOpenedChat(store, queue, processed, item);
          }
        } catch (error) {
          addDiagnostic("error", "export", `${item.title || item.key}: export failed; skipping to next chat`, error);
        }
        processed.add(processedKey);
        store.markChatProgress(null, processed);
        store.writeCheckpoint();
      }

      if (roundNew === 0) noNewRounds += 1;
      else noNewRounds = 0;

      try {
        const scroll = await callTeams<ScrollResult>("scrollChatListDown", [], 20000);
        if (!scroll.changed && roundNew === 0) noNewRounds += 1;
        if (scroll.atEnd && roundNew === 0) break;
      } catch (error) {
        addDiagnostic("warning", "export", "Could not scroll chat list down; ending chat-list sweep instead of freezing", error);
        break;
      }
    }

    if (sweepNew === 0) break;
    if (sweep < MAX_CHAT_LIST_SWEEPS) {
      addDiagnostic("info", "export", `Chat-list sweep ${sweep} found ${sweepNew} chats; rescanning from top for newly bumped chats`);
    } else {
      addDiagnostic("warning", "export", `Reached ${MAX_CHAT_LIST_SWEEPS} chat-list sweeps; finishing this pass to avoid endless rescans`);
      break;
    }
  }
}

function processedChatKey(key: string, sharedOnly: boolean): string {
  return sharedOnly ? `shared:${key}` : key;
}

async function exportCurrentSharedOnly(store: ExportStore, queue: DownloadQueue, processed: Set<string>): Promise<void> {
  await exportSharedFiles(store, queue, processed);
}

function enqueueBatchFile(store: ExportStore, queue: DownloadQueue, file: PendingFileRecord): boolean {
  if (!file.shouldDownload || store.hasFile(file.fileId)) return false;
  queue.enqueue(file);
  return true;
}

async function exportOpenedChat(store: ExportStore, queue: DownloadQueue, processed: Set<string>, chatHint?: ChatListItem): Promise<void> {
  let noChangeRounds = 0;
  let scrollFailureRounds = 0;
  let collectFailureRounds = 0;
  let exportRounds = 0;
  let previousSignature = "";
  let currentChat: string | null = null;

  while (!stopRequested && noChangeRounds < 3 && exportRounds < MAX_EXPORT_ROUNDS_PER_CHAT) {
    exportRounds += 1;
    let batch: VisibleMessageBatch;
    try {
      batch = await callTeams<VisibleMessageBatch>("collectVisibleMessages", chatHint ? [chatHint] : [], 30000);
      collectFailureRounds = 0;
    } catch (error) {
      collectFailureRounds += 1;
      addDiagnostic("warning", "export", `${currentChat || chatHint?.title || "Current chat"}: could not read visible messages${collectFailureRounds >= 2 ? "; moving on" : "; trying to recover"}`, error);
      if (collectFailureRounds >= 2) break;
      try {
        await callTeams<{ recovered: boolean; changed: boolean; scrollTop: number; method: string }>("recoverMessagesScroll", chatHint ? [chatHint] : [], 45000);
      } catch (recoveryError) {
        addDiagnostic("warning", "export", `${currentChat || chatHint?.title || "Current chat"}: recovery after message-read failure also failed`, recoveryError);
      }
      continue;
    }
    store.appendChat(batch.chat);
    currentChat = batch.chat.topic;

    let newMessages = 0;
    let newFiles = 0;
    for (const file of batch.files ?? []) {
      if (enqueueBatchFile(store, queue, file as PendingFileRecord)) newFiles += 1;
    }
    for (const envelope of batch.messages) {
      if (store.appendMessage(envelope)) newMessages += 1;
      for (const file of envelope.attachmentFiles ?? []) {
        if (enqueueBatchFile(store, queue, file as PendingFileRecord)) newFiles += 1;
      }
    }

    store.markChatProgress(batch.chat.id, processed);
    store.writeCheckpoint();
    sendProgress({
      phase: "exporting",
      message: `${batch.chat.topic}: +${newMessages} messages, +${newFiles} files`,
      exportRoot: store.exportRoot,
      currentChat: batch.chat.topic,
      stats: store.stats
    });

    const signature = `${batch.oldestTimestamp ?? ""}|${store.stats.messages}|${batch.visibleCount}`;
    if (signature === previousSignature) noChangeRounds += 1;
    else noChangeRounds = 0;
    previousSignature = signature;

    try {
      await callTeams<ScrollResult>("scrollMessagesUp", [], 20000);
      scrollFailureRounds = 0;
    } catch (error) {
      addDiagnostic("warning", "export", `${batch.chat.topic}: scroll helper failed; trying recovery`, error);
      try {
        const recovery = await callTeams<{ recovered: boolean; changed: boolean; scrollTop: number; method: string }>(
          "recoverMessagesScroll",
          chatHint ? [chatHint] : [],
          45000
        );
        addDiagnostic(
          recovery.recovered ? "info" : "warning",
          "export",
          `${batch.chat.topic}: scroll recovery ${recovery.recovered ? "succeeded" : "did not move the message pane"} (${recovery.method})`,
          recovery
        );
        if (recovery.recovered) {
          scrollFailureRounds = 0;
          await sleep(250);
          continue;
        }
      } catch (recoveryError) {
        addDiagnostic("warning", "export", `${batch.chat.topic}: scroll recovery also failed`, recoveryError);
      }

      scrollFailureRounds += 1;
      addDiagnostic(
        scrollFailureRounds >= 2 ? "error" : "warning",
        "export",
        `${batch.chat.topic}: could not scroll to older messages${scrollFailureRounds >= 2 ? "; moving on to Shared files" : "; retrying"}`,
        error
      );
      if (scrollFailureRounds >= 2) break;
    }
    await sleep(250);
  }

  if (exportRounds >= MAX_EXPORT_ROUNDS_PER_CHAT) {
    addDiagnostic("warning", "export", `${currentChat || chatHint?.title || "Current chat"}: reached per-chat round limit; moving on to avoid getting stuck`);
  }

  if (!stopRequested) {
    await exportSharedFiles(store, queue, processed, chatHint, currentChat);
  }
}

async function exportSharedFiles(store: ExportStore, queue: DownloadQueue, processed: Set<string>, chatHint?: ChatListItem, currentChat?: string | null): Promise<void> {
  let chat: ChatRecord;
  try {
    chat = await callTeams<ChatRecord>("getCurrentChat", chatHint ? [chatHint] : [], 15000);
  } catch (error) {
    chat = fallbackChatRecord(chatHint, currentChat);
    addDiagnostic("warning", "export", `${chat.topic}: could not read current chat metadata; using fallback identity`, error);
  }
  store.appendChat(chat);
  sendProgress({
    phase: "exporting",
    message: `${currentChat || chat.topic || chatHint?.title || "Current chat"}: checking Shared files...`,
    exportRoot: store.exportRoot,
    currentChat: currentChat || chat.topic || chatHint?.title,
    stats: store.stats
  });

  let files: PendingFileRecord[] = [];
  try {
    files = await callTeams<PendingFileRecord[]>("listSharedFiles", chatHint ? [chatHint] : [], 90000);
  } catch (error) {
    addDiagnostic("warning", "export", `${currentChat || chat.topic || chatHint?.title || "Current chat"}: Shared files scan failed; moving on`, error);
    sendProgress({
      phase: "exporting",
      message: `${currentChat || chat.topic || chatHint?.title || "Current chat"}: Shared scan failed; moving on`,
      exportRoot: store.exportRoot,
      currentChat: currentChat || chat.topic || chatHint?.title,
      stats: store.stats
    });
    return;
  }
  if (files.length === 0) {
    sendProgress({
      phase: "exporting",
      message: `${currentChat || chat.topic || chatHint?.title || "Current chat"}: no Shared files found or Shared unavailable`,
      exportRoot: store.exportRoot,
      currentChat: currentChat || chat.topic || chatHint?.title,
      stats: store.stats
    });
    return;
  }

  let started = 0;
  for (const file of files) {
    if (stopRequested) break;
    const existingStatus = store.fileStatus(file.fileId);
    if (existingStatus && existingStatus !== "manual") continue;
    if (!queue.expectBrowserDownload(file)) continue;
    started += 1;
    sendProgress({
      phase: "exporting",
      message: `${file.chatTopic}: downloading Shared file ${file.name}`,
      exportRoot: store.exportRoot,
      currentChat: file.chatTopic,
      stats: store.stats
    });
    let clicked = false;
    try {
      clicked = await callTeams<boolean>("triggerSharedFileDownload", [file.fileId, chatHint], 90000);
    } catch (error) {
      queue.markManual(file.fileId, `Could not trigger Teams Shared download menu. Try this URL manually: ${file.contentUrl}`);
      addDiagnostic("warning", "download", `Teams Shared menu download timed out: ${file.name}`, error);
      continue;
    }
    if (!clicked) {
      console.warn(`[shared-files] Could not trigger Teams menu download for ${file.name}`);
      addDiagnostic("warning", "download", `Could not trigger Teams Shared menu download: ${file.name}`, file.contentUrl);
      queue.markManual(file.fileId, `Teams Shared download menu was not available. Try this URL manually: ${file.contentUrl}`);
    }
    await sleep(1200);
  }

  if (started > 0) {
    store.markChatProgress(null, processed);
    store.writeCheckpoint();
    sendProgress({
      phase: "exporting",
      message: `${currentChat || chatHint?.title || "Current chat"}: triggered ${started} Shared file downloads`,
      exportRoot: store.exportRoot,
      currentChat: currentChat || chatHint?.title,
      stats: store.stats
    });
  }
}

async function stopExport(): Promise<void> {
  stopRequested = true;
  addDiagnostic("warning", "export", "Stop requested by user");
  downloadQueue?.stop();
  exportStore?.setPhase("stopped");
  exportStore?.writeCheckpoint();
  sendProgress({ phase: "stopped", message: "Stop requested.", exportRoot: exportStore?.exportRoot, stats: exportStore?.stats });
}

async function resetTeamsSession(): Promise<void> {
  if (running) await stopExport();
  const teamsSession = session.fromPartition(TEAMS_PARTITION);
  sendProgress({ phase: "idle", message: "Resetting Teams session storage..." });
  addDiagnostic("warning", "teams", "Resetting Teams session storage");
  await teamsView?.webContents.loadURL("about:blank");
  await teamsSession.clearCache();
  await teamsSession.clearStorageData();
  await teamsView?.webContents.loadURL(TEAMS_URL, { userAgent: TEAMS_USER_AGENT });
  sendProgress({ phase: "idle", message: "Teams session reset. Sign in again if prompted." });
}

function registerIpc(): void {
  ipcMain.handle("export:start", (_event, options: ExportStartOptions) => startExport(options));
  ipcMain.handle("export:stop", () => stopExport());
  ipcMain.handle("export:chooseBaseFolder", async () => {
    const options = { properties: ["openDirectory"] as Array<"openDirectory">, title: "Choose Teams backup parent folder" };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    selectedBaseFolder = result.filePaths[0];
    return selectedBaseFolder;
  });
  ipcMain.handle("export:resumeFromFolder", async (_event, resumeOptions?: Pick<ExportStartOptions, "downloadConcurrency">) => {
    const dialogOptions = { properties: ["openDirectory"] as Array<"openDirectory">, title: "Choose existing Teams backup folder" };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) return null;
    return startExport({ mode: "all", exportRoot: result.filePaths[0], resume: true, downloadConcurrency: resumeOptions?.downloadConcurrency });
  });
  ipcMain.handle("teams:navigate", async () => {
    await teamsView?.webContents.loadURL(TEAMS_URL, { userAgent: TEAMS_USER_AGENT });
  });
  ipcMain.handle("teams:resetSession", () => resetTeamsSession());
  ipcMain.handle("export:openFolder", async () => {
    if (lastExportRoot) await shell.openPath(lastExportRoot);
  });
  ipcMain.handle("external:openUrl", async (_event, url: string) => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url);
  });
  ipcMain.handle("clipboard:copyText", (_event, text: string) => {
    clipboard.writeText(text);
  });
  ipcMain.handle("devtools:teams", () => {
    teamsView?.webContents.openDevTools({ mode: "detach" });
  });
  ipcMain.handle("devtools:panel", () => {
    mainWindow?.webContents.openDevTools({ mode: "detach" });
  });
  ipcMain.handle("ui:setQueuePanelOpen", (_event, open: boolean) => {
    setQueueWindowOpen(open);
  });
  ipcMain.handle("ui:setDiagnosticsPanelOpen", (_event, open: boolean) => {
    setDiagnosticsWindowOpen(open);
  });
  ipcMain.handle("export:getQueueItems", () => exportStore?.getQueueItems() ?? { total: 0, showing: 0, items: [] });
  ipcMain.handle("diagnostics:get", () => diagnosticsSnapshot());
}

app.whenReady().then(() => {
  createApplicationMenu();
  if (process.platform === "darwin") app.dock?.setIcon(appIconPath());
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  appQuitting = true;
  networkCapture?.stop();
  downloadQueue?.stop();
  queueWindow?.destroy();
  diagnosticsWindow?.destroy();
  stopWatchdog();
});
