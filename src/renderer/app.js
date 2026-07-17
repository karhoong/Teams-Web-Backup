const i18n = window.TeamsBackupI18n;
const statusText = document.getElementById("statusText");
const chatCount = document.getElementById("chatCount");
const messageCount = document.getElementById("messageCount");
const queuedCount = document.getElementById("queuedCount");
const downloadedCount = document.getElementById("downloadedCount");
const failedCount = document.getElementById("failedCount");
const queueToggleBtn = document.getElementById("queueToggleBtn");
const queueToggleText = document.getElementById("queueToggleText");
const panel = document.querySelector(".panel");

let queueOpen = false;
let diagnosticsOpen = false;
let diagnosticAlertCount = 0;
let busy = false;
let lastPanelHeight = 0;
let lastProgressEvent = null;
let appInfo = { name: "Teams Web Backup", version: "" };
let readiness = { signedIn: false, chatsReady: false, currentChatReady: false, reason: "loading" };

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function renderAppIdentity() {
  document.getElementById("versionLabel").textContent = `v${appInfo.version}`;
  document.title = `${i18n.t("appName")} v${appInfo.version}`;
}

function translateProgressMessage(message) {
  const exact = {
    "Starting Teams Web export...": "progressStarting",
    "Expanding the complete Teams chat list...": "progressExpandingChats",
    "Downloading queued files...": "progressDownloading",
    "Export complete.": "progressComplete",
    "Export stopped. Resume from this folder later.": "progressStopped",
    "Stop requested.": "progressStopRequested",
    "Resetting Teams session storage...": "progressResetting",
    "Teams session reset. Sign in again if prompted.": "progressReset",
    "Message export complete. Waiting for queued downloads...": "progressWaitingMessages",
    "Shared file export pass complete. Waiting for queued downloads...": "progressWaitingShared"
  };
  return exact[message] ? i18n.t(exact[message]) : message;
}

function reportPanelHeight() {
  if (!panel) return;
  const panelRect = panel.getBoundingClientRect();
  let bottom = panelRect.bottom;
  document.querySelectorAll(".menu[open] .menuPanel").forEach((menuPanel) => {
    bottom = Math.max(bottom, menuPanel.getBoundingClientRect().bottom);
  });
  const height = Math.ceil(bottom - panelRect.top + 8);
  if (!height || Math.abs(height - lastPanelHeight) < 1) return;
  lastPanelHeight = height;
  void window.teamsBackup.setPanelHeight(height);
}

function closeMenus() {
  document.querySelectorAll(".menu[open]").forEach((menu) => menu.removeAttribute("open"));
  requestAnimationFrame(reportPanelHeight);
}

function updateActionAvailability() {
  document.getElementById("teamsBtn").disabled = busy;
  document.getElementById("resetTeamsBtn").disabled = busy;
  document.getElementById("currentBtn").disabled = busy || !readiness.currentChatReady;
  document.getElementById("sharedCurrentBtn").disabled = busy || !readiness.currentChatReady;
  document.getElementById("allBtn").disabled = busy || !readiness.chatsReady;
  document.getElementById("sharedAllBtn").disabled = busy || !readiness.chatsReady;
  document.getElementById("resumeBtn").disabled = busy || !readiness.chatsReady;
  document.getElementById("stopBtn").disabled = !busy;

  for (const id of ["exportChatMenu", "exportFilesMenu"]) {
    const menu = document.getElementById(id);
    const unavailable = busy || !readiness.chatsReady;
    menu.classList.toggle("unavailable", unavailable);
    menu.querySelector("summary").setAttribute("aria-disabled", String(unavailable));
    if (unavailable) menu.removeAttribute("open");
  }
}

function setBusy(isBusy) {
  busy = isBusy;
  document.body.classList.toggle("is-busy", busy);
  updateActionAvailability();
  if (busy) closeMenus();
}

function renderReadiness(nextReadiness) {
  readiness = nextReadiness;
  const badge = document.getElementById("readinessBadge");
  const label = document.getElementById("readinessText");
  const key = readiness.currentChatReady
    ? "teamsReady"
    : readiness.signedIn && readiness.chatsReady
      ? "openChatToExport"
      : readiness.signedIn
        ? "openChatsToExport"
        : readiness.reason === "loading"
          ? "checkingTeams"
          : "signInRequired";
  label.textContent = i18n.t(key);
  badge.classList.toggle("ready", readiness.currentChatReady);
  badge.classList.toggle("partial", readiness.signedIn && !readiness.currentChatReady);
  badge.classList.toggle("waiting", !readiness.signedIn);
  updateActionAvailability();

  if (!lastProgressEvent) {
    delete statusText.dataset.i18n;
    statusText.textContent = i18n.t(
      readiness.currentChatReady ? "readyStatus" : readiness.signedIn ? "openChatStatus" : "initialStatus"
    );
  }
}

function renderProgress(event) {
  lastProgressEvent = event;
  const queueSummary = event.stats?.filesQueuedByKind
    ? i18n.t("queueBreakdown", {
      files: event.stats.filesQueuedByKind.file || 0,
      images: event.stats.filesQueuedByKind.image || 0,
      avatars: event.stats.filesQueuedByKind.avatar || 0,
      pdf: event.stats.filesQueuedByKind.pdf || 0,
      downloading: event.stats.filesDownloading || 0,
      manual: event.stats.filesManual || 0
    })
    : "";
  delete statusText.dataset.i18n;
  const message = translateProgressMessage(event.message);
  statusText.textContent = event.exportRoot ? `${message} (${event.exportRoot})` : message;
  if (queueSummary) statusText.title = queueSummary;
  if (event.stats) {
    chatCount.textContent = event.stats.chats;
    messageCount.textContent = event.stats.messages;
    queuedCount.textContent = event.stats.filesQueued;
    queuedCount.parentElement.title = queueSummary || i18n.t("filesWaiting");
    downloadedCount.textContent = event.stats.filesDownloaded;
    failedCount.textContent = event.stats.filesFailed;
  }
  setBusy(["starting", "exporting", "downloading"].includes(event.phase));
}

function renderQueueToggle(open) {
  queueOpen = open;
  document.body.classList.toggle("queue-open", queueOpen);
  queueToggleBtn.setAttribute("aria-expanded", String(queueOpen));
  queueToggleText.textContent = i18n.t(queueOpen ? "hideQueue" : "queueItems");
}

async function startAction(action) {
  setBusy(true);
  try {
    await action();
  } catch (error) {
    setBusy(false);
    delete statusText.dataset.i18n;
    statusText.textContent = error instanceof Error ? error.message : String(error);
  }
}

renderReadiness(readiness);

if (panel) {
  new ResizeObserver(reportPanelHeight).observe(panel);
  window.addEventListener("resize", reportPanelHeight);
  requestAnimationFrame(reportPanelHeight);
}

window.teamsBackup.onProgress(renderProgress);
window.teamsBackup.onTeamsReadinessChanged(renderReadiness);
window.teamsBackup.onQueueVisibility(renderQueueToggle);
window.teamsBackup.onDiagnosticsVisibility((open) => {
  diagnosticsOpen = open;
  if (diagnosticsOpen) diagnosticAlertCount = 0;
});
window.teamsBackup.onDiagnosticEvent((event) => {
  if (event.level !== "warning" && event.level !== "error") return;
  if (!diagnosticsOpen) diagnosticAlertCount = Math.min(99, diagnosticAlertCount + 1);
  queueToggleBtn.classList.toggle("hasAlert", diagnosticAlertCount > 0);
  queueToggleBtn.title = event.message;
});

queueToggleBtn.addEventListener("click", async () => {
  renderQueueToggle(!queueOpen);
  await window.teamsBackup.setQueuePanelOpen(queueOpen);
});

document.addEventListener("click", (event) => {
  const clickedMenu = event.target.closest?.(".menu");
  document.querySelectorAll(".menu[open]").forEach((menu) => {
    if (menu !== clickedMenu) menu.removeAttribute("open");
  });
  requestAnimationFrame(reportPanelHeight);
});

document.querySelectorAll(".menu").forEach((menu) => {
  menu.addEventListener("toggle", () => requestAnimationFrame(reportPanelHeight));
  menu.querySelector("summary").addEventListener("click", (event) => {
    if (menu.classList.contains("unavailable")) event.preventDefault();
  });
});
document.querySelectorAll(".menuPanel button").forEach((button) => button.addEventListener("click", closeMenus));

document.getElementById("teamsBtn").addEventListener("click", () => window.teamsBackup.navigateTeams());
document.getElementById("resetTeamsBtn").addEventListener("click", () => window.teamsBackup.resetTeamsSession());
document.getElementById("teamsDevtoolsBtn").addEventListener("click", () => window.teamsBackup.openTeamsDevTools());
document.getElementById("panelDevtoolsBtn").addEventListener("click", () => window.teamsBackup.openPanelDevTools());
document.getElementById("settingsBtn").addEventListener("click", () => window.teamsBackup.openSettings());

document.getElementById("currentBtn").addEventListener("click", () => startAction(async () => {
  const result = await window.teamsBackup.startExport({ mode: "current" });
  statusText.textContent = i18n.t("currentExportStarted", { folder: result.exportRoot });
}));
document.getElementById("allBtn").addEventListener("click", () => startAction(async () => {
  const result = await window.teamsBackup.startExport({ mode: "all" });
  statusText.textContent = i18n.t("allExportStarted", { folder: result.exportRoot });
}));
document.getElementById("sharedCurrentBtn").addEventListener("click", () => startAction(async () => {
  const result = await window.teamsBackup.startExport({ mode: "shared-current" });
  statusText.textContent = i18n.t("currentFilesStarted", { folder: result.exportRoot });
}));
document.getElementById("sharedAllBtn").addEventListener("click", () => startAction(async () => {
  const result = await window.teamsBackup.startExport({ mode: "shared-all" });
  statusText.textContent = i18n.t("allFilesStarted", { folder: result.exportRoot });
}));
document.getElementById("resumeBtn").addEventListener("click", () => startAction(async () => {
  const result = await window.teamsBackup.resumeFromFolder();
  if (result) statusText.textContent = i18n.t("resumingExport", { folder: result.exportRoot });
  else setBusy(false);
}));
document.getElementById("stopBtn").addEventListener("click", () => window.teamsBackup.stopExport());

window.teamsBackup.onPreferencesChanged((preferences) => {
  i18n.setPreferences(preferences);
  renderAppIdentity();
  renderQueueToggle(queueOpen);
  renderReadiness(readiness);
  if (lastProgressEvent) renderProgress(lastProgressEvent);
  refreshIcons();
  requestAnimationFrame(reportPanelHeight);
});

window.addEventListener("teams-backup-locale-changed", () => {
  renderAppIdentity();
  renderQueueToggle(queueOpen);
  renderReadiness(readiness);
  refreshIcons();
  requestAnimationFrame(reportPanelHeight);
});

Promise.all([
  window.teamsBackup.getAppInfo(),
  window.teamsBackup.getPreferences(),
  window.teamsBackup.getTeamsReadiness()
]).then(([info, preferences, currentReadiness]) => {
  appInfo = info;
  i18n.setPreferences(preferences);
  renderAppIdentity();
  renderQueueToggle(queueOpen);
  renderReadiness(currentReadiness);
  refreshIcons();
  requestAnimationFrame(reportPanelHeight);
});
