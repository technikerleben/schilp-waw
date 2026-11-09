#!/usr/bin/env python3
"""Liest den SchiLP Hauswirtschaft (PDF in quellen/) aus und erzeugt src/hw-data.js.
Alle HW-Inhalte werden wörtlich übernommen – nichts wird ergänzt.
Aufruf: python3 tools/extract_hw.py quellen/<HW-PDF>.pdf"""
import json, re, subprocess, sys
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF = Path(sys.argv[1])

# ---------- Text-Hilfen ----------
KEEP_HYPHEN_BEFORE = {"und", "oder", "bzw.", "sowie"}
def join_lines(lines):
    out = ""
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        if not out:
            out = ln
        elif out.endswith("-") and not out.endswith(" -"):
            first = ln.split()[0]
            if first in KEEP_HYPHEN_BEFORE:
                out = out + " " + ln
            elif first[:1].islower():
                out = out[:-1] + ln
            elif first.rstrip("“”\"'.,").isupper() and out[:-1].split()[-1].lstrip("„\"").isupper():
                out = out[:-1] + ln   # Silbentrennung in Großbuchstaben, z. B. TRAI-NING
            else:
                out = out + ln
        else:
            out = out + " " + ln
    return re.sub(r"\s+", " ", out).strip()

def bullets(lines, marks=("•", "-", "")):
    items, cur = [], []
    for ln in lines:
        s = ln.strip()
        if not s or re.fullmatch(r"\d{1,2}", s):
            continue
        if s[:1] in ("•", "-", "") and len(s) > 1:
            if cur: items.append(join_lines(cur))
            cur = [s[1:].strip()]
        else:
            cur.append(s)
    if cur: items.append(join_lines(cur))
    return [i for i in items if i]

def strip_lernenden(items):
    return [re.sub(r"^\.\.\.\s*", "", i) for i in items if not i.startswith("Die Lernenden")]

# ---------- Kopfteile der UV (Hochformatseiten) ----------
txt = subprocess.run(["pdftotext", "-layout", str(PDF), "-"], capture_output=True, text=True).stdout.split("\n")
starts = [i for i, l in enumerate(txt) if re.match(r"^Unterrichtsvorhaben [IV]+", l.strip())]
ids = ["hw7-1", "hw7-2", "hw8-1", "hw8-2", "hw9-1", "hw9-2", "hw10-1", "hw10-2", "hw10-3"]
jgnr = [(7, "I"), (7, "II"), (8, "I"), (8, "II"), (9, "I"), (9, "II"), (10, "I"), (10, "II"), (10, "III")]
assert len(starts) == 9, starts

def section(block, name, stops):
    out, on = [], False
    for l in block:
        s = l.strip()
        if s.startswith(name):
            on = True; rest = s[len(name):].strip(" :"); 
            if rest: out.append(rest)
            continue
        if on and any(s.startswith(x) for x in stops):
            break
        if on: out.append(l)
    return out

HEADS = ["Inhaltsfelder", "Schwerpunkte der Kompetenzentwicklung", "Ergänzend Wirtschaft", "Inhaltliche Schwerpunkte", "Einbindung in den MKR", "Zeitbedarf"]
uvs = []
for k, st in enumerate(starts):
    end = next(i for i in range(st, len(txt)) if txt[i].strip().startswith("Zeitbedarf"))
    block = [l for l in txt[st:end + 1] if not re.fullmatch(r"\s*\d{1,2}\s*", l)]
    # Titel: Zeilen nach "Unterrichtsvorhaben X" bis "Inhaltsfelder"
    ti = []
    for l in block[1:]:
        if l.strip().startswith("Inhaltsfelder"): break
        if l.strip(): ti.append(l.strip())
    title = join_lines(ti)
    ifs = [join_lines([l]) for l in section(block, "Inhaltsfelder", HEADS[1:]) if l.strip()]
    komp = strip_lernenden(bullets(section(block, "Schwerpunkte der Kompetenzentwicklung", HEADS[2:])))
    wi = strip_lernenden(bullets(section(block, "Ergänzend Wirtschaft", HEADS[3:])))
    inh = section(block, "Inhaltliche Schwerpunkte", HEADS[4:])
    hw_i, wi_i, cur = [], [], None
    for l in inh:
        s = l.strip()
        if s.startswith("Bereich Hauswirtschaft"): cur = hw_i; continue
        if s.startswith("Bereich Wirtschaft"): cur = wi_i; continue
        if cur is not None: cur.append(l)
    mkr_lines = []
    for l in section(block, "Einbindung in den MKR", ["Zeitbedarf"]):
        s2 = l.strip()
        if s2.startswith(("Lernende ", "SuS ")): s2 = "- " + s2   # Zeilen ohne Spiegelstrich nach Seitenumbruch
        mkr_lines.append(s2)
    mkr = bullets(mkr_lines)
    zeit = re.sub(r"(\d)- (\d)", r"\1-\2", block[-1].strip().replace("Zeitbedarf:", "").strip().rstrip("."))
    uvs.append(dict(id=ids[k], jg=jgnr[k][0], nr=jgnr[k][1], titel=title, inhaltsfelder=ifs,
                    kompetenzen=komp, wirtschaft=wi, inhalteHW=bullets(hw_i), inhalteWi=bullets(wi_i), mkr=mkr, zeit=zeit))

# ---------- Sequenztabellen (Querformatseiten) ----------
pdf = pdfplumber.open(str(PDF))
groups = {"hw7-1": [9, 10], "hw7-2": [12, 13], "hw8-1": [15, 16], "hw8-2": [18, 19], "hw9-1": [21, 22],
          "hw9-2": [25, 26], "hw10-1": [29, 30], "hw10-2": [33, 34], "hw10-3": [36, 37]}
HDRS = ("Sequenzen/Themen/", "Fachdidaktische", "Konkretisierte", "Materialvor-", "Materialvorschläge")
def raw_sequences(pages):
    seqs, cols = [], None
    for pn in pages:
        p = pdf.pages[pn - 1]; ws = p.extract_words(); top = 30
        hdr = {w["text"]: w for w in ws if w["text"] in HDRS}
        if hdr:
            mat = hdr.get("Materialvor-") or hdr.get("Materialvorschläge")
            cols = [0, hdr["Fachdidaktische"]["x0"] - 6, hdr["Konkretisierte"]["x0"] - 6, mat["x0"] - 6, p.width]
            top = max(w["bottom"] for w in ws if w["top"] < hdr["Fachdidaktische"]["top"] + 30) + 2
        bottom = p.height - 25
        st = sorted([w for w in ws if w["text"] == "Sequenz" and w["x0"] < cols[1] and w["top"] > top - 2], key=lambda w: w["top"])
        bounds = [s["top"] - 2 for s in st]
        segs = []
        if not bounds or bounds[0] > top + 5: segs.append(("cont", top, bounds[0] if bounds else bottom))
        for i, b in enumerate(bounds): segs.append(("new", b, bounds[i + 1] if i + 1 < len(bounds) else bottom))
        for kind, y0, y1 in segs:
            cells = [(p.crop((cols[c], y0, cols[c + 1], y1)).extract_text() or "").strip() for c in range(4)]
            if kind == "new" or not seqs: seqs.append(cells)
            else: seqs[-1] = [(a + "\n" + b).strip() for a, b in zip(seqs[-1], cells)]
    return [s for s in seqs if re.match(r"\d\. Sequenz", s[0])]

def split_fach(text):
    hw, wi, cur = [], [], None
    for l in text.split("\n"):
        s = l.strip()
        if s.startswith("Hauswirtschaft:"): cur = hw; continue
        if s.startswith("Wirtschaft:"): cur = wi; continue
        if cur is None: cur = hw
        cur.append(l)
    return strip_lernenden(bullets(hw)), strip_lernenden(bullets(wi))

for uv in uvs:
    out = []
    for c1, c2, c3, c4 in raw_sequences(groups[uv["id"]]):
        lines = [l for l in c1.split("\n") if not re.fullmatch(r"\s*\d{1,2}\s*", l)]
        nr = lines[0].split(".")[0]
        body = lines[1:]
        zi = next((i for i, l in enumerate(body) if l.strip().startswith("Zeitumfang")), len(body))
        zeit = join_lines(body[zi:]).replace("Zeitumfang:", "").strip()
        body = body[:zi]
        ti = next((i for i, l in enumerate(body) if l.strip().startswith(("Themen", "Thema:"))), None)
        if ti is None:
            bi = next((i for i, l in enumerate(body) if l.strip().startswith("•")), len(body))
            titel, themen = join_lines(body[:bi]), bullets(body[bi:])
        else:
            titel, themen = join_lines(body[:ti]), bullets(body[ti + 1:])
        kHW, kWI = split_fach(c3)
        mHW, mWI = split_fach(c4)
        out.append(dict(nr=int(nr), titel=titel, themen=themen, zeit=zeit, ideen=bullets(c2.split("\n")),
                        kompHW=kHW, kompWI=kWI, matHW=mHW, matWI=mWI))
    uv["sequenzen"] = out

js = "/* AUTOMATISCH ERZEUGT aus dem SchiLP Hauswirtschaft (Stand 31.08.2026) mit tools/extract_hw.py.\n   Wörtliche Übernahme – bitte nicht von Hand ändern, sondern das PDF aktualisieren und neu erzeugen. */\n"
js += "const HW = " + json.dumps(uvs, ensure_ascii=False, indent=1) + ";\n"
(ROOT / "src" / "hw-data.js").write_text(js, encoding="utf-8")
print("hw-data.js:", len(uvs), "UV,", sum(len(u["sequenzen"]) for u in uvs), "Sequenzen")
