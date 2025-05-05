# compute_distances.py
import csv, json, time
import requests

# 1) Leer colonias.csv
colonias = []
with open('colonias.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        colonias.append({
            'id': int(row['id']),
            'nombre': row['nombre'],
            'lat': float(row['lat']),
            'lon': float(row['lon'])
        })

n = len(colonias)

# 2) Preparar matrices vacías
dist_km = [[0]*n for _ in range(n)]
time_min = [[0]*n for _ in range(n)]

# 3) Función para llamar a OSRM Table Service
def query_osrm(coords):
    # coords: list of "lon,lat"
    base = 'http://router.project-osrm.org/table/v1/driving/'
    url = base + ';'.join(coords) + '?annotations=duration,distance'
    resp = requests.get(url)
    return resp.json()

# 4) Construir la lista de coordenadas en formato "lon,lat"
coords = [f"{c['lon']},{c['lat']}" for c in colonias]

# 5) Llamamos una sola vez a OSRM (máximo ~100 puntos en un request)
data = query_osrm(coords)

# 6) Extraemos matrices
for i in range(n):
    for j in range(n):
        # distancia en metros → km
        dist = data['distances'][i][j] or 0
        dur  = data['durations'][i][j] or 0
        dist_km[i][j]  = round(dist / 1000, 3)
        time_min[i][j] = round(dur  / 60,  1)

# 7) Guardar en matrices.json
out = {
    'colonias': colonias,
    'dist_km':  dist_km,
    'time_min': time_min
}
with open('matrices.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"Matrices generadas y guardadas en matrices.json ({n}×{n})")
