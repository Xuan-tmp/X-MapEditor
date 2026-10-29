(function () {
  const els = {
    projectStatus: document.getElementById("projectStatus"),
    newProjectBtn: document.getElementById("newProjectBtn"),
    saveProjectBtn: document.getElementById("saveProjectBtn"),
    openProjectBtn: document.getElementById("openProjectBtn"),
    exportSingleBtn: document.getElementById("exportSingleBtn"),
    exportFolderBtn: document.getElementById("exportFolderBtn"),
    storageSettingsBtn: document.getElementById("storageSettingsBtn"),
    openProjectsDirBtn: document.getElementById("openProjectsDirBtn"),
    mainImageInput: document.getElementById("mainImageInput"),
    openProjectInput: document.getElementById("openProjectInput"),
    iconImageInput: document.getElementById("iconImageInput"),
    backParentBtn: document.getElementById("backParentBtn"),
    mapTree: document.getElementById("mapTree"),
    storagePathDisplay: document.getElementById("storagePathDisplay"),
    currentPath: document.getElementById("currentPath"),
    addInfoBtn: document.getElementById("addInfoBtn"),
    addSubmapBtn: document.getElementById("addSubmapBtn"),
    deleteElementBtn: document.getElementById("deleteElementBtn"),
    emptyState: document.getElementById("emptyState"),
    mapStage: document.getElementById("mapStage"),
    inspectorEmpty: document.getElementById("inspectorEmpty"),
    inspectorForm: document.getElementById("inspectorForm"),
    elementText: document.getElementById("elementText"),
    selectedIconPreview: document.getElementById("selectedIconPreview"),
    uploadIconBtn: document.getElementById("uploadIconBtn"),
    deleteIconBtn: document.getElementById("deleteIconBtn"),
    iconLibrary: document.getElementById("iconLibrary"),
    elementIconSize: document.getElementById("elementIconSize"),
    elementIconPlacement: document.getElementById("elementIconPlacement"),
    elementDescription: document.getElementById("elementDescription"),
    elementStylePreset: document.getElementById("elementStylePreset"),
    elementShowText: document.getElementById("elementShowText"),
    elementFontSize: document.getElementById("elementFontSize"),
    elementTextColor: document.getElementById("elementTextColor"),
    elementTextShadow: document.getElementById("elementTextShadow"),
    elementShowBackground: document.getElementById("elementShowBackground"),
    elementBackgroundColor: document.getElementById("elementBackgroundColor"),
    elementBackgroundOpacity: document.getElementById("elementBackgroundOpacity"),
    elementShowBorder: document.getElementById("elementShowBorder"),
    elementBorderColor: document.getElementById("elementBorderColor"),
    elementShowShadow: document.getElementById("elementShowShadow"),
    elementShowHoverOutline: document.getElementById("elementShowHoverOutline"),
    elementHoverOutlineColor: document.getElementById("elementHoverOutlineColor"),
    elementHoverOutlineOpacity: document.getElementById("elementHoverOutlineOpacity"),
    elementHoverOutlineWidth: document.getElementById("elementHoverOutlineWidth"),
    elementHoverOutlineOffset: document.getElementById("elementHoverOutlineOffset"),
    elementHoverOutlineStyle: document.getElementById("elementHoverOutlineStyle"),
    hoverOutlinePreview: document.getElementById("hoverOutlinePreview"),
    elementKind: document.getElementById("elementKind"),
    submapControls: document.getElementById("submapControls"),
    submapName: document.getElementById("submapName"),
    submapImage: document.getElementById("submapImage"),
    goSubmapBtn: document.getElementById("goSubmapBtn"),
    elementX: document.getElementById("elementX"),
    elementY: document.getElementById("elementY"),
  };

  const nativeApi = window.mapEditorNative || null;
  const unsavedMessage = "还没有保存！确定要离开吗？";
  const presetIcons = {
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
  const defaultTextStyle = {
    preset: "card",
    showText: true,
    fontSize: 14,
    color: "#17202a",
    showTextShadow: false,
    showBackground: true,
    backgroundColor: "#ffffff",
    backgroundOpacity: 90,
    showBorder: true,
    borderColor: "#0f766e",
    showShadow: true,
    showHoverOutline: true,
    hoverOutlineColor: "#0f766e",
    hoverOutlineOpacity: 35,
    hoverOutlineWidth: 1,
    hoverOutlineStyle: "solid",
    hoverOutlineOffset: 2,
  };

  let project = null;
  let currentMapId = null;
  let selectedElementId = null;
  let drag = null;
  let tooltip = null;
  let isDirty = false;
  let projectFilePath = null;
  let projectFileName = null;
  let projectDir = null;
  let projectsRoot = null;
  let assetUrls = {};

  const makeId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const clonePresets = () => JSON.parse(JSON.stringify(presetIcons));
  const validHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ""));

  function normalizeTextStyle(style = {}) {
    const normalized = { ...defaultTextStyle, ...style };
    normalized.preset = ["card", "simple", "text", "icon", "custom"].includes(normalized.preset) ? normalized.preset : "custom";
    normalized.showText = normalized.showText !== false;
    normalized.fontSize = clamp(Number(normalized.fontSize) || 14, 10, 48);
    normalized.color = validHexColor(normalized.color) ? normalized.color : defaultTextStyle.color;
    normalized.showTextShadow = Boolean(normalized.showTextShadow);
    normalized.showBackground = normalized.showBackground !== false;
    normalized.backgroundColor = validHexColor(normalized.backgroundColor) ? normalized.backgroundColor : defaultTextStyle.backgroundColor;
    normalized.backgroundOpacity = clamp(Number.isFinite(Number(normalized.backgroundOpacity)) ? Number(normalized.backgroundOpacity) : defaultTextStyle.backgroundOpacity, 0, 100);
    normalized.showBorder = normalized.showBorder !== false;
    normalized.borderColor = validHexColor(normalized.borderColor) ? normalized.borderColor : defaultTextStyle.borderColor;
    normalized.showShadow = normalized.showShadow !== false;
    normalized.showHoverOutline = normalized.showHoverOutline !== false;
    normalized.hoverOutlineColor = validHexColor(normalized.hoverOutlineColor) ? normalized.hoverOutlineColor : defaultTextStyle.hoverOutlineColor;
    normalized.hoverOutlineOpacity = clamp(Number.isFinite(Number(normalized.hoverOutlineOpacity)) ? Number(normalized.hoverOutlineOpacity) : defaultTextStyle.hoverOutlineOpacity, 0, 100);
    normalized.hoverOutlineWidth = clamp(Number(normalized.hoverOutlineWidth) || 1, 1, 6);
    normalized.hoverOutlineStyle = ["solid", "dashed", "dotted"].includes(normalized.hoverOutlineStyle) ? normalized.hoverOutlineStyle : "solid";
    normalized.hoverOutlineOffset = clamp(Number.isFinite(Number(normalized.hoverOutlineOffset)) ? Number(normalized.hoverOutlineOffset) : defaultTextStyle.hoverOutlineOffset, 0, 8);
    return normalized;
  }

  function styleForPreset(preset, current = {}) {
    const variants = {
      card: {},
      simple: { showBackground: true, backgroundOpacity: 55, showBorder: false, showShadow: true, showTextShadow: false },
      text: { showText: true, showBackground: false, showBorder: false, showShadow: false, showTextShadow: true },
      icon: { showText: false, showBackground: false, showBorder: false, showShadow: false, showTextShadow: false },
    };
    const hover = {
      showHoverOutline: current.showHoverOutline,
      hoverOutlineColor: current.hoverOutlineColor,
      hoverOutlineOpacity: current.hoverOutlineOpacity,
      hoverOutlineWidth: current.hoverOutlineWidth,
      hoverOutlineStyle: current.hoverOutlineStyle,
      hoverOutlineOffset: current.hoverOutlineOffset,
    };
    return normalizeTextStyle({ ...defaultTextStyle, ...(variants[preset] || {}), ...hover, preset });
  }

  function rgba(hex, opacity) {
    const safe = validHexColor(hex) ? hex : "#000000";
    const value = Number.parseInt(safe.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${clamp(Number(opacity), 0, 100) / 100})`;
  }

  function normalizeProjectStyles(targetProject) {
    Object.values(targetProject?.maps || {}).forEach((map) => {
      (map.elements || []).forEach((element) => { element.textStyle = normalizeTextStyle(element.textStyle); });
    });
    return targetProject;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, "utf-8");
    });
  }

  function readImageMeta(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || 16, height: image.naturalHeight || 9 });
      image.onerror = () => reject(new Error("无法读取图片尺寸。"));
      image.src = src;
    });
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function getAssetUrl(value) {
    if (!value) return "";
    if (/^(data:|blob:|file:|https?:)/i.test(value)) return value;
    return assetUrls[value] || value;
  }

  function presetSvg(name) {
    const common = 'class="preset-icon" viewBox="0 0 32 32" aria-hidden="true"';
    const svgs = {
      "black-dot": `<svg ${common}><circle cx="16" cy="16" r="10" fill="#111827"/></svg>`,
      "white-dot": `<svg ${common}><circle cx="16" cy="16" r="10" fill="#fff" stroke="#111827" stroke-width="2"/></svg>`,
      ring: `<svg ${common}><circle cx="16" cy="16" r="9" fill="none" stroke="#111827" stroke-width="4"/></svg>`,
      square: `<svg ${common}><rect x="7" y="7" width="18" height="18" rx="2" fill="#111827"/></svg>`,
      diamond: `<svg ${common}><path d="M16 4 28 16 16 28 4 16Z" fill="#2563eb"/></svg>`,
      triangle: `<svg ${common}><path d="M16 4 29 27H3Z" fill="#f59e0b" stroke="#7c2d12" stroke-width="1.5"/></svg>`,
      star: `<svg ${common}><path d="m16 3 3.8 8 8.7 1.1-6.4 6 1.7 8.6-7.8-4.2-7.8 4.2 1.7-8.6-6.4-6 8.7-1.1Z" fill="#facc15" stroke="#854d0e" stroke-width="1.3"/></svg>`,
      flag: `<svg ${common}><path d="M8 29V4m1 2h15l-4 6 4 6H9" fill="#ef4444" stroke="#111827" stroke-width="2" stroke-linejoin="round"/></svg>`,
      arrow: `<svg ${common}><path d="M5 16h19m-7-8 8 8-8 8" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      info: `<svg ${common}><circle cx="16" cy="16" r="13" fill="#2563eb"/><path d="M16 14v9M16 9h.01" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
      question: `<svg ${common}><circle cx="16" cy="16" r="13" fill="#7c3aed"/><path d="M11.5 12a4.7 4.7 0 1 1 6.2 4.4c-1.7.7-1.7 1.7-1.7 3M16 24h.01" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      warning: `<svg ${common}><path d="M16 3 30 28H2Z" fill="#facc15" stroke="#92400e" stroke-width="1.5"/><path d="M16 11v8m0 4h.01" stroke="#78350f" stroke-width="3" stroke-linecap="round"/></svg>`,
      entrance: `<svg ${common}><path d="M5 16h16m-6-6 6 6-6 6M23 5h5v22h-5" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    };
    return svgs[name] || svgs.info;
  }

  function renderIcon(container, iconId, sourceProject = project) {
    container.innerHTML = "";
    const icon = sourceProject?.icons?.[iconId] || sourceProject?.icons?.["preset-info"] || presetIcons["preset-info"];
    if (icon.type === "image") {
      const image = document.createElement("img");
      image.src = getAssetUrl(icon.src);
      image.alt = icon.name || "图标";
      container.appendChild(image);
    } else if (icon.type === "text") {
      container.textContent = icon.text || "•";
    } else {
      container.innerHTML = presetSvg(icon.preset);
    }
  }

  function applyTextStyle(node, element) {
    const style = normalizeTextStyle(element.textStyle);
    element.textStyle = style;
    const text = node.querySelector(".text");
    text.hidden = !style.showText;
    text.style.fontSize = `${style.fontSize}px`;
    text.style.color = style.color;
    text.style.textShadow = style.showTextShadow ? "0 1px 2px rgba(0,0,0,.8), 0 0 3px rgba(0,0,0,.4)" : "none";
    node.style.backgroundColor = style.showBackground ? rgba(style.backgroundColor, style.backgroundOpacity) : "transparent";
    node.style.border = style.showBorder ? `1px solid ${style.borderColor}` : "none";
    node.style.boxShadow = style.showShadow ? "0 5px 14px rgba(15,23,42,.14)" : "none";
    node.style.setProperty("--hover-outline", style.showHoverOutline
      ? `${style.hoverOutlineWidth}px ${style.hoverOutlineStyle} ${rgba(style.hoverOutlineColor, style.hoverOutlineOpacity)}`
      : "none");
    node.style.setProperty("--hover-outline-offset", `${style.hoverOutlineOffset}px`);
    node.classList.toggle("icon-only", !style.showText);
  }

  function setDirty(value) {
    isDirty = value;
    if (nativeApi) nativeApi.setDirty(value);
    renderProjectState();
  }

  function markDirty() {
    if (project) setDirty(true);
  }

  function applyFileInfo(info) {
    if (!info) return;
    projectFilePath = info.projectFilePath || projectFilePath;
    projectFileName = info.projectFileName || projectFileName;
    projectDir = info.projectDir || projectDir;
    projectsRoot = info.projectsDir || projectsRoot;
  }

  function applyStorageSettings(info) {
    if (!info?.projectsRoot) return;
    projectsRoot = info.projectsRoot;
    els.storagePathDisplay.textContent = projectsRoot;
    els.storagePathDisplay.title = projectsRoot;
    els.storageSettingsBtn.title = `当前项目存储位置：${projectsRoot}\n点击更改`;
    els.openProjectsDirBtn.title = `打开：${projectsRoot}`;
  }

  async function loadStorageSettings() {
    if (!nativeApi?.getSettings) return;
    applyStorageSettings(await nativeApi.getSettings());
  }

  function getProjectStatusText() {
    if (!project) return "未创建项目";
    const fileLabel = projectDir ? ` · ${projectDir}` : projectFileName ? ` · ${projectFileName}` : "";
    return `${project.name}${fileLabel}${isDirty ? " · 未保存" : " · 已保存"}`;
  }

  async function saveProject() {
    if (!project) return false;
    normalizeProjectStyles(project);
    project.updatedAt = new Date().toISOString();
    if (nativeApi) {
      const info = await nativeApi.saveProject({ project, projectFilePath });
      applyFileInfo(info);
    } else {
      downloadFile(`${project.name || "地图项目"}.json`, JSON.stringify(project, null, 2), "application/json;charset=utf-8");
    }
    setDirty(false);
    render();
    return true;
  }

  function createMap(name, image, parentId, width, height) {
    return { id: makeId("map"), name, image, width: width || 16, height: height || 9, parentId, elements: [] };
  }

  function createElement(kind) {
    const map = getCurrentMap();
    const element = {
      id: makeId("link"), kind,
      text: kind === "submap" ? "进入子地图" : "说明",
      iconId: kind === "submap" ? "preset-entrance" : "preset-info",
      iconSize: 22, iconPlacement: "left",
      textStyle: normalizeTextStyle(),
      description: kind === "submap" ? "点击进入更详细的地图。" : "这里是一段简要说明。",
      x: Number((map.width / 2).toFixed(3)), y: Number((map.height / 2).toFixed(3)), targetMapId: null,
    };
    if (kind === "submap") {
      const child = createMap("未命名子地图", map.image, map.id, map.width, map.height);
      project.maps[child.id] = child;
      element.targetMapId = child.id;
    }
    return element;
  }

  function getCurrentMap() {
    return project?.maps?.[currentMapId] || null;
  }

  function getSelectedElement() {
    return getCurrentMap()?.elements.find((item) => item.id === selectedElementId) || null;
  }

  function getMapPath(mapId) {
    const names = [];
    let map = project?.maps?.[mapId];
    while (map) {
      names.unshift(map.name);
      map = map.parentId ? project.maps[map.parentId] : null;
    }
    return names.join(" / ");
  }

  function render() {
    renderProjectState();
    renderTree();
    renderStage();
    renderInspector();
  }

  function renderProjectState() {
    const hasProject = Boolean(project);
    els.projectStatus.textContent = getProjectStatusText();
    els.projectStatus.title = projectDir || "";
    els.addInfoBtn.disabled = !hasProject;
    els.addSubmapBtn.disabled = !hasProject;
    els.deleteElementBtn.disabled = !getSelectedElement();
    els.exportSingleBtn.disabled = !hasProject;
    els.exportFolderBtn.disabled = !hasProject || !nativeApi;
    els.storageSettingsBtn.disabled = !nativeApi;
    els.openProjectsDirBtn.disabled = !nativeApi;
    els.saveProjectBtn.disabled = !hasProject;
    els.backParentBtn.disabled = !getCurrentMap()?.parentId;
    els.currentPath.textContent = hasProject ? getMapPath(currentMapId) : "请先新建项目";
  }

  function renderTree() {
    els.mapTree.innerHTML = "";
    if (!project) return;
    appendTreeNode(project.maps[project.rootMapId], 0);
  }

  function appendTreeNode(map, depth) {
    if (!map) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tree-node${map.id === currentMapId ? " active" : ""}`;
    button.style.paddingLeft = `${12 + depth * 18}px`;
    button.textContent = map.name;
    button.title = getMapPath(map.id);
    button.onclick = () => { currentMapId = map.id; selectedElementId = null; render(); };
    els.mapTree.appendChild(button);
    map.elements.filter((element) => element.kind === "submap" && project.maps[element.targetMapId])
      .forEach((element) => appendTreeNode(project.maps[element.targetMapId], depth + 1));
  }

  function renderStage() {
    hideTooltip();
    els.mapStage.innerHTML = "";
    const map = getCurrentMap();
    els.emptyState.classList.toggle("hidden", Boolean(map));
    els.mapStage.classList.toggle("visible", Boolean(map));
    if (!map) return;
    els.mapStage.style.setProperty("--map-ratio", `${map.width || 16} / ${map.height || 9}`);
    const mapImage = document.createElement("img");
    mapImage.className = "map-image";
    mapImage.src = getAssetUrl(map.image);
    mapImage.alt = map.name;
    mapImage.onerror = () => { mapImage.alt = "地图资源缺失"; mapImage.classList.add("missing"); };
    els.mapStage.appendChild(mapImage);
    map.elements.forEach((element) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `map-link${element.id === selectedElementId ? " selected" : ""}`;
      node.dataset.placement = element.iconPlacement || "left";
      node.style.left = `${clamp((element.x / map.width) * 100, 0, 100)}%`;
      node.style.top = `${clamp((element.y / map.height) * 100, 0, 100)}%`;
      node.style.setProperty("--icon-size", `${clamp(Number(element.iconSize) || 22, 12, 64)}px`);
      node.innerHTML = '<span class="icon"></span><span class="text"></span>';
      renderIcon(node.querySelector(".icon"), element.iconId);
      node.querySelector(".text").textContent = element.text || "未命名";
      applyTextStyle(node, element);
      node.onpointerdown = (event) => startDrag(event, element.id);
      node.onclick = (event) => { event.stopPropagation(); if (!drag?.moved) selectElement(element.id); };
      node.ondblclick = (event) => {
        event.stopPropagation();
        if (element.kind === "submap" && element.targetMapId) {
          currentMapId = element.targetMapId; selectedElementId = null; render();
        }
      };
      node.onmouseenter = (event) => showTooltip(event, element.description);
      node.onmousemove = moveTooltip;
      node.onmouseleave = hideTooltip;
      els.mapStage.appendChild(node);
    });
  }

  function renderInspector() {
    const element = getSelectedElement();
    els.inspectorEmpty.classList.toggle("hidden", Boolean(element));
    els.inspectorForm.classList.toggle("hidden", !element);
    if (!element) return;
    els.elementText.value = element.text || "";
    els.elementIconSize.value = clamp(Number(element.iconSize) || 22, 12, 64);
    els.elementIconPlacement.value = element.iconPlacement || "left";
    els.elementDescription.value = element.description || "";
    const style = normalizeTextStyle(element.textStyle);
    element.textStyle = style;
    els.elementStylePreset.value = style.preset;
    els.elementShowText.checked = style.showText;
    els.elementFontSize.value = style.fontSize;
    els.elementTextColor.value = style.color;
    els.elementTextShadow.checked = style.showTextShadow;
    els.elementShowBackground.checked = style.showBackground;
    els.elementBackgroundColor.value = style.backgroundColor;
    els.elementBackgroundOpacity.value = style.backgroundOpacity;
    els.elementShowBorder.checked = style.showBorder;
    els.elementBorderColor.value = style.borderColor;
    els.elementShowShadow.checked = style.showShadow;
    els.elementShowHoverOutline.checked = style.showHoverOutline;
    els.elementHoverOutlineColor.value = style.hoverOutlineColor;
    els.elementHoverOutlineOpacity.value = style.hoverOutlineOpacity;
    els.elementHoverOutlineWidth.value = style.hoverOutlineWidth;
    els.elementHoverOutlineOffset.value = style.hoverOutlineOffset;
    els.elementHoverOutlineStyle.value = style.hoverOutlineStyle;
    renderHoverOutlinePreview(style);
    els.elementKind.value = element.kind;
    els.elementX.value = Number(element.x || 0).toFixed(2);
    els.elementY.value = Number(element.y || 0).toFixed(2);
    els.elementX.max = getCurrentMap().width;
    els.elementY.max = getCurrentMap().height;
    els.submapControls.classList.toggle("hidden", element.kind !== "submap");
    els.submapName.value = element.targetMapId ? project.maps[element.targetMapId]?.name || "" : "";
    renderIcon(els.selectedIconPreview, element.iconId);
    renderIconLibrary(element.iconId);
    els.deleteIconBtn.disabled = project.icons?.[element.iconId]?.type !== "image";
  }

  function renderHoverOutlinePreview(style) {
    const outline = style.showHoverOutline
      ? `${style.hoverOutlineWidth}px ${style.hoverOutlineStyle} ${rgba(style.hoverOutlineColor, style.hoverOutlineOpacity)}`
      : "none";
    els.hoverOutlinePreview.style.setProperty("--preview-outline", outline);
    els.hoverOutlinePreview.style.setProperty("--preview-outline-offset", `${style.hoverOutlineOffset}px`);
  }

  function updateSelectedTextStyle(changes, fullRender = false) {
    const element = getSelectedElement();
    if (!element) return;
    element.textStyle = normalizeTextStyle({ ...element.textStyle, ...changes, preset: changes.preset || "custom" });
    if (!changes.preset) els.elementStylePreset.value = "custom";
    markDirty();
    renderStage();
    renderProjectState();
    renderHoverOutlinePreview(element.textStyle);
    if (fullRender) renderInspector();
  }

  function renderIconLibrary(activeIconId) {
    els.iconLibrary.innerHTML = "";
    Object.entries(project.icons || {}).forEach(([iconId, icon]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `icon-choice${iconId === activeIconId ? " active" : ""}`;
      button.title = icon.name || "未命名图标";
      const swatch = document.createElement("span");
      swatch.className = "icon-swatch";
      renderIcon(swatch, iconId);
      button.appendChild(swatch);
      button.onclick = () => updateSelectedElement({ iconId }, true);
      els.iconLibrary.appendChild(button);
    });
  }

  function selectElement(id) {
    selectedElementId = id;
    render();
  }

  function updateSelectedElement(changes, fullRender = false) {
    const element = getSelectedElement();
    if (!element) return;
    Object.assign(element, changes);
    markDirty();
    if (fullRender) render();
    else { renderProjectState(); renderStage(); }
  }

  function startDrag(event, elementId) {
    if (!project) return;
    hideTooltip();
    event.preventDefault();
    event.stopPropagation();
    selectedElementId = elementId;
    drag = {
      element: getSelectedElement(), rect: els.mapStage.getBoundingClientRect(), moved: false,
      pointerId: event.pointerId, node: event.currentTarget,
    };
    event.currentTarget.classList.add("selected");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag) return;
    const map = getCurrentMap();
    drag.element.x = Number(clamp(((event.clientX - drag.rect.left) / drag.rect.width) * map.width, 0, map.width).toFixed(3));
    drag.element.y = Number(clamp(((event.clientY - drag.rect.top) / drag.rect.height) * map.height, 0, map.height).toFixed(3));
    drag.moved = true;
    drag.node.style.left = `${(drag.element.x / map.width) * 100}%`;
    drag.node.style.top = `${(drag.element.y / map.height) * 100}%`;
    els.elementX.value = drag.element.x.toFixed(2);
    els.elementY.value = drag.element.y.toFixed(2);
  }

  function onPointerUp() {
    if (!drag) return;
    const moved = drag.moved;
    setTimeout(() => { drag = null; }, 0);
    if (moved) markDirty();
    renderProjectState();
  }

  function showTooltip(event, text) {
    if (drag || !text) return;
    hideTooltip();
    tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltip) return;
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY + 12}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.remove();
    tooltip = null;
  }

  function normalizeBrowserProject(data) {
    if ((data.version || 1) >= 2) {
      data.icons = { ...clonePresets(), ...(data.icons || {}) };
      return normalizeProjectStyles(data);
    }
    data.version = 2;
    data.icons = clonePresets();
    Object.values(data.maps || {}).forEach((map) => {
      (map.elements || []).forEach((element) => {
        element.x = Number(((Number(element.x) || 0) * (map.width || 16) / 100).toFixed(3));
        element.y = Number(((Number(element.y) || 0) * (map.height || 9) / 100).toFixed(3));
        element.iconId = element.kind === "submap" ? "preset-entrance" : "preset-info";
        element.iconSize = 22;
        delete element.icon;
      });
    });
    return normalizeProjectStyles(data);
  }

  async function createProjectFromImage(file) {
    const name = file.name.replace(/\.[^.]+$/, "") || "未命名地图项目";
    let image;
    if (nativeApi) {
      const info = await nativeApi.createProject({ name, sourcePath: nativeApi.getFilePath(file) });
      applyFileInfo(info);
      image = info.asset.relativePath;
      assetUrls[image] = info.asset.url;
    } else {
      image = await readFileAsDataUrl(file);
      projectFilePath = null; projectFileName = `${name}.json`; projectDir = null;
    }
    const meta = await readImageMeta(getAssetUrl(image));
    const rootMap = createMap("主地图", image, null, meta.width, meta.height);
    project = {
      version: 2, name, createdAt: new Date().toISOString(), rootMapId: rootMap.id,
      maps: { [rootMap.id]: rootMap }, icons: clonePresets(),
    };
    currentMapId = rootMap.id;
    selectedElementId = null;
    render();
    try { await saveProject(); }
    catch (error) { setDirty(true); alert(`项目自动保存失败：${error.message}`); }
  }

  function addElement(kind) {
    const map = getCurrentMap();
    if (!map) return;
    const element = createElement(kind);
    map.elements.push(element);
    selectedElementId = element.id;
    markDirty();
    render();
  }

  function removeMapAndChildren(mapId) {
    const map = project.maps[mapId];
    if (!map) return;
    map.elements.filter((element) => element.kind === "submap" && element.targetMapId)
      .forEach((element) => removeMapAndChildren(element.targetMapId));
    delete project.maps[mapId];
  }

  function deleteSelectedElement() {
    const map = getCurrentMap();
    const element = getSelectedElement();
    if (!map || !element) return;
    if (element.kind === "submap" && element.targetMapId) removeMapAndChildren(element.targetMapId);
    map.elements = map.elements.filter((item) => item.id !== element.id);
    selectedElementId = null;
    markDirty();
    render();
  }

  function convertSelectedKind(kind) {
    const element = getSelectedElement();
    if (!element || element.kind === kind) return;
    if (kind === "submap") {
      const map = getCurrentMap();
      const child = createMap(element.text || "未命名子地图", map.image, map.id, map.width, map.height);
      project.maps[child.id] = child;
      element.targetMapId = child.id;
      element.iconId = "preset-entrance";
    } else if (element.targetMapId) {
      removeMapAndChildren(element.targetMapId);
      element.targetMapId = null;
      element.iconId = "preset-info";
    }
    element.kind = kind;
    markDirty();
    render();
  }

  async function importImageAsset(file, category) {
    if (nativeApi) {
      const imported = await nativeApi.importAsset({
        projectFilePath, sourcePath: nativeApi.getFilePath(file), category,
      });
      assetUrls[imported.relativePath] = imported.url;
      return imported;
    }
    return { relativePath: await readFileAsDataUrl(file), url: null, name: file.name.replace(/\.[^.]+$/, "") };
  }

  async function replaceSubmapImage(file) {
    const element = getSelectedElement();
    if (!element?.targetMapId || !file) return;
    const map = project.maps[element.targetMapId];
    const imported = await importImageAsset(file, "maps");
    const meta = await readImageMeta(imported.url || imported.relativePath);
    const ratioX = meta.width / map.width;
    const ratioY = meta.height / map.height;
    map.elements.forEach((item) => { item.x *= ratioX; item.y *= ratioY; });
    map.image = imported.relativePath;
    map.width = meta.width;
    map.height = meta.height;
    els.submapImage.value = "";
    markDirty();
    render();
  }

  async function uploadIcon(file) {
    if (!file || !project) return;
    const imported = await importImageAsset(file, "icons");
    const existing = Object.entries(project.icons).find(([, icon]) => icon.type === "image" && icon.src === imported.relativePath);
    const iconId = existing?.[0] || makeId("icon");
    if (!existing) project.icons[iconId] = { type: "image", name: imported.name || "自定义图标", src: imported.relativePath };
    updateSelectedElement({ iconId }, true);
  }

  function countIconReferences(iconId) {
    return Object.values(project.maps).reduce((count, map) => count + map.elements.filter((element) => element.iconId === iconId).length, 0);
  }

  function removeCurrentIcon() {
    const element = getSelectedElement();
    const icon = project?.icons?.[element?.iconId];
    if (!element || icon?.type !== "image") return;
    const references = countIconReferences(element.iconId);
    if (references > 1) {
      alert(`这个图标仍被 ${references} 个地图条目使用，请先为这些条目更换图标。`);
      return;
    }
    const iconId = element.iconId;
    element.iconId = "preset-info";
    delete project.icons[iconId];
    markDirty();
    render();
  }

  function buildViewerTemplate() {
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>地图查看器</title><style>
:root{--bg:#f4f6f8;--surface:#fff;--line:#d9e0e8;--text:#17202a;--muted:#697586;--accent:#0f766e}*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--bg);color:var(--text);font-family:"Microsoft YaHei","PingFang SC","Segoe UI",sans-serif;overflow:hidden}header{height:60px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;background:#fff;border-bottom:1px solid var(--line)}h1{font-size:18px;margin:0}.path{color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}button{min-height:34px;border:1px solid var(--line);border-radius:6px;background:#fff;padding:6px 11px;cursor:pointer}.header-left{display:flex;align-items:center;gap:10px;min-width:0}.title-block{min-width:0}.menu-btn{display:none}main{display:grid;grid-template-columns:240px 1fr;height:calc(100vh - 60px)}aside{background:#fff;border-right:1px solid var(--line);padding:10px;overflow:auto}.tree-node{width:100%;margin-bottom:6px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tree-node.active{border-color:var(--accent);color:var(--accent);background:#ecfdf5}.wrap{position:relative;overflow:hidden;padding:24px;touch-action:none}.stage{position:relative;width:min(100%,960px);aspect-ratio:var(--ratio,16/9);margin:auto;border:1px solid var(--line);border-radius:8px;background:#eef2f6;box-shadow:0 12px 32px rgba(15,23,42,.12);overflow:hidden;transform-origin:center}.map-image{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}.map-link{position:absolute;z-index:2;min-height:0;transform:translate(-50%,-50%) scale(var(--inverse-scale,1));border:1px solid rgba(15,118,110,.55);border-radius:6px;background:rgba(255,255,255,.92);display:inline-flex;align-items:center;gap:6px;max-width:220px;padding:5px 8px;box-shadow:0 5px 14px rgba(15,23,42,.14);transform-origin:center;outline:none;outline-offset:var(--hover-outline-offset,2px)}.map-link[data-placement=bottom]{flex-direction:column-reverse}.map-link.icon-only{padding:0;gap:0}.icon{width:var(--icon-size,22px);height:var(--icon-size,22px);font-size:var(--icon-size,22px);display:grid;place-items:center;flex:0 0 auto}.icon img,.preset-icon{width:100%;height:100%;object-fit:contain}.text{font-size:14px;line-height:1.2;overflow-wrap:anywhere}.controls{position:absolute;right:14px;bottom:14px;z-index:10;display:flex;gap:6px}.controls button{width:38px;height:38px;padding:0;font-size:18px}.tooltip{position:fixed;z-index:20;max-width:260px;padding:8px 10px;border-radius:6px;background:#17202a;color:#fff;font-size:13px;pointer-events:none}.backdrop{display:none}.detail{position:fixed;left:50%;bottom:18px;z-index:30;width:min(420px,calc(100vw - 28px));transform:translateX(-50%);border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:0 18px 42px rgba(15,23,42,.22);padding:14px}.hidden{display:none}.detail h2{font-size:16px;margin:0 28px 8px 0}.detail p{color:var(--muted);line-height:1.5}.detail-actions{display:flex;justify-content:flex-end;gap:8px}.close{position:absolute;right:8px;top:8px;width:30px;height:30px;padding:0}@media(hover:hover){.map-link:hover{outline:var(--hover-outline,none)}}
@media(max-width:760px){header{height:58px;padding:8px 10px}.menu-btn{display:inline-grid;place-items:center;width:38px;height:38px;padding:0}h1{font-size:16px}main{display:block;height:calc(100vh - 58px)}aside{position:fixed;left:0;top:58px;bottom:0;z-index:25;width:min(82vw,320px);transform:translateX(-105%);transition:.2s;box-shadow:12px 0 32px rgba(15,23,42,.18)}body.nav-open aside{transform:translateX(0)}.backdrop{position:fixed;inset:58px 0 0;z-index:24;background:rgba(15,23,42,.28)}body.nav-open .backdrop{display:block}.wrap{height:100%;padding:12px}.stage{width:min(132vw,1080px);max-width:none}.tooltip{display:none}}
</style></head><body>
<header><div class="header-left"><button id="menu" class="menu-btn">☰</button><div class="title-block"><h1 id="title"></h1><div id="path" class="path"></div></div></div><button id="back">返回上级</button></header>
<main><aside id="tree"></aside><div id="backdrop" class="backdrop"></div><section id="wrap" class="wrap"><div id="stage" class="stage"></div><div class="controls"><button id="out">−</button><button id="reset">⌂</button><button id="in">＋</button></div></section></main>
<div id="detail" class="detail hidden"><button id="close" class="close">×</button><h2 id="detailTitle"></h2><p id="detailDesc"></p><div class="detail-actions"><button id="enter">进入子地图</button></div></div>
<script>const project=__PROJECT_DATA__;
let currentMapId=project.rootMapId,tip=null,scale=1,panX=0,panY=0,dragging=false,lastX=0,lastY=0,pinchDistance=0,pinchScale=1,active=null;const pointers=new Map();
const title=document.getElementById("title"),pathEl=document.getElementById("path"),tree=document.getElementById("tree"),stage=document.getElementById("stage"),wrap=document.getElementById("wrap"),back=document.getElementById("back"),detail=document.getElementById("detail"),enter=document.getElementById("enter");
function svg(n){const c='class="preset-icon" viewBox="0 0 32 32"';const s={"black-dot":'<svg '+c+'><circle cx="16" cy="16" r="10" fill="#111827"/></svg>',"white-dot":'<svg '+c+'><circle cx="16" cy="16" r="10" fill="#fff" stroke="#111827" stroke-width="2"/></svg>',ring:'<svg '+c+'><circle cx="16" cy="16" r="9" fill="none" stroke="#111827" stroke-width="4"/></svg>',square:'<svg '+c+'><rect x="7" y="7" width="18" height="18" rx="2" fill="#111827"/></svg>',diamond:'<svg '+c+'><path d="M16 4 28 16 16 28 4 16Z" fill="#2563eb"/></svg>',triangle:'<svg '+c+'><path d="M16 4 29 27H3Z" fill="#f59e0b" stroke="#7c2d12"/></svg>',star:'<svg '+c+'><path d="m16 3 3.8 8 8.7 1.1-6.4 6 1.7 8.6-7.8-4.2-7.8 4.2 1.7-8.6-6.4-6 8.7-1.1Z" fill="#facc15" stroke="#854d0e"/></svg>',flag:'<svg '+c+'><path d="M8 29V4m1 2h15l-4 6 4 6H9" fill="#ef4444" stroke="#111827" stroke-width="2"/></svg>',arrow:'<svg '+c+'><path d="M5 16h19m-7-8 8 8-8 8" fill="none" stroke="#2563eb" stroke-width="4"/></svg>',info:'<svg '+c+'><circle cx="16" cy="16" r="13" fill="#2563eb"/><path d="M16 14v9M16 9h.01" stroke="#fff" stroke-width="3"/></svg>',question:'<svg '+c+'><circle cx="16" cy="16" r="13" fill="#7c3aed"/><text x="16" y="23" text-anchor="middle" fill="#fff" font-size="21">?</text></svg>',warning:'<svg '+c+'><path d="M16 3 30 28H2Z" fill="#facc15" stroke="#92400e"/><text x="16" y="24" text-anchor="middle" font-size="18">!</text></svg>',entrance:'<svg '+c+'><path d="M5 16h16m-6-6 6 6-6 6M23 5h5v22h-5" fill="none" stroke="#059669" stroke-width="3"/></svg>'};return s[n]||s.info}
function icon(container,id){container.innerHTML="";const d=project.icons[id]||project.icons["preset-info"];if(d.type==="image"){const i=document.createElement("img");i.src=d.src;i.alt=d.name||"图标";container.appendChild(i)}else if(d.type==="text")container.textContent=d.text||"•";else container.innerHTML=svg(d.preset)}
const defaultTextStyle={preset:"card",showText:true,fontSize:14,color:"#17202a",showTextShadow:false,showBackground:true,backgroundColor:"#ffffff",backgroundOpacity:90,showBorder:true,borderColor:"#0f766e",showShadow:true,showHoverOutline:true,hoverOutlineColor:"#0f766e",hoverOutlineOpacity:35,hoverOutlineWidth:1,hoverOutlineStyle:"solid",hoverOutlineOffset:2};
function validColor(v){return /^#[0-9a-f]{6}$/i.test(String(v||""))}function limit(v,min,max,fallback){v=Number(v);return Math.min(max,Math.max(min,Number.isFinite(v)?v:fallback))}function normalizeStyle(v){v=Object.assign({},defaultTextStyle,v||{});v.showText=v.showText!==false;v.fontSize=limit(v.fontSize,10,48,14);v.color=validColor(v.color)?v.color:defaultTextStyle.color;v.showTextShadow=Boolean(v.showTextShadow);v.showBackground=v.showBackground!==false;v.backgroundColor=validColor(v.backgroundColor)?v.backgroundColor:defaultTextStyle.backgroundColor;v.backgroundOpacity=limit(v.backgroundOpacity,0,100,90);v.showBorder=v.showBorder!==false;v.borderColor=validColor(v.borderColor)?v.borderColor:defaultTextStyle.borderColor;v.showShadow=v.showShadow!==false;v.showHoverOutline=v.showHoverOutline!==false;v.hoverOutlineColor=validColor(v.hoverOutlineColor)?v.hoverOutlineColor:defaultTextStyle.hoverOutlineColor;v.hoverOutlineOpacity=limit(v.hoverOutlineOpacity,0,100,35);v.hoverOutlineWidth=limit(v.hoverOutlineWidth,1,6,1);v.hoverOutlineStyle=["solid","dashed","dotted"].includes(v.hoverOutlineStyle)?v.hoverOutlineStyle:"solid";v.hoverOutlineOffset=limit(v.hoverOutlineOffset,0,8,2);return v}function colorAlpha(hex,opacity){const n=parseInt(hex.slice(1),16);return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+(opacity/100)+")"}function styleNode(n,e){const s=normalizeStyle(e.textStyle),t=n.querySelector(".text");t.hidden=!s.showText;t.style.fontSize=s.fontSize+"px";t.style.color=s.color;t.style.textShadow=s.showTextShadow?"0 1px 2px rgba(0,0,0,.8),0 0 3px rgba(0,0,0,.4)":"none";n.style.backgroundColor=s.showBackground?colorAlpha(s.backgroundColor,s.backgroundOpacity):"transparent";n.style.border=s.showBorder?"1px solid "+s.borderColor:"none";n.style.boxShadow=s.showShadow?"0 5px 14px rgba(15,23,42,.14)":"none";n.style.setProperty("--hover-outline",s.showHoverOutline?s.hoverOutlineWidth+"px "+s.hoverOutlineStyle+" "+colorAlpha(s.hoverOutlineColor,s.hoverOutlineOpacity):"none");n.style.setProperty("--hover-outline-offset",s.hoverOutlineOffset+"px");n.classList.toggle("icon-only",!s.showText)}
function mobile(){return matchMedia("(max-width:760px)").matches}function mapPath(id){const a=[];let m=project.maps[id];while(m){a.unshift(m.name);m=m.parentId?project.maps[m.parentId]:null}return a.join(" / ")}
function render(){hideTip();hideDetail();const m=project.maps[currentMapId];title.textContent=project.name||"地图查看器";pathEl.textContent=mapPath(currentMapId);back.disabled=!m.parentId;stage.style.setProperty("--ratio",m.width+" / "+m.height);stage.innerHTML="";const img=document.createElement("img");img.className="map-image";img.src=m.image;img.alt=m.name;stage.appendChild(img);m.elements.forEach(function(e){const n=document.createElement("button");n.className="map-link";n.dataset.placement=e.iconPlacement||"left";n.style.left=(e.x/m.width*100)+"%";n.style.top=(e.y/m.height*100)+"%";n.style.setProperty("--icon-size",Math.max(12,Math.min(64,e.iconSize||22))+"px");n.innerHTML='<span class="icon"></span><span class="text"></span>';icon(n.querySelector(".icon"),e.iconId);n.querySelector(".text").textContent=e.text||"未命名";styleNode(n,e);n.onclick=function(ev){ev.stopPropagation();if(mobile()){showDetail(e);return}if(e.kind==="submap"&&project.maps[e.targetMapId]){currentMapId=e.targetMapId;resetView();render()}};n.onmouseenter=function(ev){if(!mobile())showTip(ev,e.description)};n.onmousemove=moveTip;n.onmouseleave=hideTip;stage.appendChild(n)});renderTree();applyView()}
function renderTree(){tree.innerHTML="";appendTree(project.maps[project.rootMapId],0)}function appendTree(m,d){const b=document.createElement("button");b.className="tree-node"+(m.id===currentMapId?" active":"");b.style.paddingLeft=(12+d*18)+"px";b.textContent=m.name;b.onclick=function(){currentMapId=m.id;resetView();document.body.classList.remove("nav-open");render()};tree.appendChild(b);m.elements.filter(function(e){return e.kind==="submap"&&project.maps[e.targetMapId]}).forEach(function(e){appendTree(project.maps[e.targetMapId],d+1)})}
function showTip(e,t){if(!t)return;hideTip();tip=document.createElement("div");tip.className="tooltip";tip.textContent=t;document.body.appendChild(tip);moveTip(e)}function moveTip(e){if(tip){tip.style.left=(e.clientX+12)+"px";tip.style.top=(e.clientY+12)+"px"}}function hideTip(){if(tip)tip.remove();tip=null}
function showDetail(e){active=e;document.getElementById("detailTitle").textContent=e.text||"未命名";document.getElementById("detailDesc").textContent=e.description||"没有说明。";enter.style.display=e.kind==="submap"&&project.maps[e.targetMapId]?"inline-block":"none";detail.classList.remove("hidden")}function hideDetail(){active=null;detail.classList.add("hidden")}
function applyView(){scale=Math.max(.65,Math.min(4,scale));stage.style.transform="translate("+panX+"px,"+panY+"px) scale("+scale+")";stage.style.setProperty("--inverse-scale",1/scale)}function resetView(){scale=1;panX=panY=0;applyView()}function distance(){const p=Array.from(pointers.values());return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}
back.onclick=function(){const m=project.maps[currentMapId];if(m.parentId){currentMapId=m.parentId;resetView();render()}};document.getElementById("menu").onclick=function(){document.body.classList.toggle("nav-open")};document.getElementById("backdrop").onclick=function(){document.body.classList.remove("nav-open")};document.getElementById("out").onclick=function(){scale-=.25;applyView()};document.getElementById("in").onclick=function(){scale+=.25;applyView()};document.getElementById("reset").onclick=resetView;document.getElementById("close").onclick=hideDetail;enter.onclick=function(){if(active&&project.maps[active.targetMapId]){currentMapId=active.targetMapId;resetView();render()}};
wrap.onwheel=function(e){e.preventDefault();scale+=e.deltaY>0?-.12:.12;applyView()};wrap.onpointerdown=function(e){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});hideDetail();if(pointers.size===1&&!e.target.closest(".map-link")){wrap.setPointerCapture(e.pointerId);dragging=true;lastX=e.clientX;lastY=e.clientY}else if(pointers.size===2){dragging=false;pinchDistance=distance();pinchScale=scale}};wrap.onpointermove=function(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinchDistance){scale=pinchScale*distance()/pinchDistance;applyView()}else if(dragging){panX+=e.clientX-lastX;panY+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;applyView()}};function end(e){pointers.delete(e.pointerId);dragging=false;if(pointers.size<2)pinchDistance=0}wrap.onpointerup=end;wrap.onpointercancel=end;render();
</script></body></html>`;
  }

  async function exportViewer(mode) {
    if (!project) return;
    const template = buildViewerTemplate();
    if (nativeApi) {
      const payload = { template, project, projectFilePath };
      const result = mode === "folder" ? await nativeApi.exportFolderViewer(payload) : await nativeApi.exportSingleViewer(payload);
      if (result) alert(`导出完成：${result.filePath}`);
      return;
    }
    if (mode === "folder") return;
    const serialized = JSON.stringify(project).replace(/</g, "\\u003c");
    const html = template.replace("__PROJECT_DATA__", () => serialized);
    downloadFile(`${project.name || "地图"}-查看器.html`, html, "text/html;charset=utf-8");
  }

  els.storageSettingsBtn.onclick = async () => {
    try {
      const result = await nativeApi.chooseProjectsRoot();
      if (!result) return;
      applyStorageSettings(result);
      const copiedMessage = result.copiedExistingProjects ? "\n\n已有项目已复制到新位置，原文件仍然保留。" : "";
      alert(`项目存储位置已更改为：\n${result.projectsRoot}${copiedMessage}\n\n当前已打开的项目仍保存在原位置，新项目将保存到新位置。`);
    } catch (error) {
      alert(`更改项目存储位置失败：${error.message}`);
    }
  };
  els.openProjectsDirBtn.onclick = () => nativeApi.openProjectsRoot().catch((error) => alert(`无法打开项目目录：${error.message}`));
  els.newProjectBtn.onclick = () => els.mainImageInput.click();
  els.mainImageInput.onchange = async (event) => {
    try { if (event.target.files[0]) await createProjectFromImage(event.target.files[0]); }
    catch (error) { alert(`新建项目失败：${error.message}`); }
    els.mainImageInput.value = "";
  };
  els.saveProjectBtn.onclick = () => saveProject().catch((error) => alert(`保存失败：${error.message}`));
  els.openProjectBtn.onclick = async () => {
    if (nativeApi) {
      try {
        const result = await nativeApi.openProject();
        if (!result) return;
        project = normalizeProjectStyles(result.project);
        project.icons = { ...clonePresets(), ...(project.icons || {}) };
        applyFileInfo(result);
        assetUrls = result.assetUrls || {};
        currentMapId = project.rootMapId;
        selectedElementId = null;
        setDirty(false);
        render();
        if (result.migrated) alert(`旧项目已迁移到新文件夹：${result.projectDir}\n原项目文件没有被修改。`);
      } catch (error) { alert(`打开项目失败：${error.message}`); }
    } else els.openProjectInput.click();
  };
  els.openProjectInput.onchange = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      project = normalizeBrowserProject(JSON.parse(await readFileAsText(file)));
      currentMapId = project.rootMapId; selectedElementId = null; projectFileName = file.name; projectDir = null;
      setDirty(false); render();
    } catch (error) { alert(`打开项目失败：${error.message}`); }
    els.openProjectInput.value = "";
  };
  els.exportSingleBtn.onclick = () => exportViewer("single").catch((error) => alert(`导出失败：${error.message}`));
  els.exportFolderBtn.onclick = () => exportViewer("folder").catch((error) => alert(`导出失败：${error.message}`));
  els.addInfoBtn.onclick = () => addElement("info");
  els.addSubmapBtn.onclick = () => addElement("submap");
  els.deleteElementBtn.onclick = deleteSelectedElement;
  els.backParentBtn.onclick = () => {
    const map = getCurrentMap();
    if (map?.parentId) { currentMapId = map.parentId; selectedElementId = null; render(); }
  };
  els.mapStage.onclick = () => { selectedElementId = null; render(); };
  els.elementText.oninput = () => updateSelectedElement({ text: els.elementText.value });
  els.elementIconSize.oninput = () => updateSelectedElement({ iconSize: clamp(Number(els.elementIconSize.value) || 22, 12, 64) });
  els.elementIconPlacement.onchange = () => updateSelectedElement({ iconPlacement: els.elementIconPlacement.value });
  els.elementDescription.oninput = () => updateSelectedElement({ description: els.elementDescription.value });
  els.elementStylePreset.onchange = () => {
    const element = getSelectedElement();
    if (!element) return;
    element.textStyle = styleForPreset(els.elementStylePreset.value, normalizeTextStyle(element.textStyle));
    markDirty();
    renderStage();
    renderInspector();
  };
  els.elementShowText.onchange = () => updateSelectedTextStyle({ showText: els.elementShowText.checked });
  els.elementFontSize.oninput = () => updateSelectedTextStyle({ fontSize: clamp(Number(els.elementFontSize.value) || 14, 10, 48) });
  els.elementTextColor.oninput = () => updateSelectedTextStyle({ color: els.elementTextColor.value });
  els.elementTextShadow.onchange = () => updateSelectedTextStyle({ showTextShadow: els.elementTextShadow.checked });
  els.elementShowBackground.onchange = () => updateSelectedTextStyle({ showBackground: els.elementShowBackground.checked });
  els.elementBackgroundColor.oninput = () => updateSelectedTextStyle({ backgroundColor: els.elementBackgroundColor.value });
  els.elementBackgroundOpacity.oninput = () => updateSelectedTextStyle({ backgroundOpacity: clamp(Number(els.elementBackgroundOpacity.value) || 0, 0, 100) });
  els.elementShowBorder.onchange = () => updateSelectedTextStyle({ showBorder: els.elementShowBorder.checked });
  els.elementBorderColor.oninput = () => updateSelectedTextStyle({ borderColor: els.elementBorderColor.value });
  els.elementShowShadow.onchange = () => updateSelectedTextStyle({ showShadow: els.elementShowShadow.checked });
  els.elementShowHoverOutline.onchange = () => updateSelectedTextStyle({ showHoverOutline: els.elementShowHoverOutline.checked });
  els.elementHoverOutlineColor.oninput = () => updateSelectedTextStyle({ hoverOutlineColor: els.elementHoverOutlineColor.value });
  els.elementHoverOutlineOpacity.oninput = () => updateSelectedTextStyle({ hoverOutlineOpacity: clamp(Number(els.elementHoverOutlineOpacity.value) || 0, 0, 100) });
  els.elementHoverOutlineWidth.oninput = () => updateSelectedTextStyle({ hoverOutlineWidth: clamp(Number(els.elementHoverOutlineWidth.value) || 1, 1, 6) });
  els.elementHoverOutlineOffset.oninput = () => updateSelectedTextStyle({ hoverOutlineOffset: clamp(Number(els.elementHoverOutlineOffset.value) || 0, 0, 8) });
  els.elementHoverOutlineStyle.onchange = () => updateSelectedTextStyle({ hoverOutlineStyle: els.elementHoverOutlineStyle.value });
  els.elementKind.onchange = () => convertSelectedKind(els.elementKind.value);
  els.elementX.oninput = () => updateSelectedElement({ x: clamp(Number(els.elementX.value) || 0, 0, getCurrentMap().width) });
  els.elementY.oninput = () => updateSelectedElement({ y: clamp(Number(els.elementY.value) || 0, 0, getCurrentMap().height) });
  els.submapName.oninput = () => {
    const element = getSelectedElement();
    if (element?.targetMapId) { project.maps[element.targetMapId].name = els.submapName.value || "未命名子地图"; markDirty(); renderTree(); }
  };
  els.submapImage.onchange = (event) => replaceSubmapImage(event.target.files[0]).catch((error) => alert(`更换地图失败：${error.message}`));
  els.goSubmapBtn.onclick = () => {
    const element = getSelectedElement();
    if (element?.targetMapId) { currentMapId = element.targetMapId; selectedElementId = null; render(); }
  };
  els.uploadIconBtn.onclick = () => els.iconImageInput.click();
  els.iconImageInput.onchange = (event) => {
    uploadIcon(event.target.files[0]).catch((error) => alert(`上传图标失败：${error.message}`));
    els.iconImageInput.value = "";
  };
  els.deleteIconBtn.onclick = removeCurrentIcon;
  window.onpointermove = onPointerMove;
  window.onpointerup = onPointerUp;
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault(); saveProject().catch((error) => alert(`保存失败：${error.message}`)); return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && getSelectedElement()) {
      const tag = document.activeElement?.tagName;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) deleteSelectedElement();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!nativeApi && isDirty) { event.preventDefault(); event.returnValue = unsavedMessage; }
  });
  loadStorageSettings().catch((error) => alert(`读取项目存储设置失败：${error.message}`));
  render();
})();
