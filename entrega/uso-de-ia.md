# Use of AI

Space Apps asks every team to say where and how it used AI, including in code and data. This
is our disclosure. It covers the whole project.

## Tools

- **Claude** (Anthropic), through Claude Code and claude.ai.
- **GitHub Copilot code review**, which left automatic comments on some pull requests.

TODO(Gadiel): add any other AI tool you used (ChatGPT, Gemini, Copilot in the
editor, Perplexity…) and what for.

## What the AI did

- **Research.** Claude searched for and read sources: the FIRMS and CONAFOR archives, the
  official burning calendar of Yucatán, NOAA notices about S-NPP and the CONABIO fire portal.
  It also drafted the analysis scripts in `analisis/` that reproduce our figures, including
  the cross-check against CONAFOR fire records (`analisis/cruce_conafor.py`).
- **Code.** Claude drafted parts of the code, and a team member reviewed each part:
  - the skeleton of the site (`web/`) and the export of data to it
    (`pipeline/exportar_web.py`);
  - the fix to the daily update after the FIRMS API changed its limits
    (`pipeline/actualizar_diario.py`);
  - the input contracts and shared metrics of the validation (`pipeline/validar.py`);
  - a redesign of the site in a separate branch.
- **Writing.** Claude drafted planning documents in `docs/`, which the team then edited.
- **Design.** Claude produced HTML mock-ups of the site. The team chose the direction and
  discarded most of the proposals.
- **Code review.** GitHub Copilot added automatic comments to some pull requests. Claude
  helped review pull requests and draft review comments; a team member checked each finding
  before posting it.

## What each member did

| Member | Role | AI use |
|---|---|---|
| Guille (Ghosflot) | Coordination, the site and the submission | Claude, for research, analysis scripts, the site skeleton, the daily-update fix, mock-ups and document drafts |
| Gadiel (uicabg1) | Harmonization: the 1 km fire grid, the MODIS→VIIRS and NOAA-20 factors and the 25-year series (`pipeline/rejilla.py`, `armonizar.py`, `serie.py`, `cargar.py`) | Claude, to draft code and tests for the grid, the factors and the series, which he reviewed |
| Nico (Nicomoguel) | Validation: the four tests of the harmonization, their pass criteria and how the site reports them (`pipeline/validar.py`), and the provisional calendar (`pipeline/calendario_provisional.py`) | Built the validation code and its tests with Claude Code as a coding assistant, and reviewed every part of it. Claude drafted the charts, a literature review on how to report results without overstating them, and drafts of the result sentences in Spanish and English. Nico set the pass criteria, checked the results against the data and edited the sentences. TODO(Nico): the provisional calendar |
| Leo (leosanlo30) | The site, the field data and the local problem: who burns in Yucatán, what the municipality must do by law, and the fire calendar of each zone (`docs/04-countryside-and-fire.md`) | Claude, for a redesign of the site, to write down the field notes, to research and summarise official sources (the INEGI agricultural census and survey, the state fire law, the Ministry of Economy), to draft the analysis script `analisis/campo_y_fuego.py`, and to draft `docs/04`, the new sections of `docs/01` and the countryside block of the pitch. Leo chose the focus (the municipality and the countryside), the questions, which findings to keep and every claim in the countryside block of the pitch |
| Misa (David-Alcocer) | Quality and publication: automated tests, the daily update and the README | Claude, to draft automated tests and the daily-update workflow, and to review pull requests and Actions runs and draft review comments. Misa reviewed every change and posted every review |
| Melany (melanysuarezmagana) | Story and submission: the pitch script, the CONABIO review and the texts | Claude, to research pitch techniques, check her pitch drafts against the verified facts in docs/01, help her shape her drafts into the structure of the 30-second version and translate it into English. Melany wrote the drafts, did the CONABIO review herself, chose what goes into the pitch and approved every change |

### Detail: Leo and the local problem

What Claude did:

- **Research.** It searched for and read the sources and summarised their figures for Leo: the
  INEGI Agricultural Census 2022 and National Agricultural Survey 2025, the Ministry of Economy
  export fact sheet, the Yucatán fire prevention law, the municipal profiles (the Spanish Wikipedia
  page of each municipality) and the CICY study on cattle ranching. It also flagged claims with no
  source, such as "agriculture is the second sector of the economy" or "63 %".
- **Analysis.** It drafted `analisis/campo_y_fuego.py`: connected fires, burn zones, the
  forward test of the calendar of each zone, escape zones, the top 10 municipalities and the
  causes of the CONAFOR fire records.
- **Writing.** It drafted `docs/04-countryside-and-fire.md` and its PDF, the new sections of `docs/01`
  and the countryside block of the pitch in `docs/03`.

What Leo decided:

- To focus the project on the municipality and municipal Civil Protection; he also proposed a
  zoomed map of each municipality.
- The angle of the pitch: what the countryside means for Yucatán, that most producers consider
  themselves indigenous, that it supplies the raw material for food, and that the top 10
  municipalities by fire are agricultural.
- Which figures went in and which did not; he asked to drop the ones without a source.
- The testimony of his grandfather in Muna, which comes from Leo's conversation with him, not
  from AI.

How it was checked:

- Every new figure is listed with its source in `docs/01`, and the script reproduces them.
- Misa (David-Alcocer) reviewed PR #59 with Claude, which ran the script and opened the sources,
  and requested six corrections (for example, 53,630 was the number of sheep, not of producers).
  They were fixed before the merge.

## What the AI did not do

- **It did not decide.** The team chose the challenge, the users (the state agriculture
  ministry, SEDER, and Civil Protection of Yucatán), the method (one satellite per period and
  a MODIS→VIIRS factor per burn zone and season) and the design of the site.
- **It is not the source of any figure.** Our rule is one figure, one source: every number in
  the pitch and on the site is listed with its source in `docs/01-hechos-verificados.md`, or
  comes from our own validation. We checked the figures that the AI found against the
  original data.
- **It did not choose how to judge the method.** The pass criteria of the validation were
  committed before the tests were run on real data, so nobody, human or AI, could fit the
  test to the result.
- **The field data** comes from conversations with farmers in Yucatán, not from AI.
- **No AI-generated images**, and no NASA logo.

## How we checked the AI's work

- Every change goes through a pull request, and automated tests (pytest) and a linter (ruff)
  run on each one.
- Every figure is checked against its source before it goes into the pitch.

TODO(all): check your row and the claims above before the submission.
