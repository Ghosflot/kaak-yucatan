"""Pastizal y ganado bovino por municipio de Yucatán (issue #60, section "Cattle ranching" of docs/01).

Junta dos fuentes de INEGI que bajó ./analisis/descargar_ganaderia.sh a data/ganaderia/:
- Uso del Suelo y Vegetación 1:250 000, Serie VII (año base 2018): solo pastizal cultivado e
  inducido, que son los de uso ganadero. El pastizal halófilo es pasto natural de la costa y no
  entra.
- Censo Agropecuario 2022, cuadro ca2022_gan02: bovinos al 15 de septiembre de 2022, en
  unidades de producción y en viviendas (traspatio).

Escribe en datos_peninsula/:
- ganaderia_municipios.csv: municipio, estado, bovinos_2022 (total), bovinos_up_2022 (solo
  unidades de producción), km2, km2_pastizal, pct_pastizal, bovinos_km2, focos (S-NPP 2013–2025,
  con los filtros de analisis/cifras_yucatan.py) y focos_pastizal (los que caen sobre pastizal).
  Las áreas se miden en EPSG:6372 sobre los límites de datos_peninsula/municipios_peninsula.geojson
  (geoBoundaries, simplificados): son aproximadas. pipeline/exportar_web.py lo pasa a la página
  (web/datos/ganaderia.json).
- pastizal_yucatan.geojson: los polígonos de pastizal de Yucatán, simplificados a 50 m, para
  cruzarlos con los focos sin volver a leer la Serie VII (analisis/cifras_ganaderia.py).

Necesita geopandas y openpyxl, que no están en requirements.txt porque solo los usa este paso:
    pip install geopandas openpyxl
    python analisis/preparar_ganaderia.py
"""
from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

import geopandas as gpd
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "analisis"))
import cifras_ganaderia as cg  # noqa: E402
DATOS = RAIZ / "data" / "ganaderia"
USV = DATOS / "usv_serie7" / "conjunto_de_datos" / "cdv_usuev250sVII_cnal.shp"
CENSO = DATOS / "ca2022_gan02.xlsx"
MUNICIPIOS = RAIZ / "datos_peninsula" / "municipios_peninsula.geojson"
SALIDA_CSV = RAIZ / "datos_peninsula" / "ganaderia_municipios.csv"
SALIDA_PASTIZAL = RAIZ / "datos_peninsula" / "pastizal_yucatan.geojson"

ESTADO = "Yucatán"
CLAVE_CENSO = "31"  # Yucatán en el marco geoestadístico de INEGI
PASTIZAL_GANADERO = ("PASTIZAL CULTIVADO", "PASTIZAL INDUCIDO")
METROS = 6372              # México ITRF2008 / LCC: áreas en metros
SIMPLIFICAR_M = 50         # el geojson de pastizal no debe pasar de 2 MB (docs/02, tarea 15)
TAMANO_MAX = 2_000_000


def clave(nombre: str) -> str:
    """Nombre sin acentos ni mayúsculas: el censo escribe «Dzan» y «Dzilam De Bravo»."""
    sin = unicodedata.normalize("NFKD", str(nombre)).encode("ascii", "ignore").decode()
    return " ".join(sin.lower().split())


def municipios() -> gpd.GeoDataFrame:
    m = gpd.read_file(MUNICIPIOS).set_crs(4326, allow_override=True)
    m = m[m["estado"] == ESTADO].to_crs(METROS)
    m["km2"] = m.area / 1e6
    return m[["municipio", "estado", "km2", "geometry"]].reset_index(drop=True)


def pastizal(mun: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Polígonos de pastizal ganadero dentro de cada municipio de Yucatán."""
    crs_usv = gpd.read_file(USV, rows=1).crs
    caja = tuple(mun.to_crs(crs_usv).total_bounds)
    usv = gpd.read_file(USV, bbox=caja)
    usv = usv[usv["DESCRIPCIO"].isin(PASTIZAL_GANADERO)].to_crs(METROS)
    return gpd.overlay(usv[["DESCRIPCIO", "geometry"]], mun[["municipio", "geometry"]],
                       how="intersection", keep_geom_type=True)


def bovinos() -> pd.DataFrame:
    """Bovinos por municipio de Yucatán: total y solo unidades de producción (columna A del cuadro)."""
    c = pd.read_excel(CENSO, header=None, skiprows=12).iloc[:, [0, 1, 2, 3, 4]]
    c.columns = ["entidad", "municipio", "tipo", "nombre", "bovinos"]
    c = c[c["entidad"].astype(str).str.startswith(CLAVE_CENSO)
          & c["municipio"].fillna("").astype(str).str.strip().ne("")]
    tipo = c["tipo"].fillna("").astype(str).str.strip()
    c["municipio"] = c["municipio"].astype(str).str.strip()
    total = c[tipo == ""].set_index("municipio")["bovinos"]
    up = c[tipo.str.startswith("UP")].set_index("municipio")["bovinos"]
    b = pd.DataFrame({"bovinos_2022": total, "bovinos_up_2022": up}).astype(int)
    b.index = [clave(n) for n in b.index]
    return b


def escribir_pastizal(past: gpd.GeoDataFrame) -> None:
    g = past.dissolve(by="municipio").simplify(SIMPLIFICAR_M).to_crs(4326)
    capa = gpd.GeoDataFrame({"municipio": g.index}, geometry=g.values, crs=4326)
    texto = capa.to_json(drop_id=True, to_wgs84=True)
    datos = json.loads(texto)
    for f in datos["features"]:  # 5 decimales (~1 m) bastan y bajan el tamaño a la mitad
        f["geometry"] = json.loads(json.dumps(f["geometry"]), parse_float=lambda x: round(float(x), 5))
    salida = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    if len(salida.encode()) > TAMANO_MAX:
        raise SystemExit(f"pastizal_yucatan.geojson pesa {len(salida) / 1e6:.1f} MB: sube SIMPLIFICAR_M")
    SALIDA_PASTIZAL.write_text(salida + "\n", encoding="utf-8")
    print(f"{SALIDA_PASTIZAL.relative_to(RAIZ)}: {len(salida.encode()) / 1e6:.2f} MB")


def main() -> None:
    mun = municipios()
    past = pastizal(mun)
    km2_past = (past.area / 1e6).groupby(past["municipio"]).sum()
    b = bovinos()

    t = mun.drop(columns="geometry").set_index("municipio")
    t["km2_pastizal"] = km2_past.reindex(t.index).fillna(0.0)
    t["pct_pastizal"] = 100 * t["km2_pastizal"] / t["km2"]
    sin_censo = [m for m in t.index if clave(m) not in b.index]
    sobran = sorted(set(b.index) - {clave(m) for m in t.index})
    if sin_censo or sobran:
        print("No casan con el censo:", sin_censo, "| del censo sin límite:", sobran)
    t = t.join(b, on=t.index.map(clave))
    t["bovinos_km2"] = t["bovinos_2022"] / t["km2"]

    # Los focos se cruzan con el geojson simplificado, el mismo que usa cifras_ganaderia.py.
    escribir_pastizal(past)
    f = cg.focos_snpp()
    t = t.join(f.groupby("municipio").agg(focos=("pasto", "size"), focos_pastizal=("pasto", "sum")))
    t[["focos", "focos_pastizal"]] = t[["focos", "focos_pastizal"]].fillna(0).astype(int)

    t = t.sort_index().reset_index()[["municipio", "estado", "bovinos_2022", "bovinos_up_2022", "km2",
                                      "km2_pastizal", "pct_pastizal", "bovinos_km2", "focos", "focos_pastizal"]]
    t.round({"km2": 1, "km2_pastizal": 1, "pct_pastizal": 1, "bovinos_km2": 2}).to_csv(
        SALIDA_CSV, index=False, encoding="utf-8")
    print(f"{SALIDA_CSV.relative_to(RAIZ)}: {len(t)} municipios; "
          f"{int(t.bovinos_2022.sum()):,} bovinos ({int(t.bovinos_up_2022.sum()):,} en unidades de producción); "
          f"pastizal {t.km2_pastizal.sum():,.0f} km² ({100 * t.km2_pastizal.sum() / t.km2.sum():.1f} % de Yucatán); "
          f"{int(t.focos_pastizal.sum()):,} de {int(t.focos.sum()):,} focos sobre pastizal")


if __name__ == "__main__":
    main()
