"""Foto de fondo de la portada: mosaico sin nubes de la península con vistas VIIRS de NASA GIBS.

Uso: python pipeline/mosaico.py [--fondo] [--teselas data/gibs] [--salida web/img/mosaico.jpg]

Baja las teselas de nivel 8 (~250 m) de tres satélites VIIRS en 26 fechas de la temporada seca
de 2026 (del 10 de febrero al 25 de abril, cada 3 días): 78 vistas. Por pixel toma el percentil
30 del brillo entre las vistas sin nubes, así quedan fuera las nubes (claras) y sus sombras
(oscuras). Después ajusta el tono y lo lleva a las unidades del lienzo de la página (825 × 681,
con la longitud comprimida por el coseno de 19.8°), al doble y medio de tamaño.

La foto cubre más que el lienzo: lleva un margen de mar y de tierra vecina a cada lado (FOTO, en
unidades del lienzo) para que llene pantallas de cualquier proporción y se pueda arrastrar el mapa.
Mide 1376 × 800 unidades: 3440 × 2000 pixeles.

Con --fondo arma la foto amplia que va detrás (FONDO): del centro de Veracruz al occidente de Cuba y
de Honduras al sur de Florida, con teselas de nivel 7 (~500 m), a 0.8 pixeles por unidad. Con ella la
portada abre con la península entera y el mar y la tierra que la rodean.
"""
from __future__ import annotations

import argparse
import io
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

RAIZ = Path(__file__).resolve().parent.parent
LIENZO = (-92.55, -86.7044, 17.81, 22.35)  # lon0, lon1, lat0, lat1 del lienzo de la página (825 × 681)
U_LON, U_LAT = 825 / (LIENZO[1] - LIENZO[0]), 681 / (LIENZO[3] - LIENZO[2])  # unidades del lienzo por grado
# Lo que cubre la foto, en unidades del lienzo (x de 0 a 825, y de -90 a 591): x0, y0, x1, y1.
# web/js/vistas/portada.js usa estos mismos números para colocarla.
FOTO = (-400, -150, 976, 650)
FONDO = (-800, -500, 1500, 1100)
CAPAS = {
    "N20": "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    "SNPP": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    "N21": "VIIRS_NOAA21_CorrectedReflectance_TrueColor",
}
FECHAS = [date(2026, 2, 10) + timedelta(days=3 * i) for i in range(26)]  # 10 feb a 25 abr
PERCENTIL = 30


class Region:
    """Un recuadro del lienzo y las teselas de GIBS que lo cubren."""

    def __init__(self, foto: tuple[int, int, int, int], nivel: int, escala: float):
        self.nivel = nivel
        self.lon0, self.lon1 = LIENZO[0] + foto[0] / U_LON, LIENZO[0] + foto[2] / U_LON
        self.lat1, self.lat0 = LIENZO[3] - (foto[1] + 90) / U_LAT, LIENZO[3] - (foto[3] + 90) / U_LAT
        grados = 288 / 2 ** nivel  # grados por tesela
        self.px = grados / 512
        self.c0, self.c1 = math.floor((self.lon0 + 180) / grados), math.floor((self.lon1 + 180) / grados)
        self.r0, self.r1 = math.floor((90 - self.lat1) / grados), math.floor((90 - self.lat0) / grados)
        self.tamano = (round((foto[2] - foto[0]) * escala), round((foto[3] - foto[1]) * escala))

    def teselas(self) -> list[tuple[int, int]]:
        return [(r, c) for r in range(self.r0, self.r1 + 1) for c in range(self.c0, self.c1 + 1)]


def bajar(carpeta: Path, nivel: int, sat: str, d: date, r: int, c: int) -> None:
    f = carpeta / f"{sat}-{d}-{nivel}-{r}-{c}.jpg"
    if f.exists() and f.stat().st_size > 1000:
        return
    url = f"https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{CAPAS[sat]}/default/{d}/250m/{nivel}/{r}/{c}.jpg"
    req = urllib.request.Request(url, headers={"User-Agent": "kaak/1.0"})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                f.write_bytes(resp.read())
            return
        except OSError:
            continue


def vistas(carpeta: Path, g: Region) -> list[np.ndarray]:
    """Cada satélite y fecha con todas sus teselas, recortado al cuadro de la región."""
    x0 = round((g.lon0 + 180) / g.px) - g.c0 * 512
    x1 = round((g.lon1 + 180) / g.px) - g.c0 * 512
    y0 = round((90 - g.lat1) / g.px) - g.r0 * 512
    y1 = round((90 - g.lat0) / g.px) - g.r0 * 512
    salida = []
    for s in CAPAS:
        for d in FECHAS:
            lienzo = Image.new("RGB", ((g.c1 - g.c0 + 1) * 512, (g.r1 - g.r0 + 1) * 512))
            archivos = [(r, c, carpeta / f"{s}-{d}-{g.nivel}-{r}-{c}.jpg") for r, c in g.teselas()]
            if any(not f.exists() or f.stat().st_size < 1000 for _, _, f in archivos):
                continue
            for r, c, f in archivos:
                lienzo.paste(Image.open(io.BytesIO(f.read_bytes())).convert("RGB"), ((c - g.c0) * 512, (r - g.r0) * 512))
            salida.append(np.asarray(lienzo.crop((x0, y0, x1, y1)), dtype=np.uint8))
    return salida


def sin_nubes(pila: np.ndarray) -> np.ndarray:
    """pila (n, alto, ancho, 3) → imagen con el percentil 30 del brillo de las vistas sin nubes."""
    _, alto, ancho, _ = pila.shape
    salida = np.zeros((alto, ancho, 3), dtype=np.uint8)
    for y in range(0, alto, 128):
        bloque = pila[:, y:y + 128].astype(np.float32)
        brillo = bloque.mean(axis=3)
        sat = bloque.max(axis=3) - bloque.min(axis=3)
        valido = brillo > 6  # sin datos = negro
        nube = (brillo > 150) & (sat < 45)
        usar = valido & ~nube
        # Si un pixel quedó nublado en todas las vistas, se usan todas las válidas.
        ninguna = usar.sum(axis=0) == 0
        usar[:, ninguna] = valido[:, ninguna]
        p = np.nanpercentile(np.where(usar, brillo, np.nan), PERCENTIL, axis=0)
        # Se promedian las vistas cercanas al percentil para no dejar el ruido de un solo día.
        cerca = usar & (np.abs(brillo - p[None]) <= 10)
        peso = np.maximum(cerca.sum(axis=0), 1)
        rgb = (bloque * cerca[..., None]).sum(axis=0) / peso[..., None]
        salida[y:y + 128] = np.clip(rgb, 0, 255).astype(np.uint8)
    return salida


def ajustar(im: Image.Image, tamano: tuple[int, int]) -> Image.Image:
    """Al tamaño del lienzo; medios tonos un poco más oscuros y color más sobrio, para que el fuego resalte."""
    im = im.convert("RGB").resize(tamano, Image.LANCZOS)
    a = (np.asarray(im).astype(np.float32) / 255) ** 1.12 * 0.92
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    im = ImageEnhance.Color(im).enhance(0.88)
    return ImageEnhance.Contrast(im).enhance(1.06)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--fondo", action="store_true", help="la foto amplia de detrás (web/img/fondo.jpg)")
    ap.add_argument("--teselas", type=Path, default=RAIZ / "data" / "gibs")
    ap.add_argument("--salida", type=Path)
    args = ap.parse_args()
    g = Region(FONDO, 7, 0.8) if args.fondo else Region(FOTO, 8, 2.5)
    salida = args.salida or RAIZ / "web" / "img" / ("fondo.jpg" if args.fondo else "mosaico.jpg")
    args.teselas.mkdir(parents=True, exist_ok=True)
    trabajos = [(g.nivel, s, d, r, c) for s in CAPAS for d in FECHAS for r, c in g.teselas()]
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda a: bajar(args.teselas, *a), trabajos))
    lista = vistas(args.teselas, g)
    print("vistas completas:", len(lista), "de", len(CAPAS) * len(FECHAS))
    calidad = 62 if args.fondo else 84
    ajustar(Image.fromarray(sin_nubes(np.stack(lista))), g.tamano).save(salida, quality=calidad, optimize=True, progressive=True)
    print("escrito", salida, salida.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
