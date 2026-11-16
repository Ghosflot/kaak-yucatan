# Yucatán's countryside and fire: problem and solution

*Nov 14, 2026. Grounding of the problem for the pitch and for implementation. PDF version (in
Spanish): `docs/es/04-campo-y-fuego.pdf`. Our own figures are reproduced with
`analisis/campo_y_fuego.py`; the rest are in docs/01, "Yucatán's countryside".*

Spanish original: [docs/es/04-campo-y-fuego.md](es/04-campo-y-fuego.md).

**In short:** almost half of Yucatán is farmland, and that is where the fire is: the 10
municipalities with the most hot spots live off the milpa or cattle. The law requires each
municipality to authorize burns and evaluate its season, but it does so without data. K'áak' gives
each municipality **the fire calendar of its territory**: where and in which weeks it burns and
where fire has already escaped (14 years of VIIRS), and whether its season is worse than normal
(25 years of calibrated MODIS and VIIRS).

## 1. What the countryside means for Yucatán

| It represents | Verified fact | What it means |
|---|---|---|
| The territory | 42.3 % of the state is agricultural land use (INEGI, 2022 Agricultural Census) | Of every 10 hectares, 4 are farmland |
| The land that is planted | 306,991 ha of cropland in active units (INEGI, ENA 2025); the 2022 census gave 402,564 ha | About 300 thousand hectares of crops |
| The people | 58,036 active production units; 115,595 people work in them full time, 52,589 of them producers working their own unit, plus 57,273 seasonal jobs (INEGI 2022) | More than 115 thousand people work in the countryside full time |
| Identity | 96 of every 100 producers consider themselves indigenous (INEGI 2022) | The milpa is the Maya way of working the land |
| The raw material of food | White maize, main annual crop (47.5 thousand t); cultivated pasture, main perennial (946.1 thousand t); 381,535 cattle, 1.6 million pigs and 38 million birds in production units (388,399 cattle counting backyard ones); 8.4 thousand liters of milk a day (INEGI 2022) | Tortillas, meat, milk and livestock feed come from that land |
| The money that comes in | Beef was Yucatán's 2nd export in 2023: 329 million dollars (Secretaría de Economía) | Yucatán's cattle is sold to the world |
| Growth | The primary sector grew 9.3 % in the first half of 2025, the largest increase since 2004 (Por Esto, with INEGI data) | It is a living sector |
| Fragility | 81.3 % of cropland is rain-fed; only 2 % of units got credit; 50.7 % of producers only finished primary school (INEGI 2022) | If a harvest is lost, there is nothing to recover with |
| The risk | 46 % of wildfires started from farm activities (220 of 481); 204 from burning to prepare planting (CONAFOR 2015–2024) | The tool that feeds people can also burn everything |

## 2. Where the fire is: the top 10 live off the land

The 10 municipalities with the most hot spots (VIIRS S-NPP, 2012–2025) have agricultural
production: 9 live entirely off the land and Valladolid, partly. None is a city like Mérida.

| # | Municipality | Fire per year (grid cell-days) | Agricultural production | Population 2020 (municipal seat) | CONAFOR wildfires 2015–2024 (from farm activity) |
|---|---|---|---|---|---|
| 1 | Tizimín | 863 | Total. Meat, milk and cheese; the largest herd in the state (CICY) | 80,672 (52,593) | 65 (34) |
| 2 | Tekax | 423 | Total. Milpa | 45,062 (28,461) | 89 (42) |
| 3 | Yaxcabá | 347 | Total. Milpa | 16,350 (3,310) | 14 (9) |
| 4 | Chemax | 268 | Total. Maize and beans; cattle and pigs | 38,934 (17,502) | 58 (32) |
| 5 | Valladolid | 222 | Partial. Maize, vegetables and cattle, plus commerce and tourism | 85,460 (56,494) | 14 (9) |
| 6 | Peto | 214 | Total. Maize, beans, chili and watermelon; cattle and pigs | 25,954 (21,456) | 0 |
| 7 | Espita | 193 | Total. Maize and cattle | 16,779 (12,320) | 0 |
| 8 | Tzucacab | 185 | Total. Milpa | 15,346 (10,879) | 43 (38) |
| 9 | Buctzotz | 183 | Total. Cattle ranching (CICY) | 9,159 (7,973) | 0 |
| 10 | Panabá | 157 | Total. Cattle ranching | 7,766 (5,318) | 0 |

- **Two regions.** The cattle-ranching east (Tizimín, Espita, Buctzotz, Panabá) burns to open and
  renew pastures. The milpa south and center (Tekax, Yaxcabá, Peto, Tzucacab, Chemax) burns to
  plant.
- **They concentrate the problem.** Together they hold 44 % of the fire the satellite sees, 59 %
  of the state's wildfires (283 of 481) and 53 % of the hectares burned (35,524 of 67,512).
- **The cause is the countryside.** 58 % of their wildfires (164 of 283) started from farm
  activities, almost always from burning to prepare planting.
- **What only the satellite sees.** Peto, Espita, Buctzotz and Panabá have no recorded wildfire:
  their fire is agricultural burning and pasture burning, which does not enter the forest
  statistics.
- **Mérida, for comparison:** 19th in total fire and 77th of 106 per km²; none of its 6 CONAFOR
  wildfires came from farm activity. Per km², the ones that burn most are small milpa towns:
  Mayapán, Chacsinkín, Kantunil and Mama.

## 3. The problem

The municipality has a legal obligation to authorize burns and evaluate its season, but it doesn't
know where or when burning happens; when fire escapes, the people who lose are the ones who work
the land.

1. **The law obliges the municipality, but leaves it without data.** The Yucatán Law for the
   Prevention and Fighting of Fires (last amended in 2019):
    - the mayor authorizes each burn (art. 16);
    - the permit requires 3 m firebreaks and notice to neighbors 5 days ahead (art. 18);
    - at the end of the season, the municipality gives SEDER a report with improvement proposals
      (art. 23);
    - next year's calendar must take that evaluation into account (art. 25);
    - each municipality must set up a Municipal Committee (art. 39).
2. **What gets recorded looks nothing like what happens.** In 2023 there were 187 burning permits
   against 8,757 hot spots seen by the satellite: one permit for every 47 hot spots.
3. **The official window does not match when burning happens.** In the zones that burn every year,
   only 1 in 4 fires falls inside the official window for its zone (statewide, 19 % in 2025). The
   window says when burning is allowed, not when it is burned. In Muna it closes on April 3 and
   farmers start burning in April.
4. **There is nothing to compare with.** MODIS and VIIRS see between 3 and 5 times a different
   amount of fire. Without calibrating them, there is no long history to know what normal is.
5. **The losses fall on the people who work the land.** Oxkutzcab, 2022: a brush burn that got out
   of control destroyed 15 ha of Persian lime. Sucopó, Tizimín, 2021: a farmer burned alone and
   the fire damaged 3 plots and more than 35 ha, including his neighbors'. In 2024, 20,334 ha
   burned in the state, about 28,000 soccer fields. And these are people with no cushion: 8 in 10
   hectares depend on rain and only 2 in 100 production units got credit.

## 4. The solution: each municipality's fire calendar

**The calendar is the core of K'áak'.** It has two scales. For the municipality, the harmonized
MODIS and VIIRS series (25 years) says whether its season is going worse or better than normal,
week by week. For each zone, 14 years of VIIRS (2012–2025) say in which weeks it really burns,
against the official window; only VIIRS is used there because MODIS doesn't see small fires
(docs/02, task 6). It is the same calendar that Leo's grandfather carries in his head for his
plot, but for the whole municipality.

When you pick a municipality, its enlarged map opens:

| Layer | What it shows | What the municipality decides | When |
|---|---|---|---|
| **Calendar of each zone** | The 4 weeks in which each zone burns most, next to the official window | When to watch each zone and which dates to propose to SEDER | March to May, and at the close |
| Burning zones | Where it burns almost every year | Which zones to visit to promote permits, firebreaks and the owners' meeting | December to February |
| Escape zones | Where fire has already gotten out of control (fires of 5 days or more) | Where to put the heaviest surveillance | In season |
| Season close | The season against normal, the long fires and the real window against the official one | What to put in the art. 23 report | June |

**For whom:** the municipal Civil Protection office or whoever the mayor designates (art. 5,
section VI), with the Municipal Committee (art. 39). Farming municipalities first. Pilot: Tekax
for the evidence (21 long fires in 8 of 15 years) and Muna for the grandfather's story.

**Why it works** (`analisis/campo_y_fuego.py`):

- **In the burning zones, each zone's 4 historical weeks capture 49 % of the next year's fire; the
  official window, 23 %.** That is double, and it repeats every year (between 45 and 55 %, from
  2019 to 2025). In SEDER zones 1 and 2 the window lasts 46 and 42 days, longer than those 4
  weeks, and still captures less. It is measured in the burning zones, not on all the state's fire.
- The burning zones receive 46 % of next year's burning and cover 23.5 % of the land.
- Fires of 5 days or more separate the bad years: 40 in 2024 against 1 to 9 in a normal year. They
  coincide with a CONAFOR wildfire 31 % of the time; those of 3 days, 8 %.
- 22 of 79 fires of 5 days or more (2019–2025) started within 2 km of one from earlier years, in a
  strip that is 6 % of the land (without 2024: 7 of 39).

**What it does not do:** it does not predict wildfires, it does not warn in real time (it arrives
hours after the satellite pass) and it does not identify plots or people: a grid cell is 1 km wide
and covers many.

**What is already on the site (Nov 15):** of the four layers, the site has the burning zones, in
each municipality's "Where does {municipality} burn?" section. Instead of the 4-week calendar, it
gives the week with the most fire in a normal year in each municipality and, in each zone, how
much fire falls outside the official window. The escape zones and the closing sheet are still
pending (the status of each task is in section 6).

## 5. Countryside block for the pitch

About 50 seconds, between "The grandfather" and "The problem, at the scale of the state" in the
3-minute version (docs/03-script.md, "Countryside block"). To avoid running over time, say only the
first and last sentence of each paragraph.

**What the countryside is.** In Yucatán, 4 of every 10 hectares are farmland. More than 115
thousand people work there full time, and more than 9 in 10 producers consider themselves
indigenous. That land produces the raw material of what we eat: the maize for tortillas, the
cattle's pasture, milk, citrus and meat, which is the second product Yucatán sells abroad the most.

**Where the fire is.** We reviewed the 10 municipalities with the most fire in the state. All 10
live off the land: the cattle-ranching east, like Tizimín, Panabá and Buctzotz, and the milpa
south, like Tekax, Yaxcabá and Peto. None is a city like Mérida. Those 10 municipalities hold
almost 6 of every 10 wildfires in the state.

**Why prevent.** To plant, people burn: it is their work tool. But when fire escapes, the ones who
lose are the same people who work the land. In Oxkutzcab, a brush burn that got out of control
destroyed 15 hectares of Persian lime. And these are people with nothing to recover with: 8 in 10
hectares depend on rain, and only 2 in 100 production units got credit.

**Conclusion.** Preventing a wildfire in Yucatán is not only caring for the forest. It is caring
for the work and the food of the people of the countryside, the vast majority of whom consider
themselves indigenous, and for the raw material of the state's whole food chain.

**The calendar, in one sentence:** "In the zones that burn every year, only 1 in 4 fires falls
inside the official window; half fall in 4 weeks that repeat year after year. That helps SEDER and
the municipalities plan."

**In one line:** K'áak' tells each municipality in Yucatán where and in which weeks its territory
burns, using NASA satellite data, so it can prevent wildfires in the right place and at the right
time.

## 6. Implementation plan

| # | Task | Effort | Done when |
|---|---|---|---|
| 1 | Problem and pitch with the municipality as the user and the countryside block | Low | docs/03 has the block and each figure comes from docs/01 |
| 2 | **Calendar of each zone**: the 4 strongest historical weeks of each patch, next to the official window | Medium | Each patch of Tekax shows its weeks; the forward test gives close to 49 % |
| 3 | Enlarged map with burning zones: grid cells with fire in 4 or more of 14 seasons, in ranked patches | Medium | Picking Tekax shows its patches and the top 5 with coordinates |
| 4 | Escape-zone layer: connected fires of 5 days or more, with a 2 km strip | Low | Tekax 2024 shows its long fires over the 2012–2023 zones |
| 5 | Filter fixed heat sources in recent hot spots (cells FIRMS marked type 2) | Low | We know whether Mérida's 3 out-of-season long fires are fixed sources |
| 6 | Closing sheet for the art. 23 report, from the municipality card | Medium | The sheet fits on one page and is shared over WhatsApp |
| 7 | Move the calculations of `analisis/campo_y_fuego.py` into the pipeline | Medium | The page shows the same figures as the script |
| 8 | Show it to one person: the ejido commissioner of Muna or Tekax Civil Protection | Variable | A sentence from them for the pitch |
| 9 | After the hackathon: INEGI localities and land use; repeat the tests with NOAA-20 | Medium | Each patch names its nearest locality |

**Status of each task at the end of the hackathon (Nov 15):**

1. Done.
2. Done differently: the site gives the week with the most fire in a normal year in each
   municipality and, in each zone, how much fire fell outside the window each year. The 4 weeks
   of each patch are still pending.
3. Done differently: "Where does {municipality} burn?" shows the grid cells with fire in 5 or
   more of the 14 seasons, each with its link to Google Maps, without grouping them into patches.
4. Pending.
5. Done: the cells FIRMS marked as a fixed source (type 2) are left out of the calculation.
6. Pending. Today the site gives each municipality's card for WhatsApp.
7. In part: `pipeline/exportar_web.py` already calculates the cells where fire repeats and the
   fire outside the window; the 4 weeks and the long fires, not yet.
8. Pending.
9. Pending.

## 7. What not to say

| Don't say | Why |
|---|---|
| "Agriculture is the second sector of the economy" or "63 % of the food economy" | We found no source |
| "Half a million agricultural hectares" | It is 300 to 436 thousand, depending on the source |
| "Farmland fell 24 % since 2022" | The census and the survey measure differently |
| "80 % of burns are illegal" | Outside the window is not illegal |
| "We predict wildfires" or "real time" | It is not what it does |
| "SEDER is wrong" or "the official calendar hits 1 in 4" | The window says when burning is allowed; it doesn't try to guess when there is fire |
| "25 years" for each zone's calendar | It is 14 years of VIIRS; the 25 years are the municipality's harmonized series |
| "Maya indigenous people" or "Maya families" | INEGI says producers "consider themselves indigenous" |
| "The challenge asks for a calendar" | We couldn't open the challenge page to confirm it; the calendar is how K'áak' uses harmonization |

Limits and pending items: in docs/01, "Yucatán's countryside" and "Pending verification".
