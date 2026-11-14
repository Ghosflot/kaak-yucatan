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
    assert [t["y"] for t in g["salto_2012"]["totales"]] == list(range(2009, 2016))
    assert [a["y"] for a in g["aqua_fuera_muestra"]["anios"]] == list(range(2021, 2026))
    assert g["conafor"]["real"] == vals["conafor"]["realSnpp"] and g["conafor"]["azar"] == vals["conafor"]["azarSnpp"]
    assert g["conafor"]["tamanos"][-1]["pct"] == vals["conafor"]["grandesSnpp"]
    completos = [a["razon"] for a in g["viirs"]["noaa20"] if a["completo"]]
    assert f"{min(completos):.2f}" == vals["viirs"]["razonMinNoaa20"]
    assert not (salida / "validacion").exists()  # ya no van las PNG
    # Cada caso tiene su frase en los dos idiomas.
    for idioma in ("es", "en"):
        textos = json.loads((ew.RAIZ / "web" / "textos" / f"{idioma}.json").read_text(encoding="utf-8"))
        for p in v["pruebas"]:
            assert textos.get(p["clave"]), f"{idioma}:{p['clave']}"


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
    # S-NPP es la escala: calibrado y sin calibrar son lo mismo.
    assert all(a["cal"] == a["crudo"] for a in sats["S-NPP"]["anios"])
    # MODIS sin calibrar ve menos de la mitad que la serie; NOAA-20 en 2018 empieza en abril.
    assert all(a["crudo"] < 0.5 * serie[a["y"]] for a in sats["Aqua"]["anios"])
    assert sats["NOAA-20"]["incompletos"] == [2018]
