const diagnosticsSummary = document.getElementById("diagnosticsSummary");
const diagnosticsState = document.getElementById("diagnosticsState");
const diagnosticsList = document.getElementById("diagnosticsList");
const refreshDiagnosticsBtn = document.getElementById("refreshDiagnosticsBtn");
const copyDiagnosticsBtn = document.getElementById("copyDiagnosticsBtn");
const clearDiagnosticsBtn = document.getElementById("clearDiagnosticsBtn");
const closeDiagnosticsBtn = document.getElementById("closeDiagnosticsBtn");

let snapshot = null;
let viewEvents = [];

function formatTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return value;
  }
}

function queueText(queue) {
  if (!queue) return "queue unavailable";
  return `${queue.queued} queued, ${queue.downloading} downloading, ${queue.active} active, ${queue.browserPending} browser pending, ${queue.manual} manual, ${queue.failed} failed`;
}

function renderState() {
  if (!snapshot) return;
  const lastProgress = snapshot.lastProgressAt ? `${formatTime(snapshot.lastProgressAt)} - ${snapshot.lastProgressMessage || ""}` : "-";
  diagnosticsSummary.textContent = `${snapshot.running ? "Running" : "Not running"} | ${snapshot.phase} | ${queueText(snapshot.queue)}`;
  diagnosticsState.innerHTML = "";
  const rows = [
    ["Phase", snapshot.phase],
    ["Running", snapshot.running ? "yes" : "no"],
    ["Stop requested", snapshot.stopRequested ? "yes" : "no"],
    ["Current chat", snapshot.currentChat || "-"],
    ["Last progress", lastProgress],
    ["Teams URL", snapshot.teamsUrl || "-"],
    ["Export folder", snapshot.exportRoot || "-"],
    ["Queue", queueText(snapshot.queue)]
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
    empty.textContent = "No diagnostics yet.";
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
  copyDiagnosticsBtn.textContent = "Copied";
  setTimeout(() => {
    copyDiagnosticsBtn.textContent = "Copy";
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
