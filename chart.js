function formatPopTick(value) {
	if (value >= 1e9) return `${compactFigure(value / 1e9)}B`;
	if (value >= 1e6) return `${compactFigure(value / 1e6)}M`;
	if (value >= 1e3) return `${compactFigure(value / 1e3)}k`;
	return String(Math.round(value));
}

function compactFigure(n) {
	if (n >= 100) return String(Math.round(n));
	if (n >= 10) return String(+n.toFixed(1));
	return String(+n.toFixed(2));
}

function drawLogChart(container, spec) {
	const width = container.clientWidth || 900;
	const height = container.clientHeight || 560;
	const margin = { top: 44, right: 28, bottom: 64, left: 78 };
	const innerW = Math.max(40, width - margin.left - margin.right);
	const innerH = Math.max(40, height - margin.top - margin.bottom);
	const [x0, x1] = spec.xRange;
	const [y0, y1] = spec.yRange;
	const present = spec.presentYear ?? x1;

	const yearsAgo = (year) => Math.max(present - year, 0.25);
	const xWarp = (year) => -Math.log10(yearsAgo(year));
	const t0 = xWarp(x0);
	const t1 = xWarp(Math.min(x1, present));

	const xScale = (year) => margin.left + ((xWarp(year) - t0) / (t1 - t0)) * innerW;
	const yScale = (pop) => margin.top + ((y1 - Math.log10(pop)) / (y1 - y0)) * innerH;

	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", spec.title);

	const el = (name, attrs = {}) => {
		const node = document.createElementNS(svgNS, name);
		for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
		return node;
	};

	const label = (text, attrs) => {
		const node = el("text", attrs);
		node.textContent = text;
		return node;
	};

	svg.appendChild(el("rect", {
		x: 0, y: 0, width, height, fill: "#fffdf8",
	}));

	svg.appendChild(label(spec.title, {
		x: margin.left,
		y: 22,
		fill: "#44403c",
		"font-size": "14",
		"font-family": "Palatino, Georgia, serif",
	}));

	for (const tick of spec.yTicks) {
		const y = yScale(tick.value);
		svg.appendChild(el("line", {
			x1: margin.left, x2: margin.left + innerW, y1: y, y2: y,
			stroke: "#eee8dd",
		}));
		svg.appendChild(label(tick.text, {
			x: margin.left - 8,
			y: y + 4,
			fill: "#57534e",
			"font-size": "11",
			"text-anchor": "end",
			"font-family": "Segoe UI, Helvetica, sans-serif",
		}));
	}

	const xTickMarks = [];
	for (const tick of [...spec.xTicks].reverse()) {
		if (tick.value < x0 || tick.value > Math.min(x1, present)) continue;
		const x = xScale(tick.value);
		if (x < margin.left - 4 || x > margin.left + innerW + 4) continue;
		if (xTickMarks.some((mark) => Math.abs(mark.x - x) < 42)) continue;
		xTickMarks.push({ ...tick, x });
	}

	for (const tick of xTickMarks) {
		const x = tick.x;
		svg.appendChild(el("line", {
			x1: x, x2: x, y1: margin.top, y2: margin.top + innerH,
			stroke: "#f3eee4",
		}));
		svg.appendChild(label(tick.text, {
			x,
			y: margin.top + innerH + 18,
			fill: "#57534e",
			"font-size": "11",
			"text-anchor": "middle",
			"font-family": "Segoe UI, Helvetica, sans-serif",
		}));
	}

	svg.appendChild(el("line", {
		x1: margin.left, x2: margin.left + innerW,
		y1: margin.top + innerH, y2: margin.top + innerH,
		stroke: "#d6d3d1",
	}));
	svg.appendChild(el("line", {
		x1: margin.left, x2: margin.left,
		y1: margin.top, y2: margin.top + innerH,
		stroke: "#d6d3d1",
	}));

	const defs = el("defs");
	const clip = el("clipPath", { id: "plot-clip" });
	clip.appendChild(el("rect", {
		x: margin.left, y: margin.top, width: innerW, height: innerH,
	}));
	defs.appendChild(clip);
	svg.appendChild(defs);
	const plot = el("g", { "clip-path": "url(#plot-clip)" });
	svg.appendChild(plot);

	svg.appendChild(label("Year (inverse log — recent years expanded)", {
		x: margin.left + innerW / 2,
		y: height - 14,
		fill: "#44403c",
		"font-size": "12",
		"text-anchor": "middle",
	}));
	const yTitle = label("People", {
		x: 16,
		y: margin.top + innerH / 2,
		fill: "#44403c",
		"font-size": "12",
		"text-anchor": "middle",
		transform: `rotate(-90 16 ${margin.top + innerH / 2})`,
	});
	svg.appendChild(yTitle);

	const inView = (point) => point.year >= x0 && point.year <= x1;
	const visiblePoints = [];

	for (const series of spec.series) {
		const points = series.points.filter((p) => p.population > 0);
		if (points.length < 2) continue;
		const path = points.map((p, i) => {
			const cmd = i === 0 ? "M" : "L";
			return `${cmd}${xScale(p.year).toFixed(2)},${yScale(p.population).toFixed(2)}`;
		}).join(" ");
		plot.appendChild(el("path", {
			d: path,
			fill: "none",
			stroke: series.color,
			"stroke-width": series.width || 2.2,
			"stroke-dasharray": series.dashed ? "6 4" : "none",
			"stroke-linejoin": "round",
			"stroke-linecap": "round",
		}));
		if (series.markers) {
			for (const point of points.filter(inView)) {
				svg.appendChild(el("circle", {
					cx: xScale(point.year),
					cy: yScale(point.population),
					r: 3.5,
					fill: series.color,
				}));
			}
		}
		for (const point of points.filter(inView)) {
			visiblePoints.push({ ...point, color: series.color, series: series.name });
		}
	}

	for (const note of spec.annotations || []) {
		if (note.year < x0 || note.year > x1) continue;
		const x = xScale(note.year);
		const y = yScale(note.population);
		svg.appendChild(el("line", {
			x1: x, y1: y, x2: x + 14, y2: y - 22,
			stroke: "#a8a29e",
		}));
		const bg = el("rect", {
			x: x + 16,
			y: y - 34,
			rx: 2,
			fill: "rgba(255,253,248,0.92)",
		});
		const text = label(note.title, {
			x: x + 20,
			y: y - 20,
			fill: "#44403c",
			"font-size": "11",
		});
		svg.appendChild(bg);
		svg.appendChild(text);
		requestAnimationFrame(() => {
			const box = text.getBBox();
			bg.setAttribute("width", String(box.width + 8));
			bg.setAttribute("height", String(box.height + 4));
			bg.setAttribute("y", String(box.y - 2));
		});
	}

	let legendX = margin.left;
	const legendY = height - 36;
	for (const series of spec.series) {
		svg.appendChild(el("line", {
			x1: legendX, x2: legendX + 18, y1: legendY, y2: legendY,
			stroke: series.color,
			"stroke-width": 2.2,
			"stroke-dasharray": series.dashed ? "6 4" : "none",
		}));
		svg.appendChild(label(series.name, {
			x: legendX + 24,
			y: legendY + 4,
			fill: "#44403c",
			"font-size": "12",
		}));
		legendX += 28 + series.name.length * 7;
	}

	const hoverLine = el("line", {
		y1: margin.top, y2: margin.top + innerH, stroke: "#a8a29e", "stroke-width": "1", visibility: "hidden",
	});
	const hoverDot = el("circle", { r: 5, fill: "#1d4e89", visibility: "hidden" });
	svg.appendChild(hoverLine);
	svg.appendChild(hoverDot);

	const tooltip = document.createElement("div");
	tooltip.className = "chart-tooltip";

	const hit = el("rect", {
		x: margin.left,
		y: margin.top,
		width: innerW,
		height: innerH,
		fill: "transparent",
	});
	svg.appendChild(hit);

	const nearest = (t) => {
		let best = null;
		let bestDist = Infinity;
		for (const point of visiblePoints) {
			const dist = Math.abs(xWarp(point.year) - t);
			if (dist < bestDist) {
				best = point;
				bestDist = dist;
			}
		}
		return best;
	};

	hit.addEventListener("mousemove", (event) => {
		const bounds = svg.getBoundingClientRect();
		const scaleX = width / bounds.width;
		const px = (event.clientX - bounds.left) * scaleX;
		const t = t0 + ((px - margin.left) / innerW) * (t1 - t0);
		const point = nearest(t);
		if (!point) return;
		const x = xScale(point.year);
		const y = yScale(point.population);
		hoverLine.setAttribute("x1", x);
		hoverLine.setAttribute("x2", x);
		hoverLine.setAttribute("visibility", "visible");
		hoverDot.setAttribute("cx", x);
		hoverDot.setAttribute("cy", y);
		hoverDot.setAttribute("fill", point.color);
		hoverDot.setAttribute("visibility", "visible");
		tooltip.hidden = false;
		tooltip.innerHTML = `<strong>${point.year_label}</strong><br>${formatPopTick(point.population)}<br><em>${point.source}</em>`;
		const relX = event.clientX - container.getBoundingClientRect().left;
		tooltip.style.left = `${Math.min(relX + 12, container.clientWidth - 220)}px`;
		tooltip.style.top = `${event.clientY - container.getBoundingClientRect().top + 12}px`;
	});
	hit.addEventListener("mouseleave", () => {
		hoverLine.setAttribute("visibility", "hidden");
		hoverDot.setAttribute("visibility", "hidden");
		tooltip.hidden = true;
	});

	container.replaceChildren(svg, tooltip);
}

window.drawLogChart = drawLogChart;