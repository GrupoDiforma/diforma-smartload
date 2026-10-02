// ==========================================
// RENDERIZADO Y ESCENA THREE.JS CON MULTI-SELECCIÓN (CTRL+CLIC) Y BLOQUEO LIMPIO
// ==========================================

let globalMats = null; 
let solidMaterialsCache = {}; 
let selectedMaterialsCache = {};

function initGlobalMats() {
    if (globalMats) return;
    globalMats = {
        contFill: new THREE.MeshBasicMaterial({color: 0x99b4d1, transparent: true, opacity: 0.15, side: THREE.DoubleSide}),
        contEdge: new THREE.LineBasicMaterial({color: 0x6688aa, linewidth: 2}),
        contFillSel: new THREE.MeshBasicMaterial({color: 0x0067c0, transparent: true, opacity: 0.25, side: THREE.DoubleSide}),
        contEdgeSel: new THREE.LineBasicMaterial({color: 0x0067c0, linewidth: 3}),
        boxEdge: new THREE.LineBasicMaterial({color: 0x333333, linewidth: 1}), 
        boxEdgeSel: new THREE.LineBasicMaterial({color: 0x0067c0, linewidth: 2.5}),
        boxEdgeLocked: new THREE.LineBasicMaterial({color: 0xd13438, linewidth: 2.5})
    };
}

function getSolidMaterial(colorHex) { 
    if(!solidMaterialsCache[colorHex]) solidMaterialsCache[colorHex] = new THREE.MeshLambertMaterial({ color: colorHex }); 
    return solidMaterialsCache[colorHex]; 
}

function getSelectedMaterial(baseColorHex) {
    if(!selectedMaterialsCache[baseColorHex]) {
        const c = new THREE.Color(baseColorHex);
        selectedMaterialsCache[baseColorHex] = new THREE.MeshLambertMaterial({ 
            color: c,
            emissive: new THREE.Color(0x112244),
            emissiveIntensity: 0.35
        });
    } 
    return selectedMaterialsCache[baseColorHex];
}

let scene, camera, renderer, controls, transformControls, mainGroup; 
let miniScene, miniCamera, miniRenderer, miniGroup;
let raycaster = new THREE.Raycaster(); 
let mouse = new THREE.Vector2(); 
let objectsInteractables = []; 
let is3DInitialized = false;

// Conjunto para selección múltiple
let selectedUUIDsSet = new Set();

function init3D() {
    if(is3DInitialized) return; 
    initGlobalMats();
    const containerDiv = document.getElementById('canvas-container'); 
    scene = new THREE.Scene(); 
    camera = new THREE.PerspectiveCamera(45, containerDiv.clientWidth / containerDiv.clientHeight, 1, 30000);
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true}); 
    renderer.setSize(containerDiv.clientWidth, containerDiv.clientHeight); 
    containerDiv.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement); 
    controls.enableDamping = true; 
    
    // GIZMO DE TRANSFORMACIÓN Y MOVIMIENTO MANUAL
    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.setTranslationSnap(1); 
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
    });

    transformControls.addEventListener('change', function () {
        if (transformControls.object) {
            const activeMesh = transformControls.object;
            const uuid = activeMesh.userData.uuid;
            const inst = instanciasCajas.find(i => i.uuid === uuid);
            if (inst) {
                const offsetX = activeMesh.userData.offsetX || 0;
                inst.x = Math.round(activeMesh.position.x - inst.drawW / 2 - offsetX);
                inst.y = Math.round(activeMesh.position.y - inst.drawH / 2);
                inst.z = Math.round(activeMesh.position.z - inst.drawD / 2);
                inst.locked = true;
                
                actualizarMetricasGlobales();
                actualizarTabla();
            }
        }
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.8)); 
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5); 
    dirLight.position.set(5000, 10000, 5000); 
    scene.add(dirLight);
    
    mainGroup = new THREE.Group(); 
    scene.add(mainGroup);
    
    let pointerDownPos = {x: 0, y: 0}; 
    containerDiv.addEventListener('pointerdown', e => { pointerDownPos.x = e.clientX; pointerDownPos.y = e.clientY; });
    containerDiv.addEventListener('pointerup', e => { 
        if(Math.abs(e.clientX - pointerDownPos.x) > 5 || Math.abs(e.clientY - pointerDownPos.y) > 5) return; 
        onMouseClick(e); 
    });
    
    const resizeObserver = new ResizeObserver(() => {
        if (renderer && camera && containerDiv) {
            const width = containerDiv.clientWidth;
            const height = containerDiv.clientHeight;
            if (width > 0 && height > 0) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            }
        }
    });
    resizeObserver.observe(containerDiv);

    function animate() { 
        requestAnimationFrame(animate); 
        controls.update(); 
        renderer.render(scene, camera); 
    } 
    animate(); 
    is3DInitialized = true;
}

function construirEscena3D() {
    init3D(); 
    if(transformControls) transformControls.detach();
    while(mainGroup.children.length > 0) { 
        let obj = mainGroup.children[0]; 
        if(obj.geometry) obj.geometry.dispose(); 
        mainGroup.remove(obj); 
    } 
    objectsInteractables = [];
    
    const gapX = 150; 
    let totalWidth = 0; 
    let maxH = 250, maxD = 1200; 
    contenedoresFisicos.forEach(c => { 
        totalWidth += c.w + gapX; 
        if(c.h > maxH) maxH = c.h; 
        if(c.d > maxD) maxD = c.d; 
    });
    
    let centerX = -(totalWidth - gapX) / 2; 
    camera.position.set(centerX + maxD * 0.9, maxH * 2.2, maxD * 1.2); 
    controls.target.set(centerX, maxH / 2, maxD / 2);
    controls.update();

    let currentOffsetX = 0;
    contenedoresFisicos.forEach((contenedor, idx) => {
        const contGeo = new THREE.BoxGeometry(contenedor.w, contenedor.h, contenedor.d); 
        contGeo.translate((contenedor.w/2) + currentOffsetX, contenedor.h/2, contenedor.d/2);
        
        const boxMesh = new THREE.Mesh(contGeo, globalMats.contFill); 
        boxMesh.userData = { isContainer: true, contIdx: idx }; 
        mainGroup.add(boxMesh);
        
        const edgeMesh = new THREE.LineSegments(new THREE.EdgesGeometry(contGeo), globalMats.contEdge); 
        edgeMesh.userData = { isContainerEdge: true, contIdx: idx }; 
        mainGroup.add(edgeMesh);
        
        if(contenedor.cajas) {
            contenedor.cajas.forEach(caja => {
                let geo;
                if (caja.shape === 'barrel') { 
                    let isUpright = (caja.drawH === caja.h); 
                    let isXAligned = (caja.drawW === caja.h); 
                    if (isUpright) { 
                        let r = Math.min(caja.drawW, caja.drawD) / 2 - 0.5; 
                        geo = new THREE.CylinderGeometry(r, r, caja.drawH - 1, 32); 
                    } else if (isXAligned) { 
                        let r = Math.min(caja.drawH, caja.drawD) / 2 - 0.5; 
                        geo = new THREE.CylinderGeometry(r, r, caja.drawW - 1, 32); 
                        geo.rotateZ(Math.PI / 2); 
                    } else { 
                        let r = Math.min(caja.drawW, caja.drawH) / 2 - 0.5; 
                        geo = new THREE.CylinderGeometry(r, r, caja.drawD - 1, 32); 
                        geo.rotateX(Math.PI / 2); 
                    } 
                } 
                else if (caja.shape === 'pallet') {
                    let palletH = 15; 
                    let loadH = caja.drawH - palletH; 
                    if (loadH < 1) loadH = 1; 
                    let holesOnDrawW = !(caja.drawW === caja.d && caja.drawD === caja.w && caja.w !== caja.d);
                    
                    let deckGeo = new THREE.BoxGeometry(caja.drawW - 1, 3, caja.drawD - 1); 
                    deckGeo.translate(caja.x + caja.drawW/2 + currentOffsetX, caja.y + 13.5, caja.z + caja.drawD/2); 
                    mainGroup.add(new THREE.Mesh(deckGeo, getSolidMaterial('#8B5A2B'))); 
                    mainGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo), globalMats.boxEdge));
                    
                    let sw = holesOnDrawW ? Math.min(12, caja.drawW * 0.15) : (caja.drawW - 1); 
                    let sd = holesOnDrawW ? (caja.drawD - 1) : Math.min(12, caja.drawD * 0.15);
                    
                    for(let i=0; i<3; i++) { 
                        let sGeo = new THREE.BoxGeometry(sw, 12, sd); 
                        let px = caja.drawW / 2; 
                        let pz = caja.drawD / 2; 
                        if (holesOnDrawW) { if(i===0) px = 0.5 + sw/2; if(i===2) px = caja.drawW - 0.5 - sw/2; } 
                        else { if(i===0) pz = 0.5 + sd/2; if(i===2) pz = caja.drawD - 0.5 - sd/2; } 
                        sGeo.translate(caja.x + px + currentOffsetX, caja.y + 6, caja.z + pz); 
                        mainGroup.add(new THREE.Mesh(sGeo, getSolidMaterial('#8B5A2B'))); 
                        mainGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(sGeo), globalMats.boxEdge)); 
                    }
                    
                    geo = new THREE.BoxGeometry(caja.drawW - 1, loadH - 0.5, caja.drawD - 1); 
                } else { 
                    geo = new THREE.BoxGeometry(caja.drawW - 1, caja.drawH - 1, caja.drawD - 1); 
                }
                
                const mesh = new THREE.Mesh(geo, getSolidMaterial(caja.color)); 
                mesh.position.set(caja.x + caja.drawW/2 + currentOffsetX, caja.y + caja.drawH/2, caja.z + caja.drawD/2);
                mesh.userData = { uuid: caja.uuid, groupId: caja.groupId, color: caja.color, locked: caja.locked, offsetX: currentOffsetX }; 
                mainGroup.add(mesh); 
                objectsInteractables.push(mesh); 
                
                const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), globalMats.boxEdge); 
                edges.position.copy(mesh.position);
                edges.userData = { isEdge: true, parentUUID: caja.uuid }; 
                mainGroup.add(edges);
            });
        } 
        currentOffsetX -= (contenedor.w + gapX); 
    }); 
    actualizarRenderCajas();
}

function actualizarRenderCajas() {
    const selectedIdx = document.getElementById('view-cont-select').value;
    let primarySelectedMesh = null;

    mainGroup.children.forEach(obj => {
        if(obj.userData.uuid) { 
            let isSelected = selectedUUIDsSet.has(obj.userData.uuid) || (selectedGroupId && String(obj.userData.groupId) === String(selectedGroupId)); 
            
            if (isSelected) {
                obj.material = getSelectedMaterial(obj.userData.color);
                if (!primarySelectedMesh) primarySelectedMesh = obj;
            } else {
                obj.material = getSolidMaterial(obj.userData.color);
            }
        }
        if(obj.userData.isEdge) { 
            let inst = instanciasCajas.find(i => i.uuid === obj.userData.parentUUID);
            let isSelected = selectedUUIDsSet.has(obj.userData.parentUUID) || (selectedGroupId && String(inst?.groupId) === String(selectedGroupId)); 
            let isLocked = inst ? inst.locked : false;

            if (isSelected) {
                obj.material = globalMats.boxEdgeSel;
            } else if (isLocked) {
                obj.material = globalMats.boxEdgeLocked;
            } else {
                obj.material = globalMats.boxEdge;
            }
        }
        if(obj.userData.isContainer) { 
            obj.material = (obj.userData.contIdx == selectedIdx && selectedIdx !== "") ? globalMats.contFillSel : globalMats.contFill; 
        }
        if(obj.userData.isContainerEdge) { 
            obj.material = (obj.userData.contIdx == selectedIdx && selectedIdx !== "") ? globalMats.contEdgeSel : globalMats.contEdge; 
        }
    });

    if (primarySelectedMesh && transformControls) {
        transformControls.attach(primarySelectedMesh);
    } else if (transformControls) {
        transformControls.detach();
    }
}

function onMouseClick(event) {
    const containerDiv = document.getElementById('canvas-container'); 
    const rect = containerDiv.getBoundingClientRect(); 
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; 
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; 
    
    raycaster.setFromCamera(mouse, camera); 
    const intersects = raycaster.intersectObjects(objectsInteractables);
    
    const isMultiSelect = event.ctrlKey || event.metaKey;

    if (intersects.length > 0) { 
        let clickedUUID = intersects[0].object.userData.uuid; 

        if (isMultiSelect) {
            if (selectedUUIDsSet.has(clickedUUID)) {
                selectedUUIDsSet.delete(clickedUUID);
            } else {
                selectedUUIDsSet.add(clickedUUID);
            }
            selectedGroupId = null;
        } else {
            if (selectedUUIDsSet.has(clickedUUID) && selectedUUIDsSet.size === 1) {
                selectedUUIDsSet.clear();
            } else {
                selectedUUIDsSet.clear();
                selectedUUIDsSet.add(clickedUUID);
            }
            selectedGroupId = null;
        }
    } else { 
        if (!isMultiSelect) {
            selectedUUIDsSet.clear();
            selectedGroupId = null;
        }
    } 
    actualizarTabla(); 
    actualizarRenderCajas(); 
}

function initMini3D() {
    if(miniRenderer) return; 
    initGlobalMats();
    const container = document.getElementById('mini-3d-preview'); 
    miniScene = new THREE.Scene(); 
    miniCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 1000); 
    miniCamera.position.set(150, 150, 200); 
    miniCamera.lookAt(0, 0, 0);
    
    miniRenderer = new THREE.WebGLRenderer({antialias: true, alpha: true}); 
    miniRenderer.setSize(container.clientWidth, container.clientHeight); 
    container.appendChild(miniRenderer.domElement);
    
    miniScene.add(new THREE.AmbientLight(0xffffff, 0.7)); 
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); 
    dirLight.position.set(100, 200, 100); 
    miniScene.add(dirLight);
    
    miniGroup = new THREE.Group(); 
    miniScene.add(miniGroup);
    
    function animateMini() { 
        if (document.getElementById('modal-box').style.display === 'block') { 
            if(miniGroup) miniGroup.rotation.y -= 0.015; 
            miniRenderer.render(miniScene, miniCamera); 
        } 
        requestAnimationFrame(animateMini); 
    } 
    animateMini();
}

function updateMini3D() {
    if(!miniRenderer) initMini3D(); 
    while(miniGroup.children.length > 0) { 
        let child = miniGroup.children[0]; 
        if(child.geometry) child.geometry.dispose(); 
        miniGroup.remove(child); 
    }
    
    let shape = document.getElementById('m-shape').value; 
    let w = parseFloat(document.getElementById('m-w').value) || 10; 
    let d = parseFloat(document.getElementById('m-d').value) || 10; 
    let h = parseFloat(document.getElementById('m-h').value) || 10;
    
    let mat = getSolidMaterial(document.getElementById('m-color').value); 
    let edgeMat = globalMats.boxEdge; 
    if(w < 1) w = 1; if(d < 1) d = 1; if(h < 1) h = 1;
    
    if (shape === 'barrel') {
        let r = Math.min(w, d) / 2; 
        let geo = new THREE.CylinderGeometry(r, r, h, 32); 
        miniGroup.add(new THREE.Mesh(geo, mat)); 
        miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    } else if (shape === 'pallet') {
        let palletH = Math.min(15, h * 0.2); 
        let loadH = h - palletH; 
        if(loadH<1) loadH=1; 
        
        let deckGeo = new THREE.BoxGeometry(w, 3, d); 
        deckGeo.translate(0, -h/2 + palletH - 1.5, 0); 
        miniGroup.add(new THREE.Mesh(deckGeo, getSolidMaterial('#8B5A2B'))); 
        miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo), edgeMat));
        
        let sw = Math.min(12, w * 0.15); 
        let sh = palletH - 3;
        for(let i=0; i<3; i++) { 
            let sGeo = new THREE.BoxGeometry(sw, sh, d); 
            let px = -w/2 + sw/2; 
            if(i===1) px = 0; 
            if(i===2) px = w/2 - sw/2; 
            sGeo.translate(px, -h/2 + sh/2, 0); 
            miniGroup.add(new THREE.Mesh(sGeo, getSolidMaterial('#8B5A2B'))); 
            miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(sGeo), edgeMat)); 
        }
        
        let loadGeo = new THREE.BoxGeometry(w, loadH, d); 
        loadGeo.translate(0, -h/2 + palletH + loadH/2, 0); 
        miniGroup.add(new THREE.Mesh(loadGeo, mat)); 
        miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(loadGeo), edgeMat));
    } else { 
        let geo = new THREE.BoxGeometry(w, h, d); 
        miniGroup.add(new THREE.Mesh(geo, mat)); 
        miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat)); 
    }
    
    let maxDim = Math.max(w, d, h); 
    let scale = 110 / maxDim; 
    miniGroup.scale.set(scale, scale, scale);
}
