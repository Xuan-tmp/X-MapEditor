const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const unsavedMessage = "还没有保存！确定要离开吗？";
const allowedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
let mainWindow = null;
let rendererHasUnsavedChanges = false;

function getWritableBaseDir() {
  return app.isPackaged ? path.dirname(process.execPath) : __dirname;
}

function getProjectsDir() {
  return path.join(getWritableBaseDir(), "projects");
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
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
  try { ensureDirectory(getProjectsDir()); createWindow(); }
  catch (error) { dialog.showErrorBox("启动失败", error.message); app.quit(); }
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
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
    defaultPath: path.join(getWritableBaseDir(), `${sanitizeFileName(project.name || "地图")}-查看器.html`),
    filters: [{ name: "HTML 查看器", extensions: ["html"] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, fillViewerTemplate(template, embedded), "utf8");
  return { filePath: result.filePath };
});

ipcMain.handle("viewer:exportFolder", async (_event, payload) => {
  const { template, project, projectFilePath } = payload || {};
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择查看器导出位置", defaultPath: getWritableBaseDir(), properties: ["openDirectory", "createDirectory"],
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
