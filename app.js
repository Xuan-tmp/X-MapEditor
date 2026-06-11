(function () {
  const els = {
    projectStatus: document.getElementById("projectStatus"),
    newProjectBtn: document.getElementById("newProjectBtn"),
    saveProjectBtn: document.getElementById("saveProjectBtn"),
    openProjectBtn: document.getElementById("openProjectBtn"),
    exportViewerBtn: document.getElementById("exportViewerBtn"),
    mainImageInput: document.getElementById("mainImageInput"),
    openProjectInput: document.getElementById("openProjectInput"),
    backParentBtn: document.getElementById("backParentBtn"),
    mapTree: document.getElementById("mapTree"),
    currentPath: document.getElementById("currentPath"),
    addInfoBtn: document.getElementById("addInfoBtn"),
    addSubmapBtn: document.getElementById("addSubmapBtn"),
    deleteElementBtn: document.getElementById("deleteElementBtn"),
    emptyState: document.getElementById("emptyState"),
    mapStage: document.getElementById("mapStage"),
    inspectorEmpty: document.getElementById("inspectorEmpty"),
    inspectorForm: document.getElementById("inspectorForm"),
    elementText: document.getElementById("elementText"),
    elementIcon: document.getElementById("elementIcon"),
    elementIconPlacement: document.getElementById("elementIconPlacement"),
    elementDescription: document.getElementById("elementDescription"),
    elementKind: document.getElementById("elementKind"),
    submapControls: document.getElementById("submapControls"),
    submapName: document.getElementById("submapName"),
    submapImage: document.getElementById("submapImage"),
    goSubmapBtn: document.getElementById("goSubmapBtn"),
    elementX: document.getElementById("elementX"),
    elementY: document.getElementById("elementY"),
  };

  let project = null;
  let currentMapId = null;
  let selectedElementId = null;
  let drag = null;
  let tooltip = null;
  let isDirty = false;
  let projectFilePath = null;
  let projectFileName = null;
  let projectsDir = null;

  const nativeApi = window.mapEditorNative || null;
  const unsavedMessage = "还没有保存！确定要离开吗？";

  const makeId = (prefix) =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function readImageMeta(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || 16, height: image.naturalHeight || 9 });
      image.onerror = () => resolve({ width: 16, height: 9 });
      image.src = src;
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

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function setDirty(hasUnsavedChanges) {
    isDirty = hasUnsavedChanges;
    if (nativeApi) nativeApi.setDirty(isDirty);
    renderProjectState();
  }

  function markDirty() {
    if (project) setDirty(true);
  }

  function markClean(fileInfo) {
    if (fileInfo) {
      projectFilePath = fileInfo.filePath || projectFilePath;
      projectFileName = fileInfo.fileName || projectFileName;
      projectsDir = fileInfo.projectsDir || projectsDir;
    }
    setDirty(false);
  }

  function getProjectStatusText() {
    if (!project) return "未创建项目";
    const fileLabel = projectFileName ? ` · ${projectFileName}` : "";
    const dirtyLabel = isDirty ? " · 未保存" : " · 已保存";
    return `${project.name}${fileLabel}${dirtyLabel}`;
  }

  async function saveProject(options = {}) {
    if (!project) return false;
    project.updatedAt = new Date().toISOString();

    if (nativeApi) {
      const fileInfo = await nativeApi.saveProject({
        project,
        filePath: projectFilePath,
        createNewFile: Boolean(options.createNewFile),
      });
      markClean(fileInfo);
      render();
      return true;
    }

    downloadFile(
      `${project.name || "地图项目"}.json`,
      JSON.stringify(project, null, 2),
      "application/json;charset=utf-8"
    );
    markClean();
    render();
    return true;
  }

  function createMap(name, image, parentId, width, height) {
    return {
      id: makeId("map"),
      name,
      image,
      width: width || 16,
      height: height || 9,
      parentId,
      elements: [],
    };
  }

  function createElement(kind) {
    const element = {
      id: makeId("link"),
      kind,
      text: kind === "submap" ? "进入子地图" : "说明",
      icon: kind === "submap" ? "↳" : "i",
      iconPlacement: "left",
      description: kind === "submap" ? "点击进入更详细的地图。" : "这里是一段简要说明。",
      x: 50,
      y: 50,
      targetMapId: null,
    };
    if (kind === "submap") {
      const parentMap = getCurrentMap();
      const childMap = createMap(
        "未命名子地图",
        parentMap.image,
        parentMap.id,
        parentMap.width,
        parentMap.height
      );
      project.maps[childMap.id] = childMap;
      element.targetMapId = childMap.id;
    }
    return element;
  }

  function getCurrentMap() {
    return project && project.maps[currentMapId] ? project.maps[currentMapId] : null;
  }

  function getSelectedElement() {
    const map = getCurrentMap();
    return map ? map.elements.find((item) => item.id === selectedElementId) : null;
  }

  function getMapPath(mapId) {
    const names = [];
    let map = project.maps[mapId];
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
    els.addInfoBtn.disabled = !hasProject;
    els.addSubmapBtn.disabled = !hasProject;
    els.deleteElementBtn.disabled = !getSelectedElement();
    els.exportViewerBtn.disabled = !hasProject;
    els.saveProjectBtn.disabled = !hasProject;
    els.backParentBtn.disabled = !getCurrentMap()?.parentId;
    els.currentPath.textContent = hasProject ? getMapPath(currentMapId) : "请先新建项目";
  }

  function renderTree() {
    els.mapTree.innerHTML = "";
    if (!project) return;
    const root = project.maps[project.rootMapId];
    appendTreeNode(root, 0);
  }

  function appendTreeNode(map, depth) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tree-node${map.id === currentMapId ? " active" : ""}`;
    button.style.paddingLeft = `${12 + depth * 18}px`;
    button.textContent = map.name;
    button.title = getMapPath(map.id);
    button.addEventListener("click", () => {
      currentMapId = map.id;
      selectedElementId = null;
      render();
    });
    els.mapTree.appendChild(button);

    map.elements
      .filter((element) => element.kind === "submap" && project.maps[element.targetMapId])
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
    mapImage.src = map.image;
    mapImage.alt = map.name;
    els.mapStage.appendChild(mapImage);
    map.elements.forEach((element) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `map-link${element.id === selectedElementId ? " selected" : ""}`;
      node.dataset.id = element.id;
      node.dataset.placement = element.iconPlacement;
      node.style.left = `${element.x}%`;
      node.style.top = `${element.y}%`;
      node.innerHTML = `<span class="icon"></span><span class="text"></span>`;
      node.querySelector(".icon").textContent = element.icon || "";
      node.querySelector(".text").textContent = element.text || "未命名";
      node.addEventListener("pointerdown", (event) => startDrag(event, element.id));
      node.addEventListener("click", (event) => {
        event.stopPropagation();
        if (drag?.moved) return;
        selectElement(element.id);
      });
      node.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        if (element.kind === "submap" && element.targetMapId) {
          currentMapId = element.targetMapId;
          selectedElementId = null;
          render();
        }
      });
      node.addEventListener("mouseenter", (event) => showTooltip(event, element.description));
      node.addEventListener("mousemove", moveTooltip);
      node.addEventListener("mouseleave", hideTooltip);
      els.mapStage.appendChild(node);
    });
  }

  function renderInspector() {
    const element = getSelectedElement();
    els.inspectorEmpty.classList.toggle("hidden", Boolean(element));
    els.inspectorForm.classList.toggle("hidden", !element);
    if (!element) return;

    els.elementText.value = element.text;
    els.elementIcon.value = element.icon;
    els.elementIconPlacement.value = element.iconPlacement;
    els.elementDescription.value = element.description;
    els.elementKind.value = element.kind;
    els.elementX.value = element.x.toFixed(1);
    els.elementY.value = element.y.toFixed(1);
    els.submapControls.classList.toggle("hidden", element.kind !== "submap");
    const targetMap = element.targetMapId ? project.maps[element.targetMapId] : null;
    els.submapName.value = targetMap ? targetMap.name : "";
  }

  function selectElement(id) {
    selectedElementId = id;
    render();
  }

  function updateSelectedElement(changes) {
    const element = getSelectedElement();
    if (!element) return;
    Object.assign(element, changes);
    markDirty();
    render();
  }

  function startDrag(event, elementId) {
    if (!project) return;
    hideTooltip();
    event.preventDefault();
    event.stopPropagation();
    selectedElementId = elementId;
    const element = getSelectedElement();
    const rect = els.mapStage.getBoundingClientRect();
    drag = {
      element,
      rect,
      moved: false,
      pointerId: event.pointerId,
      node: event.currentTarget,
    };
    event.currentTarget.classList.add("selected");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag) return;
    const x = clamp(((event.clientX - drag.rect.left) / drag.rect.width) * 100, 0, 100);
    const y = clamp(((event.clientY - drag.rect.top) / drag.rect.height) * 100, 0, 100);
    drag.element.x = Number(x.toFixed(1));
    drag.element.y = Number(y.toFixed(1));
    drag.moved = true;
    drag.node.style.left = `${drag.element.x}%`;
    drag.node.style.top = `${drag.element.y}%`;
    els.elementX.value = drag.element.x.toFixed(1);
    els.elementY.value = drag.element.y.toFixed(1);
  }

  function onPointerUp() {
    if (!drag) return;
    const moved = drag.moved;
    setTimeout(() => {
      drag = null;
    }, 0);
    if (moved) markDirty();
    render();
  }

  function showTooltip(event, text) {
    if (drag) return;
    if (!text) return;
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

  async function createProjectFromImage(file) {
    const image = await readFileAsDataUrl(file);
    const meta = await readImageMeta(image);
    const rootMap = createMap("主地图", image, null, meta.width, meta.height);
    project = {
      version: 1,
      name: file.name.replace(/\.[^.]+$/, "") || "未命名地图项目",
      createdAt: new Date().toISOString(),
      rootMapId: rootMap.id,
      maps: {
        [rootMap.id]: rootMap,
      },
    };
    currentMapId = rootMap.id;
    selectedElementId = null;
    projectFilePath = null;
    projectFileName = null;
    render();
    try {
      await saveProject({ createNewFile: true });
    } catch (error) {
      setDirty(true);
      alert(`项目自动保存失败：${error.message}`);
    }
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

  function deleteSelectedElement() {
    const map = getCurrentMap();
    const element = getSelectedElement();
    if (!map || !element) return;
    if (element.kind === "submap" && element.targetMapId) {
      removeMapAndChildren(element.targetMapId);
    }
    map.elements = map.elements.filter((item) => item.id !== element.id);
    selectedElementId = null;
    markDirty();
    render();
  }

  function removeMapAndChildren(mapId) {
    const map = project.maps[mapId];
    if (!map) return;
    map.elements
      .filter((element) => element.kind === "submap" && element.targetMapId)
      .forEach((element) => removeMapAndChildren(element.targetMapId));
    delete project.maps[mapId];
  }

  function convertSelectedKind(kind) {
    const element = getSelectedElement();
    if (!element || element.kind === kind) return;
    if (kind === "submap") {
      const parentMap = getCurrentMap();
      const childMap = createMap(
        element.text || "未命名子地图",
        parentMap.image,
        currentMapId,
        parentMap.width,
        parentMap.height
      );
      project.maps[childMap.id] = childMap;
      element.targetMapId = childMap.id;
    } else if (element.targetMapId) {
      removeMapAndChildren(element.targetMapId);
      element.targetMapId = null;
    }
    element.kind = kind;
    markDirty();
    render();
  }

  function ensureSubmapImage(file) {
    const element = getSelectedElement();
    if (!element || element.kind !== "submap" || !element.targetMapId || !file) return;
    readFileAsDataUrl(file).then(async (image) => {
      const meta = await readImageMeta(image);
      project.maps[element.targetMapId].image = image;
      project.maps[element.targetMapId].width = meta.width;
      project.maps[element.targetMapId].height = meta.height;
      els.submapImage.value = "";
      markDirty();
      render();
    });
  }

  async function exportViewer() {
    if (!project) return;
    const viewerData = JSON.stringify(project).replace(/</g, "\\u003c");
    const html = buildViewerHtml(viewerData);
    if (nativeApi) {
      await nativeApi.exportViewer({
        html,
        projectName: project.name,
      });
      return;
    }
    downloadFile(`${project.name || "地图"}-查看器.html`, html, "text/html;charset=utf-8");
  }

  function buildViewerHtml(serializedProject) {
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>地图查看器</title>
<style>
:root{--bg:#f4f6f8;--surface:#fff;--line:#d9e0e8;--text:#17202a;--muted:#697586;--accent:#0f766e}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:"Microsoft YaHei","PingFang SC","Segoe UI",Arial,sans-serif}
header{height:60px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--line)}
h1{font-size:18px;margin:0}.path{color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button{min-height:34px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--text);padding:6px 11px;cursor:pointer}
main{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 60px)}
aside{background:var(--surface);border-right:1px solid var(--line);padding:10px;overflow:auto}.tree-node{width:100%;margin-bottom:6px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tree-node.active{border-color:var(--accent);color:var(--accent);background:#ecfdf5}
.wrap{overflow:auto;padding:24px}.stage{position:relative;width:min(100%,960px);aspect-ratio:var(--ratio,16/9);margin:0 auto;border:1px solid var(--line);border-radius:8px;background-color:#eef2f6;box-shadow:0 12px 32px rgba(15,23,42,.12);overflow:hidden}.map-image{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}
.map-link{position:absolute;z-index:2;transform:translate(-50%,-50%);border:1px solid rgba(15,118,110,.55);border-radius:6px;background:rgba(255,255,255,.92);display:inline-flex;align-items:center;gap:6px;max-width:220px;min-width:34px;min-height:28px;padding:5px 8px;box-shadow:0 5px 14px rgba(15,23,42,.14);cursor:pointer}.map-link[data-placement="bottom"]{flex-direction:column-reverse;gap:2px}.icon{font-size:18px;line-height:1}.text{overflow-wrap:anywhere;line-height:1.2;font-size:14px}
.tooltip{position:fixed;z-index:20;max-width:260px;padding:8px 10px;border-radius:6px;background:#17202a;color:#fff;font-size:13px;line-height:1.45;box-shadow:0 12px 32px rgba(15,23,42,.12);pointer-events:none}
@media(max-width:760px){header{height:auto;align-items:flex-start;flex-direction:column}main{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line)}}
</style>
</head>
<body>
<header><div><h1 id="title"></h1><div id="path" class="path"></div></div><button id="backBtn">返回上级</button></header>
<main><aside id="tree"></aside><section class="wrap"><div id="stage" class="stage"></div></section></main>
<script>
const project=${serializedProject};
let currentMapId=project.rootMapId;
let tooltip=null;
const title=document.getElementById("title"),path=document.getElementById("path"),tree=document.getElementById("tree"),stage=document.getElementById("stage"),backBtn=document.getElementById("backBtn");
function getPath(id){const names=[];let map=project.maps[id];while(map){names.unshift(map.name);map=map.parentId?project.maps[map.parentId]:null}return names.join(" / ")}
function render(){hideTip();const map=project.maps[currentMapId];title.textContent=project.name||"地图查看器";path.textContent=getPath(currentMapId);backBtn.disabled=!map.parentId;stage.style.setProperty("--ratio",(map.width||16)+" / "+(map.height||9));stage.innerHTML="";const image=document.createElement("img");image.className="map-image";image.src=map.image;image.alt=map.name;stage.appendChild(image);map.elements.forEach(el=>{const node=document.createElement("button");node.type="button";node.className="map-link";node.dataset.placement=el.iconPlacement;node.style.left=el.x+"%";node.style.top=el.y+"%";node.innerHTML='<span class="icon"></span><span class="text"></span>';node.querySelector(".icon").textContent=el.icon||"";node.querySelector(".text").textContent=el.text||"未命名";node.addEventListener("click",()=>{if(el.kind==="submap"&&el.targetMapId&&project.maps[el.targetMapId]){hideTip();currentMapId=el.targetMapId;render()}});node.addEventListener("mouseenter",e=>showTip(e,el.description));node.addEventListener("mousemove",moveTip);node.addEventListener("mouseleave",hideTip);stage.appendChild(node)});renderTree()}
function renderTree(){tree.innerHTML="";appendTree(project.maps[project.rootMapId],0)}
function appendTree(map,depth){const btn=document.createElement("button");btn.type="button";btn.className="tree-node"+(map.id===currentMapId?" active":"");btn.style.paddingLeft=(12+depth*18)+"px";btn.textContent=map.name;btn.title=getPath(map.id);btn.onclick=()=>{currentMapId=map.id;render()};tree.appendChild(btn);map.elements.filter(el=>el.kind==="submap"&&project.maps[el.targetMapId]).forEach(el=>appendTree(project.maps[el.targetMapId],depth+1))}
function showTip(e,text){if(!text)return;hideTip();tooltip=document.createElement("div");tooltip.className="tooltip";tooltip.textContent=text;document.body.appendChild(tooltip);moveTip(e)}
function moveTip(e){if(!tooltip)return;tooltip.style.left=e.clientX+12+"px";tooltip.style.top=e.clientY+12+"px"}
function hideTip(){if(tooltip)tooltip.remove();tooltip=null}
backBtn.onclick=()=>{const map=project.maps[currentMapId];if(map.parentId){hideTip();currentMapId=map.parentId;render()}};
render();
</script>
</body>
</html>`;
  }

  els.newProjectBtn.addEventListener("click", () => els.mainImageInput.click());
  els.mainImageInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) createProjectFromImage(file);
    els.mainImageInput.value = "";
  });

  els.saveProjectBtn.addEventListener("click", async () => {
    try {
      await saveProject();
    } catch (error) {
      alert(`保存失败：${error.message}`);
    }
  });

  els.openProjectBtn.addEventListener("click", async () => {
    if (nativeApi) {
      try {
        const result = await nativeApi.openProject();
        if (!result) return;
        if (!result.project?.rootMapId || !result.project?.maps) {
          alert("项目文件格式不正确。");
          return;
        }
        project = result.project;
        projectFilePath = result.filePath;
        projectFileName = result.fileName;
        projectsDir = result.projectsDir || projectsDir;
        currentMapId = project.rootMapId;
        selectedElementId = null;
        markClean(result);
        render();
      } catch (error) {
        alert(`打开项目失败：${error.message}`);
      }
      return;
    }

    els.openProjectInput.click();
  });
  els.openProjectInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const data = JSON.parse(await readFileAsText(file));
    if (!data.rootMapId || !data.maps) {
      alert("项目文件格式不正确。");
      return;
    }
    project = data;
    projectFilePath = null;
    projectFileName = file.name;
    currentMapId = project.rootMapId;
    selectedElementId = null;
    els.openProjectInput.value = "";
    markClean();
    render();
  });

  els.exportViewerBtn.addEventListener("click", () => {
    exportViewer().catch((error) => alert(`导出失败：${error.message}`));
  });
  els.addInfoBtn.addEventListener("click", () => addElement("info"));
  els.addSubmapBtn.addEventListener("click", () => addElement("submap"));
  els.deleteElementBtn.addEventListener("click", deleteSelectedElement);
  els.backParentBtn.addEventListener("click", () => {
    const map = getCurrentMap();
    if (map?.parentId) {
      currentMapId = map.parentId;
      selectedElementId = null;
      render();
    }
  });

  els.mapStage.addEventListener("click", () => {
    selectedElementId = null;
    render();
  });

  els.elementText.addEventListener("input", () => updateSelectedElement({ text: els.elementText.value }));
  els.elementIcon.addEventListener("input", () => updateSelectedElement({ icon: els.elementIcon.value }));
  els.elementIconPlacement.addEventListener("change", () =>
    updateSelectedElement({ iconPlacement: els.elementIconPlacement.value })
  );
  els.elementDescription.addEventListener("input", () =>
    updateSelectedElement({ description: els.elementDescription.value })
  );
  els.elementKind.addEventListener("change", () => convertSelectedKind(els.elementKind.value));
  els.elementX.addEventListener("input", () =>
    updateSelectedElement({ x: clamp(Number(els.elementX.value) || 0, 0, 100) })
  );
  els.elementY.addEventListener("input", () =>
    updateSelectedElement({ y: clamp(Number(els.elementY.value) || 0, 0, 100) })
  );
  els.submapName.addEventListener("input", () => {
    const element = getSelectedElement();
    if (element?.targetMapId) {
      project.maps[element.targetMapId].name = els.submapName.value || "未命名子地图";
      markDirty();
      renderProjectState();
      renderTree();
    }
  });
  els.submapImage.addEventListener("change", (event) => ensureSubmapImage(event.target.files[0]));
  els.goSubmapBtn.addEventListener("click", () => {
    const element = getSelectedElement();
    if (element?.targetMapId) {
      currentMapId = element.targetMapId;
      selectedElementId = null;
      render();
    }
  });

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveProject().catch((error) => alert(`保存失败：${error.message}`));
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && getSelectedElement()) {
      const activeTag = document.activeElement?.tagName;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) deleteSelectedElement();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (nativeApi) return;
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = unsavedMessage;
  });

  render();
})();
