import { contextBridge, ipcRenderer } from "electron";
import { AppApi, DiagnosticEvent, ExportProgress, ExportStartOptions } from "../shared/types";

const api: AppApi = {
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  savePreferences: (preferences) => ipcRenderer.invoke("preferences:save", preferences),
  getTeamsReadiness: () => ipcRenderer.invoke("teams:getReadiness"),
  openSettings: () => ipcRenderer.invoke("settings:open"),
  startExport: (options: ExportStartOptions) => ipcRenderer.invoke("export:start", options),
  stopExport: () => ipcRenderer.invoke("export:stop"),
  chooseBaseFolder: () => ipcRenderer.invoke("export:chooseBaseFolder"),
  resumeFromFolder: (options) => ipcRenderer.invoke("export:resumeFromFolder", options),
  navigateTeams: () => ipcRenderer.invoke("teams:navigate"),
  resetTeamsSession: () => ipcRenderer.invoke("teams:resetSession"),
  openExportFolder: () => ipcRenderer.invoke("export:openFolder"),
  openExternalUrl: (url) => ipcRenderer.invoke("external:openUrl", url),
  copyText: (text) => ipcRenderer.invoke("clipboard:copyText", text),
  openTeamsDevTools: () => ipcRenderer.invoke("devtools:teams"),
  openPanelDevTools: () => ipcRenderer.invoke("devtools:panel"),
  setQueuePanelOpen: (open) => ipcRenderer.invoke("ui:setQueuePanelOpen", open),
  setDiagnosticsPanelOpen: (open) => ipcRenderer.invoke("ui:setDiagnosticsPanelOpen", open),
  setPanelHeight: (height) => ipcRenderer.invoke("ui:setPanelHeight", height),
  getQueueItems: () => ipcRenderer.invoke("export:getQueueItems"),
  getDiagnostics: () => ipcRenderer.invoke("diagnostics:get"),
  onQueueVisibility: (callback: (open: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, open: boolean) => callback(open);
    ipcRenderer.on("queue:visibility", listener);
    return () => ipcRenderer.removeListener("queue:visibility", listener);
  },
  onDiagnosticsVisibility: (callback: (open: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, open: boolean) => callback(open);
    ipcRenderer.on("diagnostics:visibility", listener);
    return () => ipcRenderer.removeListener("diagnostics:visibility", listener);
  },
  onDiagnosticEvent: (callback: (event: DiagnosticEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, diagnostic: DiagnosticEvent) => callback(diagnostic);
    ipcRenderer.on("diagnostics:event", listener);
    return () => ipcRenderer.removeListener("diagnostics:event", listener);
  },
  onProgress: (callback: (event: ExportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ExportProgress) => callback(progress);
    ipcRenderer.on("export:progress", listener);
    return () => ipcRenderer.removeListener("export:progress", listener);
  },
  onPreferencesChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, preferences: Parameters<typeof callback>[0]) => callback(preferences);
    ipcRenderer.on("preferences:changed", listener);
    return () => ipcRenderer.removeListener("preferences:changed", listener);
  },
  onTeamsReadinessChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, readiness: Parameters<typeof callback>[0]) => callback(readiness);
    ipcRenderer.on("teams:readiness", listener);
    return () => ipcRenderer.removeListener("teams:readiness", listener);
  }
};

contextBridge.exposeInMainWorld("teamsBackup", api);
