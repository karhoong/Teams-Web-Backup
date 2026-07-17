const i18n = window.TeamsBackupI18n;
const diagnosticsSummary = document.getElementById("diagnosticsSummary");
const diagnosticsState = document.getElementById("diagnosticsState");
const diagnosticsList = document.getElementById("diagnosticsList");
const refreshDiagnosticsBtn = document.getElementById("refreshDiagnosticsBtn");
const copyDiagnosticsBtn = document.getElementById("copyDiagnosticsBtn");
const clearDiagnosticsBtn = document.getElementById("clearDiagnosticsBtn");
const closeDiagnosticsBtn = document.getElementById("closeDiagnosticsBtn");

let snapshot = null;
let viewEvents = [];
let appInfo = { name: "Teams Web Backup", version: "" };

function renderIdentity() {
  document.getElementById("versionLabel").textContent = `v${appInfo.version}`;
  document.title = `${i18n.t("appName")} - ${i18n.t("diagnostics")} - v${appInfo.version}`;
}

function formatTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return value;
  }
}

function queueText(queue) {
  if (!queue) return i18n.t("queueUnavailable");
  return i18n.t("diagnosticsQueue", queue);
}

function renderState() {
  if (!snapshot) return;
  const lastProgress = snapshot.lastProgressAt ? `${formatTime(snapshot.lastProgressAt)} - ${snapshot.lastProgressMessage || ""}` : "-";
  diagnosticsSummary.textContent = `${i18n.t(snapshot.running ? "running" : "notRunning")} | ${snapshot.phase} | ${queueText(snapshot.queue)}`;
  diagnosticsState.innerHTML = "";
  const rows = [
    [i18n.t("phase"), snapshot.phase],
    [i18n.t("running"), i18n.t(snapshot.running ? "yes" : "no")],
    [i18n.t("stopRequested"), i18n.t(snapshot.stopRequested ? "yes" : "no")],
    [i18n.t("currentChat"), snapshot.currentChat || "-"],
    [i18n.t("lastProgress"), lastProgress],
    [i18n.t("teamsUrl"), snapshot.teamsUrl || "-"],
    [i18n.t("exportFolder"), snapshot.exportRoot || "-"],
    [i18n.t("queue"), queueText(snapshot.queue)]
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "diagnosticsStateRow";
    row.innerHTML = `<b></b><span></span>`;
    row.querySelector("b").textContent = label;
    row.querySelector("span").textContent = value;
    diagnosticsState.appendChild(row);
  }
}

function renderEvents() {
  diagnosticsList.innerHTML = "";
  if (viewEvents.length === 0) {
    const empty = document.createElement("div");
    empty.className = "diagnosticsEmpty";
    empty.textContent = i18n.t("noDiagnostics");
    diagnosticsList.appendChild(empty);
    return;
  }

  for (const event of viewEvents) {
    const row = document.createElement("article");
    row.className = `diagnosticEvent ${event.level}`;
    const meta = document.createElement("div");
    meta.className = "diagnosticMeta";
    meta.textContent = `${formatTime(event.at)} | ${event.level} | ${event.source}${event.currentChat ? ` | ${event.currentChat}` : ""}`;

    const message = document.createElement("div");
    message.className = "diagnosticMessage";
    message.textContent = event.message;

    row.appendChild(meta);
    row.appendChild(message);
    if (event.details) {
      const details = document.createElement("pre");
      details.className = "diagnosticDetails";
      details.textContent = event.details;
      row.appendChild(details);
    }
    diagnosticsList.appendChild(row);
  }
}

async function refreshDiagnostics() {
  snapshot = await window.teamsBackup.getDiagnostics();
  viewEvents = snapshot.events || [];
  renderState();
  renderEvents();
}

window.teamsBackup.onDiagnosticEvent((event) => {
  viewEvents.unshift(event);
  if (viewEvents.length > 500) viewEvents.pop();
  if (snapshot) {
    snapshot.events = viewEvents;
    renderState();
  }
  renderEvents();
});

refreshDiagnosticsBtn.addEventListener("click", refreshDiagnostics);

copyDiagnosticsBtn.addEventListener("click", async () => {
  const payload = {
    copiedAt: new Date().toISOString(),
    state: snapshot,
    visibleEvents: viewEvents
  };
  await window.teamsBackup.copyText(JSON.stringify(payload, null, 2));
  copyDiagnosticsBtn.textContent = i18n.t("copied");
  setTimeout(() => {
    copyDiagnosticsBtn.textContent = i18n.t("copy");
  }, 1200);
});

clearDiagnosticsBtn.addEventListener("click", () => {
  viewEvents = [];
  renderEvents();
});

closeDiagnosticsBtn.addEventListener("click", () => {
  window.teamsBackup.setDiagnosticsPanelOpen(false);
});

refreshDiagnostics();

window.teamsBackup.onPreferencesChanged((preferences) => {
  i18n.setPreferences(preferences);
  renderIdentity();
  renderState();
  renderEvents();
});

window.addEventListener("teams-backup-locale-changed", () => {
  renderIdentity();
  renderState();
  renderEvents();
});

Promise.all([window.teamsBackup.getAppInfo(), window.teamsBackup.getPreferences()]).then(([info, preferences]) => {
  appInfo = info;
  i18n.setPreferences(preferences);
  renderIdentity();
});
