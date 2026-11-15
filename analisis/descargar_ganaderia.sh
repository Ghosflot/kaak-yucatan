#!/usr/bin/env bash
# Descarga los datos de INEGI de la sección «Ganadería» de docs/01 (issue #60).
# Uso: ./analisis/descargar_ganaderia.sh   (deja todo en data/ganaderia/, que no va a Git)
#
# - Uso del Suelo y Vegetación 1:250 000, Serie VII, conjunto nacional (año base 2018, SHP, ~294 MB).
#   Página: https://www.inegi.org.mx/programas/usyv/ (pestaña «Descargas»). Bajado el 14 nov 2026.
# - Censo Agropecuario 2022, cuadro ca2022_gan02: «Existencias ganaderas según principal especie
#   pecuaria por entidad federativa, municipio y tipo de unidad de observación» (XLSX, 1 MB).
#   Página: https://www.inegi.org.mx/programas/ca/2022/ (pestaña «Tabulados»). Bajado el 14 nov 2026.
#
# Las páginas de INEGI arman sus botones con JavaScript: si una liga deja de servir, se baja a mano
# desde la página y se deja en la misma ruta.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/ganaderia

UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36'
# TODO(Misa): las ligas exactas de los botones de descarga (clic derecho → «Copiar dirección del enlace»).
USV_ZIP=""
CENSO_XLSX=""

if [ ! -s data/ganaderia/usv_serie7/conjunto_de_datos/cdv_usuev250sVII_cnal.shp ]; then
  [ -n "$USV_ZIP" ] || { echo "Falta la liga de la Serie VII: bájala a mano (ver arriba)"; exit 1; }
  curl -sfL -A "$UA" --max-time 1800 -o data/ganaderia/usv_serie7.zip "$USV_ZIP"
  unzip -oq data/ganaderia/usv_serie7.zip -d data/ganaderia/usv_serie7
fi
if [ ! -s data/ganaderia/ca2022_gan02.xlsx ]; then
  [ -n "$CENSO_XLSX" ] || { echo "Falta la liga del cuadro ca2022_gan02: bájalo a mano (ver arriba)"; exit 1; }
  curl -sfL -A "$UA" --max-time 300 -o data/ganaderia/ca2022_gan02.xlsx "$CENSO_XLSX"
fi

echo "Listo: $(du -sh data/ganaderia | cut -f1) en data/ganaderia/"
