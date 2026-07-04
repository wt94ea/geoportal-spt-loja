# Geoportal Geotécnico SPT - Loja

Geoportal estático para publicar puntos SPT en GitHub Pages usando Leaflet.

## Estructura

```text
geoportal_spt_github/
├── index.html
├── assets/
│   ├── app.js
│   └── style.css
├── data/
│   ├── spt_puntos.geojson
│   └── spt_template.csv
└── tools/
    └── csv_a_geojson.py
```

## Publicar en GitHub Pages

1. Crear una cuenta en GitHub.
2. Crear un repositorio nuevo llamado, por ejemplo: `geoportal-spt-loja`.
3. Subir todos los archivos de esta carpeta.
4. Ir a **Settings → Pages**.
5. En **Build and deployment**, seleccionar:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Guardar.
7. Esperar unos segundos y abrir la URL que GitHub genere.

La URL tendrá un formato parecido a:

```text
https://TU_USUARIO.github.io/geoportal-spt-loja/
```

## Cambiar datos demo por datos reales

El mapa lee este archivo:

```text
data/spt_puntos.geojson
```

Cada punto debe estar en formato GeoJSON, con coordenadas:

```text
[longitud, latitud]
```

Ejemplo:

```json
{
  "type": "Feature",
  "properties": {
    "id": "SPT_001",
    "barrio": "Punzara",
    "parroquia": "Sucre",
    "profundidad_m": 2.0,
    "n60": 18,
    "capacidad_kg_cm2": 1.35,
    "humedad_pct": 28.4,
    "sucs": "CL",
    "aashto": "A-6",
    "nivel_freatico": "No",
    "tipo_suelo": "Arcilla de baja plasticidad",
    "cimentacion": "Zapata aislada"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [-79.2105, -4.0152]
  }
}
```

## Desde ArcGIS Pro

Opción recomendada:

1. Tener tu capa de puntos SPT.
2. Revisar que tenga sistema de coordenadas correcto.
3. Usar la herramienta **Features To JSON**.
4. Activar:
   - **Output to GeoJSON**
   - **Project to WGS84**
5. Guardar como `spt_puntos.geojson`.
6. Reemplazar el archivo dentro de la carpeta `data`.

## Campos recomendados

- `id`
- `barrio`
- `parroquia`
- `profundidad_m`
- `n60`
- `capacidad_kg_cm2`
- `humedad_pct`
- `sucs`
- `aashto`
- `nivel_freatico`
- `tipo_suelo`
- `cimentacion`

## Nota importante

Los puntos incluidos son DEMO. No representan datos reales de ensayos SPT.