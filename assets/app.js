
const DATA_URL = 'data/spt_puntos.geojson';

const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([-4.0, -79.2], 11);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17,
  attribution: '&copy; OpenTopoMap contributors'
});

const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri'
});

L.control.layers({
  'OpenStreetMap': osm,
  'Topográfico': topo,
  'Satélite': imagery
}, null, {collapsed:true}).addTo(map);

let rawData = null;
let geoLayer = null;
let currentMetric = 'capacidad_portante_kg_cm2';
let indexByCode = new Map();

const el = (id) => document.getElementById(id);
const metricSelect = el('metric-select');
const sucsSelect = el('sucs-filter');
const nfSelect = el('nf-filter');
const cantonSelect = el('canton-filter');
const zonaSelect = el('zona-filter');
const searchInput = el('search-code');

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmt(v, d=2){
  const n = num(v);
  if(n === null) return '-';
  return n.toLocaleString('es-EC', {maximumFractionDigits:d});
}
function uniqueSorted(features, field){
  return [...new Set(features.map(f => f.properties[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
}
function fillSelect(select, values, label='Todos'){
  select.innerHTML = `<option value="TODOS">${label}</option>` + values.map(v => `<option value="${v}">${v}</option>`).join('');
}
function colorFor(value, metric){
  const v = num(value);
  if(v === null) return '#94a3b8';

  if(metric === 'capacidad_portante_kg_cm2'){
    if(v < 1.0) return '#ef4444';
    if(v < 1.5) return '#f97316';
    if(v < 2.0) return '#f59e0b';
    if(v < 2.5) return '#22c55e';
    return '#38bdf8';
  }
  if(metric === 'n60'){
    if(v < 10) return '#ef4444';
    if(v < 20) return '#f97316';
    if(v < 30) return '#f59e0b';
    if(v < 40) return '#22c55e';
    return '#38bdf8';
  }
  if(metric === 'humedad_pct'){
    if(v < 15) return '#38bdf8';
    if(v < 22) return '#22c55e';
    if(v < 30) return '#f59e0b';
    if(v < 38) return '#f97316';
    return '#ef4444';
  }
  if(metric === 'elevacion_msnm'){
    if(v < 1500) return '#38bdf8';
    if(v < 1900) return '#22c55e';
    if(v < 2200) return '#f59e0b';
    if(v < 2500) return '#f97316';
    return '#ef4444';
  }
  return '#38bdf8';
}
function radiusFor(feature){
  const n60 = num(feature.properties.n60);
  if(n60 === null) return 6.5;
  return Math.max(5.5, Math.min(15.5, 4.8 + n60/5.8));
}
function popupHTML(p){
  return `
  <div class="popup">
    <div class="code">
      <span class="tag">${p.codigo || 'SPT'}</span>
      <span class="tag privacy">Anonimizado</span>
    </div>
    <h3>Registro geotécnico público</h3>
    <table>
      <tr><td>Provincia / cantón</td><td>${p.provincia || '-'} / ${p.canton || '-'}</td></tr>
      <tr><td>Zona pública</td><td>${p.zona_publica || '-'}</td></tr>
      <tr><td>Año de ensayo</td><td>${p.anio_ensayo || '-'}</td></tr>
      <tr><td>Elevación</td><td>${fmt(p.elevacion_msnm, 1)} msnm</td></tr>
      <tr><td>Profundidad sondeo</td><td>${fmt(p.profundidad_sondeo_m, 2)} m</td></tr>
      <tr><td>N60</td><td>${fmt(p.n60, 0)} · ${p.resistencia_n60 || '-'}</td></tr>
      <tr><td>Capacidad portante</td><td>${fmt(p.capacidad_portante_kg_cm2, 2)} kg/cm²</td></tr>
      <tr><td>Humedad natural</td><td>${fmt(p.humedad_pct, 2)} %</td></tr>
      <tr><td>SUCS / AASHTO</td><td>${p.sucs || '-'} / ${p.aashto || '-'}</td></tr>
      <tr><td>Nivel freático</td><td>${p.nivel_freatico || '-'}</td></tr>
      <tr><td>Tipo de suelo</td><td>${p.tipo_suelo || '-'}</td></tr>
      <tr><td>Cimentación ref.</td><td>${p.tipo_cimentacion || '-'}</td></tr>
      <tr><td>Aptitud referencial</td><td>${p.aptitud_referencial || '-'}</td></tr>
    </table>
  </div>`;
}
function filteredFeatures(){
  const sucs = sucsSelect.value;
  const nf = nfSelect.value;
  const canton = cantonSelect.value;
  const zona = zonaSelect.value;
  const q = (searchInput.value || '').trim().toLowerCase();

  return rawData.features.filter(f => {
    const p = f.properties;
    return (sucs === 'TODOS' || p.sucs === sucs)
      && (nf === 'TODOS' || p.nivel_freatico === nf)
      && (canton === 'TODOS' || p.canton === canton)
      && (zona === 'TODOS' || p.zona_publica === zona)
      && (!q || String(p.codigo || '').toLowerCase().includes(q) || String(p.sucs || '').toLowerCase().includes(q));
  });
}
function updateStats(features){
  el('total-points').textContent = features.length;
  const avg = (field, d=1) => {
    const vals = features.map(f => num(f.properties[field])).filter(v => v !== null);
    if(!vals.length) return '-';
    const value = vals.reduce((a,b)=>a+b,0)/vals.length;
    return value.toLocaleString('es-EC', {maximumFractionDigits:d});
  };
  el('avg-n60').textContent = avg('n60', 1);
  el('avg-cp').textContent = avg('capacidad_portante_kg_cm2', 2);
  el('avg-h').textContent = avg('humedad_pct', 1);
  const nfCount = features.filter(f => f.properties.nivel_freatico === 'Sí').length;
  el('nf-count').textContent = nfCount;
}
function updateLegend(metric){
  const title = el('legend-title');
  const rows = el('legend-rows');
  let items = [];
  if(metric === 'capacidad_portante_kg_cm2'){
    title.textContent = 'Leyenda · Capacidad portante';
    items = [['#ef4444','< 1.00 kg/cm²'],['#f97316','1.00 – 1.49'],['#f59e0b','1.50 – 1.99'],['#22c55e','2.00 – 2.49'],['#38bdf8','≥ 2.50']];
  } else if(metric === 'n60'){
    title.textContent = 'Leyenda · N60';
    items = [['#ef4444','< 10 · Muy baja'],['#f97316','10 – 19 · Baja'],['#f59e0b','20 – 29 · Media'],['#22c55e','30 – 39 · Alta'],['#38bdf8','≥ 40 · Muy alta']];
  } else if(metric === 'humedad_pct'){
    title.textContent = 'Leyenda · Humedad natural';
    items = [['#38bdf8','< 15 %'],['#22c55e','15 – 21.9 %'],['#f59e0b','22 – 29.9 %'],['#f97316','30 – 37.9 %'],['#ef4444','≥ 38 %']];
  } else {
    title.textContent = 'Leyenda · Elevación';
    items = [['#38bdf8','< 1500 msnm'],['#22c55e','1500 – 1899'],['#f59e0b','1900 – 2199'],['#f97316','2200 – 2499'],['#ef4444','≥ 2500']];
  }
  rows.innerHTML = items.map(([c,t]) => `<div class="legend-row"><span class="swatch" style="background:${c}"></span>${t}</div>`).join('');
}
function updateList(features){
  const list = el('data-list');
  const sample = features.slice(0, 50);
  list.innerHTML = sample.map(f => {
    const p = f.properties;
    return `<div class="data-row" data-code="${p.codigo}">
      <strong>${p.codigo}</strong>
      <span>${p.sucs || '-'} · ${p.zona_publica || '-'}</span>
      <span>N60 ${fmt(p.n60,0)}</span>
    </div>`;
  }).join('');
  list.querySelectorAll('.data-row').forEach(row => {
    row.addEventListener('click', () => focusCode(row.dataset.code));
  });
}
function render(){
  if(geoLayer) map.removeLayer(geoLayer);
  const fc = {type:'FeatureCollection', features: filteredFeatures()};

  geoLayer = L.geoJSON(fc, {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: radiusFor(feature),
      color: '#020617',
      weight: 1.4,
      fillColor: colorFor(feature.properties[currentMetric], currentMetric),
      fillOpacity: 0.86
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(popupHTML(feature.properties), {maxWidth: 360});
      layer.on('mouseover', () => layer.setStyle({weight: 2.8, fillOpacity: 1}));
      layer.on('mouseout', () => layer.setStyle({weight: 1.4, fillOpacity: .86}));
      indexByCode.set(feature.properties.codigo, layer);
    }
  }).addTo(map);

  updateStats(fc.features);
  updateLegend(currentMetric);
  updateList(fc.features);

  if(fc.features.length){
    map.fitBounds(geoLayer.getBounds().pad(0.12));
  }
}
function focusCode(code){
  const layer = indexByCode.get(code);
  if(!layer) return;
  map.setView(layer.getLatLng(), Math.max(map.getZoom(), 15), {animate:true});
  layer.openPopup();
}
function resetFilters(){
  metricSelect.value = 'capacidad_portante_kg_cm2';
  sucsSelect.value = 'TODOS';
  nfSelect.value = 'TODOS';
  cantonSelect.value = 'TODOS';
  zonaSelect.value = 'TODOS';
  searchInput.value = '';
  currentMetric = 'capacidad_portante_kg_cm2';
  render();
}
function downloadGeoJSON(){
  const filtered = {type:'FeatureCollection', features: filteredFeatures()};
  const blob = new Blob([JSON.stringify(filtered, null, 2)], {type:'application/geo+json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spt_publico_filtrado.geojson';
  a.click();
  URL.revokeObjectURL(a.href);
}

fetch(DATA_URL)
  .then(r => {
    if(!r.ok) throw new Error(`Error cargando ${DATA_URL}`);
    return r.json();
  })
  .then(data => {
    rawData = data;
    fillSelect(sucsSelect, uniqueSorted(data.features, 'sucs'));
    fillSelect(nfSelect, uniqueSorted(data.features, 'nivel_freatico'));
    fillSelect(cantonSelect, uniqueSorted(data.features, 'canton'));
    fillSelect(zonaSelect, uniqueSorted(data.features, 'zona_publica'));
    render();
  })
  .catch(err => {
    console.error(err);
    alert('No se pudo cargar el GeoJSON. Revisa la ruta data/spt_puntos.geojson.');
  });

[metricSelect, sucsSelect, nfSelect, cantonSelect, zonaSelect].forEach(control => {
  control.addEventListener('change', e => {
    if(e.target === metricSelect) currentMetric = e.target.value;
    render();
  });
});
searchInput.addEventListener('input', render);
el('reset-btn').addEventListener('click', resetFilters);
el('download-btn').addEventListener('click', downloadGeoJSON);
