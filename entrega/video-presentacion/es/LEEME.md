# Video de la presentación

Convierte el deck de K'áak' (el artifact de Slides en claude.ai) en un MP4 de 1080p:
cada diapositiva dura 6 segundos, en la del demo corre el video completo y entre
diapositivas hay un fundido corto, como en el deck. Sale sin audio, de 1 min 20 s.

Hay que volver a renderizarlo cada vez que cambie el deck, por ejemplo cuando se
cambie el video del demo.

## Lo que necesitas

- Python 3.11 o más nuevo.
- Playwright para Python, con su Chromium: `pip install playwright && playwright install chromium`.
- ffmpeg. La forma más fácil es `pip install imageio-ffmpeg`, que trae su propio
  ffmpeg y no instala nada en el sistema. También sirve `brew install ffmpeg`.

Lo más limpio es un entorno aparte:

```sh
python3 -m venv /tmp/kaak-video
/tmp/kaak-video/bin/pip install playwright imageio-ffmpeg
/tmp/kaak-video/bin/playwright install chromium
```

## 1. Bajar el deck

Necesitas acceso de **edición** al artifact (pídeselo a Gadiel, menú Share). Con
acceso de solo lectura, claude.ai no deja bajar los archivos.

Pídele a Claude Code:

> Lee el artifact `<link del deck>` y baja a `/tmp/kaak-deck` los archivos
> `project/deck.json`, `project/deck.css` y todos los de `project/slides/`.
> Luego baja a `/tmp/kaak-assets` cada asset que las diapositivas citan como
> `/_blob/<id>` (fotos, capturas, QR y el video del demo).

Al final debe quedar:

```
/tmp/kaak-deck/project/deck.json
/tmp/kaak-deck/project/deck.css
/tmp/kaak-deck/project/slides/*.html
/tmp/kaak-assets/<id>.jpg | .png | .mp4
```

El video del demo es el `.mp4` de `/tmp/kaak-assets`: es el `data-video` de
`project/slides/demo.html`.

## 2. Fotos de cada diapositiva

```sh
/tmp/kaak-video/bin/python entrega/video-presentacion/render.py \
  /tmp/kaak-deck /tmp/kaak-assets /tmp/kaak-png
```

Deja `01-portada.png`, `02-abuelo.png`… en `/tmp/kaak-png`. Ábrelas y revisa que
ningún texto se salga de su lugar antes de seguir.

## 3. Armar el MP4

```sh
/tmp/kaak-video/bin/python entrega/video-presentacion/video.py \
  /tmp/kaak-png /tmp/kaak-assets/<id-del-video>.mp4 Kaak-pitch-EN.mp4
```

Opciones: `--segundos 6` (por diapositiva), `--fundido 0.6` (entre diapositivas) y
`--demo 20.5` (cuánto del video del demo se usa). Si el video nuevo dura otra cosa,
cambia `--demo`.

## Otro camino, sin scripts

En el deck, **Share › Export** baja un `.pptx`. Ábrelo en Keynote
(**Archivo › Exportar a › Película**) o en PowerPoint (**Archivo › Exportar › MP4**).
Es más rápido, pero revisa que el video del demo se reproduzca dentro del MP4 y que
los textos no se muevan: el `.pptx` no siempre conserva el diseño exacto.
