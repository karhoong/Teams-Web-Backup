export type ExportMode = "current" | "all" | "shared-current" | "shared-all";
export type ExportPhase = "idle" | "starting" | "exporting" | "downloading" | "stopped" | "done" | "error";
export type FileStatus = "queued" | "downloading" | "downloaded" | "failed" | "manual";
export type AttachmentKind = "file" | "image" | "pdf" | "avatar" | "link";

export interface ChatRecord {
  id: string;
  topic: string;
  chatType: string;
  webUrl: string;
  source: "teams-web-dom";
  extractedAt: string;
}

export interface TeamsMessageEnvelope {
  sourceType: "chat";
  chatId: string;
  chatTopic: string;
  chatType: string;
  message: {
    id: string;
    replyToId: string | null;
    etag: string | null;
    messageType: string;
    createdDateTime: string | null;
    lastModifiedDateTime: string | null;
    lastEditedDateTime: string | null;
    deletedDateTime: string | null;
    subject: string | null;
    summary: string | null;
    chatId: string;
    importance: string;
    locale: string | null;
    webUrl: string;
    from: {
      user: {
        id: string | null;
        displayName: string;
        userIdentityType: string;
      };
      application: null;
      device: null;
    };
    body: {
      contentType: "html";
      content: string;
    };
    attachments: TeamsAttachment[];
    mentions: TeamsMention[];
    reactions: unknown[];
  };
  webExtraction: {
    source: "teams-web-dom";
    extractedAt: string;
    url: string;
  };
  attachmentFiles?: PendingFileRecord[];
}

export interface TeamsAttachment {
  id: string;
  name: string;
  contentType: string | null;
  contentUrl: string;
}

export interface TeamsMention {
  id: number;
  mentionText: string;
  mentioned: {
    user: {
      id: string | null;
      displayName: string | null;
    };
  };
}

export interface PendingFileRecord {
  fileId: string;
  chatId: string;
  chatTopic: string;
  messageId: string;
  name: string;
  kind: AttachmentKind;
  shouldDownload: boolean;
  contentType: string | null;
  contentUrl: string;
  localPath: string;
  source: "teams-web-dom";
}

export interface FileRecord extends PendingFileRecord {
  status: FileStatus;
  attempts: number;
  queuedAt: string;
  updatedAt: string;
  absolutePath?: string;
  error?: string;
}

export interface QueueItemSummary {
  fileId: string;
  status: FileStatus;
  kind: AttachmentKind;
  chatTopic: string;
  messageId: string;
  name: string;
  localPath: string;
  contentUrl: string;
  attempts: number;
  queuedAt: string;
  updatedAt: string;
  error?: string;
}

export interface QueueItemsSnapshot {
  total: number;
  showing: number;
  items: QueueItemSummary[];
}

export type DiagnosticLevel = "debug" | "info" | "warning" | "error";
export type DiagnosticSource = "app" | "export" | "teams" | "download" | "network";

export interface DiagnosticEvent {
  id: string;
  at: string;
  level: DiagnosticLevel;
  source: DiagnosticSource;
  message: string;
  details?: string;
  exportRoot?: string;
  currentChat?: string;
}

export interface DiagnosticsSnapshot {
  running: boolean;
  stopRequested: boolean;
  phase: ExportPhase | "unknown";
  currentChat?: string;
  exportRoot?: string;
  lastProgressAt?: string;
  lastProgressMessage?: string;
  teamsUrl?: string;
  queue?: {
    total: number;
    queued: number;
    downloading: number;
    active: number;
    workerSlots: number;
    browserPending: number;
    manual: number;
    failed: number;
    downloaded: number;
  };
  events: DiagnosticEvent[];
}

export interface ChatListItem {
  key: string;
  title: string;
  index: number;
}

export interface VisibleMessageBatch {
  chat: ChatRecord;
  messages: TeamsMessageEnvelope[];
  files?: PendingFileRecord[];
  oldestTimestamp: string | null;
  visibleCount: number;
}

export interface ScrollResult {
  changed: boolean;
  atEnd?: boolean;
  scrollTop?: number;
}

export interface ExportStats {
  chats: number;
  messages: number;
  filesQueued: number;
  filesDownloaded: number;
  filesFailed: number;
  filesQueuedByKind?: Record<AttachmentKind, number>;
  filesDownloading?: number;
  filesManual?: number;
}

export interface Checkpoint {
  exportId: string;
  exportRoot: string;
  startedAt: string;
  updatedAt: string;
  mode: ExportMode;
  phase: ExportPhase;
  currentChatId: string | null;
  processedChatKeys: string[];
  messageKeys: string[];
  fileStatuses: Record<string, FileRecord>;
  stats: ExportStats;
}

export interface ExportStartOptions {
  mode: ExportMode;
  exportRoot?: string;
  resume?: boolean;
  downloadConcurrency?: number;
}

export interface ExportProgress {
  phase: ExportPhase;
  message: string;
  exportRoot?: string;
  currentChat?: string;
  stats?: ExportStats;
  error?: string;
}

export interface NetworkEventRecord {
  capturedAt: string;
  url: string;
  status: number;
  mimeType: string;
  method?: string;
  body?: unknown;
  bodyError?: string;
}

export interface AppApi {
  startExport(options: ExportStartOptions): Promise<{ exportRoot: string }>;
  stopExport(): Promise<void>;
  chooseBaseFolder(): Promise<string | null>;
  resumeFromFolder(options?: Pick<ExportStartOptions, "downloadConcurrency">): Promise<{ exportRoot: string } | null>;
  navigateTeams(): Promise<void>;
  resetTeamsSession(): Promise<void>;
  openExportFolder(): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  copyText(text: string): Promise<void>;
  openTeamsDevTools(): Promise<void>;
  openPanelDevTools(): Promise<void>;
  setQueuePanelOpen(open: boolean): Promise<void>;
  setDiagnosticsPanelOpen(open: boolean): Promise<void>;
  getQueueItems(): Promise<QueueItemsSnapshot>;
  getDiagnostics(): Promise<DiagnosticsSnapshot>;
  onQueueVisibility(callback: (open: boolean) => void): () => void;
  onDiagnosticsVisibility(callback: (open: boolean) => void): () => void;
  onDiagnosticEvent(callback: (event: DiagnosticEvent) => void): () => void;
  onProgress(callback: (event: ExportProgress) => void): () => void;
}
