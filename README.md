# Worldpop

A static website that plots long-run world population estimates on a **logarithmic** chart from early *Homo sapiens* (~300,000 BCE) to today.

**Live preview:** [https://dev.msturm.com/worldpop/](https://dev.msturm.com/worldpop/)

The default view is **Since year 1**. Other ranges cover all of human history, the start of agriculture, and 1800–present.

## Build

Python 3 (standard library only) fetches the series from the web and compiles the site into `dist/`:

```bash
python3 build.py
```

`dist/` then contains minified `index.html`, `app.js`, `chart.js`, `population.js`, and compact `population.json`.

The build needs network access. `dist/` is generated output and is not committed.

## Preview locally

```bash
python3 build.py
python3 -m http.server 8000 --directory dist
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Deploy

Copy the contents of `dist/` to a static host. The live site is served from [https://dev.msturm.com/worldpop/](https://dev.msturm.com/worldpop/). Asset paths are relative, so the site works in a subdirectory.

## Data

| Period | Source |
| --- | --- |
| ~300,000–12,000 BCE | Paleoanthropology census-size estimates (highly uncertain; Wikipedia compilation) |
| 10,000 BCE–1799 | [HYDE v3.3](https://ourworldindata.org/population-sources) via Our World in Data |
| 1800–1949 | Gapminder v7 via Our World in Data |
| 1950–latest OWID year | [UN World Population Prospects 2024](https://population.un.org/wpp/) via Our World in Data |
| Years after OWID | [Worldometer](https://www.worldometers.info/world-population/world-population-by-year/) elaboration of UN WPP 2024 (medium variant) |

OWID world series: `https://ourworldindata.org/grapher/population.csv` (entity `World` / `OWID_WRL`).

Paleolithic figures are midpoints of published ranges (on the order of 100,000–300,000 people at sapiens origins). They are not census data.

## Layout

```
index.html          Page
app.js              Range buttons, stats, chart wiring
chart.js            Local SVG log-scale chart (no CDN JavaScript)
build.py            Fetch data and compile a minified site into dist/
population.py       Combine HYDE, Gapminder, UN, and paleolithic estimates
dist/               Generated static site (gitignored)
```
