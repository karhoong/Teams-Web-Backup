const i18n = window.TeamsBackupI18n;
const settingsForm = document.getElementById("settingsForm");
const languageSelect = document.getElementById("languageSelect");
const saveStatus = document.getElementById("saveStatus");
let appInfo = { name: "Teams Web Backup", version: "" };

function renderVersion() {
  const version = i18n.t("version", { version: appInfo.version });
  document.getElementById("versionLabel").textContent = `v${appInfo.version}`;
  document.getElementById("settingsVersion").textContent = version;
  document.title = `${i18n.t("appName")} - ${i18n.t("settingsTitle")} - v${appInfo.version}`;
}

function renderPreferences(preferences) {
  i18n.setPreferences(preferences);
  const theme = document.querySelector(`input[name="theme"][value="${preferences.theme}"]`);
  if (theme) theme.checked = true;
  languageSelect.value = preferences.language;
  renderVersion();
}

async function savePreferences() {
  const theme = settingsForm.elements.theme.value || "system";
  const language = languageSelect.value || "system";
  const saved = await window.teamsBackup.savePreferences({ theme, language });
  renderPreferences(saved);
  saveStatus.textContent = i18n.t("saved");
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 1600);
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await savePreferences();
});

settingsForm.addEventListener("change", () => {
  void savePreferences();
});

document.getElementById("closeSettingsBtn").addEventListener("click", () => window.close());
window.teamsBackup.onPreferencesChanged(renderPreferences);
window.addEventListener("teams-backup-locale-changed", renderVersion);

Promise.all([window.teamsBackup.getAppInfo(), window.teamsBackup.getPreferences()]).then(([info, preferences]) => {
  appInfo = info;
  renderPreferences(preferences);
});
