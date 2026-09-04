#!/usr/bin/env python3
from __future__ import annotations
import json
import re
import shutil
from pathlib import Path
from population import build_payload

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

def minify_css(src: str) -> str:
	src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
	src = re.sub(r"\s+", " ", src)
	src = re.sub(r"\s*([{}:;,>~+])\s*", r"\1", src)
	return src.strip()

def minify_js(src: str) -> str:
	out: list[str] = []
	i = 0
	n = len(src)
	while i < n:
		ch = src[i]
		nxt = src[i + 1] if i + 1 < n else ""
		if ch == "/" and nxt == "/":
			i = src.find("\n", i)
			if i < 0:
				break
			continue
		if ch == "/" and nxt == "*":
			end = src.find("*/", i + 2)
			i = n if end < 0 else end + 2
			continue
		if ch in {'"', "'", "`"}:
			quote = ch
			j = i + 1
			while j < n:
				if src[j] == "\\":
					j += 2
					continue
				if src[j] == quote:
					j += 1
					break
				j += 1
			out.append(src[i:j])
			i = j
			continue
		if ch.isspace():
			if out and not out[-1][-1].isspace():
				out.append(" ")
			i += 1
			continue
		out.append(ch)
		i += 1
	text = "".join(out)
	text = re.sub(r"\s*([=+\-*/%<>!&|^~?:;,.(){}[\]])\s*", r"\1", text)
	text = re.sub(r";}", "}", text)
	return text.strip()

def minify_html(src: str) -> str:
	def style_repl(match: re.Match[str]) -> str:
		return f"<style>{minify_css(match.group(1))}</style>"

	src = re.sub(r"<style>(.*?)</style>", style_repl, src, flags=re.S | re.I)
	src = re.sub(r"<!--.*?-->", "", src, flags=re.S)
	src = re.sub(r">\s+<", "><", src)
	src = re.sub(r"\s+", " ", src)
	return src.strip()

def write_minified(name: str) -> None:
	text = (ROOT / name).read_text(encoding="utf-8")
	if name.endswith(".js"):
		text = minify_js(text)
	elif name.endswith(".html"):
		text = minify_html(text)
	(DIST / name).write_text(text, encoding="utf-8")

def main() -> None:
	if DIST.exists():
		shutil.rmtree(DIST)
	DIST.mkdir()

	for name in ("index.html", "app.js", "chart.js"):
		write_minified(name)

	print("Fetching world population series…")
	payload = build_payload()
	compact = json.dumps(payload, separators=(",", ":"))
	(DIST / "population.json").write_text(compact + "\n", encoding="utf-8")
	(DIST / "population.js").write_text(
		"window.WORLDPOP=" + compact + ";",
		encoding="utf-8",
	)
	today = payload["today"]
	print(f"Wrote minified site to {DIST}")
	print(
		f"{len(payload['historical'])} historical points, "
		f"latest {today['year']}: {today['population_label']}"
	)

if __name__ == "__main__":
	main()