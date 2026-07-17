const i18n = window.TeamsBackupI18n;
const settingsForm = document.getElementById("settingsForm");
const languageSelect = document.getElementById("languageSelect");
const concurrencyInput = document.getElementById("concurrencyInput");
const folderPath = document.getElementById("folderPath");
const saveStatus = document.getElementById("saveStatus");
let appInfo = { name: "Teams Web Backup", version: "" };
let currentPreferences = { theme: "system", language: "system", downloadConcurrency: 5, baseFolder: null };

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function renderVersion() {
  const version = i18n.t("version", { version: appInfo.version });
  document.getElementById("versionLabel").textContent = `v${appInfo.version}`;
  document.getElementById("settingsVersion").textContent = version;
  document.title = `${i18n.t("appName")} - ${i18n.t("settingsTitle")} - v${appInfo.version}`;
}

function renderPreferences(preferences) {
  currentPreferences = preferences;
  i18n.setPreferences(preferences);
  const theme = document.querySelector(`input[name="theme"][value="${preferences.theme}"]`);
  if (theme) theme.checked = true;
  languageSelect.value = preferences.language;
  concurrencyInput.value = String(preferences.downloadConcurrency || 5);
  folderPath.textContent = preferences.baseFolder || i18n.t("defaultDownloadsFolder");
  folderPath.title = preferences.baseFolder || i18n.t("defaultDownloadsFolder");
  renderVersion();
  refreshIcons();
}

async function savePreferences() {
  const theme = settingsForm.elements.theme.value || "system";
  const language = languageSelect.value || "system";
  const downloadConcurrency = Math.min(10, Math.max(1, Number.parseInt(concurrencyInput.value, 10) || 5));
  const saved = await window.teamsBackup.savePreferences({
    ...currentPreferences,
    theme,
    language,
    downloadConcurrency
  });
  renderPreferences(saved);
  saveStatus.textContent = i18n.t("saved");
  setTimeout(() => { saveStatus.textContent = ""; }, 1600);
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await savePreferences();
});
settingsForm.addEventListener("change", () => void savePreferences());

document.getElementById("folderBtn").addEventListener("click", async () => {
  const folder = await window.teamsBackup.chooseBaseFolder();
  if (folder) renderPreferences(await window.teamsBackup.getPreferences());
});
document.getElementById("openBtn").addEventListener("click", () => window.teamsBackup.openExportFolder());
document.getElementById("closeSettingsBtn").addEventListener("click", () => window.close());

window.teamsBackup.onPreferencesChanged(renderPreferences);
window.addEventListener("teams-backup-locale-changed", () => {
  renderVersion();
  folderPath.textContent = currentPreferences.baseFolder || i18n.t("defaultDownloadsFolder");
  refreshIcons();
});

Promise.all([window.teamsBackup.getAppInfo(), window.teamsBackup.getPreferences()]).then(([info, preferences]) => {
  appInfo = info;
  renderPreferences(preferences);
});
