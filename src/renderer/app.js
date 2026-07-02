const statusText = document.getElementById("statusText");
const chatCount = document.getElementById("chatCount");
const messageCount = document.getElementById("messageCount");
const queuedCount = document.getElementById("queuedCount");
const downloadedCount = document.getElementById("downloadedCount");
const failedCount = document.getElementById("failedCount");
const concurrencyInput = document.getElementById("concurrencyInput");
const queueToggleBtn = document.getElementById("queueToggleBtn");
const diagnosticsBtn = document.getElementById("diagnosticsBtn");

let queueOpen = false;
let diagnosticsOpen = false;
let diagnosticAlertCount = 0;

function downloadConcurrency() {
  const parsed = Number.parseInt(concurrencyInput.value, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(10, Math.max(1, parsed));
}

function setBusy(isBusy) {
  document.getElementById("currentBtn").disabled = isBusy;
  document.getElementById("allBtn").disabled = isBusy;
  document.getElementById("sharedCurrentBtn").disabled = isBusy;
  document.getElementById("sharedAllBtn").disabled = isBusy;
  document.getElementById("resumeBtn").disabled = isBusy;
  concurrencyInput.disabled = isBusy;
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
  diagnosticsBtn.classList.toggle("active", diagnosticsOpen);
  if (diagnosticsOpen) diagnosticAlertCount = 0;
  diagnosticsBtn.classList.toggle("hasAlert", diagnosticAlertCount > 0);
  diagnosticsBtn.textContent = diagnosticsOpen
    ? "Hide Diagnostics"
    : diagnosticAlertCount > 0 ? `Diagnostics (${diagnosticAlertCount})` : "Diagnostics";
}

window.teamsBackup.onDiagnosticsVisibility(renderDiagnosticsToggle);
window.teamsBackup.onDiagnosticEvent((event) => {
  if (event.level !== "warning" && event.level !== "error") return;
  if (!diagnosticsOpen) diagnosticAlertCount = Math.min(99, diagnosticAlertCount + 1);
  diagnosticsBtn.classList.toggle("hasAlert", diagnosticAlertCount > 0);
  diagnosticsBtn.textContent = diagnosticsOpen
    ? "Hide Diagnostics"
    : diagnosticAlertCount > 0 ? `Diagnostics (${diagnosticAlertCount})` : "Diagnostics";
  diagnosticsBtn.title = event.message;
});

queueToggleBtn.addEventListener("click", async () => {
  renderQueueToggle(!queueOpen);
  await window.teamsBackup.setQueuePanelOpen(queueOpen);
});

diagnosticsBtn.addEventListener("click", async () => {
  renderDiagnosticsToggle(!diagnosticsOpen);
  await window.teamsBackup.setDiagnosticsPanelOpen(diagnosticsOpen);
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
