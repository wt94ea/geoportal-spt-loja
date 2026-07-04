"""
Convierte un CSV con columnas lat/lon a GeoJSON.
Uso:
    python csv_a_geojson.py data/spt_template.csv data/spt_puntos.geojson

El CSV debe tener columnas:
    lat, lon
El resto de columnas se guardan como atributos.
"""

import csv
import json
import sys
from pathlib import Path

def as_number(value):
    if value is None:
        return value
    value = str(value).strip()
    if value == "":
        return None
    try:
        return int(value) if value.isdigit() else float(value)
    except ValueError:
        return value

def csv_to_geojson(csv_path, geojson_path):
    features = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if "lat" not in reader.fieldnames or "lon" not in reader.fieldnames:
            raise ValueError("El CSV debe tener columnas lat y lon.")

        for row in reader:
            lat = float(str(row["lat"]).replace(",", "."))
            lon = float(str(row["lon"]).replace(",", "."))
            props = {k: as_number(v) for k, v in row.items() if k not in ("lat", "lon")}
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [lon, lat]}
            })

    fc = {"type": "FeatureCollection", "features": features}
    Path(geojson_path).write_text(json.dumps(fc, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python csv_a_geojson.py entrada.csv salida.geojson")
        sys.exit(1)
    csv_to_geojson(sys.argv[1], sys.argv[2])
    print(f"GeoJSON creado: {sys.argv[2]}")