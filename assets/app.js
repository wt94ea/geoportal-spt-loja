const map = L.map('map', { zoomControl: true }).setView([-3.995, -79.205], 13);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17,
  attribution: '&copy; OpenTopoMap contributors'
});

L.control.layers({"OpenStreetMap": osm, "OpenTopoMap": topo}, null, {collapsed: true}).addTo(map);

let rawData = null;
let geoLayer = null;
let currentMetric = 'capacidad_kg_cm2';

const metricSelect = document.getElementById('metric-select');
const sucsSelect = document.getElementById('sucs-filter');
const nfSelect = document.getElementById('nf-filter');
const resetBtn = document.getElementById('reset-btn');

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function colorFor(value, metric){
  const v = num(value);
  if(v === null) return '#94a3b8';

  if(metric === 'capacidad_kg_cm2'){
    if(v < 1.0) return '#ef4444';
    if(v < 1.5) return '#f97316';
    if(v < 2.0) return '#eab308';
    if(v < 2.5) return '#22c55e';
    return '#0284c7';
  }

  if(metric === 'n60'){
    if(v < 10) return '#ef4444';
    if(v < 20) return '#f97316';
    if(v < 30) return '#eab308';
    if(v < 40) return '#22c55e';
    return '#0284c7';
  }

  if(metric === 'humedad_pct'){
    if(v < 15) return '#0284c7';
    if(v < 22) return '#22c55e';
    if(v < 30) return '#eab308';
    if(v < 38) return '#f97316';
    return '#ef4444';
  }
  return '#38bdf8';
}

function radiusFor(feature){
  const n60 = num(feature.properties.n60);
  if(n60 === null) return 7;
  return Math.max(6, Math.min(16, 5 + n60 / 5));
}

function popupHTML(p){
  return `
  <div class="popup">
    <span class="badge">${p.sucs || 'Sin SUCS'}</span>
    <h3>${p.id || 'SPT'}</h3>
    <table>
      <tr><td>Barrio</td><td>${p.barrio || '-'}</td></tr>
      <tr><td>Parroquia</td><td>${p.parroquia || '-'}</td></tr>
      <tr><td>Profundidad</td><td>${p.profundidad_m ?? '-'} m</td></tr>
      <tr><td>N60</td><td>${p.n60 ?? '-'}</td></tr>
      <tr><td>Cap. portante</td><td>${p.capacidad_kg_cm2 ?? '-'} kg/cm²</td></tr>
      <tr><td>Humedad</td><td>${p.humedad_pct ?? '-'} %</td></tr>
      <tr><td>AASHTO</td><td>${p.aashto || '-'}</td></tr>
      <tr><td>Nivel freático</td><td>${p.nivel_freatico || '-'}</td></tr>
      <tr><td>Tipo de suelo</td><td>${p.tipo_suelo || '-'}</td></tr>
      <tr><td>Cimentación</td><td>${p.cimentacion || '-'}</td></tr>
    </table>
  </div>`;
}

function populateFilters(data){
  const sucsValues = [...new Set(data.features.map(f => f.properties.sucs).filter(Boolean))].sort();
  sucsSelect.innerHTML = `<option value="TODOS">Todos</option>` + sucsValues.map(v => `<option value="${v}">${v}</option>`).join('');
}

function filteredFeatures(){
  const sucs = sucsSelect.value;
  const nf = nfSelect.value;
  return rawData.features.filter(f => {
    const p = f.properties;
    const okSucs = sucs === 'TODOS' || p.sucs === sucs;
    const okNf = nf === 'TODOS' || String(p.nivel_freatico || '').toLowerCase() === nf.toLowerCase();
    return okSucs && okNf;
  });
}

function updateStats(features){
  document.getElementById('total-points').textContent = features.length;
  const avg = (field) => {
    const vals = features.map(f => num(f.properties[field])).filter(v => v !== null);
    if(!vals.length) return '-';
    return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(field === 'capacidad_kg_cm2' ? 2 : 1);
  };
  document.getElementById('avg-n60').textContent = avg('n60');
  document.getElementById('avg-cp').textContent = avg('capacidad_kg_cm2');
  document.getElementById('avg-h').textContent = avg('humedad_pct');
}

function updateLegend(metric){
  const title = document.getElementById('legend-title');
  const rows = document.getElementById('legend-rows');

  let items = [];
  if(metric === 'capacidad_kg_cm2'){
    title.textContent = 'Leyenda: Capacidad portante';
    items = [
      ['#ef4444','< 1.00 kg/cm²'],
      ['#f97316','1.00 – 1.49 kg/cm²'],
      ['#eab308','1.50 – 1.99 kg/cm²'],
      ['#22c55e','2.00 – 2.49 kg/cm²'],
      ['#0284c7','≥ 2.50 kg/cm²']
    ];
  } else if(metric === 'n60'){
    title.textContent = 'Leyenda: N60';
    items = [
      ['#ef4444','< 10'],
      ['#f97316','10 – 19'],
      ['#eab308','20 – 29'],
      ['#22c55e','30 – 39'],
      ['#0284c7','≥ 40']
    ];
  } else {
    title.textContent = 'Leyenda: Humedad natural';
    items = [
      ['#0284c7','< 15 %'],
      ['#22c55e','15 – 21.9 %'],
      ['#eab308','22 – 29.9 %'],
      ['#f97316','30 – 37.9 %'],
      ['#ef4444','≥ 38 %']
    ];
  }

  rows.innerHTML = items.map(([c,t]) => `<div class="legend-row"><span class="swatch" style="background:${c}"></span>${t}</div>`).join('');
}

function render(){
  if(geoLayer) map.removeLayer(geoLayer);

  const fc = {
    type: 'FeatureCollection',
    features: filteredFeatures()
  };

  geoLayer = L.geoJSON(fc, {
    pointToLayer: (feature, latlng) => {
      const p = feature.properties;
      return L.circleMarker(latlng, {
        radius: radiusFor(feature),
        color: '#0f172a',
        weight: 1,
        fillColor: colorFor(p[currentMetric], currentMetric),
        fillOpacity: 0.88
      });
    },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(popupHTML(feature.properties), {maxWidth: 320});
    }
  }).addTo(map);

  updateStats(fc.features);
  updateLegend(currentMetric);

  if(fc.features.length){
    map.fitBounds(geoLayer.getBounds().pad(0.20));
  }
}

fetch('data/spt_puntos.geojson')
  .then(r => {
    if(!r.ok) throw new Error('No se pudo cargar data/spt_puntos.geojson');
    return r.json();
  })
  .then(data => {
    rawData = data;
    populateFilters(data);
    render();
  })
  .catch(err => {
    console.error(err);
    alert('Error cargando el GeoJSON. Revisa que exista data/spt_puntos.geojson y que el sitio esté publicado en servidor/GitHub Pages.');
  });

metricSelect.addEventListener('change', e => {
  currentMetric = e.target.value;
  render();
});
sucsSelect.addEventListener('change', render);
nfSelect.addEventListener('change', render);
resetBtn.addEventListener('click', () => {
  metricSelect.value = 'capacidad_kg_cm2';
  sucsSelect.value = 'TODOS';
  nfSelect.value = 'TODOS';
  currentMetric = 'capacidad_kg_cm2';
  render();
});