
const DATA_URL = 'data/spt_puntos.geojson';

const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([-4.0, -79.2], 11);

// Mapa claro técnico, recomendado como base principal
const claroTecnico = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    detectRetina: true,
    updateWhenIdle: true,
    keepBuffer: 4
  }
);

// OpenStreetMap estándar
const osm = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors',
    detectRetina: true,
    updateWhenIdle: true,
    keepBuffer: 4
  }
);

// Satélite Esri
const satelite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri',
    updateWhenIdle: true,
    keepBuffer: 4
  }
);

// Topográfico Esri
const topografico = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri',
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 6
  }
).addTo(map);

// Panel exclusivo para las superficies interpoladas.
map.createPane('interpolacionesPane');

map.getPane('interpolacionesPane').style.zIndex = 350;
map.getPane('interpolacionesPane').style.pointerEvents = 'none';

// Interpolación N60 en mosaicos XYZ
// Extensión de la interpolación N60 en Loja
const boundsN60 = L.latLngBounds(
  [-4.043034, -79.250782],
  [-3.936663, -79.187002]
);

// Interpolación N60 en mosaicos XYZ
const interpolacionN60 = L.tileLayer(
  'tiles/n60/{z}/{x}/{y}.png',
  {
    // Permite activar la capa aun cuando el mapa esté alejado
    minZoom: 0,

    // Los mosaicos reales existen desde zoom 10 hasta zoom 16
    minNativeZoom: 10,
    maxNativeZoom: 16,

    // Permite acercarse más reutilizando las teselas disponibles
    maxZoom: 20,

    bounds: boundsN60,
    noWrap: true,

    opacity: 0.72,
    pane: 'interpolacionesPane',
    updateWhenIdle: true,
    keepBuffer: 4,

    attribution: 'Geoarquitec · Interpolación N60'
  }
);
// Incertidumbre o error estándar de N60
const incertidumbreN60 = L.tileLayer(
  'tiles/n60_error/{z}/{x}/{y}.png',
  {
    // Permite activarla desde cualquier nivel de alejamiento
    minZoom: 0,

    // Los mosaicos reales existen entre zoom 10 y 16
    minNativeZoom: 10,
    maxNativeZoom: 16,

    // Permite acercarse reutilizando las teselas
    maxZoom: 20,

    // Utiliza la misma extensión espacial que N60 predicha
    bounds: boundsN60,
    noWrap: true,

    opacity: 0.72,
    pane: 'interpolacionesPane',
    updateWhenIdle: true,
    keepBuffer: 4,

    attribution: 'Geoarquitec · Incertidumbre N60'
  }
);

// Capacidad portante predicha
const capacidadPortantePredicha = L.tileLayer(
  'tiles/capacidad_portante/{z}/{x}/{y}.png',
  {
    minZoom: 0,
    minNativeZoom: 10,
    maxNativeZoom: 16,
    maxZoom: 20,

    bounds: boundsN60,
    noWrap: true,

    opacity: 0.72,
    pane: 'interpolacionesPane',
    updateWhenIdle: true,
    keepBuffer: 4,

    attribution: 'Geoarquitec · Capacidad portante predicha'
  }
);

// Incertidumbre o error estándar de capacidad portante
const incertidumbreCapacidadPortante = L.tileLayer(
  'tiles/capacidad_portante_error/{z}/{x}/{y}.png',
  {
    minZoom: 0,
    minNativeZoom: 10,
    maxNativeZoom: 16,
    maxZoom: 20,

    bounds: boundsN60,
    noWrap: true,

    opacity: 0.72,
    pane: 'interpolacionesPane',
    updateWhenIdle: true,
    keepBuffer: 4,

    attribution: 'Geoarquitec · Incertidumbre de capacidad portante'
  }
);

// Humedad predicha
const interpolacionHumedad = L.tileLayer(
  'tiles/humedad/{z}/{x}/{y}.png',
  {
    // Permite activarla desde cualquier nivel de alejamiento
    minZoom: 0,

    // Los mosaicos reales existen entre zoom 10 y 16
    minNativeZoom: 10,
    maxNativeZoom: 16,

    // Permite acercarse más reutilizando las teselas
    maxZoom: 20,

    // Usa la misma extensión espacial del resto de interpolaciones
    bounds: boundsN60,
    noWrap: true,

    opacity: 0.72,
    pane: 'interpolacionesPane',
    updateWhenIdle: true,
    keepBuffer: 4,

    attribution: 'Geoarquitec · Humedad predicha'
  }
);

// Mapas base
const mapasBase = {
  'Claro técnico': claroTecnico,
  'OpenStreetMap': osm,
  'Satélite': satelite,
  'Topográfico': topografico
};

// Capas técnicas activables
const capasTematicas = {
  'N60 predicha': interpolacionN60,
  'Incertidumbre N60': incertidumbreN60,
  'Capacidad portante predicha': capacidadPortantePredicha,
  'Incertidumbre capacidad portante': incertidumbreCapacidadPortante,
  'Humedad predicha': interpolacionHumedad
};

L.control.layers(
  mapasBase,
  capasTematicas,
  {
    collapsed: true
  }
).addTo(map);
// Superficies que no deben mostrarse simultáneamente
const capasInterpoladas = [
  interpolacionN60,
  incertidumbreN60,
  capacidadPortantePredicha,
  incertidumbreCapacidadPortante
];
// Leyenda flotante dentro del mapa
const legendControl = L.control({
  position: 'bottomright'
});

legendControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'map-legend');

  div.innerHTML = `
    <h4 id="legend-title">Interpolación N60</h4>
    <div id="legend-rows"></div>
  `;

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  return div;
};

legendControl.addTo(map);
map.on('baselayerchange', () => {
  setTimeout(corregirRenderMapa, 250);
  setTimeout(corregirRenderMapa, 900);
});
// Corrección de render para evitar cuadros negros o teselas incompletas
function corregirRenderMapa() {
  map.invalidateSize(true);

  // Si hay una interpolación activa, mantiene la vista en Loja
  if (
    capaTematicaActiva &&
    boundsN60 &&
    boundsN60.isValid()
  ) {
    map.fitBounds(boundsN60, {
      animate: false,
      padding: [25, 25],
      maxZoom: 14
    });

    return;
  }

  // Si no hay interpolación activa, muestra todos los puntos SPT
  if (
    geoLayer &&
    geoLayer.getBounds &&
    geoLayer.getBounds().isValid()
  ) {
    map.fitBounds(geoLayer.getBounds().pad(0.12), {
      animate: false
    });
  }
}

window.addEventListener('load', () => {
  setTimeout(corregirRenderMapa, 300);
  setTimeout(corregirRenderMapa, 1000);
  setTimeout(corregirRenderMapa, 2000);
});

window.addEventListener('resize', corregirRenderMapa);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    setTimeout(corregirRenderMapa, 300);
  }
});
let rawData = null;
let geoLayer = null;
let currentMetric = 'capacidad_portante_kg_cm2';
let capaTematicaActiva = null;
let indexByCode = new Map();

// Evita cruces de eventos cuando Leaflet cambia de superficie
let cambiandoCapaTematica = false;

function obtenerTipoCapa(layer) {
  if (layer === interpolacionN60) return 'n60';
  if (layer === incertidumbreN60) return 'n60_error';
  if (layer === capacidadPortantePredicha) return 'capacidad_portante';

  if (layer === incertidumbreCapacidadPortante) {
    return 'capacidad_portante_error';
  }

  if (layer === interpolacionHumedad) return 'humedad';

  return null;
}

map.on('overlayadd', (event) => {
  const tipo = obtenerTipoCapa(event.layer);

  if (!tipo || cambiandoCapaTematica) return;

  cambiandoCapaTematica = true;

  // Apaga las demás superficies interpoladas
  capasInterpoladas.forEach((layer) => {
    if (layer !== event.layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });

  capaTematicaActiva = tipo;
  cambiandoCapaTematica = false;

  updateLegend();

  map.fitBounds(boundsN60, {
    padding: [25, 25],
    maxZoom: 14,
    animate: false
  });

  setTimeout(() => {
    map.invalidateSize(true);
  }, 200);
});

map.on('overlayremove', (event) => {
  if (
    !capasInterpoladas.includes(event.layer) ||
    cambiandoCapaTematica
  ) {
    return;
  }

  const capaRestante = capasInterpoladas.find(
    (layer) => map.hasLayer(layer)
  );

  capaTematicaActiva = obtenerTipoCapa(capaRestante);
  updateLegend();

  // Si ya no queda ninguna interpolación, regresa a los puntos
  if (!capaTematicaActiva) {
    corregirRenderMapa();
  }
});
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
function updateLegend() {
  const legendBox = document.querySelector('.map-legend');
  const title = el('legend-title');
  const rows = el('legend-rows');

  if (!legendBox || !title || !rows) return;

  if (!capaTematicaActiva) {
    legendBox.style.display = 'none';
    return;
  }

  const colores = [
    '#F5F500',
    '#F5B800',
    '#F57A00',
    '#F53D00',
    '#F50000'
  ];

  const leyendas = {
    n60: {
      titulo: 'N60 predicha',
      etiquetas: [
        '< 10 · Muy baja resistencia',
        '10 – 19 · Baja resistencia',
        '20 – 29 · Resistencia media',
        '30 – 39 · Alta resistencia',
        '≥ 40 · Muy alta resistencia'
      ]
    },

    n60_error: {
      titulo: 'Incertidumbre N60',
      etiquetas: [
        'Muy baja incertidumbre',
        'Baja incertidumbre',
        'Incertidumbre media',
        'Alta incertidumbre',
        'Muy alta incertidumbre'
      ]
    },

    capacidad_portante: {
      titulo: 'Capacidad portante predicha',
      etiquetas: [
        'Muy baja capacidad portante',
        'Baja capacidad portante',
        'Capacidad portante media',
        'Alta capacidad portante',
        'Muy alta capacidad portante'
      ]
    },

    capacidad_portante_error: {
      titulo: 'Incertidumbre capacidad portante',
      etiquetas: [
        'Muy baja incertidumbre',
        'Baja incertidumbre',
        'Incertidumbre media',
        'Alta incertidumbre',
        'Muy alta incertidumbre'
      ]
    },

    humedad: {
      titulo: 'Humedad predicha',
      etiquetas: [
        '≤ 10,00 % · Muy baja humedad',
        '> 10,00 y ≤ 14,00 % · Baja humedad',
        '> 14,00 y ≤ 18,00 % · Humedad media',
        '> 18,00 y ≤ 22,00 % · Alta humedad',
        '> 22,00 y ≤ 27,29 % · Muy alta humedad'
      ]
    }
  };

  const leyenda = leyendas[capaTematicaActiva];

  if (!leyenda) {
    legendBox.style.display = 'none';
    return;
  }

  legendBox.style.display = 'block';
  title.textContent = leyenda.titulo;

  rows.innerHTML = leyenda.etiquetas.map((texto, indice) => `
    <div class="legend-row">
      <span
        class="swatch"
        style="background:${colores[indice]}"
        aria-hidden="true"
      ></span>
      <span class="legend-label">${texto}</span>
    </div>
  `).join('');
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
updateLegend();
updateList(fc.features);

if (fc.features.length) {
  // Solo ajusta la vista a los puntos si no hay una superficie activa
  if (!capaTematicaActiva) {
    map.fitBounds(geoLayer.getBounds().pad(0.12), {
      animate: false
    });
  }

  setTimeout(corregirRenderMapa, 250);
  setTimeout(corregirRenderMapa, 900);
  setTimeout(corregirRenderMapa, 1800);
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

const sidebarToggle = el('sidebar-toggle');
const sidebarRestore = el('sidebar-restore');

function cambiarVistaMovil(mostrarMapa) {
  if (window.innerWidth > 900) {
    mostrarMapa = false;
  }

  document.body.classList.toggle(
    'sidebar-collapsed',
    mostrarMapa
  );

  if (sidebarToggle) {
    sidebarToggle.setAttribute(
      'aria-expanded',
      String(!mostrarMapa)
    );
  }

  if (mostrarMapa) {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
  }

  setTimeout(() => {
  map.invalidateSize(true);

  if (mostrarMapa) {
    // Si hay una interpolación activa, conserva la vista en Loja
    if (
      capaTematicaActiva &&
      boundsN60 &&
      boundsN60.isValid()
    ) {
      map.fitBounds(boundsN60, {
        animate: false,
        padding: [25, 25],
        maxZoom: 14
      });
    }

    // Si no hay interpolación, muestra los puntos SPT
    else if (
      geoLayer &&
      geoLayer.getBounds &&
      geoLayer.getBounds().isValid()
    ) {
      map.fitBounds(
        geoLayer.getBounds().pad(0.12),
        { animate: false }
      );
    }
  }
}, 250);
}

if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    cambiarVistaMovil(true);
  });
}

if (sidebarRestore) {
  sidebarRestore.addEventListener('click', () => {
    cambiarVistaMovil(false);
  });
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) {
    cambiarVistaMovil(false);
  }
});
