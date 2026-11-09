# SchiLP Wirtschaft und Arbeitswelt (WP) – HBG Dortmund

Schulinterner Lehrplan für das Wahlpflichtfach **Wirtschaft und Arbeitswelt**, Teil **Technik**,
an der Heinrich-Böll-Gesamtschule Dortmund (Jahrgänge 7–10).

## Organisationsmodell

- 3 Wochenstunden pro Jahrgang (7–10)
- Schwerpunkthalbjahre im Wechsel: je 4 Halbjahre Technik und 4 Halbjahre Hauswirtschaft
- Doppelstunde: fachpraktischer Schwerpunkt (Technik bzw. Hauswirtschaft)
- Einzelstunde: Wirtschaftsthemen, mit dem jeweiligen Schwerpunkt verknüpft
- Kein eigenständiger Wirtschaftsunterricht
- Welches Halbjahr Technik ist, hängt von der Personalplanung ab → jedes Vorhaben ist in sich geschlossen

## Grundlagen

- Kernlehrplan WP Wirtschaft und Arbeitswelt (Gesamtschule NRW, Heft 31031)
- Lehrwerk Technik: *Blickpunkt Technik SI*, Westermann 2025
- Abstimmung mit dem SchiLP Hauswirtschaft (Stand 31.08.2026)

## Struktur

- `planung/` – Planungsstände und Entscheidungen
- `quellen/` – interne Ausgangsdokumente (nicht öffentlich eingecheckt)
- Ziel: interaktives HTML-Dokument mit Kompetenzrastern (SRL), Bezügen zu Berufsorientierung, BNE und MKR

## Arbeitsversion (index.html)

`index.html` ist eine eigenständige Seite (keine Abhängigkeiten) und wird über Vercel ausgeliefert.
Sie wird aus `src/` gebaut:

```
python3 tools/build.py
```

- `src/data.js` – alle Inhalte (Technik-Vorhaben, HW-Planung, Diskussionspunkte, Leistungsbewertung)
- `src/app.js` – Darstellung, Navigation, Hervorhebungsfilter, Notizen
- `src/style.css` – HBG-SRL-Farbschema

Notizen und Bearbeitungsstände werden nur lokal im Browser gespeichert (localStorage)
und lassen sich als Markdown oder JSON exportieren bzw. importieren.
