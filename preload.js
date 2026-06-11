const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mapEditorNative", {
  saveProject: (payload) => ipcRenderer.invoke("project:save", payload),
  openProject: () => ipcRenderer.invoke("project:open"),
  exportViewer: (payload) => ipcRenderer.invoke("viewer:export", payload),
  setDirty: (hasUnsavedChanges) => ipcRenderer.send("project:setDirty", hasUnsavedChanges),
});
