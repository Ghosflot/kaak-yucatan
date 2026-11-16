"""¿Sirve comparar el mes en curso con lo normal fuera de la temporada de quemas?

Cuenta, para cada municipio de la península, los focos de calor de un tramo del año (por omisión,
del 1 al 15 de noviembre) en cada año de 2001 a 2025, con la misma serie armonizada que usa la
página (pipeline/exportar_web.py: el satélite de cada periodo, con su factor). Después calcula la
mediana de esos 25 años y dice en cuántos municipios es cero: ahí, comparar el mes en curso con
lo normal no diría nada. También da el tramo de 2026 y la mediana de cada estado.

Un foco de calor es un cuadrito de 1 km con fuego en un día (pipeline/rejilla.py). Los municipios
sin ningún foco en el tramo cuentan con cero.

Uso:  .venv/bin/python analisis/mes_en_curso.py [--mes 11] [--desde 1] [--hasta 15]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import exportar_web as ew  # noqa: E402

ANIOS_BASE = range(2001, 2026)
ANIO = 2026


def totales(elegidos: pd.DataFrame, mes: int, desde: int, hasta: int, por: list[str]) -> pd.DataFrame:
    """Focos (escala VIIRS) del tramo en cada año, una fila por grupo y una columna por año."""
    dia = elegidos["dia_local"]
    t = elegidos[(dia.dt.month == mes) & dia.dt.day.between(desde, hasta)]
    tabla = t.assign(anio=t["dia_local"].dt.year).groupby(por + ["anio"], observed=True)["eq"].sum()
    return tabla.unstack("anio").reindex(columns=list(ANIOS_BASE) + [ANIO]).fillna(0.0)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--mes", type=int, default=11)
    p.add_argument("--desde", type=int, default=1)
    p.add_argument("--hasta", type=int, default=15)
    a = p.parse_args()

    elegidos = ew.cargar_elegidos()
    mun = ew.tabla_municipios()[["estado", "municipio"]]
    por_mun = totales(elegidos, a.mes, a.desde, a.hasta, ["estado", "municipio"])
    por_mun = mun.set_index(["estado", "municipio"]).join(por_mun).fillna(0.0)
    mediana = por_mun[list(ANIOS_BASE)].median(axis=1)

    tramo = f"del {a.desde} al {a.hasta} del mes {a.mes}"
    print(f"Focos de calor {tramo}, mediana de {ANIOS_BASE[0]}–{ANIOS_BASE[-1]} por municipio:")
    print(f"  municipios: {len(por_mun)}")
    print(f"  con mediana cero: {int((mediana == 0).sum())}")
    for umbral in (1, 5):
        print(f"  con mediana mayor que {umbral}: {int((mediana > umbral).sum())}")
    print(f"  con algún foco en {ANIO}: {int((por_mun[ANIO] > 0).sum())}")

    print(f"\nPor estado ({tramo}): mediana {ANIOS_BASE[0]}–{ANIOS_BASE[-1]} y {ANIO}")
    est = totales(elegidos, a.mes, a.desde, a.hasta, ["estado"])
    for estado, fila in est.iterrows():
        print(f"  {estado}: {np.median(fila[list(ANIOS_BASE)]):.1f} y {fila[ANIO]:.1f}")

    print("\nMunicipios con la mediana más alta:")
    altos = por_mun.assign(mediana=mediana).sort_values("mediana", ascending=False).head(8)
    for (estado, nombre), fila in altos.iterrows():
        print(f"  {nombre} ({estado}): mediana {fila['mediana']:.1f}, {ANIO}: {fila[ANIO]:.1f}")


if __name__ == "__main__":
    main()
