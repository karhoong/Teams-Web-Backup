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
  const queueSummary = event.stats?.filesQueuedByKind
    ? `queued: ${event.stats.filesQueuedByKind.file || 0} files, ${event.stats.filesQueuedByKind.image || 0} images, ${event.stats.filesQueuedByKind.avatar || 0} avatars, ${event.stats.filesQueuedByKind.pdf || 0} pdf, ${event.stats.filesDownloading || 0} downloading, ${event.stats.filesManual || 0} manual`
    : "";
  statusText.textContent = event.exportRoot
    ? `${event.message} (${event.exportRoot})`
    : event.message;
  if (queueSummary) statusText.title = queueSummary;
  if (event.stats) {
    chatCount.textContent = event.stats.chats;
    messageCount.textContent = event.stats.messages;
    queuedCount.textContent = event.stats.filesQueued;
    queuedCount.parentElement.title = queueSummary || "Files waiting to download";
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
  queueToggleBtn.textContent = queueOpen ? "Hide Queue" : "Queue Items";
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

document.getElementById("folderBtn").addEventListener("click", async () => {
  const folder = await window.teamsBackup.chooseBaseFolder();
  if (folder) statusText.textContent = `Export parent folder: ${folder}`;
});

document.getElementById("currentBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "current", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = `Current chat export started: ${result.exportRoot}`;
});

document.getElementById("allBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "all", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = `All chats export started: ${result.exportRoot}`;
});

document.getElementById("sharedCurrentBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "shared-current", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = `Current chat Shared files export started: ${result.exportRoot}`;
});

document.getElementById("sharedAllBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.startExport({ mode: "shared-all", downloadConcurrency: downloadConcurrency() });
  statusText.textContent = `All chats Shared files export started: ${result.exportRoot}`;
});

document.getElementById("resumeBtn").addEventListener("click", async () => {
  setBusy(true);
  const result = await window.teamsBackup.resumeFromFolder({ downloadConcurrency: downloadConcurrency() });
  if (result) statusText.textContent = `Resuming export: ${result.exportRoot}`;
  else setBusy(false);
});

document.getElementById("stopBtn").addEventListener("click", () => {
  window.teamsBackup.stopExport();
});

document.getElementById("openBtn").addEventListener("click", () => {
  window.teamsBackup.openExportFolder();
});
