const RANGES = {
	all: { x: [-310000, 2040], title: "300,000 BCE – today" },
	agriculture: { x: [-10800, 2040], title: "10,000 BCE – today" },
	ce: { x: [-40, 2040], title: "1 CE – today" },
	modern: { x: [1800, 2028], title: "1800 – today" },
};

let payload = null;
let currentRange = "ce";

function formatAxisYear(year) {
	if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`;
	if (year === 0) return "1 CE";
	return String(year);
}

function tickYears(rangeKey) {
	if (rangeKey === "all") {
		return [-300000, -100000, -50000, -10000, 1, 1000, 1800, 2026];
	}
	if (rangeKey === "agriculture") {
		return [-10000, -5000, 1, 1000, 1500, 1800, 1900, 2000, 2026];
	}
	if (rangeKey === "ce") {
		return [1, 500, 1000, 1500, 1800, 1900, 1950, 2000, 2026];
	}
	return [1800, 1850, 1900, 1950, 1970, 1990, 2000, 2010, 2020, 2026];
}

function logAxisForVisible(data, xRange) {
	const values = [...data.paleolithic, ...data.historical]
		.filter((d) => d.year >= xRange[0] && d.year <= xRange[1])
		.map((d) => d.population);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const pad = 0.06;
	const yMin = Math.log10(min) - pad;
	const yMax = Math.log10(max) + pad;
	const candidates = [
		1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8,
		1e9, 2e9, 3e9, 4e9, 5e9, 6e9, 8e9, 1e10,
	];
	const tickvals = candidates.filter((v) => {
		const logv = Math.log10(v);
		return logv >= yMin && logv <= yMax;
	});
	return {
		range: [yMin, yMax],
		tickvals,
		ticktext: tickvals.map(formatPopTick),
	};
}

function renderStats(data) {
	const cards = [
		[data.start.population_label, "Early Homo sapiens", data.start.year_label],
		[data.agriculture.population_label, "Start of agriculture", data.agriculture.year_label],
		[data.today.population_label, "World population today", String(data.today.year)],
		[
			(data.today.population / data.start.population).toLocaleString(undefined, { maximumFractionDigits: 0 }) + "×",
			"Growth since origins",
			"on a log chart it is still a late spike",
		],
	];
	const root = document.getElementById("stats");
	root.hidden = false;
	root.innerHTML = cards.map(([value, label, note]) => `
		<article class="stat">
			<div class="label">${label}</div>
			<div class="value">${value}</div>
			<div class="note">${note}</div>
		</article>
	`).join("");
}

function renderMilestones(data) {
	document.getElementById("milestone-rows").innerHTML = data.milestones.map((row) => `
		<tr>
			<td class="num">${row.year_label}</td>
			<td class="num">${row.population_label}</td>
			<td><strong>${row.title}</strong><br>${row.detail}</td>
		</tr>
	`).join("");
	document.getElementById("source-list").innerHTML =
		data.sources.map((text) => `<p>${text}</p>`).join("");
}

function themeColor(name) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawChart(data, rangeKey) {
	const range = RANGES[rangeKey];
	const yAxis = logAxisForVisible(data, range.x);
	const ticks = tickYears(rangeKey);
	drawLogChart(document.getElementById("chart"), {
		title: `World population (log people, inverse-log time) · ${range.title}`,
		xRange: range.x,
		yRange: yAxis.range,
		presentYear: data.today.year,
		xTicks: ticks.map((value) => ({ value, text: formatAxisYear(value) })),
		yTicks: yAxis.tickvals.map((value, i) => ({ value, text: yAxis.ticktext[i] })),
		series: [
			{
				name: "Paleolithic estimates",
				color: themeColor("--meta-color"),
				dashed: true,
				markers: true,
				width: 2,
				points: data.paleolithic,
			},
			{
				name: "Historical series",
				color: themeColor("--primary-color"),
				width: 2.4,
				points: data.historical,
			},
		],
		annotations: data.milestones.filter(
			(m) => m.year >= range.x[0] && m.year <= range.x[1],
		),
	});
}

document.querySelectorAll("button.range").forEach((button) => {
	button.addEventListener("click", () => {
		currentRange = button.dataset.range;
		document.querySelectorAll("button.range").forEach((other) => {
			other.setAttribute("aria-pressed", other === button ? "true" : "false");
		});
		if (payload) drawChart(payload, currentRange);
	});
});

function load() {
	const status = document.getElementById("status");
	payload = window.WORLDPOP;
	if (!payload) {
		status.textContent = "Population data file is missing. Run python3 build.py.";
		status.classList.add("error");
		return;
	}
	renderStats(payload);
	renderMilestones(payload);
	drawChart(payload, currentRange);
	const fetched = new Date(payload.fetched_at).toUTCString();
	status.textContent = `${payload.historical.length} historical points plus ${payload.paleolithic.length} paleolithic estimates. Built ${fetched}.`;
	status.classList.remove("error");
}

load();
window.addEventListener("resize", () => {
	if (payload) drawChart(payload, currentRange);
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
	if (payload) drawChart(payload, currentRange);
});
