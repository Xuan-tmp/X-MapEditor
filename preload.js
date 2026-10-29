const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("mapEditorNative", {
  getFilePath: (file) => webUtils.getPathForFile(file),
  createProject: (payload) => ipcRenderer.invoke("project:create", payload),
  saveProject: (payload) => ipcRenderer.invoke("project:save", payload),
  openProject: () => ipcRenderer.invoke("project:open"),
  importAsset: (payload) => ipcRenderer.invoke("asset:import", payload),
  exportSingleViewer: (payload) => ipcRenderer.invoke("viewer:exportSingle", payload),
  exportFolderViewer: (payload) => ipcRenderer.invoke("viewer:exportFolder", payload),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  chooseProjectsRoot: () => ipcRenderer.invoke("settings:chooseProjectsRoot"),
  openProjectsRoot: () => ipcRenderer.invoke("settings:openProjectsRoot"),
  setDirty: (hasUnsavedChanges) => ipcRenderer.send("project:setDirty", hasUnsavedChanges),
});
