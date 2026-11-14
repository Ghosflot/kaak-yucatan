"""Descarga focos de FIRMS por API para la península de Yucatán (lo que no está en los archivos anuales).

Cubre 2026 de todos los satélites y el registro completo de NOAA-21. Combina el producto
estándar (SP), que tiene unos meses de retraso, con el de tiempo casi real (NRT) para lo más
reciente. Las fechas salen de /api/data_availability.

Uso (la clave NUNCA se guarda en el repo; se pasa como variable de entorno):
    FIRMS_MAP_KEY=tu_clave python analisis/descargar_firms_api.py

Pide la clave gratis con un correo en https://firms.modaps.eosdis.nasa.gov/api/map_key
Límite: 5000 transacciones cada 10 minutos.
"""
from __future__ import annotations

import csv
import io
import os
import sys
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "data" / "firms_api"
CAJA = "-92.6,17.7,-86.6,21.8"  # oeste,sur,este,norte: península de Yucatán
BLOQUE = 5  # días por petición
BASE = "https://firms.modaps.eosdis.nasa.gov/api"

# (fuente, desde): «desde» limita lo que pedimos; el resto viene de los archivos anuales.
PEDIDOS = [
    ("MODIS_SP", date(2026, 1, 1)), ("MODIS_NRT", None),
    ("VIIRS_SNPP_SP", date(2026, 1, 1)), ("VIIRS_SNPP_NRT", None),
    ("VIIRS_NOAA20_SP", date(2026, 1, 1)), ("VIIRS_NOAA20_NRT", None),
    # NRT solo acepta fechas recientes (pedir 2024 da error 400); empieza donde acaba SP.
    ("VIIRS_NOAA21_SP", None), ("VIIRS_NOAA21_NRT", date(2026, 7, 1)),
]


def leer(url: str) -> str:
    for intento in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read().decode("utf-8")
        except Exception:  # red inestable: reintentar con espera
            if intento == 3:
                raise
            time.sleep(5 * (intento + 1))
    return ""


def main() -> None:
    clave = os.environ.get("FIRMS_MAP_KEY")
    if not clave:
        sys.exit("Falta FIRMS_MAP_KEY en el entorno.")
    disp = {r["data_id"]: r for r in csv.DictReader(io.StringIO(leer(f"{BASE}/data_availability/csv/{clave}/ALL")))}
    SALIDA.mkdir(parents=True, exist_ok=True)
    for fuente, desde in PEDIDOS:
        if fuente not in disp:
            # Pasará con S-NPP después del 2 nov 2026: FIRMS puede dejar de listarlo.
            print(f"AVISO: FIRMS ya no ofrece {fuente}; se conserva lo descargado antes.")
            continue
        ini = date.fromisoformat(disp[fuente]["min_date"])
        fin = date.fromisoformat(disp[fuente]["max_date"])
        if desde and desde > ini:
            ini = desde
        destino = SALIDA / f"{fuente}_{ini}_{fin}.csv"
        if destino.exists():
            print(f"ya existe {destino.name}")
            continue
        filas, cabecera, d = [], None, ini
        while d <= fin:
            dias = min(BLOQUE, (fin - d).days + 1)
            texto = leer(f"{BASE}/area/csv/{clave}/{fuente}/{CAJA}/{dias}/{d}")
            lineas = texto.strip().splitlines()
            if not lineas or "," not in lineas[0]:
                sys.exit(f"Respuesta inesperada en {fuente} {d}: {texto[:200]}")
            cabecera = cabecera or lineas[0]
            filas += lineas[1:]
            d += timedelta(days=dias)
        destino.write_text("\n".join([cabecera] + filas) + "\n")
        # Una descarga nueva cubre lo mismo que la anterior y más: se borra la vieja para que
        # preparar_peninsula.py no cuente dos veces los mismos focos.
        for viejo in SALIDA.glob(f"{fuente}_*.csv"):
            if viejo != destino:
                viejo.unlink()
                print(f"  reemplaza a {viejo.name}")
        print(f"{fuente}: {ini} a {fin}, {len(filas)} focos -> {destino.name}")


if __name__ == "__main__":
    main()
