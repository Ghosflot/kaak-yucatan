"""Foto de fondo de la portada: mosaico sin nubes de la península con vistas VIIRS de NASA GIBS.

Uso: python pipeline/mosaico.py [--teselas data/gibs] [--salida web/img/mosaico.jpg]

Baja las teselas de nivel 8 (~250 m) de tres satélites VIIRS en 26 fechas de la temporada seca
de 2026 (del 10 de febrero al 25 de abril, cada 3 días): 78 vistas. Por pixel toma el percentil
30 del brillo entre las vistas sin nubes, así quedan fuera las nubes (claras) y sus sombras
(oscuras). Después ajusta el tono y lo lleva al lienzo de la página (825 × 681, con la longitud
comprimida por el coseno de 19.8°), al doble y medio de tamaño: 2044 × 1688.
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
LON0, LON1, LAT0, LAT1 = -92.55, -86.7044, 17.81, 22.35  # el lienzo de la página
NIVEL = 8
GRADOS = 288 / 2 ** NIVEL  # grados por tesela
PX = GRADOS / 512
C0, C1 = math.floor((LON0 + 180) / GRADOS), math.floor((LON1 + 180) / GRADOS)
R0, R1 = math.floor((90 - LAT1) / GRADOS), math.floor((90 - LAT0) / GRADOS)
CAPAS = {
    "N20": "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
    "SNPP": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    "N21": "VIIRS_NOAA21_CorrectedReflectance_TrueColor",
}
FECHAS = [date(2026, 2, 10) + timedelta(days=3 * i) for i in range(26)]  # 10 feb a 25 abr
PERCENTIL = 30
TAMANO = (2044, 1688)


def bajar(carpeta: Path, sat: str, d: date, r: int, c: int) -> None:
    f = carpeta / f"{sat}-{d}-{r}-{c}.jpg"
    if f.exists() and f.stat().st_size > 1000:
        return
    url = f"https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{CAPAS[sat]}/default/{d}/250m/{NIVEL}/{r}/{c}.jpg"
    req = urllib.request.Request(url, headers={"User-Agent": "kaak/1.0"})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                f.write_bytes(resp.read())
            return
        except OSError:
            continue


def vistas(carpeta: Path) -> list[np.ndarray]:
    """Cada satélite y fecha con todas sus teselas, recortado al cuadro del lienzo."""
    x0 = round((LON0 + 180) / PX) - C0 * 512
    x1 = round((LON1 + 180) / PX) - C0 * 512
    y0 = round((90 - LAT1) / PX) - R0 * 512
    y1 = round((90 - LAT0) / PX) - R0 * 512
    salida = []
    for s in CAPAS:
        for d in FECHAS:
            lienzo = Image.new("RGB", ((C1 - C0 + 1) * 512, (R1 - R0 + 1) * 512))
            archivos = [(r, c, carpeta / f"{s}-{d}-{r}-{c}.jpg") for r in range(R0, R1 + 1) for c in range(C0, C1 + 1)]
            if any(not f.exists() or f.stat().st_size < 1000 for _, _, f in archivos):
                continue
            for r, c, f in archivos:
                lienzo.paste(Image.open(io.BytesIO(f.read_bytes())).convert("RGB"), ((c - C0) * 512, (r - R0) * 512))
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


def ajustar(im: Image.Image) -> Image.Image:
    """Al tamaño del lienzo; medios tonos un poco más oscuros y color más sobrio, para que el fuego resalte."""
    im = im.convert("RGB").resize(TAMANO, Image.LANCZOS)
    a = (np.asarray(im).astype(np.float32) / 255) ** 1.12 * 0.92
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    im = ImageEnhance.Color(im).enhance(0.88)
    return ImageEnhance.Contrast(im).enhance(1.06)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--teselas", type=Path, default=RAIZ / "data" / "gibs")
    ap.add_argument("--salida", type=Path, default=RAIZ / "web" / "img" / "mosaico.jpg")
    args = ap.parse_args()
    args.teselas.mkdir(parents=True, exist_ok=True)
    trabajos = [(s, d, r, c) for s in CAPAS for d in FECHAS for r in range(R0, R1 + 1) for c in range(C0, C1 + 1)]
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda a: bajar(args.teselas, *a), trabajos))
    lista = vistas(args.teselas)
    print("vistas completas:", len(lista), "de", len(CAPAS) * len(FECHAS))
    ajustar(Image.fromarray(sin_nubes(np.stack(lista)))).save(args.salida, quality=84, optimize=True, progressive=True)
    print("escrito", args.salida, args.salida.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
