from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

class Space:
    def __init__(self, x, y, z, w, h, d):
        self.x = float(x)
        self.y = float(y)
        self.z = float(z)
        self.w = float(w)
        self.h = float(h)
        self.d = float(d)

    def contains(self, other):
        return (self.x <= other.x + 0.01 and self.y <= other.y + 0.01 and self.z <= other.z + 0.01 and
                self.x + self.w >= other.x + other.w - 0.01 and
                self.y + self.h >= other.y + other.h - 0.01 and
                self.z + self.d >= other.z + other.d - 0.01)

def intersect(s, b_x, b_y, b_z, b_w, b_h, b_d):
    return not (s.x + s.w <= b_x + 0.01 or b_x + b_w <= s.x + 0.01 or
                s.y + s.h <= b_y + 0.01 or b_y + b_h <= s.y + 0.01 or
                s.z + s.d <= b_z + 0.01 or b_z + b_d <= s.z + 0.01)

def subtract_box(s, b_x, b_y, b_z, b_w, b_h, b_d):
    if not intersect(s, b_x, b_y, b_z, b_w, b_h, b_d):
        return [s]
    
    new_spaces = []
    if b_x > s.x + 0.01:
        new_spaces.append(Space(s.x, s.y, s.z, b_x - s.x, s.h, s.d))
    if b_x + b_w < s.x + s.w - 0.01:
        new_spaces.append(Space(b_x + b_w, s.y, s.z, (s.x + s.w) - (b_x + b_w), s.h, s.d))
    if b_y > s.y + 0.01:
        new_spaces.append(Space(s.x, s.y, s.z, s.w, b_y - s.y, s.d))
    if b_y + b_h < s.y + s.h - 0.01:
        new_spaces.append(Space(s.x, b_y + b_h, s.z, s.w, (s.y + s.h) - (b_y + b_h), s.d))
    if b_z > s.z + 0.01:
        new_spaces.append(Space(s.x, s.y, s.z, s.w, s.h, b_z - s.z))
    if b_z + b_d < s.z + s.d - 0.01:
        new_spaces.append(Space(s.x, s.y, b_z + b_d, s.w, s.h, (s.z + s.d) - (b_z + b_d)))

    return [sp for sp in new_spaces if sp.w > 0.1 and sp.h > 0.1 and sp.d > 0.1]

def update_spaces(spaces, b_x, b_y, b_z, b_w, b_h, b_d):
    updated = []
    for s in spaces:
        if intersect(s, b_x, b_y, b_z, b_w, b_h, b_d):
            subs = subtract_box(s, b_x, b_y, b_z, b_w, b_h, b_d)
            updated.extend(subs)
        else:
            updated.append(s)

    maximal = []
    for i, s1 in enumerate(updated):
        is_sub = False
        for j, s2 in enumerate(updated):
            if i != j and s2.contains(s1):
                if (abs(s1.x - s2.x) < 0.1 and abs(s1.y - s2.y) < 0.1 and abs(s1.z - s2.z) < 0.1 and
                    abs(s1.w - s2.w) < 0.1 and abs(s1.h - s2.h) < 0.1 and abs(s1.d - s2.d) < 0.1 and i > j):
                    continue
                is_sub = True
                break
        if not is_sub:
            maximal.append(s1)
    return maximal

def update_spaces_with_ground_support_cap(spaces, b_x, b_y, b_z, b_w, b_h, b_d, cajas_colocadas):
    updated_spaces = update_spaces(spaces, b_x, b_y, b_z, b_w, b_h, b_d)
    
    capped_spaces = []
    for sp in updated_spaces:
        if sp.y > 0.1:
            supporting = [
                c for c in cajas_colocadas
                if abs((c['y'] + c['drawH']) - sp.y) < 0.5 and
                min(sp.x + sp.w, c['x'] + c['drawW']) > max(sp.x, c['x']) + 0.1 and
                c['z'] + c['drawD'] > sp.z + 0.1
            ]
            if supporting:
                max_supp_z = max(c['z'] + c['drawD'] for c in supporting)
                if sp.z + sp.d > max_supp_z:
                    new_d = max_supp_z - sp.z
                    if new_d > 0.1:
                        capped_spaces.append(Space(sp.x, sp.y, sp.z, sp.w, sp.h, new_d))
                else:
                    capped_spaces.append(sp)
        else:
            capped_spaces.append(sp)
            
    maximal = []
    for i, s1 in enumerate(capped_spaces):
        is_sub = False
        for j, s2 in enumerate(capped_spaces):
            if i != j and s2.contains(s1):
                if (abs(s1.x - s2.x) < 0.1 and abs(s1.y - s2.y) < 0.1 and abs(s1.z - s2.z) < 0.1 and
                    abs(s1.w - s2.w) < 0.1 and abs(s1.h - s2.h) < 0.1 and abs(s1.d - s2.d) < 0.1 and i > j):
                    continue
                is_sub = True
                break
        if not is_sub:
            maximal.append(s1)
    return maximal

def obtener_rotaciones(caja):
    w = max(0.1, float(caja.get('w', 1)))
    h = max(0.1, float(caja.get('h', 1)))
    d = max(0.1, float(caja.get('d', 1)))
    
    no_turn = caja.get('noTurn', False)
    no_tilt = caja.get('noTilt', False) or (caja.get('shape') == 'pallet')
    
    rots = [{'w': w, 'h': h, 'd': d}]
    if not no_turn:
        rots.append({'w': d, 'h': h, 'd': w})
    if not no_tilt:
        rots.append({'w': w, 'h': d, 'd': h})
        rots.append({'w': h, 'h': w, 'd': d})
        if not no_turn:
            rots.append({'w': d, 'h': w, 'd': h})
            rots.append({'w': h, 'h': d, 'd': w})
            
    unicos = []
    for r in rots:
        if not any(abs(u['w']-r['w'])<0.1 and abs(u['h']-r['h'])<0.1 and abs(u['d']-r['d'])<0.1 for u in unicos):
            unicos.append(r)
    return unicos

def es_soporte_valido(px, py, pz, bw, bd, cajas_colocadas):
    if py <= 0.1:
        return True
    
    overlapping_supp = [
        c for c in cajas_colocadas 
        if abs((c['y'] + c['drawH']) - py) < 0.5 and 
        min(px + bw, c['x'] + c['drawW']) > max(px, c['x']) + 0.1
    ]
    
    if not overlapping_supp:
        return False

    area_total = bw * bd
    area_soportada = 0.0
    
    for c in overlapping_supp:
        inter_x1 = max(px, c['x'])
        inter_x2 = min(px + bw, c['x'] + c['drawW'])
        inter_z1 = max(pz, c['z'])
        inter_z2 = min(pz + bd, c['z'] + c['drawD'])
        
        if inter_x2 > inter_x1 and inter_z2 > inter_z1:
            area_soportada += (inter_x2 - inter_x1) * (inter_z2 - inter_z1)
            
    if (area_soportada / area_total) < 0.75:
        return False

    max_supp_z = max(c['z'] + c['drawD'] for c in overlapping_supp)
    if pz + bd > max_supp_z + 0.5:
        return False

    return True

def calcular_mejor_bloque(sp, ori_w, ori_h, ori_d, available_qty, is_on_floor=False):
    max_nx = int((sp.w + 0.01) // ori_w)
    max_ny = 1 if is_on_floor else int((sp.h + 0.01) // ori_h)
    max_nz = int((sp.d + 0.01) // ori_d)
    
    if max_nx <= 0 or max_ny <= 0 or max_nz <= 0:
        return 0, 0, 0, 0
        
    layer_capacity = max_nx * max_ny
    
    if available_qty >= layer_capacity:
        nz = min(max_nz, available_qty // layer_capacity)
        return max_nx, max_ny, nz, max_nx * max_ny * nz
    else:
        b_nx, b_ny, max_count = 0, 0, 0
        for x in range(1, max_nx + 1):
            for y in range(1, max_ny + 1):
                count = x * y
                if count <= available_qty:
                    if count > max_count:
                        max_count = count
                        b_nx, b_ny = x, y
                    elif count == max_count:
                        if x > b_nx:
                            b_nx, b_ny = x, y
        return b_nx, b_ny, 1, max_count

def empaquetar(cajas_disponibles, cont, cont_idx=0):
    spaces = [Space(0, 0, 0, float(cont['w']), float(cont['h']), float(cont['d']))]
    max_weight = float(cont.get('maxWeight', 9999999))
    container_width = float(cont['w'])

    # 1. Conservar intactas las cajas bloqueadas que pertenecen a este contenedor
    cajas_bloqueadas = [c for c in cajas_disponibles if c.get('locked') and c.get('contIdx') == cont_idx]
    cajas_libres = [c for c in cajas_disponibles if c not in cajas_bloqueadas]

    for b in cajas_bloqueadas:
        cont['cajas'].append(b)
        cont['pesoActual'] += float(b.get('weight', 0))
        spaces = update_spaces_with_ground_support_cap(
            spaces, float(b['x']), float(b['y']), float(b['z']),
            float(b['drawW']), float(b['drawH']), float(b['drawD']), cont['cajas']
        )

    # 2. Organizar cajas libres por grupos y prioridad
    group_map = {}
    group_order = []
    for c in cajas_libres:
        sig = str(c.get('groupId', c.get('id', '')))
        if sig not in group_map:
            group_map[sig] = {
                'sample': c,
                'qty': 0,
                'items': [],
                'is_pallet': 1 if (c.get('shape') == 'pallet' or c.get('onFloor')) else 0,
                'unit_vol': float(c.get('w', 1)) * float(c.get('h', 1)) * float(c.get('d', 1))
            }
            group_order.append(sig)
        group_map[sig]['qty'] += 1
        group_map[sig]['items'].append(c)
        
    grupos = [group_map[sig] for sig in group_order]

    while any(g['qty'] > 0 for g in grupos) and spaces:
        spaces.sort(key=lambda s: (round(s.z, 2), round(s.y, 2), round(s.x, 2)))
        z_max = max([0.0] + [c['z'] + c['drawD'] for c in cont['cajas']]) if cont['cajas'] else 0.0
        
        gap_candidates = []
        depth_candidates = []
        
        for sp in spaces:
            for g in grupos:
                if g['qty'] <= 0:
                    continue
                caja = g['sample']
                if caja.get('onFloor', False) and sp.y > 0.1:
                    continue
                    
                peso_caja = float(caja.get('weight', 0))
                available_qty = g['qty']
                if peso_caja > 0:
                    max_wgt_qty = int((max_weight - cont['pesoActual']) // peso_caja)
                    available_qty = min(available_qty, max_wgt_qty)
                if available_qty <= 0:
                    continue
                    
                oris = obtener_rotaciones(caja)
                for ori in oris:
                    if ori['w'] > sp.w + 0.01 or ori['h'] > sp.h + 0.01 or ori['d'] > sp.d + 0.01:
                        continue
                        
                    nx, ny, nz, count = calcular_mejor_bloque(
                        sp, ori['w'], ori['h'], ori['d'], available_qty, is_on_floor=caja.get('onFloor', False)
                    )
                    if count <= 0:
                        continue
                        
                    bw, bh, bd = nx * ori['w'], ny * ori['h'], nz * ori['d']
                    
                    if (bd / max(0.1, bw)) > 2.5 and bw < container_width * 0.4:
                        continue
                        
                    if not es_soporte_valido(sp.x, sp.y, sp.z, bw, bd, cont['cajas']):
                        continue
                        
                    block_vol = count * ori['w'] * ori['h'] * ori['d']
                    cand = {
                        'space': sp, 'group': g, 'ori': ori,
                        'nx': nx, 'ny': ny, 'nz': nz,
                        'bw': bw, 'bh': bh, 'bd': bd,
                        'count': count, 'block_vol': block_vol,
                        'unit_vol': g['unit_vol'], 'is_pallet': g['is_pallet']
                    }
                    
                    if z_max > 0.1 and (sp.z + bd) <= z_max + 0.1:
                        gap_candidates.append(cand)
                    else:
                        depth_candidates.append(cand)
                        
        best_placement = None
        if gap_candidates:
            gap_candidates.sort(
                key=lambda c: (
                    c['is_pallet'],
                    c['block_vol'],
                    -round(c['space'].z, 2),
                    -round(c['space'].y, 2),
                    -round(c['space'].x, 2)
                ),
                reverse=True
            )
            best_placement = gap_candidates[0]
        elif depth_candidates:
            depth_candidates.sort(
                key=lambda c: (
                    c['is_pallet'],
                    c['unit_vol'],
                    c['block_vol'],
                    -round(c['space'].z, 2),
                    -round(c['space'].y, 2),
                    -round(c['space'].x, 2)
                ),
                reverse=True
            )
            best_placement = depth_candidates[0]
            
        if best_placement:
            sp = best_placement['space']
            g = best_placement['group']
            ori = best_placement['ori']
            nx, ny, nz = best_placement['nx'], best_placement['ny'], best_placement['nz']
            bw, bh, bd = best_placement['bw'], best_placement['bh'], best_placement['bd']
            
            for iz in range(nz):
                for iy in range(ny):
                    for ix in range(nx):
                        inst = g['items'].pop()
                        inst['x'] = round(sp.x + ix * ori['w'], 2)
                        inst['y'] = round(sp.y + iy * ori['h'], 2)
                        inst['z'] = round(sp.z + iz * ori['d'], 2)
                        inst['drawW'] = ori['w']
                        inst['drawH'] = ori['h']
                        inst['drawD'] = ori['d']
                        
                        cont['cajas'].append(inst)
                        cont['pesoActual'] += float(inst.get('weight', 0))
                        
            g['qty'] -= best_placement['count']
            spaces = update_spaces_with_ground_support_cap(
                spaces, sp.x, sp.y, sp.z, bw, bh, bd, cont['cajas']
            )
        else:
            break

    cont['volActual'] = sum((float(c['drawW']) * float(c['drawH']) * float(c['drawD'])) / 1000000.0 for c in cont['cajas'])
    cont['lenUsada'] = max([0.0] + [float(c['z']) + float(c['drawD']) for c in cont['cajas']]) if cont['cajas'] else 0.0

    unpacked = []
    for g in grupos:
        if g['items']:
            unpacked.extend(g['items'])
            
    return cont, unpacked


@app.route('/', methods=['GET'])
def index():
    return "<h1>✅ SmartLoad Python Backend V14.0</h1><p>Soporte de Bloqueo Estricto y Control Manual de Carga.</p>"


@app.route('/optimizar', methods=['POST', 'OPTIONS'])
def optimizar_carga():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    try:
        data = request.get_json(force=True, silent=True) or {}
        cajas_disponibles = data.get('instanciasCajas', [])
        contenedores_info = data.get('contenedoresFisicos', [])
        
        if not cajas_disponibles or not contenedores_info:
            return jsonify({"status": "error", "mensaje": "Datos insuficientes."}), 200
            
        resultado_final = []
        remaining = cajas_disponibles
        
        for c in remaining:
            if not c.get('locked'):
                c['x'] = c['y'] = c['z'] = 0.0
                c['drawW'] = max(0.1, float(c.get('w', 1)))
                c['drawH'] = max(0.1, float(c.get('h', 1)))
                c['drawD'] = max(0.1, float(c.get('d', 1)))
        
        for idx, info in enumerate(contenedores_info):
            cont_cand = {
                'tipoKey': info.get('tipoKey', '40ft'),
                'nombre': info.get('nombre', 'Container'),
                'w': float(info.get('w', 233)),
                'h': float(info.get('h', 239)),
                'd': float(info.get('d', 1201)),
                'maxWeight': float(info.get('maxWeight', 26500)),
                'maxVol': float(info.get('maxVol', 67.5)),
                'cajas': [], 'pesoActual': 0.0, 'volActual': 0.0, 'lenUsada': 0.0
            }
            cont_resultado, remaining = empaquetar(remaining, cont_cand, cont_idx=idx)
            resultado_final.append(cont_resultado)

        if len(remaining) > 0 and contenedores_info:
            ultimo_info = contenedores_info[-1]
            idx_extra = len(contenedores_info)
            while len(remaining) > 0:
                cont_cand = {
                    'tipoKey': ultimo_info.get('tipoKey', '40ft'),
                    'nombre': ultimo_info.get('nombre', 'Container'),
                    'w': float(ultimo_info.get('w', 233)),
                    'h': float(ultimo_info.get('h', 239)),
                    'd': float(ultimo_info.get('d', 1201)),
                    'maxWeight': float(ultimo_info.get('maxWeight', 26500)),
                    'maxVol': float(ultimo_info.get('maxVol', 67.5)),
                    'cajas': [], 'pesoActual': 0.0, 'volActual': 0.0, 'lenUsada': 0.0
                }
                cont_resultado, remaining = empaquetar(remaining, cont_cand, cont_idx=idx_extra)
                if len(cont_resultado['cajas']) == 0:
                    break
                resultado_final.append(cont_resultado)
                idx_extra += 1

        instancias_finales = []
        for idx, cont in enumerate(resultado_final):
            for c in cont['cajas']:
                c['contIdx'] = idx
                instancias_finales.append(c)
                
        for c in remaining:
            c['contIdx'] = -1
            instancias_finales.append(c)

        return jsonify({"status": "exito", "contenedoresFisicos": resultado_final, "instanciasCajas": instancias_finales}), 200
        
    except Exception as e:
        return jsonify({"status": "error", "mensaje": f"Error matemático:\n{str(e)}\n{traceback.format_exc()}"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
