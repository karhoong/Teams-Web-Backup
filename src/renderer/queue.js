const queueSummary = document.getElementById("queueSummary");
const queueList = document.getElementById("queueList");

let queueRefreshInFlight = false;
let queueRefreshQueued = false;

function shortUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return value;
  }
}

function appendText(parent, className, value, title) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = value || "";
  if (title || value) element.title = title || value;
  parent.appendChild(element);
}

function renderQueueItems(snapshot) {
  queueList.replaceChildren();
  const hidden = Math.max(0, snapshot.total - snapshot.showing);
  const statusCounts = snapshot.items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
  const visibleSummary = `${statusCounts.downloading || 0} downloading, ${statusCounts.queued || 0} queued, ${statusCounts.manual || 0} manual`;
  queueSummary.textContent = snapshot.total === 0
    ? "No queued items."
    : `${snapshot.total} items, showing ${snapshot.showing}: ${visibleSummary}${hidden ? `, ${hidden} more in checkpoint/files.jsonl` : ""}.`;

  if (snapshot.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "queueEmpty";
    empty.textContent = "Nothing is waiting to download.";
    queueList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of snapshot.items) {
    const row = document.createElement("div");
    row.className = `queueRow ${item.status}`;

    const status = document.createElement("div");
    status.className = "queueStatus";
    status.textContent = item.status;
    row.appendChild(status);

    appendText(row, "queueKind", item.kind);
    appendText(row, "queueName", item.name, item.contentUrl);
    appendText(row, "queueChat", item.chatTopic);
    appendText(row, "queueAttempts", String(item.attempts));
    appendText(row, "queuePath", item.localPath, `${item.localPath}\n${shortUrl(item.contentUrl)}`);
    appendText(row, "queueError", item.error || "", item.error);

    const actions = document.createElement("div");
    actions.className = "queueItemActions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy URL";
    copyButton.addEventListener("click", () => {
      window.teamsBackup.copyText(item.contentUrl);
      copyButton.textContent = "Copied";
      setTimeout(() => {
        copyButton.textContent = "Copy URL";
      }, 1200);
    });
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => {
      window.teamsBackup.openExternalUrl(item.contentUrl);
    });
    actions.append(copyButton, openButton);
    row.appendChild(actions);

    fragment.appendChild(row);
  }
  queueList.appendChild(fragment);
}

async function refreshQueueItemsSoon() {
  if (queueRefreshInFlight) {
    queueRefreshQueued = true;
    return;
  }
  queueRefreshInFlight = true;
  try {
    renderQueueItems(await window.teamsBackup.getQueueItems());
  } finally {
    queueRefreshInFlight = false;
    if (queueRefreshQueued) {
      queueRefreshQueued = false;
      setTimeout(refreshQueueItemsSoon, 250);
    }
  }
}

window.teamsBackup.onProgress(refreshQueueItemsSoon);
document.getElementById("refreshQueueBtn").addEventListener("click", refreshQueueItemsSoon);
document.getElementById("closeQueueBtn").addEventListener("click", () => {
  window.teamsBackup.setQueuePanelOpen(false);
});

refreshQueueItemsSoon();
