const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const unsavedMessage = "还没有保存！确定要离开吗？";
let mainWindow = null;
let rendererHasUnsavedChanges = false;

function getWritableBaseDir() {
  return app.isPackaged ? path.dirname(process.execPath) : __dirname;
}

function getProjectsDir() {
  return path.join(getWritableBaseDir(), "projects");
}

function ensureProjectsDir() {
  fs.mkdirSync(getProjectsDir(), { recursive: true });
}

function sanitizeFileName(name) {
  return String(name || "地图项目")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "地图项目";
}

function uniqueProjectPath(baseName) {
  ensureProjectsDir();
  const safeBase = sanitizeFileName(baseName);
  let candidate = path.join(getProjectsDir(), `${safeBase}.json`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(getProjectsDir(), `${safeBase}_${index}.json`);
    index += 1;
  }
  return candidate;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");

  mainWindow.on("close", (event) => {
    if (!rendererHasUnsavedChanges) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      buttons: ["继续编辑", "离开"],
      defaultId: 0,
      cancelId: 0,
      message: unsavedMessage,
      detail: "未保存的修改不会写入项目文件。",
    });
    if (choice === 0) {
      event.preventDefault();
      return;
    }
    rendererHasUnsavedChanges = false;
  });
}

app.whenReady().then(() => {
  try {
    ensureProjectsDir();
    createWindow();
  } catch (error) {
    dialog.showErrorBox("启动失败", error.message);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("project:save", async (_event, payload) => {
  ensureProjectsDir();
  const { project, filePath, createNewFile } = payload || {};
  if (!project) throw new Error("缺少项目数据。");
  const targetPath = createNewFile || !filePath ? uniqueProjectPath(project.name) : filePath;
  fs.writeFileSync(targetPath, JSON.stringify(project, null, 2), "utf8");
  rendererHasUnsavedChanges = false;
  return {
    fileName: path.basename(targetPath),
    filePath: targetPath,
    projectsDir: getProjectsDir(),
  };
});

ipcMain.handle("project:open", async () => {
  ensureProjectsDir();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "打开地图项目",
    defaultPath: getProjectsDir(),
    properties: ["openFile"],
    filters: [{ name: "地图项目", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const project = JSON.parse(fs.readFileSync(filePath, "utf8"));
  rendererHasUnsavedChanges = false;
  return {
    project,
    fileName: path.basename(filePath),
    filePath,
    projectsDir: getProjectsDir(),
  };
});

ipcMain.handle("viewer:export", async (_event, payload) => {
  const { html, projectName } = payload || {};
  if (!html) throw new Error("缺少查看器内容。");
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "导出地图查看器",
    defaultPath: path.join(getWritableBaseDir(), `${sanitizeFileName(projectName || "地图")}-查看器.html`),
    filters: [{ name: "HTML 查看器", extensions: ["html"] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, html, "utf8");
  return {
    fileName: path.basename(result.filePath),
    filePath: result.filePath,
  };
});

ipcMain.on("project:setDirty", (_event, hasUnsavedChanges) => {
  rendererHasUnsavedChanges = Boolean(hasUnsavedChanges);
});
