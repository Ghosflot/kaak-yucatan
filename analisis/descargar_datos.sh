#!/usr/bin/env bash
# Descarga los datos públicos que respaldan docs/01-hechos-verificados.md.
# Uso: ./analisis/descargar_datos.sh   (deja todo en data/, que no va a Git)
#
# - FIRMS (NASA): archivos anuales por país, sin clave de acceso.
#   MODIS (Terra/Aqua) 2000-2025 y VIIRS S-NPP 2012-2025, México completo (~700 MB con NOAA-20).
# - CONAFOR: base de incendios forestales 2015-2024 (datos.gob.mx) y cierres 2024/2025 (PDF).
# - Natural Earth (estados) y geoBoundaries (municipios): límites aproximados; para cifras oficiales usar INEGI.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/firms data/conafor data/geo

FIRMS=https://firms.modaps.eosdis.nasa.gov/data/country
for y in $(seq 2000 2025); do
  f=data/firms/modis_${y}_Mexico.csv
  [ -s "$f" ] || curl -sfL --max-time 600 -o "$f" "$FIRMS/modis/$y/modis_${y}_Mexico.csv" || echo "falló MODIS $y"
done
for y in $(seq 2012 2025); do
  f=data/firms/viirs-snpp_${y}_Mexico.csv
  [ -s "$f" ] || curl -sfL --max-time 900 -o "$f" "$FIRMS/viirs-snpp/$y/viirs-snpp_${y}_Mexico.csv" || echo "falló VIIRS $y"
done

# NOAA-20 (en FIRMS se llama viirs-jpss1); su registro empieza el 1 de abril de 2018.
for y in $(seq 2018 2025); do
  f=data/firms/viirs-jpss1_${y}_Mexico.csv
  [ -s "$f" ] || curl -sfL --max-time 900 -o "$f" "$FIRMS/viirs-jpss1/$y/viirs-jpss1_${y}_Mexico.csv" || echo "falló NOAA-20 $y"
done

UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36'
curl -sfL -A "$UA" --max-time 300 -o data/conafor/incendios_2015_2024.csv \
  "https://www.datos.gob.mx/dataset/3a1d4a71-4dad-4ae9-9eec-44de7fa8ebf3/resource/ddf38874-6243-4437-8f76-19f797cafa5c/download/estadisticasincendiosforestales2015-2024.csv"
curl -sfL -A "$UA" --max-time 120 -o data/conafor/cierre_2024.pdf \
  https://www.gob.mx/cms/uploads/attachment/file/965295/Cierre_de_la_Temporada_2024.pdf
curl -sfL -A "$UA" --max-time 120 -o data/conafor/cierre_2025.pdf \
  https://www.gob.mx/cms/uploads/attachment/file/1084029/Cierre_de_la_Temporada_2025.pdf

curl -sfL --max-time 300 -o data/geo/admin1.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
# Municipios de México (geoBoundaries, Banco Mundial, CC BY 4.0). Tzucacab no aparece.
curl -sfL --max-time 600 -o data/geo/mex_adm2.geojson \
  https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MEX/ADM2/geoBoundaries-MEX-ADM2.geojson

echo "Listo: $(du -sh data | cut -f1) en data/"
