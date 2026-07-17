const i18n = window.TeamsBackupI18n;
const queueSummary = document.getElementById("queueSummary");
const queueList = document.getElementById("queueList");

let queueRefreshInFlight = false;
let queueRefreshQueued = false;
let latestSnapshot = null;
let appInfo = { name: "Teams Web Backup", version: "" };

function renderIdentity() {
  document.getElementById("versionLabel").textContent = `v${appInfo.version}`;
  document.title = `${i18n.t("appName")} - ${i18n.t("downloadQueue")} - v${appInfo.version}`;
}

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
  latestSnapshot = snapshot;
  queueList.replaceChildren();
  const hidden = Math.max(0, snapshot.total - snapshot.showing);
  const statusCounts = snapshot.items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
  queueSummary.textContent = snapshot.total === 0
    ? i18n.t("noQueuedItems")
    : i18n.t("queueSummary", {
      total: snapshot.total,
      showing: snapshot.showing,
      downloading: statusCounts.downloading || 0,
      queued: statusCounts.queued || 0,
      manual: statusCounts.manual || 0,
      hidden: hidden ? i18n.t("hiddenQueueItems", { count: hidden }) : ""
    });

  if (snapshot.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "queueEmpty";
    empty.textContent = i18n.t("nothingWaiting");
    queueList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of snapshot.items) {
    const row = document.createElement("div");
    row.className = `queueRow ${item.status}`;

    const status = document.createElement("div");
    status.className = "queueStatus";
    status.textContent = i18n.t(`status${item.status[0].toUpperCase()}${item.status.slice(1)}`);
    row.appendChild(status);

    appendText(row, "queueKind", i18n.t(`kind${item.kind[0].toUpperCase()}${item.kind.slice(1)}`));
    appendText(row, "queueName", item.name, item.contentUrl);
    appendText(row, "queueChat", item.chatTopic);
    appendText(row, "queueAttempts", String(item.attempts));
    appendText(row, "queuePath", item.localPath, `${item.localPath}\n${shortUrl(item.contentUrl)}`);
    appendText(row, "queueError", item.error || "", item.error);

    const actions = document.createElement("div");
    actions.className = "queueItemActions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = i18n.t("copyUrl");
    copyButton.addEventListener("click", () => {
      window.teamsBackup.copyText(item.contentUrl);
      copyButton.textContent = i18n.t("copied");
      setTimeout(() => {
        copyButton.textContent = i18n.t("copyUrl");
      }, 1200);
    });
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = i18n.t("open");
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

window.teamsBackup.onPreferencesChanged((preferences) => {
  i18n.setPreferences(preferences);
  renderIdentity();
  if (latestSnapshot) renderQueueItems(latestSnapshot);
});

window.addEventListener("teams-backup-locale-changed", () => {
  renderIdentity();
  if (latestSnapshot) renderQueueItems(latestSnapshot);
});

Promise.all([window.teamsBackup.getAppInfo(), window.teamsBackup.getPreferences()]).then(([info, preferences]) => {
  appInfo = info;
  i18n.setPreferences(preferences);
  renderIdentity();
});
