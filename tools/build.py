#!/usr/bin/env python3
"""Baut index.html aus src/template.html, src/style.css, src/data.js und src/app.js."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = root / "src"
html = (src / "template.html").read_text(encoding="utf-8")
html = html.replace("/*STYLE*/", (src / "style.css").read_text(encoding="utf-8"))
html = html.replace("/*HWDATA*/", (src / "hw-data.js").read_text(encoding="utf-8"))
html = html.replace("/*DATA*/", (src / "data.js").read_text(encoding="utf-8"))
html = html.replace("/*APP*/", (src / "app.js").read_text(encoding="utf-8"))
(root / "index.html").write_text(html, encoding="utf-8")
print(f"index.html geschrieben ({len(html)//1024} KB)")
