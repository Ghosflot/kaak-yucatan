"""Convierte los datos del cálculo en los archivos que lee la página (web/datos/).

Uso: python pipeline/exportar_web.py

Escribe:
- web/datos/municipios.json: la lista de municipios (id, nombre, estado, zona de quema y
  ventana oficial), ordenada por estado y nombre.
- web/datos/municipios.geojson: los límites municipales, con el mismo id.
- web/datos/portada.json: todo lo que usa la portada (mapa, repaso, cierre y panel).
- web/datos/municipio/<id>.json: un archivo por municipio, que la página carga al elegirlo.
- web/datos/fechas.json: el fuego de un año normal por mes y municipio, para «Fechas de quema».
- web/datos/zonas.json: cada zona de quema de Yucatán, con su ventana y el fuego de cada día de
  enero a junio de 2026 (el calendario de «Fechas de quema»).
- web/datos/metodo.json: lo que usa «Cómo lo medimos»: Yucatán en temporada, cada año sin
  calibrar y calibrado (el salto de 2012), los satélites de cada periodo, los factores y el
  cruce con CONAFOR.
- web/datos/validacion.json y web/datos/validacion/*.png: el resultado de cada prueba de la
  validación (tarea 7, salidas/validacion.json) y sus gráficas, para «¿Se puede confiar?». Solo
  van el caso y los números: la frase de cada caso está en web/textos (claves val…).
- web/datos/satelites.json: cada satélite por su cuenta (Yucatán en temporada, sin calibrar y
  calibrado) contra la serie unida, para el selector de «¿Se puede confiar?» (#32).
- web/datos/serie_armonizada.csv: copia de salidas/serie_armonizada.csv, para descargarla.
  Es el único archivo que pasa de 2 MB: la página no lo carga, solo lo enlaza.
- La tabla CSV de cada municipio la arma la página con su JSON.

Las cifras salen de los mismos cuadritos-día y factores que la serie de la tarea 5
(pipeline/serie.py), sumados por día (pipeline/datos_web.py). Todo lo que hay en web/datos/
lo escribe este script: no se edita a mano.
"""
from __future__ import annotations

import functools
import json
import re
import shutil
import unicodedata
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from shapely.geometry import shape
import shapely

import datos_web as dw

RAIZ = Path(__file__).resolve().parent.parent
MUNICIPIOS_ZONA = RAIZ / "analisis" / "municipios_zona.csv"
ZONAS_QUEMA = RAIZ / "analisis" / "zonas_quema_yucatan.csv"
LIMITES = RAIZ / "datos_peninsula" / "municipios_peninsula.geojson"
ESTADOS = RAIZ / "datos_peninsula" / "estados_peninsula.geojson"
SERIE = RAIZ / "salidas" / "serie_armonizada.csv"
FACTORES = RAIZ / "salidas" / "factores.csv"
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

# El salto de 2012 se mide como la prueba 1 de la validación (tarea 7): 2013–2015 contra 2009–2011.
SALTO_ANTES = (2009, 2011)
SALTO_DESPUES = (2013, 2015)
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
    polys = [g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))
    partes = []
    for p in polys:
        pts = list(p.exterior.coords)
        if len(pts) >= 4:
            partes.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
    return "".join(partes)


def geometria_mapa(mun: pd.DataFrame) -> tuple[list[dict], list[dict]]:
    ids = dict(zip(mun["municipio"] + "|" + mun["estado"], mun["id"]))
    muns = []
    for f in json.loads(LIMITES.read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        g = shape(f["geometry"])
        cx, cy = dw.proyectar(*g.representative_point().coords[0])
        muns.append({"id": ids[f"{p['municipio']}|{p['estado']}"], "n": p["municipio"], "e": p["estado"],
                     "d": camino(g), "cx": round(float(cx), 1), "cy": round(float(cy), 1)})
    estados = [{"n": f["properties"]["estado"], "d": camino(shape(f["geometry"]))}
               for f in json.loads(ESTADOS.read_text(encoding="utf-8"))["features"]]
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
    }


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


def zonas_yucatan(elegidos: pd.DataFrame, mun: pd.DataFrame) -> dict:
    """Cada zona de quema de Yucatán: su ventana y el fuego de cada día de enero a junio de 2026.

    Es el mismo periodo que la tira de la portada, para que las dos digan la misma cifra.
    `ultimo` es el índice del último día con datos (180 si ya pasó junio).
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
        zonas.append({
            "zona": zona, "n": zona.split()[-1],
            "municipios": len(de_zona), "inferidos": int(de_zona["zona_inferida"].sum()),
            "ventana": {"inicio": fila["ventana_inicio"], "fin": fila["ventana_fin"]},
            "ini": ini, "fin": fin, "dias": r1(v),
            "tot": round(float(v.sum()), 1), "antes": round(float(v[:ini].sum()), 1),
            "dentro": round(float(v[ini:fin + 1].sum()), 1), "despues": round(float(v[fin + 1:].sum()), 1),
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


def meses(dias: pd.Series) -> dict:
    """Mediana por mes de 2001 a 2025, y los meses de 2026."""
    indice = list(ANIOS_BASE) + [ANIO]
    if len(dias):
        m = dias.groupby([dias.index.year, dias.index.month]).sum()
        tabla = m.unstack(fill_value=0.0).reindex(index=indice, columns=range(1, 13), fill_value=0.0)
    else:
        tabla = pd.DataFrame(0.0, index=indice, columns=range(1, 13))
    return {"meses": r1(tabla.loc[list(ANIOS_BASE)].median(axis=0)), "meses26": r1(tabla.loc[ANIO])}


def salto(totales: dict[int, float]) -> float:
    """Cuántas veces el fuego de SALTO_DESPUES es el de SALTO_ANTES (promedio de cada periodo)."""
    def promedio(periodo):
        return float(np.mean([totales[a] for a in range(periodo[0], periodo[1] + 1)]))
    return round(promedio(SALTO_DESPUES) / promedio(SALTO_ANTES), 2)


def metodo(elegidos: pd.DataFrame) -> dict:
    """«Cómo lo medimos»: el salto de 2012 en Yucatán, los periodos, los factores y CONAFOR."""
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
        "salto": {"antes": list(SALTO_ANTES), "despues": list(SALTO_DESPUES),
                  "crudo": salto(crudo), "armonizado": salto(armonizado)},
        "periodos": [{"sat": s, "desde": d.isoformat(), "hasta": h.isoformat() if h else None}
                     for s, d, h in serie.PERIODOS],
        # NOAA-20 contra S-NPP ya no va aquí: lo cuenta la prueba «viirs» de la validación.
        "factores": {"aqua": [round(float(aqua["factor"].min()), 1), round(float(aqua["factor"].max()), 1)]},
        "conafor": {"incendios": len(cruce), "desde": int(cruce["anio"].min()), "hasta": int(cruce["anio"].max()),
                    "vistos": round(100 * float(visto.mean())),
                    "grandes": round(100 * float(visto[grande].mean())), "nGrandes": int(grande.sum()), "ha": GRANDE_HA},
        "serieMB": round(SERIE.stat().st_size / 1e6),
    }


def validacion(salida: Path) -> dict:
    """«¿Se puede confiar?»: el caso y los números de cada prueba, y sus gráficas en salida/validacion/.

    La página arma cada frase con t(clave, valores), igual que pipeline/validar.py; aquí no se
    escribe ningún texto. Las métricas completas se quedan en salidas/validacion.json.
    """
    v = json.loads(VALIDACION.read_text(encoding="utf-8"))
    pruebas = []
    for p in v["pruebas"]:
        graficas = {}
        for idioma, ruta in p["grafica"].items():
            origen = VALIDACION.parent / ruta
            destino = salida / "validacion" / origen.name
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origen, destino)
            graficas[idioma] = f"validacion/{origen.name}"
        pruebas.append({"id": p["id"], "estado": p["estado"], "caso": p["caso"], "clave": p["clave"],
                        "valores": p["valores"], "grafica": graficas})
    return {"pruebas": pruebas}


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
            # El factor de NOAA-20 se calculó con todos los años en que coincide con S-NPP.
            calibracion = [anios[0]["y"], anios[-1]["y"]]
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
def cargar_cuadritos() -> pd.DataFrame:
    from cargar import cargar_focos
    from rejilla import cuadritos_dia

    return cuadritos_dia(cargar_focos())


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

    diarios = {clave: g.set_index("dia_local")["eq"]
               for clave, g in dw.diario(elegidos, ["estado", "municipio"]).groupby(["estado", "municipio"])}
    vacia = pd.Series(dtype=float, index=pd.DatetimeIndex([]))
    clases, valores, fechas, totales_mun = {}, {}, [], {}
    for r in registros:
        dias = diarios.get((r["estado"], r["nombre"]), vacia)
        d = datos_municipio(r, dias)
        escribir(salida / "municipio" / f"{r['id']}.json", d)
        clases[r["id"]] = d["clase"]
        valores[r["id"]] = [d["v26"], d["normal"]]
        totales_mun[r["id"]] = [a["total"] for a in d["anios"]]
        fechas.append({"id": r["id"], "n": r["nombre"], "e": r["estado"], "zona": r["zona"],
                       "ventana": r["ventana"], "inferida": r["zona_inferida"], **meses(dias)})
    escribir(salida / "fechas.json", fechas)

    yuc_ids = [r["id"] for r in registros if r["estado"] == "Yucatán"]
    cuenta = {
        "total": len(yuc_ids),
        "comparados": sum(clases[i] != "poco" for i in yuc_ids),
        "menos": sum(clases[i] in ("muyabajo", "abajo") for i in yuc_ids),
        "mas": sum(clases[i] in ("arriba", "muyarriba") for i in yuc_ids),
    }
    yuc = resumen_temporada(dw.unicos(elegidos, elegidos["estado"] == "Yucatán"))
    muns, estados = geometria_mapa(mun)
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
                "acum": {str(a): r1(np.cumsum(v)) for a, v in yuc["por_anio"].items()}},
        "porAnio": por_anio([r["id"] for r in registros], yuc_ids, totales_mun, valores, sorted(yuc["totales"])),
        "z2": tira_zona(elegidos, mun),
        "actualizado": elegidos["dia_local"].max().date().isoformat(),
    }
    escribir(salida / "portada.json", portada)
    escribir(salida / "zonas.json", zonas_yucatan(elegidos, mun))
    escribir(salida / "metodo.json", metodo(elegidos))
    escribir(salida / "validacion.json", validacion(salida))
    import serie
    escribir(salida / "satelites.json", satelites(cargar_cuadritos(), serie.leer_factores()))
    shutil.copyfile(SERIE, salida / "serie_armonizada.csv")
    print(f"web/datos: {len(registros)} municipios; Yucatán 2026 {yuc['totales'][ANIO]:,.0f} "
          f"contra {yuc['normal']:,.0f}; {cuenta['menos']} de {cuenta['total']} con menos fuego")
    return portada


if __name__ == "__main__":
    exportar()
