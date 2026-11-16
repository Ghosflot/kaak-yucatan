"""Las tarjetas de la vista previa (web/og/, de pipeline/tarjetas.mjs) cubren a todos los municipios."""
import json
import math
import re
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"


def _ids():
    return [m["id"] for m in json.loads((WEB / "datos" / "municipios.json").read_text(encoding="utf-8"))]


def test_cada_municipio_tiene_tarjeta_y_textos():
    textos = json.loads((WEB / "og" / "textos.json").read_text(encoding="utf-8"))
    for i in _ids():
        assert (WEB / "og" / f"{i}.png").is_file(), i
        t = textos["municipios"][i]
        assert t["titulo"] and t["descripcion"], i
    assert set(textos["municipios"]) == set(_ids())
    assert textos["inicio"]["titulo"]


def test_las_tarjetas_miden_1200_por_630():
    for archivo in [WEB / "og" / "tekax.png"]:
        b = archivo.read_bytes()
        assert b[:8] == b"\x89PNG\r\n\x1a\n"
        assert int.from_bytes(b[16:20], "big") == 1200 and int.from_bytes(b[20:24], "big") == 630
    assert (WEB / "og" / "inicio.jpg").stat().st_size < 300_000  # WhatsApp no muestra imágenes pesadas


def test_las_cifras_de_la_tarjeta_son_las_del_municipio():
    textos = json.loads((WEB / "og" / "textos.json").read_text(encoding="utf-8"))
    for i in _ids():
        m = json.loads((WEB / "datos" / "municipio" / f"{i}.json").read_text(encoding="utf-8"))
        cifras = re.findall(r"[\d,]+", textos["municipios"][i]["descripcion"])
        # Como Math.round de la página: .5 sube (round() de Python lo lleva al par: 506.5 → 506).
        assert f"{math.floor(m['v26'] + 0.5):,}" == cifras[0], i


def test_index_trae_la_tarjeta_general():
    html = (WEB / "index.html").read_text(encoding="utf-8")
    for prop in ["og:title", "og:description", "og:image", "og:url", "og:image:alt"]:
        assert f'property="{prop}"' in html
    assert 'name="twitter:card" content="summary_large_image"' in html


# En inglés (web/og/en/, para ?lang=en): las mismas tarjetas, con las mismas cifras.
def test_en_ingles_cada_municipio_tiene_tarjeta_y_textos():
    textos = json.loads((WEB / "og" / "en" / "textos.json").read_text(encoding="utf-8"))
    for i in _ids():
        assert (WEB / "og" / "en" / f"{i}.png").is_file(), i
        t = textos["municipios"][i]
        assert t["titulo"] and t["descripcion"], i
    assert set(textos["municipios"]) == set(_ids())
    assert textos["inicio"]["titulo"] and textos["inicio"]["descripcion"]


def test_en_ingles_las_tarjetas_miden_1200_por_630():
    b = (WEB / "og" / "en" / "tekax.png").read_bytes()
    assert b[:8] == b"\x89PNG\r\n\x1a\n"
    assert int.from_bytes(b[16:20], "big") == 1200 and int.from_bytes(b[20:24], "big") == 630
    assert (WEB / "og" / "en" / "inicio.jpg").stat().st_size < 300_000


def test_en_ingles_las_cifras_son_las_del_municipio():
    textos = json.loads((WEB / "og" / "en" / "textos.json").read_text(encoding="utf-8"))
    for i in _ids():
        m = json.loads((WEB / "datos" / "municipio" / f"{i}.json").read_text(encoding="utf-8"))
        cifras = re.findall(r"[\d,]+", textos["municipios"][i]["descripcion"])
        assert f"{math.floor(m['v26'] + 0.5):,}" == cifras[0], i


def test_los_textos_en_ingles_no_estan_en_espanol():
    textos = json.loads((WEB / "og" / "en" / "textos.json").read_text(encoding="utf-8"))
    for i, t in textos["municipios"].items():
        assert "hot spot" in t["descripcion"], i
        assert "focos de calor" not in t["descripcion"] and "foco de calor" not in t["descripcion"], i
        assert "año normal" not in t["titulo"] + t["descripcion"], i
    assert "hot spots" in textos["inicio"]["descripcion"]
    assert "¿" not in textos["inicio"]["titulo"] and "municipality" in textos["inicio"]["titulo"]
