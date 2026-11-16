# Presentation video

Turns the K'áak' deck (the Slides artifact on claude.ai) into a 1080p MP4: each slide lasts
6 seconds, the demo slide plays the whole demo video, and slides change with a short fade, as in
the deck. The result has no audio and lasts 1 min 20 s.

Spanish original: [es/LEEME.md](es/LEEME.md).

It has to be rendered again whenever the deck changes, for example when the demo video changes.

## What you need

- Python 3.11 or later.
- Playwright for Python, with its Chromium: `pip install playwright && playwright install chromium`.
- ffmpeg. The easiest way is `pip install imageio-ffmpeg`, which brings its own ffmpeg and
  installs nothing on the system. `brew install ffmpeg` also works.

A separate environment is the cleanest option:

```sh
python3 -m venv /tmp/kaak-video
/tmp/kaak-video/bin/pip install playwright imageio-ffmpeg
/tmp/kaak-video/bin/playwright install chromium
```

## 1. Download the deck

You need **edit** access to the artifact (ask Gadiel, Share menu). With view-only access,
claude.ai does not let you download the files.

Ask Claude Code:

> Read the artifact `<deck link>` and download to `/tmp/kaak-deck` the files
> `project/deck.json`, `project/deck.css` and everything in `project/slides/`.
> Then download to `/tmp/kaak-assets` every asset the slides reference as
> `/_blob/<id>` (photos, screenshots, QR codes and the demo video).

You should end up with:

```
/tmp/kaak-deck/project/deck.json
/tmp/kaak-deck/project/deck.css
/tmp/kaak-deck/project/slides/*.html
/tmp/kaak-assets/<id>.jpg | .png | .mp4
```

The demo video is the `.mp4` in `/tmp/kaak-assets`: it is the `data-video` of
`project/slides/demo.html`.

## 2. Screenshot each slide

```sh
/tmp/kaak-video/bin/python entrega/video-presentacion/render.py \
  /tmp/kaak-deck /tmp/kaak-assets /tmp/kaak-png
```

It writes `01-portada.png`, `02-abuelo.png`… to `/tmp/kaak-png`. Open them and check that no
text spills out of place before going on.

## 3. Build the MP4

```sh
/tmp/kaak-video/bin/python entrega/video-presentacion/video.py \
  /tmp/kaak-png /tmp/kaak-assets/<demo-video-id>.mp4 Kaak-pitch-EN.mp4
```

Options: `--segundos 6` (seconds per slide), `--fundido 0.6` (fade between slides) and
`--demo 20.5` (how much of the demo video is used). If the new video has a different length,
change `--demo`.

## Another way, without scripts

In the deck, **Share › Export** downloads a `.pptx`. Open it in Keynote
(**File › Export To › Movie**) or in PowerPoint (**File › Export › Video**). It is faster, but
check that the demo video plays inside the MP4 and that the text does not move: the `.pptx` does
not always keep the exact layout.
