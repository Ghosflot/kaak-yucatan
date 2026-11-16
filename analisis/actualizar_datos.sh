#!/bin/bash
# Actualiza datos_peninsula/ con lo último de FIRMS y lo sube al repo, en un solo paso.
# Pensado para la última descarga de S-NPP (deja de enviar datos el 2 nov 2026, 13:00 UTC),
# pero sirve cualquier día.
#
# Uso (la clave NUNCA se guarda; se pasa solo para esta ejecución):
#   FIRMS_MAP_KEY=tu_clave analisis/actualizar_datos.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${FIRMS_MAP_KEY:?Falta FIRMS_MAP_KEY (la clave de FIRMS) delante del comando}"
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }

git pull -q --rebase origin main
.venv/bin/python analisis/descargar_firms_api.py
.venv/bin/python analisis/preparar_peninsula.py | tail -5

# La guía de los datos dice hasta qué día llegan: se actualiza sola.
HASTA=$(.venv/bin/python -c "import pandas as pd; f=pd.read_parquet('datos_peninsula/focos_peninsula.parquet'); print(f.acq_date.max().date())")
sed -i -E "s/Datos hasta el [^.]*\./Datos hasta el $HASTA (AAAA-MM-DD)./" datos_peninsula/es/LEEME.md
sed -i -E "s/Data through [^.]*\./Data through $HASTA (YYYY-MM-DD)./" datos_peninsula/README.md

git add datos_peninsula
if git diff --cached --quiet; then
  echo "Sin cambios en los datos."
else
  git -c user.name=Ghosflot -c user.email=79164971+Ghosflot@users.noreply.github.com \
    commit -q -m "Datos de FIRMS actualizados hasta $HASTA"
  git push -q origin main
  echo "Listo: datos hasta $HASTA subidos al repo."
fi
