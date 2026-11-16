# Verified facts

Every figure has its source and can be reproduced with the scripts in `analisis/` (which one, in
each section). **Team rule: a figure that is not here does not go in the pitch.**

Spanish original: [docs/es/01-hechos-verificados.md](es/01-hechos-verificados.md).

## Two sources that measure different things

| Source | What it counts | Watch out |
|---|---|---|
| **CONAFOR** (Mexican government) | *Forest* wildfires attended: one per event, with hectares, cause and municipality | It doesn't count agricultural burns that don't turn into a forest wildfire |
| **FIRMS** (NASA) | *Hot spots*: pixels where the satellite detected fire on a pass | A large wildfire produces hundreds of hot spots, and a small burn can produce one. **Hot spots ≠ wildfires** |

That difference is the point of the project: the satellite sees much more fire than forest
statistics record. It has to be said that way, without claiming "there are X hidden wildfires".

## Are there many wildfires in Yucatán? (CONAFOR)

Forest wildfires and hectares burned. Source: CONAFOR database 2015–2024 on datos.gob.mx; 2025
comes from the season-close PDF.

| Year | Yucatán | Campeche | Quintana Roo | Peninsula (ha) |
|---|---|---|---|---|
| 2015 | 34 · 8,646 ha | 28 · 6,530 ha | 81 · 5,867 ha | 21,043 |
| 2016 | 155 · 7,021 ha | 21 · 5,176 ha | 41 · 2,301 ha | 14,498 |
| 2017 | 103 · 11,008 ha | 29 · 13,818 ha | 64 · 9,631 ha | 34,457 |
| 2018 | 46 · 1,851 ha | 3 · 3,150 ha | 50 · 6,855 ha | 11,856 |
| 2019 | 22 · 5,691 ha | 15 · 14,647 ha | 59 · 12,795 ha | 33,133 |
| 2020 | 26 · 10,015 ha | 21 · 10,946 ha | 68 · 41,678 ha | 62,639 |
| 2021 | 15 · 892 ha | 5 · 2,029 ha | 33 · 1,879 ha | 4,800 |
| 2022 | 36 · 1,289 ha | 15 · 17,897 ha | 44 · 8,245 ha | 27,431 |
| 2023 | 15 · 765 ha | 20 · 10,320 ha | 50 · 10,915 ha | 22,000 |
| **2024** | **29 · 20,334 ha** | **30 · 27,667 ha** | **64 · 91,548 ha** | **139,549** |
| 2025 | 13 · 2,215 ha | 56 · 51,980 ha | 29 · 6,642 ha | 60,837 |

- **2024 was the worst year of the 2015–2025 series** in Yucatán and in the peninsula. Nationally
  too: 8,002 wildfires and 1,672,216 ha, the largest area in the series.
- **Fire varies a lot from one year to the next**: Yucatán went from 765 ha (2023) to 20,334 ha
  (2024) and back to 2,215 ha (2025). That is why a historical calendar is useful: it says whether
  a year is going worse than normal.
- **Most frequent cause in Yucatán (2015–2024): "burning to prepare planting"**, with 204
  wildfires and 18,182 ha. The cause with the most hectares is "unknown" (26,540 ha). Hunters and
  beekeeping activities also appear.
- **Municipalities with the most area burned (2015–2024):** Tekax (89 wildfires, 17,845 ha),
  Tizimín (65, 10,359 ha), Dzilam de Bravo (7, 5,879 ha) and Chemax (58, 3,888 ha).
- **Ecosystems:** medium semi-deciduous forest, cattail marsh and mangrove. For example, 1,777 ha
  of mangrove in Dzilam de Bravo (Feb 2024) and 3,178 ha of cattail marsh in Halachó (May 2024).
- **Season:** 90 % of Yucatán's forest wildfires started between March and May (433 of 481,
  2015–2024).

## What the satellite sees (FIRMS)

Vegetation hot spots with nominal or high confidence. A hot spot is in Yucatán if its municipality
is in Yucatán (`analisis/municipios_zona.csv`); Yucatán's figures come from
`analisis/cifras_yucatan.py` (with Tzucacab).

| Year | Yucatán VIIRS | Peninsula VIIRS | Peninsula MODIS |
|---|---|---|---|
| 2013 | 14,475 | 51,648 | 16,800 |
| 2019 | 11,503 | 47,351 | 15,422 |
| 2020 | 9,348 | 47,843 | 15,552 |
| 2023 | 8,757 | 49,641 | 15,086 |
| 2024 | 11,279 | 51,683 | 17,547 |
| 2025 | 6,867 | 34,044 | 9,648 |

(The full table by year is in the script's output.)

- **Yucatán has between 6,800 and 14,500 hot spots a year (VIIRS, 2013–2025)**, while CONAFOR
  records between 13 and 155 forest wildfires. Most of that fire is burning that doesn't enter the
  forest statistics.
- **89 % of Yucatán's hot spots occur between March and May**, with the peak in April (about
  4,100 hot spots on average).
- **The days with the most hot spots in Yucatán in 2024 were April 16 to 21** (332 on the 21st).
  They coincide with wildfires recorded by CONAFOR in Tekax (Tres Banderas, from April 21, 2,428
  ha; Ejido Kancab, from April 14, 1,804 ha).

## The challenge's technical problem, in numbers

**VIIRS detects about 3 times more hot spots than MODIS over the same territory and the same
years.** In the peninsula, the VIIRS/MODIS ratio was 2.95 to 4.05 between 2013 and 2025 (median:
3.08). By zone and season, the calibrated factor goes from 2.8 to 5.3 S-NPP hot spots for each
Aqua one (2.84 in Yucatán zone 1 in season, 5.34 in zone 4 out of season; `salidas/factores.csv`).
That is why the script says "between three and five times". VIIRS has 375 m pixels and MODIS 1 km,
so VIIRS sees smaller fires.

Consequence: if someone naively joins MODIS (2001–2011) with VIIRS (2012 onward), fire seems to
have tripled in 2012. The peninsula goes from 18,872 MODIS hot spots in 2011 to 51,648 VIIRS hot
spots in 2013, but the only thing that changed was the sensor. **Harmonizing the two records is
exactly what the challenge asks for.** There are 13 years in which both sensors operate at the
same time to calibrate.

## Context

### MODIS is being retired, but is still active
- NASA confirms that Terra and Aqua (the MODIS satellites) are in a wind-down phase, drifting from
  their orbit, and will stop collecting science data when operations end (LAADS MODIS→VIIRS
  transition page). A NASA document from April 2025 estimated August 2026 for Aqua and January
  2027 for Terra.
- **Checked live:** Terra and Aqua still report hot spots every day in FIRMS. That is why one must
  not say "MODIS has already shut down". The correct statement is: "the 25-year MODIS record is
  about to close".
- Until November 2 there were **three** VIIRS satellites in FIRMS: S-NPP, NOAA-20 and NOAA-21.
  Since then NOAA-20 and NOAA-21 remain (see "S-NPP stops delivering data"). Joining the VIIRS
  satellites with each other is also part of the problem: the series continues with NOAA-20
  (docs/02, "Method").
- Method hint: NASA designed its 750 m VIIRS product (VNP14) to give continuity to the 1 km MODIS
  record (VNP14 user guide). FIRMS distributes the 375 m one.
- Hypothesis, not verified: as the orbit drifts, the satellite's pass time changes, and since fire
  varies over the day, that could alter recent MODIS counts.

### Burns are regulated and have an official calendar
- The current rule is **NOM-015-SEMARNAT-AGRICULTURA-2023**: published in the DOF on December 1,
  2023, in force since May 29, 2024 according to the Secretaría de Economía catalog. It replaces
  NOM-015-SEMARNAT/SAGARPA-2007 and regulates the use of fire on forest and agricultural land.
- **Burning calendar in Yucatán (2024)**, according to the state Civil Protection coordinator
  (Posta, April 3, 2024): traditional milpa from March 1 to April 15, and the henequen zone from
  April 20 to May 31. In March 2024, 434 fire reports were handled. That number includes all kinds
  of fires, not only forest ones.
- **Idea for the product:** compare the fire the satellite sees with the official burning windows.
- **Henequen zone (inferred):** its 2024 window (Apr 20–May 31) is identical to that of SEDER zone
  2 in 2025 and 2026 (51 municipalities of the center-north, the traditional henequen region).
  Everything points to zone 2 being the henequen one, so no other map is needed. Leo is confirming
  it with people from the countryside (task 21).

### What Civil Protection and SEDER live through
Background for the storytelling and the pitch, gathered by Leo from press articles
(`docs/es/campo-y-datos-pc-seder.pdf` has the full version with APA references). Only the figures
that don't clash with other sources go here. All the articles were opened on Nov 14, 2026 and each
fact appears in its article; those that didn't appear were removed.

- **Reports and permits:** in the first 22 days of March 2023, Civil Protection received 427
  incident reports of all kinds, 126 of them fire-related (Quadratín, "Recibe Procivy 19 reportes
  diarios de incendios", Mar 24, 2023). In the whole 2023 season only 187 burns with a permit were
  recorded in the state (Diario de Yucatán, Feb 26, 2024). That same year VIIRS detected 8,757 hot
  spots in Yucatán ("What the satellite sees"). Hot spots are not burns. The 427 is a different
  figure from the 434 reports of March 2024 (above): don't mix them.
- More than 90 % of forest wildfires in Yucatán are caused by human activity, according to
  Yucatán Civil Protection (Posta, Apr 3, 2025).
- These incidents have affected plots, ranches and irrigation systems, and have destroyed
  weekend houses and rural installations, according to residents (Por Esto, Apr 6, 2026).
- **Cases:**
  - Sucopó, Tizimín (2021): a farmer burned alone and without precautions; nobody notified Civil
    Protection. Three plots and more than 35 ha were damaged (Por Esto, May 18, 2021).
  - Oxkutzcab (2022): 15 ha of Persian lime in the San Luis I and II units, from a brush burn that
    got out of control. The Civil Protection director asked neighbors to make firebreaks properly
    before burning (Por Esto, Apr 21, 2022).
  - Umán (2025): fire next to two housing developments (Diario de Yucatán, Mar 25, 2025). That
    year Umán lost 264.29 ha of medium forest and Yaxkukul 480.05 ha of low forest (Diario de
    Yucatán, Jan 12, 2026, with preliminary CONAFOR figures).
- **The burning permit:** it is free, requested at the municipal palace and only allows burning
  from 17:00 to 08:00 (Diario de Yucatán, Feb 26, 2024). SEDER coordinates each year the State
  Committee of the Agricultural and Forest Fire Prevention and Fighting Program (Por Esto, Feb 26,
  2026).

### Yucatán's countryside: territory, people and raw material
What the countryside represents, for the pitch and for docs/04. Everything comes from INEGI and
Secretaría de Economía documents (opened Nov 14, 2026), except where another source is stated.

- **Territory:** Yucatán measures 4 million ha; the area with agricultural use or vocation is 1.6
  million ha, **42.3 %** (INEGI, 2022 Agricultural Census, press release 698/23).
- **Agricultural area:** 436,372 ha in all production units; 402,564 ha in the 58,036 active
  agricultural units, of which 339,044 were planted (2022 Census). The 2025 National Agricultural
  Survey gives **306,991 ha** in active units (report 45/26, table 1, Oct 7, 2026). It is a sample
  survey: don't say the countryside "fell".
- **People:** 58,036 active production units. Permanent labor is 115,595 people: 52,589 producers
  who worked directly in their unit, 46,438 family members and 16,568 hired workers; there were
  also 57,273 seasonal jobs (press release 698/23). **96 of every 100 producers considered
  themselves indigenous** and, of them, 90.4 % speak some indigenous language (press release
  698/23); 50.7 % have primary school as their level of education; only 2.0 % of units got credit
  (2022 Census infographic). Careful: 53,630 is the head count of sheep, not producers.
- **Raw material:** white grain maize, main annual crop (47.5 thousand t); cultivated pasture,
  main perennial (946.1 thousand t); 381,535 cattle, 1,606,202 pigs and 38,116,894 birds in
  production units (with backyard ones: 388,399 cattle); 8.4 thousand liters of cow's milk a day;
  81.3 % of the agricultural area is rain-fed (2022 Census infographic).
- **Exports:** beef was Yucatán's 2nd exported sector in 2023, with 329 million dollars, after
  pearls and precious stones (Secretaría de Economía, "Invierte en Yucatán" sheet, with the 2023
  Trade Balance).
- **Growth:** the primary sector grew 9.3 % in the first half of 2025, "the largest growth since
  2004" (Por Esto, Nov 24, 2025, with INEGI data).
- **Causes of forest wildfires (CONAFOR 2015–2024):** 220 of 481 (46 %) from agricultural,
  crop-farming or livestock activities; since 2018 CONAFOR splits "agropecuarias" into "agrícolas"
  and "pecuarias", so all three are counted. Of them, 204 from burning to prepare planting
  (`analisis/campo_y_fuego.py`).
- **Not said:** that agriculture is the second sector of Yucatán's economy, or "63 % of the food
  economy": we found no source. The weight of the countryside in the state GDP is in INEGI's GDP by
  state tables and we could not read it.

### The municipalities with the most fire live off the land
By grid cell-days per year with hot spots (VIIRS S-NPP, 2012–2025, `analisis/campo_y_fuego.py`).
Each municipality's activity comes from its Spanish Wikipedia page (2020 INEGI population and
economy section) and, for the east's cattle ranching, from CICY ("La ganadería", with SAGARPA 2004
data). Tekax, Yaxcabá, Tzucacab, Buctzotz and Panabá have no economy section: the first three are
classified by CONAFOR causes and the last two by CICY.

| # | Municipality | Fire per year | Activity | CONAFOR wildfires (from farming) |
|---|---|---|---|---|
| 1 | Tizimín | 863 | Cattle ranching (meat, milk and cheese); medium-sized city | 65 (34) |
| 2 | Tekax | 423 | Milpa | 89 (42) |
| 3 | Yaxcabá | 347 | Milpa | 14 (9) |
| 4 | Chemax | 268 | Maize, beans, cattle and pigs | 58 (32) |
| 5 | Valladolid | 222 | Partial: maize, vegetables and cattle, plus commerce and tourism | 14 (9) |
| 6 | Peto | 214 | Maize, beans, chili and watermelon; cattle and pigs | 0 |
| 7 | Espita | 193 | Maize and cattle | 0 |
| 8 | Tzucacab | 185 | Milpa | 43 (38) |
| 9 | Buctzotz | 183 | Cattle ranching | 0 |
| 10 | Panabá | 157 | Cattle ranching | 0 |

- 9 live entirely off the land and Valladolid, partly. Together they hold 44 % of satellite fire,
  59 % of wildfires (283 of 481) and 53 % of hectares (35,524 of 67,512); 58 % of those wildfires
  (164 of 283) started from farming.
- Mérida: 19th in total fire and 77th of 106 per km²; none of its 6 CONAFOR wildfires came from
  farming. Its 3 fires of 5 days or more are out of season (see "Pending verification").

### What the law asks of the municipality
Law for the Prevention and Fighting of Agricultural and Forest Fires of the State of Yucatán
(D.O. Dec 13, 2006, last amended Jul 31, 2019), read in full on Nov 14, 2026:
- Art. 16: "It is the exclusive power of Municipal Presidents to issue authorizations to carry out
  burns."
- Art. 18: the permit requires firebreaks of at least 3 m and written notice to neighbors 5 days
  ahead.
- Art. 23: at the end of the calendar, the municipal president sends SEDER a report with "the
  general evaluation of actions, their impact on the municipality and, where applicable, the
  improvement proposals".
- Art. 25: the burning period is set each year "taking into account the evaluation of the previous
  cycle and the improvement proposals".
- Art. 39: a Municipal Committee with authorities and representatives of residents must be set up
  in each municipality.

### Each zone's calendar captures double the official window
Forward test, VIIRS S-NPP 2012–2025, 14 seasons (`analisis/campo_y_fuego.py`). It does not use the
harmonized 25-year series: MODIS doesn't see small fires (docs/02, task 6). Burning zone = grid
cell with fire in 30 % or more of the previous years; each zone is a patch of 3 or more
neighboring cells inside a municipality.
- **Calendar:** the fire of each year (2019–2025) that falls in the 4 strongest weeks of its zone's
  history: **49 %** (between 45 and 55 % each year). In SEDER's official window for that zone:
  **23 %**. It is measured inside the burning zones, not on all of the state's fire (for the whole
  state: 19 % in 2025, "Finding"). The window says when burning is allowed, not when it is burned;
  in zones 1 and 2 it lasts 46 and 42 days, longer than the 4 weeks, and still captures less.
- **Where:** the burning zones receive 46 % of the next year's 1-to-2-day burning (2018–2025) and
  cover 23.5 % of the land. 68 % of Yucatán's land has had fire at some point since 2012.
- **Connected fire** (neighboring grid cells with fire on consecutive days): fires of 5 days or
  more, 40 in 2024 against 1 to 9 in the other years except 2020 (17). From 2015 to 2024, 26 of 85
  (31 %) coincide with a CONAFOR wildfire within 3 km or less; those of 3 days or more, 62 of 734
  (8 %).
- **Escape zones:** 22 of 79 fires of 5 days or more (2019–2025) started within 2 km or less of one
  from earlier years, in a strip that is 6 % of the land; without 2024, 7 of 39. Few cases: don't
  say it predicts where fire escapes.

### Smoke reaches Mérida
- On May 14, 2024, Mérida was among the five most polluted cities in Mexico, with an air quality
  index of 151 to 162 ("very bad"), attributed to smoke from fires in the previous days (Diario de
  Yucatán, with aqi.in data).
- **Yaxkukul dump (according to the press):** the municipal dump, at km 8 of the Conkal–Yaxkukul
  road, about 26 km from Mérida, caught fire on the night of Monday, November 9, 2026 (detected
  around 19:00) and the fire began to be controlled on the morning of Tuesday the 10th. The smoke
  reached several sectors of Mérida, mostly the north, center and west; many people thought it was
  fog. Yucatán Civil Protection asked people to stay indoors, close doors and windows, avoid
  outdoor activities and look after girls, boys, older people, pregnant women and people with
  respiratory or heart conditions. The wind was blamed for the smoke moving toward Mérida (Diario
  de Yucatán, Nov 9 and 10; Por Esto, Nov 10).
  - **Limits:** it was a dump fire, not a forest wildfire or an agricultural burn, so it is not
    what K'áak' measures. We don't know whether the satellite saw it and we didn't verify it. The
    articles only mention Mérida (not other municipalities in the north) and report no symptoms,
    hospitals or air-quality figures. The articles don't give the cause. One article quotes an
    official who said it posed no risk; Civil Protection recommended taking shelter. **Don't say it
    affected people's health or that it spread across northern Yucatán.**
  - **What it is for:** a recent example that the smoke from a single fire travels kilometers and
    reaches people who didn't see it start. It is used in the 5-minute version of the script
    (docs/03).

### What already exists (and what we will be compared against)
- **CONABIO, Early Warning System for Fires (SATIF):** <https://incendios.conabio.gob.mx>. It has
  operated since around 2000 (Gaceta UNAM). According to its portal code, it shows satellite hot
  spots (MODIS, VIIRS and GOES), queries by state, municipality and date (with a filter of up to
  three months), counts of total hot spots and in protected areas, historical downloads and monthly
  MODIS burned area (2000–2019). **It does have a history.** **Confirmed on the portal and in its
  "Available information" section:** it gives hot spots by sensor and by year, each in its own
  column (AVHRR 1999–2003, MODIS since 2004, VIIRS since 2014), and its documentation says nothing
  about calibrating or harmonizing sensors, so there is no comparable series. Nor does it compare a
  season against normal: the closest things are an annual "fire pressure" map (return period and
  hot spot frequency on a 1 km grid) and a vegetation anomaly (NDVI) against 10 years, which are
  not hot spot counts by week or by municipality. The portal's documentation and tables were
  reviewed; each download was not tested. Captures of the walkthrough in
  `docs/capturas/conabio-satif-*.png`; the one that shows the sensor-by-year table is
  `conabio-satif-09-tabla1-completa.png`.
- **CONAFOR and the Universidad Juárez de Durango (SPPIF):** <https://forestales.ujed.mx/incendios2/>.
  Danger prediction with meteorology, and active and historical wildfires downloadable by state.
- **CONAE (Argentina):** viewer of MODIS and VIIRS hot spots and burned area. The challenge's photo
  credits CONAE, so the challenge likely comes from there. It is a deduction, not a confirmed fact.

### S-NPP stops delivering data on November 2, 2026
- **NOAA notice (August 3, 2026):** delivery of all S-NPP products, including VIIRS, ends on
  November 2, 2026 at 13:00 UTC, permanently. NOAA recommends NOAA-21 as primary and NOAA-20 as
  secondary. The notice doesn't say whether the historical archive will remain available.
- **Confirmed (NOAA update 2, Oct 19):** the date is still **November 2 at 13:00 UTC**. At first it
  was November 1, but NOAA moved it because it falls on a Sunday. Some Earthdata pages (and the
  LDOPE one, which says "November 2, 2026 (2026/305)", although day 305 is the 1st) still carry the
  old date: **cite NOAA**. New fact: from December 1 to 12, S-NPP will be lowered from orbit to
  re-enter over the South Pacific.
  Source: <https://www.nesdis.noaa.gov/news/administrative-update-2-cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-november-02-2026-1300-utc-and-decommissioning-issued-october-19-2026-1400-utc>
- That cut happens 11 days before the hackathon. With MODIS retiring, the record is split among
  four satellites (Terra, Aqua, S-NPP and NOAA-20); NOAA-21 also sees the peninsula, but doesn't
  enter the series (same as the README). The complete S-NPP record, from January 20, 2012 to
  November 2, 2026, is in `datos_peninsula/focos_peninsula.parquet`.

### The VIIRS satellites agree with each other; the gap is with MODIS
Vegetation hot spots in the peninsula (nominal or high confidence):

| Year | S-NPP | NOAA-20 | MODIS | NOAA-20 / S-NPP | NOAA-20 / MODIS |
|---|---|---|---|---|---|
| 2019 | 47,351 | 45,549 | 15,422 | 0.96 | 2.95 |
| 2020 | 47,843 | 46,120 | 15,552 | 0.96 | 2.97 |
| 2021 | 24,806 | 24,099 | 8,328 | 0.97 | 2.89 |
| 2022 | 26,506 | 26,234 | 6,549 | 0.99 | 4.01 |
| 2023 | 49,641 | 49,868 | 15,086 | 1.00 | 3.31 |
| 2024 | 51,683 | 54,928 | 17,547 | 1.06 | 3.13 |
| 2025 | 34,044 | 32,393 | 9,648 | 0.95 | 3.36 |

- NOAA-20 and S-NPP give practically the same (between 0.95 and 1.06). NOAA-21 too: 51,829 hot
  spots against S-NPP's 51,683 in 2024 (1.00) and 32,616 against 34,044 in 2025 (0.96). Its FIRMS
  record starts on March 1, 2023. In 2018 NOAA-20 comes out low because in FIRMS its record starts
  on April 1, 2018 and it is missing March.
- If two VIIRS satellites are added without removing duplicates, the same fire is counted twice.

### 2022: Aqua was off for 17 days and saw less fire than normal
It explains why 2022 is the worst year of Test 2 (`salidas/validacion.json`): the Aqua prediction
comes out **25 % below** S-NPP (12,122 grid cell-days against 16,136), when 2021, 2023, 2024 and
2025 come out between −5 % and +11 %. The test passes anyway (11 % error in 2021–2025, limit
25 %). Hot spot figures with `analisis/aqua_2022.py` (vegetation, nominal or high confidence).

**Confirmed: Aqua sent no data from March 31 to April 16, 2022.**
- On March 31 a failure in the satellite's power control put it in safe mode and MODIS stopped
  taking data. NASA considers the data good again from April 17 (Earthdata, MCST). LAADS puts the
  end of the event at April 21.
- In the peninsula, those 17 days Aqua has **0 hot spots** and S-NPP **4,090**. It fell in the
  strongest part of the season.
- Test 2 already removes those days ("gap days": one satellite at 0 and the other with fire), so
  the outage is **not** what lowers the prediction.

**Confirmed with the data: the rest of the season, Aqua saw less than normal.**
S-NPP hot spots for each MODIS one, March to May, without the outage days:

| | 2013–2025 without 2022 | Median | **2022** |
|---|---|---|---|
| For each Aqua hot spot | 4.50 to 5.46 | 5.03 | **6.72** (+34 %) |
| For each Terra hot spot (control) | 6.71 to 9.51 | 8.24 | 8.62 (+5 %) |

- With Aqua, 2022 is the highest year of the 13: Aqua saw about **25 % less** than what it usually
  sees against S-NPP. It is the same 25 % that the prediction is missing.
- **It is not because of that year's fires:** Terra, which is also MODIS, comes out normal, and so
  does the typical intensity of the fires S-NPP sees (median FRP 6.7 MW, like the other years).
- **It is not only the outage:** March already comes out high (6.4 against a median of 4.7),
  before the failure. April (6.4 against 4.6) and May (7.0 against 6.0) too. Removing the recovery
  days (April 17 to 21) barely changes it (6.85).
- **It doesn't look like Aqua's orbit drift:** drift grows with the years, and in 2023 and 2024
  Aqua returns to normal (2024 is the lowest year: 4.52).

**Unconfirmed:** why Aqua saw less in 2022. See "Pending verification".

**For the pitch:** Test 2 passes with 2022 included. If asked about 2022: "Aqua, one of the old
satellites, was off for 17 days because of a failure NASA reported, and that year it saw less fire
than normal; Terra, its twin, didn't. Even so the total error is 11 %".

### Official burning calendar by zone (Yucatán)
- In 2026 the Secretaría de Desarrollo Rural (SEDER) divided the state into four zones: zone 1, 30
  municipalities of the south-east (Mar 1–Apr 15); zone 2, 51 of the center-north (Apr 20–May 31);
  zone 3, 13 of the south (Mar 10–Apr 3); zone 4, 12 of the north and east (Mar 10–Apr 3). Sources:
  Heraldo de México (Mar 2, 2026) and El Cronista Yucatán (Apr 14, 2026).
- The list of municipalities by zone is in `analisis/zonas_quema_yucatan.csv`. It comes from the
  Diario de Yucatán article of March 6, 2025, which has 103 of the 106 municipalities. The 3
  missing ones (Baca in zone 2; Dzan and Tekit in zone 3) are inferred: that way the totals match
  the official 2026 ones exactly. **Still to confirm:** Leo is asking in the towns (task 21) and,
  meanwhile, the site marks them as inferred.
- Note: "Quintana Roo" in zone 1 is not an error. It is a municipality of Yucatán.

### Finding: most of the fire falls outside its zone's window
VIIRS hot spots of 2025 in Yucatán, crossed with the zone of their municipality
(`analisis/cifras_yucatan.py`, with Tzucacab):

| | S-NPP | NOAA-20 |
|---|---|---|
| Inside its zone's window | 18.9 % | 18.0 % |
| In season (Mar–May) but outside its window | 66.7 % | 66.6 % |
| Out of season | 14.4 % | 15.5 % |

- The two satellites give the same, so the pattern doesn't depend on the sensor.
- **It doesn't mean "illegal burns".** A hot spot outside its window can be a forest wildfire, a
  burn that got out of control or a misclassified heat source. It is a question for SEDER and Civil
  Protection, not an accusation.
- Limitations: the 2025 windows were applied to the year 2025 only, and municipal boundaries are
  approximate (geoBoundaries).

### The 2025 and 2026 seasons were the quietest on record
Vegetation hot spots in Yucatán from March to May (nominal or high confidence). The 2026 data were
downloaded through the FIRMS API (`analisis/descargar_firms_api.py`).

| Satellite | Normal (median) | Highest | 2025 | **2026** |
|---|---|---|---|---|
| S-NPP (2013–2025) | 8,122 | 13,139 (2013) | 5,880 | **3,789** |
| NOAA-20 (2019–2025) | 7,871 | 9,809 (2024) | 5,583 | **4,192** |
| MODIS (2013–2025) | 3,159 | 4,965 (2013) | 1,711 | **933** |

- The three satellites agree: **2026 is the lowest season in the series** and 2025 the second (with
  CONAFOR, 2025 was also the year with the fewest forest wildfires: 13).
- **Consequence for the pitch:** we can't say fire is increasing in Yucatán. What is valuable about
  the tool is knowing whether a season goes beyond normal, in either direction. The MODIS drop may
  be exaggerated by its orbit drift.
- **Open question:** what changed in 2025 and 2026? Rains, the burning calendar by zone, more
  surveillance or less milpa? Leo takes it to the countryside (task 21).

### Validation with CONAFOR: the satellite sees most of the recorded wildfires
Computed with `analisis/cruce_conafor.py` (per-wildfire detail in
`analisis/salidas/cruce_conafor.csv`). We took the 1,222 wildfires CONAFOR recorded in the
peninsula between 2015 and 2024, all with coordinates and dates. It counts as "seen" if there is at
least one hot spot within 2 km between one day before the start and one day after the end.

| Satellite | Wildfires with a hot spot nearby | By chance (control) |
|---|---|---|
| **S-NPP (VIIRS)** | **53 %** | 9 % |
| MODIS (Terra + Aqua) | 36 % | 4–5 % |
| Any satellite | 58 % | 12 % |

The control repeats the match with the same place one year before and one year after, and with the
same dates 20 km away. It measures how much would match by coincidence, because in season there is
fire everywhere. The real value is about **6 times** chance.

| Wildfire size (CONAFOR) | Wildfires | S-NPP | MODIS |
|---|---|---|---|
| 0 to 5 ha | 275 | 18 % | 5 % |
| 6 to 10 ha | 126 | 29 % | 11 % |
| 11 to 20 ha | 124 | 40 % | 23 % |
| 21 to 50 ha | 167 | 57 % | 29 % |
| 51 to 100 ha | 134 | 66 % | 40 % |
| More than 100 ha | 395 | **84 %** | 72 % |

- **The bigger the wildfire, the more the satellite sees it.** The correlation between hectares and
  number of hot spots is 0.64 (Spearman). In 2024, the worst year, S-NPP saw 84 % of the 123
  recorded wildfires.
- **The MODIS–VIIRS gap depends on size:** in small wildfires VIIRS sees 3.5 times more than MODIS,
  and in those over 100 ha only 1.2 times more. It is an independent test that a single conversion
  factor is not enough, and it supports calibrating by zone and by type of fire (docs/02).
- **By state:** Campeche 72 %, Quintana Roo 57 % and Yucatán 42 %. Yucatán comes out lower because
  its wildfires are smaller (median of 20 ha, against 33 ha in Quintana Roo and 132 ha in
  Campeche). With 50 ha or more, Yucatán reaches 74 %.
- **Sentence for the pitch:** "Of the wildfires CONAFOR recorded in the peninsula, the satellite
  saw more than half, and 84 % of those over 100 hectares; by chance it would match less than
  10 %."
- **Limits:** CONAFOR records forest wildfires, not agricultural burns, so this validates detection,
  not the burning calendar. CONAFOR's point is one per wildfire, even if the wildfire is large. The
  0 ha wildfire (1 case) was left as is.

### What the people of the countryside say

Leo gathers these with their grandfather, who is a farmer, and with people from the towns (task 21
of docs/02). Each item says who it comes from. They serve to tell the story and to review the card;
they are not figures.

**Lorenzo de Jesús López Nabte, Leo's grandfather** (confirmed by Leo): 73 years old, lives in Muna
and has worked his plot since he was 15, more than 50 years.

- **In Muna burns start in April** (confirmed by him with Leo, Nov 14, 2026). Muna is in SEDER zone
  3, whose window is March 10 to April 3 (`analisis/zonas_quema_yucatan.csv`): the window closes
  just when he says they start. It matches what the satellite sees across Yucatán: 89 % of hot spots
  fall between March and May, with the peak in April ("What the satellite sees"). It supports the
  script's "in April" sentence (docs/03).

- "People of the countryside have their own calendars for burning and harvesting."
- "They don't adapt to technology. It is very hard for them to adapt everything they have been
  doing almost all their lives to technology."
- There are burning dates where each owner has their own date. The dates are agreed at a meeting of
  all the plot owners (controlled burn).
- Accidental causes he mentions: strong sun on trash, which ignites and spreads, and controlled
  burns that get out of control.
- **What it is for:** it explains why fire doesn't follow the official window (see "Finding: most of
  the fire falls outside its zone's window"): each community has its own calendar. It also warns
  that a tool for the producer has to be very simple, or it won't be used.

Comment from Misa in the group, to confirm with Leo: wildfires are learned about by phone call, the
farmer is told when to burn and in the big bush there isn't enough water to put them out.

### Fire alerts that already exist
- **FIRMS sends free emails** to anyone who draws an area on its map, or picks a country or a
  protected area: daily, weekly or near real time.
- FIRMS publishes MODIS and VIIRS hot spots **less than 3 hours** after the satellite passes. Each
  satellite sees a place about twice a day, so the email can take longer than that.
- **CONABIO** has operated an early fire warning system since around 2000; it is used together with
  911. We didn't confirm whether it sends emails to users today.

### Page figures
They come from `web/datos/`, which `pipeline/exportar_web.py` writes from the harmonized series
(`salidas/serie_armonizada.csv`); `python pipeline/exportar_web.py` recalculates them. Since Nov 14,
S-NPP's days without data are counted with NOAA-20 (see "Days without satellite data" below).

- **What the page counts.** A "hot spot" on the page is a grid cell-day: a ≈1.1 km cell with at
  least one hot spot that day (`pipeline/rejilla.py`). Several hot spots in the same cell on the
  same day count once, and one satellite is used per day. That is why 2026 gives 3,320 and not the
  3,789 S-NPP hot spots in the table above, which counts each hot spot (and doesn't have the days
  S-NPP sent no data). Both figures say the same: 2026 is the lowest season since 2001.
- **Front page, Yucatán from March to May:** 3,320 hot spots in 2026 against 6,712 in a normal year
  (the 2001 to 2025 median): less than half. 93 of the 106 municipalities had less fire than normal
  and none had more. The day with the most fire in the peninsula was April 30, with 682 (seen by
  NOAA-20: that day S-NPP sent no data).
- **The year with the most fire was 2003:** 16,850 hot spots, and 83 of the 106 municipalities had
  more fire than normal (seen by tapping 2003 in the front page's bars).
- **Tekax:** 213 hot spots in 2026 against 390 in a normal year (a little more than half). In a
  normal year, 8 of every 10 hot spots (79 %) appear after April 3, when its zone's window closes.
- **A normal year, day by day** (`pipeline/datos_web.py`, `normal_diario`): it is the average shape
  of the 2001 to 2025 season, scaled so that it adds up to the median of the totals. Until Nov 14
  the median of the cumulative total was subtracted day by day; since the year that ends up in the
  middle changes from one day to the next, days at zero and jumps came out (Tekax had 20 hot spots
  on May 31 after five days at zero). With the fix, the sentence "k of every 10 hot spots appear
  after…" changed in 35 municipalities (Dzitas went from 9 to 5); Tekax and the totals don't change.
- **Umán, the site's example municipality** (`web/datos/municipio/uman.json`; issue #30): 42 hot
  spots in a normal year. In 2025, the second quietest season on record, it had 63 (1.5 times
  normal, "above"), and in 2024, 54 ("above"); in 2026, 19 (before counting S-NPP's days without
  data with NOAA-20 it was 14). Seen by tapping 2025 in its bars. CONAFOR supports it: 5 forest
  wildfires in 2015–2024, all in jungle and 4 of them by hunters, with 890 ha
  (`datos_peninsula/incendios_conafor_2015_2024.csv`), and 264.29 ha of medium forest in 2025
  (Diario de Yucatán, Jan 12, 2026, with preliminary CONAFOR figures). **Careful:** in 2016 CONAFOR
  records 601 ha, but the satellite gives 26 hot spots, less than normal: the satellite doesn't see
  every wildfire (see "Validation with CONAFOR"). It replaces Tekax as the example because it shows
  a bad year (2025) when the rest of the state was quiet. With current data Tekax 2024 also comes
  out "above" (617 against 390), not "within normal". Since Nov 14 it is also the demo's example in
  the script (docs/03), so the pitch shows the same as the page's "For example" button.
- **Hot spots outside the allowed dates, January to June 2026** (`web/datos/zonas.json`):

  | Zone | Allowed dates | Outside the dates |
  |---|---|---|
  | 1 | Mar 1–Apr 15 | 9 of every 10 (91 %) |
  | 2 | Apr 20–May 31 | 4 of every 10 (40 %) |
  | 3 | Mar 10–Apr 3 | 9 of every 10 (91 %) |
  | 4 | Mar 10–Apr 3 | 96 % |

  Same as in the 2025 finding: they are not "illegal burns".
- **The 2012 jump** has two figures in "How we measured it", and both are correct:
  - **Test 1** (`salidas/validacion.json`, in "Can it be trusted?"): in the peninsula, with the
    full year, the 2013–2015 average divided by the 2009–2011 one is ×3.26 uncalibrated and ×0.90
    with the factor. In the state of Yucatán it goes from ×3.06 to ×0.92. It is the one that decides
    whether the test passes.
  - **The chart above** (`web/datos/metodo.json`): in Yucatán, from March 1 to May 31, it is ×3.0
    uncalibrated and ×0.93 with the factor. The page says it is Yucatán in season and that the test
    with the peninsula is below.
  - NOAA-20 sees 0.99 hot spots for each S-NPP one in season (VIIRS test).
- **Aqua's in-season factor** (`salidas/factores.csv`, Yucatán zones): S-NPP sees between 2.8 and
  3.8 hot spots for each Aqua one (2.84 in zone 1, 3.83 in 2, 3.10 in 3 and 3.84 in 4). "How we
  measured it" shows that range.
- **127 municipalities on the map, not 130:** the geoBoundaries limits don't include Dzitbalché,
  Seybaplaya or Puerto Morelos, which are recent municipalities; their hot spots fall in the
  municipalities they split from. Yucatán does have its 106.

### Days without satellite data (verified Nov 14)
The series uses one satellite per day. If that satellite sent no data, the day used to count as
zero fire even if another satellite saw it. Now (docs/02, "Method") it is counted with its backup:
NOAA-20 for S-NPP and Terra for Aqua. Full list in `salidas/dias_sin_datos.csv`.

- **Days filled in (12):** S-NPP saw 0 in the whole peninsula and NOAA-20 saw 50 or more on May 30
  – Jun 3, 2024 (380 to 898 per day), Mar 10–12, 2026 (56 to 116) and Apr 28–30, 2026 (347 to 682,
  at the peak of the season). Aqua saw 0 and Terra 174 on May 12, 2003.
- **Effect on the page:** Yucatán from March to May 2026 goes from 2,883 to 3,320 hot spots
  (+15 %); it is still the lowest season since 2001. In 2024, +2.5 %. Normal (6,712) and the 2012
  jump don't change. The earlier sentence "the day with the most fire was May 1, with 653" was false:
  S-NPP sent no data on April 30, when NOAA-20 saw 682.
- **S-NPP's 2022 drop, deliberately not filled in:** S-NPP went into safe mode and NASA gives its
  data from Jul 26 to Aug 20, 2022 as lost (VIIRS came back Aug 10). In the peninsula S-NPP saw 0
  from Jul 27 to Aug 10 and on Aug 18 and 19; NOAA-20 saw about 90 cells on those days. It is not
  filled in: it is out of season and the threshold rule (50 or more) is made not to confuse "no
  fire" with "no data". It stays in `dias_sin_datos.csv` to explain it.
- **Terra in 2001, with no backup:** Terra's MODIS was off because of a power-supply failure from
  Jun 15 to Jul 2, 2001 (NASA MCST). Before July 2002 there is no other satellite, so those 18 days
  count as zero. It is June, out of season, and 2001 is one of the 25 years of normal. It is
  reported and not touched.
- **What is not detected:** days when the satellite sent partial data (S-NPP Aug 11 to 17, 2022),
  out-of-season days when the backup saw less than 50 (12 days from June to August) and Mar 19 to
  28, 2002, when Terra didn't see a single hot spot in the middle of the season (cause unverified:
  it is not called a drop).
- **The same method as others:** GFED5NRT (Chen et al., *ESSD* 18:7535, 2026) uses the available
  VIIRS when the other is missing. It is the same family of method; we didn't copy it from there.

## Pending verification

- Missing countryside data (task 21): whether zone 2 is the henequen one, the inferred zones of
  Baca, Dzan and Tekit and Misa's comment.
- "What Civil Protection and SEDER live through": the press articles have already been reviewed.
  Removed: the Feb 25, 2026 bill (no official link) and whatever wasn't a fact from some article:
  El Niño at the end of 2026, fires in several zones at once overwhelming brigades, that the permit
  is requested "on paper", that Civil Protection "finds out when there is already fire" and the
  conclusion "almost nobody gives notice before burning".
- Figures that do **not** go in the pitch because they clash between sources: Yucatán 2023 (765 or
  760 ha), 2024 (20,334 or 20,333 ha) and 2026 (3 wildfires and 335.83 ha, or another report of
  more than 400 ha).

- **Countryside:** the percentage of Yucatán's GDP contributed by primary activities (INEGI's GDP by
  state tables); that the livestock sector generates more than 29 billion pesos (Diario de Yucatán,
  Aug 4, 2026, according to a specialist), and the 2 h 7 min detection and 4 h 26 min brigade
  arrival of 2026 (Por Esto): they come from search summaries and the articles were not opened. The
  Space Apps challenge page did not open (certificate error): don't say the challenge asks for a
  calendar.
- **Mérida:** its 3 fires of 5 days or more (Jul 2025, Aug and Oct 2026) are out of season. It
  remains to check whether they are fixed heat sources that recent hot spots carry unmarked (docs/04,
  task 5).

- **Why Aqua saw less fire in 2022** ("2022: Aqua was off for 17 days"). What was checked: it is
  not that year's fires (Terra comes out normal) and it starts in March, before the outage. What is
  missing: look in NASA notices (MCST, LAADS) for whether anything changed on Aqua in 2022, for
  example an orbit maneuver or an instrument adjustment. After safe mode NASA reprocessed Aqua's
  thermal bands, but not the ones used to detect fire. Until it is confirmed, the pitch doesn't say
  what the cause is.

## Sources

- INEGI, 2022 Agricultural Census, final results for Yucatán (press release 698/23): <https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2023/CA_Def/CA_Def2022_Yuc.pdf>
  and production units infographic: <https://inegi.org.mx/contenidos/programas/ca/2022/doc/inf_up_agro_yuc_ca2022.pdf>
- INEGI, 2025 National Agricultural Survey, results report 45/26: <https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/ena/ENA2025_RR.pdf>
- Secretaría de Economía, "Invierte en Yucatán" sheet 2023: <https://ventanillaunica.economia.gob.mx/media/20230823%20Perfil%20_%20Entidades%20_%20Yucatan.pdf>
- Por Esto, the primary sector grows 9.3 % (Nov 24, 2025): <https://www.poresto.com/yucatan/merida/2025/11/24/sector-primario-de-yucatan-crece-93-en-el-primer-semestre-del-2025-es-el-mayor-incremento-en-21-anos.html>
- Law for the Prevention and Fighting of Agricultural and Forest Fires of the State of Yucatán: <https://www.yucatan.gob.mx/docs/regulaciones/wbungwc0.pdf>
- CICY, "La ganadería" (SAGARPA 2004 data): <https://www.cicy.mx/documentos/CICY/Sitios/Biodiversidad/pdfs/Cap2/17%20La%20ganaderia.pdf>
- Spanish Wikipedia, top-10 municipalities: <https://es.wikipedia.org/wiki/Municipio_de_Tizim%C3%ADn>,
  <https://es.wikipedia.org/wiki/Municipio_de_Tekax>, <https://es.wikipedia.org/wiki/Municipio_de_Yaxcab%C3%A1>,
  <https://es.wikipedia.org/wiki/Municipio_de_Chemax>, <https://es.wikipedia.org/wiki/Municipio_de_Valladolid_(M%C3%A9xico)>,
  <https://es.wikipedia.org/wiki/Municipio_de_Peto>, <https://es.wikipedia.org/wiki/Municipio_de_Espita>,
  <https://es.wikipedia.org/wiki/Municipio_de_Tzucacab>, <https://es.wikipedia.org/wiki/Municipio_de_Buctzotz>,
  <https://es.wikipedia.org/wiki/Municipio_de_Panab%C3%A1>
- NASA FIRMS, yearly files by country: <https://firms.modaps.eosdis.nasa.gov/data/country/>
  (MODIS C6.1 and VIIRS S-NPP 375 m; `type` field 0 = presumed vegetation fire).
- CONAFOR, forest wildfire database 2015–2024: <https://www.datos.gob.mx/dataset/incendios_forestales>
- CONAFOR, 2024 season close: <https://www.gob.mx/cms/uploads/attachment/file/965295/Cierre_de_la_Temporada_2024.pdf>
- CONAFOR, 2025 season close: <https://www.gob.mx/cms/uploads/attachment/file/1084029/Cierre_de_la_Temporada_2025.pdf>
- Natural Earth, state boundaries (admin 1, 1:10m).
- NASA LAADS, MODIS→VIIRS transition: <https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition>
  and April 2025 document: <https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/MODIS-VIIRS_Transition.pdf>
- NASA Earthdata, Aqua safe mode (Mar 31 – Apr 17, 2022): <https://www.earthdata.nasa.gov/data/alerts-outages/aqua-safe-mode-alert>
- NASA MCST, the Aqua safe mode event: <https://mcst.gsfc.nasa.gov/news/aqua-safe-mode-event>
- NASA LAADS, Aqua reprocessing after safe mode: <https://ladsweb.modaps.eosdis.nasa.gov/alerts-and-issues/171771>
- FIRMS, hot spots of the last 7 days (live check): <https://firms.modaps.eosdis.nasa.gov/data/active_fire/>
- VIIRS VNP14 user guide: <https://lpdaac.usgs.gov/documents/427/VNP14_User_Guide_V1.pdf>
- NOM-015-SEMARNAT-AGRICULTURA-2023 (Secretaría de Economía catalog): <https://platiica.economia.gob.mx/normalizacion/?p=248501>
- NASA Earthdata, S-NPP in safe mode (data from Jul 26 to Aug 20, 2022 not recoverable):
  <https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-recovers-from-safe-mode>
- NSIDC, S-NPP VIIRS back on Aug 10, 2022:
  <https://nsidc.org/data/user-resources/data-announcements/update-snppviirs-safe-mode>
- NASA MCST, Terra MODIS operations in 2001: off on Jun 15
  (<https://mcst.gsfc.nasa.gov/iot/am1weekly2001-1672001-173>) and back on Jul 2 at
  22:48 UTC (<https://mcst.gsfc.nasa.gov/iot/am1weekly2001-1812001-187>).
- Posta, burning calendar in Yucatán (Apr 3, 2024): <https://www.posta.com.mx/mexico/durante-marzo-se-controlaron-434-reportes-de-incendios/vl1559689>
- Diario de Yucatán, air quality (May 14, 2024): <https://www.yucatan.com.mx/merida/2024/05/14/aire-en-merida-entre-los-mas-contaminados-de-mexico-hoy.html>
- Diario de Yucatán, Yaxkukul dump fire (Nov 10, 2026): <https://www.yucatan.com.mx/yucatan/2026/11/10/controlan-el-incendio-registrado-en-el-basurero-municipal-de-yaxkukul-el-humo-afecto-a-merida.html>
  and (Nov 9, 2026): <https://www.yucatan.com.mx/merida/2026/11/09/densa-humareda-sorprende-a-colonias-de-merida-huele-a-quemado-reportan.html>
- Por Esto, smoke in Mérida from the Yaxkukul fire (Nov 10, 2026): <https://www.poresto.com/yucatan/merida/2026/11/10/humo-merida-noche-lunes-noviembre-ssp-explica-origen.html>
- Gaceta UNAM, early warning systems: <https://www.gaceta.unam.mx/fenomeno-global-los-incendios-forestales-de-gran-extension-y-duraderos/>
- CONAE, hot spot viewer manual: <https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf>
- NOAA NESDIS, S-NPP cessation (Aug 3, 2026): <https://www.nesdis.noaa.gov/news/cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-onafter-november-2-2026>
- FIRMS, list of yearly files by country: <https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt>
- CONABIO SATIF: <https://incendios.conabio.gob.mx> · SPPIF: <https://forestales.ujed.mx/incendios2/>
- 2026 burning calendar: <https://yucatan.heraldodemexico.com.mx/local/2026/3/2/quemas-agricolas-2026-fechas-municipios-con-autorizacion-en-yucatan-mapa-4389.html>
  and <https://elcronistayucatan.mx/2026/04/14/merida-define-periodo-de-quemas-agricolas-del-20-de-abril-al-31-de-mayo-de-2026/>
- 2025 burning calendar with lists by zone: <https://www.yucatan.com.mx/yucatan/2025/03/06/calendario-de-quemas-2025-en-yucatan-fechas-y-municipios-autorizados.html>
- Special Civil Protection Program 2026 (Yucatán): <https://www.yucatan.gob.mx/docs/procivy/archivos/programa_especial_de_proteccion_civil_2026.pdf>
- Civil Protection and SEDER (gathered by Leo; APA references in `docs/es/campo-y-datos-pc-seder.pdf`):
  Quadratín, "Recibe Procivy 19 reportes diarios de incendios" (Mar 24, 2023): <https://yucatan.quadratin.com.mx/?p=271037>;
  Diario de Yucatán, "Península de Yucatán, con 98 incendios forestales" (Daniel Valdez Cetz, Jan 12, 2026): <https://www.yucatan.com.mx/mexico/2026/01/12/peninsula-de-yucatan-con-98-incendios-forestales.html>;
  Diario de Yucatán, "Temporada de quemas 2024 en Yucatán: Fechas, requisitos y recomendaciones" (Emanuel Rincón Becerra, Feb 26, 2024): <https://www.yucatan.com.mx/merida/2024/02/26/temporada-de-quemas-2024-en-yucatan-fechas-requisitos-y-recomendaciones.html>;
  Posta, "Estas son las razones por las cuales Yucatán es afectado por los incendios forestales" (Adity Cupil, Apr 3, 2025): <https://www.posta.com.mx/yucatan/estas-son-las-razones-por-las-cuales-yucatan-es-afectado-por-los-incendios-forestales-/vl2020641>;
  Por Esto, "Incendio consume más de 35 hectáreas en Sucopó, Tizimín" (Raquel Margarita Huerta, May 18, 2021): <https://www.poresto.com/yucatan/2021/5/18/incendio-consume-mas-de-35-hectareas-en-sucopo-tizimin.html>;
  Por Esto, "Incendio acaba con 15 hectáreas del 'oro verde' en Oxkutzcab" (Carlos Ek, Jaime Tun and Roberto Hernández, Apr 21, 2022): <https://www.poresto.com/yucatan/2022/4/21/incendio-acaba-con-15-hectareas-del-oro-verde-en-oxkutzcab.html>;
  Diario de Yucatán, "Alarma en Umán por incendio cerca de dos fraccionamientos" (Carolina Uc Quintal, Mar 25, 2025): <https://www.yucatan.com.mx/yucatan/2025/03/25/alarma-en-uman-incendio-cerca-de-dos-fraccionamientos.html>;
  Por Esto, "Quemas agrícolas y calor extremo elevan riesgo de incendios en Yucatán" (José Borges, Apr 6, 2026): <https://www.poresto.com/yucatan/2026/4/6/quemas-agricolas-y-calor-extremo-elevan-riesgo-de-incendios-en-yucatan.html>;
  Por Esto, "Instalan el Comité del Programa de Prevención y Combate de Incendios Agrícolas y Forestales en Yucatán" (Omar Xool, Feb 26, 2026): <https://www.poresto.com/yucatan/merida/2026/2/26/instalan-el-comite-del-programa-de-prevencion-y-combate-de-incendios-agricolas-y-forestales-en-yucatan.html>.
- geoBoundaries, municipalities of Mexico (CC BY 4.0): <https://www.geoboundaries.org>
- List of the 106 municipalities of Yucatán: Wikipedia, "Anexo:Municipios de Yucatán".
- NASA Earthdata, FIRMS and its latency: <https://www.earthdata.nasa.gov/learn/articles/nasa-firms-helps-fight-wildland-fires-in-near-real-time>
  and FIRMS one-pager (2022): <https://wiki.earthdata.nasa.gov/download/attachments/2228234/FIRMS_One%20Pager_2022_Prnt-Web.pdf?api=v2>
- FIRMS email alerts (how to subscribe): <https://wildfiretoday.com/?p=758>
  and NASA Earth Observatory, "Fire Alerts Go Global": <https://earthobservatory.nasa.gov/Features/FireAlerts/fire_alerts2.php>
