"""Une las fotos de las diapositivas y el video del demo en un solo MP4.

Uso:
    python3 video.py <carpeta-de-PNG> <video-del-demo.mp4> <salida.mp4>
        [--segundos 6] [--fundido 0.6] [--demo 20.5]

Cada PNG dura --segundos; el que tiene «demo» en el nombre se cambia por el
video del demo (sus primeros --demo segundos). Entre diapositivas hay un
fundido de --fundido segundos, como el data-transition="fade" del deck.
Usa el ffmpeg del paquete imageio-ffmpeg; si no está, el ffmpeg del sistema.
"""

import argparse
import glob
import shutil
import subprocess

ap = argparse.ArgumentParser()
ap.add_argument("pngs")
ap.add_argument("demo_video")
ap.add_argument("salida")
ap.add_argument("--segundos", type=float, default=6.0)
ap.add_argument("--fundido", type=float, default=0.6)
ap.add_argument("--demo", type=float, default=20.5)
a = ap.parse_args()

try:
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"

args, filt, prev, fin = [], [], None, 0.0
for i, f in enumerate(sorted(glob.glob(a.pngs + "/*.png"))):
    if "demo" in f:
        args += ["-t", str(a.demo), "-i", a.demo_video]
        dur = a.demo
    else:
        args += ["-loop", "1", "-framerate", "30", "-t", str(a.segundos), "-i", f]
        dur = a.segundos
    filt.append(f"[{i}:v]scale=1920:1080,fps=30,format=yuv420p,setsar=1[v{i}]")
    if prev is None:
        prev, fin = f"v{i}", dur
    else:
        fin -= a.fundido
        filt.append(
            f"[{prev}][v{i}]xfade=transition=fade:duration={a.fundido}:offset={fin:.2f}[x{i}]"
        )
        prev, fin = f"x{i}", fin + dur

subprocess.run(
    [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", *args,
     "-filter_complex", ";".join(filt), "-map", f"[{prev}]",
     "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
     "-movflags", "+faststart", "-an", a.salida],
    check=True,
)
print(f"{a.salida}: {fin:.1f} s")
