from __future__ import annotations
import csv
import io
import re
import urllib.request
from datetime import datetime, timezone

OWID_URL = (
	"https://ourworldindata.org/grapher/population.csv?v=1&csvType=filtered&useColumnShortNames=false&country=~OWID_WRL"
)
WORLDOMETER_URL = (
	"https://www.worldometers.info/world-population/world-population-by-year/"
)
USER_AGENT = (
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15"
)

# Midpoints of published census-size ranges. Uncertainty is about an order
# of magnitude. Wikipedia, "Estimates of historical world population".
PALEOLITHIC = [
	{"year": -300_000, "population": 200_000, "label": "Early Homo sapiens"},
	{"year": -100_000, "population": 800_000, "label": "African hunter-gatherers"},
	{"year": -50_000, "population": 1_500_000, "label": "Upper Paleolithic expansion"},
	{"year": -25_000, "population": 3_000_000, "label": "Last Glacial Maximum"},
	{"year": -12_000, "population": 4_000_000, "label": "Late Pleistocene"},
]

# Used only if Worldometer HTML cannot be parsed after a successful OWID fetch.
FALLBACK_RECENT = [
	(2024, 8_161_972_572),
	(2025, 8_231_613_070),
	(2026, 8_300_678_395),
]


def _get(url: str) -> str:
	request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
	with urllib.request.urlopen(request, timeout=45) as response:
		return response.read().decode("utf-8", errors="replace")


def fetch_owid() -> list[dict]:
	text = _get(OWID_URL)
	rows: list[dict] = []
	for row in csv.DictReader(io.StringIO(text)):
		year = int(row["Year"])
		population = int(float(row["Population"]))
		rows.append(
			{
				"year": year,
				"population": population,
				"source": _source_for_year(year),
			}
		)
	rows.sort(key=lambda item: item["year"])
	if not rows:
		raise RuntimeError("Our World in Data returned no world population rows")
	return rows


def fetch_worldometer_recent(min_year: int) -> list[dict]:
	html = _get(WORLDOMETER_URL)
	found: list[dict] = []
	for year_s, pop_s in re.findall(
		r"<td[^>]*>\s*(20\d{2})\s*</td>\s*<td[^>]*>\s*([\d,]+)\s*</td>",
		html,
	):
		year = int(year_s)
		if year >= min_year:
			found.append(
				{
					"year": year,
					"population": int(pop_s.replace(",", "")),
					"source": "Worldometer (UN WPP 2024, medium variant)",
				}
			)
	found.sort(key=lambda item: item["year"])
	return found


def _source_for_year(year: int) -> str:
	if year < 1800:
		return "HYDE v3.3 via Our World in Data"
	if year < 1950:
		return "Gapminder v7 via Our World in Data"
	return "UN World Population Prospects 2024 via Our World in Data"


def format_year(year: int) -> str:
	if year < 0:
		return f"{abs(year):,} BCE"
	if year == 0:
		return "1 CE"
	return f"{year} CE" if year < 1000 else str(year)


def format_population(value: int) -> str:
	if value >= 1_000_000_000:
		n = value / 1_000_000_000
		return f"{n:.2f} billion".replace(".00", "")
	if value >= 1_000_000:
		n = value / 1_000_000
		formatted = f"{n:.2f}".rstrip("0").rstrip(".")
		return f"{formatted} million"
	if value >= 1_000:
		n = value / 1_000
		formatted = f"{n:.1f}".rstrip("0").rstrip(".")
		return f"{formatted} thousand"
	return f"{value:,}"


def _nearest(rows: list[dict], year: int) -> dict:
	return min(rows, key=lambda item: abs(item["year"] - year))


def build_payload() -> dict:
	historical = fetch_owid()
	latest = historical[-1]["year"]
	try:
		recent = fetch_worldometer_recent(latest + 1)
	except Exception:
		recent = []
	if not recent:
		recent = [
			{
				"year": year,
				"population": population,
				"source": "Worldometer (UN WPP 2024, medium variant)",
			}
			for year, population in FALLBACK_RECENT
			if year > latest
		]
	historical.extend(recent)

	paleolithic = [
		{
			**point,
			"source": "Paleoanthropology census estimates (Wikipedia compilation)",
			"year_label": format_year(point["year"]),
			"population_label": format_population(point["population"]),
		}
		for point in PALEOLITHIC
	]
	for row in historical:
		row["year_label"] = format_year(row["year"])
		row["population_label"] = format_population(row["population"])

	today = historical[-1]
	agriculture = _nearest(historical, -10_000)
	year_one = _nearest(historical, 1)
	one_billion = _nearest(historical, 1804)
	two_billion = _nearest(historical, 1927)
	eight_billion = _nearest(historical, 2022)

	milestones = [
		{
			"year": paleolithic[0]["year"],
			"population": paleolithic[0]["population"],
			"title": "Early Homo sapiens",
			"detail": "Census-size estimate at the origin of anatomically modern humans.",
		},
		{
			"year": agriculture["year"],
			"population": agriculture["population"],
			"title": "Agriculture begins",
			"detail": "HYDE estimate at the dawn of farming.",
		},
		{
			"year": year_one["year"],
			"population": year_one["population"],
			"title": "Year 1 CE",
			"detail": "Classical antiquity; estimates around this date vary by tens of percent.",
		},
		{
			"year": one_billion["year"],
			"population": one_billion["population"],
			"title": "First billion",
			"detail": "Reached after roughly 300,000 years of human history.",
		},
		{
			"year": two_billion["year"],
			"population": two_billion["population"],
			"title": "Second billion",
			"detail": "The second billion took about 123 years.",
		},
		{
			"year": eight_billion["year"],
			"population": eight_billion["population"],
			"title": "Eight billion",
			"detail": "UN WPP 2024 timing, first half of 2022.",
		},
		{
			"year": today["year"],
			"population": today["population"],
			"title": "Today",
			"detail": "Latest figure in the combined series.",
		},
	]
	for item in milestones:
		item["year_label"] = format_year(item["year"])
		item["population_label"] = format_population(item["population"])

	return {
		"fetched_at": datetime.now(timezone.utc).isoformat(),
		"today": today,
		"start": paleolithic[0],
		"agriculture": agriculture,
		"paleolithic": paleolithic,
		"historical": historical,
		"milestones": milestones,
		"sources": [
			"Our World in Data long-run population: HYDE v3.3 (to 1799), Gapminder v7 (1800–1949), UN World Population Prospects 2024 (from 1950).",
			"Worldometer elaboration of UN WPP 2024 medium variant for years after the OWID series ends.",
			"Paleolithic census sizes from Wikipedia, Estimates of historical world population (early Homo sapiens ~100,000–300,000 people).",
		],
	}