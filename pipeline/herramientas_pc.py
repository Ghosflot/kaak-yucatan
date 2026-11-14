"""Datos de la vista «Protección Civil» (#/proteccion): dónde y cuándo se quema cada municipio.

Exploración de la rama explorar-usos. Sigue el método de la tarea 6 de docs/02 («Dónde y
cuándo se quema año tras año»): por cuadrito de 1 km, en cuántas temporadas de 2012 a 2025
tuvo fuego, solo con S-NPP (MODIS no ve los fuegos chicos, así que un año MODIS sin fuego
puede ser un fuego que no vio).

Uso: lo llama pipeline/exportar_web.py al final (así se regenera con la actualización diaria);
también se puede correr solo: python pipeline/herramientas_pc.py

Escribe:
- web/datos/pc/indice.json: la lista de municipios de Yucatán, el semáforo semanal y el resumen
  de los focos recientes. La vista lo carga al abrir.
- web/datos/pc/<id>.json: un archivo por municipio de Yucatán, que la vista carga al elegirlo,
  así el detalle por cuadrito no pesa en la página (docs/02 lo dejaba fuera por eso).

Por cuadrito: temporadas con fuego, días con fuego, temporadas con fuego después del cierre de
la ventana de su zona, incendios de CONAFOR a menos de 1 km y el municipio vecino si el límite
lo parte. Además, las fuentes de calor fijas que FIRMS marca en el archivo (type 2) y los focos
recientes que caen sobre ellas: cargar.py quita las fijas del archivo, pero los focos recientes
llegan sin esa marca.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

import datos_web as dw
from cargar import cargar_focos
from rejilla import cuadritos_dia

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "web" / "datos"
TEMPORADAS = (2012, 2025)  # docs/02, tarea 6
SEMAFORO_ANIOS = (2024, 2025, 2026)
SEMANAS = (9, 22)  # de marzo a mayo
RADIO_CONAFOR_KM = 1.0
MIN_FOCOS_FIJO = 20
KM_LAT, KM_LON = 111.0, 104.0  # km por grado cerca de 20.5° N


def fuentes_fijas() -> pd.DataFrame:
    """Cuadritos con MIN_FOCOS_FIJO o más focos que FIRMS marcó como «otra fuente fija» (type 2)."""
    crudo = pd.read_parquet(RAIZ / "datos_peninsula" / "focos_peninsula.parquet",
                            columns=["type", "latitude", "longitude", "estado", "municipio"])
    st = crudo[crudo["type"] == 2]
    st = (st.assign(lat=st.latitude.round(2), lon=st.longitude.round(2))
            .groupby(["lat", "lon", "estado", "municipio"]).size().rename("n").reset_index())
    return st[st.n >= MIN_FOCOS_FIJO]


def recientes(fijas: pd.DataFrame) -> pd.DataFrame:
    rec = pd.read_parquet(RAIZ / "datos_peninsula" / "focos_recientes.parquet")
    claves = set(zip(fijas.lat, fijas.lon))
    return rec.assign(fijo=[(round(a, 2), round(b, 2)) in claves for a, b in zip(rec.latitude, rec.longitude)])


def xy(lon: float, lat: float) -> list[float]:
    x, y = dw.proyectar(lon, lat)
    return [round(float(x), 2), round(float(y), 2)]


def semaforo() -> dict:
    """Por semana, cada municipio de Yucatán contra los percentiles 10 y 90 de su acumulado."""
    serie = pd.read_csv(RAIZ / "salidas" / "serie_armonizada.csv", encoding="utf-8-sig", low_memory=False)
    s = serie[(serie.estado == "Yucatán") & serie.anio.isin(SEMAFORO_ANIOS) & serie.semana.between(*SEMANAS)]
    salida: dict = {}
    for (anio, semana), g in s.groupby(["anio", "semana"]):
        salida.setdefault(str(int(anio)), {})[str(int(semana))] = [
            [r.municipio, "arriba" if r.acum > r.acum_p90 else "abajo" if r.acum < r.acum_p10 else "normal",
             round(float(r.acum), 1), round(float(r.acum_p90), 1)]
            for r in g.itertuples()]
    return salida


def exportar(datos: Path = DATOS) -> None:
    """Escribe datos/pc/ a partir de lo que exportar_web.py ya dejó en `datos`."""
    salida = datos / "pc"
    lista = json.loads((datos / "municipios.json").read_text(encoding="utf-8"))
    yuc = [m for m in lista if m["estado"] == "Yucatán"]

    c = cuadritos_dia(cargar_focos())
    c = c[c.estado == "Yucatán"]
    clave = ["lat_celda", "lon_celda"]
    vecinos = c.groupby(clave).municipio.unique()
    s = c[(c.satelite == "S-NPP") & c.anio.between(*TEMPORADAS) & c.mes.between(3, 5)]

    fijas = fuentes_fijas()
    rec = recientes(fijas)
    con = pd.read_csv(RAIZ / "datos_peninsula" / "incendios_conafor_2015_2024.csv").dropna(subset=["latitud", "longitud"])
    arbol = cKDTree(np.c_[con.latitud * KM_LAT, con.longitud * KM_LON])

    salida.mkdir(parents=True, exist_ok=True)
    resumen = []
    for m in yuc:
        nombre = m["nombre"]
        mj = json.loads((datos / "municipio" / f"{m['id']}.json").read_text(encoding="utf-8"))
        mes_fin, dia_fin = map(int, m["ventana"]["fin"].split("-"))
        incendios: dict[int, dict] = {}
        puntos = []
        for (la, lo), g in s[s.municipio == nombre].groupby(clave):
            cerca = arbol.query_ball_point([la * KM_LAT, lo * KM_LON], r=RADIO_CONAFOR_KM)
            for i in cerca:
                r = con.iloc[i]
                incendios[int(i)] = {"a": int(r.anio), "f": str(r.Fecha_Inicio), "ha": round(float(r.Total_hectareas), 1),
                                     "v": str(r.Tipo_Vegetacion)}
            otro = [v for v in vecinos.get((la, lo), []) if v != nombre]
            puntos.append({
                "p": xy(lo, la), "la": round(float(la), 2), "lo": round(float(lo), 2),
                "a": sorted(int(x) for x in g.anio.unique()),
                "d": int(g.dia_local.nunique()),
                "ds": sorted({int(r.anio) for r in g.itertuples()
                              if (r.dia_local.month, r.dia_local.day) > (mes_fin, dia_fin)}),
                "c": sorted(int(i) for i in cerca),
                "v": otro[0] if otro else None,
            })
        puntos.sort(key=lambda p: (-len(p["a"]), -p["d"]))
        fij = fijas[fijas.municipio == nombre]
        rm = rec[rec.municipio == nombre]
        archivo = {
            "id": m["id"], "nombre": nombre, "zona": m["zona"], "ventana": m["ventana"],
            "zonaInferida": m["zona_inferida"], "normal": mj["normal"], "diaNormal": mj["diaNormal"],
            "despuesNormal": mj["despues"], "temporadas": list(TEMPORADAS),
            "puntos": puntos, "incendios": {str(k): v for k, v in incendios.items()},
            "fijos": [{"p": xy(r.lon, r.lat), "n": int(r.n)} for r in fij.itertuples()],
            "recientes": [{"p": xy(r.longitude, r.latitude), "f": str(r.acq_date)[:10], "h": int(r.acq_time),
                           "s": r.sensor, "fijo": bool(r.fijo)} for r in rm.itertuples()],
        }
        (salida / f"{m['id']}.json").write_text(json.dumps(archivo, ensure_ascii=False, separators=(",", ":")),
                                               encoding="utf-8")
        resumen.append({"id": m["id"], "n": nombre, "e": "Yucatán",
                        "rec7": sum(len(p["a"]) >= 7 for p in puntos)})

    act = json.loads((RAIZ / "salidas" / "actualizacion.json").read_text(encoding="utf-8"))
    indice = {
        "datosHasta": act["datos_hasta"],
        "temporadas": list(TEMPORADAS), "municipios": resumen, "semaforo": semaforo(),
        "recientes": {"total": int(len(rec)), "fijos": int(rec.fijo.sum()),
                      "porMunicipio": rec[rec.fijo].municipio.value_counts().to_dict()},
    }
    (salida / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(f.stat().st_size for f in salida.glob("*.json"))
    print(f"pc: {len(resumen)} municipios de Yucatán ({total / 1e6:.1f} MB)")


if __name__ == "__main__":
    exportar()
