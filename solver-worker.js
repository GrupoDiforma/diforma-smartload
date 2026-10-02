// ==========================================
// SMARTLOAD V15.1 - MULTI-STRATEGY SEARCH WORKER (STRICT INDIVIDUAL CONTAINER RESPECT)
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
            } else {
                cappedSpaces.push(sp);
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

function empaquetarUnContenedor(cajasDisponibles, cont, contIdx, st) {
    let spaces = [new Space(0, 0, 0, parseFloat(cont.w), parseFloat(cont.h), parseFloat(cont.d))];
    let maxWeight = parseFloat(cont.maxWeight || 9999999);
    let containerWidth = parseFloat(cont.w);
    let containerHeight = parseFloat(cont.h);

    let cajasBloqueadas = cajasDisponibles.filter(c => c.locked && c.contIdx === contIdx);
    let cajasLibres = cajasDisponibles.filter(c => !cajasBloqueadas.includes(c));

    cont.cajas = [];
    cont.pesoActual = 0;
    cont.volActual = 0;
    cont.lenUsada = 0;

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
            let unitVol = parseFloat(c.w || 1) * parseFloat(c.h || 1) * parseFloat(c.d || 1);
            let itemH = parseFloat(c.h || 1);
            
            let isSmallItem = (st.smallVolThreshold > 0) && (unitVol < st.smallVolThreshold || itemH < 25);
            let isRestricted = (c.shape === 'pallet' || c.onFloor) || (!isSmallItem && (c.noTilt || c.noTurn));

            groupMap[sig] = {
                sample: c,
                qty: 0,
                items: [],
                is_restricted: isRestricted,
                is_pallet: (c.shape === 'pallet' || c.onFloor) ? 1 : 0,
                unit_vol: unitVol
            };
            groupOrder.push(sig);
        }
        groupMap[sig].qty += 1;
        groupMap[sig].items.push(c);
    }

    let grupos = groupOrder.map(sig => groupMap[sig]);

    if (st.sortGroupsBy === 'vol_desc') {
        grupos.sort((a, b) => b.unit_vol - a.unit_vol);
    } else if (st.sortGroupsBy === 'qty_desc') {
        grupos.sort((a, b) => b.qty - a.qty);
    }

    for (let fase = 1; fase <= 2; fase++) {
        while (spaces.length > 0) {
            let gruposElegibles = grupos.filter(g => g.qty > 0 && (fase === 2 || g.is_restricted));
            if (gruposElegibles.length === 0) break;

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
                for (let g of gruposElegibles) {
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

                        if (!esSoporteValido(sp.x, sp.y, sp.z, bw, bd, cont.cajas)) continue;

                        let remW = sp.w - bw;
                        let bestComplementW = 0;
                        if (remW > 0.1) {
                            for (let g2 of gruposElegibles) {
                                if (g2.qty <= 0) continue;
                                if (g2 === g && g2.qty <= count) continue;
                                
                                let caja2 = g2.sample;
                                if (caja2.onFloor && sp.y > 0.1) continue;
                                let oris2 = obtenerRotaciones(caja2);
                                for (let ori2 of oris2) {
                                    if (ori2.w <= remW + 0.01 && ori2.h <= sp.h + 0.01 && ori2.d <= sp.d + 0.01) {
                                        if (ori2.w > bestComplementW) {
                                            bestComplementW = ori2.w;
                                        }
                                    }
                                }
                            }
                        }

                        let effectiveWidth = bw + bestComplementW;
                        let widthFillRatio = (effectiveWidth / containerWidth);
                        let heightFillRatio = ((sp.y + bh) / containerHeight);
                        let blockVol = count * ori.w * ori.h * ori.d;
                        let spaceVol = sp.w * sp.h * sp.d;
                        let volumetricEfficiency = spaceVol > 0 ? (blockVol / spaceVol) : 0;

                        let cand = {
                            space: sp, group: g, ori: ori,
                            nx: nx, ny: ny, nz: nz,
                            bw: bw, bh: bh, bd: bd,
                            count: count, block_vol: blockVol,
                            unit_vol: g.unit_vol, is_pallet: g.is_pallet,
                            widthFillRatio: widthFillRatio,
                            heightFillRatio: heightFillRatio,
                            volumetricEfficiency: volumetricEfficiency
                        };

                        if (zMax > 0.1 && (sp.z + bd) <= zMax + 0.1) {
                            gapCandidates.push(cand);
                        } else {
                            depthCandidates.push(cand);
                        }
                    }
                }
            }

            const scoreCandidate = (c) => {
                let widthScore = c.widthFillRatio * st.wWidth;
                let heightScore = c.heightFillRatio * st.wHeight;
                let volScore = c.volumetricEfficiency * st.wVol;
                let countScore = c.count * st.wCount;
                let palletBonus = c.is_pallet * st.wPallet;
                return widthScore + heightScore + volScore + countScore + palletBonus;
            };

            let bestPlacement = null;
            if (gapCandidates.length > 0) {
                gapCandidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
                bestPlacement = gapCandidates[0];
            } else if (depthCandidates.length > 0) {
                depthCandidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
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
    }

    cont.volActual = cont.cajas.reduce((acc, c) => acc + (parseFloat(c.drawW) * parseFloat(c.drawH) * parseFloat(c.drawD)) / 1000000.0, 0);
    cont.lenUsada = cont.cajas.length > 0 ? Math.max(0.0, ...cont.cajas.map(c => parseFloat(c.z) + parseFloat(c.drawD))) : 0.0;

    let unpacked = [];
    for (let g of grupos) {
        if (g.items.length > 0) unpacked.push(...g.items);
    }

    return [cont, unpacked];
}

function empaquetarConEstrategia(cajasInput, contenedoresInput, st) {
    let contenedoresFisicosLocal = JSON.parse(JSON.stringify(contenedoresInput));
    let cajasLocal = JSON.parse(JSON.stringify(cajasInput));

    let resultadoFinal = [];
    let remaining = cajasLocal;

    // Respetar estrictamente la lista de contenedores definidos manualmente por el usuario
    for (let idx = 0; idx < contenedoresFisicosLocal.length; idx++) {
        let info = contenedoresFisicosLocal[idx];
        let contCand = {
            tipoKey: info.tipoKey,
            nombre: info.nombre,
            w: parseFloat(info.w),
            h: parseFloat(info.h),
            d: parseFloat(info.d),
            maxWeight: parseFloat(info.maxWeight),
            maxVol: parseFloat(info.maxVol),
            cajas: [], pesoActual: 0.0, volActual: 0.0, lenUsada: 0.0
        };

        let [contResultado, rem] = empaquetarUnContenedor(remaining, contCand, idx, st);
        remaining = rem;
        resultadoFinal.push(contResultado);
        if (remaining.length === 0) break;
    }

    // Rebosamiento (Overflow): Si queda mercancía sobrante, crear contenedores adicionales basados en el último tipo de contenedor
    if (remaining.length > 0 && contenedoresFisicosLocal.length > 0) {
        let ultimoInfo = contenedoresFisicosLocal[contenedoresFisicosLocal.length - 1];
        let idxExtra = contenedoresFisicosLocal.length;
        while (remaining.length > 0) {
            let contCand = {
                tipoKey: ultimoInfo.tipoKey,
                nombre: ultimoInfo.nombre,
                w: parseFloat(ultimoInfo.w),
                h: parseFloat(ultimoInfo.h),
                d: parseFloat(ultimoInfo.d),
                maxWeight: parseFloat(ultimoInfo.maxWeight),
                maxVol: parseFloat(ultimoInfo.maxVol),
                cajas: [], pesoActual: 0.0, volActual: 0.0, lenUsada: 0.0
            };
            let [contResultado, rem] = empaquetarUnContenedor(remaining, contCand, idxExtra, st);
            remaining = rem;
            if (contResultado.cajas.length === 0) break;
            resultadoFinal.push(contResultado);
            idxExtra++;
        }
    }

    let instanciasFinales = [];
    for (let idx = 0; idx < resultadoFinal.length; idx++) {
        let c = resultadoFinal[idx];
        for (let item of c.cajas) {
            item.contIdx = idx;
            instanciasFinales.push(item);
        }
    }
    for (let item of remaining) {
        item.contIdx = -1;
        instanciasFinales.push(item);
    }

    return {
        contenedoresFisicos: resultadoFinal,
        instanciasCajas: instanciasFinales
    };
}

function ejecutarBusquedaMultiPaso(cajasDisponibles, contenedoresInfo) {
    const estrategias = [
        { id: 1, name: "Balanceado Adaptativo", wWidth: 10000, wHeight: 4000, wVol: 5000, wCount: 10, wPallet: 3000, smallVolThreshold: 30000, sortGroupsBy: 'default' },
        { id: 2, name: "Volumen Descendente", wWidth: 8000, wHeight: 4000, wVol: 8000, wCount: 5, wPallet: 3000, smallVolThreshold: 20000, sortGroupsBy: 'vol_desc' },
        { id: 3, name: "Restricción Rígida Pura", wWidth: 10000, wHeight: 3000, wVol: 3000, wCount: 10, wPallet: 2000, smallVolThreshold: 0, sortGroupsBy: 'default' },
        { id: 4, name: "Prioridad Cantidad Alta", wWidth: 9000, wHeight: 5000, wVol: 6000, wCount: 50, wPallet: 3000, smallVolThreshold: 40000, sortGroupsBy: 'qty_desc' },
        { id: 5, name: "Llenado Transversal Máximo", wWidth: 16000, wHeight: 3000, wVol: 4000, wCount: 10, wPallet: 3000, smallVolThreshold: 30000, sortGroupsBy: 'default' },
        { id: 6, name: "Pared Vertical Y Fondo", wWidth: 8000, wHeight: 8000, wVol: 6000, wCount: 10, wPallet: 3000, smallVolThreshold: 25000, sortGroupsBy: 'vol_desc' },
        { id: 7, name: "Densidad Cúbica Estricta", wWidth: 6000, wHeight: 4000, wVol: 12000, wCount: 5, wPallet: 4000, smallVolThreshold: 35000, sortGroupsBy: 'default' },
        { id: 8, name: "Micro-Relleno Agresivo", wWidth: 12000, wHeight: 6000, wVol: 7000, wCount: 20, wPallet: 2000, smallVolThreshold: 60000, sortGroupsBy: 'qty_desc' }
    ];

    let mejorResultado = null;
    let mejorPuntaje = Infinity;

    for (let st of estrategias) {
        let res = empaquetarConEstrategia(cajasDisponibles, contenedoresInfo, st);
        
        let unpackedCount = res.instanciasCajas.filter(c => c.contIdx === -1).length;
        let contsUsados = res.contenedoresFisicos.length;
        let lenTotal = res.contenedoresFisicos.reduce((acc, c) => acc + c.lenUsada, 0);
        let volTotal = res.contenedoresFisicos.reduce((acc, c) => acc + c.volActual, 0);

        let penalizacion = (unpackedCount * 10000000) + (contsUsados * 1000000) + (lenTotal * 10) - (volTotal * 100);

        if (penalizacion < mejorPuntaje) {
            mejorPuntaje = penalizacion;
            mejorResultado = res;
        }
    }

    return mejorResultado;
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

        let mejor = ejecutarBusquedaMultiPaso(cajasDisponibles, contenedoresInfo);

        self.postMessage({
            status: 'exito',
            contenedoresFisicos: mejor.contenedoresFisicos,
            instanciasCajas: mejor.instanciasCajas
        });
    } catch (err) {
        self.postMessage({ status: 'error', mensaje: 'Error matemático:\n' + err.message + '\n' + err.stack });
    }
};
