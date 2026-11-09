# SchiLP Wirtschaft und Arbeitswelt (WP) – HBG Dortmund

Gemeinsamer schulinterner Lehrplan für das Wahlpflichtfach **Wirtschaft und Arbeitswelt** (Hauswirtschaft, Technik, Wirtschaft)
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

- `src/hw-data.js` – Hauswirtschaft, **automatisch und wörtlich** aus dem SchiLP HW erzeugt:
  `python3 tools/extract_hw.py quellen/SchiLP_HW.pdf` (PDF liegt nur lokal, nicht im Repo)
- `src/data.js` – Technik-Entwurf, gemeinsame Kapitel (Rahmen, Leistung, Lehrwerke – mit Quellenkennzeichnung), Diskussionspunkte
- `src/app.js` – Darstellung, Navigation, Hervorhebungsfilter, Notizen
- `src/style.css` – HBG-SRL-Farbschema

Notizen und Bearbeitungsstände werden nur lokal im Browser gespeichert (localStorage)
und lassen sich als Markdown oder JSON exportieren bzw. importieren.

## Bedienung (Arbeitsversion 0.3)

- **Suche:** `Strg+K` oder `/` – durchsucht Vorhaben, Sequenzen, Kompetenzen, Materialien und Kapitel
- **Codes und Inhaltsfelder anklicken:** Seitenleiste mit Bedeutung und allen Fundstellen (funktioniert auch auf dem iPad)
- **Jahrgangsseiten:** Ansicht „Vorhaben“ mit mitlaufender Seitennavigation oder „Gegenüberstellung“ HW/Technik; Stundenbalken gegen den Rahmen von ca. 54 Std.
- **Kompakt/Detail**, Fachfilter, Hervorhebungen (Wirtschaft, BO, BNE, MKR, SRL)
- **Sitzungsmodus** (Reiter Sitzung): ein Punkt pro Bildschirm, Status per Klick, Zeitnahme, Protokoll als Markdown
- **Notizen:** pro Abschnitt und pro Sequenz; Name eintragen → Datei exportieren; Dateien anderer einlesen → deren Notizen erscheinen mit Namen an den passenden Stellen
- **🔗** kopiert einen Link auf Vorhaben, Sequenz oder Abschnitt; **←/→** wechselt die Reiter; **Drucken …** mit Kapitel- und Fachauswahl
