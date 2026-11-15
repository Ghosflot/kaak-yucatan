"""Pruebas del exportador de datos de la página (pipeline/exportar_web.py)."""
import json
from datetime import date
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import exportar_web as ew  # noqa: E402


@pytest.fixture(scope="module")
def salida(tmp_path_factory):
    destino = tmp_path_factory.mktemp("datos")
    ew.exportar(destino)
    return destino


def test_identificador_sin_acentos():
    assert ew.identificador("Tizimín") == "tizimin"
    assert ew.identificador("Felipe Carrillo Puerto") == "felipe-carrillo-puerto"


def test_un_archivo_por_municipio(salida):
    lista = json.loads((salida / "municipios.json").read_text(encoding="utf-8"))
    ids = [m["id"] for m in lista]
    assert len(ids) == len(set(ids)) == 127
    archivos = {p.stem for p in (salida / "municipio").glob("*.json")}
    assert archivos == set(ids)


def test_mapa_y_lista_usan_los_mismos_ids(salida):
    lista = json.loads((salida / "municipios.json").read_text(encoding="utf-8"))
    geo = json.loads((salida / "municipios.geojson").read_text(encoding="utf-8"))
    assert {f["properties"]["id"] for f in geo["features"]} == {m["id"] for m in lista}


def test_ventana_solo_en_yucatan_y_zona_inferida(salida):
    tekax = json.loads((salida / "municipio" / "tekax.json").read_text(encoding="utf-8"))
    assert tekax["ventana"] == {"inicio": "03-10", "fin": "04-03"}
    assert tekax["zona_inferida"] is False
    baca = json.loads((salida / "municipio" / "baca.json").read_text(encoding="utf-8"))
    assert baca["zona_inferida"] is True
    # Los tres de docs/01 (Baca, Dzán y Tekit), aunque la lista de zonas escriba «Dzan» sin acento.
    inferidos = sorted(json.loads((salida / "municipio" / f"{i}.json").read_text(encoding="utf-8"))["nombre"]
                       for i in ("baca", "dzan", "tekit"))
    assert inferidos == ["Baca", "Dzán", "Tekit"]
    assert all(json.loads((salida / "municipio" / f"{i}.json").read_text(encoding="utf-8"))["zona_inferida"]
               for i in ("baca", "dzan", "tekit"))
    calakmul = json.loads((salida / "municipio" / "calakmul.json").read_text(encoding="utf-8"))
    assert calakmul["ventana"] is None


def test_ningun_archivo_pasa_de_2_mb(salida):
    """La página carga web/datos/ por partes; solo la serie para descargar puede ser grande."""
    for archivo in salida.rglob("*"):
        if archivo.is_file() and archivo.name not in ew.DESCARGAS:
            assert archivo.stat().st_size <= ew.TOPE_BYTES, archivo


def test_serie_completa_para_descargar(salida):
    """La serie armonizada se copia tal cual y cabe en Cloudflare Pages (25 MiB por archivo)."""
    copia = salida / "serie_armonizada.csv"
    assert copia.read_bytes() == ew.SERIE.read_bytes()
    assert copia.stat().st_size < 25 * 1024 * 1024
    assert _json(salida, "metodo.json")["serieMB"] == round(copia.stat().st_size / 1e6)


def test_web_datos_al_dia():
    """web/datos/ en el repo debe ser lo que genera el exportador (se regenera, no se edita)."""
    import filecmp
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        ew.exportar(Path(tmp))
        comparacion = filecmp.dircmp(tmp, ew.SALIDA)
        pendientes = [comparacion]
        while pendientes:
            c = pendientes.pop()
            assert not (c.left_only or c.right_only or c.diff_files), (
                "web/datos/ no está al día: corre python pipeline/exportar_web.py"
            )
            pendientes.extend(c.subdirs.values())


CLASES = {"muyabajo", "abajo", "normal", "arriba", "muyarriba", "poco"}


def _json(salida, nombre):
    return json.loads((salida / nombre).read_text(encoding="utf-8"))


def test_portada_cifras_de_la_serie(salida):
    p = _json(salida, "portada.json")
    assert len(p["acum26"]) == len(p["acumNormal"]) == 92
    assert p["acumNormal"][91] == p["yuc"]["normal"]
    anios = {int(a): v for a, v in p["yuc"]["anios"].items()}
    assert anios[2026] < min(v for a, v in anios.items() if a < 2026)  # la más baja desde 2001
    assert p["cuenta"]["total"] == 106
    assert set(p["clases"].values()) <= CLASES
    assert len(p["clases"]) == len(p["mun"]) == 127
    assert p["z2"]["ini"] < p["z2"]["fin"] and len(p["z2"]["dias"]) == 181


def test_portada_cada_anio_contra_lo_normal(salida):
    """El mapa de cualquier año: 2026 coincide con las clases y la cuenta de siempre, y cada año suma su total."""
    p = _json(salida, "portada.json")
    pa = p["porAnio"]
    assert pa["anios"] == list(range(2001, 2027)) and len(pa["ids"]) == len(pa["v"]) == 127
    clases26 = [ew.CLASES[int(c)] for c in pa["clases"]["2026"]]
    assert clases26 == [p["clases"][i] for i in pa["ids"]]
    assert pa["cuenta"]["2026"] == {k: p["cuenta"][k] for k in ("comparados", "menos", "mas")}
    assert all(len(pa["clases"][str(a)]) == 127 for a in pa["anios"])
    assert all(v[-1] == p["valores"][i][0] for i, v in zip(pa["ids"], pa["v"]))
    for a, total in p["yuc"]["anios"].items():
        assert len(p["yuc"]["acum"][a]) == 92 and p["yuc"]["acum"][a][-1] == total
    assert p["yuc"]["acum"]["2026"] == p["acum26"]


def test_tekax_la_mitad_y_despues_de_la_ventana(salida):
    t = _json(salida, "municipio/tekax.json")
    assert 0.4 < t["v26"] / t["normal"] < 0.6
    # Con H1 (28–30 abr 2026 contados con NOAA-20) Tekax tiene 213 contra 390: el 55 %,
    # «abajo». Antes, sin esos días, daba 191 (el 49 %, «muyabajo»).
    assert t["clase"] == "abajo"
    assert round(t["despues"] * 10) == 8
    assert len(t["diaNormal"]) == 92 and len(t["porAnio"]) == 26


def test_municipio_sin_ventana_sin_despues(salida):
    c = _json(salida, "municipio/calakmul.json")
    assert c["ventana"] is None and c["despues"] is None


def test_municipio_sin_fuego_es_poco():
    """Un municipio sin un solo cuadrito-día no divide entre cero: queda «poco»."""
    r = {"id": "x", "nombre": "X", "estado": "Yucatán", "zona": "Yucatán 2",
         "ventana": {"inicio": "04-20", "fin": "05-31"}, "zona_inferida": False}
    d = ew.datos_municipio(r, pd.Series(dtype=float, index=pd.DatetimeIndex([])))
    assert d["clase"] == "poco" and d["despues"] is None and d["normal"] == 0


def test_peso_primera_carga(salida):
    assert (salida / "portada.json").stat().st_size < 600 * 1024


def test_fechas_un_renglon_por_municipio(salida):
    f = _json(salida, "fechas.json")
    assert len(f) == 127 and all(len(m["meses"]) == len(m["meses26"]) == 12 for m in f)


def test_zonas_dia_por_dia_de_2026(salida):
    z = _json(salida, "zonas.json")
    assert [x["n"] for x in z["zonas"]] == ["1", "2", "3", "4"]
    assert sum(x["municipios"] for x in z["zonas"]) == 106
    assert [x["inferidos"] for x in z["zonas"]] == [0, 1, 2, 0]
    assert z["zonas"][1]["ventana"] == {"inicio": "04-20", "fin": "05-31"}
    # Datos hasta el 12 de noviembre: la temporada de enero a junio ya pasó completa.
    assert date.fromisoformat(z["actualizado"]) > date(2026, 6, 30) and z["ultimo"] == 180
    for x in z["zonas"]:
        assert len(x["dias"]) == 181
        assert abs(x["antes"] + x["dentro"] + x["despues"] - x["tot"]) < 0.5
    # La zona 2 es la tira de la portada: misma cifra en las dos vistas.
    p = _json(salida, "portada.json")
    z2 = z["zonas"][1]
    assert (z2["ini"], z2["fin"], z2["dias"], z2["tot"], z2["dentro"]) == (
        p["z2"]["ini"], p["z2"]["fin"], p["z2"]["dias"], p["z2"]["tot"], p["z2"]["dentro"])


def test_metodo_salto_de_2012(salida):
    """«Cómo lo medimos»: Yucatán en temporada, cada año sin calibrar y calibrado."""
    m = _json(salida, "metodo.json")
    assert [a["y"] for a in m["anios"]] == list(range(2001, 2027))
    # Lo calibrado es la misma serie que la portada.
    p = _json(salida, "portada.json")
    assert {str(a["y"]): a["armonizado"] for a in m["anios"]} == p["yuc"]["anios"]
    # Desde 2012 la temporada la ve S-NPP, sin factor: las dos coinciden. Los días sin datos
    # de S-NPP (H1) se cuentan con NOAA-20 × 1.0077, así que en 2024 y 2026 difieren un poco.
    assert all(a["armonizado"] == pytest.approx(a["crudo"], rel=0.01)
               for a in m["anios"] if a["y"] >= 2012)
    assert sum(a["crudo"] != a["armonizado"] for a in m["anios"] if a["y"] >= 2012) <= 2
    # Antes, MODIS ve menos que la escala de VIIRS.
    assert all(0 < a["crudo"] < a["armonizado"] for a in m["anios"] if a["y"] < 2012)
    # El salto, con los periodos de la prueba 1 de la validación: 2009–2011 contra 2013–2015.
    s = m["salto"]
    assert (s["antes"], s["despues"]) == ([2009, 2011], [2013, 2015])
    assert s["crudo"] > 2.5 and 0.7 < s["armonizado"] < 1.3


def test_metodo_satelites_factores_y_conafor(salida):
    m = _json(salida, "metodo.json")
    assert [p["sat"] for p in m["periodos"]] == ["Terra", "Aqua", "S-NPP", "NOAA-20"]
    assert m["periodos"][2] == {"sat": "S-NPP", "desde": "2012-01-20", "hasta": "2026-11-02"}
    assert m["periodos"][3]["hasta"] is None
    f = m["factores"]
    assert 2 < f["aqua"][0] < f["aqua"][1] < 5  # Aqua en temporada, zonas de Yucatán
    assert f["aquaTodas"] == [2.8, 5.3]  # todas las zonas y épocas: docs/01, «entre tres y cinco veces»
    assert "noaa20" not in f  # lo cuenta la prueba «viirs» de la validación
    # Las cifras de docs/01, «Validación con CONAFOR».
    c = m["conafor"]
    assert (c["incendios"], c["desde"], c["hasta"]) == (1222, 2015, 2024)
    assert (c["vistos"], c["grandes"], c["nGrandes"]) == (53, 84, 395)
    assert "azar" not in c  # sale de la validación (azarSnpp), no de una cifra fija


def test_validacion_para_la_pagina(salida):
    """«¿Se puede confiar?» lee el caso, los números y los datos de cada gráfica de la validación."""
    v = _json(salida, "validacion.json")
    original = json.loads(ew.VALIDACION.read_text(encoding="utf-8"))
    assert [p["id"] for p in v["pruebas"]] == [p["id"] for p in original["pruebas"]]
    for p, o in zip(v["pruebas"], original["pruebas"]):
        assert set(p) == {"id", "estado", "caso", "clave", "valores", "grafica"}
        assert (p["caso"], p["clave"], p["valores"]) == (o["caso"], o["clave"], o["valores"])
    g = {p["id"]: p["grafica"] for p in v["pruebas"]}
    # Las gráficas dicen lo mismo que los números de la frase.
    vals = {p["id"]: p["valores"] for p in v["pruebas"]}
    assert f"{g['salto_2012']['razonCruda']:.2f}" == vals["salto_2012"]["razonCruda"]
    assert [t["y"] for t in g["salto_2012"]["anios"]] == list(range(2009, 2016))
    assert [a["y"] for a in g["aqua_fuera_muestra"]["anios"]] == list(range(2021, 2026))
    assert round(g["conafor"]["real"]) == vals["conafor"]["realSnpp"]
    assert round(max(g["conafor"]["controlAnio"], g["conafor"]["controlLugar"])) == vals["conafor"]["azarSnpp"]
    assert round(g["conafor"]["tamanos"][-1]["pct"]) == vals["conafor"]["grandesSnpp"]
    completos = [a["razon"] for a in g["viirs"]["noaa20"] if a["completo"]]
    assert f"{min(completos):.2f}" == vals["viirs"]["razonMinNoaa20"]
    assert not (salida / "validacion").exists()  # ya no van las PNG
    # Cada caso tiene su frase en los dos idiomas.
    for idioma in ("es", "en"):
        textos = json.loads((ew.RAIZ / "web" / "textos" / f"{idioma}.json").read_text(encoding="utf-8"))
        for p in v["pruebas"]:
            assert textos.get(p["clave"]), f"{idioma}:{p['clave']}"



def test_graficas_de_la_validacion_como_sus_png(salida):
    """Las gráficas de la página tienen lo mismo que las PNG de pipeline/validar.py: los mismos
    textos (validar.ETIQUETAS) y los mismos datos (validar.tabla_grafica). Siete rótulos dicen lo
    mismo con las palabras del resto de la página («corregido», «foco de calor», «meta»): las PNG
    van selladas con la validación y conservan las suyas."""
    import validar

    de_la_pagina = {
        "es": {"sin_calibrar": "Sin corregir", "calibrada": "Corregida",
               "focos_sin_calibrar": "Focos de calor al año, sin corregir",
               "focos_calibrada": "Focos de calor al año, ya corregidos",
               "umbral": "meta", "rango_natural": "variación normal", "focos_anio": "Focos de calor al año"},
        "en": {"sin_calibrar": "Uncorrected", "calibrada": "Corrected",
               "focos_sin_calibrar": "Hot spots per year, uncorrected",
               "focos_calibrada": "Hot spots per year, corrected",
               "umbral": "target", "rango_natural": "normal variation", "focos_anio": "Hot spots per year"},
    }
    for idioma in ("es", "en"):
        textos = json.loads((ew.RAIZ / "web" / "textos" / f"{idioma}.json").read_text(encoding="utf-8"))
        for k, texto in validar.ETIQUETAS[idioma].items():
            assert textos["mGv" + validar._camel(k)] == de_la_pagina[idioma].get(k, texto), (idioma, k)
    original = {p["id"]: p for p in json.loads(ew.VALIDACION.read_text(encoding="utf-8"))["pruebas"]}
    g = {p["id"]: p["grafica"] for p in _json(salida, "validacion.json")["pruebas"]}
    t = {i: validar.tabla_grafica(p) for i, p in original.items()}
    s = g["salto_2012"]
    assert round(s["promAntes"]["crudo"]) == round(t["salto_2012"]["promedio_antes"]["crudo"]) == 8680
    assert round(s["promAntes"]["cal"]) == 31295 and round(s["promDespues"]["cal"]) == 28281
    assert [a["y"] for a in s["anios"] if a["transicion"]] == [2012]
    assert (s["umbral"], s["pasa"]) == ([0.67, 1.5], True)
    a = g["aqua_fuera_muestra"]
    assert (round(a["error"]["zonaEpoca"]), round(a["error"]["unico"]), a["limite"], a["elegido"]) == (11, 13, 25, "zonaEpoca")
    c = g["conafor"]
    assert [x["t"] for x in c["tamanos"]] == ["0–5", "6–10", "11–20", "21–50", "51–100", "> 100"]
    assert [x["n"] for x in c["tamanos"]] == [275, 126, 124, 167, 134, 395]
    assert [x["grande"] for x in c["tamanos"]] == [False] * 5 + [True]
    assert (round(c["metaAzar"]), c["sinRango"], c["minimo"]) == (26, 1, 75)
    vi = g["viirs"]
    assert vi["eje"] == [0.8, 1.2] and vi["banda"] == [0.9, 1.1]
    assert all(p["cruda"] is not None for p in vi["noaa20"])
    assert vi["cumple"] == {"noaa20": True, "noaa21": True}


def test_ganaderia_para_el_mapa(salida):
    """El territorio ganadero (#60): los 106 municipios de Yucatán con los mismos ids del mapa."""
    g = _json(salida, "ganaderia.json")
    lista = _json(salida, "municipios.json")
    yucatan = {m["id"] for m in lista if m["estado"] == "Yucatán"}
    assert {m["id"] for m in g["municipios"]} == yucatan
    assert g["periodo"] == [2013, 2025]
    y = g["yucatan"]
    assert (y["bovinos"], y["bovinosUp"]) == (388_399, 381_535)  # Censo Agropecuario 2022
    assert y["bovinos"] == sum(m["bovinos"] for m in g["municipios"])
    assert y["focosPastizal"] == sum(m["focosPastizal"] for m in g["municipios"])
    # Las cifras de docs/01, «Ganadería».
    assert (y["pctPastizal"], y["pctFocosPastizal"]) == (17.2, 29.2)
    tizimin = next(m for m in g["municipios"] if m["id"] == "tizimin")
    assert (tizimin["bovinos"], tizimin["focos"]) == (139_472, 16_177)
    assert all(m["focosPastizal"] <= m["focos"] and 0 <= m["pctPastizal"] <= 100 for m in g["municipios"])
    # Las clases del mapa: de 0 a 4, según los cortes que trae el mismo archivo.
    assert g["cortes"] == {"pastizal": [5, 15, 30, 50], "bovinos": [2, 5, 10, 25], "focos": [5, 15, 30, 50]}
    assert tizimin["clases"] == {"pastizal": 3, "bovinos": 4, "focos": 4}  # 44 %, 36 por km², 58 %
    merida = next(m for m in g["municipios"] if m["id"] == "merida")
    assert merida["clases"] == {"pastizal": 0, "bovinos": 1, "focos": 0}  # 0.9 %, 4 por km², 2 %
    assert {c for m in g["municipios"] for c in m["clases"].values()} == {0, 1, 2, 3, 4}


def test_satelites_contra_la_serie(salida):
    """El selector (#32): cada satélite solo, contado como la serie de la página."""
    sats = {x["sat"]: x for x in _json(salida, "satelites.json")["satelites"]}
    assert list(sats) == ["Terra", "Aqua", "S-NPP", "NOAA-20"]
    serie = {a["y"]: a["armonizado"] for a in _json(salida, "metodo.json")["anios"]}
    # En los años en que la serie usa un satélite (sin días de respaldo), coinciden.
    for s, anios in (("Terra", [2001, 2002]), ("S-NPP", [2013, 2015, 2020])):
        cal = {a["y"]: a["cal"] for a in sats[s]["anios"]}
        for y in anios:
            assert cal[y] == pytest.approx(serie[y], rel=0.01), (s, y)
    assert sats["Terra"]["serie"] == [2001, 2002]
    assert sats["Aqua"]["serie"] == list(range(2003, 2012))
    assert sats["NOAA-20"]["serie"] == []
    assert sats["S-NPP"]["calibracion"] is None
    assert sats["Aqua"]["calibracion"] == [2013, 2020]
    assert sats["Terra"]["calibracion"] == [2013, 2020]
    assert sats["NOAA-20"]["calibracion"] == [2018, 2026]  # armonizar.PERIODO_NOAA20
    # S-NPP es la escala: calibrado y sin calibrar son lo mismo.
    assert all(a["cal"] == a["crudo"] for a in sats["S-NPP"]["anios"])
    # MODIS sin calibrar ve menos de la mitad que la serie; NOAA-20 en 2018 empieza en abril.
    assert all(a["crudo"] < 0.5 * serie[a["y"]] for a in sats["Aqua"]["anios"])
    assert sats["NOAA-20"]["incompletos"] == [2018]


# ---------------------------------------------------------------------------
# Contrato de datos de la dirección visual (docs/superpowers/specs/2026-11-15-direccion-visual-design.md)


def test_estados_son_la_union_de_sus_municipios():
    """Sin huecos ni astillas, y con sus islas: cada parte de un municipio de 1 km² o más
    (Cozumel, Isla Mujeres, Holbox…) queda dentro del contorno de su estado. Los arrecifes de mar
    adentro no se dibujan (ver la prueba de los arrecifes)."""
    mun = ew.tabla_municipios()
    geo = ew.formas(mun)
    for estado in ew.ORDEN_ESTADOS:
        de_estado = [g for e, g in geo.values() if e == estado]
        c = ew.contorno_estado(de_estado)
        partes = ew._partes(c)
        assert all(len(p.interiors) == 0 for p in partes)
        assert all(ew.km2(p) >= ew.ASTILLA_KM2 for p in partes)
        holgura = c.buffer(ew.CIERRE)
        for g in de_estado:
            for p in ew._partes(ew.sin_arrecifes(g)):
                if ew.km2(p) >= 1:
                    assert holgura.contains(p.representative_point()), (estado, p.representative_point())
    # Cozumel (Quintana Roo) es una parte aparte.
    from shapely.geometry import Point
    qroo = ew.contorno_estado([g for e, g in geo.values() if e == "Quintana Roo"])
    assert any(p.contains(Point(-86.93, 20.42)) and ew.km2(p) > 400 for p in ew._partes(qroo))


def test_portada_estados_reciente_satdia_datohasta(salida):
    p = _json(salida, "portada.json")
    assert [e["n"] for e in p["estados"]] == ["Quintana Roo", "Campeche", "Yucatán"]
    assert all(e["d"].startswith("M") for e in p["estados"])
    r = p["reciente"]
    assert r["dias"] == 7 and r["hasta"] == p["actualizado"]
    assert (date.fromisoformat(r["hasta"]) - date.fromisoformat(r["desde"])).days == 6
    assert 0 <= r["yuc"] <= r["peninsula"]
    # El 30 de abril de 2026 (día 60) S-NPP no mandó datos: lo cuenta NOAA-20.
    assert p["satDia"]["base"] == "S-NPP" and p["satDia"]["otros"]["60"] == "NOAA-20"
    assert all(0 <= int(d) <= 91 for d in p["satDia"]["otros"])
    assert set(p["datoHasta"]) == {"S-NPP", "NOAA-20", "MODIS"}
    assert p["datoHasta"]["S-NPP"] == "2026-11-02"
    lo, hi = p["yuc"]["rango"]
    anios = [v for a, v in p["yuc"]["anios"].items() if int(a) < 2026]
    assert lo < p["yuc"]["normal"] < hi
    assert sum(lo <= v <= hi for v in anios) == 13  # la mitad central de los 25 años


def test_municipio_rango_focos26_repetidos_caja(salida):
    t = _json(salida, "municipio/tekax.json")
    lo, hi = t["rango"]
    assert lo <= t["normal"] <= hi
    # focos26: un renglón por cuadrito-día de 2026, todo el año; los de marzo a mayo suman v26
    # (S-NPP vale 1; los días de NOAA-20 llevan su factor, por eso «aprox»).
    assert all(len(f) == 4 and f[3] in ("S-NPP", "NOAA-20") for f in t["focos26"])
    temporada = [f for f in t["focos26"] if "03-01" <= f[2] <= "05-31"]
    assert len(temporada) == pytest.approx(t["v26"], rel=0.01)
    assert any(f[2] > "06-01" for f in t["focos26"]) and any(f[2] < "03-01" for f in t["focos26"])
    lon0, lat0, lon1, lat1 = t["caja"]
    assert all(lon0 - 0.01 <= f[0] <= lon1 + 0.01 and lat0 - 0.01 <= f[1] <= lat1 + 0.01 for f in t["focos26"])
    assert t["repetidos"] and all(5 <= n <= 14 for _, _, n in t["repetidos"])
    assert [n for *_, n in t["repetidos"]] == sorted((n for *_, n in t["repetidos"]), reverse=True)


def test_ni_repetidos_ni_focos_nrt_en_cuadritos_de_fuente_fija(salida):
    """La fuga de NRT: de agosto a noviembre de 2026 (los datos NRT, sin `type`) Mérida ya no
    tiene focos en los cuadritos con historial de `type` 2, y esos cuadritos tampoco cuentan
    como «repetidos». Antes de agosto los datos son definitivos (SP) y traen su `type`: los
    pocos que FIRMS marcó como vegetación (`type` 0) en esos cuadritos se quedan."""
    fijas = {(round(a, 2), round(o, 2)) for a, o in ew.celdas_fuente_fija(ew.cargar_crudos()).itertuples(index=False)}
    m = _json(salida, "municipio/merida.json")
    assert not [f for f in m["focos26"] if f[2] >= "08-01" and (f[1], f[0]) in fijas]
    for i in ("merida", "campeche", "carmen"):
        assert not [r for r in _json(salida, f"municipio/{i}.json")["repetidos"] if (r[1], r[0]) in fijas]


def test_hechos_de_municipios_conocidos(salida):
    h = {i: _json(salida, f"municipio/{i}.json")["hechos"] for i in ("muna", "tizimin", "merida", "calakmul", "baca")}
    # Muna: la mitad de su fuego llega el 20 de abril; 2026, su temporada con menos fuego desde 2012.
    assert h["muna"]["mitad"] == "04-20"
    assert (h["muna"]["puesto26"], h["muna"]["temporadas"]) == (1, 15)
    # Tizimín es el de más fuego de Yucatán; su zona (la 4) empieza el 1 de abril.
    assert (h["tizimin"]["lugar"], h["tizimin"]["de"]) == (1, 106)
    assert h["tizimin"]["empiezaZona"] == "04-01"
    assert h["merida"]["empieza"] == "02-22"
    assert h["calakmul"]["de"] == 11
    # Baca tiene menos de 5 focos en un año normal: no se dice nada.
    assert h["baca"] == {}
    for i in ("muna", "tizimin", "merida", "calakmul"):
        assert len(h[i]["semanaPico"]) == 2 and h[i]["semanaPico"][0] < h[i]["semanaPico"][1]
        assert h[i].get("racha", 3) >= 3


def test_zonas_cada_anio_lo_tipico_y_el_lugar(salida):
    z = {x["n"]: x for x in _json(salida, "zonas.json")["zonas"]}
    for x in z.values():
        assert list(x["porAnio"]) == [str(a) for a in range(2001, 2027)]
        assert all(abs(sum(v) - 1) < 0.002 for v in x["porAnio"].values() if v)
        assert len(x["tipico"]) == 3 and 0 < x["minFuera"] < 1
        assert x["minFuera"] == min(round(1 - v[1], 3) for v in x["porAnio"].values() if v)
    assert [z[n]["lugar"] for n in "1234"] == ["el sur y oriente", "el centro y norte", "el sur", "el norte y oriente"]
    assert z["4"]["lugarEn"] == "the north and east"
    # Zona 4: en un año típico, 9 de cada 10 focos aparecen después de que cierran las fechas;
    # ningún año baja de 6 de cada 10 fuera de ellas.
    assert round(z["4"]["tipico"][2] * 10) == 9 and z["4"]["minFuera"] > 0.6
    # La de 2026 es la misma cifra que el calendario de la zona.
    x = z["2"]
    assert x["porAnio"]["2026"][1] == pytest.approx(x["dentro"] / x["tot"], abs=0.001)


def test_metodo_paso_dias_sin_datos_fuente_fija_y_conafor(salida):
    m = _json(salida, "metodo.json")
    paso = m["paso"]
    assert set(paso) == {"Terra", "Aqua", "S-NPP"}
    # Terra pasaba hacia las 10:45; con la deriva de su órbita, en 2026 pasa antes de las 9:30.
    assert "10:30" <= paso["Terra"]["2001"].zfill(5) <= "11:00" and paso["Terra"]["2026"].zfill(5) < "09:30"
    assert paso["Aqua"]["2026"] > "14:00" and "13:00" <= paso["S-NPP"]["2020"] <= "13:30"
    assert m["sinDatos"] == {"dias": 47, "rellenados": 12}
    f = m["fuenteFija"]
    assert f["municipio"] == "Mérida" and f["fijas"] == 7494 and f["detecciones"] >= 12870
    assert [d["dias"] for d in m["conafor"]["porDuracion"]] == ["1", "2–3", "4–7", ">7"]
    assert [d["vistos"] for d in m["conafor"]["porDuracion"]] == [16, 39, 66, 85]
    assert sum(d["n"] for d in m["conafor"]["porDuracion"]) == m["conafor"]["incendios"]
    assert m["nocturnos"] == pytest.approx(0.056, abs=0.005)


def test_metodo_salto_sale_de_la_validacion(salida):
    """Una sola fuente: el salto de Yucatán de «Cómo lo medimos» es el de validacion.json."""
    s = _json(salida, "metodo.json")["salto"]
    v = next(p for p in _json(salida, "validacion.json")["pruebas"] if p["id"] == "salto_2012")["valores"]
    assert (f"{s['crudo']:.2f}", f"{s['armonizado']:.2f}") == (v["razonCrudaYucatan"], v["razonArmonizadaYucatan"])
    assert (s["antes"], s["despues"]) == ([v["antesDesde"], v["antesHasta"]], [v["despuesDesde"], v["despuesHasta"]])


def test_el_mapa_no_dibuja_arrecifes_de_mar_adentro():
    """Alacranes (Progreso), Triángulos (Celestún) y Cayo Arcas (Campeche) quedan fuera del mapa;
    las islas cercanas (Cozumel, Isla Mujeres, Banco Chinchorro) se quedan."""
    geo = ew.formas(ew.tabla_municipios())
    for i in ("progreso", "celestun", "campeche"):
        completo, recortado = geo[i][1], ew.sin_arrecifes(geo[i][1])
        assert len(ew._partes(recortado)) < len(ew._partes(completo))
        principal = max(ew._partes(completo), key=lambda p: p.area)
        assert all(p.distance(principal) <= ew.ARRECIFE_GRADOS for p in ew._partes(recortado))
    for i in ("cozumel", "isla-mujeres", "othon-p-blanco"):
        assert len(ew._partes(ew.sin_arrecifes(geo[i][1]))) == len(ew._partes(geo[i][1]))
