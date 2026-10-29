const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const unsavedMessage = "还没有保存！确定要离开吗？";
const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
let mainWindow = null;
let rendererHasUnsavedChanges = false;
let settings = null;

app.setName("地图编辑器");

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getProjectsDir() {
  if (!settings?.projectsRoot) throw new Error("尚未设置项目存储位置。");
  return settings.projectsRoot;
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function loadSettings() {
  const settingsPath = getSettingsPath();
  try {
    const loaded = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    settings = { version: 1, ...loaded };
  } catch (_error) {
    settings = { version: 1, projectsRoot: null };
  }
  return settings;
}

function saveSettings() {
  ensureDirectory(path.dirname(getSettingsPath()));
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function verifyWritableDirectory(directory) {
  ensureDirectory(directory);
  const testPath = path.join(directory, `.map-editor-write-test-${process.pid}-${Date.now()}`);
  fs.writeFileSync(testPath, "ok", "utf8");
  fs.unlinkSync(testPath);
}

function showOpenDialog(parentWindow, options) {
  return parentWindow ? dialog.showOpenDialog(parentWindow, options) : dialog.showOpenDialog(options);
}

function showMessageBox(parentWindow, options) {
  return parentWindow ? dialog.showMessageBox(parentWindow, options) : dialog.showMessageBox(options);
}

function hasProjects(directory) {
  if (!directory || !fs.existsSync(directory)) return false;
  return fs.readdirSync(directory, { withFileTypes: true }).some((entry) =>
    entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, "project.json"))
  );
}

function uniqueDestinationPath(parent, name) {
  const safeName = sanitizeFileName(name);
  let candidate = path.join(parent, safeName);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${safeName}_${index}`);
    index += 1;
  }
  return candidate;
}

function copyProjectFolders(sourceRoot, destinationRoot) {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) return 0;
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  if (source === destination || destination.startsWith(`${source}${path.sep}`) || source.startsWith(`${destination}${path.sep}`)) {
    throw new Error("迁移时，新旧项目目录不能互相包含。");
  }
  let copied = 0;
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) return;
    const sourceProject = path.join(source, entry.name);
    if (!fs.existsSync(path.join(sourceProject, "project.json"))) return;
    const destinationProject = uniqueDestinationPath(destination, entry.name);
    fs.cpSync(sourceProject, destinationProject, { recursive: true, errorOnExist: true });
    copied += 1;
  });
  return copied;
}

function getLegacyProjectsDir() {
  const baseDir = app.isPackaged ? path.dirname(process.execPath) : __dirname;
  return path.join(baseDir, "projects");
}

async function chooseProjectsRoot(parentWindow, options = {}) {
  const result = await showOpenDialog(parentWindow, {
    title: "选择项目存储位置",
    defaultPath: settings?.projectsRoot || app.getPath("documents"),
    buttonLabel: "使用此文件夹",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const selectedRoot = path.resolve(result.filePaths[0]);
  try {
    verifyWritableDirectory(selectedRoot);
  } catch (error) {
    await showMessageBox(parentWindow, {
      type: "error",
      message: "无法使用这个文件夹",
      detail: `应用无法在所选位置写入文件。\n\n${error.message}`,
      buttons: ["重新选择"],
    });
    return chooseProjectsRoot(parentWindow, options);
  }

  const previousRoot = settings?.projectsRoot ? path.resolve(settings.projectsRoot) : null;
  const migrationSource = previousRoot || (options.firstRun ? getLegacyProjectsDir() : null);
  let copyExisting = false;
  if (migrationSource && migrationSource !== selectedRoot && hasProjects(migrationSource)) {
    const choice = await showMessageBox(parentWindow, {
      type: "question",
      message: options.firstRun ? "发现已有项目" : "是否复制已有项目？",
      detail: `原位置：${migrationSource}\n新位置：${selectedRoot}\n\n复制会保留原文件，不会删除或覆盖已有项目。`,
      buttons: ["复制已有项目", "仅更改位置", "取消"],
      defaultId: 0,
      cancelId: 2,
    });
    if (choice.response === 2) return null;
    copyExisting = choice.response === 0;
  }

  if (copyExisting) {
    try {
      copyProjectFolders(migrationSource, selectedRoot);
    } catch (error) {
      await showMessageBox(parentWindow, {
        type: "error",
        message: "复制项目失败",
        detail: `项目存储位置尚未更改，原项目仍然保留。\n\n${error.message}`,
        buttons: ["确定"],
      });
      return null;
    }
  }

  settings = { ...(settings || {}), version: 1, projectsRoot: selectedRoot };
  saveSettings();
  return { projectsRoot: selectedRoot, copiedExistingProjects: copyExisting };
}

async function ensureProjectsRoot() {
  loadSettings();
  if (settings.projectsRoot) {
    try {
      verifyWritableDirectory(settings.projectsRoot);
      return true;
    } catch (_error) {
      settings.projectsRoot = null;
    }
  }

  while (!settings.projectsRoot) {
    const choice = await dialog.showMessageBox({
      type: "info",
      message: "请选择项目存储位置",
      detail: "地图、图标和项目文件将保存在你选择的文件夹中。这个位置独立于安装目录，清理临时文件、升级或卸载应用都不会删除项目。",
      buttons: ["选择文件夹", "退出"],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice.response === 1) return false;
    const selected = await chooseProjectsRoot(null, { firstRun: true });
    if (selected) return true;
  }
  return true;
}

function sanitizeFileName(name, fallback = "地图项目") {
  return String(name || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80) || fallback;
}

function uniqueDirectory(parent, baseName) {
  ensureDirectory(parent);
  const safeBase = sanitizeFileName(baseName);
  let candidate = path.join(parent, safeBase);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${safeBase}_${index}`);
    index += 1;
  }
  fs.mkdirSync(candidate);
  return candidate;
}

function uniqueFilePath(directory, fileName) {
  ensureDirectory(directory);
  const extension = path.extname(fileName).toLowerCase();
  const base = sanitizeFileName(path.basename(fileName, extension), "资源");
  let candidate = path.join(directory, `${base}${extension}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${base}_${index}${extension}`);
    index += 1;
  }
  return candidate;
}

function normalizeRelative(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function resolveProjectAsset(projectFilePath, relativePath) {
  if (!projectFilePath) throw new Error("项目尚未保存到文件夹。");
  const projectDir = path.dirname(path.resolve(projectFilePath));
  const target = path.resolve(projectDir, normalizeRelative(relativePath));
  const relative = path.relative(projectDir, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("资源路径不在当前项目目录内。");
  }
  return target;
}

function mimeForExtension(extension) {
  return ({
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif",
  })[extension.toLowerCase()] || "application/octet-stream";
}

function dataUrlFromFile(filePath) {
  const mime = mimeForExtension(path.extname(filePath));
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || "");
  if (!match) throw new Error("无法解析旧项目中的图片数据。");
  const mime = match[1] || "image/png";
  const buffer = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
  const extension = ({
    "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": ".svg",
  })[mime] || ".png";
  return { buffer, extension };
}

function copyAsset(sourcePath, destinationDirectory) {
  if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error("找不到所选图片。");
  const extension = path.extname(sourcePath).toLowerCase();
  if (!allowedImageExtensions.has(extension)) throw new Error("不支持这种图片格式。");
  const content = fs.readFileSync(sourcePath);
  const digest = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
  ensureDirectory(destinationDirectory);
  const existing = fs.readdirSync(destinationDirectory).find((name) => name.includes(`-${digest}`));
  if (existing) return path.join(destinationDirectory, existing);
  const base = sanitizeFileName(path.basename(sourcePath, extension), "资源");
  const target = uniqueFilePath(destinationDirectory, `${base}-${digest}${extension}`);
  fs.copyFileSync(sourcePath, target);
  return target;
}

function collectAssetPaths(project) {
  const values = new Set();
  Object.values(project.maps || {}).forEach((map) => {
    if (map.image && !String(map.image).startsWith("data:")) values.add(normalizeRelative(map.image));
  });
  Object.values(project.icons || {}).forEach((icon) => {
    if (icon.type === "image" && icon.src && !String(icon.src).startsWith("data:")) values.add(normalizeRelative(icon.src));
  });
  return [...values];
}

function buildAssetUrls(project, projectFilePath) {
  const urls = {};
  collectAssetPaths(project).forEach((relativePath) => {
    const target = resolveProjectAsset(projectFilePath, relativePath);
    if (fs.existsSync(target)) urls[relativePath] = pathToFileURL(target).href;
  });
  return urls;
}

function writeProject(projectFilePath, project) {
  fs.writeFileSync(projectFilePath, JSON.stringify(project, null, 2), "utf8");
}

function presetIcons() {
  return {
    "preset-black-dot": { type: "preset", preset: "black-dot", name: "黑色圆点" },
    "preset-white-dot": { type: "preset", preset: "white-dot", name: "白色圆点" },
    "preset-ring": { type: "preset", preset: "ring", name: "空心圆" },
    "preset-square": { type: "preset", preset: "square", name: "方形" },
    "preset-diamond": { type: "preset", preset: "diamond", name: "菱形" },
    "preset-triangle": { type: "preset", preset: "triangle", name: "三角形" },
    "preset-star": { type: "preset", preset: "star", name: "星形" },
    "preset-flag": { type: "preset", preset: "flag", name: "旗帜" },
    "preset-arrow": { type: "preset", preset: "arrow", name: "箭头" },
    "preset-info": { type: "preset", preset: "info", name: "信息" },
    "preset-question": { type: "preset", preset: "question", name: "问号" },
    "preset-warning": { type: "preset", preset: "warning", name: "警告" },
    "preset-entrance": { type: "preset", preset: "entrance", name: "入口" },
  };
}

function defaultTextStyle() {
  return {
    preset: "card", showText: true, fontSize: 14, color: "#17202a", showTextShadow: false,
    showBackground: true, backgroundColor: "#ffffff", backgroundOpacity: 90,
    showBorder: true, borderColor: "#0f766e", showShadow: true,
    showHoverOutline: true, hoverOutlineColor: "#0f766e", hoverOutlineOpacity: 35,
    hoverOutlineWidth: 1, hoverOutlineStyle: "solid", hoverOutlineOffset: 2,
  };
}

function migrateLegacyProject(legacy, sourceFilePath) {
  const projectDir = uniqueDirectory(getProjectsDir(), `${legacy.name || "地图项目"}_已迁移`);
  const mapsDir = path.join(projectDir, "assets", "maps");
  ensureDirectory(mapsDir);
  ensureDirectory(path.join(projectDir, "assets", "icons"));
  const project = JSON.parse(JSON.stringify(legacy));
  project.version = 2;
  project.icons = presetIcons();
  const legacyIconIds = new Map();
  const migratedImages = new Map();
  Object.values(project.maps || {}).forEach((map, mapIndex) => {
    if (String(map.image || "").startsWith("data:")) {
      const parsed = parseDataUrl(map.image);
      const digest = crypto.createHash("sha256").update(parsed.buffer).digest("hex");
      let target = migratedImages.get(digest);
      if (!target) {
        target = uniqueFilePath(mapsDir, `${sanitizeFileName(map.name || `地图_${mapIndex + 1}`)}${parsed.extension}`);
        fs.writeFileSync(target, parsed.buffer);
        migratedImages.set(digest, target);
      }
      map.image = normalizeRelative(path.relative(projectDir, target));
    }
    map.elements = map.elements || [];
    map.elements.forEach((element) => {
      element.x = Number(((Number(element.x) || 0) * (map.width || 16) / 100).toFixed(3));
      element.y = Number(((Number(element.y) || 0) * (map.height || 9) / 100).toFixed(3));
      element.iconSize = 22;
      element.textStyle = { ...defaultTextStyle(), ...(element.textStyle || {}) };
      const legacyIcon = String(element.icon || (element.kind === "submap" ? "↳" : "i"));
      let iconId = legacyIcon === "i" ? "preset-info" : legacyIcon === "↳" ? "preset-entrance" : null;
      if (!iconId) {
        if (!legacyIconIds.has(legacyIcon)) {
          iconId = `legacy-${crypto.createHash("sha1").update(legacyIcon).digest("hex").slice(0, 10)}`;
          legacyIconIds.set(legacyIcon, iconId);
          project.icons[iconId] = { type: "text", text: legacyIcon, name: `旧图标 ${legacyIcon}` };
        }
        iconId = legacyIconIds.get(legacyIcon);
      }
      element.iconId = iconId;
      delete element.icon;
    });
  });
  project.migratedFrom = path.basename(sourceFilePath);
  project.updatedAt = new Date().toISOString();
  const projectFilePath = path.join(projectDir, "project.json");
  writeProject(projectFilePath, project);
  return { project, projectFilePath };
}

function cloneWithEmbeddedAssets(project, projectFilePath) {
  const cloned = JSON.parse(JSON.stringify(project));
  Object.values(cloned.maps || {}).forEach((map) => {
    if (map.image && !String(map.image).startsWith("data:")) map.image = dataUrlFromFile(resolveProjectAsset(projectFilePath, map.image));
  });
  Object.values(cloned.icons || {}).forEach((icon) => {
    if (icon.type === "image" && icon.src && !String(icon.src).startsWith("data:")) icon.src = dataUrlFromFile(resolveProjectAsset(projectFilePath, icon.src));
  });
  return cloned;
}

function fillViewerTemplate(template, project) {
  const serialized = JSON.stringify(project).replace(/</g, "\\u003c");
  return template.replace("__PROJECT_DATA__", () => serialized);
}

function copyViewerAssets(project, projectFilePath, exportDir) {
  collectAssetPaths(project).forEach((relativePath) => {
    const source = resolveProjectAsset(projectFilePath, relativePath);
    const destination = path.resolve(exportDir, relativePath);
    const relative = path.relative(exportDir, destination);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("导出资源路径无效。");
    ensureDirectory(path.dirname(destination));
    fs.copyFileSync(source, destination);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1040, minHeight: 680,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadFile("index.html");
  mainWindow.on("close", (event) => {
    if (!rendererHasUnsavedChanges) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning", buttons: ["继续编辑", "离开"], defaultId: 0, cancelId: 0,
      message: unsavedMessage, detail: "未保存的修改不会写入项目文件。",
    });
    if (choice === 0) event.preventDefault();
    else rendererHasUnsavedChanges = false;
  });
}

app.whenReady().then(() => {
  ensureProjectsRoot()
    .then((ready) => {
      if (!ready) {
        app.quit();
        return;
      }
      ensureDirectory(getProjectsDir());
      createWindow();
    })
    .catch((error) => {
      dialog.showErrorBox("启动失败", error.message);
      app.quit();
    });
  app.on("activate", () => {
    if (settings?.projectsRoot && BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("project:create", async (_event, payload) => {
  const { name, sourcePath } = payload || {};
  const projectDir = uniqueDirectory(getProjectsDir(), name || path.basename(sourcePath || "", path.extname(sourcePath || "")));
  const mapsDir = path.join(projectDir, "assets", "maps");
  ensureDirectory(path.join(projectDir, "assets", "icons"));
  const target = copyAsset(sourcePath, mapsDir);
  const projectFilePath = path.join(projectDir, "project.json");
  return {
    projectFilePath, projectFileName: "project.json", projectDir, projectsDir: getProjectsDir(),
    asset: { relativePath: normalizeRelative(path.relative(projectDir, target)), url: pathToFileURL(target).href },
  };
});

ipcMain.handle("project:save", async (_event, payload) => {
  const { project, projectFilePath } = payload || {};
  if (!project || !projectFilePath) throw new Error("缺少项目目录信息。");
  writeProject(projectFilePath, project);
  rendererHasUnsavedChanges = false;
  return { projectFilePath, projectFileName: path.basename(projectFilePath), projectDir: path.dirname(projectFilePath), projectsDir: getProjectsDir() };
});

ipcMain.handle("project:open", async () => {
  ensureDirectory(getProjectsDir());
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "打开地图项目", defaultPath: getProjectsDir(), properties: ["openFile"],
    filters: [{ name: "地图项目", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const sourceFilePath = result.filePaths[0];
  let project = JSON.parse(fs.readFileSync(sourceFilePath, "utf8"));
  let projectFilePath = sourceFilePath;
  let migrated = false;
  if ((project.version || 1) < 2 || Object.values(project.maps || {}).some((map) => String(map.image || "").startsWith("data:"))) {
    const migration = migrateLegacyProject(project, sourceFilePath);
    project = migration.project;
    projectFilePath = migration.projectFilePath;
    migrated = true;
  }
  rendererHasUnsavedChanges = false;
  return {
    project, projectFilePath, projectFileName: path.basename(projectFilePath), projectDir: path.dirname(projectFilePath),
    projectsDir: getProjectsDir(), assetUrls: buildAssetUrls(project, projectFilePath), migrated,
  };
});

ipcMain.handle("asset:import", async (_event, payload) => {
  const { projectFilePath, sourcePath, category } = payload || {};
  if (!projectFilePath) throw new Error("请先创建或打开项目。");
  const folder = category === "icons" ? "icons" : "maps";
  const projectDir = path.dirname(projectFilePath);
  const target = copyAsset(sourcePath, path.join(projectDir, "assets", folder));
  return {
    relativePath: normalizeRelative(path.relative(projectDir, target)), url: pathToFileURL(target).href,
    name: path.basename(sourcePath, path.extname(sourcePath)),
  };
});

ipcMain.handle("viewer:exportSingle", async (_event, payload) => {
  const { template, project, projectFilePath } = payload || {};
  const embedded = cloneWithEmbeddedAssets(project, projectFilePath);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "导出单 HTML 查看器",
    defaultPath: path.join(projectFilePath ? path.dirname(projectFilePath) : getProjectsDir(), `${sanitizeFileName(project.name || "地图")}-查看器.html`),
    filters: [{ name: "HTML 查看器", extensions: ["html"] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, fillViewerTemplate(template, embedded), "utf8");
  return { filePath: result.filePath };
});

ipcMain.handle("viewer:exportFolder", async (_event, payload) => {
  const { template, project, projectFilePath } = payload || {};
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择查看器导出位置",
    defaultPath: projectFilePath ? path.dirname(projectFilePath) : getProjectsDir(),
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const exportDir = uniqueDirectory(result.filePaths[0], `${project.name || "地图"}-查看器`);
  copyViewerAssets(project, projectFilePath, exportDir);
  fs.writeFileSync(path.join(exportDir, "index.html"), fillViewerTemplate(template, project), "utf8");
  return { filePath: path.join(exportDir, "index.html"), exportDir };
});

ipcMain.on("project:setDirty", (_event, hasUnsavedChanges) => {
  rendererHasUnsavedChanges = Boolean(hasUnsavedChanges);
});

ipcMain.handle("settings:get", async () => ({
  projectsRoot: getProjectsDir(),
  isPortable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR),
}));

ipcMain.handle("settings:chooseProjectsRoot", async () => chooseProjectsRoot(mainWindow));

ipcMain.handle("settings:openProjectsRoot", async () => {
  const projectsRoot = getProjectsDir();
  ensureDirectory(projectsRoot);
  const error = await shell.openPath(projectsRoot);
  if (error) throw new Error(error);
  return { projectsRoot };
});
