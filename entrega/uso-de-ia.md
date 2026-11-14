# Use of AI

Space Apps asks every team to say where and how it used AI, including in code and data. This
is our disclosure. It covers the whole project.

## Tools

- **Claude** (Anthropic), through Claude Code and claude.ai.
- **GitHub Copilot code review**, which left automatic comments on some pull requests.

TODO(Gadiel, Misa, Melany): add any other AI tool you used (ChatGPT, Gemini, Copilot in the
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
- **Code review.** GitHub Copilot added automatic comments to some pull requests.

## What each member did

| Member | Role | AI use |
|---|---|---|
| Guille (Ghosflot) | Coordination, the site and the submission | Claude, for research, analysis scripts, the site skeleton, the daily-update fix, mock-ups and document drafts |
| Gadiel (uicabg1) | Harmonization: the 1 km fire grid, the MODIS→VIIRS and NOAA-20 factors and the 25-year series (`pipeline/rejilla.py`, `armonizar.py`, `serie.py`, `cargar.py`) | Claude, to draft code and tests for the grid, the factors and the series, which he reviewed |
| Nico (Nicomoguel) | Validation and the provisional calendar (`pipeline/calendario_provisional.py`, `validar.py`) | Claude, for parts of the validation code. TODO(Nico): the provisional calendar |
| Leo (leosanlo30) | The site and the field data | Claude, for a redesign of the site and to write down the field notes |
| Misa (David-Alcocer) | Quality and publication: automated tests, the daily update and the README | TODO(Misa) |
| Melany (melanysuarezmagana) | Story and submission: the pitch script, the CONABIO review and the texts | TODO(Melany) |

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
