/* Geoarquitec · Subsuelo SPT — app.js
   Datos: data/sondeos.js (SONDEOS), data/intervalos.js (INTERVALOS), data/meta.js (META)
   Librerías: MapLibre GL (mapa) + deck.gl (columnas 3D). Sin servidor: funciona con doble clic en index.html. */

const $ = id => document.getElementById(id);
const fmt = (v,d=1) => v==null||isNaN(v) ? '—' : Number(v).toLocaleString('es-EC',{maximumFractionDigits:d,minimumFractionDigits:0});


/* ---------- paletas ---------- */
const SUCS_COLOR = {
  GW:[72,88,112], GP:[96,112,136], 'GP-GM':[110,126,150], GM:[128,144,168], 'GW-GM':[118,134,158], GC:[150,150,170],
  SW:[214,168,78], SP:[224,180,96], 'SW-SM':[230,190,110], SM:[236,200,120], 'SC-SM':[222,176,104], SC:[206,152,80],
  ML:[132,164,96], 'CL-ML':[150,172,110], CL:[108,146,92], MH:[168,112,76], CH:[146,84,62], OH:[92,64,50], OL:[104,78,60], PT:[70,50,40],
  NONE:[90,98,108]
};
const sucsKey = s => { s = String(s || 'NONE').trim().toUpperCase(); if (SUCS_COLOR[s]) return s; const k = Object.keys(SUCS_COLOR).find(x => s.startsWith(x)); return k || 'NONE'; };
const N60_STOPS = [[0,[253,224,71]],[10,[245,158,11]],[20,[249,115,22]],[30,[239,68,68]],[40,[185,28,28]]];
const N60_LABELS = ['< 10 · Muy baja resistencia','10 – 19 · Baja resistencia','20 – 29 · Resistencia media','30 – 39 · Alta resistencia','≥ 40 · Muy alta resistencia'];
const HUM_STOPS = [[0,[224,190,96]],[15,[150,190,110]],[25,[96,170,150]],[35,[90,120,200]],[50,[70,80,170]]];
function ramp(v, stops){ if (v == null || isNaN(v)) return [120,120,120]; if (v <= stops[0][0]) return stops[0][1]; for (let i = 1; i < stops.length; i++){ if (v <= stops[i][0]){ const [a,ca] = stops[i-1], [b,cb] = stops[i], t = (v-a)/(b-a); return ca.map((c,j)=>Math.round(c+(cb[j]-c)*t)); } } return stops[stops.length-1][1]; }
const CAL_COLOR = { ok:[91,189,122], legado:[224,164,88], est:[127,179,213] };

/* ---------- estado ---------- */
const S = { mode:'up', exag:25, raster:'qadm_pred', rasterOp:0.25, terrain:true, hillshade:true, terrainEx:1.5, colorBy:'sucs', ambito:'URBANO', canton:'', parr:'', anio:'', sucs:'', q:'', sel:null, base:'dark', tilt:true, parrOn:true, parrLab:true };
const sondById = new Map(SONDEOS.map(s => [s.id_spt, s]));
const pub = s => s.codigo_publico || ('SPT-' + s.id_spt);  // código anonimizado para la interfaz
const sentence = x => { x = String(x||'').trim().toLowerCase(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : '—'; };
function suelo(s, ints){ const top = ints.find(i => i.descripcion) || null; return top ? sentence(top.descripcion) : '—'; }  // descripción del estrato más superficial
const qOrig = s => s.qadm_origen==='LEGADO_REVISADO' ? ' · legado' : (s.qadm_origen==='CONJUNTO_INFORME' ? ' · cálculo conjunto' : '');
function sucsAashto(s, ints){ const sucs = [...new Set(ints.map(i=>i.sucs).filter(Boolean))].slice(0,3).join(', ') || '—'; return sucs + ' / ' + (s.aashto_ref || '—'); }
// Parroquia de cada sondeo (punto en polígono, ray casting sobre el GeoJSON WGS84)
function pip(pt, ring){ let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++){ const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) c = !c; } return c; }
function inGeom(pt, g){ const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; return polys.some(p => pip(pt, p[0]) && !p.slice(1).some(h => pip(pt, h))); }
const PARR_FC = JSON.parse(JSON.stringify(PARROQUIAS));
SONDEOS.forEach(s => { s.parroquia = null; s.urbano = false; if (s.lon == null) return; const pt = [s.lon, s.lat]; const f = PARROQUIAS.features.find(f => f.properties.nivel === 'urbana' && inGeom(pt, f.geometry)) || PARROQUIAS.features.find(f => f.properties.nivel === 'parroquia' && inGeom(pt, f.geometry)); if (f){ s.parroquia = f.properties.nombre; s.canton_parr = f.properties.canton; } s.urbano = inGeom([s.lon, s.lat], PERIMETRO); });
PARR_FC.features.forEach(f => { f.properties.n_sondeos = f.properties.nivel === 'cabecera' ? 0 : SONDEOS.filter(s => s.parroquia === f.properties.nombre && (f.properties.nivel === 'urbana' || s.canton_parr === f.properties.canton)).length; f.properties.con_sondeos = f.properties.n_sondeos > 0; });
const intervalsBySond = new Map(); INTERVALOS.forEach(i => { if (!intervalsBySond.has(i.id_spt)) intervalsBySond.set(i.id_spt, []); intervalsBySond.get(i.id_spt).push(i); });
intervalsBySond.forEach(a => a.sort((x,y)=>x.prof_desde_m-y.prof_desde_m));
const profMax = new Map(); intervalsBySond.forEach((a, id) => profMax.set(id, Math.max(...a.map(i => i.prof_hasta_m || 0))));

/* ---------- filtros ---------- */
function fill(sel, vals){ vals.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); }); }
fill($('f-canton'), [...new Set(SONDEOS.map(s=>s.canton).filter(Boolean))].sort());
fill($('f-parr'), [...new Set(SONDEOS.map(s=>s.parroquia).filter(Boolean))].sort());
fill($('f-sucs'), [...new Set(INTERVALOS.map(i=>sucsKey(i.sucs)))].sort());

function visibleSondeos(){
  const q = S.q.toLowerCase();
  return SONDEOS.filter(s => s.lon != null
    && (!S.ambito || s.urbano)
    && (!S.canton || s.canton === S.canton)
    && (!S.parr || s.parroquia === S.parr)
    && (!q || pub(s).toLowerCase().includes(q) || s.id_spt.toLowerCase().includes(q))
    && (!S.sucs || (intervalsBySond.get(s.id_spt)||[]).some(i => sucsKey(i.sucs) === S.sucs)));
}
function n60Origin(i){ return i.n60_ref_reportado != null ? 'REPORTADO' : (i.n60_ref_estimado != null ? 'ESTIMADO' : null); }
function n60Val(i){ return i.n60_ref_reportado != null ? i.n60_ref_reportado : i.n60_ref_estimado; }
function visibleIntervals(ids){ return INTERVALOS.filter(i => ids.has(i.id_spt)); }

/* ---------- color ---------- */
function colorFor(i, s){
  let c;
  if (S.colorBy === 'sucs') c = SUCS_COLOR[sucsKey(i.sucs)];
  else if (S.colorBy === 'n60') c = ramp(n60Val(i), N60_STOPS);
  else if (S.colorBy === 'hum') c = ramp(i.humedad_ref_pct, HUM_STOPS);
  else c = s.estado_mapa === 'XY_LEGADO_PENDIENTE' ? CAL_COLOR.legado : (n60Origin(i) === 'ESTIMADO' ? CAL_COLOR.est : CAL_COLOR.ok);
  const a = (S.sel && S.sel !== i.id_spt) ? 170 : 255;
  return [...c, a];
}
function legend(){
  const L = $('legend'); L.innerHTML = '';
  const it = (col, txt) => `<span class="it"><span class="sw" style="background:rgb(${col.join(',')})"></span>${txt}</span>`;
  if (S.colorBy === 'sucs') L.innerHTML = ['GM','GP','GC','SM','SP','SC','ML','CL','CL-ML','MH','CH','OH','NONE'].map(k => it(SUCS_COLOR[k], k === 'NONE' ? 'sin SUCS' : k)).join('');
  else if (S.colorBy === 'n60') L.innerHTML = N60_STOPS.map(([v,c],k) => it(c, N60_LABELS[k].split(' · ')[0])).join('');
  else if (S.colorBy === 'hum') L.innerHTML = HUM_STOPS.map(([v,c]) => it(c, v + ' %')).join('');
  else L.innerHTML = it(CAL_COLOR.ok,'XY de informe · N60 reportado') + it(CAL_COLOR.est,'N60 estimado') + it(CAL_COLOR.legado,'XY del legado, cotejo pendiente');
}

/* ---------- mapa ---------- */
// Con doble clic (file://) el navegador bloquea fetch a archivos locales: usamos data/embebido.js (base64) vía protocolo emb://
const LOCAL = location.protocol === 'file:' && typeof EMB !== 'undefined';
const rasterUrl = (k, kind) => LOCAL ? 'data:image/png;base64,' + EMB.rasters[`${k}_${kind}`] : `data/rasters/${k}_${kind}.png`;
if (LOCAL) maplibregl.addProtocol('emb', async (params) => { const key = params.url.replace('emb://', ''); const b64 = EMB.terrain[key]; if (!b64) throw new Error('sin tesela ' + key);
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return { data: u8.buffer }; });
const DEM_TILES = LOCAL ? ['emb://{z}/{x}/{y}'] : ['data/terrain/{z}/{x}/{y}.png'];
const BASES = {
  dark: { tiles:[], attribution:'' },  // Dark Tech: solo relieve sombreado del MDT, sin cartografía externa
  sat:  { tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution:'Imágenes © Esri' },
  topo: { tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'], attribution:'Topográfico © Esri' },
  osm:  { tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution:'© OpenStreetMap contributors' }
};
function rasterSources(){
  const o = {}; for (const k in RASTERS){ const b = RASTERS[k].bounds; // [W,N,E,S]
    o['r_'+k] = { type:'image', url:rasterUrl(k,'rgb'), coordinates:[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]] }; }
  return o;
}
function style(base){
  const layers = [
    { id:'bg', type:'background', paint:{'background-color': base === 'dark' ? '#0b0f14' : '#0f1419'} },
    { id:'base', type:'raster', source:'base', layout:{ visibility: base === 'dark' ? 'none' : 'visible' }, paint:{ 'raster-opacity': S.mode==='sub' ? 0.55 : 0.95, 'raster-saturation': -0.2 } },
    { id:'hillshade', type:'hillshade', source:'dem', layout:{ visibility: S.hillshade ? 'visible' : 'none' }, paint: base === 'dark'
        ? { 'hillshade-exaggeration':0.55, 'hillshade-shadow-color':'#05080c', 'hillshade-highlight-color':'#8fa6bd', 'hillshade-accent-color':'#1e2a38', 'hillshade-illumination-direction':335 }
        : { 'hillshade-exaggeration':0.3, 'hillshade-shadow-color':'#0b0f14', 'hillshade-highlight-color':'#f0e6d2', 'hillshade-accent-color':'#3a4656' } },
    { id:'parroquias-fill', type:'fill', source:'parroquias', layout:{ visibility: S.parrOn ? 'visible' : 'none' }, paint:{ 'fill-color':['case', ['get','con_sondeos'], '#ec8046', '#9aa8b6'], 'fill-opacity':['case', ['==', ['get','nivel'], 'cabecera'], 0, ['get','con_sondeos'], 0.10, 0.04] } },
  ];
  for (const k in RASTERS) layers.push({ id:'r_'+k, type:'raster', source:'r_'+k, layout:{ visibility: S.raster===k ? 'visible' : 'none' }, paint:{ 'raster-opacity': S.rasterOp, 'raster-resampling':'nearest', 'raster-fade-duration':0 } });
  layers.push({ id:'parroquias', type:'line', source:'parroquias', layout:{ visibility: S.parrOn ? 'visible' : 'none' }, paint:{ 'line-color':['case', ['get','con_sondeos'], '#ec8046', '#6b7785'], 'line-width':['case', ['get','con_sondeos'], 1.4, 1], 'line-opacity':['case', ['get','con_sondeos'], 0.75, 0.45], 'line-dasharray':[2,2] } });
  layers.push({ id:'perimetro', type:'line', source:'perimetro', paint:{ 'line-color':'#e0a458', 'line-width':2, 'line-dasharray':[3,2], 'line-opacity':0.9 } });
  return { version:8,
    sources:{ base:{ type:'raster', tiles:BASES[base].tiles, tileSize:256, attribution:BASES[base].attribution, maxzoom:19 },
      dem:{ type:'raster-dem', tiles:DEM_TILES, tileSize:256, encoding:'terrarium', minzoom:9, maxzoom:15, attribution:'MDT 3 m · GEOARQUITEC' },
      perimetro:{ type:'geojson', data:{ type:'Feature', geometry:PERIMETRO, properties:{} } },
      parroquias:{ type:'geojson', data:PARR_FC },
      ...rasterSources() },
    terrain: S.terrain ? { source:'dem', exaggeration:S.terrainEx } : undefined,
    layers };
}
const map = new maplibregl.Map({ container:'map', style: style(S.base), center:[-79.21,-3.99], zoom:12.3, pitch:0, bearing:0, maxPitch:75, antialias:true, attributionControl:true });
map.addControl(new maplibregl.NavigationControl({ visualizePitch:true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit:'metric' }), 'bottom-right');
const overlay = new deck.MapboxOverlay({ interleaved:true, layers:[] });
map.addControl(overlay);

/* ---------- capas deck ---------- */
function colRadius(){ const z = map ? map.getZoom() : 13; return Math.max(4, Math.min(140, 7 * Math.pow(2, 16 - z))); } // ~7 m a z16, ~56 m a z13, 140 m máx.

function layers(){
  const vs = visibleSondeos(); const ids = new Set(vs.map(s=>s.id_spt));
  const vi = visibleIntervals(ids);
  const ex = S.exag;
  // Columna por intervalo: en "sub" la base está a -prof_hasta·ex (bajo la superficie), altura = espesor·ex.
  // En "up" se apila hacia arriba: base = prof_desde·ex.
  const z0 = i => (S.terrain ? (i.cota_sondeo_m||0)*S.terrainEx : 0);
  // Modo 'levantado': el perfil se alza sobre el terreno conservando el orden real (superficie arriba, fondo abajo):
  // base del intervalo = (prof_total - prof_hasta)·ex, así el estrato más superficial queda en la cima de la columna.
  const profTot = i => (profMax.get(i.id_spt) || i.prof_hasta_m);
  const getPos = i => [i.lon, i.lat, z0(i) + (S.mode === 'sub' ? -i.prof_hasta_m*ex : (profTot(i) - i.prof_hasta_m)*ex)];
  const getEl  = i => Math.max(0.2, (i.prof_hasta_m - i.prof_desde_m)) * ex;
  const cols = new deck.ColumnLayer({ id:'intervalos', data:vi, diskResolution:12, radius:colRadius(), extruded:true, pickable:true,
    getPosition:getPos, getElevation:getEl, getFillColor:i => colorFor(i, sondById.get(i.id_spt)), getLineColor:[15,20,25,200], lineWidthMinPixels:1, stroked:true, material:{ ambient:0.75, diffuse:0.55, shininess:16, specularColor:[40,40,40] },
    updateTriggers:{ getFillColor:[S.colorBy,S.sel], getPosition:[S.mode,ex,S.terrain,S.terrainEx], getElevation:[ex] },

    onHover: info => tip(info), onClick: info => info.object && pick(info.object.id_spt) });
  // Cabeza del sondeo en superficie
  const heads = new deck.ScatterplotLayer({ id:'cabezas', data:vs, pickable:true, radiusMinPixels:4, radiusMaxPixels:9, getPosition:s=>[s.lon,s.lat,(S.terrain?(s.elevacion_msnm||0)*S.terrainEx:0)+0.5],
    getFillColor:s => s.estado_mapa==='XY_LEGADO_PENDIENTE' ? [224,164,88] : [232,237,242], getLineColor:[15,20,25], lineWidthMinPixels:1, stroked:true,
    getRadius:12, onHover:info=>tip(info,true), onClick:info=>info.object && pick(info.object.id_spt) });
  // Eje vertical del sondeo seleccionado
  const sel = S.sel ? sondById.get(S.sel) : null;
  const axis = sel ? new deck.LineLayer({ id:'eje', data:[sel], getSourcePosition:s=>[s.lon,s.lat,(S.terrain?(s.elevacion_msnm||0)*S.terrainEx:0)+(S.mode==='sub'?-(s.prof_max||s.profundidad_total_m||6)*ex-2:0)], getTargetPosition:s=>[s.lon,s.lat,(S.terrain?(s.elevacion_msnm||0)*S.terrainEx:0)+(S.mode==='sub'?3:(s.prof_max||6)*ex+2)], getColor:[224,164,88], getWidth:2, widthUnits:'pixels' }) : null;
  const rech = new deck.ScatterplotLayer({ id:'rechazos', data:vi.filter(i=>n60Val(i)!=null && n60Val(i)>=50), pickable:false, stroked:true, filled:false, radiusMinPixels:7, radiusMaxPixels:14, getRadius:14, lineWidthMinPixels:2,
    getPosition:i=>[i.lon,i.lat,z0(i)+1], getLineColor:[224,164,88,230] });
  const labels = (S.parrOn && S.parrLab) ? new deck.TextLayer({ id:'parr-lab', data:PARR_FC.features.filter(f => f.properties.nivel === 'cabecera' ? map.getZoom() < 12.5 : (f.properties.etiqueta !== false && (f.properties.con_sondeos || f.properties.nivel === 'urbana') && (f.properties.nivel === 'urbana' ? map.getZoom() >= 12.5 : map.getZoom() < 14.5))), getPosition:f=>[f.properties.lon, f.properties.lat, (S.terrain ? 2300*S.terrainEx : 0)], getText:f=>f.properties.nivel === 'cabecera' ? 'LOJA' : f.properties.nombre.toUpperCase(), getSize:f => f.properties.nivel === 'cabecera' ? 16 : (f.properties.nivel === 'urbana' ? 13 : 11), getColor:f => f.properties.nivel !== 'parroquia' ? [255,255,255,225] : [236,128,70,220], fontFamily:'Manrope, sans-serif', fontWeight:700, outlineWidth:3, outlineColor:[15,20,25,230], fontSettings:{ sdf:true }, characterSet:'auto', billboard:true, getTextAnchor:'middle', getAlignmentBaseline:'center' }) : null;
  const corteLine = CORTE.ids.length > 1 ? new deck.PathLayer({ id:'corte-linea', data:[CORTE.ids.map(id => { const s = sondById.get(id); return [s.lon, s.lat, (S.terrain ? (s.elevacion_msnm||0)*S.terrainEx : 0) + 2]; })], getPath:d=>d, getColor:[255,255,255,230], getWidth:3, widthUnits:'pixels', getDashArray:[6,4], dashJustified:true, extensions:[new deck.PathStyleExtension({ dash:true })] }) : null;
  const corteMarks = CORTE.ids.length ? new deck.ScatterplotLayer({ id:'corte-marcas', data:CORTE.ids.map(id=>sondById.get(id)), getPosition:s=>[s.lon,s.lat,(S.terrain?(s.elevacion_msnm||0)*S.terrainEx:0)+1], radiusMinPixels:9, radiusMaxPixels:16, getRadius:16, stroked:true, filled:false, lineWidthMinPixels:3, getLineColor:[255,255,255,240] }) : null;
  overlay.setProps({ layers:[cols, heads, rech, axis, labels, corteLine, corteMarks].filter(Boolean) });
  $('k-sond').textContent = vs.length;
  return vs;
}
const TOUCH = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;  // en pantallas táctiles no hay "pasar el cursor": solo la ficha al tocar
function tip(info, head){
  const t = $('tip'); if (!info.object || TOUCH){ t.hidden = true; return; }
  const o = info.object; t.hidden = false; t.style.left = (info.x+14)+'px'; t.style.top = (info.y+14)+'px';
  const s = head ? o : sondById.get(o.id_spt); const ints = intervalsBySond.get(s.id_spt)||[];
  const n2 = s.n60_2m_rep!=null ? fmt(s.n60_2m_rep,0)+' (rep.)' : (s.n60_2m_est!=null ? fmt(s.n60_2m_est,0)+' (est.)' : '—');
  const sucs = [...new Set(ints.map(i=>i.sucs).filter(Boolean))].slice(0,3).join(', ') || '—'; const top = ints[0];
  const r = (k,v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  let extra = '';
  if (!head){ const n = n60Val(o), org = n60Origin(o); extra = r('Intervalo', `${fmt(o.prof_desde_m,2)}–${fmt(o.prof_hasta_m,2)} m · ${o.sucs||'—'}`) + r('N60 intervalo', `${n!=null?fmt(n,0):'—'}${org?' ('+org.toLowerCase().slice(0,3)+'.)':''}`); }
  t.innerHTML = `<div class="tt-head"><b>${pub(s)}</b><span>${s.parroquia||s.canton||''} · ${s.anio||''}</span></div><table>` + extra +
    r('Elevación', fmt(s.elevacion_msnm,0)+' msnm') + r('Profundidad', fmt(s.profundidad_total_m,2)+' m') + r('N60 a 2 m', n2) +
    r('q adm', s.qadm_kg_cm2!=null ? fmt(s.qadm_kg_cm2,2)+' kg/cm²' : '—') + r('Humedad', top&&top.humedad_ref_pct!=null ? fmt(top.humedad_ref_pct,1)+' %' : '—') +
    r('SUCS / AASHTO', sucsAashto(s, ints)) + r('Nivel freático', s.nivel_freatico||'—') + r('Tipo de suelo', suelo(s, ints)) + `</table><div class="tt-foot">Clic: registro completo</div>`;
}

/* ---------- ficha + perfil ---------- */
function select(id){
  S.sel = id; $('tip').hidden = true; const s = sondById.get(id); const ints = intervalsBySond.get(id)||[];
  $('ficha').hidden = false; $('ficha-id').textContent = pub(s);
  const rows = [['Parroquia', s.parroquia||'—'],['Cantón / año', `${s.canton||'—'} / ${s.anio||'—'}`],['Cota', fmt(s.elevacion_msnm,2)+' msnm'],['Profundidad', fmt(s.profundidad_total_m,2)+' m'],
    ['Nivel freático', s.nivel_freatico||'—'],['N60 a 2 m', s.n60_2m_rep!=null?fmt(s.n60_2m_rep,0)+' (rep.)':(s.n60_2m_est!=null?fmt(s.n60_2m_est,0)+' (est.)':'—')],
    ['q adm', s.qadm_kg_cm2!=null?fmt(s.qadm_kg_cm2,2)+' kg/cm²'+(s.df_m!=null?' · Df '+fmt(s.df_m,1)+' m':'')+qOrig(s):'—'],['SUCS / AASHTO', sucsAashto(s, ints)],['Tipo de suelo', suelo(s, ints)],['Estado', s.estado_revision || (/NO_PUBLICAR|NO_APTO|CRS_VERTICAL|REFERENCIA_VERTICAL/.test(s.estado_qa||'') ? 'Revisión parcial · cota pendiente' : (/REVISADO_CON_QA/.test(s.estado_qa||'') && !/PENDIENTE/.test(s.estado_qa||'') ? 'Revisado' : 'Revisión parcial'))],['CRS', '32717']];
  $('ficha-meta').innerHTML = rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');
  perfil(s, ints);
  map.flyTo({ center:[s.lon,s.lat], zoom:Math.max(map.getZoom(),16), duration:900, offset:(window.innerWidth <= 860 && panelOpen()) ? [0, 40] : [0, 0] });
  popup(s, ints); layers();
}
let POP = null;
const panelOpen = () => !document.querySelector('.app').classList.contains('panel-collapsed');
function popup(s, ints){
  if (POP) POP.remove(); $('mini').hidden = true;
  // En el teléfono con el panel abierto el mapa es media pantalla: ficha compacta anclada arriba a la derecha en vez del globo
  if (window.innerWidth <= 860 && panelOpen()){
    const n2 = s.n60_2m_rep!=null ? fmt(s.n60_2m_rep,0)+' (rep.)' : (s.n60_2m_est!=null ? fmt(s.n60_2m_est,0)+' (est.)' : '—');
    const r = (k,v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    $('mini').innerHTML = `<div class="mh"><b>${pub(s)}</b><button id="mini-close" aria-label="Cerrar">✕</button></div><table>` +
      r('Parroquia', s.parroquia||s.canton||'—') + r('Elevación', fmt(s.elevacion_msnm,0)+' msnm') + r('Prof.', fmt(s.profundidad_total_m,2)+' m') + r('N60 a 2 m', n2) +
      r('q adm', s.qadm_kg_cm2!=null ? fmt(s.qadm_kg_cm2,2)+' kg/cm²' : '—') + r('SUCS', sucsAashto(s, ints)) + `</table><div class="mf">Detalle y perfil en el panel ↓</div>`;
    $('mini').hidden = false; $('mini-close').addEventListener('click', () => { $('mini').hidden = true; });
    return;
  }
  const n2 = s.n60_2m_rep!=null ? fmt(s.n60_2m_rep,0)+' (reportado)' : (s.n60_2m_est!=null ? fmt(s.n60_2m_est,0)+' (estimado)' : '—');
  const top = ints[0]; const sucs = [...new Set(ints.map(i=>i.sucs).filter(Boolean))].slice(0,3).join(', ') || '—';
  const rows = [['Parroquia', s.parroquia||'—'],['Cantón · año', `${s.canton||'—'} · ${s.anio||'—'}`],['Elevación', fmt(s.elevacion_msnm,0)+' msnm'],['Profundidad sondeo', fmt(s.profundidad_total_m,2)+' m'],
    ['N60 a 2 m', n2],['Capacidad portante', s.qadm_kg_cm2!=null ? fmt(s.qadm_kg_cm2,2)+' kg/cm²'+(s.df_m!=null?' (Df '+fmt(s.df_m,1)+' m)':'')+qOrig(s) : '—'],['Humedad natural', top&&top.humedad_ref_pct!=null ? fmt(top.humedad_ref_pct,1)+' %' : '—'],
    ['SUCS / AASHTO', sucsAashto(s, ints)],['Nivel freático', s.nivel_freatico||'No reportado'],['Tipo de suelo', suelo(s, ints)],['Estado', s.estado_revision || (/NO_PUBLICAR|NO_APTO|CRS_VERTICAL|REFERENCIA_VERTICAL/.test(s.estado_qa||'') ? 'Revisión parcial · cota pendiente' : (/REVISADO_CON_QA/.test(s.estado_qa||'') && !/PENDIENTE/.test(s.estado_qa||'') ? 'Revisado' : 'Revisión parcial'))],['CRS', '32717']];
  const html = `<div class="pop"><div class="pop-head"><span class="tag">${pub(s)}</span><span class="tag g">Anonimizado</span></div><h4>Registro geotécnico</h4>
    <table>${rows.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><span class="link hint">Perfil completo en el panel izquierdo ↙</span></div>`;
  POP = new maplibregl.Popup({ maxWidth:'320px', offset:14 }).setLngLat([s.lon,s.lat]).setHTML(html).addTo(map);
  document.querySelector('.map-wrap').classList.add('has-pop');
  POP.on('close', () => { POP = null; document.querySelector('.map-wrap').classList.remove('has-pop'); });
}
function lista(){
  const vs = visibleSondeos(); $('lista-n').textContent = vs.length;
  $('lista').innerHTML = vs.slice(0,400).map(s => `<button data-id="${s.id_spt}"><b>${pub(s)}</b><span>${s.parroquia||s.canton||''} · ${s.anio||''} · N60₂ₘ ${s.n60_2m_rep!=null?fmt(s.n60_2m_rep,0):(s.n60_2m_est!=null?fmt(s.n60_2m_est,0)+'*':'—')}</span></button>`).join('') + (vs.length>400?`<p class="hint">… y ${vs.length-400} más (afina los filtros)</p>`:'');
}
$('lista').addEventListener('click', e => { const b = e.target.closest('button'); if (b) select(b.dataset.id); });
function mapLegend(){
  const R = $('map-legend'), L = $('map-legend-int');
  if (S.raster){ const m = RASTERS[S.raster]; const grad = m.rampa.map(([p,c]) => `rgb(${c.join(',')}) ${p*100}%`).join(',');
    R.hidden = false; R.innerHTML = `<h3>${m.titulo}</h3><div class="legend-bar" style="background:linear-gradient(90deg,${grad})"></div><div class="legend-ticks"><span>${m.leyenda[0]} ${m.unidad}</span><span>${m.leyenda[1]} ${m.unidad}</span></div>`; }
  else R.hidden = true;
  const row = (c,t) => `<div class="row"><span class="sw" style="background:rgb(${c.join(',')})"></span>${t}</div>`;
  if (S.colorBy === 'n60') L.innerHTML = '<h3>N60 por intervalo</h3>' + N60_STOPS.map(([v,c],k) => row(c, N60_LABELS[k])).join('') + '<p class="sub">Anillo naranja: rechazo (N60 ≥ 50)</p>';
  else if (S.colorBy === 'hum') L.innerHTML = '<h3>Humedad natural</h3>' + HUM_STOPS.map(([v,c]) => row(c, v + ' %')).join('');
  else if (S.colorBy === 'calidad') L.innerHTML = '<h3>Estado de calidad</h3>' + row(CAL_COLOR.ok,'XY de informe · N60 reportado') + row(CAL_COLOR.est,'N60 estimado') + row(CAL_COLOR.legado,'XY del legado, cotejo pendiente');
  else L.innerHTML = '<h3>Clasificación SUCS</h3><div class="cols">' + ['GM','GP','GC','SM','SP','SC','ML','CL','CL-ML','MH','CH','OH'].map(k => row(SUCS_COLOR[k], k)).join('') + '</div>';
}
function perfil(s, ints){
  const svg = $('perfil'); const W=320,H=300, L=70, T=14, B=20, R=16; const pw=W-L-R, ph=H-T-B;
  const dmax = Math.max(1, ...ints.map(i=>i.prof_hasta_m||0), s.profundidad_total_m||0);
  const y = d => T + d/dmax*ph;
  const hatchOf = k => k.startsWith('G') ? 'h-grava' : k.startsWith('S') ? 'h-arena' : (k.startsWith('M') || k === 'CL-ML') ? 'h-limo' : (k.startsWith('C') ? 'h-arcilla' : (k.startsWith('O') || k === 'PT' ? 'h-organico' : null));
  let g = `<defs>
    <pattern id="h-grava" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.7" fill="none" stroke="#0f1419" stroke-width=".9"/><circle cx="8" cy="7.5" r="1.3" fill="none" stroke="#0f1419" stroke-width=".9"/></pattern>
    <pattern id="h-arena" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".8" fill="#0f1419"/><circle cx="4.5" cy="4" r=".8" fill="#0f1419"/></pattern>
    <pattern id="h-limo" width="10" height="6" patternUnits="userSpaceOnUse"><path d="M0 3 H4 M6 3 H10" stroke="#0f1419" stroke-width=".9"/></pattern>
    <pattern id="h-arcilla" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 2.5 H8" stroke="#0f1419" stroke-width=".9"/></pattern>
    <pattern id="h-organico" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8 L8 0" stroke="#0f1419" stroke-width=".9"/></pattern>
  </defs><rect width="${W}" height="${H}" fill="#0f1419"/>`;
  for (let d=0; d<=dmax; d+=1) g += `<line x1="${L-4}" x2="${W-R}" y1="${y(d)}" y2="${y(d)}" stroke="#2a3542" stroke-width="1"/><text x="${L-8}" y="${y(d)+4}" fill="#9aa8b6" font-size="10" text-anchor="end" font-family="JetBrains Mono">${d} m</text>`;
  ints.forEach(i => { const c = SUCS_COLOR[sucsKey(i.sucs)]; g += `<rect x="${L}" y="${y(i.prof_desde_m)}" width="34" height="${Math.max(1,y(i.prof_hasta_m)-y(i.prof_desde_m))}" fill="rgb(${c.join(',')})" stroke="#0f1419"><title>${i.sucs||'—'} · ${fmt(i.prof_desde_m,2)}–${fmt(i.prof_hasta_m,2)} m · ${i.descripcion||''}</title></rect><text x="${L+17}" y="${(y(i.prof_desde_m)+y(i.prof_hasta_m))/2+4}" fill="#0f1419" font-size="10" font-weight="700" text-anchor="middle" font-family="Manrope">${i.sucs||''}</text>`; });
  // eje N60: escala 0–80
  const x0 = L+50, xw = pw-50; const x = n => x0 + Math.min(n,80)/80*xw;
  [0,20,40,60,80].forEach(n => g += `<line x1="${x(n)}" x2="${x(n)}" y1="${T}" y2="${H-B}" stroke="#2a3542"/><text x="${x(n)}" y="${H-6}" fill="#9aa8b6" font-size="9" text-anchor="middle" font-family="JetBrains Mono">${n}</text>`);
  g += `<text x="${x0+xw/2}" y="${T-4}" fill="#e0a458" font-size="10" text-anchor="middle" font-family="Manrope" font-weight="700">N60 por intervalo</text>`;
  const pts = ints.filter(i=>n60Val(i)!=null).map(i=>({d:(i.prof_desde_m+i.prof_hasta_m)/2, n:n60Val(i), o:n60Origin(i)}));
  if (pts.length>1) g += `<polyline points="${pts.map(p=>x(p.n)+','+y(p.d)).join(' ')}" fill="none" stroke="#e0a458" stroke-width="1.5" opacity=".7"/>`;
  pts.forEach(p => g += `<circle cx="${x(p.n)}" cy="${y(p.d)}" r="4" fill="${p.o==='REPORTADO'?'#e0a458':'#0f1419'}" stroke="#e0a458" stroke-width="1.5"><title>N60 ${fmt(p.n,0)} (${p.o.toLowerCase()}) a ${fmt(p.d,2)} m</title></circle>`);
  if (!ints.length) g += `<text x="${W/2}" y="${H/2}" fill="#9aa8b6" font-size="12" text-anchor="middle" font-family="Manrope">Sin intervalos aptos para 3D en este sondeo</text>`;
  svg.innerHTML = g;
}

/* ---------- eventos ---------- */
function fit(){ const vs = visibleSondeos(); if (!vs.length) return; const lons = vs.map(s=>s.lon), lats = vs.map(s=>s.lat); map.fitBounds([[Math.min(...lons),Math.min(...lats)],[Math.max(...lons),Math.max(...lats)]], { padding:60, pitch:S.tilt?58:0, duration:800 }); }
document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.seg-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); S.mode = b.dataset.mode; map.setPaintProperty('base','raster-opacity', S.mode==='sub'?0.55:0.95); syncTerrainMode(); }));
$('exag').addEventListener('input', e => { S.exag = +e.target.value; $('exag-out').textContent = S.exag+'×'; layers(); });
$('color-by').addEventListener('change', e => { S.colorBy = e.target.value; legend(); mapLegend(); layers(); });
[['f-ambito','ambito'],['f-canton','canton'],['f-parr','parr'],['f-sucs','sucs']].forEach(([id,k]) => $(id).addEventListener('change', e => { S[k] = e.target.value; layers(); lista(); if (k==='ambito' || k==='parr' || k==='canton') fit(); }));
$('q').addEventListener('input', e => { S.q = e.target.value.trim(); layers(); lista(); });
$('reset').addEventListener('click', () => { Object.assign(S,{ambito:'URBANO',canton:'',parr:'',sucs:'',q:'',sel:null}); ['f-canton','f-parr','f-sucs','q'].forEach(id=>$(id).value=''); $('f-ambito').value='URBANO'; $('ficha').hidden=true; $('mini').hidden=true; if (POP) POP.remove(); layers(); lista(); fit(); });
$('fit').addEventListener('click', fit);
$('ficha-close').addEventListener('click', () => { S.sel=null; $('ficha').hidden=true; $('mini').hidden=true; if (POP) POP.remove(); layers(); });
function setPanel(open){ document.querySelector('.app').classList.toggle('panel-collapsed', !open); $('panel-toggle').hidden = open; setTimeout(() => { map.resize(); if (S.sel) popup(sondById.get(S.sel), intervalsBySond.get(S.sel)||[]); }, 60); }
$('panel-toggle').addEventListener('click', () => setPanel(true));
$('panel-min').addEventListener('click', () => setPanel(false));
if (window.innerWidth <= 860) setPanel(false); else $('panel-toggle').hidden = true;  // en el teléfono el mapa ocupa toda la pantalla al entrar
document.querySelectorAll('#hud-basemap button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#hud-basemap button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); S.base=b.dataset.base; map.setStyle(style(S.base)); }));
$('tilt-2d').addEventListener('click', () => { S.tilt=false; $('tilt-2d').classList.add('active'); $('tilt-3d').classList.remove('active'); map.easeTo({pitch:0,bearing:0}); });
$('tilt-3d').addEventListener('click', () => { S.tilt=true; $('tilt-3d').classList.add('active'); $('tilt-2d').classList.remove('active'); map.easeTo({pitch:58,bearing:-20}); });

/* ---------- rásteres de interpolación ---------- */
const valImgs = {};
function loadVal(k){ if (valImgs[k] || !k) return; const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently:true }); g.drawImage(im,0,0); valImgs[k] = { g, w:im.width, h:im.height }; }; im.src = rasterUrl(k,'val'); }
function rasterValueAt(lngLat){
  const k = S.raster; if (!k || !valImgs[k]) return null; const m = RASTERS[k], b = m.bounds; // [W,N,E,S]
  // la imagen está en Web Mercator: convertir lat a y mercator para interpolar fila
  const my = l => Math.log(Math.tan(Math.PI/4 + l*Math.PI/360));
  const fx = (lngLat.lng - b[0]) / (b[2] - b[0]), fy = (my(b[1]) - my(lngLat.lat)) / (my(b[1]) - my(b[3]));
  if (fx<0||fx>=1||fy<0||fy>=1) return null;
  const px = valImgs[k].g.getImageData(Math.floor(fx*valImgs[k].w), Math.floor(fy*valImgs[k].h), 1, 1).data;
  if (px[3] === 0) return null; const q = px[0]*256 + px[1]; return m.vmin + q/65000*(m.vmax - m.vmin);
}
function rasterLegend(){
  const L = $('raster-legend'), note = $('raster-note'); L.innerHTML = ''; if (!S.raster){ note.textContent=''; return; }
  const m = RASTERS[S.raster]; const grad = m.rampa.map(([p,c]) => `rgb(${c.join(',')}) ${p*100}%`).join(',');
  L.innerHTML = `<div style="width:100%"><div class="legend-bar" style="background:linear-gradient(90deg,${grad})"></div><div class="legend-ticks"><span>${m.leyenda[0]} ${m.unidad}</span><span>${m.leyenda[1]} ${m.unidad}</span></div></div>`;
  note.textContent = S.raster.startsWith('qadm') ? 'EBK 2D · 143 sondeos · depende de la geometría de cimentación asumida en cada informe (validación cruzada r = 0,25).' : (S.raster.startsWith('n60') ? 'EBK 3D K-Bessel · solo N60 reportado (416 ensayos) · validación cruzada RMS 11,1, RMSS 1,04.' : 'EBK 3D K-Bessel · 834 muestras · validación cruzada RMS 5,5, RMSS 1,00.');
}
function applyRaster(){ for (const k in RASTERS){ if (map.getLayer('r_'+k)){ map.setLayoutProperty('r_'+k,'visibility', S.raster===k?'visible':'none'); map.setPaintProperty('r_'+k,'raster-opacity',S.rasterOp); } } rasterLegend(); loadVal(S.raster); if ($('map-legend')) mapLegend(); }
$('raster-sel').addEventListener('change', e => { S.raster = e.target.value; applyRaster(); $('raster-val').textContent = S.raster ? (TOUCH ? 'Toca el mapa para leer el valor.' : 'Mueve el cursor sobre el mapa para leer el valor.') : ''; });
const _topo = $('hud-basemap');
$('raster-op').addEventListener('input', e => { S.rasterOp = +e.target.value/100; $('raster-op-out').textContent = e.target.value+' %'; applyRaster(); });
map.on(TOUCH ? 'click' : 'mousemove', e => { if (!S.raster) return; const v = rasterValueAt(e.lngLat); const m = RASTERS[S.raster]; $('raster-val').textContent = v==null ? 'Fuera del perímetro' : `${m.titulo}: ${fmt(v, S.raster.startsWith('qadm')?2:1)} ${m.unidad}`; });
/* ---------- terreno ---------- */
// Subsuelo real = rayos X sin relieve (el terreno taparía las columnas). Levantado = perfiles sobre el relieve 3D.
function syncTerrainMode(){ const sub = S.mode==='sub'; $('terrain-on').disabled = sub; $('terrain-ex').disabled = sub; S.terrain = sub ? false : $('terrain-on').checked; $('terrain-note').textContent = sub ? 'En modo Subsuelo el relieve se desactiva: las columnas se ven a través del terreno.' : ''; applyTerrain(); }
function applyTerrain(){ map.setTerrain(S.terrain ? { source:'dem', exaggeration:S.terrainEx } : null); if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade','visibility', S.hillshade?'visible':'none'); layers(); }
$('terrain-on').addEventListener('change', e => { S.terrain = e.target.checked; applyTerrain(); });
$('hillshade-on').addEventListener('change', e => { S.hillshade = e.target.checked; applyTerrain(); });
$('parr-on').addEventListener('change', e => { S.parrOn = e.target.checked; ['parroquias','parroquias-fill'].forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id,'visibility', S.parrOn?'visible':'none'); }); layers(); });
$('parr-lab').addEventListener('change', e => { S.parrLab = e.target.checked; layers(); });
$('terrain-ex').addEventListener('input', e => { S.terrainEx = +e.target.value; $('terrain-ex-out').textContent = String(S.terrainEx).replace('.',',')+'×'; applyTerrain(); });

map.on('load', () => { legend(); applyRaster(); syncTerrainMode(); mapLegend(); lista();
  const movil = window.innerWidth <= 860;
  setTimeout(() => {
    // En móvil, al terminar la entrada, encuadra el perímetro urbano en el centro de la pantalla (considera relieve y perspectiva)
    if (movil) map.once('moveend', () => setTimeout(() => encuadrarPerimetro(3), 60));
    map.flyTo(movil ? { center:[-79.2208,-3.9964], zoom:11.9, pitch:55, bearing:-15, duration:3000, essential:true } : { center:[-79.2035,-4.003], zoom:14.4, pitch:60, bearing:-25, duration:3500, essential:true });
  }, 600);
  setTimeout(() => $('ayuda').classList.add('off'), 12000); });
function encuadrarPerimetro(pasos){
  const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight;
  const ring = PERIMETRO.coordinates[0].filter((c, i) => i % 3 === 0);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  ring.forEach(c => { const p = map.project(c); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
  const esc = Math.min(W * 0.9 / (x1 - x0), H * 0.74 / (y1 - y0));
  const dx = (x0 + x1) / 2 - W / 2, dy = (y0 + y1) / 2 - H / 2;
  if (pasos > 1) map.easeTo({ center: map.unproject([(x0 + x1) / 2, (y0 + y1) / 2]), zoom: map.getZoom() + Math.log2(esc), pitch: 55, bearing: -15, duration: 700, essential: true });
  else { if (Math.hypot(dx, dy) < 4) return; map.panBy([dx, dy], { duration: 500, essential: true }); }
  if (pasos > 1) map.once('moveend', () => setTimeout(() => encuadrarPerimetro(pasos - 1), 80));
}
map.on('zoomend', () => layers());
let baseFail = 0;
map.on('error', e => { if (S.base !== 'dark' && e && e.sourceId === 'base' && ++baseFail === 3){ S.hillshade = true; $('hillshade-on').checked = true; if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade','visibility','visible'); if (map.getLayer('base')) map.setPaintProperty('base','raster-opacity',0); $('terrain-note').textContent = 'El mapa base externo no está disponible en esta vista privada; se muestra el relieve sombreado.'; } });
map.on('click', e => { let best = null, bd = 28; visibleSondeos().forEach(s => { const p = map.project([s.lon, s.lat]); const d = Math.hypot(p.x - e.point.x, p.y - e.point.y); if (d < bd){ bd = d; best = s; } }); if (best) pick(best.id_spt); });
map.on('style.load', () => { if (map.getLayer('base')) map.setPaintProperty('base','raster-opacity', S.mode==='sub'?0.55:0.95); applyRaster(); if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade','visibility', S.hillshade?'visible':'none'); });


/* ---------- corte geotécnico (nivel 1: correlación entre sondeos) ---------- */
const CORTE = { activo:false, ids:[], dmax:500 };
const distM = (a, b) => { const R = 6371000, toR = Math.PI/180; const dLat = (b.lat-a.lat)*toR, dLon = (b.lon-a.lon)*toR; const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
function pick(id){ if (!CORTE.activo) return select(id); if (CORTE.ids.includes(id)) return; if (CORTE.ids.length >= 3){ corteMsg('Máximo 3 sondeos. Quita uno para cambiarlo.'); return; }
  const s = sondById.get(id); if (CORTE.ids.length){ const prev = sondById.get(CORTE.ids[CORTE.ids.length-1]); const d = distM(prev, s); if (d > CORTE.dmax){ corteMsg(`${pub(s)} está a ${fmt(d,0)} m del anterior (máximo ${CORTE.dmax} m).`); return; } }
  CORTE.ids.push(id); corteUI(); layers(); }
function corteMsg(m){ $('corte-msg').textContent = m; }
function corteUI(){ $('corte-chips').innerHTML = CORTE.ids.map((id,i) => `<span class="chip">${i+1} · ${pub(sondById.get(id))}<button data-i="${i}" aria-label="Quitar">✕</button></span>`).join(''); $('corte-gen').disabled = CORTE.ids.length < 2; $('corte-sel').textContent = CORTE.activo ? 'Terminar selección' : 'Seleccionar sondeos'; $('corte-sel').classList.toggle('ghost', !CORTE.activo); document.body.classList.toggle('modo-corte', CORTE.activo);
  if (CORTE.activo) corteMsg(CORTE.ids.length ? `${CORTE.ids.length} elegido(s). Toca el siguiente sondeo (a menos de ${CORTE.dmax} m).` : 'Toca el primer sondeo en el mapa.'); }
$('corte-sel').addEventListener('click', () => { CORTE.activo = !CORTE.activo; if (CORTE.activo && S.sel){ S.sel = null; $('ficha').hidden = true; if (POP) POP.remove(); } corteUI(); layers(); if (!CORTE.activo) corteMsg(''); });
$('corte-chips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; CORTE.ids.splice(+b.dataset.i, 1); corteUI(); layers(); });
$('corte-dmax').addEventListener('input', e => { CORTE.dmax = +e.target.value; $('corte-dmax-out').textContent = CORTE.dmax + ' m'; });
$('corte-close').addEventListener('click', () => { $('corte').hidden = true; });
$('corte-gen').addEventListener('click', () => { corte(); });

function corte(){
  const ss = CORTE.ids.map(id => sondById.get(id)); if (ss.length < 2) return;
  // distancias acumuladas a lo largo de la traza
  const X = [0]; for (let i = 1; i < ss.length; i++) X.push(X[i-1] + distM(ss[i-1], ss[i]));
  const L = X[X.length-1];
  const ints = ss.map(s => (intervalsBySond.get(s.id_spt)||[]).filter(i => i.prof_hasta_m != null));
  const cota = ss.map(s => s.elevacion_msnm || 0);
  const zTop = Math.max(...cota) + 1.5, zBot = Math.min(...ss.map((s,k) => cota[k] - Math.max(s.profundidad_total_m||0, ...ints[k].map(i=>i.prof_hasta_m)))) - 1.5;
  // lienzo
  const W = 960, H = 380, ml = 64, mr = 24, mt = 34, mb = 40; const pw = W - ml - mr, ph = H - mt - mb;
  const ex = Math.max(1, Math.min(6, (pw / Math.max(L, 60)) / (ph / (zTop - zBot)) ));  // exageración vertical implícita, se informa
  const x = d => ml + (L > 0 ? d / L : 0.5) * pw, y = z => mt + (zTop - z) / (zTop - zBot) * ph;
  const colW = Math.max(18, Math.min(40, pw / (ss.length * 6)));
  const hatchOf = k => k.startsWith('G') ? 'h-grava' : k.startsWith('S') ? 'h-arena' : (k.startsWith('M') || k === 'CL-ML') ? 'h-limo' : (k.startsWith('C') ? 'h-arcilla' : (k.startsWith('O') || k === 'PT' ? 'h-organico' : null));
  let g = `<defs>
    <pattern id="h-grava" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.7" fill="none" stroke="#0f1419" stroke-width=".9"/><circle cx="8" cy="7.5" r="1.3" fill="none" stroke="#0f1419" stroke-width=".9"/></pattern>
    <pattern id="h-arena" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".8" fill="#0f1419"/><circle cx="4.5" cy="4" r=".8" fill="#0f1419"/></pattern>
    <pattern id="h-limo" width="10" height="6" patternUnits="userSpaceOnUse"><path d="M0 3 H4 M6 3 H10" stroke="#0f1419" stroke-width=".9"/></pattern>
    <pattern id="h-arcilla" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 2.5 H8" stroke="#0f1419" stroke-width=".9"/></pattern>
    <pattern id="h-organico" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8 L8 0" stroke="#0f1419" stroke-width=".9"/></pattern>
  </defs><rect width="${W}" height="${H}" fill="#0f1419"/>`;
  // rejilla de cotas
  const step = (zTop - zBot) > 30 ? 5 : ((zTop - zBot) > 12 ? 2 : 1);
  for (let z = Math.ceil(zBot/step)*step; z <= zTop; z += step) g += `<line x1="${ml}" x2="${W-mr}" y1="${y(z)}" y2="${y(z)}" stroke="#2a3542"/><text x="${ml-6}" y="${y(z)+3}" fill="#9aa8b6" font-size="10" text-anchor="end" font-family="JetBrains Mono">${z}</text>`;
  // superficie del terreno entre sondeos
  const surf = []; const n = 40;
  for (let k = 0; k < ss.length - 1; k++) for (let j = 0; j <= n; j++){ const f = j/n; const lon = ss[k].lon + (ss[k+1].lon - ss[k].lon)*f, lat = ss[k].lat + (ss[k+1].lat - ss[k].lat)*f; const z = cota[k] + (cota[k+1]-cota[k])*f; surf.push([X[k] + (X[k+1]-X[k])*f, z]); }  // superficie: recta entre cotas de informe (el MDT se incorpora en el nivel 2)
  // ajuste: que la superficie pase por la cota real de cada sondeo (corrige diferencias MDT vs informe)
  ss.forEach((s,k) => { const i = k*(n+1) + (k < ss.length-1 ? 0 : n); if (surf[i]) surf[i][1] = cota[k]; });
  g += `<path d="M ${surf.map(p => x(p[0]).toFixed(1)+' '+y(p[1]).toFixed(1)).join(' L ')} L ${x(L).toFixed(1)} ${H-mb} L ${x(0).toFixed(1)} ${H-mb} Z" fill="#1a222c"/>`;
  g += `<path d="M ${surf.map(p => x(p[0]).toFixed(1)+' '+y(p[1]).toFixed(1)).join(' L ')}" fill="none" stroke="#7fb3d5" stroke-width="1.5"/>`;
  // correlación de estratos entre sondeos vecinos (mismo SUCS, orden similar)
  for (let k = 0; k < ss.length - 1; k++){
    const A = ints[k], B = ints[k+1]; const used = new Set();
    A.forEach(ia => { const ka = sucsKey(ia.sucs); if (ka === 'NONE') return;
      let best = null, bd = 1e9; B.forEach((ib, j) => { if (used.has(j) || sucsKey(ib.sucs) !== ka) return; const d = Math.abs(ib.prof_desde_m - ia.prof_desde_m) + Math.abs(ib.prof_hasta_m - ia.prof_hasta_m); if (d < bd){ bd = d; best = j; } });
      if (best == null || bd > 4) return; used.add(best); const ib = B[best]; const c = SUCS_COLOR[ka];
      const pts = [[X[k]+colW/2/ (pw/L||1), cota[k]-ia.prof_desde_m],[X[k+1], cota[k+1]-ib.prof_desde_m],[X[k+1], cota[k+1]-ib.prof_hasta_m],[X[k], cota[k]-ia.prof_hasta_m]];
      const ptsS = pts.map(p => x(p[0]).toFixed(1)+','+y(p[1]).toFixed(1)).join(' '); const hk2 = hatchOf(ka);
      g += `<polygon points="${ptsS}" fill="rgb(${c.join(',')})" fill-opacity=".30" stroke="rgb(${c.join(',')})" stroke-opacity=".6" stroke-dasharray="4 3"/>`;
      if (hk2) g += `<polygon points="${ptsS}" fill="url(#${hk2})" fill-opacity=".35" stroke="none"/>`; });
  }
  // columnas
  ss.forEach((s,k) => { const cx = x(X[k]);
    ints[k].forEach(i => { const c = SUCS_COLOR[sucsKey(i.sucs)]; const y1 = y(cota[k]-i.prof_desde_m), y2 = y(cota[k]-i.prof_hasta_m);
      const hk = hatchOf(sucsKey(i.sucs)); const ttl = `<title>${pub(s)} · ${fmt(i.prof_desde_m,2)}–${fmt(i.prof_hasta_m,2)} m · ${i.sucs||'—'}${n60Val(i)!=null?' · N60 '+fmt(n60Val(i),0):''}</title>`;
      g += `<rect x="${cx-colW/2}" y="${y1}" width="${colW}" height="${Math.max(1,y2-y1)}" fill="rgb(${c.join(',')})" stroke="#0f1419">${ttl}</rect>`;
      if (hk) g += `<rect x="${cx-colW/2}" y="${y1}" width="${colW}" height="${Math.max(1,y2-y1)}" fill="url(#${hk})" fill-opacity=".55" stroke="none" pointer-events="none"/>`;
      if (y2-y1 > 11) g += `<text x="${cx}" y="${(y1+y2)/2+3}" fill="#0f1419" font-size="9" font-weight="700" text-anchor="middle" font-family="Manrope">${i.sucs||''}</text>`;
      const nv = n60Val(i); if (nv != null) g += `<text x="${cx+colW/2+4}" y="${(y1+y2)/2+3}" fill="${n60Origin(i)==='REPORTADO'?'#e0a458':'#9aa8b6'}" font-size="9" font-family="JetBrains Mono">${fmt(nv,0)}</text>`; });
    g += `<text x="${cx}" y="${y(cota[k])-8}" fill="#e8edf2" font-size="11" font-weight="700" text-anchor="middle" font-family="JetBrains Mono">${pub(s)}</text><text x="${cx}" y="${H-mb+14}" fill="#9aa8b6" font-size="10" text-anchor="middle" font-family="JetBrains Mono">${fmt(X[k],0)} m</text>`; });
  [['h-grava','Grava'],['h-arena','Arena'],['h-limo','Limo'],['h-arcilla','Arcilla']].forEach(([id,lab],q) => { const lx = W - mr - 300 + q*74; g += `<rect x="${lx}" y="${H-mb+6}" width="18" height="11" fill="#6b7785"/><rect x="${lx}" y="${H-mb+6}" width="18" height="11" fill="url(#${id})" fill-opacity=".7"/><text x="${lx+22}" y="${H-mb+15}" fill="#9aa8b6" font-size="10" font-family="Manrope">${lab}</text>`; });
  g += `<text x="${ml}" y="${H-6}" fill="#9aa8b6" font-size="10" font-family="Manrope">Cotas en msnm · N60 junto a cada intervalo (naranja reportado, gris estimado) · tramas: correlación interpretativa de estratos con igual SUCS · exageración vertical ≈ ${ex.toFixed(1)}×</text>`;
  g += `<text x="${W-mr}" y="${mt-18}" fill="#9aa8b6" font-size="10" text-anchor="end" font-family="Manrope">Longitud ${fmt(L,0)} m · GEOARQUITEC</text>`;
  const svg = $('corte-svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = g;
  $('corte-titulo').textContent = `Corte ${ss.map(pub).join(' → ')} · ${fmt(L,0)} m`;
  $('corte').hidden = false; corteMsg('Corte generado. Puedes cambiar los sondeos y volver a generar.');
}
$('corte-png').addEventListener('click', () => { const svg = $('corte-svg'); const xml = new XMLSerializer().serializeToString(svg); const img = new Image(); const url = URL.createObjectURL(new Blob([xml], { type:'image/svg+xml' }));
  img.onload = () => { const c = document.createElement('canvas'); c.width = 1920; c.height = 760; const g2 = c.getContext('2d'); g2.drawImage(img, 0, 0, 1920, 760); URL.revokeObjectURL(url); const a = document.createElement('a'); a.download = 'corte_geotecnico.png'; a.href = c.toDataURL('image/png'); a.click(); }; img.src = url; });
