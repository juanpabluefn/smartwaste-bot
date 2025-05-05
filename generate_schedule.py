# generate_schedule.py
import json
from datetime import datetime, timedelta

# 1) Carga de matrices
with open('matrices.json', encoding='utf-8') as f:
    data = json.load(f)

colonias = data['colonias']    # lista de {id,nombre,lat,lon}
time_min = data['time_min']    # matriz de minutos de viaje
n = len(colonias)

# 2) Definir heurística Nearest Neighbor
def nearest_neighbor(time_matrix):
    m = len(time_matrix)
    visited = [False]*m
    route = [0]        # Partimos del depósito en índice 0
    visited[0] = True

    while len(route) < m:
        last = route[-1]
        # buscar vecino no visitado de menor tiempo
        next_idx = min(
            (j for j in range(m) if not visited[j]),
            key=lambda j: time_matrix[last][j] or float('inf')
        )
        route.append(next_idx)
        visited[next_idx] = True

    route.append(0)    # volver al depósito
    return route

# 3) Calcular ruta
route = nearest_neighbor(time_min)

# 4) Generar el plan de horarios
#    Iniciamos a las 07:00
hora = datetime.strptime("07:00", "%H:%M")
plan = []

for k in range(1, len(route)):
    prev, curr = route[k-1], route[k]
    travel = time_min[prev][curr]
    hora += timedelta(minutes=travel)
    nombre = colonias[curr]['nombre']
    plan.append({
        "colonia": nombre,
        "hora": hora.strftime("%H:%M")
    })
    # agregar 5 min de servicio
    hora += timedelta(minutes=5)

# 5) Guardar en horarios.json
with open('horarios.json', 'w', encoding='utf-8') as f:
    json.dump(plan, f, indent=2, ensure_ascii=False)

print(f"Horario generado con {len(plan)} entradas en horarios.json")
