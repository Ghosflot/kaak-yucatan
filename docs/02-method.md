# Method: what the site does, how it is calculated and each task

This is how each task is done and when it counts as finished. Everything uses public data (FIRMS
and CONAFOR).

Spanish original: [docs/es/02-metodo.md](es/02-metodo.md).

## What the site answers

For SEDER, Civil Protection, a commissioner or a scientist, in any municipality of the peninsula:

1. **How is the season going here compared with normal?** The season of any year against 25 years
   of reference, in the same week and the same municipality.
2. **When does it really burn, and what does the official calendar say?** The official burning
   window of the zone, shaded over what the satellite saw.
3. **Where does it burn year after year?** The map for placing firebreaks and brigades
   **before** the season.
4. **Can I compare 2005 with 2025?** Yes, because the series is harmonized, and the site shows the
   tests.

The area is a parameter: the code works for any other place in the world, because the challenge
asks for "an area of interest". The demo tells the story of Yucatán.

## Sections of the site

1. **My municipality (entry):** the site asks for the location, finds the municipality and shows
   its chart and its card. If the person doesn't grant permission or is outside the peninsula,
   they pick the municipality from a list. A notice says the location is not stored.
2. **Map:** municipalities colored by how the year is going against normal, where it burns year
   after year, or what share of the fire falls outside the official window.
3. **Can it be trusted?:** the four tests in plain language and the download of the series.

Spanish and English, with a selector. **Out of scope:** wildfire prediction, alerts for each
wildfire and an AI chat.

## Method

**Unit: 1 km grid cells with fire per day.** Latitude and longitude are rounded to 0.01° and each
cell is counted once per day and satellite. MODIS sees in 1 km pixels and VIIRS in 375 m pixels,
so the same fire produces more hot spots in VIIRS; counting cells instead of hot spots removes
that size difference. We did not find a publication that counts with this same 0.01° grid; what is
published is that S-NPP sees several times more fire pixels than Aqua and that the ratio changes
from place to place (White, 2022; see "References").

**Reference scale: VIIRS**, because it is the one that keeps working; MODIS is being retired. The
series is expressed in "VIIRS-equivalent grid cell-days".

**One satellite per period, never added together**, because the number of satellites changed over
the years and adding them would inflate the series:

| Period | Satellite | How it enters |
|---|---|---|
| Jan 1, 2001 – Jul 3, 2002 | Terra (MODIS) | × its Terra→VIIRS factor |
| Jul 4, 2002 – Jan 19, 2012 | Aqua (MODIS) | × its Aqua→VIIRS factor |
| Jan 20, 2012 – Nov 2, 2026 | S-NPP (VIIRS) | It is the reference (factor 1) |
| From Nov 3, 2026 | NOAA-20 (VIIRS) | × its NOAA-20→S-NPP factor |

On the site, 2001–2002 (Terra) are drawn cross-hatched with the note "estimated with Terra, less precise": a single Terra-converted year is about 45 % off in one municipality (about 14 % for a whole zone, against about 20 % for Aqua years); they still count in "normal".

Aqua is the reference MODIS because it passes at the same time as S-NPP (around 1:30 in the
afternoon and in the early morning), and fire changes over the day. Terra only covers the year and
a half before Aqua started.

**Days without data (added Nov 14):** if the period's satellite sent no data one day, that day is
counted with its backup and the backup's factor; there is still a single satellite per day. The
backup is from the same family: NOAA-20 for S-NPP and Terra for Aqua. Terra (2001–2002) and
NOAA-20 have no backup, and NOAA-21 does not enter.
- **When a day has no data:** the period's satellite has 0 grid cell-days in the whole peninsula
  and its backup has 50 or more. It is the same rule as the gap days of the factors
  (`armonizar.UMBRAL_HUECO`). The whole peninsula and the whole day are checked because a day
  with truly no fire is possible in one municipality, but not for one satellite to see 0 in the
  whole peninsula while the other sees 50 or more.
- **Drops confirmed by NASA** (S-NPP from Jul 26 to Aug 20, 2022 and Terra from Jun 15 to Jul 2,
  2001): they are reported and not filled in. The 2022 one stays visible on purpose: it is out of
  season and the rule doesn't detect it. Sources in docs/01, "Days without satellite data".
- **Out of scope:** days with partial data and days when the backup saw less than 50.
- `salidas/dias_sin_datos.csv` lists each day: which was filled, with which satellite and how much
  the backup saw, and which is only reported (`pipeline/serie.py`, `dias_sin_datos()` and
  `elegir()`; the site uses the same function). With the Nov 14 data, 12 days are filled: 11 of
  S-NPP (2024 and 2026) and 1 of Aqua (May 12, 2003).

**The MODIS→VIIRS factors** are calculated by zone and by season:
- **6 zones:** the 4 burning zones of Yucatán (`analisis/zonas_quema_yucatan.csv`), plus Campeche
  and Quintana Roo as one zone each.
- **2 seasons:** burning season (March to May) and the rest of the year. Agricultural burning
  behaves differently from a forest wildfire, so a single factor for the whole year probably fails
  in exactly the season that matters most. Task 3 checks this: if the two factors come out equal,
  we say so.
- **It is calibrated with 2013–2020** (both satellites working and before MODIS's orbit drift)
  **and checked with 2021–2025**, which were not used to calibrate.
- **Why by zone and by season:** the factor is a stratified ratio estimator: one ratio per stratum
  (zone × season), instead of a single one for everything. Cochran (1977, §6.10–6.12) calls this
  the "separate ratio" and warns that, with little data in a stratum, the combined ratio is
  preferable; that is why a `debil` (weak) factor (fewer than 100 grid cell-days) is replaced by
  the one for the same season with all zones together. Using per-region factors to go from a
  satellite count to another quantity is also what GFED5 does (Chen et al., 2023), and Giglio et
  al. (2025) conclude that joining the VIIRS and MODIS records probably calls for a statistical
  calibration by region.

**Day of a hot spot, in local time:** FIRMS gives the date and time in UTC. Before assigning day
and week it is converted to local solar time, `UTC time + longitude / 15` (in the peninsula, about
6 hours less). Without that, all hot spots from Terra's night pass (around 4:00 UTC, 22:00 in the
peninsula) fall on the next day. Solar time is used and not official time because official time
changed over the years (daylight saving time until 2022, and Quintana Roo in another time zone
since 2015).

**Week:** `min((day of year − 1) // 7 + 1, 52)`, from 1 to 52. The one or two days left over at the
end of the year go to week 52, so that all weeks have the same weight.

**State and zone of a hot spot:** they come from its municipality, with
`analisis/municipios_zona.csv`. No other table is used for that. Hot spots with no municipality
(0.2 %) don't enter anything municipal.

**Normal:** by municipality and week, over harmonized 2001–2025, three values: the one that only 1
in 10 years exceeds (90th percentile), the median (50th percentile) and the one that only 1 in 10
years falls below (10th percentile). The same for the **year's cumulative total** (all the fire
from January 1 to that week).

**How the year is going** (the sentence on the card and the color on the map). The year's
cumulative total up to the last week with data is compared with normal for the cumulative total at
that same week:
- If normal is less than 5 grid cell-days (90th percentile of the cumulative total), the sentence
  is "There is hardly any fire here at this time of year" and no comparison is made. That way, a
  single hot spot doesn't turn a municipality that almost never burns red.
- If it is above the 90th percentile: "above normal".
- If it is below the 10th percentile: "below normal".
- Otherwise: "within normal".
The week alone is seen in the chart, but it doesn't decide the sentence: a single week changes a
lot from year to year.

**Official burning window:** there are official lists by zone only for 2025 and 2026, with the same
dates both years (docs/01). Before that, the scheme was different (in 2024, two zones) and we
don't have the list by municipality. Therefore:
- the site draws the window with the label "official window 2025–2026", in any year;
- the percentage of fire outside the window is only calculated for 2025 and 2026;
- Campeche and Quintana Roo have no calendar by zone, so they carry no window.

**Hot spot filter** (the one in `datos_peninsula/README.md`): only vegetation (`type` 0 or empty)
and nominal or high confidence (VIIRS `n` or `h`; MODIS 30 or more).

**Validation:** four tests (task 7). The CONAFOR baseline already exists
(`analisis/cruce_conafor.py`): S-NPP sees 53 % of the wildfires recorded in 2015–2024 and 84 % of
those over 100 ha, against 9 % by chance.

## Technology

- **Calculation:** Python (pandas, shapely, pytest), in `pipeline/`.
- **Site:** HTML, CSS and JavaScript with no framework, in `web/`. Map in SVG over a cloud-free
  satellite photo and charts in SVG, with no Leaflet or Chart.js; the card is drawn with the
  browser's Canvas API. The texts live in `web/textos/es.json` and `web/textos/en.json`, never
  written inside the code. The colors and the font (Space Grotesk, OFL license) are those of the
  project's image; the font goes inside `web/fuentes/` so that the offline copy looks the same.
- **Publishing:** Cloudflare Pages, connected to the repo (it works even if the repo is private and
  gives HTTPS, which the location needs). Each change on `main` publishes the site automatically.
- **Try it on your computer:** `python -m http.server -d web 8000` and open
  <http://localhost:8000>.

**How to get started:**
1. `git clone https://github.com/Ghosflot/kaak-yucatan.git && cd kaak-yucatan`
2. Python 3.11 or newer: `python -m venv .venv`, activate it and run
   `pip install -r requirements.txt`.
3. Check that everything runs: `python analisis/cifras_yucatan.py` must give the figures in
   docs/01.
4. Your branch is named `name/task-number` (for example, `gadiel/2-rejilla`), and the PR title
   starts with the task number ("2: 1 km grid cells").
5. Before opening a PR: `pytest` green and, if you touched the calculation, `python
   pipeline/correr_todo.py` to regenerate `salidas/` and `web/datos/`.

**Generated files:** `salidas/` and `web/datos/` are written only by the code, never by hand. If
they conflict when you update your branch, don't resolve them by hand: run
`pipeline/correr_todo.py` and push whatever comes out.

```
pipeline/   cargar.py, rejilla.py, armonizar.py, serie.py, validar.py, datos_web.py, exportar_web.py,
            actualizar_diario.py, correr_todo.py
salidas/    calculation results (parquet, csv, json)
web/        the site: index.html, js/, css/, textos/, datos/ (generated by exportar_web.py)
tests/      automated tests
```

## Data contract

The calculation (Gadiel and Nico) fills `salidas/`. Task 10 turns it into what the site reads
(`web/datos/`). That way, each side works without waiting for the other: the site starts with the
provisional calendar and, when the harmonized one arrives, only the file is replaced.

| File | One row per | Columns |
|---|---|---|
| `datos_peninsula/focos_peninsula.parquet` | hot spot | The history through Nov 7, 2026. It no longer changes |
| `datos_peninsula/focos_recientes.parquet` | hot spot | What the daily update downloads since Nov 8 (task 18). Same columns |
| `analisis/municipios_zona.csv` | municipality | `municipio`, `estado`, `zona`, `ventana_inicio`, `ventana_fin` (month-day; empty outside Yucatán) |
| `salidas/calendario.parquet` | municipality × year × week | `estado`, `municipio`, `zona`, `anio`, `semana`, `cuadritos_viirs_eq` (harmonized), `cuadritos_modis_crudo`, `cuadritos_viirs_crudo`, `p10`, `p50`, `p90` (of the week), `acum`, `acum_p10`, `acum_p50`, `acum_p90` (of the year's cumulative total), `en_ventana` |
| `salidas/calendario_mensual.parquet` | municipality × year × month | `estado`, `municipio`, `anio`, `mes`, `cuadritos_viirs_eq` |
| `salidas/factores.csv` | zone × season × satellite | `zona`, `epoca`, `satelite`, `factor`, `factor_min`, `factor_max`, `cuadritos_dia_usados`, `debil` |
| `web/datos/municipio/{id}.json` | municipality | among others, `repetidos`: `[lon, lat, seasons]` of each grid cell with fire in 5 or more of the 14 seasons (task 6) |
| `web/datos/zonas.json` | burning zone of Yucatán | its window, the fire of each day from January to June and how much fell outside the window each year |
| `salidas/validacion.json` | test | name, number, plain-language sentence and path of its chart |
| `salidas/serie_armonizada.csv` | municipality × year × week | the same as the calendar, for download |
| `datos_peninsula/ganaderia_municipios.csv` | municipality of Yucatán | `municipio`, `estado`, `bovinos_2022` (total from the 2022 Agricultural Census), `bovinos_up_2022` (production units only), `km2`, `km2_pastizal` (cultivated and induced, INEGI Series VII), `pct_pastizal`, `bovinos_km2`, `focos` and `focos_pastizal` (S-NPP 2013–2025). Built by `analisis/preparar_ganaderia.py` (#60) |
| `datos_peninsula/pastizal_yucatan.geojson` | municipality of Yucatán | `municipio` and the Series VII cattle pasture, simplified to 50 m (under 2 MB) |
| `web/datos/ganaderia.json` | — | `periodo`, `yucatan` (state totals) and `municipios` (`id`, `bovinos`, `bovinosKm2`, `pctPastizal`, `focos`, `focosPastizal`), for the map's "Cattle territory" option |
| `salidas/dias_sin_datos.csv` | day without data from the period's satellite | `dia_local`, `satelite_periodo`, `respaldo`, `cuadritos_respaldo`, `motivo` (`umbral` or `caida_confirmada`), `rellenado`, `nota` |

---

## Tasks

Each task says what has to be done, what is delivered, when it is finished, what it depends on and
how many hours it takes (rough estimate for someone who already knows the tool). This is the plan
the work was split with; where the site ended up different, the code is the reference.

### Harmonization

#### 1. Provisional calendar
- **What:** `salidas/calendario.parquet` with S-NPP only (2012–2026), uncalibrated. The columns of
  the harmonized series and of normal carry the S-NPP data or are empty.
- **Finished when:** task 10 can convert it, and the total for Tekax in 2024 matches counting by
  hand the S-NPP grid cell-days of Tekax in 2024. If task 2 is not ready, count with the same rule
  (latitude and longitude rounded to 0.01°, one cell per day).
- **Depends on:** nothing · **Hours:** 2 · **Skills:** pandas.

#### 2. Count fire in 1 km grid cells
- **What:**
  - `pipeline/cargar.py`, with a `cargar_focos()` function that is the **only entry point for the
    data**: it reads `focos_peninsula.parquet` and, if it exists, `focos_recientes.parquet`;
    removes duplicates; applies the filter from "Method", computes the day in local time (see
    "Method") and joins the zone with `analisis/municipios_zona.csv`. Nobody else reads the
    parquet files directly.
  - `pipeline/rejilla.py`, which converts hot spots into grid cell-days per satellite.
- **Delivers:** `pipeline/cargar.py`, `pipeline/rejilla.py` and `tests/test_rejilla.py`.
- **Finished when:** the test shows that two hot spots in the same cell on the same day count as
  one, that two different satellites are never added, and that a Terra hot spot at 4:00 UTC on
  April 2 counts for April 1.
- **Depends on:** nothing · **Hours:** 3 · **Skills:** pandas, pytest.

#### 3. MODIS→VIIRS factor
- **What:** for each zone and season, in 2013–2020, S-NPP grid cell-days divided by Aqua grid
  cell-days. The same with Terra (for 2001–2002).
- **Delivers:** `pipeline/armonizar.py` and `salidas/factores.csv`.
- **Finished when:** the 12 Aqua factors and the 12 Terra factors are there. A factor based on
  fewer than 100 grid cell-days is marked `debil` and replaced by the one for the same season with
  all zones together.
- **Range of each factor:** it is recomputed eight times, leaving out one of the years 2013–2020
  each time, and the lowest and highest are kept (`factor_min`, `factor_max`). It is a **range**,
  not a confidence interval: in docs and in the pitch we say "range". A number without its range
  is easier to attack in the judges' questions.
- **Depends on:** 2 · **Hours:** 6 · **Skills:** pandas, ratios.

#### 4. NOAA-20→S-NPP factor
- **What:** the same calculation, NOAA-20 divided by S-NPP, from 2018 to 2026, by season.
- **Delivers:** two more rows in `salidas/factores.csv`.
- **Finished when:** the factor is there and falls between 0.95 and 1.06, as in docs/01, or the PR
  explains why not.
- **Depends on:** 2 · **Hours:** 1.

#### 5. 25-year series and normal
- **What:** build the series with the period table from "Method" and compute p10, p50 and p90, for
  the week and for the year's cumulative total.
- **Delivers:** the final `salidas/calendario.parquet`, `salidas/calendario_mensual.parquet` (for
  the 25-year calendar of task 13) and `salidas/serie_armonizada.csv`.
- **Finished when:** the site works by just replacing the file, and the annual chart of Yucatán
  no longer has the 2012 jump.
- **Depends on:** 3 and 4 · **Hours:** 3.

#### 6. Where and when it burns year after year
- **What:** per grid cell, in how many of the 2012–2025 seasons it had fire. Per municipality: how
  many cells had fire in 7 or more of the 14 seasons, what percentage of the municipality they are
  (`pct_recurrente`: among all the 0.01° cells that fall inside it, so that a large municipality
  doesn't win just by size), the week in which it burns most (the one with the highest median in
  2001–2025) and what percentage of the fire fell outside the official window in 2025 and in 2026
  (Yucatán only; see "Method").
- **Why only 2012–2025:** MODIS doesn't see small fires, so a MODIS year with no fire may be a
  fire it didn't see. The 25 years serve to count how much fire there was, not to say where there
  was none.
- **Delivers:** `pipeline/recurrencia.py`, `salidas/recurrencia.parquet` and
  `salidas/cuadritos_recurrencia.parquet`. The latter doesn't go to the site (it weighs too much);
  it is used for a pitch image.
- **Finished when:** Tekax and Tizimín come out among the municipalities with the most recurrent
  cells, or the PR explains why not. They are the two largest municipalities of Yucatán, so the PR
  also says where they rank by `pct_recurrente`.
- **Depends on:** 2 · **Hours:** 3.
- **How it ended up (Nov 15):** it was done differently and without its own file in `salidas/`.
  `cuadritos_repetidos` in `pipeline/exportar_web.py` calculates the grid cells with fire in 5
  or more of the 14 seasons (March to May, without fixed sources) and writes them into each
  municipality's JSON; the site draws them in "Where does {municipality} burn?". The week with
  the most fire comes from `semana_pico` in `pipeline/datos_web.py`, and the fire outside the
  window is shown by municipality ("{k} in 10 hot spots appear after…") and by zone
  (`web/datos/zonas.json`). `pipeline/recurrencia.py`, `salidas/recurrencia.parquet` and
  `salidas/cuadritos_recurrencia.parquet` don't exist, and the municipality's percentage
  (`pct_recurrente`) is left for later.

#### 7. The four tests that it works
Each test carries a number, a chart and a sentence that can be said in the pitch:
- **The 2012 jump disappears:** the 2009–2011 average against the 2013–2015 one, in the
  uncalibrated series and in the harmonized one.
- **It works in years that were not used:** convert Aqua 2021–2025 with the factors and compare
  with S-NPP for those years; error in percent per year. It is also compared against a single
  factor for everything (no zones or seasons): that is the test that calibrating by zone and
  season is worth it. If the single factor comes out equal or better, the single one is used and
  we say so. Since 2022 Aqua's orbit drifts and it passes later, so the error may grow those
  years: if it does, we say so and explain it, we don't hide it.
- **It matches CONAFOR:** repeat `analisis/cruce_conafor.py` with the harmonized series.
- **The VIIRS agree with each other:** S-NPP against NOAA-20 and NOAA-21.
- **Delivers:** `pipeline/validar.py`, `salidas/validacion.json` and the charts in
  `salidas/graficas/`.
- **Before running them:** the task 3 PR or a separate PR says what result counts as passing each
  test (for example, that the error of the second stays below a percentage), and that is not
  changed after seeing the numbers. That way nobody can say we chose the test to fit the result.
- **Finished when:** all four have a number, a chart and a sentence. If one comes out badly, we say
  so as it is: that is also a result.
- **Depends on:** 5 · **Hours:** 5.

#### 8. Loader for the host-site kit
- **What:** if the kit brings FIRMS hot spots, they are used as they are. If it brings something
  else, a function is added to `pipeline/cargar.py` that converts it to the columns of
  `datos_peninsula/focos_peninsula.parquet`. No other file is touched.
- **Finished when:** tasks 2 to 7 run with the kit's data without changing anything else.
- **Hours:** 1 to 3.

#### 9. Explain the calibration
- **What:** 10 minutes with the team, with the chart of the 2012 jump. Afterwards, each member
  explains it in 2 minutes without help.

### Site

#### 10. Move the data from Python to the site
- **What:** `pipeline/exportar_web.py` converts `salidas/` into `web/datos/`:
  - one JSON per municipality with its weekly calendar, its monthly calendar and its card;
  - `municipios.geojson` with an identifier per municipality;
  - `recurrencia.json`;
  - `validacion.json`;
  - `serie_armonizada.csv`.
- **Finished when:** it runs with the provisional calendar and again with the final one without
  changes, and no file in `web/datos/` exceeds 2 MB.
- **Depends on:** 1 · **Hours:** 2.

#### 11. Site skeleton
- **What:** `web/index.html` with the three sections, the list of municipalities, the language
  selector that reads `web/textos/*.json` and a layout that looks good on a phone.
- **Finished when:** it opens locally, switches language and, when a municipality is picked, loads
  its JSON.
- **Depends on:** 10 · **Hours:** 2.

#### 12. Location → municipality
- **What:** ask for the location with `navigator.geolocation`, look up which polygon of
  `municipios.geojson` it falls in (point-in-polygon function) and open that municipality. If the
  person doesn't grant permission or falls outside, the list opens.
- **Finished when:** published (task 17), on a phone it opens the right municipality, and when
  permission is denied the list appears.
- **Depends on:** 11 · **Hours:** 3.

#### 13. "My municipality" section
- **What:** weekly chart of the chosen year:
  - that year's fire, as a line;
  - the band of normal (p10 to p90) and the median;
  - the official burning window shaded, with the label "official window 2025–2026" (Yucatán
    only);
  - CONAFOR wildfires as dots (only available for 2015 to 2024).
  On top, the sentence on how the year is going, with the rule from "Method". Below, the data from
  task 6 and the link to subscribe to FIRMS emails
  (<https://firms.modaps.eosdis.nasa.gov/alerts/>).
  - **25-year calendar:** a grid with one row per year (2001 to today) and one column per month,
    colored by that month's fire (`calendario_mensual.parquet`). It is the "burning calendar" that
    the challenge describes: it shows at a glance which months burn and which years had the most
    fire. Tapping a year switches the chart above to that year.
  - **Accessible colors**, as the challenge asks: a single-hue scale that goes from light to dark
    (viridis or cividis type), with no red against green and with its legend.
  - **Municipality download:** a button that downloads that municipality's series as CSV. The
    challenge asks for being able to download what was searched; the full series is in task 16.
  - If the municipality's zone is inferred (Baca, Dzán and Tekit; `fuente` column of
    `analisis/zonas_quema_yucatan.csv`), the window says "inferred zone".
- **Finished when:** in Tekax, 2024 shows above normal and 2025 below, the same as all of Yucatán
  according to docs/01 (if Tekax doesn't follow the state, it is reviewed before calling it good),
  and the 25-year calendar no longer shows the 2012 jump.
- **Depends on:** 11 · **Hours:** 6.

#### 14. Downloadable card for WhatsApp
- **What:** a button that draws a vertical image (1080 × 1920) on a Canvas and downloads it. The
  image carries:
  - the municipality and the sentence on how the year is going;
  - the weeks in which it burns most;
  - the official burning window;
  - the caption "Data: NASA FIRMS · K'áak'".
  A printed version works for the pitch.
- **Finished when:** it downloads on a phone, looks good when sent over WhatsApp and someone
  outside the team understands it without explanation (Leo tests it in task 21).
- **Depends on:** 13 · **Hours:** 3.

#### 15. "Map" section
- **What:** municipalities colored with Leaflet, with three options: how the chosen year is going
  against normal (same rule as the sentence), recurrent cells and percentage outside the window
  (2025 or 2026). Recurrence is painted with `pct_recurrente`, so that large municipalities don't
  come out dark just because of their size. Municipality-level data only. The colors follow the
  same rule as task 13 (traffic light). The background map is OpenStreetMap, with its credit
  visible as its license requires. Tapping a municipality opens its "My municipality" section.
- **Finished when:** the three options work on the phone, the legend is understood without
  explanation and the three colors of "how the year is going" are also distinguishable in a
  black-and-white capture.
- **Depends on:** 11 · **Hours:** 3.

#### 16. "Can it be trusted?" section and download
- **What:** the four tests from `validacion.json` with their chart and sentence, the uncalibrated
  series next to the harmonized one, and the button to download `serie_armonizada.csv` with how to
  cite it. The CSVs go in UTF-8 with BOM, so that Excel shows the accents correctly (Tizimín,
  Dzán).
- **Finished when:** someone outside the team reads it and says in one sentence why the series can
  be compared across years.
- **Depends on:** 7 and 10 · **Hours:** 3.

### Quality and publishing

#### 17. Publish on Cloudflare Pages and test on phones
- **What:**
  - Guille connects the repo to Cloudflare Pages with their account, once. Setup: no build command
    and `web` as the output folder.
  - Misa tests it on an Android, on an iPhone and in an incognito window.
  - **Plan B for the pitch:** a copy of the site that works without internet
    (`python -m http.server -d web 8000` on the pitch laptop, tested with wifi off).
- **Finished when:** the link opens without logging in, the location works on both phones and the
  offline copy opens. Repeated on the 11th, with the complete site.
- **Hours:** 1, plus the tests.

#### 18. Automatic daily update
- **Why this way:** `analisis/actualizar_datos.sh` is no good for this, because it rebuilds
  everything from the ~900 MB of raw data, which is only on Guille's server.
- **What:**
  - `pipeline/actualizar_diario.py` downloads through the FIRMS API the NOAA-20, NOAA-21 and MODIS
    hot spots (near-real-time product) for the peninsula's bounding box, from the last day each
    satellite already has. The API gives at most 5 days per query, so it asks in chunks: if the job
    stops running for a few days, the next one fills the gap.
  - It assigns municipality and state with `datos_peninsula/municipios_peninsula.geojson`, with the
    same rule as `analisis/preparar_peninsula.py`.
  - It appends the new ones to `datos_peninsula/focos_recientes.parquet` without repeating hot
    spots and runs `pipeline/correr_todo.py`.
  - A GitHub Actions job runs it four times a day (1:23, 11:23, 14:23 and 23:23 UTC, after FIRMS
    publishes the satellite passes; the reasons are in `.github/workflows/actualizar.yml`) and
    pushes the result to `main`. It is the **only** one that pushes to `main` without a PR, and it
    only touches `datos_peninsula/focos_recientes.parquet`, `salidas/` and `web/datos/`.
  - The FIRMS key is the repo secret `FIRMS_MAP_KEY` (already stored) and never goes in a file. The
    job needs `permissions: contents: write` to be able to push to `main`.
- **Finished when:** it ran by itself two days in a row and the site's "data through" date
  changed.
- **Depends on:** 2 and 10 · **Hours:** 3.

#### 19. PR review and automated tests
- **What:**
  - `pipeline/correr_todo.py` runs the whole calculation in order with a single command: load,
    grid cells, factors, series, recurrence, tests and move to the site. If a stage doesn't exist
    yet, it skips it and says so.
  - A GitHub Actions job runs `pytest` on every PR.
  - On a free private repo, GitHub doesn't allow blocking `main`. The rule is kept by agreement:
    nobody pushes directly to `main`, except the task 18 job.
- **Finished when:** no PR enters `main` with failing tests or without review, and
  `python pipeline/correr_todo.py` runs from start to finish.
- **Hours:** 2 to set it up, plus the reviews.

## References

Each one was opened and confirmed to say what is attributed to it (Nov 14).

- **Cochran, W. G. (1977).** *Sampling Techniques*, 3rd ed. New York: Wiley. §6.10 "Ratio
  estimates in stratified random sampling", §6.11 "The combined ratio estimate" and §6.12
  (comparison). Supports the factor by zone and season (separate ratio per stratum) and the switch
  to the combined ratio when a stratum has little data (`debil`).
- **Chen, Y., Hall, J., van Wees, D., et al. (2023).** Multi-decadal trends and variability in
  burned area from the fifth version of the Global Fire Emissions Database (GFED5). *Earth System
  Science Data*, 15, 5227–5259. <https://doi.org/10.5194/essd-15-5227-2023>. Converts MODIS hot
  spots into burned area with factors that change by GFED region, vegetation type and tree cover.
  It is a precedent for per-region factors; it does not join MODIS with VIIRS.
- **Giglio, L., Boschetti, L., Roy, D. P., et al. (2025).** The NASA VIIRS burned area product,
  global validation, and intercomparison with the NASA MODIS burned area product. *Remote Sensing
  of Environment*, 331, 115006. <https://doi.org/10.1016/j.rse.2025.115006>. Concludes that to have
  a single long, consistent record, a statistical calibration by region between the VIIRS and MODIS
  products is probably needed (they are burned-area products, not hot spots).
- **White, B. L. A. (2022).** Quantitative differences in detection of fire pixels using
  Aqua/MODIS and NPP-Suomi/VIIRS satellites. *Journal of Hyperspectral Remote Sensing*, 12(6),
  379–390. In South America, 2012–2021, S-NPP detected on average 5.13 times more fire pixels than
  Aqua; by country, from 3.87 (Chile) to 6.81 (Venezuela); in municipalities of Pará, from 2.84 to
  11.25. It concludes there is no single formula to adjust Aqua to S-NPP. Our Aqua factors (2.84 to
  5.34, `salidas/factores.csv`) fall in that range; they are expected to be somewhat lower because
  we count grid cell-days and not pixels.

**Not added:** the harmonized MODIS/VIIRS series by Boschetti, Roy and Giglio (presentation to the
MODIS Science Team, 2023). NASA's server did not respond on Nov 14 and it could not be opened; in
2023 it was work in preparation, not a published article.
