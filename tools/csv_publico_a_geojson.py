"""
Herramienta opcional para convertir CSV público con lon_wgs84/lat_wgs84 a GeoJSON.
Uso:
    python tools/csv_publico_a_geojson.py data/spt_publico_anonimizado.csv data/spt_puntos.geojson
"""
import csv, json, sys
from pathlib import Path

def as_number(value):
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None
    try:
        n = float(s.replace(",", "."))
        return int(n) if n.is_integer() else n
    except ValueError:
        return s

def main(csv_path, out_path):
    features = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lon = float(str(row.pop("lon_wgs84")).replace(",", "."))
            lat = float(str(row.pop("lat_wgs84")).replace(",", "."))
            props = {k: as_number(v) for k, v in row.items()}
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [lon, lat]}
            })
    Path(out_path).write_text(json.dumps({"type":"FeatureCollection","features":features}, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python tools/csv_publico_a_geojson.py entrada.csv salida.geojson")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
