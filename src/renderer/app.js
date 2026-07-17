const i18n = window.TeamsBackupI18n;
const statusText = document.getElementById("statusText");
const chatCount = document.getElementById("chatCount");
const messageCount = document.getElementById("messageCount");
const queuedCount = document.getElementById("queuedCount");
const downloadedCount = document.getElementById("downloadedCount");
const failedCount = document.getElementById("failedCount");
const concurrencyInput = document.getElementById("concurrencyInput");
const queueToggleBtn = document.getElementById("queueToggleBtn");
const panel = document.querySelector(".panel");

let queueOpen = false;
let diagnosticsOpen = false;
let diagnosticAlertCount = 0;
let busy = false;
let lastPanelHeight = 0;
let lastProgressEvent = null;
let appInfo = { name: "Teams Web Backup", version: "" };

function renderAppIdentity() {
  document.getElementById("versionLabel").textContent = `v${appInfo.version}`;
  document.title = `${i18n.t("appName")} v${appInfo.version}`;
}

function translateProgressMessage(message) {
  const exact = {
    "Starting Teams Web export...": "progressStarting",
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

if (panel) {
  new ResizeObserver(reportPanelHeight).observe(panel);
  window.addEventListener("resize", reportPanelHeight);
  requestAnimationFrame(reportPanelHeight);
}

function closeMenus() {
  document.querySelectorAll(".menu[open]").forEach((menu) => {
    menu.removeAttribute("open");
  });
  requestAnimationFrame(reportPanelHeight);
}

function downloadConcurrency() {
  const parsed = Number.parseInt(concurrencyInput.value, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(10, Math.max(1, parsed));
}

function setBusy(isBusy) {
  busy = isBusy;
  document.body.classList.toggle("is-busy", busy);
  document.querySelectorAll("[data-busy-disabled]").forEach((control) => {
    control.disabled = busy;
  });
  document.getElementById("stopBtn").disabled = !busy;
  concurrencyInput.disabled = isBusy;
  if (busy) closeMenus();
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
  statusText.textContent = event.exportRoot
    ? `${message} (${event.exportRoot})`
    : message;
  if (queueSummary) statusText.title = queueSummary;
  if (event.stats) {
    chatCount.textContent = event.stats.chats;
    messageCount.textContent = event.stats.messages;
    queuedCount.textContent = event.stats.filesQueued;
    queuedCount.parentElement.title = queueSummary || i18n.t("filesWaiting");
    downloadedCount.textContent = event.stats.filesDownloaded;
    failedCount.textContent = event.stats.filesFailed;
  }
  setBusy(event.phase === "starting" || event.phase === "exporting" || event.phase === "downloading");
}

window.teamsBackup.onProgress(renderProgress);

function renderQueueToggle(open) {
  queueOpen = open;
  document.body.classList.toggle("queue-open", queueOpen);
  queueToggleBtn.setAttribute("aria-expanded", String(queueOpen));
  queueToggleBtn.textContent = i18n.t(queueOpen ? "hideQueue" : "queueItems");
}

window.teamsBackup.onQueueVisibility(renderQueueToggle);

function renderDiagnosticsToggle(open) {
  diagnosticsOpen = open;
  if (diagnosticsOpen) diagnosticAlertCount = 0;
}

window.teamsBackup.onDiagnosticsVisibility(renderDiagnosticsToggle);
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

document.querySelectorAll(".menuPanel button").forEach((button) => {
  button.addEventListener("click", closeMenus);
});

document.querySelectorAll(".menu").forEach((menu) => {
  menu.addEventListener("toggle", () => {
    requestAnimationFrame(reportPanelHeight);
  });
});

document.getElementById("teamsBtn").addEventListener("click", () => {
  window.teamsBackup.navigateTeams();
});

document.getElementById("resetTeamsBtn").addEventListener("click", () => {
  window.teamsBackup.resetTeamsSession();
});

document.getElementById("teamsDevtoolsBtn").addEventListener("click", () => {
  window.teamsBackup.openTeamsDevTools();
});

document.getElementById("panelDevtoolsBtn").addEventListener("click", () => {
  window.teamsBackup.openPanelDevTools();
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  window.teamsBackup.openSettings();
});

document.getElementById("folderBtn").addEventListener("click", async () => {
  const folder = await window.teamsBackup.chooseBaseFolder();
  if (folder) {
    delete statusText.dataset.i18n;
    statusText.textContent = i18n.t("exportParentFolder", { folder });
  }
});

document.getElementById("currentBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "current", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = i18n.t("currentExportStarted", { folder: result.exportRoot });
});

document.getElementById("allBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "all", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = i18n.t("allExportStarted", { folder: result.exportRoot });
});

document.getElementById("sharedCurrentBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "shared-current", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = i18n.t("currentFilesStarted", { folder: result.exportRoot });
});

document.getElementById("sharedAllBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "shared-all", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = i18n.t("allFilesStarted", { folder: result.exportRoot });
});

document.getElementById("resumeBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.resumeFromFolder({ downloadConcurrency: downloadConcurrency() });
  if (result) statusText.textContent = i18n.t("resumingExport", { folder: result.exportRoot });
  else setBusy(false);
});

document.getElementById("stopBtn").addEventListener("click", () => {
  window.teamsBackup.stopExport();
});

document.getElementById("openBtn").addEventListener("click", () => {
  window.teamsBackup.openExportFolder();
});

window.teamsBackup.onPreferencesChanged((preferences) => {
  i18n.setPreferences(preferences);
  renderAppIdentity();
  renderQueueToggle(queueOpen);
  if (lastProgressEvent) renderProgress(lastProgressEvent);
  requestAnimationFrame(reportPanelHeight);
});

window.addEventListener("teams-backup-locale-changed", () => {
  renderAppIdentity();
  requestAnimationFrame(reportPanelHeight);
});

Promise.all([window.teamsBackup.getAppInfo(), window.teamsBackup.getPreferences()]).then(([info, preferences]) => {
  appInfo = info;
  i18n.setPreferences(preferences);
  renderAppIdentity();
  renderQueueToggle(queueOpen);
  requestAnimationFrame(reportPanelHeight);
});
