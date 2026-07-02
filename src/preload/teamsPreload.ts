import { contextBridge, ipcRenderer } from "electron";
import {
  AttachmentKind,
  ChatListItem,
  ChatRecord,
  PendingFileRecord,
  TeamsMention,
  TeamsMessageEnvelope,
  VisibleMessageBatch
} from "../shared/types";
import { cleanText, safeFilename, sleep, stableHash } from "../shared/utils";

declare global {
  interface Window {
    teamsBackupDom: TeamsDomApi;
  }
}

interface TeamsDomApi {
  listChatItems(): ChatListItem[];
  openChat(key: string): Promise<boolean>;
  scrollChatListDown(): Promise<{ changed: boolean; atEnd: boolean; scrollTop: number }>;
  scrollChatListTop(): Promise<void>;
  getCurrentChat(): ChatRecord;
  collectVisibleMessages(chatHint?: ChatListItem): Promise<VisibleMessageBatch>;
  scrollMessagesUp(): Promise<{ changed: boolean; scrollTop: number }>;
  recoverMessagesScroll(chatHint?: ChatListItem): Promise<{ recovered: boolean; changed: boolean; scrollTop: number; method: string }>;
  listSharedFiles(chatHint?: ChatListItem): Promise<PendingFileRecord[]>;
  triggerSharedFileDownload(fileId: string, chatHint?: ChatListItem): Promise<boolean>;
}

interface TeamsDomRequest {
  id: string;
  method: keyof TeamsDomApi;
  args?: unknown[];
}

const CHAT_TITLE_SELECTOR = '[id^="title-chat-list-item_"]';
const CHAT_CONVERSATION_VALUE_PATTERN = /\/OneGQL_(GroupChatConversation|OneOnOneChatConversation|MeetingChatConversation)\|19:/i;

function elementText(el: Element | null): string {
  return el ? cleanText((el as HTMLElement).innerText || el.textContent || "") : "";
}

function isVisible(el: Element): boolean {
  const rects = el.getClientRects();
  if (rects.length === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findScrollContainer(el: Element | null): HTMLElement | null {
  let current = el as HTMLElement | null;
  while (current && current !== document.documentElement) {
    const style = getComputedStyle(current);
    if ((style.overflowY === "auto" || style.overflowY === "scroll") && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }

  current = el as HTMLElement | null;
  while (current && current !== document.documentElement) {
    if (current.scrollTop > 0 && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }

  if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight) return el;
  return null;
}

function chatTitleElement(item: Element): Element | null {
  return item.querySelector(CHAT_TITLE_SELECTOR);
}

function chatTitle(item: Element): string {
  return elementText(chatTitleElement(item));
}

function chatItemKey(item: Element): string {
  const titleId = chatTitleElement(item)?.id;
  if (titleId?.startsWith("title-chat-list-item_")) {
    return titleId.replace("title-chat-list-item_", "");
  }

  const value = item.getAttribute("data-fui-tree-item-value") || "";
  const conversationId = value.match(/\|([^|/]*19:[^|/]+)$/i)?.[1] ?? value.match(/(19:[^|/]+)$/i)?.[1];
  if (conversationId) return conversationId;

  return cleanText(item.getAttribute("aria-label") || item.getAttribute("title") || chatTitle(item) || "");
}

function findRecentChatsGroup(): Element | null {
  const folders = Array.from(document.querySelectorAll('[role="treeitem"][data-conversation-folder="true"], [data-conversation-folder="true"]'));
  for (const folder of folders) {
    const value = folder.getAttribute("data-fui-tree-item-value") || "";
    const itemType = folder.getAttribute("data-item-type") || "";
    const headerId = folder.querySelector("[data-id]")?.getAttribute("data-id") || "";
    const isRecentChats = value.includes("RecentChats") || headerId.includes("RECENT_CHATS") || (itemType === "chats" && elementText(folder).startsWith("Chats"));
    if (!isRecentChats) continue;
    const group = Array.from(folder.children).find((child) => child.getAttribute("role") === "group") ?? folder.querySelector('[role="group"]');
    if (group) return group;
  }
  return null;
}

function isChatConversationItem(item: Element): boolean {
  if (!item.matches('[role="treeitem"]') || item.closest("#chat-pane-list")) return false;
  if (!chatTitleElement(item)) return false;

  const value = item.getAttribute("data-fui-tree-item-value") || "";
  if (CHAT_CONVERSATION_VALUE_PATTERN.test(value)) return true;

  const group = item.closest('[role="group"]');
  const folder = group?.closest('[data-conversation-folder="true"]');
  const folderValue = folder?.getAttribute("data-fui-tree-item-value") || "";
  const folderHeaderId = folder?.querySelector("[data-id]")?.getAttribute("data-id") || "";
  return Boolean(group && folder && (folderValue.includes("RecentChats") || folderHeaderId.includes("RECENT_CHATS")));
}

function chatTypeFromItem(item: Element | null, fallbackTitle: string): string {
  const value = item?.getAttribute("data-fui-tree-item-value") || "";
  if (/OneOnOneChatConversation/i.test(value) || /@unq\.gbl\.spaces/i.test(value)) return "oneOnOne";
  if (/MeetingChatConversation/i.test(value) || /19:meeting_/i.test(value)) return "meeting";
  if (/GroupChatConversation/i.test(value) || /@thread\.v2/i.test(value)) return "group";
  const lowerTitle = fallbackTitle.toLowerCase();
  return lowerTitle.includes(",") || lowerTitle.includes(" group") ? "group" : "unknown";
}

function chatTypeFromKey(key: string, title: string): string {
  if (/@unq\.gbl\.spaces/i.test(key)) return "oneOnOne";
  if (/19:meeting_/i.test(key)) return "meeting";
  if (/@thread\.v2/i.test(key)) return "group";
  const lowerTitle = title.toLowerCase();
  return lowerTitle.includes(",") || lowerTitle.includes(" group") ? "group" : "unknown";
}

function isSelectedChatItem(item: Element): boolean {
  const tabster = item.getAttribute("data-tabster") || "";
  return item.getAttribute("aria-selected") === "true"
    || item.matches('[data-is-focusable="true"][aria-selected="true"]')
    || tabster.includes("LeftRailSelectedItem");
}

function findChatListItems(): Element[] {
  const recentChatsGroup = findRecentChatsGroup();
  const titleRoots = Array.from((recentChatsGroup ?? document).querySelectorAll(CHAT_TITLE_SELECTOR));
  const valueRoots = Array.from((recentChatsGroup ?? document).querySelectorAll('[role="treeitem"][data-fui-tree-item-value*="/OneGQL_"]'));
  const raw = [
    ...titleRoots.map((title) => title.closest('[role="treeitem"]')).filter((item): item is Element => Boolean(item)),
    ...valueRoots
  ];
  const seen = new Set<string>();
  return raw.filter((item) => {
    if (!isVisible(item) || !isChatConversationItem(item)) return false;
    const key = chatItemKey(item);
    if (!key || key.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findChatListScrollContainer(): HTMLElement | null {
  const group = findRecentChatsGroup();
  const groupContainer = findScrollContainer(group);
  if (groupContainer && !groupContainer.closest("#chat-pane-list")) return groupContainer;

  for (const item of findChatListItems()) {
    const container = findScrollContainer(item);
    if (container && !container.closest("#chat-pane-list")) return container;
  }
  return null;
}

function findVisibleChatListItemByKey(key: string): Element | null {
  return findChatListItems().find((candidate) => chatItemKey(candidate) === key) ?? null;
}

async function findChatListItemByKey(key: string): Promise<Element | null> {
  const visible = findVisibleChatListItemByKey(key);
  if (visible) return visible;

  const container = findChatListScrollContainer();
  if (!container) return null;

  const originalScrollTop = container.scrollTop;
  container.scrollTop = 0;
  await sleep(700);

  let lastScrollTop = -1;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const item = findVisibleChatListItemByKey(key);
    if (item) return item;

    const atEnd = container.scrollTop + container.clientHeight >= container.scrollHeight - 4;
    if (atEnd || Math.abs(container.scrollTop - lastScrollTop) < 2) break;

    lastScrollTop = container.scrollTop;
    container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + Math.max(240, container.clientHeight * 0.85));
    await sleep(450);
  }

  container.scrollTop = originalScrollTop;
  await sleep(250);
  return null;
}

function clickElement(el: Element): void {
  const row = el.querySelector('[data-inp="simple-collab-chat-switch"], .fui-TreeItemLayout') ?? el;
  const clickable = row.matches("button,a,[role='treeitem'],[role='listitem']")
    ? row
    : row.closest("button,a,[role='treeitem'],[role='listitem']") ?? row;
  clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  (clickable as HTMLElement).click();
}

async function ensureChatTab(): Promise<void> {
  const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a'));
  const chatTab = tabs.find((candidate) => {
    const text = elementText(candidate);
    const label = cleanText(candidate.getAttribute("aria-label") || "");
    return /^(chat)$/i.test(text) || /^(chat)$/i.test(label);
  });
  if (chatTab && chatTab.getAttribute("aria-selected") !== "true") {
    clickElement(chatTab);
    await sleep(900);
  }
}

async function scrollMessagesUpOnce(waitMs = 1500): Promise<{ changed: boolean; scrollTop: number }> {
  const list = document.getElementById("chat-pane-list");
  const container = findScrollContainer(list);
  if (!container) return { changed: false, scrollTop: 0 };
  const before = container.scrollTop;
  container.scrollTop = 0;
  list?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", code: "Home", bubbles: true, cancelable: true }));
  await sleep(waitMs);
  return {
    changed: Math.abs(container.scrollTop - before) > 2,
    scrollTop: container.scrollTop
  };
}

async function jiggleMessageScroll(): Promise<{ changed: boolean; scrollTop: number }> {
  const list = document.getElementById("chat-pane-list");
  const container = findScrollContainer(list);
  if (!container) return { changed: false, scrollTop: 0 };
  const before = container.scrollTop;
  container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + Math.max(180, container.clientHeight * 0.35));
  list?.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", code: "PageDown", bubbles: true, cancelable: true }));
  await sleep(800);
  const up = await scrollMessagesUpOnce(1800);
  return {
    changed: up.changed || Math.abs(container.scrollTop - before) > 2,
    scrollTop: up.scrollTop
  };
}

async function switchAwayAndBack(chatHint?: ChatListItem): Promise<boolean> {
  const targetKey = chatHint?.key || chatItemKey(findChatListItems().find(isSelectedChatItem) ?? document.createElement("div"));
  if (!targetKey) return false;

  const visibleItems = findChatListItems();
  const currentIndex = visibleItems.findIndex((item) => chatItemKey(item) === targetKey || isSelectedChatItem(item));
  const neighbor = visibleItems.find((item, index) => chatItemKey(item) !== targetKey && (currentIndex < 0 || Math.abs(index - currentIndex) <= 2))
    ?? visibleItems.find((item) => chatItemKey(item) !== targetKey);
  if (!neighbor) return false;

  clickElement(neighbor);
  await sleep(1300);

  const target = await findChatListItemByKey(targetKey);
  if (!target) return false;
  clickElement(target);
  await sleep(1700);
  await ensureChatTab();
  return true;
}

async function recoverMessagesScroll(chatHint?: ChatListItem): Promise<{ recovered: boolean; changed: boolean; scrollTop: number; method: string }> {
  await ensureChatTab();

  const jiggle = await jiggleMessageScroll();
  if (jiggle.changed || jiggle.scrollTop === 0) {
    return { recovered: true, changed: jiggle.changed, scrollTop: jiggle.scrollTop, method: "scroll-down-up" };
  }

  const switched = await switchAwayAndBack(chatHint);
  if (!switched) {
    return { recovered: false, changed: jiggle.changed, scrollTop: jiggle.scrollTop, method: "scroll-down-up" };
  }

  const afterSwitch = await jiggleMessageScroll();
  return {
    recovered: afterSwitch.changed || afterSwitch.scrollTop === 0,
    changed: afterSwitch.changed,
    scrollTop: afterSwitch.scrollTop,
    method: "switch-chat-and-scroll"
  };
}

async function ensureNamedTab(name: string): Promise<boolean> {
  const controls = Array.from(document.querySelectorAll('[role="tab"], button, a'));
  const target = controls.find((candidate) => {
    const text = elementText(candidate);
    const label = cleanText(candidate.getAttribute("aria-label") || "");
    return new RegExp(`^${name}$`, "i").test(text) || new RegExp(`^${name}$`, "i").test(label);
  });
  if (!target) return false;
  if (target.getAttribute("aria-selected") !== "true") {
    clickElement(target);
    await sleep(1200);
  }
  return true;
}

async function ensureSharedTab(): Promise<boolean> {
  return ensureNamedTab("Shared");
}

async function ensureSharedFilesFilter(timeoutMs = 10000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const controls = Array.from(document.querySelectorAll('button, [role="tab"], [role="radio"]'));
    const files = controls.find((candidate) => {
      const text = elementText(candidate);
      const label = cleanText(candidate.getAttribute("aria-label") || "");
      return /^files$/i.test(text) || /^files$/i.test(label);
    });
    if (files) {
      if (files.getAttribute("aria-checked") !== "true" && files.getAttribute("aria-selected") !== "true") {
        clickElement(files);
        await sleep(1200);
      }
      return true;
    }
    await sleep(500);
  }
  return false;
}

function hasSharedFilesEmptyState(): boolean {
  const text = cleanText(document.body?.innerText || "");
  return /(\bno files\b|\bno shared files\b|\bnothing shared\b|\bno results\b|no items to show|there are no files)/i.test(text);
}

async function waitForSharedFilesSurface(timeoutMs = 20000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (sharedFileRows().length > 0) return true;
    if (hasSharedFilesEmptyState()) return false;
    await sleep(750);
  }
  return sharedFileRows().length > 0;
}

async function waitForDownloadMenuItem(timeoutMs = 5000): Promise<Element | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
    const download = menuItems.find((item) => /^download$/i.test(elementText(item)));
    if (download) return download;
    await sleep(250);
  }
  return null;
}

function getCurrentChat(chatHint?: ChatListItem): ChatRecord {
  if (chatHint?.key && chatHint.title) {
    return {
      id: chatHint.key,
      topic: chatHint.title,
      chatType: chatTypeFromKey(chatHint.key, chatHint.title),
      webUrl: location.href,
      source: "teams-web-dom",
      extractedAt: new Date().toISOString()
    };
  }

  const titleEl = document.querySelector('[data-tid="chat-header-title"], [data-tid="conversation-header-title"], [data-tid="thread-header-title"], h1[title]');
  const selectedChat = findChatListItems().find(isSelectedChatItem) ?? null;
  const title = elementText(titleEl) || document.title.replace(/\|.*$/, "").trim() || "Teams chat";
  const fallbackTitle = selectedChat ? chatTitle(selectedChat) : "";
  const topic = (!title || /^chat$/i.test(title) || title === "Teams chat") && fallbackTitle ? fallbackTitle : title;
  const encodedThread = (location.href.match(/19%3a[^/?#&]+/i) || location.href.match(/19:[^/?#&]+/i) || [])[0];
  const id = encodedThread ? decodeURIComponent(encodedThread) : selectedChat ? chatItemKey(selectedChat) : `web-${stableHash(`${topic}|${location.href}`)}`;
  const chatType = chatTypeFromItem(selectedChat, topic);
  return {
    id,
    topic,
    chatType,
    webUrl: location.href,
    source: "teams-web-dom",
    extractedAt: new Date().toISOString()
  };
}

function replaceEmojiImages(node: Element): void {
  node.querySelectorAll('img[itemtype*="Emoji"]').forEach((img) => {
    const span = document.createElement("span");
    span.innerText = img.getAttribute("alt") || "";
    img.parentNode?.replaceChild(span, img);
  });
}

function normalizeMentions(node: Element): void {
  node.querySelectorAll('div[aria-label*="Mention"]').forEach((div) => {
    const span = document.createElement("span");
    Array.from(div.childNodes).forEach((child) => span.appendChild(child.cloneNode(true)));
    span.className = div.className;
    (span as HTMLElement).style.fontWeight = "bold";
    div.parentNode?.insertBefore(span, div);
    div.parentNode?.removeChild(div);
  });
}

function normalizeQuotedReplies(node: Element): void {
  node.querySelectorAll('div[data-track-module-name="messageQuotedReply"]').forEach((div) => {
    const blockquote = document.createElement("blockquote");
    Array.from(div.childNodes).forEach((child) => blockquote.appendChild(child.cloneNode(true)));
    blockquote.className = div.className;
    div.parentNode?.insertBefore(blockquote, div);
    div.parentNode?.removeChild(div);
  });
}

function extractMentions(root: Element): TeamsMention[] {
  return Array.from(root.querySelectorAll('[aria-label*="Mention"]'))
    .map((el, index) => {
      const text = elementText(el);
      return {
        id: index,
        mentionText: text,
        mentioned: { user: { id: null, displayName: text.replace(/^@/, "") || null } }
      };
    })
    .filter((mention) => mention.mentionText);
}

function isLikelyDownloadableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/^(https?:\/\/)?teams\.microsoft\.com\/l\//i.test(url);
}

function parsedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isTeamsAsyncImageUrl(value: string): boolean {
  return parsedUrl(value)?.hostname === "as-prod.asyncgw.teams.microsoft.com";
}

function isTeamsUrlPreviewThumbnail(value: string): boolean {
  const url = parsedUrl(value);
  if (!url) return false;
  return url.hostname === "as-prod.asyncgw.teams.microsoft.com"
    && /\/urlp\/v\d+\/[^/]+\/url\/image\/thumbnail$/i.test(url.pathname);
}

function isTeamsProfileImageUrl(value: string): boolean {
  const url = parsedUrl(value);
  if (!url) return false;
  return /(^|\.)teams\.cloud\.microsoft$/i.test(url.hostname)
    && /\/(profilepicturev2|mergedProfilePicturev2)(\/|\?|$)/i.test(url.pathname);
}

function normalizeDownloadUrl(value: string): string {
  const url = parsedUrl(value);
  if (!url) return value;
  if (/sharepoint\.com$/i.test(url.hostname) && /^\/:[a-z]:\//i.test(url.pathname) && !url.searchParams.has("download")) {
    url.searchParams.set("download", "1");
    return url.toString();
  }
  return value;
}

function extensionFromUrl(value: string, fallback: string): string {
  const pathname = parsedUrl(value)?.pathname ?? value;
  const match = pathname.match(/\.([a-z0-9]{2,8})(?:$|[?#])/i);
  return match ? `.${match[1].toLowerCase()}` : fallback;
}

function withExtension(name: string, extension: string): string {
  const cleanName = safeFilename(name, "attachment");
  if (/\.[a-z0-9]{2,8}$/i.test(cleanName)) return cleanName;
  return `${cleanName}${extension}`;
}

function classifyAttachmentUrl(href: string, nearby: Element | null): { kind: AttachmentKind; contentType: string | null; shouldDownload: boolean } | null {
  if (!isLikelyDownloadableUrl(href)) return null;

  const pathname = parsedUrl(href)?.pathname ?? href;

  const lowerPath = pathname.toLowerCase();
  const lowerHref = href.toLowerCase();
  const isAttachmentUi = Boolean(nearby);
  const imageMatch = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)(?:$|[?#])/i.test(lowerPath);
  const pdfMatch = /\.pdf(?:$|[?#])/i.test(lowerPath);
  const fileMatch = /\.(docx?|xlsx?|pptx?|csv|txt|rtf|zip|rar|7z|gz|json|xml|log|md|mp4|mov|m4v|mp3|wav|eml|msg)(?:$|[?#])/i.test(lowerPath);
  const microsoftFileUrl = /(sharepoint|onedrive|download|file|attachment)/i.test(lowerHref) && (isAttachmentUi || /\.[a-z0-9]{2,8}(?:$|[?#])/i.test(lowerPath));

  if (imageMatch) return { kind: "image", contentType: null, shouldDownload: true };
  if (pdfMatch) return { kind: "pdf", contentType: "application/pdf", shouldDownload: true };
  if (fileMatch || microsoftFileUrl || isAttachmentUi) return { kind: "file", contentType: null, shouldDownload: true };
  return null;
}

function makePendingFile(
  chat: ChatRecord,
  messageId: string,
  url: string,
  name: string,
  kind: AttachmentKind,
  contentType: string | null,
  options: { fileIdSeed?: string; localPath?: string } = {}
): PendingFileRecord {
  return {
    fileId: stableHash(options.fileIdSeed ?? `${chat.id}|${messageId}|${url}`),
    chatId: chat.id,
    chatTopic: chat.topic,
    messageId,
    name,
    kind,
    shouldDownload: true,
    contentType,
    contentUrl: url,
    localPath: options.localPath ?? `files/${safeFilename(chat.topic, "chat")}/${messageId}-${safeFilename(name, "attachment")}`,
    source: "teams-web-dom" as const
  };
}

function isSharedFileUrl(value: string): boolean {
  const url = parsedUrl(value);
  if (!url) return false;
  const path = decodeURIComponent(url.pathname).toLowerCase();
  const hasFileExtension = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|pdf|docx?|xlsx?|pptx?|csv|txt|rtf|zip|rar|7z|gz|json|xml|log|md|mp4|mov|m4v|mp3|wav|eml|msg|har)(?:$|[?#])/i.test(path);
  const microsoftFileHost = /(sharepoint\.com|onedrive\.live\.com)$/i.test(url.hostname);
  return hasFileExtension || microsoftFileHost;
}

function sharedFileRows(): Element[] {
  return Array.from(document.querySelectorAll('[role="row"][data-tid="file-table-row"]')).filter(isVisible);
}

function sharedFileFromRow(row: Element, chat: ChatRecord): PendingFileRecord | null {
  const rawUrl = row.getAttribute("title") || "";
  const contentUrl = normalizeDownloadUrl(firstUrlFromText(rawUrl) || rawUrl);
  if (!contentUrl || !isSharedFileUrl(contentUrl)) return null;

  const name = row.querySelector('[data-tid="file-name-column"] button')?.getAttribute("title")
    || elementText(row.querySelector('[data-tid="file-name-column"]'))
    || decodeURIComponent(parsedUrl(contentUrl)?.pathname.split("/").pop() || "")
    || "shared-file";
  const classification = classifyAttachmentUrl(contentUrl, row) || { kind: "file" as AttachmentKind, contentType: null, shouldDownload: true };
  const fileHash = stableHash(`${chat.id}|${contentUrl}|${name}`).slice(0, 12);
  return makePendingFile(chat, "shared-files", contentUrl, name, classification.kind, classification.contentType, {
    fileIdSeed: `shared-file|${chat.id}|${contentUrl}|${name}`,
    localPath: `files/${safeFilename(chat.topic, "chat")}/shared-${fileHash}-${safeFilename(name, "shared-file")}`
  });
}

function sharedFilesScrollContainer(): HTMLElement | null {
  const firstRow = sharedFileRows()[0] ?? document.querySelector('[data-tid="file-table-row"]');
  return findScrollContainer(firstRow) ?? findScrollContainer(document.querySelector('[role="grid"], [role="table"]'));
}

async function listSharedFiles(chatHint?: ChatListItem): Promise<PendingFileRecord[]> {
  const chat = getCurrentChat(chatHint);
  if (!await ensureSharedTab()) return [];
  if (!await ensureSharedFilesFilter()) return [];
  if (!await waitForSharedFilesSurface()) return [];

  const container = sharedFilesScrollContainer();
  if (container) {
    container.scrollTop = 0;
    await sleep(1200);
  }

  const files = new Map<string, PendingFileRecord>();
  let noNewRounds = 0;
  while (noNewRounds < 3) {
    const before = files.size;
    await waitForSharedFilesSurface(4000);
    for (const row of sharedFileRows()) {
      const file = sharedFileFromRow(row, chat);
      if (file) files.set(file.fileId, file);
    }
    if (files.size === before) noNewRounds += 1;
    else noNewRounds = 0;

    if (!container) break;
    const beforeTop = container.scrollTop;
    container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + Math.max(260, container.clientHeight * 0.8));
    await sleep(1200);
    if (Math.abs(container.scrollTop - beforeTop) <= 2 && files.size === before) break;
  }

  return Array.from(files.values());
}

async function triggerSharedFileDownload(fileId: string, chatHint?: ChatListItem): Promise<boolean> {
  const chat = getCurrentChat(chatHint);
  if (!await ensureSharedTab()) return false;
  if (!await ensureSharedFilesFilter()) return false;
  if (!await waitForSharedFilesSurface()) return false;

  const container = sharedFilesScrollContainer();
  if (container) {
    container.scrollTop = 0;
    await sleep(1000);
  }

  let noMoveRounds = 0;
  while (noMoveRounds < 3) {
    await waitForSharedFilesSurface(4000);
    for (const row of sharedFileRows()) {
      const file = sharedFileFromRow(row, chat);
      if (file?.fileId !== fileId) continue;
      row.scrollIntoView({ block: "center" });
      await sleep(250);

      const more = row.querySelector('[data-tid="files-table-row-more-options-trigger"], button[title="More options"]');
      if (!more) return false;
      clickElement(more);
      await sleep(450);

      const download = await waitForDownloadMenuItem();
      if (!download) return false;
      clickElement(download);
      await sleep(800);
      return true;
    }

    if (!container) break;
    const beforeTop = container.scrollTop;
    container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + Math.max(260, container.clientHeight * 0.8));
    await sleep(1200);
    if (Math.abs(container.scrollTop - beforeTop) <= 2) noMoveRounds += 1;
    else noMoveRounds = 0;
  }

  return false;
}

function imageNameFromUrl(src: string, fallback: string): string {
  const url = parsedUrl(src);
  const displayName = url?.searchParams.get("displayname") || url?.searchParams.get("displayName");
  return displayName || fallback;
}

function firstUrlFromText(value: string): string | null {
  return value.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? null;
}

function urlsFromText(value: string): string[] {
  return Array.from(value.matchAll(/https?:\/\/[^\s"'<>),\\]+/gi)).map((match) => match[0]);
}

function urlsFromSrcset(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((value) => /^https?:\/\//i.test(value));
}

function elementImageUrls(element: Element): string[] {
  const urls = new Set<string>();
  if (element instanceof HTMLImageElement) {
    const src = element.currentSrc || element.src || element.getAttribute("src") || "";
    if (src) urls.add(src);
    const srcset = element.getAttribute("srcset");
    if (srcset) urlsFromSrcset(srcset).forEach((url) => urls.add(url));
  }

  for (const attribute of Array.from(element.attributes)) {
    if (!/^(data-url|data-src|srcset|style)$/i.test(attribute.name)) continue;
    urlsFromText(attribute.value).forEach((url) => urls.add(url));
  }

  const backgroundImage = element instanceof HTMLElement ? getComputedStyle(element).backgroundImage : "";
  urlsFromText(backgroundImage).forEach((url) => urls.add(url));
  return Array.from(urls);
}

function extractFiles(root: Element, chat: ChatRecord, messageId: string): PendingFileRecord[] {
  const seen = new Set<string>();
  const linkedFiles = Array.from(root.querySelectorAll("a[href]")).flatMap((link) => {
    const href = normalizeDownloadUrl((link as HTMLAnchorElement).href);
    const name = elementText(link) || link.getAttribute("aria-label") || link.getAttribute("title") || href.split("/").pop() || "attachment";
    const nearby = link.closest('[data-tid*="attachment"], [class*="attachment"], [aria-label*="attachment"], [data-tid*="file"], [class*="file"]');
    const classification = classifyAttachmentUrl(href, nearby);
    if (!classification || seen.has(href)) return [];
    seen.add(href);
    return [makePendingFile(chat, messageId, href, name, classification.kind, classification.contentType)];
  });

  const cardFiles = Array.from(root.querySelectorAll('[data-testid="content-card-custom-title"][aria-label], [aria-description*="open file"][aria-label]')).flatMap((card) => {
    const label = card.getAttribute("aria-label") || "";
    const href = firstUrlFromText(label);
    if (!href) return [];
    const contentUrl = normalizeDownloadUrl(href);
    if (seen.has(contentUrl)) return [];
    const name = cleanText(label.split(/\r?\n/)[0] || elementText(card) || card.getAttribute("aria-label") || contentUrl.split("/").pop() || "attachment");
    const classification = classifyAttachmentUrl(contentUrl, card);
    if (!classification) return [];
    seen.add(contentUrl);
    return [makePendingFile(chat, messageId, contentUrl, name, classification.kind, classification.contentType)];
  });

  const imageCandidates = [root, ...Array.from(root.querySelectorAll("img, [style], [srcset], [data-url], [data-src]"))];
  const inlineImages = imageCandidates.flatMap((element, index) => {
    const nearby = element.closest('[data-tid*="attachment"], [class*="attachment"], [aria-label*="attachment"], [data-tid*="file"], [class*="file"]');
    return elementImageUrls(element).flatMap((src, urlIndex) => {
      const isProfileImage = isTeamsProfileImageUrl(src);
      if (!isLikelyDownloadableUrl(src) || seen.has(src)) return [];
      if (isTeamsUrlPreviewThumbnail(src)) return [];
      if (!isTeamsAsyncImageUrl(src) && !nearby && !isProfileImage) return [];

      seen.add(src);
      const extension = extensionFromUrl(src, ".jpg");
      const rawName = imageNameFromUrl(src, element.getAttribute("alt") || element.getAttribute("title") || element.getAttribute("aria-label") || `image-${index + 1}-${urlIndex + 1}`);
      const name = withExtension(rawName, extension);
      if (isProfileImage) {
        const profileHash = stableHash(src).slice(0, 10);
        const profileName = withExtension(`${rawName || "profile"}-${profileHash}`, extension);
        return [makePendingFile(chat, messageId, src, profileName, "avatar", "image/*", {
          fileIdSeed: `profile-image|${src}`,
          localPath: `files/_profiles/${safeFilename(profileName, "profile.jpg")}`
        })];
      }
      return [makePendingFile(chat, messageId, src, name, "image", "image/*")];
    });
  });

  return [...linkedFiles, ...cardFiles, ...inlineImages];
}

function extractVisibleProfileImages(chat: ChatRecord): PendingFileRecord[] {
  const seen = new Set<string>();
  return Array.from(document.querySelectorAll("img[src]")).flatMap((img, index) => {
    const image = img as HTMLImageElement;
    const src = image.currentSrc || image.src || image.getAttribute("src") || "";
    if (!isTeamsProfileImageUrl(src) || seen.has(src)) return [];
    seen.add(src);
    const extension = extensionFromUrl(src, ".jpg");
    const rawName = imageNameFromUrl(src, image.alt || image.title || image.getAttribute("aria-label") || `profile-${index + 1}`);
    const profileHash = stableHash(src).slice(0, 10);
    const profileName = withExtension(`${rawName || "profile"}-${profileHash}`, extension);
    return [makePendingFile(chat, "profile-images", src, profileName, "avatar", "image/*", {
      fileIdSeed: `profile-image|${src}`,
      localPath: `files/_profiles/${safeFilename(profileName, "profile.jpg")}`
    })];
  });
}

function extractMessage(node: Element, chat: ChatRecord): TeamsMessageEnvelope | null {
  const clone = node.cloneNode(true) as Element;
  replaceEmojiImages(clone);
  normalizeMentions(clone);
  normalizeQuotedReplies(clone);

  const authorEl = clone.querySelector('[data-tid="message-author-name"]');
  const timeEl = clone.querySelector('[id^="timestamp-"]');
  const bodyEl = clone.querySelector('[id^="message-body-"] [id^="content-"]');
  const messageBodyEl = clone.querySelector('[id^="message-body-"]');
  if (!authorEl || !timeEl || !bodyEl || !messageBodyEl) return null;

  const rawId = messageBodyEl.id.replace("message-body-", "");
  const id = rawId || stableHash(`${elementText(authorEl)}|${timeEl.getAttribute("datetime")}|${bodyEl.innerHTML}`);
  const createdDateTime = timeEl.getAttribute("datetime") ? new Date(timeEl.getAttribute("datetime") as string).toISOString() : null;
  const author = elementText(authorEl) || "Unknown";
  const files = extractFiles(node, chat, id);

  return {
    sourceType: "chat",
    chatId: chat.id,
    chatTopic: chat.topic,
    chatType: chat.chatType,
    message: {
      id,
      replyToId: null,
      etag: null,
      messageType: "message",
      createdDateTime,
      lastModifiedDateTime: null,
      lastEditedDateTime: null,
      deletedDateTime: null,
      subject: null,
      summary: null,
      chatId: chat.id,
      importance: "normal",
      locale: null,
      webUrl: chat.webUrl,
      from: {
        user: { id: null, displayName: author, userIdentityType: "unknownFutureValue" },
        application: null,
        device: null
      },
      body: { contentType: "html", content: bodyEl.innerHTML },
      attachments: files
        .filter((file) => file.kind !== "avatar")
        .map((file) => ({
          id: file.fileId,
          name: file.name,
          contentType: file.contentType,
          contentUrl: file.contentUrl
        })),
      mentions: extractMentions(clone),
      reactions: []
    },
    webExtraction: {
      source: "teams-web-dom",
      extractedAt: chat.extractedAt,
      url: chat.webUrl
    },
    attachmentFiles: files
  };
}

function collectVisibleMessages(chatHint?: ChatListItem): VisibleMessageBatch {
  const chat = getCurrentChat(chatHint);
  const list = document.getElementById("chat-pane-list");
  const children = list ? Array.from(list.children) : [];
  const messages = children.map((node) => extractMessage(node, chat)).filter((message): message is TeamsMessageEnvelope => Boolean(message));
  const files = extractVisibleProfileImages(chat);
  const oldestTimestamp = messages
    .map((message) => message.message.createdDateTime)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;
  return { chat, messages, files, oldestTimestamp, visibleCount: messages.length };
}

const api: TeamsDomApi = {
  listChatItems() {
    return findChatListItems().map((item, index) => ({
      key: chatItemKey(item),
      title: chatTitle(item),
      index
    }));
  },
  async openChat(key: string) {
    const item = await findChatListItemByKey(key);
    if (!item) return false;
    clickElement(item);
    await sleep(1200);
    await ensureChatTab();
    return true;
  },
  async scrollChatListDown() {
    const container = findChatListScrollContainer();
    if (!container) return { changed: false, atEnd: true, scrollTop: 0 };
    const before = container.scrollTop;
    container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + Math.max(240, container.clientHeight * 0.85));
    await sleep(900);
    return {
      changed: Math.abs(container.scrollTop - before) > 2,
      atEnd: container.scrollTop + container.clientHeight >= container.scrollHeight - 4,
      scrollTop: container.scrollTop
    };
  },
  async scrollChatListTop() {
    const container = findChatListScrollContainer();
    if (container) container.scrollTop = 0;
    await sleep(600);
  },
  getCurrentChat,
  async collectVisibleMessages(chatHint?: ChatListItem) {
    await ensureChatTab();
    return collectVisibleMessages(chatHint);
  },
  async scrollMessagesUp() {
    return scrollMessagesUpOnce();
  },
  recoverMessagesScroll,
  listSharedFiles,
  triggerSharedFileDownload
};

(globalThis as typeof globalThis & { teamsBackupDom: TeamsDomApi }).teamsBackupDom = api;
contextBridge.exposeInMainWorld("teamsBackupDom", api);

ipcRenderer.on("teams-dom:call", async (_event, request: TeamsDomRequest) => {
  const replyChannel = `teams-dom:reply:${request.id}`;
  try {
    const fn = api[request.method];
    if (typeof fn !== "function") throw new Error(`Unknown Teams helper ${String(request.method)}.`);
    const value = await (fn as (...args: unknown[]) => unknown)(...(request.args ?? []));
    ipcRenderer.send(replyChannel, { ok: true, value });
  } catch (error) {
    ipcRenderer.send(replyChannel, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
