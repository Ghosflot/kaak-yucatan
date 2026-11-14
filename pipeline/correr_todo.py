"""Corre todo el cálculo en orden con una sola orden (tarea 19, docs/02).

Uso: python pipeline/correr_todo.py

Cada etapa es un script de pipeline/ que se corre tal cual. Si una etapa todavía no existe,
se salta y se avisa; si una falla, se detiene ahí. Cuando llegue una etapa nueva, se agrega
a ETAPAS en su lugar. calendario_provisional.py (tarea 1) ya no se corre: serie.py (tarea 5)
escribe el calendario definitivo con el mismo contrato.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent

ETAPAS = [
    "armonizar.py",               # tareas 3 y 4: factores
    "serie.py",                   # tarea 5: serie de 25 años y lo normal
    "recurrencia.py",             # tarea 6
    "validar.py",                 # tarea 7
    "exportar_web.py",            # tarea 10
]


def main() -> None:
    for etapa in ETAPAS:
        script = PIPELINE / etapa
        if not script.is_file():
            print(f"-- {etapa}: todavía no existe, se salta")
            continue
        print(f"== {etapa}", flush=True)
        resultado = subprocess.run([sys.executable, str(script)], cwd=PIPELINE.parent)
        if resultado.returncode != 0:
            sys.exit(f"Falló {etapa} (código {resultado.returncode}); no se corren las siguientes.")
    print("Listo.")


if __name__ == "__main__":
    main()
