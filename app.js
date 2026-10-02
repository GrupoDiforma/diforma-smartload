// ==========================================
// CONFIGURACIÓN DE VERSIÓN Y BACKEND
// ==========================================
const APP_VERSION = "V14.0";
const BACKEND_URL = "https://fuzzy-cod-97vpvvj6qp6j2p764-5000.app.github.dev/optimizar";

let currentFileHandle = null; 
let selectedGroupId = null;  
let listaEmpaque = []; 
let instanciasCajas = []; 
let contenedoresFisicos = []; 

function generateUUID() { 
    return 'uuid_' + Math.random().toString(36).substring(2) + Date.now().toString(36); 
}

let dbContenedores = {
  '20ft': { nombre: "20' Standard Container", w: 233, h: 235.6, d: 591.8, maxWeight: 21687, maxVol: 32.487, isSystem: true },
  '40ft': { nombre: "40' Standard Container", w: 233, h: 238.9, d: 1201.5, maxWeight: 26500, maxVol: 67.5, isSystem: true },
  '40hc': { nombre: "40' High Cube Container", w: 235, h: 269, d: 1201.3, maxWeight: 26500, maxVol: 76.0, isSystem: true },
  'custom': { nombre: "Custom Container", w: 235, h: 239, d: 1200, maxWeight: 26500, maxVol: 67.39, isSystem: true }
};

const colorPalette = [
    { hex: '#c5a968', name: 'Ocre Dorado', index: 0 }, { hex: '#b3aae8', name: 'Morado Suave', index: 1 },
    { hex: '#dcdab1', name: 'Beige Claro', index: 2 }, { hex: '#ecc1da', name: 'Rosa Pastel', index: 3 },
    { hex: '#bfeea9', name: 'Verde Menta', index: 4 }, { hex: '#afe8df', name: 'Cian Pastel', index: 5 },
    { hex: '#e6e4f9', name: 'Blanco Hueso', index: 6 }, { hex: '#eeecb3', name: 'Amarillo Pálido', index: 7 }
];

function mostrarToast(mensaje) {
    let toast = document.getElementById('toast-msg');
    toast.innerText = mensaje;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    setTimeout(() => { 
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 3500);
}

dragElement(document.getElementById("modal-box")); 
dragElement(document.getElementById("modal-containers"));

function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0; 
  document.getElementById(elmnt.id + "-header").onmousedown = dragMouseDown;
  
  function dragMouseDown(e) { if(e.target.tagName === 'SPAN') return; e.preventDefault(); pos3 = e.clientX; pos4 = e.clientY; document.onmouseup = closeDragElement; document.onmousemove = elementDrag; }
  function elementDrag(e) { e.preventDefault(); pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY; pos3 = e.clientX; pos4 = e.clientY; elmnt.style.top = (elmnt.offsetTop - pos2) + "px"; elmnt.style.left = (elmnt.offsetLeft - pos1) + "px"; }
  function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

function initColorMenu() {
    let menu = document.getElementById('color-menu-items'); menu.innerHTML = '';
    colorPalette.forEach(c => {
        let div = document.createElement('div'); div.className = 'color-option';
        div.innerHTML = `<div class="color-swatch" style="background-color: ${c.hex};"></div>${c.name}`;
        div.onclick = () => selectColor(c.hex, c.name); menu.appendChild(div);
    });
    document.addEventListener('click', function(e) {
        let dp = document.getElementById('custom-color-dropdown');
        if (dp && !dp.contains(e.target)) { document.getElementById('color-menu-items').classList.remove('show'); }
    });
}

function toggleColorMenu() { document.getElementById('color-menu-items').classList.toggle('show'); }
function selectColor(hex, name) { document.getElementById('m-color').value = hex; document.getElementById('selected-color-swatch').style.backgroundColor = hex; document.getElementById('selected-color-name').innerText = name; document.getElementById('color-menu-items').classList.remove('show'); updateMini3D(); }
function setColorById(hex) { let color = colorPalette.find(c => c.hex === hex) || colorPalette[0]; document.getElementById('m-color').value = color.hex; document.getElementById('selected-color-swatch').style.backgroundColor = color.hex; document.getElementById('selected-color-name').innerText = color.name; }

function updateAllContDropdowns() {
    let selects = ['ribbon-cont-type', 'individual-cont-type', 'm-fit-cont'];
    selects.forEach(id => {
        let el = document.getElementById(id); if(!el) return; let currentVal = el.value; el.innerHTML = '';
        for(let key in dbContenedores) { let opt = document.createElement('option'); opt.value = key; opt.text = dbContenedores[key].nombre; el.appendChild(opt); }
        if(dbContenedores[currentVal]) el.value = currentVal; if(!currentVal && id === 'ribbon-cont-type') el.value = '40ft';
    });
}

function actualizarCustomDimensions() {
    dbContenedores['custom'].w = parseFloat(document.getElementById('cc-w').value) || 235;
    dbContenedores['custom'].d = parseFloat(document.getElementById('cc-d').value) || 1200;
    dbContenedores['custom'].h = parseFloat(document.getElementById('cc-h').value) || 239;
    dbContenedores['custom'].maxWeight = parseFloat(document.getElementById('cc-kg').value) || 26500;
    dbContenedores['custom'].maxVol = (dbContenedores['custom'].w * dbContenedores['custom'].h * dbContenedores['custom'].d) / 1000000;
    
    if (contenedoresFisicos.length > 0 && contenedoresFisicos[0].tipoKey === 'custom') {
        contenedoresFisicos[0] = crearContenedor('custom');
    }
    optimizarCarga();
}

function cambiarTipoContenedorGlobal() { 
    let key = document.getElementById('ribbon-cont-type').value;
    let customDiv = document.getElementById('custom-cont-dims');
    if (key === 'custom') {
        if (customDiv) customDiv.style.display = 'flex';
        actualizarCustomDimensions();
    } else {
        if (customDiv) customDiv.style.display = 'none';
        contenedoresFisicos = [crearContenedor(key)];
        optimizarCarga();
    }
}

function abrirModalContainers() { let mb = document.getElementById('modal-containers'); mb.style.display = 'block'; if (!mb.style.top) { mb.style.top = '100px'; mb.style.left = '200px'; } showContLibrary(); }
function cerrarModalContainers() { document.getElementById('modal-containers').style.display = 'none'; }

function showContLibrary() {
    let html = '<h4 style="margin-top:0; color:var(--fluent-accent);">Librería de Contenedores</h4><table style="width:100%; text-align:left; border-collapse:collapse;"><tr><th style="border-bottom:1px solid #ccc; padding-bottom:5px;">Nombre</th><th style="border-bottom:1px solid #ccc;">W x H x D (cm)</th><th style="border-bottom:1px solid #ccc;">Peso Máx (kg)</th><th></th></tr>';
    for(let key in dbContenedores) { let c = dbContenedores[key]; html += `<tr><td style="padding:5px 0;">${c.nombre}</td><td>${c.w} x ${c.h} x ${c.d}</td><td>${c.maxWeight}</td><td>${!c.isSystem ? `<button onclick="borrarContTipo('${key}')" style="cursor:pointer; color:red; border:none; background:transparent;">❌</button>` : ''}</td></tr>`; }
    document.getElementById('cont-main-area').innerHTML = html + '</table>';
}

function showNewContForm() {
    let html = `<h4 style="margin-top:0; color:var(--fluent-accent);">Definir Nuevo Contenedor</h4><div class="form-group"><label style="width:120px;">Nombre:</label><input type="text" id="nc-name" value="Custom Reefer"></div><div class="form-group"><label style="width:120px;">Ancho (cm):</label><input type="number" id="nc-w" value="230"></div><div class="form-group"><label style="width:120px;">Largo (cm):</label><input type="number" id="nc-d" value="1150"></div><div class="form-group"><label style="width:120px;">Alto (cm):</label><input type="number" id="nc-h" value="235"></div><div class="form-group"><label style="width:120px;">Peso Máx (kg):</label><input type="number" id="nc-kg" value="25000"></div><div style="margin-top:20px; text-align:right;"><button class="btn-ok" onclick="guardarNuevoContenedor()">💾 Guardar Contenedor</button></div>`;
    document.getElementById('cont-main-area').innerHTML = html;
}

function guardarNuevoContenedor() { 
    let key = 'custom_' + Date.now(); 
    let w = parseFloat(document.getElementById('nc-w').value); 
    let d = parseFloat(document.getElementById('nc-d').value); 
    let h = parseFloat(document.getElementById('nc-h').value); 
    dbContenedores[key] = { nombre: document.getElementById('nc-name').value, w: w, h: h, d: d, maxWeight: parseFloat(document.getElementById('nc-kg').value), maxVol: (w*h*d)/1000000, isSystem: false }; 
    updateAllContDropdowns(); 
    showContLibrary(); 
}

function borrarContTipo(key) { delete dbContenedores[key]; updateAllContDropdowns(); showContLibrary(); }

function escapeXML(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function generateLoadXML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<load xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.daubnet.com/ftp/load1.xsd">\n';
    contenedoresFisicos.forEach((c, idx) => {
        xml += `  <container id="c${idx+1}">\n    <width>${Math.round(c.w * 10)}</width>\n    <height>${Math.round(c.h * 10)}</height>\n    <length>${Math.round(c.d * 10)}</length>\n    <maxload>${Math.round(c.maxWeight)}</maxload>\n    <description>Container #${idx+1}</description>\n    <type>${escapeXML(c.nombre || "40' Standard Container")}</type>\n  </container>\n`;
    });
    xml += `  <packinglist>\n`;
    listaEmpaque.forEach(item => {
        xml += `    <packinglistitem>\n      <description>${escapeXML(item.desc || 'Item')}</description>\n      <width>${Math.round(item.w * 10)}</width>\n      <height>${Math.round(item.h * 10)}</height>\n      <depth>${Math.round(item.d * 10)}</depth>\n`;
        if (item.shape) xml += `      <shape>${item.shape}</shape>\n`;
        if (item.shape === 'pallet') xml += `      <baseheight>150</baseheight>\n`;
        let colorObj = colorPalette.find(cp => cp.hex === item.color); let colorIdx = colorObj ? colorObj.index : 0;
        xml += `      <colorindex>${colorIdx}</colorindex>\n`;
        if (item.noTilt) xml += `      <notilt/>\n`; if (item.noTurn) xml += `      <noturn/>\n`; if (item.onFloor) xml += `      <floor/>\n`;
        contenedoresFisicos.forEach((cont, cIdx) => {
            let cajasDeEsteItem = cont.cajas.filter(c => String(c.groupId) === String(item.id));
            cajasDeEsteItem.forEach(c => {
                let dir = 1;
                if (c.drawW === item.w && c.drawH === item.h && c.drawD === item.d) dir = 1;
                else if (c.drawW === item.d && c.drawH === item.h && c.drawD === item.w) dir = 2;
                else if (c.drawW === item.w && c.drawH === item.d && c.drawD === item.h) dir = 3;
                else if (c.drawW === item.d && c.drawH === item.w && c.drawD === item.h) dir = 4;
                else if (c.drawW === item.h && c.drawH === item.w && c.drawD === item.d) dir = 5;
                else if (c.drawW === item.h && c.drawH === item.d && c.drawD === item.w) dir = 6;
                xml += `      <package>\n        <container ref="c${cIdx+1}" />\n        <direction>${dir}</direction>\n        <position-x>${Math.round(c.x * 10)}</position-x>\n        <position-y>${Math.round(c.y * 10)}</position-y>\n        <position-z>${Math.round(c.z * 10)}</position-z>\n      </package>\n`;
            });
        });
        xml += `    </packinglistitem>\n`;
    });
    xml += `  </packinglist>\n`;
    let appData = { listaEmpaque, instanciasCajas, contenedoresFisicos: contenedoresFisicos.map(c => c.tipoKey), dbContenedores };
    xml += `\n  <!-- DiformaSmartLoadData\n${JSON.stringify(appData)}\n  -->\n</load>`; return xml;
}

async function guardarArchivo(forceSaveAs = false) {
  if(listaEmpaque.length === 0) { alert("No hay datos para guardar."); return; }
  let fileName = document.getElementById('save-filename').value.trim(); if(!fileName) fileName = "MiCargaLoad"; if(!fileName.toLowerCase().endsWith(".load")) fileName += ".load";
  const xmlData = generateLoadXML();
  
  if (window.showSaveFilePicker) {
      try {
          let handle = currentFileHandle;
          if (forceSaveAs || !handle) {
              handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Load! File', accept: {'text/xml': ['.load']} }] });
              currentFileHandle = handle; 
          }
          const writable = await handle.createWritable(); 
          await writable.write(xmlData); 
          await writable.close(); 
          mostrarToast("✅ Archivo guardado correctamente.");
          return; 
      } catch (err) { if(err.name === 'AbortError') return; }
  }
  
  const blob = new Blob([xmlData], {type: "text/xml"}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  mostrarToast("✅ Archivo descargado.");
}

async function abrirArchivo() {
    if (window.showOpenFilePicker) {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{ description: 'Archivos Load!', accept: {'text/xml': ['.load'], 'application/json': ['.json']} }]
            });
            currentFileHandle = fileHandle; 
            const file = await fileHandle.getFile();
            cargarContenidoArchivo(file);
        } catch(e) { console.log(e); }
    } else {
        document.getElementById('file-input').click();
    }
}

function cargarArchivoInput(event) {
    const file = event.target.files[0]; 
    if (!file) return; 
    currentFileHandle = null; 
    cargarContenidoArchivo(file);
}

function cargarContenidoArchivo(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let fileContent = e.target.result;
      if (fileContent.includes("<!-- DiformaSmartLoadData")) {
          let jsonStr = fileContent.split("<!-- DiformaSmartLoadData")[1].split("-->")[0].trim(); 
          let parsedData = JSON.parse(jsonStr);
          if(parsedData.dbContenedores) { dbContenedores = parsedData.dbContenedores; updateAllContDropdowns(); }
          listaEmpaque = parsedData.listaEmpaque || []; 
          instanciasCajas = parsedData.instanciasCajas || []; 
          contenedoresFisicos = [];
          if(parsedData.contenedoresFisicos) { 
              parsedData.contenedoresFisicos.forEach(tipo => contenedoresFisicos.push(crearContenedor(tipo))); 
          }
          instanciasCajas.forEach(inst => { 
              let tc = contenedoresFisicos[inst.contIdx]; 
              if(tc) { 
                  tc.cajas.push(inst); 
                  tc.pesoActual += inst.weight || 0; 
                  tc.volActual += (inst.drawW * inst.drawH * inst.drawD) / 1000000; 
                  if (inst.z + inst.drawD > tc.lenUsada) tc.lenUsada = inst.z + inst.drawD; 
              } 
          });
      } else if (fileContent.trim().startsWith("<?xml") || fileContent.trim().startsWith("<load")) {
          const parser = new DOMParser(); 
          const xmlDoc = parser.parseFromString(fileContent, "text/xml");
          let contNodes = xmlDoc.getElementsByTagName("container"); 
          contenedoresFisicos = []; 
          let contIdMap = {}; 
          Array.from(contNodes).forEach((cNode, index) => {
              let cId = cNode.getAttribute("id"); 
              let cTypeStr = cNode.getElementsByTagName("type")[0]?.textContent || "";
              let tipoKey = '40ft'; 
              let str = cTypeStr.toLowerCase(); 
              if (str.includes("high cube") || str.includes("hc")) tipoKey = '40hc'; 
              else if (str.includes("20")) tipoKey = '20ft'; 
              else if (str.includes("40")) tipoKey = '40ft';
              
              let xmlW = parseInt(cNode.getElementsByTagName("width")[0]?.textContent || 0) / 10; 
              let xmlH = parseInt(cNode.getElementsByTagName("height")[0]?.textContent || 0) / 10; 
              let xmlD = parseInt(cNode.getElementsByTagName("length")[0]?.textContent || 0) / 10; 
              let xmlMaxWgt = parseInt(cNode.getElementsByTagName("maxload")[0]?.textContent || 0);
              
              let cont = crearContenedor(tipoKey); 
              cont.nombre = cTypeStr || cont.nombre; 
              if (xmlW > 0) cont.w = xmlW; 
              if (xmlH > 0) cont.h = xmlH; 
              if (xmlD > 0) cont.d = xmlD; 
              if (xmlMaxWgt > 0) cont.maxWeight = xmlMaxWgt;
              cont.maxVol = (cont.w * cont.h * cont.d) / 1000000; 
              contenedoresFisicos.push(cont); 
              contIdMap[cId] = index;
          });
          const itemNodes = xmlDoc.getElementsByTagName("packinglistitem"); 
          listaEmpaque = []; 
          instanciasCajas = [];
          Array.from(itemNodes).forEach(node => {
              let desc = node.getElementsByTagName("description")[0]?.textContent || "Item Load!"; 
              let w = parseInt(node.getElementsByTagName("width")[0]?.textContent || 0) / 10; 
              let h = parseInt(node.getElementsByTagName("height")[0]?.textContent || 0) / 10; 
              let d = parseInt(node.getElementsByTagName("depth")[0]?.textContent || 0) / 10; 
              let shape = node.getElementsByTagName("shape")[0]?.textContent || "box";
              let colorIdx = parseInt(node.getElementsByTagName("colorindex")[0]?.textContent || 0); 
              let colorObj = colorPalette.find(c => c.index === colorIdx) || colorPalette[0];
              let noTilt = node.getElementsByTagName("notilt").length > 0; 
              let noTurn = node.getElementsByTagName("noturn").length > 0; 
              let floor = node.getElementsByTagName("floor").length > 0;
              let packages = node.getElementsByTagName("package"); 
              let qty = packages.length > 0 ? packages.length : 1; 
              let itemId = generateUUID();
              listaEmpaque.push({ id: itemId, shape: shape, qty: qty, desc: desc, w: w, d: d, h: h, weight: 0, color: colorObj.hex, noTilt: noTilt, noTurn: noTurn, onFloor: floor, dangerous: false });
              if (packages.length > 0) {
                  Array.from(packages).forEach(pkg => {
                      let cRef = pkg.getElementsByTagName("container")[0]?.getAttribute("ref"); 
                      let dir = parseInt(pkg.getElementsByTagName("direction")[0]?.textContent || 1); 
                      let posX = parseInt(pkg.getElementsByTagName("position-x")[0]?.textContent || 0) / 10; 
                      let posY = parseInt(pkg.getElementsByTagName("position-y")[0]?.textContent || 0) / 10; 
                      let posZ = parseInt(pkg.getElementsByTagName("position-z")[0]?.textContent || 0) / 10;
                      let drawW = w, drawH = h, drawD = d; 
                      if (dir === 2) { drawW = d; drawH = h; drawD = w; } 
                      else if (dir === 3) { drawW = w; drawH = d; drawD = h; } 
                      else if (dir === 4) { drawW = d; drawH = w; drawD = h; } 
                      else if (dir === 5) { drawW = h; drawH = w; drawD = d; } 
                      else if (dir === 6) { drawW = h; drawH = d; drawD = w; }
                      let contIdx = contIdMap[cRef] !== undefined ? contIdMap[cRef] : 0;
                      let inst = { uuid: generateUUID(), groupId: itemId, shape: shape, w: w, h: h, d: d, drawW: drawW, drawH: drawH, drawD: drawD, x: posX, y: posY, z: posZ, weight: 0, color: colorObj.hex, locked: false, contIdx: contIdx };
                      instanciasCajas.push(inst);
                      let targetCont = contenedoresFisicos[contIdx]; 
                      if(targetCont) { 
                          targetCont.cajas.push(inst); 
                          targetCont.pesoActual += inst.weight; 
                          targetCont.volActual += (inst.drawW * inst.drawH * inst.drawD) / 1000000; 
                          if (inst.z + inst.drawD > targetCont.lenUsada) targetCont.lenUsada = inst.z + inst.drawD; 
                      }
                  });
              }
          });
      }
      contenedoresFisicos = contenedoresFisicos.filter(c => c.cajas.length > 0);
      if (contenedoresFisicos.length === 0) { 
          let defaultType = document.getElementById('ribbon-cont-type').value || '40ft'; 
          contenedoresFisicos.push(crearContenedor(defaultType)); 
      }
      document.getElementById('save-filename').value = file.name.replace(/\.[^/.]+$/, ""); 
      document.getElementById('file-input').value = ''; 
      if(contenedoresFisicos.length > 0) { 
          document.getElementById('ribbon-cont-type').value = contenedoresFisicos[0].tipoKey; 
      }
      actualizarTabla(); 
      optimizarCarga(); 
    } catch(err) { alert("Error leyendo archivo. Asegúrate de que el formato sea válido."); console.error(err); }
  }; reader.readAsText(file);
}

function obtenerRotaciones(caja) {
  let rots = []; let w = caja.w, h = caja.h, d = caja.d; rots.push({w: w, h: h, d: d}); 
  if (!caja.noTurn) rots.push({w: d, h: h, d: w}); 
  if (!caja.noTilt) { rots.push({w: w, h: d, d: h}); if (!caja.noTurn) rots.push({w: d, h: w, d: h}); rots.push({w: h, h: w, d: d}); if (!caja.noTurn) rots.push({w: h, h: d, d: w}); }
  let unicos = []; rots.forEach(r => { if(!unicos.some(u => u.w===r.w && u.h===r.h && u.d===r.d)) unicos.push(r); }); return unicos;
}

function updateFitCalc() {
    let w = parseFloat(document.getElementById('m-w').value) || 1; let d = parseFloat(document.getElementById('m-d').value) || 1; let h = parseFloat(document.getElementById('m-h').value) || 1; let weight = parseFloat(document.getElementById('m-weight').value) || 0; let qty = parseInt(document.getElementById('m-qty').value) || 1;
    let noTilt = document.getElementById('m-no-tilt').checked; let noTurn = document.getElementById('m-no-turn').checked; let contKey = document.getElementById('m-fit-cont').value; let cont = dbContenedores[contKey]; if(!cont) return;
    let rots = obtenerRotaciones({w:w, h:h, d:d, noTilt:noTilt, noTurn:noTurn}); let maxFit = 0;
    for(let rot of rots) {
        let nx = Math.floor(cont.w / rot.w); let ny = Math.floor(cont.h / rot.h); let nz = Math.floor(cont.d / rot.d); let fitUnits = nx * ny * nz;
        if(weight > 0) { let maxByWeight = Math.floor(cont.maxWeight / weight); if(fitUnits > maxByWeight) fitUnits = maxByWeight; }
        if(fitUnits > maxFit) maxFit = fitUnits;
    }
    document.getElementById('fit-text').innerText = maxFit + " ítems caben en"; document.getElementById('m-qty').className = (qty > maxFit) ? 'qty-input-red' : 'qty-input-normal';
}

function limpiarTodo() {
    listaEmpaque = []; instanciasCajas = []; contenedoresFisicos = []; selectedGroupId = null; if (typeof selectedUUIDsSet !== 'undefined') selectedUUIDsSet.clear(); currentFileHandle = null;
    document.getElementById('save-filename').value = 'MiCargaLoad';
    actualizarTabla(); const defaultType = document.getElementById('ribbon-cont-type').value || '40ft'; contenedoresFisicos = [crearContenedor(defaultType)]; actualizarUIContenedores();
}

function abrirModalCaja(esEdicion) {
  const mb = document.getElementById('modal-box'); mb.style.display = 'block'; if (!mb.style.top) { mb.style.top = '100px'; mb.style.left = '350px'; } 
  if(!esEdicion) { document.getElementById('m-id').value = ''; document.getElementById('m-shape').value = 'pallet'; document.getElementById('m-qty').value = 10; document.getElementById('m-desc').value = 'Item Nuevo'; document.getElementById('m-w').value = 129; document.getElementById('m-d').value = 129; document.getElementById('m-h').value = 165; document.getElementById('m-weight').value = 0; setColorById('#c5a968'); document.getElementById('m-no-tilt').checked = false; document.getElementById('m-no-turn').checked = false; document.getElementById('m-floor').checked = false; document.getElementById('m-danger').checked = false; }
  setTimeout(() => { updateMini3D(); updateFitCalc(); }, 50); 
}

function cerrarModalCaja() { document.getElementById('modal-box').style.display = 'none'; }

function guardarItem() {
  const id = document.getElementById('m-id').value; const item = { id: id ? String(id) : generateUUID(), shape: document.getElementById('m-shape').value, qty: parseInt(document.getElementById('m-qty').value), desc: document.getElementById('m-desc').value, w: parseFloat(document.getElementById('m-w').value), d: parseFloat(document.getElementById('m-d').value), h: parseFloat(document.getElementById('m-h').value), weight: parseFloat(document.getElementById('m-weight').value), color: document.getElementById('m-color').value, noTilt: document.getElementById('m-no-tilt').checked, noTurn: document.getElementById('m-no-turn').checked, onFloor: document.getElementById('m-floor').checked, dangerous: document.getElementById('m-danger').checked };
  if (id === '') { listaEmpaque.push(item); } else { const index = listaEmpaque.findIndex(i => String(i.id) === String(id)); if(index > -1) listaEmpaque[index] = item; }
  cerrarModalCaja(); actualizarTabla(); optimizarCarga();
}

function seleccionarFila(id) { 
    id = String(id); 
    if (typeof selectedUUIDsSet !== 'undefined') selectedUUIDsSet.clear();
    if (String(selectedGroupId) === id) { 
        selectedGroupId = null; 
    } else { 
        selectedGroupId = id; 
    } 
    actualizarTabla(); 
    actualizarRenderCajas(); 
}

function editarItemLista(idParaEditar = null) {
  const targetId = idParaEditar || selectedGroupId; if(!targetId) { alert("Selecciona un ítem de la lista."); return; }
  const item = listaEmpaque.find(i => String(i.id) === String(targetId)); if(!item) return;
  document.getElementById('m-id').value = item.id; document.getElementById('m-shape').value = item.shape || 'box'; document.getElementById('m-qty').value = item.qty; document.getElementById('m-desc').value = item.desc; document.getElementById('m-w').value = item.w; document.getElementById('m-d').value = item.d; document.getElementById('m-h').value = item.h; document.getElementById('m-weight').value = item.weight; setColorById(item.color); document.getElementById('m-no-tilt').checked = item.noTilt; document.getElementById('m-no-turn').checked = item.noTurn; document.getElementById('m-floor').checked = item.onFloor; document.getElementById('m-danger').checked = item.dangerous || false; abrirModalCaja(true);
}

function duplicarItemLista() {
    if(!selectedGroupId) { alert("Selecciona un ítem de la lista para duplicar."); return; }
    const itemOriginal = listaEmpaque.find(i => String(i.id) === String(selectedGroupId)); if(!itemOriginal) return;
    const itemCopia = { ...itemOriginal, id: generateUUID() }; listaEmpaque.push(itemCopia); selectedGroupId = itemCopia.id; actualizarTabla(); optimizarCarga();
}

function borrarItemLista() { if(!selectedGroupId) return; listaEmpaque = listaEmpaque.filter(i => String(i.id) !== String(selectedGroupId)); selectedGroupId = null; actualizarTabla(); optimizarCarga(); }

function actualizarTabla() {
  const tbody = document.getElementById('table-body'); let html = '';
  listaEmpaque.forEach(item => {
    const isSel = String(item.id) === String(selectedGroupId) ? 'selected' : ''; 
    let icono = item.shape === 'barrel' ? '🛢️' : (item.shape === 'pallet' ? '🪵' : '📦'); 
    if(item.dangerous) icono = '☣️ ' + icono;
    
    let tieneBloqueados = instanciasCajas.some(inst => String(inst.groupId) === String(item.id) && inst.locked);
    if (tieneBloqueados) icono = '🔒 ' + icono;

    html += `<tr class="${isSel}" data-id="${item.id}" onclick="seleccionarFila('${item.id}')" ondblclick="editarItemLista('${item.id}')"><td><div class="color-box" style="background-color: ${item.color};"></div></td><td style="text-align:right;">${item.qty}</td><td>${icono} ${item.desc}</td><td style="text-align:right;">${item.w}</td><td style="text-align:right;">${item.d}</td><td style="text-align:right;">${item.h}</td><td style="text-align:right;">${item.weight}</td></tr>`;
  }); tbody.innerHTML = html;
}

function sincronizarInstancias() {
  instanciasCajas = instanciasCajas.filter(inst => listaEmpaque.some(item => String(item.id) === String(inst.groupId)));
  listaEmpaque.forEach(item => {
     let insts = instanciasCajas.filter(i => String(i.groupId) === String(item.id)); let diff = item.qty - insts.length;
     if (diff > 0) { for(let i=0; i<diff; i++) instanciasCajas.push({ ...item, groupId: item.id, uuid: generateUUID(), locked: false }); } 
     else if (diff < 0) {
         let toRemove = -diff;
         for(let i=instanciasCajas.length-1; i>=0 && toRemove>0; i--) { if(String(instanciasCajas[i].groupId) === String(item.id) && !instanciasCajas[i].locked) { instanciasCajas.splice(i, 1); toRemove--; } }
         for(let i=instanciasCajas.length-1; i>=0 && toRemove>0; i--) { if(String(instanciasCajas[i].groupId) === String(item.id)) { instanciasCajas.splice(i, 1); toRemove--; } }
     }
     instanciasCajas.forEach(inst => { if(String(inst.groupId) === String(item.id)) { inst.shape = item.shape || 'box'; inst.w = item.w; inst.d = item.d; inst.h = item.h; inst.weight = item.weight; inst.color = item.color; inst.noTurn = item.noTurn; inst.noTilt = item.noTilt; inst.onFloor = item.onFloor; } });
  });
}

function obtenerContenedorActivo() { let key = document.getElementById('ribbon-cont-type').value; return dbContenedores[key] || dbContenedores['40ft']; }

function crearContenedor(tipoKey) { 
    let db = dbContenedores[tipoKey] || obtenerContenedorActivo(); 
    let tk = dbContenedores[tipoKey] ? tipoKey : document.getElementById('ribbon-cont-type').value; 
    return { 
        tipoKey: tk, 
        nombre: db.nombre, 
        w: db.w, 
        h: db.h, 
        d: db.d, 
        maxWeight: db.maxWeight, 
        maxVol: db.maxVol, 
        cajas: [], 
        pesoActual: 0, 
        volActual: 0, 
        lenUsada: 0 
    }; 
}

function cambiarContenedorIndividual() { 
    const idx = parseInt(document.getElementById('view-cont-select').value); 
    if(!isNaN(idx) && contenedoresFisicos[idx]) { 
        let newType = document.getElementById('individual-cont-type').value;
        let nuevoCont = crearContenedor(newType);
        contenedoresFisicos[idx].tipoKey = nuevoCont.tipoKey;
        contenedoresFisicos[idx].nombre = nuevoCont.nombre;
        contenedoresFisicos[idx].w = nuevoCont.w;
        contenedoresFisicos[idx].h = nuevoCont.h;
        contenedoresFisicos[idx].d = nuevoCont.d;
        contenedoresFisicos[idx].maxWeight = nuevoCont.maxWeight;
        contenedoresFisicos[idx].maxVol = nuevoCont.maxVol;
        optimizarCarga(); 
    } 
}

function actualizarMetricasGlobales() {
    contenedoresFisicos.forEach(cont => {
        let pesoAcc = 0;
        let volAcc = 0;
        let lenMax = 0;
        cont.cajas.forEach(c => {
            pesoAcc += floatVal(c.weight);
            volAcc += (floatVal(c.drawW) * floatVal(c.drawH) * floatVal(c.drawD)) / 1000000.0;
            if (floatVal(c.z) + floatVal(c.drawD) > lenMax) {
                lenMax = floatVal(c.z) + floatVal(c.drawD);
            }
        });
        cont.pesoActual = pesoAcc;
        cont.volActual = volAcc;
        cont.lenUsada = lenMax;
    });
    actualizarPanelDerecho();
}

function floatVal(v) { return parseFloat(v) || 0; }

// CONEXIÓN CON EL BACKEND DE PYTHON
async function optimizarCarga() {
    if (listaEmpaque.length === 0) {
        mostrarToast("⚠️ Agrega o carga ítems antes de optimizar.");
        return;
    }

    let loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'flex';

    sincronizarInstancias(); 

    let defaultType = document.getElementById('ribbon-cont-type').value || '40ft';
    if (contenedoresFisicos.length === 0) {
        contenedoresFisicos.push(crearContenedor(defaultType));
    }

    let payload = {
        instanciasCajas: instanciasCajas,
        contenedoresFisicos: contenedoresFisicos.map(c => ({
            tipoKey: c.tipoKey,
            nombre: c.nombre,
            w: c.w, h: c.h, d: c.d,
            maxWeight: c.maxWeight,
            maxVol: c.maxVol
        }))
    };

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.status === 'exito') {
            contenedoresFisicos = data.contenedoresFisicos;
            instanciasCajas = data.instanciasCajas;
            actualizarUIContenedores();
        } else {
            alert("Error en el algoritmo de Python:\n" + data.mensaje);
        }
    } catch (error) {
        console.error("Error conectando con el Backend:", error);
        alert("No se pudo conectar con el servidor Python en " + BACKEND_URL + "\n\nAsegúrate de que 'app.py' esté corriendo.");
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function actualizarUIContenedores() {
  contenedoresFisicos = contenedoresFisicos.filter((c, idx) => idx === 0 || c.cajas.length > 0);
  const select = document.getElementById('view-cont-select'); select.innerHTML = '<option value="">-- Ver Todos (Info Global) --</option>'; 
  if(contenedoresFisicos.length === 0) { document.getElementById('change-type-div').style.display = 'none'; } else { contenedoresFisicos.forEach((c, idx) => { select.innerHTML += `<option value="${idx}">Contenedor #${idx+1} (${c.nombre})</option>`; }); document.getElementById('change-type-div').style.display = 'flex'; }
  actualizarPanelDerecho(); construirEscena3D(); 
}

function actualizarPanelDerecho() {
  const idx = document.getElementById('view-cont-select').value; let totalVolMax = 0, totalVolAct = 0, totalWgtMax = 0, totalWgtAct = 0, totalLenMax = 0, totalLenAct = 0;
  if(idx === "") {
      document.getElementById('cont-name').innerText = "Info Contenedores (Global)"; document.getElementById('change-type-div').style.display = 'none';
      if(contenedoresFisicos.length === 0) { let empty = dbContenedores[document.getElementById('ribbon-cont-type').value]; totalVolMax = empty ? empty.maxVol : 0; totalWgtMax = empty ? empty.maxWeight : 0; totalLenMax = empty ? empty.d : 0; } else { contenedoresFisicos.forEach(c => { totalVolMax += c.maxVol; totalVolAct += c.volActual; totalWgtMax += c.maxWeight; totalWgtAct += c.pesoActual; totalLenMax += c.d; totalLenAct += c.lenUsada; }); }
  } else {
      document.getElementById('change-type-div').style.display = 'flex'; const c = contenedoresFisicos[idx]; document.getElementById('individual-cont-type').value = c.tipoKey; document.getElementById('cont-name').innerText = `Contenedor #${parseInt(idx)+1} (${c.nombre})`;
      totalVolMax = c.maxVol; totalVolAct = c.volActual; totalWgtMax = c.maxWeight; totalWgtAct = c.pesoActual; totalLenMax = c.d; totalLenAct = c.lenUsada;
  }
  let pctVol = totalVolMax > 0 ? ((totalVolAct / totalVolMax) * 100).toFixed(1) : "0.0"; document.getElementById('vol-text').innerHTML = `${totalVolAct.toFixed(3)} m³<br>${totalVolMax.toFixed(3)} m³`; document.getElementById('bar-vol').style.width = `${pctVol}%`; document.getElementById('pct-vol').innerText = `${pctVol}%`;
  let pctWgt = totalWgtMax > 0 ? ((totalWgtAct / totalWgtMax) * 100).toFixed(1) : "0.0"; document.getElementById('wgt-text').innerHTML = `${totalWgtAct} kg<br>${totalWgtMax} kg`; document.getElementById('bar-wgt').style.width = `${pctWgt}%`; document.getElementById('pct-wgt').innerText = `${pctWgt}%`;
  let pctLen = totalLenMax > 0 ? ((totalLenAct / totalLenMax) * 100).toFixed(1) : "0.0"; let remLen = (totalLenMax - totalLenAct).toFixed(1); document.getElementById('len-text').innerHTML = `${totalLenAct.toFixed(1)} cm<br>${totalLenMax.toFixed(1)} cm<br>${remLen} cm`; document.getElementById('bar-len').style.width = `${pctLen}%`; document.getElementById('pct-len').innerText = `${pctLen}%`;
  if(is3DInitialized) actualizarRenderCajas(); 
}

function bloquearSeleccion(lockState) { 
    let changed = false; 
    if (typeof selectedUUIDsSet !== 'undefined' && selectedUUIDsSet.size > 0) {
        instanciasCajas.forEach(inst => {
            if (selectedUUIDsSet.has(inst.uuid)) {
                inst.locked = lockState;
                changed = true;
            }
        });
    } else if (selectedGroupId) { 
        instanciasCajas.forEach(inst => { 
            if (String(inst.groupId) === String(selectedGroupId)) { 
                inst.locked = lockState; 
                changed = true; 
            } 
        }); 
    } 
    if (changed) {
        actualizarTabla();
        actualizarRenderCajas();
    }
}

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(console.error); }
if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files.length > 0) {
            const fileHandle = launchParams.files[0];
            const file = await fileHandle.getFile();
            cargarArchivoInput({ target: { files: [file] } });
        }
    });
}

window.onload = function() { 
    document.getElementById('app-version-text').innerText = APP_VERSION;
    initColorMenu(); 
    updateAllContDropdowns(); 
    limpiarTodo(); 
};
