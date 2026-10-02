// ==========================================
// RENDERIZADO Y ESCENA THREE.JS CON VISTAS RÁPIDAS
// ==========================================

let globalMats = null; 
let solidMaterialsCache = {}; 
let selectedMaterialsCache = {};
let lockedMaterialsCache = {};

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

function getLockedMaterial(baseColorHex) {
    if(!lockedMaterialsCache[baseColorHex]) {
        const canvas = document.createElement('canvas'); 
        canvas.width = 128; 
        canvas.height = 128; 
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = baseColorHex; 
        ctx.fillRect(0, 0, 128, 128); 
        
        ctx.lineWidth = 16; 
        ctx.strokeStyle = 'rgba(209, 52, 56, 0.75)'; 
        ctx.beginPath(); 
        for(let i = -128; i < 256; i += 32) { 
            ctx.moveTo(i, 0); 
            ctx.lineTo(i + 128, 128); 
        } 
        ctx.stroke();

        ctx.fillStyle = 'rgba(209, 52, 56, 0.15)';
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas); 
        tex.wrapS = THREE.RepeatWrapping; 
        tex.wrapT = THREE.RepeatWrapping;
        lockedMaterialsCache[baseColorHex] = new THREE.MeshLambertMaterial({ map: tex });
    } 
    return lockedMaterialsCache[baseColorHex];
}

let scene, camera, renderer, controls, transformControls, mainGroup; 
let miniScene, miniCamera, miniRenderer, miniGroup;
let raycaster = new THREE.Raycaster(); 
let mouse = new THREE.Vector2(); 
let objectsInteractables = []; 
let is3DInitialized = false;

let selectedUUIDsSet = new Set();
let currentSceneBounds = { centerX: 0, maxH: 250, maxD: 1200 };

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
    
    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.setTranslationSnap(1); 
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
    });

    transformControls.addEventListener('change', function () {
        if (transformControls.object) {
            const activeGroup = transformControls.object;
            const uuid = activeGroup.userData.uuid;
            const inst = instanciasCajas.find(i => i.uuid === uuid);
            if (inst) {
                const offsetX = activeGroup.userData.offsetX || 0;
                inst.x = Math.round(activeGroup.position.x - inst.drawW / 2 - offsetX);
                inst.y = Math.round(activeGroup.position.y - inst.drawH / 2);
                inst.z = Math.round(activeGroup.position.z - inst.drawD / 2);
                
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
    currentSceneBounds = { centerX, maxH, maxD };

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
                let cajaGroup = new THREE.Group();
                cajaGroup.position.set(caja.x + caja.drawW/2 + currentOffsetX, caja.y + caja.drawH/2, caja.z + caja.drawD/2);

                if (caja.shape === 'barrel') { 
                    let isUpright = (caja.drawH === caja.h); 
                    let isXAligned = (caja.drawW === caja.h); 
                    let geo;
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
                    let mesh = new THREE.Mesh(geo, getSolidMaterial(caja.color));
                    mesh.userData = { isLoadBox: true };
                    cajaGroup.add(mesh);
                    let edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), globalMats.boxEdge);
                    edge.userData = { isLoadEdge: true };
                    cajaGroup.add(edge);
                } 
                else if (caja.shape === 'pallet') {
                    let palletH = 15; 
                    let loadH = caja.drawH - palletH; 
                    if (loadH < 1) loadH = 1; 
                    
                    let deckThick = 2.0;
                    let topStrH = 2.0;
                    let notchH = 9.0;
                    let botThick = 2.0;
                    let strThick = 8.0; // Espesor de tirantes ajustado a 8 cm
                    
                    // 1. CUBIERTA SUPERIOR (DECK)
                    let deckGeo = new THREE.BoxGeometry(caja.drawW - 1, deckThick, caja.drawD - 1); 
                    deckGeo.translate(0, -caja.drawH/2 + 14, 0); 
                    cajaGroup.add(new THREE.Mesh(deckGeo, getSolidMaterial('#8B5A2B'))); 
                    cajaGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo), globalMats.boxEdge));
                    
                    // 2. ESTRUCTURA INFERIOR NOTCHED STRINGER (TIRANTES ROBUSTOS DE 8CM)
                    let isLongerOnW = (caja.drawW >= caja.drawD);
                    let bLen = Math.min(20, (isLongerOnW ? caja.drawW : caja.drawD) * 0.18);

                    if (isLongerOnW) {
                        for (let i = 0; i < 3; i++) {
                            let pz = 0;
                            if (i === 0) pz = -caja.drawD/2 + strThick/2 + 0.5;
                            if (i === 2) pz = caja.drawD/2 - strThick/2 - 0.5;

                            // Tira superior del tirante (8cm ancho x 2cm alto)
                            let topStrGeo = new THREE.BoxGeometry(caja.drawW - 1, topStrH, strThick);
                            topStrGeo.translate(0, -caja.drawH/2 + 12, pz);
                            cajaGroup.add(new THREE.Mesh(topStrGeo, getSolidMaterial('#8B5A2B')));
                            cajaGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(topStrGeo), globalMats.boxEdge));

                            // 3 Tacos inferiores para muescas (8cm ancho x 9cm alto)
                            for (let j = 0; j < 3; j++) {
                                let px = 0;
                                if (j === 0) px = -caja.drawW/2 + bLen/2 + 0.5;
                                if (j === 2) px = caja.drawW/2 - bLen/2 - 0.5;

                                let blockGeo = new THREE.BoxGeometry(bLen, notchH, strThick);
                                blockGeo.translate(px, -caja.drawH/2 + 6.5, pz);
                                cajaGroup.add(new THREE.Mesh(blockGeo, getSolidMaterial('#8B5A2B')));
                                cajaGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), globalMats.boxEdge));
                            }

                            // Tabla base inferior continua (8cm ancho x 2cm alto)
                            let botGeo = new THREE.BoxGeometry(caja.drawW - 1, botThick, strThick);
                            botGeo.translate(0, -caja.drawH/2 + 1, pz);
                            cajaGroup.add(new THREE.Mesh(botGeo, getSolidMaterial('#8B5A2B')));
                            cajaGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeo), globalMats.boxEdge));
                        }
                    } else {
                        for (let i = 0; i < 3; i++) {
                            let px = 0;
                            if (i === 0) px = -caja.drawW/2 + strThick/2 + 0.5;
                            if (i === 2) px = caja.drawW/2 - strThick/2 - 0.5;

                            // Tira superior del tirante (8cm ancho x 2cm alto)
                            let topStrGeo = new THREE.BoxGeometry(strThick, topStrH, caja.drawD - 1);
                            topStrGeo.translate(px, -caja.drawH/2 + 12, 0);
                            cajaGroup.add(new THREE.Mesh(topStrGeo, getSolidMaterial('#8B5A2B')));
                            cajaGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(topStrGeo), globalMats.boxEdge));

                            // 3 Tacos inferiores para muescas (8cm ancho x 9cm alto)
                            for (let j = 0; j < 3; j++) {
                                let pz = 0;
                                if (j === 0) pz = -caja.drawD/2 + bLen/2 + 0.5;
                                if (j === 2) pz = caja.drawD/2 - bLen/2 - 0.5;

                                let blockGeo = new THREE.BoxGeometry(strThick, notchH, bLen);
                                blockGeo.translate(px, -caja.drawH/2 + 6.5, pz);
                                cajaGroup.add(new THREE.Mesh(blockGeo, getSolidMaterial('#8B5A2B')));
                                cajaGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), globalMats.boxEdge));
                            }

                            // Tabla base inferior continua (8cm ancho x 2cm alto)
                            let botGeo = new THREE.BoxGeometry(strThick, botThick, caja.drawD - 1);
                            botGeo.translate(px, -caja.drawH/2 + 1, 0);
                            cajaGroup.add(new THREE.Mesh(botGeo, getSolidMaterial('#8B5A2B')));
                            cajaGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeo), globalMats.boxEdge));
                        }
                    }
                    
                    // 3. CARGA SOBRE LA ESTIBA
                    let loadGeo = new THREE.BoxGeometry(caja.drawW - 1, loadH - 0.5, caja.drawD - 1); 
                    loadGeo.translate(0, -caja.drawH/2 + palletH + loadH/2, 0);
                    let loadMesh = new THREE.Mesh(loadGeo, getSolidMaterial(caja.color));
                    loadMesh.userData = { isLoadBox: true };
                    cajaGroup.add(loadMesh);
                    let loadEdge = new THREE.LineSegments(new THREE.EdgesGeometry(loadGeo), globalMats.boxEdge);
                    loadEdge.userData = { isLoadEdge: true };
                    cajaGroup.add(loadEdge);
                } else { 
                    let geo = new THREE.BoxGeometry(caja.drawW - 1, caja.drawH - 1, caja.drawD - 1); 
                    let mesh = new THREE.Mesh(geo, getSolidMaterial(caja.color));
                    mesh.userData = { isLoadBox: true };
                    cajaGroup.add(mesh);
                    let edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), globalMats.boxEdge);
                    edge.userData = { isLoadEdge: true };
                    cajaGroup.add(edge);
                }
                
                cajaGroup.userData = { uuid: caja.uuid, groupId: caja.groupId, color: caja.color, locked: caja.locked, offsetX: currentOffsetX, isCajaGroup: true }; 
                mainGroup.add(cajaGroup); 
                objectsInteractables.push(cajaGroup); 
            });
        } 
        currentOffsetX -= (contenedor.w + gapX); 
    }); 
    actualizarRenderCajas();
}

function setCameraView(view) {
    if (!camera || !controls) return;
    const { centerX, maxH, maxD } = currentSceneBounds;
    const targetY = maxH / 2;
    const targetZ = maxD / 2;
    
    controls.target.set(centerX, targetY, targetZ);

    switch(view) {
        case 'top':
            camera.position.set(centerX, maxH + maxD * 1.4, targetZ + 0.1);
            break;
        case 'front':
            camera.position.set(centerX, targetY, maxD + maxD * 1.1);
            break;
        case 'left':
            camera.position.set(centerX - maxD * 1.4, targetY, targetZ);
            break;
        case 'right':
            camera.position.set(centerX + maxD * 1.4, targetY, targetZ);
            break;
        case 'iso':
        default:
            camera.position.set(centerX + maxD * 0.9, maxH * 2.2, maxD * 1.2);
            break;
    }
    controls.update();
}

function actualizarRenderCajas() {
    const selectedIdx = document.getElementById('view-cont-select').value;
    let primarySelectedMesh = null;

    mainGroup.children.forEach(obj => {
        if(obj.userData.isCajaGroup) { 
            let uuid = obj.userData.uuid;
            let inst = instanciasCajas.find(i => i.uuid === uuid);
            let isSelected = selectedUUIDsSet.has(uuid) || (selectedGroupId && String(obj.userData.groupId) === String(selectedGroupId)); 
            let isLocked = inst ? inst.locked : false;

            obj.children.forEach(child => {
                if (child.userData.isLoadBox) {
                    if (isLocked) {
                        child.material = getLockedMaterial(obj.userData.color);
                    } else if (isSelected) {
                        child.material = getSelectedMaterial(obj.userData.color);
                    } else {
                        child.material = getSolidMaterial(obj.userData.color);
                    }
                }
                if (child.userData.isLoadEdge) {
                    if (isSelected) {
                        child.material = globalMats.boxEdgeSel;
                    } else if (isLocked) {
                        child.material = globalMats.boxEdgeLocked;
                    } else {
                        child.material = globalMats.boxEdge;
                    }
                }
            });

            if (isSelected && !primarySelectedMesh) {
                primarySelectedMesh = obj;
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
    const intersects = raycaster.intersectObjects(objectsInteractables, true);
    
    const isMultiSelect = event.ctrlKey || event.metaKey;

    if (intersects.length > 0) { 
        let topGroup = intersects[0].object;
        while (topGroup.parent && topGroup.parent !== mainGroup) {
            topGroup = topGroup.parent;
        }
        let clickedUUID = topGroup.userData.uuid; 

        if (clickedUUID) {
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
        
        let deckThick = 2.0;
        let topStrH = 2.0;
        let notchH = 9.0;
        let botThick = 2.0;
        let strThick = 8.0;
        
        let deckGeo = new THREE.BoxGeometry(w, deckThick, d); 
        deckGeo.translate(0, -h/2 + palletH - deckThick/2, 0); 
        miniGroup.add(new THREE.Mesh(deckGeo, getSolidMaterial('#8B5A2B'))); 
        miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo), edgeMat));
        
        let isLongerOnW = (w >= d);
        let bLen = Math.min(20, (isLongerOnW ? w : d) * 0.18);

        if (isLongerOnW) {
            for (let i = 0; i < 3; i++) {
                let pz = 0;
                if (i === 0) pz = -d/2 + strThick/2;
                if (i === 2) pz = d/2 - strThick/2;

                let topStrGeo = new THREE.BoxGeometry(w, topStrH, strThick);
                topStrGeo.translate(0, -h/2 + 12, pz);
                miniGroup.add(new THREE.Mesh(topStrGeo, getSolidMaterial('#8B5A2B')));
                miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(topStrGeo), edgeMat));

                for (let j = 0; j < 3; j++) {
                    let px = 0;
                    if (j === 0) px = -w/2 + bLen/2;
                    if (j === 2) px = w/2 - bLen/2;

                    let blockGeo = new THREE.BoxGeometry(bLen, notchH, strThick);
                    blockGeo.translate(px, -h/2 + 6.5, pz);
                    miniGroup.add(new THREE.Mesh(blockGeo, getSolidMaterial('#8B5A2B')));
                    miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), edgeMat));
                }

                let botGeo = new THREE.BoxGeometry(w, botThick, strThick);
                botGeo.translate(0, -h/2 + 1, pz);
                miniGroup.add(new THREE.Mesh(botGeo, getSolidMaterial('#8B5A2B')));
                miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeo), edgeMat));
            }
        } else {
            for (let i = 0; i < 3; i++) {
                let px = 0;
                if (i === 0) px = -w/2 + strThick/2;
                if (i === 2) px = w/2 - strThick/2;

                let topStrGeo = new THREE.BoxGeometry(strThick, topStrH, d);
                topStrGeo.translate(px, -h/2 + 12, 0);
                miniGroup.add(new THREE.Mesh(topStrGeo, getSolidMaterial('#8B5A2B')));
                miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(topStrGeo), edgeMat));

                for (let j = 0; j < 3; j++) {
                    let pz = 0;
                    if (j === 0) pz = -d/2 + bLen/2;
                    if (j === 2) pz = d/2 - bLen/2;

                    let blockGeo = new THREE.BoxGeometry(strThick, notchH, bLen);
                    blockGeo.translate(px, -h/2 + 6.5, pz);
                    miniGroup.add(new THREE.Mesh(blockGeo, getSolidMaterial('#8B5A2B')));
                    miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), edgeMat));
                }

                let botGeo = new THREE.BoxGeometry(strThick, botThick, d);
                botGeo.translate(px, -h/2 + 1, 0);
                miniGroup.add(new THREE.Mesh(botGeo, getSolidMaterial('#8B5A2B')));
                miniGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(botGeo), edgeMat));
            }
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
