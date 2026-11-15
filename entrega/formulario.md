# Formulario de entrega de Space Apps: textos listos para pegar (borrador)

Campos en el orden de la guía oficial (Project Submission Guide, 13 nov). Todo va en inglés.
Las cifras salen de docs/01.

---

## Project Name

K'áak'

## High-Level Project Summary  (≈150 palabras; la lista de la #4 pide de 50 a 200)

In Yucatán, every municipality authorizes agricultural burns and must report on its fire
season, but it does so without data, and the official burning windows catch only 23 % of
the fire that satellites see in its burn zones. K'áak' (Yucatec Maya for "fire") joins 25 years of
NASA fire detections from four satellites, MODIS on Terra and Aqua and VIIRS on Suomi NPP and
NOAA-20, into one comparable series. MODIS sees roughly three to five times less fire than
VIIRS, so without harmonization the record seems to triple in 2012, when only the sensor
changed. We calibrate MODIS to the VIIRS scale with a factor for each burn zone and time of
year and validate it against independent tests, including CONAFOR's ground records. With that series, the site shows each
municipality where fire returns year after year, in which weeks it burns, and whether this
season runs above or below normal, so Civil Protection knows where to go and when to watch.

## Link to Project Demo

[PENDIENTE: enlace al video de 30 s (#10), público y sin iniciar sesión]

## Link to Final Project

https://kaak.pages.dev

(El repositorio va en la descripción detallada: https://github.com/Ghosflot/kaak-yucatan,
que se hace público al entregar.)

## Detailed Project Description

**What it does.** K'áak' is a free website, in English and Spanish, that turns 25 years of
satellite fire detections into a fire calendar for each municipality of the Yucatán
Peninsula. A municipal official picks their municipality and sees three things: where fire
returns almost every year, in which weeks each part of the territory burns, and how the
current season compares with a normal year (the median of 2001 to 2025). The places where
fire repeats link to Google Maps, so a crew can find them, and for Yucatán the page also
shows the cattle land of each municipality (pasture and head of cattle) and how much of its
fire falls on pasture. Each municipality has a one-page sheet that a community leader can forward by messaging app, and the data
behind every chart can be downloaded as CSV.

**Why it matters locally.** Burning to plant the milpa is legal and regulated in Yucatán: the
state agriculture ministry (SEDER) sets burning windows by zone, and the law asks each
municipality to authorize burns and report at the end of the season. Today they do it
without data. The official window catches 23 % of the fire inside the burn zones, while the
four strongest weeks in each zone's own history catch 49 %, twice as much, so the calendar
we compute is a better guide to when to watch. Smoke also reaches the cities: on 14 May
2024, Mérida was among the five most polluted cities in Mexico because of fires in the
previous days.

**How it works.**
1. We download every MODIS (Terra and Aqua) and VIIRS (Suomi NPP and NOAA-20) detection over
   the peninsula from NASA FIRMS since 2001 and assign each one to its municipality.
2. We count fire on a common grid of about 1 km per day, so that several detections of the
   same fire count once, and use one satellite per period: Terra until July 2002, then Aqua,
   then Suomi NPP from 2012, with NOAA-20 filling the days Suomi NPP sent no data.
3. We calibrate MODIS to the VIIRS scale during the 13 years when both fly together, with a
   separate factor for each burn zone and time of year (from 2.8 to 5.3 VIIRS detections per
   MODIS detection), because a single factor does not fit: VIIRS sees 3.5 times more small
   fires than MODIS but only 1.2 times more of the fires larger than 100 ha.
4. We validate the series with criteria fixed before running the tests. Three tests pass:
   the false jump of 2012 disappears (×3.26 before calibration, ×0.90 after), the factor
   holds on Aqua years left out of the calibration, and the two VIIRS satellites agree (0.99
   NOAA-20 detections per Suomi NPP detection). A fourth test, against CONAFOR's ground
   records of forest fires, is informative: Suomi NPP sees 53 % of 1,222 recorded fires,
   against 9 % expected by chance, and 84 % of those larger than 100 ha.
5. A scheduled job downloads new detections from the FIRMS API four times a day, and the
   site recomputes the current season.

The site shows the calendar day by day because SEDER sets the allowed burning windows by
date, so a weekly or monthly view would split them. The normal-year curve is a smoothed
average of 25 seasons, so the pattern shows without day-to-day noise, and the almanac
(monthly) and the downloadable series (weekly) show the coarser patterns.

**What it does not do.** K'áak' does not predict fires and is not an alert system: NASA FIRMS
already sends free fire alerts. A satellite does not see every fire, and no detections does
not mean no fire. A detection outside the allowed dates is not proof of an illegal burn; it
is a question for SEDER and Civil Protection. "Normal" is a reference, not a target. The 2025
and 2026 seasons were the calmest on record in Yucatán, so we do not claim that fire is
increasing; the value is in knowing when a season leaves the normal range, in either
direction.

**What we hope to achieve.** That municipal Civil Protection and SEDER use the calendar to
plan prevention before the season (firebreaks, permits, patrols in the places and weeks that
burn), and that researchers use the harmonized series, which continues with NOAA-20 now that
Suomi NPP stopped delivering data on 2 November 2026.

**Tools.** Python (pandas, NumPy, SciPy, Shapely, PyArrow, Matplotlib, Pillow) for the data
pipeline; a static site in HTML, CSS and JavaScript with no libraries, with SVG maps and
charts over a cloud-free VIIRS mosaic from NASA GIBS; Cloudflare Pages for hosting; GitHub
Actions for tests and the scheduled update; Playwright and axe-core for automated tests of
the site on desktop and phone, in both languages, including accessibility.

**Code and data:** https://github.com/Ghosflot/kaak-yucatan (Apache 2.0). Every figure is
traced to its source in docs/01 of the repository.

## Use of Super Intelligence (SI)

(Esta respuesta no la ven los jueces, según la guía; sirve para su registro.)

Yes. We used Claude (Anthropic), through Claude Code and claude.ai, and GitHub Copilot code
review. Claude helped us research sources (FIRMS and CONAFOR archives, the official burning
calendar, NOAA notices), drafted analysis scripts and parts of the code that a team member
reviewed (the site, the data export, the daily update, the validation), drafted documents
and HTML mock-ups, and helped review pull requests. Copilot left automatic review comments
on some pull requests. The team chose the challenge, the users, the method and the design,
and every figure was checked against the cited sources. No image on the site was generated
with AI; the satellite imagery comes from NASA GIBS. The full disclosure, with each member's
use, is in entrega/uso-de-ia.md in the repository, and the site states it at the foot of
"How we measure it".

## NASA Data

- **NASA FIRMS (Fire Information for Resource Management System):** active fire detections
  from MODIS Collection 6.1 on Terra and Aqua (2000 onward) and VIIRS 375 m on Suomi NPP
  (2012 onward) and NOAA-20 (2018 onward), from the yearly country archives for Mexico and
  the FIRMS area API for the current season.
  https://firms.modaps.eosdis.nasa.gov/
- **NASA GIBS (Global Imagery Browse Services):** VIIRS Corrected Reflectance (True Color)
  tiles from NOAA-20, Suomi NPP and NOAA-21, combined into the cloud-free mosaic of the
  peninsula used as the site's base image (WMTS).
  https://nasa-gibs.github.io/gibs-api-docs/

## Space Agency Partner Data and Other References

We did not use data from the 2026 Space Agency Partners. Other data and resources:

- CONAFOR (National Forestry Commission of Mexico): forest fire statistics 2015–2024
  (datos.gob.mx) and the 2024 and 2025 season closing reports.
- SEDER Yucatán: official agricultural burning calendar by zone.
- INEGI: Agricultural Census 2022 and National Agricultural Survey 2025.
- Ministry of Economy of Mexico, Yucatán fact sheet; Yucatán fire prevention law.
- NOAA notices on the end of Suomi NPP data (2 November 2026).
- geoBoundaries (CC BY 4.0) and Natural Earth: administrative boundaries.
- INEGI: Land Use and Vegetation map, Series VII (2018), for the pasture land of each
  municipality.
- Diario de Yucatán and aqi.in: air quality in Mérida, May 2024. Diario de Yucatán and Por
  Esto: the Yaxkukul dump fire (November 2026) and the Oxkutzcab lemon orchard fire (2022).
- Google Maps: links to see each place where fire repeats.
- Fonts: Alfa Slab One and Atkinson Hyperlegible (SIL Open Font License).
- Software: Python, pandas, NumPy, SciPy, Shapely, PyArrow, Matplotlib, Pillow, Playwright,
  axe-core, GitHub Actions, Cloudflare Pages.
- AI tools: Claude (Anthropic) and GitHub Copilot code review (see Use of SI).

## Tags (si el formulario los pide)

wildfire, MODIS, VIIRS, FIRMS, harmonization, agriculture, Mexico, Yucatán, civil protection

## Imagen del proyecto (JPG o PNG, máximo 10 MB)

La tarjeta para compartir de la página (web/og/) o una captura de la portada nueva, sin el
logo de NASA y sin personas menores de 18 años.
