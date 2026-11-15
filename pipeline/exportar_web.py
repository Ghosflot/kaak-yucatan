"""Convierte los datos del cálculo en los archivos que lee la página (web/datos/).

Uso: python pipeline/exportar_web.py

Escribe:
- web/datos/municipios.json: la lista de municipios (id, nombre, estado, zona de quema y
  ventana oficial), ordenada por estado y nombre.
- web/datos/municipios.geojson: los límites municipales, con el mismo id.
- web/datos/portada.json: todo lo que usa la portada (mapa, repaso, cierre y panel). El contorno
  de cada estado es la unión de sus municipios, para que calce con sus bordes.
- web/datos/municipio/<id>.json: un archivo por municipio, que la página carga al elegirlo, con
  sus focos de 2026, sus cuadritos que se repiten y sus hechos (datos_web.hechos()).
- web/datos/fechas.json: el fuego de un año normal por mes y municipio, para «Fechas de quema».
- web/datos/zonas.json: cada zona de quema de Yucatán, con su ventana y el fuego de cada día de
  enero a junio de 2026 (el calendario de «Fechas de quema»), y cada año de 2001 a 2026 antes,
  dentro y después de las fechas permitidas de hoy.
- web/datos/metodo.json: lo que usa «Cómo lo medimos»: Yucatán en temporada, cada año sin
  calibrar y calibrado (el salto de 2012, con las razones de la validación), los satélites de
  cada periodo y la hora de su paso, los días sin datos, los factores, la fuente fija de Mérida
  y el cruce con CONAFOR.
- web/datos/validacion.json: el resultado de cada prueba de la validación (tarea 7,
  salidas/validacion.json) y los datos de su gráfica, que la página dibuja (las mismas que las
  PNG de salidas/graficas/). La frase de cada caso está en web/textos (claves val…).
- web/datos/satelites.json: cada satélite por su cuenta (Yucatán en temporada, sin calibrar y
  calibrado) contra la serie unida, para el selector de «¿Se puede confiar?» (#32).
- web/datos/serie_armonizada.csv: copia de salidas/serie_armonizada.csv, para descargarla.
  Es el único archivo que pasa de 2 MB: la página no lo carga, solo lo enlaza.
- La tabla CSV de cada municipio la arma la página con su JSON.

Las cifras salen de los mismos cuadritos-día y factores que la serie de la tarea 5
(pipeline/serie.py), sumados por día (pipeline/datos_web.py). Solo `paso`, `nocturnos` y
`fuenteFija` de metodo.json cuentan focos de FIRMS uno por uno (lo que miden es el satélite, no
el fuego), y `datoHasta` de la portada es la fecha del último foco de cada sensor. Todo lo que
hay en web/datos/ lo escribe este script: no se edita a mano.
"""
from __future__ import annotations

import functools
import json
import math
import re
import shutil
import unicodedata
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from shapely.geometry import MultiPolygon, Polygon, shape
import shapely

import datos_web as dw
from cargar import celdas_fuente_fija

RAIZ = Path(__file__).resolve().parent.parent
MUNICIPIOS_ZONA = RAIZ / "analisis" / "municipios_zona.csv"
ZONAS_QUEMA = RAIZ / "analisis" / "zonas_quema_yucatan.csv"
LIMITES = RAIZ / "datos_peninsula" / "municipios_peninsula.geojson"
SERIE = RAIZ / "salidas" / "serie_armonizada.csv"
FACTORES = RAIZ / "salidas" / "factores.csv"
DIAS_SIN_DATOS = RAIZ / "salidas" / "dias_sin_datos.csv"
CRUCE_CONAFOR = RAIZ / "analisis" / "salidas" / "cruce_conafor.csv"
VALIDACION = RAIZ / "salidas" / "validacion.json"
SALIDA = RAIZ / "web" / "datos"

ANIOS_BASE = range(2001, 2026)
ANIO = 2026
ZONA_TIRA = "Yucatán 2"  # la tira de fechas permitidas de la portada
SIMPLIFICAR = 0.25  # tolerancia de los caminos del mapa, en unidades del lienzo
# Ciudades de referencia del mapa (lat, lon).
CIUDADES = {"Mérida": (20.967, -89.623), "Campeche": (19.845, -90.523),
            "Cancún": (21.161, -86.851), "Chetumal": (18.5, -88.296)}

# Decimales de las coordenadas del mapa: 4 decimales son ~11 m, de sobra para un municipio.
DECIMALES = 4
CLASES = ["muyabajo", "abajo", "normal", "arriba", "muyarriba", "poco"]  # orden de los dígitos de porAnio
TOPE_BYTES = 2 * 1024 * 1024
# Archivos que solo se descargan (la página no los carga): no cuentan para TOPE_BYTES.
DESCARGAS = {"serie_armonizada.csv"}

# Contorno de cada estado: la unión de sus municipios. El mapa municipal deja rendijas entre
# vecinos; se cierran dilatando y erosionando CIERRE grados (unos 55 m). Una parte de la unión
# de menos de ASTILLA_KM2 se toma por astilla y se quita; las islas más grandes se quedan.
ORDEN_ESTADOS = ["Quintana Roo", "Campeche", "Yucatán"]
CIERRE = 0.0005
ASTILLA_KM2 = 0.1
KM_GRADO = 111.32

DIAS_RECIENTES = 7  # «los últimos 7 días» de la portada fuera de temporada
SENSORES_DATO = ["S-NPP", "NOAA-20", "MODIS"]  # la fecha del último dato de cada uno (datoHasta)
REPETIDO_MIN = 5  # un cuadrito «se repite» si tuvo fuego en 5 o más temporadas de 2012 a 2025

# Las zonas de quema de Yucatán con un nombre llano, en orden («Yucatán 1» a «Yucatán 4»).
LUGARES_ZONA = {
    "Yucatán 1": ("el sur y oriente", "the south and east"),
    "Yucatán 2": ("el centro y norte", "the center and north"),
    "Yucatán 3": ("el sur", "the south"),
    "Yucatán 4": ("el norte y oriente", "the north and east"),
}
ANIOS_TIPICO = (2012, 2025)  # «lo típico» de cada zona: con el satélite de hoy

# La hora del paso: focos de día de Yucatán, en hora de Mérida sin horario de verano (UTC−6).
# Un año con menos de MINIMO_PASO focos de día no se da.
SATELITES_PASO = ["Terra", "Aqua", "S-NPP"]
DESFASE_LOCAL = -6
MINIMO_PASO = 30
FUENTE_FIJA = ("Mérida", "Yucatán")  # el municipio de la fuente fija (type 2) que cuenta la página
# Cuántos días duró cada incendio de la CONAFOR (Fecha_Termino − Fecha_Inicio + 1), por tramos.
DURACIONES_CONAFOR = [("1", 1, 1), ("2–3", 2, 3), ("4–7", 4, 7), (">7", 8, None)]
# Cruce con CONAFOR: un incendio de más de GRANDE_HA hectáreas es «grande». Lo que coincidiría
# por azar ya no va aquí: la página lo lee de la validación (azarSnpp en validacion.json).
GRANDE_HA = 100


def identificador(nombre: str) -> str:
    """«Tizimín» → «tizimin». Sirve para nombres de archivo y enlaces (#/municipio/tizimin)."""
    ascii_ = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower()).strip("-")


def tabla_municipios() -> pd.DataFrame:
    mun = pd.read_csv(MUNICIPIOS_ZONA, dtype=str)
    zonas = pd.read_csv(ZONAS_QUEMA, dtype=str)
    # Se compara por id: la lista de zonas escribe «Dzan» y la de municipios «Dzán».
    inferidos = set(zonas.loc[zonas["fuente"].str.startswith("inferido"), "municipio"].map(identificador))
    mun["id"] = mun["municipio"].map(identificador)
    mun["zona_inferida"] = mun["id"].isin(inferidos)
    if mun["id"].duplicated().any():
        repetidos = sorted(mun.loc[mun["id"].duplicated(keep=False), "municipio"])
        raise ValueError(f"Dos municipios dan el mismo id: {repetidos}")
    return mun.sort_values(["estado", "municipio"]).reset_index(drop=True)


def registro(fila: pd.Series) -> dict:
    """Los datos fijos de un municipio, como los ve la página."""
    ventana = None
    if pd.notna(fila["ventana_inicio"]):
        ventana = {"inicio": fila["ventana_inicio"], "fin": fila["ventana_fin"]}
    return {
        "id": fila["id"],
        "nombre": fila["municipio"],
        "estado": fila["estado"],
        "zona": fila["zona"],
        "ventana": ventana,
        "zona_inferida": bool(fila["zona_inferida"]),
    }


def redondear(coords, decimales: int):
    if isinstance(coords[0], (int, float)):
        return [round(c, decimales) for c in coords]
    return [redondear(c, decimales) for c in coords]


def limites_con_id(mun: pd.DataFrame) -> dict:
    geo = json.loads(LIMITES.read_text(encoding="utf-8"))
    ids = dict(zip(mun["municipio"] + "|" + mun["estado"], mun["id"]))
    faltan = []
    for f in geo["features"]:
        p = f["properties"]
        clave = f"{p['municipio']}|{p['estado']}"
        if clave not in ids:
            faltan.append(clave)
            continue
        f["properties"] = {"id": ids[clave], "nombre": p["municipio"], "estado": p["estado"]}
        f["geometry"]["coordinates"] = redondear(f["geometry"]["coordinates"], DECIMALES)
    if faltan:
        raise ValueError(f"Municipios del mapa sin fila en {MUNICIPIOS_ZONA.name}: {faltan}")
    return geo


def escribir(ruta: Path, datos) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    if len(texto.encode("utf-8")) > TOPE_BYTES:
        raise ValueError(f"{ruta} pasa de 2 MB; hay que partirlo o simplificarlo")
    ruta.write_text(texto, encoding="utf-8")


def camino(geom) -> str:
    """Geometría lon/lat → camino SVG en el lienzo de la página, simplificado."""
    g = shapely.transform(geom, lambda c: np.column_stack(dw.proyectar(c[:, 0], c[:, 1]))).simplify(SIMPLIFICAR)
    partes = []
    for p in _partes(g):
        pts = list(p.exterior.coords)
        if len(pts) >= 4:
            partes.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
    return "".join(partes)


def formas(mun: pd.DataFrame) -> dict[str, tuple[str, object]]:
    """id → (estado, geometría lon/lat) de cada municipio del mapa."""
    ids = dict(zip(mun["municipio"] + "|" + mun["estado"], mun["id"]))
    return {ids[f"{f['properties']['municipio']}|{f['properties']['estado']}"]: (f["properties"]["estado"],
                                                                              shape(f["geometry"]))
            for f in json.loads(LIMITES.read_text(encoding="utf-8"))["features"]}


def _partes(g) -> list:
    return [g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))


def km2(g) -> float:
    """Área aproximada de una geometría lon/lat, en km²."""
    return g.area * KM_GRADO ** 2 * math.cos(math.radians(g.centroid.y))


def contorno_estado(geoms: list):
    """La unión de los municipios de un estado, sin huecos ni astillas; las islas se quedan."""
    u = shapely.union_all(geoms).buffer(CIERRE, join_style="mitre").buffer(-CIERRE, join_style="mitre")
    partes = [Polygon(p.exterior) for p in _partes(u)]
    return MultiPolygon([p for p in partes if km2(p) >= ASTILLA_KM2])


def geometria_mapa(mun: pd.DataFrame, geo: dict[str, tuple[str, object]]) -> tuple[list[dict], list[dict]]:
    nombres = dict(zip(mun["id"], mun["municipio"]))
    muns = []
    for i, (estado, g) in geo.items():
        cx, cy = dw.proyectar(*g.representative_point().coords[0])
        muns.append({"id": i, "n": nombres[i], "e": estado,
                     "d": camino(g), "cx": round(float(cx), 1), "cy": round(float(cy), 1)})
    estados = [{"n": e, "d": camino(contorno_estado([g for est, g in geo.values() if est == e]))}
               for e in ORDEN_ESTADOS]
    return muns, estados


def _xy(lat_celda, lon_celda) -> tuple[np.ndarray, np.ndarray]:
    x, y = dw.proyectar(np.asarray(lon_celda, dtype=float), np.asarray(lat_celda, dtype=float))
    return np.round(x, 1), np.round(y, 1)


def r1(a) -> list:
    return [round(float(v), 1) for v in a]


def resumen_temporada(dias: pd.Series) -> dict:
    """Totales por año, lo normal, la curva acumulada y el perfil de un año normal."""
    t = {a: dw.temporada(dias, a) for a in list(ANIOS_BASE) + [ANIO]}
    totales = {a: float(t[a].sum()) for a in t}
    acum_normal = dw.normal_acumulado(t, ANIOS_BASE)
    return {
        "por_anio": t,
        "totales": totales,
        "normal": float(np.median([totales[a] for a in ANIOS_BASE])),
        "acum26": np.cumsum(t[ANIO]),
        "acum_normal": acum_normal,
        "dia_normal": np.diff(acum_normal, prepend=0.0),
    }


def datos_municipio(r: dict, dias: pd.Series) -> dict:
    res = resumen_temporada(dias)
    v26, normal = res["totales"][ANIO], res["normal"]
    despues = None
    if r["ventana"]:
        despues = dw.fraccion_despues(res["dia_normal"], dw.indice_de(r["ventana"]["fin"]))
    return {
        **r,
        "anios": [{"y": a, "total": round(res["totales"][a], 1)} for a in sorted(res["totales"])],
        "normal": round(normal, 1),
        "v26": round(v26, 1),
        "clase": dw.clase(v26, normal),
        "diaNormal": r1(res["dia_normal"]),
        "porAnio": {str(a): r1(v) for a, v in res["por_anio"].items()},
        "despues": None if despues is None else round(despues, 3),
        "rango": dw.rango([res["totales"][a] for a in ANIOS_BASE]),
    }


def focos_2026(celdas: pd.DataFrame) -> list:
    """[lon, lat, «MM-DD», satélite] de cada cuadrito-día de 2026 de un municipio (el centro del cuadrito)."""
    t = celdas[celdas["dia_local"].dt.year == ANIO].sort_values(["dia_local", "lat_celda", "lon_celda"])
    return [[round(float(lon), DECIMALES), round(float(lat), DECIMALES), d.strftime("%m-%d"), s]
            for lon, lat, d, s in zip(t["lon_celda"], t["lat_celda"], t["dia_local"], t["satelite"])]


def cuadritos_repetidos(celdas: pd.DataFrame, fijas: pd.DataFrame) -> list:
    """[lon, lat, temporadas] de los cuadritos con fuego en REPETIDO_MIN o más temporadas (marzo a
    mayo) de 2012 a 2025, sin los cuadritos con historial de fuente fija (`fijas`)."""
    dia = celdas["dia_local"]
    t = celdas[dia.dt.year.between(dw.DESDE_VIIRS, ANIO - 1) & dia.dt.month.isin([3, 4, 5])]
    t = t.merge(fijas.assign(_fija=True), on=["lat_celda", "lon_celda"], how="left")
    t = t[t["_fija"].isna()]
    anios = t.assign(y=t["dia_local"].dt.year).groupby(["lat_celda", "lon_celda"])["y"].nunique()
    anios = anios[anios >= REPETIDO_MIN].reset_index().sort_values(
        ["y", "lat_celda", "lon_celda"], ascending=[False, True, True])
    return [[round(float(lon), DECIMALES), round(float(lat), DECIMALES), int(n)]
            for lon, lat, n in zip(anios["lon_celda"], anios["lat_celda"], anios["y"])]


def inicios_por_zona(registros: list[dict], detalle: dict, perfiles: dict) -> dict[str, int]:
    """Cuándo empieza el fuego (10 % del año normal) en cada zona: la mediana de sus municipios
    con dw.MINIMO_FECHAS o más en un año normal."""
    por_zona: dict[str, list[int]] = {}
    for r in registros:
        empieza = dw.dia_con_fraccion(perfiles[r["id"]], 0.1)
        if detalle[r["id"]]["normal"] >= dw.MINIMO_FECHAS and empieza is not None:
            por_zona.setdefault(r["zona"], []).append(empieza)
    return {z: int(np.floor(np.median(v) + 0.5)) for z, v in por_zona.items()}


def lugares_en_estado(registros: list[dict], detalle: dict) -> dict[str, tuple[int, int]]:
    """Lugar de cada municipio en su estado por fuego de un año normal (1 = el de más) y cuántos son."""
    sale = {}
    for r in registros:
        del_estado = [detalle[o["id"]]["normal"] for o in registros if o["estado"] == r["estado"]]
        sale[r["id"]] = (1 + sum(n > detalle[r["id"]]["normal"] for n in del_estado), len(del_estado))
    return sale


def caja(g) -> list[float]:
    """[lon0, lat0, lon1, lat1] de una geometría."""
    return [round(float(v), DECIMALES) for v in g.bounds]


def dia_del_anio(mes_dia: str) -> int:
    """«04-20» → días desde el 1 de enero de 2026 (el 1 de enero es 0)."""
    return (date.fromisoformat(f"{ANIO}-{mes_dia}") - date(ANIO, 1, 1)).days


def dias_zona(elegidos: pd.DataFrame, zona: str, hasta: date) -> np.ndarray:
    """Fuego por día de 2026 en una zona de quema de Yucatán, del 1 de enero a `hasta`."""
    filtro = (elegidos["estado"] == "Yucatán") & (elegidos["zona"] == zona)
    fechas = pd.date_range(date(ANIO, 1, 1), hasta, freq="D")
    return dw.unicos(elegidos, filtro).reindex(fechas, fill_value=0.0).to_numpy(dtype=float)


def ventana_zona(mun: pd.DataFrame, zona: str) -> pd.Series:
    return mun[(mun["estado"] == "Yucatán") & (mun["zona"] == zona)].iloc[0]


def tira_zona(elegidos: pd.DataFrame, mun: pd.DataFrame) -> dict:
    """Fuego por día de enero a junio de 2026 en la zona de la tira, con su ventana."""
    valores = dias_zona(elegidos, ZONA_TIRA, date(ANIO, 6, 30))
    fila = ventana_zona(mun, ZONA_TIRA)
    ini, fin = dia_del_anio(fila["ventana_inicio"]), dia_del_anio(fila["ventana_fin"])
    return {"dias": r1(valores), "ini": ini, "fin": fin, "tot": round(float(valores.sum()), 1),
            "dentro": round(float(valores[ini:fin + 1].sum()), 1),
            "ventana": {"inicio": fila["ventana_inicio"], "fin": fila["ventana_fin"]}}


def reparto_anual(dias: pd.Series, inicio: str, fin: str, anios) -> dict[str, list | None]:
    """Cada año, la parte del fuego de enero a junio que cae antes, dentro y después de la
    ventana «MM-DD» a «MM-DD» (la de hoy, aplicada a todos los años). None si no hubo fuego."""
    sale = {}
    for a in anios:
        v = dias[(dias.index.year == a) & (dias.index.month <= 6)]
        tot = float(v.sum())
        if tot <= 0:
            sale[str(a)] = None
            continue
        ini, fin_ = pd.Timestamp(f"{a}-{inicio}"), pd.Timestamp(f"{a}-{fin}")
        partes = [v[v.index < ini].sum(), v[(v.index >= ini) & (v.index <= fin_)].sum(), v[v.index > fin_].sum()]
        sale[str(a)] = [round(float(x) / tot, 3) for x in partes]
    return sale


def tipico(por_anio: dict[str, list | None], anios: tuple[int, int]) -> list[float]:
    """[antes, dentro, después] de un año típico: la mediana de cada parte en `anios`."""
    filas = [por_anio[str(a)] for a in range(anios[0], anios[1] + 1) if por_anio.get(str(a))]
    return [round(float(x), 3) for x in np.median(np.array(filas), axis=0)]


def zonas_yucatan(elegidos: pd.DataFrame, mun: pd.DataFrame) -> dict:
    """Cada zona de quema de Yucatán: su ventana y el fuego de cada día de enero a junio de 2026.

    Es el mismo periodo que la tira de la portada, para que las dos digan la misma cifra.
    `ultimo` es el índice del último día con datos (180 si ya pasó junio). Además, cada año de
    2001 a 2026 con la ventana de hoy (`porAnio`), el año típico desde 2012 (`tipico`), la menor
    parte fuera de la ventana en los 26 años (`minFuera`) y el nombre llano de la zona.
    """
    actualizado = elegidos["dia_local"].max().date()
    fin_temporada = date(ANIO, 6, 30)
    yuc = mun[mun["estado"] == "Yucatán"]
    zonas = []
    for zona in sorted(yuc["zona"].unique()):
        de_zona = yuc[yuc["zona"] == zona]
        fila = ventana_zona(mun, zona)
        v = dias_zona(elegidos, zona, fin_temporada)
        ini, fin = dia_del_anio(fila["ventana_inicio"]), dia_del_anio(fila["ventana_fin"])
        todos = dw.unicos(elegidos, (elegidos["estado"] == "Yucatán") & (elegidos["zona"] == zona))
        por_anio = reparto_anual(todos, fila["ventana_inicio"], fila["ventana_fin"], list(ANIOS_BASE) + [ANIO])
        lugar, lugar_en = LUGARES_ZONA[zona]
        zonas.append({
            "zona": zona, "n": zona.split()[-1],
            "municipios": len(de_zona), "inferidos": int(de_zona["zona_inferida"].sum()),
            "ventana": {"inicio": fila["ventana_inicio"], "fin": fila["ventana_fin"]},
            "ini": ini, "fin": fin, "dias": r1(v),
            "tot": round(float(v.sum()), 1), "antes": round(float(v[:ini].sum()), 1),
            "dentro": round(float(v[ini:fin + 1].sum()), 1), "despues": round(float(v[fin + 1:].sum()), 1),
            "porAnio": por_anio, "tipico": tipico(por_anio, ANIOS_TIPICO),
            "minFuera": round(min(1 - x[1] for x in por_anio.values() if x), 3),
            "lugar": lugar, "lugarEn": lugar_en,
        })
    ultimo = (min(actualizado, fin_temporada) - date(ANIO, 1, 1)).days
    return {"actualizado": actualizado.isoformat(), "ultimo": ultimo, "zonas": zonas}


def puntos_2026(elegidos: pd.DataFrame) -> tuple[list, dict, list]:
    """Los cuadritos de la temporada 2026: los del día con más fuego y los de cada día."""
    dia = elegidos["dia_local"]
    t = elegidos[(dia.dt.year == ANIO) & dia.dt.month.isin([3, 4, 5])]
    celdas = t.drop_duplicates(["dia_local", "lat_celda", "lon_celda"])
    por_dia = celdas.groupby("dia_local").size()
    dia_max = por_dia.idxmax()
    hoy = celdas[celdas["dia_local"] == dia_max]
    x, y = _xy(hoy["lat_celda"], hoy["lon_celda"])
    pts = [[float(a), float(b)] for a, b in zip(x, y)]
    celdas = celdas.assign(i=(celdas["dia_local"] - pd.Timestamp(date(ANIO, 3, 1))).dt.days)
    agrupado = celdas.groupby(["lat_celda", "lon_celda"])["i"].apply(lambda s: sorted(int(v) for v in s.unique()))
    lat = agrupado.index.get_level_values(0)
    lon = agrupado.index.get_level_values(1)
    cx, cy = _xy(lat, lon)
    rep = [[float(a), float(b), d] for a, b, d in zip(cx, cy, agrupado.to_list())]
    return pts, {"fecha": dia_max.date().isoformat(), "n": int(len(hoy))}, rep


def reciente(elegidos: pd.DataFrame) -> dict:
    """Focos de calor de los últimos DIAS_RECIENTES días con datos, en Yucatán y en la península."""
    hasta = elegidos["dia_local"].max()
    desde = hasta - pd.Timedelta(days=DIAS_RECIENTES - 1)
    en = elegidos["dia_local"].between(desde, hasta)
    return {"dias": DIAS_RECIENTES, "desde": desde.date().isoformat(), "hasta": hasta.date().isoformat(),
            "yuc": round(float(dw.unicos(elegidos, en & (elegidos["estado"] == "Yucatán")).sum()), 1),
            "peninsula": round(float(dw.unicos(elegidos, en).sum()), 1)}


def sat_dia(elegidos: pd.DataFrame) -> dict:
    """Qué satélite cuenta cada día de la temporada de 2026: el del periodo («base») y los días
    sin datos que rellenó su respaldo («otros», por día de la temporada, 0 = 1 de marzo)."""
    import serie

    base = serie.satelite_del_periodo([pd.Timestamp(ANIO, 3, 1)]).iloc[0]
    dia = elegidos["dia_local"]
    t = elegidos[(dia.dt.year == ANIO) & dia.dt.month.isin([3, 4, 5]) & (elegidos["satelite"] != base)]
    otros = t.groupby("dia_local")["satelite"].first()
    return {"base": base, "otros": {str(dw.dia_de_temporada(d.date())): s for d, s in otros.items()}}


def dato_hasta(crudos: pd.DataFrame) -> dict:
    """La fecha (UTC, como la da FIRMS) del último foco de cada sensor."""
    ultimo = crudos.groupby("sensor")["acq_date"].max()
    return {s: ultimo[s].date().isoformat() for s in SENSORES_DATO if s in ultimo.index}


def meses(dias: pd.Series) -> dict:
    """Mediana por mes de 2001 a 2025, y los meses de 2026."""
    indice = list(ANIOS_BASE) + [ANIO]
    if len(dias):
        m = dias.groupby([dias.index.year, dias.index.month]).sum()
        tabla = m.unstack(fill_value=0.0).reindex(index=indice, columns=range(1, 13), fill_value=0.0)
    else:
        tabla = pd.DataFrame(0.0, index=indice, columns=range(1, 13))
    return {"meses": r1(tabla.loc[list(ANIOS_BASE)].median(axis=0)), "meses26": r1(tabla.loc[ANIO])}


def salto_yucatan() -> dict:
    """El salto de 2012 en Yucatán, tal como lo mide la prueba 1 de la validación (una sola fuente
    para las dos páginas): el año completo, de 2009–2011 a 2013–2015, sin calibrar y calibrado."""
    p = next(p for p in json.loads(VALIDACION.read_text(encoding="utf-8"))["pruebas"] if p["id"] == "salto_2012")
    v, y = p["valores"], p["metricas"]["yucatan"]
    return {"antes": [v["antesDesde"], v["antesHasta"]], "despues": [v["despuesDesde"], v["despuesHasta"]],
            "crudo": round(y["razon_cruda"], 2), "armonizado": round(y["razon_armonizada"], 2)}


def hora_local(acq_time: pd.Series) -> np.ndarray:
    """HHMM en UTC → horas decimales en Mérida sin horario de verano (UTC−6)."""
    t = acq_time.to_numpy(dtype=float)
    return ((t // 100) + (t % 100) / 60 + DESFASE_LOCAL) % 24


def reloj(horas: float) -> str:
    """10.783 → «10:47»."""
    minutos = int(round(horas * 60)) % (24 * 60)
    return f"{minutos // 60}:{minutos % 60:02d}"


def paso(validos: pd.DataFrame) -> dict:
    """Hora local mediana del paso de día de cada satélite, por año, con los focos de Yucatán.

    Terra y Aqua se fueron saliendo de su órbita: con los años pasan a otra hora, y el fuego no
    es el mismo a las 9 que a las 11 de la mañana.
    """
    dia = validos[(validos["estado"] == "Yucatán") & (validos["daynight"] == "D")
                  & validos["satelite"].isin(SATELITES_PASO)]
    dia = dia.assign(hora=hora_local(dia["acq_time"]), y=dia["acq_date"].dt.year)
    dia = dia[dia["y"] >= ANIOS_BASE[0]]
    sale = {}
    for sat in SATELITES_PASO:
        g = dia[dia["satelite"] == sat].groupby("y")["hora"].agg(["median", "size"])
        sale[sat] = {str(a): reloj(f["median"]) for a, f in g.iterrows() if f["size"] >= MINIMO_PASO}
    return sale


def nocturnos(validos: pd.DataFrame) -> float:
    """Parte de los focos de S-NPP en Yucatán que son del paso de la madrugada."""
    s = validos[(validos["estado"] == "Yucatán") & (validos["satelite"] == "S-NPP")]
    return round(float((s["daynight"] == "N").mean()), 3)


def fuente_fija(crudos: pd.DataFrame) -> dict:
    """Todas las detecciones de FIRMS en el municipio de FUENTE_FIJA y cuántas son fuente fija (type 2)."""
    municipio, estado = FUENTE_FIJA
    m = crudos[(crudos["municipio"] == municipio) & (crudos["estado"] == estado)]
    return {"municipio": municipio, "detecciones": int(len(m)),
            "fijas": int((pd.to_numeric(m["type"], errors="coerce") == 2).sum())}


def sin_datos() -> dict:
    """Los días en que el satélite del periodo no mandó datos y cuántos rellenó su respaldo."""
    huecos = pd.read_csv(DIAS_SIN_DATOS, encoding="utf-8-sig")
    return {"dias": int(len(huecos)), "rellenados": int(huecos["rellenado"].astype(bool).sum())}


def conafor_por_duracion(cruce: pd.DataFrame) -> list[dict]:
    """De los incendios de la CONAFOR, qué parte vio algún satélite (n_todos), según cuántos días duró."""
    dias = (pd.to_datetime(cruce["fin"]) - pd.to_datetime(cruce["ini"])).dt.days + 1
    sale = []
    for nombre, desde, hasta in DURACIONES_CONAFOR:
        g = cruce[(dias >= desde) & ((dias <= hasta) if hasta else True)]
        sale.append({"dias": nombre, "vistos": round(100 * float((g["n_todos"] > 0).mean())), "n": int(len(g))})
    return sale


def metodo(elegidos: pd.DataFrame, validos: pd.DataFrame, crudos: pd.DataFrame) -> dict:
    """«Cómo lo medimos»: el salto de 2012 en Yucatán, los periodos y la hora de cada satélite,
    los días sin datos, los factores, la fuente fija de Mérida y CONAFOR."""
    import serie

    en_yucatan = elegidos["estado"] == "Yucatán"
    armonizado = resumen_temporada(dw.unicos(elegidos, en_yucatan))["totales"]
    crudo = resumen_temporada(dw.unicos(elegidos.assign(eq=1.0), en_yucatan))["totales"]

    factores = pd.read_csv(FACTORES)
    temporada = factores["epoca"] == "temporada"
    aqua = factores[temporada & (factores["satelite"] == "Aqua") & factores["zona"].str.startswith("Yucatán")]

    cruce = pd.read_csv(CRUCE_CONAFOR)
    visto = cruce["n_snpp"] > 0
    grande = cruce["Total_hectareas"] > GRANDE_HA
    return {
        "anios": [{"y": a, "crudo": round(crudo[a], 1), "armonizado": round(armonizado[a], 1)}
                  for a in sorted(armonizado)],
        "salto": salto_yucatan(),
        "periodos": [{"sat": s, "desde": d.isoformat(), "hasta": h.isoformat() if h else None}
                     for s, d, h in serie.PERIODOS],
        "paso": paso(validos), "nocturnos": nocturnos(validos),
        "sinDatos": sin_datos(), "fuenteFija": fuente_fija(crudos),
        # NOAA-20 contra S-NPP ya no va aquí: lo cuenta la prueba «viirs» de la validación.
        "factores": {"aqua": [round(float(aqua["factor"].min()), 1), round(float(aqua["factor"].max()), 1)]},
        "conafor": {"incendios": len(cruce), "desde": int(cruce["anio"].min()), "hasta": int(cruce["anio"].max()),
                    "vistos": round(100 * float(visto.mean())),
                    "grandes": round(100 * float(visto[grande].mean())), "nGrandes": int(grande.sum()), "ha": GRANDE_HA,
                    "porDuracion": conafor_por_duracion(cruce)},
        "serieMB": round(SERIE.stat().st_size / 1e6),
    }


# Tamaños de incendio de la CONAFOR, en orden, con su rótulo corto para la gráfica.
TAMANOS_CONAFOR = [("0 a 5 Hectáreas", "0–5"), ("6 a 10 Hectáreas", "6–10"), ("11 a 20 Hectáreas", "11–20"),
                   ("21 a 50 Hectáreas", "21–50"), ("51 a 100 Hectáreas", "51–100"), ("Mayor a 100 Hectáreas", ">100")]


def grafica_validacion(p: dict) -> dict:
    """Lo que dibuja la página para cada prueba: lo mismo que su PNG en salidas/graficas/."""
    m = p["metricas"]
    if p["id"] == "salto_2012":
        pen = m["peninsula"]
        return {"totales": [{"y": t["anio"], "crudo": round(t["crudo"]), "cal": round(t["armonizado"]),
                             "transicion": t["transicion"]} for t in pen["totales"]],
                "razonCruda": round(pen["razon_cruda"], 2), "razonCal": round(pen["razon_armonizada"], 2),
                "natural": [round(pen["rango_natural"]["min"], 2), round(pen["rango_natural"]["max"], 2)],
                "meta": [p["umbral"]["razon_min"], p["umbral"]["razon_max"]]}
    if p["id"] == "aqua_fuera_muestra":
        return {"anios": [{"y": a["anio"], "snpp": round(a["observado"]), "zonaEpoca": round(a["predicho_zona_epoca"]),
                           "unico": round(a["predicho_unico"])} for a in m["por_anio"]],
                "modelo": m["modelo"]}
    if p["id"] == "conafor":
        s = m["por_satelite"]["S-NPP"]
        return {"real": round(s["real"]), "azar": round(s["azar_mayor"]),
                "tamanos": [{"t": corto, "n": m["por_tamano"][largo]["incendios"],
                             "pct": round(m["por_tamano"][largo]["snpp"])} for largo, corto in TAMANOS_CONAFOR],
                "metaGrandes": round(p["umbral"]["grandes_min"])}
    if p["id"] == "viirs":
        return {sat.replace("-", "").lower(): [{"y": a["anio"], "razon": round(a["razon"], 3), "completo": a["completo"]}
                                              for a in m[sat]["por_anio"]] for sat in ("NOAA-20", "NOAA-21")} | {
                "meta": [p["umbral"]["razon_min"], p["umbral"]["razon_max"]]}
    raise ValueError(f"prueba sin gráfica: {p['id']}")


def validacion() -> dict:
    """«¿Se puede confiar?»: el caso, los números y los datos de la gráfica de cada prueba.

    La página arma cada frase con t(clave, valores), igual que pipeline/validar.py; aquí no se
    escribe ningún texto.
    """
    v = json.loads(VALIDACION.read_text(encoding="utf-8"))
    return {"pruebas": [{"id": p["id"], "estado": p["estado"], "caso": p["caso"], "clave": p["clave"],
                         "valores": p["valores"], "grafica": grafica_validacion(p)} for p in v["pruebas"]]}


SATELITES = {"Terra": "MODIS", "Aqua": "MODIS", "S-NPP": "VIIRS", "NOAA-20": "VIIRS"}


def satelites(cuadritos: pd.DataFrame, factores: pd.DataFrame) -> dict:
    """Cada satélite contado solo (nunca sumado a otro), sin calibrar y calibrado, en Yucatán.

    Se cuenta igual que la serie de la página (cuadritos únicos por día, temporada de marzo a
    mayo) para poder ponerlo encima de ella. Por satélite van:
    - serie: los años en que la serie de la página usa ese satélite (en temporada);
    - calibracion: los años con que se calculó su factor. Los que no están en ninguna de las
      dos listas sirven de comprobación independiente;
    - incompletos: años cuya temporada empieza antes del primer dato del satélite en FIRMS.
    """
    import serie
    import armonizar

    yuc = cuadritos[(cuadritos["estado"] == "Yucatán") & cuadritos["satelite"].isin(list(SATELITES))]
    cal = serie.aplicar_factores(yuc, factores)
    inicio_temporada = lambda a: date(a, 3, 1)  # noqa: E731 (la temporada de dw.temporada)
    sale = []
    for sat, sensor in SATELITES.items():
        de_sat = cal[cal["satelite"] == sat]
        if de_sat.empty:
            continue
        todos = pd.Series(True, index=de_sat.index)
        dias_cal = dw.unicos(de_sat, todos)
        dias_crudo = dw.unicos(de_sat.assign(eq=1.0), todos)
        primero = cuadritos.loc[cuadritos["satelite"] == sat, "dia_local"].min().date()
        anios = []
        for a in list(ANIOS_BASE) + [ANIO]:
            crudo = float(dw.temporada(dias_crudo, a).sum())
            if crudo > 0:
                anios.append({"y": a, "crudo": round(crudo, 1),
                              "cal": round(float(dw.temporada(dias_cal, a).sum()), 1)})
        en_serie = [a["y"] for a in anios
                    if any(s == sat and d <= date(a["y"], 5, 31) and (h is None or h >= inicio_temporada(a["y"]))
                           for s, d, h in serie.PERIODOS)]
        if sat in serie.MODIS:
            calibracion = [armonizar.PERIODO_MODIS[0].year, armonizar.PERIODO_MODIS[1].year]
        elif sat == armonizar.REFERENCIA:
            calibracion = None  # es la escala: no lleva factor
        else:
            # El factor de NOAA-20 se calculó con todos los días en que coincide con S-NPP
            # (armonizar.PERIODO_NOAA20, 1 abr 2018 a 1 nov 2026): no hay años independientes.
            calibracion = [armonizar.PERIODO_NOAA20[0].year, armonizar.PERIODO_NOAA20[1].year]
        sale.append({"sat": sat, "sensor": sensor, "anios": anios, "serie": en_serie,
                     "calibracion": calibracion,
                     "incompletos": [a["y"] for a in anios if primero > inicio_temporada(a["y"])]})
    return {"satelites": sale}


def por_anio(ids: list[str], yuc_ids: list[str], totales: dict, valores: dict, anios: list[int]) -> dict:
    """Cada año de cada municipio contra su normal, para pintar el mapa y la tarjeta de ese año.

    Las clases van como una cadena de dígitos en el orden de `ids` (posición en CLASES), para que pesen poco;
    la cuenta de municipios con más o menos fuego es solo de Yucatán, como la de 2026.
    """
    yuc = set(yuc_ids)
    clases, cuenta = {}, {}
    for j, a in enumerate(anios):
        c = {i: dw.clase(totales[i][j], valores[i][1]) for i in ids}
        clases[str(a)] = "".join(str(CLASES.index(c[i])) for i in ids)
        cy = [c[i] for i in ids if i in yuc]
        cuenta[str(a)] = {"comparados": sum(x != "poco" for x in cy),
                          "menos": sum(x in ("muyabajo", "abajo") for x in cy),
                          "mas": sum(x in ("arriba", "muyarriba") for x in cy)}
    return {"anios": anios, "ids": ids, "clases": clases, "cuenta": cuenta, "v": [totales[i] for i in ids]}


@functools.lru_cache(maxsize=1)
def cargar_crudos() -> pd.DataFrame:
    """Los focos tal como vienen de FIRMS (historial y recientes), sin filtrar."""
    from cargar import leer_focos

    return leer_focos()


@functools.lru_cache(maxsize=1)
def cargar_validos() -> pd.DataFrame:
    """Los focos que cuentan (cargar.cargar_focos(), sobre los mismos crudos)."""
    from cargar import leer_catalogo, preparar_focos

    return preparar_focos(cargar_crudos(), leer_catalogo())


@functools.lru_cache(maxsize=1)
def cargar_cuadritos() -> pd.DataFrame:
    from rejilla import cuadritos_dia

    return cuadritos_dia(cargar_validos())


def cargar_elegidos() -> pd.DataFrame:
    import serie

    return dw.elegidos_con_factor(cargar_cuadritos(), serie.leer_factores())


def exportar(salida: Path = SALIDA, elegidos: pd.DataFrame | None = None) -> dict:
    mun = tabla_municipios()
    registros = [registro(f) for _, f in mun.iterrows()]
    if elegidos is None:
        elegidos = cargar_elegidos()
    if salida.exists():
        shutil.rmtree(salida)
    escribir(salida / "municipios.json", registros)
    escribir(salida / "municipios.geojson", limites_con_id(mun))

    crudos = cargar_crudos()
    geo = formas(mun)
    diarios = {clave: g.set_index("dia_local")["eq"]
               for clave, g in dw.diario(elegidos, ["estado", "municipio"]).groupby(["estado", "municipio"])}
    celdas = dict(list(elegidos.groupby(["estado", "municipio"], observed=True)))
    vacia = pd.Series(dtype=float, index=pd.DatetimeIndex([]))
    clases, valores, fechas, totales_mun, detalle, perfiles = {}, {}, [], {}, {}, {}
    for r in registros:
        dias = diarios.get((r["estado"], r["nombre"]), vacia)
        d = datos_municipio(r, dias)
        detalle[r["id"]] = d
        perfiles[r["id"]] = dw.perfil_anual(dias, ANIOS_BASE)
        clases[r["id"]] = d["clase"]
        valores[r["id"]] = [d["v26"], d["normal"]]
        totales_mun[r["id"]] = [a["total"] for a in d["anios"]]
        fechas.append({"id": r["id"], "n": r["nombre"], "e": r["estado"], "zona": r["zona"],
                       "ventana": r["ventana"], "inferida": r["zona_inferida"], **meses(dias)})
    escribir(salida / "fechas.json", fechas)

    # Los hechos comparan cada municipio con su zona y su estado: van cuando ya están todos.
    fijas = celdas_fuente_fija(crudos)
    inicio_zona = inicios_por_zona(registros, detalle, perfiles)
    lugares = lugares_en_estado(registros, detalle)
    for r in registros:
        d = detalle[r["id"]]
        de_mun = celdas.get((r["estado"], r["nombre"]), elegidos.iloc[:0])
        d["focos26"] = focos_2026(de_mun)
        d["repetidos"] = cuadritos_repetidos(de_mun, fijas)
        d["caja"] = caja(geo[r["id"]][1])
        d["hechos"] = dw.hechos({a["y"]: a["total"] for a in d["anios"]}, d["normal"], perfiles[r["id"]],
                                ANIO, inicio_zona.get(r["zona"]), lugares[r["id"]])
        escribir(salida / "municipio" / f"{r['id']}.json", d)

    yuc_ids = [r["id"] for r in registros if r["estado"] == "Yucatán"]
    cuenta = {
        "total": len(yuc_ids),
        "comparados": sum(clases[i] != "poco" for i in yuc_ids),
        "menos": sum(clases[i] in ("muyabajo", "abajo") for i in yuc_ids),
        "mas": sum(clases[i] in ("arriba", "muyarriba") for i in yuc_ids),
    }
    yuc = resumen_temporada(dw.unicos(elegidos, elegidos["estado"] == "Yucatán"))
    muns, estados = geometria_mapa(mun, geo)
    pts, dia_max, rep = puntos_2026(elegidos)
    ciudades = []
    for t, (lat, lon) in CIUDADES.items():
        x, y = dw.proyectar(lon, lat)
        ciudades.append({"t": t, "x": round(float(x), 1), "y": round(float(y), 1)})
    portada = {
        "mun": muns, "estados": estados, "ciudades": ciudades,
        "pts": pts, "diaMax": dia_max, "rep": rep,
        "acum26": r1(yuc["acum26"]), "acumNormal": r1(yuc["acum_normal"]),
        "clases": clases, "valores": valores, "cuenta": cuenta,
        "yuc": {"anios": {str(a): round(v, 1) for a, v in yuc["totales"].items()}, "normal": round(yuc["normal"], 1),
                "acum": {str(a): r1(np.cumsum(v)) for a, v in yuc["por_anio"].items()},
                "rango": dw.rango([yuc["totales"][a] for a in ANIOS_BASE])},
        "porAnio": por_anio([r["id"] for r in registros], yuc_ids, totales_mun, valores, sorted(yuc["totales"])),
        "z2": tira_zona(elegidos, mun),
        "actualizado": elegidos["dia_local"].max().date().isoformat(),
        "reciente": reciente(elegidos), "satDia": sat_dia(elegidos), "datoHasta": dato_hasta(crudos),
    }
    escribir(salida / "portada.json", portada)
    escribir(salida / "zonas.json", zonas_yucatan(elegidos, mun))
    escribir(salida / "metodo.json", metodo(elegidos, cargar_validos(), crudos))
    escribir(salida / "validacion.json", validacion())
    import serie
    escribir(salida / "satelites.json", satelites(cargar_cuadritos(), serie.leer_factores()))
    shutil.copyfile(SERIE, salida / "serie_armonizada.csv")
    print(f"web/datos: {len(registros)} municipios; Yucatán 2026 {yuc['totales'][ANIO]:,.0f} "
          f"contra {yuc['normal']:,.0f}; {cuenta['menos']} de {cuenta['total']} con menos fuego")
    return portada


if __name__ == "__main__":
    exportar()
