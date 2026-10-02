// ==========================================
// SMARTLOAD V14.0 - MATH PACKING ENGINE WORKER
// Traducido e integrado a JS Nativo (Background Thread)
// ==========================================

class Space {
    constructor(x, y, z, w, h, d) {
        this.x = parseFloat(x);
        this.y = parseFloat(y);
        this.z = parseFloat(z);
        this.w = parseFloat(w);
        this.h = parseFloat(h);
        this.d = parseFloat(d);
    }

    contains(other) {
        return (
            this.x <= other.x + 0.01 &&
            this.y <= other.y + 0.01 &&
            this.z <= other.z + 0.01 &&
            this.x + this.w >= other.x + other.w - 0.01 &&
            this.y + this.h >= other.y + other.h - 0.01 &&
            this.z + this.d >= other.z + other.d - 0.01
        );
    }
}

function intersect(s, b_x, b_y, b_z, b_w, b_h, b_d) {
    return !(
        s.x + s.w <= b_x + 0.01 || b_x + b_w <= s.x + 0.01 ||
        s.y + s.h <= b_y + 0.01 || b_y + b_h <= s.y + 0.01 ||
        s.z + s.d <= b_z + 0.01 || b_z + b_d <= s.z + 0.01
    );
}

function subtractBox(s, b_x, b_y, b_z, b_w, b_h, b_d) {
    if (!intersect(s, b_x, b_y, b_z, b_w, b_h, b_d)) {
        return [s];
    }
    const newSpaces = [];
    if (b_x > s.x + 0.01) {
        newSpaces.push(new Space(s.x, s.y, s.z, b_x - s.x, s.h, s.d));
    }
    if (b_x + b_w < s.x + s.w - 0.01) {
        newSpaces.push(new Space(b_x + b_w, s.y, s.z, (s.x + s.w) - (b_x + b_w), s.h, s.d));
    }
    if (b_y > s.y + 0.01) {
        newSpaces.push(new Space(s.x, s.y, s.z, s.w, b_y - s.y, s.d));
    }
    if (b_y + b_h < s.y + s.h - 0.01) {
        newSpaces.push(new Space(s.x, b_y + b_h, s.z, s.w, (s.y + s.h) - (b_y + b_h), s.d));
    }
    if (b_z > s.z + 0.01) {
        newSpaces.push(new Space(s.x, s.y, s.z, s.w, s.h, b_z - s.z));
    }
    if (b_z + b_d < s.z + s.d - 0.01) {
        newSpaces.push(new Space(s.x, s.y, b_z + b_d, s.w, s.h, (s.z + s.d) - (b_z + b_d)));
    }
    return newSpaces.filter(sp => sp.w > 0.1 && sp.h > 0.1 && sp.d > 0.1);
}

function updateSpaces(spaces, b_x, b_y, b_z, b_w, b_h, b_d) {
    let updated = [];
    for (let s of spaces) {
        if (intersect(s, b_x, b_y, b_z, b_w, b_h, b_d)) {
            let subs = subtractBox(s, b_x, b_y, b_z, b_w, b_h, b_d);
            updated.push(...subs);
        } else {
            updated.push(s);
        }
    }
    let maximal = [];
    for (let i = 0; i < updated.length; i++) {
        let s1 = updated[i];
        let isSub = false;
        for (let j = 0; j < updated.length; j++) {
            let s2 = updated[j];
            if (i !== j && s2.contains(s1)) {
                if (
                    Math.abs(s1.x - s2.x) < 0.1 && Math.abs(s1.y - s2.y) < 0.1 && Math.abs(s1.z - s2.z) < 0.1 &&
                    Math.abs(s1.w - s2.w) < 0.1 && Math.abs(s1.h - s2.h) < 0.1 && Math.abs(s1.d - s2.d) < 0.1 && i > j
                ) {
                    continue;
                }
                isSub = true;
                break;
            }
        }
        if (!isSub) {
            maximal.push(s1);
        }
    }
    return maximal;
}

function updateSpacesWithGroundSupportCap(spaces, b_x, b_y, b_z, b_w, b_h, b_d, cajasColocadas) {
    let updatedSpaces = updateSpaces(spaces, b_x, b_y, b_z, b_w, b_h, b_d);
    let cappedSpaces = [];
    for (let sp of updatedSpaces) {
        if (sp.y > 0.1) {
            let supporting = cajasColocadas.filter(c =>
                Math.abs((c.y + c.drawH) - sp.y) < 0.5 &&
                Math.min(sp.x + sp.w, c.x + c.drawW) > Math.max(sp.x, c.x) + 0.1 &&
                c.z + c.drawD > sp.z + 0.1
            );
            if (supporting.length > 0) {
                let maxSuppZ = Math.max(...supporting.map(c => c.z + c.drawD));
                if (sp.z + sp.d > maxSuppZ) {
                    let newD = maxSuppZ - sp.z;
                    if (newD > 0.1) {
                        cappedSpaces.push(new Space(sp.x, sp.y, sp.z, sp.w, sp.h, newD));
                    }
                } else {
                    cappedSpaces.push(sp);
                }
            }
        } else {
            cappedSpaces.push(sp);
        }
    }

    let maximal = [];
    for (let i = 0; i < cappedSpaces.length; i++) {
        let s1 = cappedSpaces[i];
        let isSub = false;
        for (let j = 0; j < cappedSpaces.length; j++) {
            let s2 = cappedSpaces[j];
            if (i !== j && s2.contains(s1)) {
                if (
                    Math.abs(s1.x - s2.x) < 0.1 && Math.abs(s1.y - s2.y) < 0.1 && Math.abs(s1.z - s2.z) < 0.1 &&
                    Math.abs(s1.w - s2.w) < 0.1 && Math.abs(s1.h - s2.h) < 0.1 && Math.abs(s1.d - s2.d) < 0.1 && i > j
                ) {
                    continue;
                }
                isSub = true;
                break;
            }
        }
        if (!isSub) {
            maximal.push(s1);
        }
    }
    return maximal;
}

function obtenerRotaciones(caja) {
    let w = Math.max(0.1, parseFloat(caja.w || 1));
    let h = Math.max(0.1, parseFloat(caja.h || 1));
    let d = Math.max(0.1, parseFloat(caja.d || 1));

    let noTurn = caja.noTurn || false;
    let noTilt = caja.noTilt || (caja.shape === 'pallet');

    let rots = [{ w, h, d }];
    if (!noTurn) {
        rots.push({ w: d, h, d: w });
    }
    if (!noTilt) {
        rots.push({ w, h: d, d: h });
        rots.push({ w: h, h: w, d });
        if (!noTurn) {
            rots.push({ w: d, h: w, d: h });
            rots.push({ w: h, h: d, d: w });
        }
    }

    let unicos = [];
    for (let r of rots) {
        if (!unicos.some(u => Math.abs(u.w - r.w) < 0.1 && Math.abs(u.h - r.h) < 0.1 && Math.abs(u.d - r.d) < 0.1)) {
            unicos.push(r);
        }
    }
    return unicos;
}

function esSoporteValido(px, py, pz, bw, bd, cajasColocadas) {
    if (py <= 0.1) return true;

    let overlappingSupp = cajasColocadas.filter(c =>
        Math.abs((c.y + c.drawH) - py) < 0.5 &&
        Math.min(px + bw, c.x + c.drawW) > Math.max(px, c.x) + 0.1
    );

    if (overlappingSupp.length === 0) return false;

    let areaTotal = bw * bd;
    let areaSoportada = 0.0;

    for (let c of overlappingSupp) {
        let interX1 = Math.max(px, c.x);
        let interX2 = Math.min(px + bw, c.x + c.drawW);
        let interZ1 = Math.max(pz, c.z);
        let interZ2 = Math.min(pz + bd, c.z + c.drawD);

        if (interX2 > interX1 && interZ2 > interZ1) {
            areaSoportada += (interX2 - interX1) * (interZ2 - interZ1);
        }
    }

    if ((areaSoportada / areaTotal) < 0.75) return false;

    let maxSuppZ = Math.max(...overlappingSupp.map(c => c.z + c.drawD));
    if (pz + bd > maxSuppZ + 0.5) return false;

    return true;
}

function calcularMejorBloque(sp, oriW, oriH, oriD, availableQty, isOnFloor = false) {
    let maxNx = Math.floor((sp.w + 0.01) / oriW);
    let maxNy = isOnFloor ? 1 : Math.floor((sp.h + 0.01) / oriH);
    let maxNz = Math.floor((sp.d + 0.01) / oriD);

    if (maxNx <= 0 || maxNy <= 0 || maxNz <= 0) {
        return [0, 0, 0, 0];
    }

    let layerCapacity = maxNx * maxNy;

    if (availableQty >= layerCapacity) {
        let nz = Math.min(maxNz, Math.floor(availableQty / layerCapacity));
        return [maxNx, maxNy, nz, maxNx * maxNy * nz];
    } else {
        let bNx = 0, bNy = 0, maxCount = 0;
        for (let x = 1; x <= maxNx; x++) {
            for (let y = 1; y <= maxNy; y++) {
                let count = x * y;
                if (count <= availableQty) {
                    if (count > maxCount) {
                        maxCount = count;
                        bNx = x;
                        bNy = y;
                    } else if (count === maxCount) {
                        if (x > bNx) {
                            bNx = x;
                            bNy = y;
                        }
                    }
                }
            }
        }
        return [bNx, bNy, 1, maxCount];
    }
}

function empaquetar(cajasDisponibles, cont, contIdx = 0) {
    let spaces = [new Space(0, 0, 0, parseFloat(cont.w), parseFloat(cont.h), parseFloat(cont.d))];
    let maxWeight = parseFloat(cont.maxWeight || 9999999);
    let containerWidth = parseFloat(cont.w);

    let cajasBloqueadas = cajasDisponibles.filter(c => c.locked && c.contIdx === contIdx);
    let cajasLibres = cajasDisponibles.filter(c => !cajasBloqueadas.includes(c));

    for (let b of cajasBloqueadas) {
        cont.cajas.push(b);
        cont.pesoActual += parseFloat(b.weight || 0);
        spaces = updateSpacesWithGroundSupportCap(
            spaces, parseFloat(b.x), parseFloat(b.y), parseFloat(b.z),
            parseFloat(b.drawW), parseFloat(b.drawH), parseFloat(b.drawD), cont.cajas
        );
    }

    let groupMap = {};
    let groupOrder = [];
    for (let c of cajasLibres) {
        let sig = String(c.groupId !== undefined ? c.groupId : (c.id !== undefined ? c.id : ''));
        if (!groupMap[sig]) {
            groupMap[sig] = {
                sample: c,
                qty: 0,
                items: [],
                is_pallet: (c.shape === 'pallet' || c.onFloor) ? 1 : 0,
                unit_vol: parseFloat(c.w || 1) * parseFloat(c.h || 1) * parseFloat(c.d || 1)
            };
            groupOrder.push(sig);
        }
        groupMap[sig].qty += 1;
        groupMap[sig].items.push(c);
    }

    let grupos = groupOrder.map(sig => groupMap[sig]);

    while (grupos.some(g => g.qty > 0) && spaces.length > 0) {
        spaces.sort((a, b) => {
            let az = Math.round(a.z * 100) / 100;
            let bz = Math.round(b.z * 100) / 100;
            if (az !== bz) return az - bz;
            let ay = Math.round(a.y * 100) / 100;
            let by = Math.round(b.y * 100) / 100;
            if (ay !== by) return ay - by;
            let ax = Math.round(a.x * 100) / 100;
            let bx = Math.round(b.x * 100) / 100;
            return ax - bx;
        });

        let zMax = cont.cajas.length > 0 ? Math.max(0.0, ...cont.cajas.map(c => c.z + c.drawD)) : 0.0;

        let gapCandidates = [];
        let depthCandidates = [];

        for (let sp of spaces) {
            for (let g of grupos) {
                if (g.qty <= 0) continue;
                let caja = g.sample;
                if (caja.onFloor && sp.y > 0.1) continue;

                let pesoCaja = parseFloat(caja.weight || 0);
                let availableQty = g.qty;
                if (pesoCaja > 0) {
                    let maxWgtQty = Math.floor((maxWeight - cont.pesoActual) / pesoCaja);
                    availableQty = Math.min(availableQty, maxWgtQty);
                }
                if (availableQty <= 0) continue;

                let oris = obtenerRotaciones(caja);
                for (let ori of oris) {
                    if (ori.w > sp.w + 0.01 || ori.h > sp.h + 0.01 || ori.d > sp.d + 0.01) continue;

                    let [nx, ny, nz, count] = calcularMejorBloque(sp, ori.w, ori.h, ori.d, availableQty, caja.onFloor);
                    if (count <= 0) continue;

                    let bw = nx * ori.w;
                    let bh = ny * ori.h;
                    let bd = nz * ori.d;

                    if ((bd / Math.max(0.1, bw)) > 2.5 && bw < containerWidth * 0.4) continue;

                    if (!esSoporteValido(sp.x, sp.y, sp.z, bw, bd, cont.cajas)) continue;

                    let blockVol = count * ori.w * ori.h * ori.d;
                    let cand = {
                        space: sp, group: g, ori: ori,
                        nx: nx, ny: ny, nz: nz,
                        bw: bw, bh: bh, bd: bd,
                        count: count, block_vol: blockVol,
                        unit_vol: g.unit_vol, is_pallet: g.is_pallet
                    };

                    if (zMax > 0.1 && (sp.z + bd) <= zMax + 0.1) {
                        gapCandidates.push(cand);
                    } else {
                        depthCandidates.push(cand);
                    }
                }
            }
        }

        let bestPlacement = null;
        if (gapCandidates.length > 0) {
            gapCandidates.sort((a, b) => {
                if (b.is_pallet !== a.is_pallet) return b.is_pallet - a.is_pallet;
                if (b.block_vol !== a.block_vol) return b.block_vol - a.block_vol;
                let az = Math.round(a.space.z * 100) / 100;
                let bz = Math.round(b.space.z * 100) / 100;
                if (az !== bz) return az - bz;
                let ay = Math.round(a.space.y * 100) / 100;
                let by = Math.round(b.space.y * 100) / 100;
                if (ay !== by) return ay - by;
                let ax = Math.round(a.space.x * 100) / 100;
                let bx = Math.round(b.space.x * 100) / 100;
                return ax - bx;
            });
            bestPlacement = gapCandidates[0];
        } else if (depthCandidates.length > 0) {
            depthCandidates.sort((a, b) => {
                if (b.is_pallet !== a.is_pallet) return b.is_pallet - a.is_pallet;
                if (b.unit_vol !== a.unit_vol) return b.unit_vol - a.unit_vol;
                if (b.block_vol !== a.block_vol) return b.block_vol - a.block_vol;
                let az = Math.round(a.space.z * 100) / 100;
                let bz = Math.round(b.space.z * 100) / 100;
                if (az !== bz) return az - bz;
                let ay = Math.round(a.space.y * 100) / 100;
                let by = Math.round(b.space.y * 100) / 100;
                if (ay !== by) return ay - by;
                let ax = Math.round(a.space.x * 100) / 100;
                let bx = Math.round(b.space.x * 100) / 100;
                return ax - bx;
            });
            bestPlacement = depthCandidates[0];
        }

        if (bestPlacement) {
            let sp = bestPlacement.space;
            let g = bestPlacement.group;
            let ori = bestPlacement.ori;
            let { nx, ny, nz, bw, bh, bd } = bestPlacement;

            for (let iz = 0; iz < nz; iz++) {
                for (let iy = 0; iy < ny; iy++) {
                    for (let ix = 0; ix < nx; ix++) {
                        let inst = g.items.pop();
                        inst.x = Math.round((sp.x + ix * ori.w) * 100) / 100;
                        inst.y = Math.round((sp.y + iy * ori.h) * 100) / 100;
                        inst.z = Math.round((sp.z + iz * ori.d) * 100) / 100;
                        inst.drawW = ori.w;
                        inst.drawH = ori.h;
                        inst.drawD = ori.d;

                        cont.cajas.push(inst);
                        cont.pesoActual += parseFloat(inst.weight || 0);
                    }
                }
            }

            g.qty -= bestPlacement.count;
            spaces = updateSpacesWithGroundSupportCap(
                spaces, sp.x, sp.y, sp.z, bw, bh, bd, cont.cajas
            );
        } else {
            break;
        }
    }

    cont.volActual = cont.cajas.reduce((acc, c) => acc + (parseFloat(c.drawW) * parseFloat(c.drawH) * parseFloat(c.drawD)) / 1000000.0, 0);
    cont.lenUsada = cont.cajas.length > 0 ? Math.max(0.0, ...cont.cajas.map(c => parseFloat(c.z) + parseFloat(c.drawD))) : 0.0;

    let unpacked = [];
    for (let g of grupos) {
        if (g.items.length > 0) {
            unpacked.push(...g.items);
        }
    }

    return [cont, unpacked];
}

self.onmessage = function (e) {
    try {
        const data = e.data || {};
        const cajasDisponibles = data.instanciasCajas || [];
        const contenedoresInfo = data.contenedoresFisicos || [];

        if (cajasDisponibles.length === 0 || contenedoresInfo.length === 0) {
            self.postMessage({ status: 'error', mensaje: 'Datos insuficientes.' });
            return;
        }

        let resultadoFinal = [];
        let remaining = cajasDisponibles;

        for (let c of remaining) {
            if (!c.locked) {
                c.x = c.y = c.z = 0.0;
                c.drawW = Math.max(0.1, parseFloat(c.w || 1));
                c.drawH = Math.max(0.1, parseFloat(c.h || 1));
                c.drawD = Math.max(0.1, parseFloat(c.d || 1));
            }
        }

        for (let idx = 0; idx < contenedoresInfo.length; idx++) {
            let info = contenedoresInfo[idx];
            let contCand = {
                tipoKey: info.tipoKey || '40ft',
                nombre: info.nombre || 'Container',
                w: parseFloat(info.w || 233),
                h: parseFloat(info.h || 239),
                d: parseFloat(info.d || 1201),
                maxWeight: parseFloat(info.maxWeight || 26500),
                maxVol: parseFloat(info.maxVol || 67.5),
                cajas: [], pesoActual: 0.0, volActual: 0.0, lenUsada: 0.0
            };
            let [contResultado, rem] = empaquetar(remaining, contCand, idx);
            remaining = rem;
            resultadoFinal.push(contResultado);
        }

        if (remaining.length > 0 && contenedoresInfo.length > 0) {
            let ultimoInfo = contenedoresInfo[contenedoresInfo.length - 1];
            let idxExtra = contenedoresInfo.length;
            while (remaining.length > 0) {
                let contCand = {
                    tipoKey: ultimoInfo.tipoKey || '40ft',
                    nombre: ultimoInfo.nombre || 'Container',
                    w: parseFloat(ultimoInfo.w || 233),
                    h: parseFloat(ultimoInfo.h || 239),
                    d: parseFloat(ultimoInfo.d || 1201),
                    maxWeight: parseFloat(ultimoInfo.maxWeight || 26500),
                    maxVol: parseFloat(ultimoInfo.maxVol || 67.5),
                    cajas: [], pesoActual: 0.0, volActual: 0.0, lenUsada: 0.0
                };
                let [contResultado, rem] = empaquetar(remaining, contCand, idxExtra);
                remaining = rem;
                if (contResultado.cajas.length === 0) {
                    break;
                }
                resultadoFinal.push(contResultado);
                idxExtra++;
            }
        }

        resultadoFinal = resultadoFinal.filter(c => c.cajas.length > 0);
        if (resultadoFinal.length === 0 && contenedoresInfo.length > 0) {
            let firstInfo = contenedoresInfo[0];
            resultadoFinal = [{
                tipoKey: firstInfo.tipoKey || '40ft',
                nombre: firstInfo.nombre || 'Container',
                w: parseFloat(firstInfo.w || 233),
                h: parseFloat(firstInfo.h || 239),
                d: parseFloat(firstInfo.d || 1201),
                maxWeight: parseFloat(firstInfo.maxWeight || 26500),
                maxVol: parseFloat(firstInfo.maxVol || 67.5),
                cajas: [], pesoActual: 0.0, volActual: 0.0, lenUsada: 0.0
            }];
        }

        let instanciasFinales = [];
        for (let idx = 0; idx < resultadoFinal.length; idx++) {
            let cont = resultadoFinal[idx];
            for (let c of cont.cajas) {
                c.contIdx = idx;
                instanciasFinales.push(c);
            }
        }

        for (let c of remaining) {
            c.contIdx = -1;
            instanciasFinales.push(c);
        }

        self.postMessage({ status: 'exito', contenedoresFisicos: resultadoFinal, instanciasCajas: instanciasFinales });
    } catch (err) {
        self.postMessage({ status: 'error', mensaje: 'Error matemático:\n' + err.message + '\n' + err.stack });
    }
};
