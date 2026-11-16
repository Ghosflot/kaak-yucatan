"""Toma una foto (PNG 1920×1080) de cada diapositiva del deck de K'áak'.

Uso:
    python3 render.py <carpeta-del-deck> <carpeta-de-assets> <carpeta-de-salida>

<carpeta-del-deck> es la que contiene project/deck.json, project/deck.css y
project/slides/*.html. <carpeta-de-assets> tiene las fotos y videos que las
diapositivas citan como /_blob/<id>, guardados como <id>.<extensión>.
Ver README.md para cómo bajar las dos carpetas del artifact.
"""

import json
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(sys.argv[1])
BLOBS = pathlib.Path(sys.argv[2])
OUT = pathlib.Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)

deck = json.loads((ROOT / "project/deck.json").read_text())
css = (ROOT / "project/deck.css").read_text()
fonts = "".join(
    f'<link rel="stylesheet" href="{f["href"]}">' for f in deck["faces"].values() if "href" in f
)
# Reglas base del lienzo de Slides: 1920×1080, notas del orador ocultas.
base = """
* { margin: 0 }
body { font: 32px/1.2 sans-serif; background: #000 }
body > section { width: 1920px !important; height: 1080px !important; overflow: hidden !important;
  box-sizing: border-box !important; position: relative; isolation: isolate }
section[hidden], aside, noscript { display: none !important }
h1 { font-size: 96px; font-weight: 600 } h2 { font-size: 64px; font-weight: 600 }
h3 { font-size: 44px; font-weight: 600 }
p, li, h1, h2, h3, td, th { overflow-wrap: break-word; text-wrap: pretty }
x-shape, x-icon, x-embed { display: block }
x-shape[kind=ellipse] { border-radius: 50% }
"""
slides = "".join((ROOT / f"project/slides/{i}.html").read_text() for i in deck["order"])
blobmap = {p.stem: p for p in BLOBS.iterdir()}
slides = re.sub(r"/_blob/([0-9a-f]{32})", lambda m: f"/blob/{blobmap[m.group(1)].name}", slides)
html = (
    f"<!doctype html><html><head><meta charset=utf-8>{fonts}<style>{base}</style>"
    f"<style>{css}</style></head><body>{slides}</body></html>"
)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, java_script_enabled=False)
    page = ctx.new_page()

    def route(r):
        u = r.request.url
        if u == "http://deck.local/":
            return r.fulfill(body=html, content_type="text/html")
        if u.startswith("http://deck.local/blob/"):
            return r.fulfill(path=str(BLOBS / u.rsplit("/", 1)[1]))
        if "fonts.googleapis.com" in u or "fonts.gstatic.com" in u:
            return r.continue_()
        return r.abort("aborted")

    page.route("**/*", route)
    page.goto("http://deck.local/", wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    # Como en Slides: lo fijado (position:absolute) antes del primer bloque va al fondo.
    page.evaluate("""() => { for (const s of document.querySelectorAll('body > section')) {
      for (const c of s.children) { const cs = getComputedStyle(c);
        if (cs.position !== 'absolute' && cs.display !== 'none') break;
        if (cs.position === 'absolute') c.style.zIndex = '-1'; } } }""")
    for i, sid in enumerate(deck["order"], 1):
        el = page.locator(f"section#{sid}")
        el.scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        el.screenshot(path=str(OUT / f"{i:02d}-{sid}.png"))
    browser.close()
print(f"{len(deck['order'])} diapositivas en {OUT}")
