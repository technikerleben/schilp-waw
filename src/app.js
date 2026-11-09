/* =========================================================================
   Gemeinsamer SchiLP WAW – Rendering und Interaktion
   HW-Inhalte stammen wörtlich aus src/hw-data.js (aus dem PDF erzeugt).
   Funktionen: Navigation, Suche, Seitenleiste für Codes, Stundenbalken,
   Gegenüberstellung, Kompaktansicht, Sitzungsmodus, Notizen (localStorage),
   Zusammenführen von Notizen, Links, Druckauswahl.
   ========================================================================= */
(function () {
  "use strict";

  /* =======================================================================
     Speicher (localStorage mit Fallback)
     ======================================================================= */
  const PREFIX = "schilp-waw:";
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(PREFIX + k); return v === null ? (mem[k] ?? "") : v; } catch (e) { return mem[k] ?? ""; } },
    set(k, v) { if (v === "" || v == null) delete mem[k]; else mem[k] = v; try { if (v === "" || v == null) localStorage.removeItem(PREFIX + k); else localStorage.setItem(PREFIX + k, v); } catch (e) { /* gesperrt */ } },
    all() {
      const out = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = localStorage.getItem(k); } } catch (e) { Object.assign(out, mem); }
      return out;
    },
  };

  /* =======================================================================
     Hilfen
     ======================================================================= */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
  const JGS = [7, 8, 9, 10];
  const FACH = { hw: "Hauswirtschaft", tc: "Technik" };
  const RAHMEN_STD = 54;
  const SRC = { hw: ["SchiLP Hauswirtschaft", "hw"], tc: ["SchiLP Technik (bisher)", "tc"], neu: ["Entwurf / Beschluss neu", "neu"], tcneu: ["Entwurf Technik", "neu"] };
  const src = (q) => `<span class="src ${SRC[q][1]}">${SRC[q][0]}</span>`;
  const notGiven = (txt) => `<p class="nicht">${esc(txt || "Im HW-Plan nicht ausgewiesen.")}</p>`;
  const spaced = (c) => c.replace(/^([A-Z]+)(\d+)$/, "$1 $2");

  /* Kompetenzcodes und MKR-Codes in Texten anklickbar machen (öffnet die Seitenleiste) */
  function linkify(text, fach) {
    let h = esc(text);
    if (fach) h = h.replace(/\((SK|MK|UK|HK)\s?(\d+)\)/g, (m, a, n) => `(<button class="code-link ${fach}" data-code="${fach}:${a}${n}">${a} ${n}</button>)`);
    h = h.replace(/MKR (\d\.\d)/g, (m, c) => `<button class="code-link mkr" data-code="mkr:${c}">MKR ${c}</button>`);
    return h;
  }
  const ul = (arr, fach) => arr && arr.length ? `<ul>${arr.map((x) => `<li>${linkify(x, fach)}</li>`).join("")}</ul>` : "";

  const chipWI = (n, opt) => `<button class="chip wi t-wi" data-code="wi:${n}" title="${esc(IF_WI[n].name)}">${opt ? "(" : ""}Wi IF ${n} · ${esc(IF_WI[n].kurz)}${opt ? ")" : ""}</button>`;
  const chipF = (fach, n) => fach === "hw"
    ? `<button class="chip hw" data-code="hwif:${n}" title="${esc(IF_HW[n])}">HW IF ${n}</button>`
    : `<button class="chip tc" data-code="tcif:${n}" title="${esc(IF_TC[n].name)}">TC IF ${n}</button>`;
  const codesOf = (arr) => [...new Set(arr.flatMap((s) => [...s.matchAll(/\((SK|MK|UK|HK)\s?(\d+)\)/g)].map((m) => m[1] + m[2])))];

  function parseHours(z) {
    const n = (String(z).match(/\d+/g) || []).map(Number);
    if (!n.length) return [0, 0];
    return [n[0], n[1] && n[1] > n[0] ? n[1] : n[0]];
  }

  /* =======================================================================
     Einheitliches Modell für beide Fächer
     ======================================================================= */
  function hwModel(h) {
    const fachIF = [], wiIF = [];
    h.inhaltsfelder.forEach((s) => {
      const m = s.match(/(Hauswirtschaft|Wirtschaft):\s*IF\s*(\d)/); if (!m) return;
      if (m[1] === "Hauswirtschaft") fachIF.push(+m[2]); else wiIF.push({ n: +m[2], opt: s.trim().startsWith("(") });
    });
    return {
      fach: "hw", id: h.id, jg: h.jg, label: `HW ${h.jg}.${h.nr}`, titel: h.titel, zeit: h.zeit, std: parseHours(h.zeit),
      ifText: h.inhaltsfelder, fachIF, wiIF,
      kompFach: h.kompetenzen, kompWi: h.wirtschaft, inhFach: h.inhalteHW, inhWi: h.inhalteWi, mkr: h.mkr, mkrCodes: [],
      sequenzen: h.sequenzen.map((s) => ({ nr: s.nr, titel: s.titel, themen: s.themen, zeit: s.zeit,
        ideen: [{ items: s.ideen }], kompFach: s.kompHW, kompWi: s.kompWI, matFach: s.matHW, matWi: s.matWI })),
      extras: null, quelle: "hw",
    };
  }
  function tcModel(t) {
    const ds = sum(t.sequenzen, "ds"), es = sum(t.sequenzen, "es");
    const kText = (c) => `${KLP_TC[c]} (${spaced(c)})`;
    return {
      fach: "tc", id: t.id, jg: t.jg, label: `TC ${t.jg}`, titel: t.titel, untertitel: t.untertitel, leitfrage: t.leitfrage,
      zeit: `ca. ${ds + es} Std. (${ds} Doppelstunde Technik + ${es} Einzelstunde Wirtschaft)`, std: [ds + es, ds + es], ds, es,
      ifText: [...t.tcIF.map((n) => `Technik: IF ${n} ${IF_TC[n].name}`), ...t.wiIF.map((n) => `Wirtschaft: IF ${n} ${IF_WI[n].name}`)],
      fachIF: t.tcIF, wiIF: t.wiIF.map((n) => ({ n, opt: false })),
      kompFach: t.kompetenzen.map(kText), kompWi: t.wiKompetenzen, inhFach: t.tcSP, inhWi: t.wiSP,
      mkr: t.mkr.map((m) => `${m.text} (MKR ${m.code})`), mkrCodes: t.mkr.map((m) => m.code),
      sequenzen: t.sequenzen.map((s, i) => ({ nr: i + 1, titel: s.titel, themen: [],
        zeit: [s.ds ? `${s.ds} Std. Technik` : "", s.es ? `${s.es} Std. Wirtschaft` : ""].filter(Boolean).join(" + "),
        ideen: [{ label: "Doppelstunde · Technik", items: s.praxis, cls: "" }, { label: "Einzelstunde · Wirtschaft", items: s.wirtschaft, cls: "t-wi wi" }],
        kompFach: s.k.map(kText), kompWi: s.wk.map((i) => t.wiKompetenzen[i]),
        matFach: s.bp ? [`Blickpunkt Technik: ${s.bp}`] : [], matWi: s.ss ? [`starkeSeiten Wirtschaft: ${s.ss}`] : [] })),
      extras: t, quelle: "tcneu",
    };
  }
  const MODELS = [...HW.map(hwModel), ...TC.map(tcModel)];
  const byJg = (jg, fach) => MODELS.filter((m) => m.jg === jg && m.fach === fach);
  const modelById = (id) => MODELS.find((m) => m.id === id);
  const fmtStd = ([a, b]) => (a === b ? `${a}` : `${a}–${b}`) + " Std.";
  const stdOf = (jg, f) => byJg(jg, f).reduce((acc, m) => [acc[0] + m.std[0], acc[1] + m.std[1]], [0, 0]);

  /* =======================================================================
     Bausteine: Status, Notizen, Links, Stundenbalken
     ======================================================================= */
  const STATI = ["offen", "diskutiert", "beschlossen", "zurückgestellt"];
  function statusSelect(key) {
    const v = store.get("status:" + key) || "offen";
    return `<select class="status" data-status="${key}" data-v="${v}" title="Bearbeitungsstand (lokal gespeichert)">${STATI.map((s) => `<option ${s === v ? "selected" : ""}>${s}</option>`).join("")}</select>`;
  }

  let renderingView = "";
  const NOTE_VIEW = {};      // Notiz-Schlüssel → Ansicht (für Markierungen an den Reitern)
  const NOTE_LABEL = {};     // Notiz-Schlüssel → Beschriftung
  function foreignNotes(key) {
    const all = store.all(), out = [];
    Object.keys(all).forEach((k) => { const m = k.match(/^ext:(.+?)::note:(.+)$/); if (m && m[2] === key && all[k]) out.push({ name: m[1], text: all[k] }); });
    return out;
  }
  function noteBox(key, label, opts = {}) {
    NOTE_VIEW[key] = renderingView; NOTE_LABEL[key] = label || key;
    const v = store.get("note:" + key);
    const fr = foreignNotes(key);
    return `<div class="note ${v ? "has" : ""} ${opts.small ? "small" : ""}" data-notebox="${key}"><label><span>✎ ${esc(label || "Notizen")}</span><span class="saved">gespeichert ✓</span></label><textarea data-note="${key}" placeholder="Eigene Notizen, Änderungswünsche, Fragen … (werden nur in diesem Browser gespeichert)">${esc(v)}</textarea>
      ${fr.map((f) => `<div class="fnote"><b>${esc(f.name)}:</b> ${esc(f.text)}</div>`).join("")}</div>`;
  }
  const linkBtn = (anchor, txt) => `<button class="linkbtn noprint" data-copy="${anchor}" title="Link auf diese Stelle kopieren">🔗${txt ? " " + txt : ""}</button>`;

  /* Stundenbalken: Rahmen 54 Std., Segmente je Vorhaben bzw. Doppel-/Einzelstunde */
  function hoursBar(jg, f, compact) {
    const ms = byJg(jg, f);
    const [lo, hi] = stdOf(jg, f);
    const scale = Math.max(RAHMEN_STD, hi) * 1.08;
    const pct = (x) => (x / scale * 100).toFixed(2) + "%";
    let segs = "";
    if (f === "tc") {
      const m = ms[0];
      segs = `<span class="seg-b tc" style="width:${pct(m.ds)}" title="Doppelstunde Technik: ${m.ds} Std.">DS ${m.ds}</span><span class="seg-b wi" style="width:${pct(m.es)}" title="Einzelstunde Wirtschaft: ${m.es} Std.">ES ${m.es}</span>`;
    } else {
      segs = ms.map((m, i) => `<span class="seg-b hw ${i % 2 ? "alt" : ""}" style="width:${pct(m.std[0])}" title="${esc(m.label)}: ${esc(m.zeit)}">${esc(m.label.replace("HW ", ""))}</span>${m.std[1] > m.std[0] ? `<span class="seg-b range" style="width:${pct(m.std[1] - m.std[0])}" title="Spanne bis ${m.std[1]} Std."></span>` : ""}`).join("");
    }
    const cls = lo > RAHMEN_STD ? "over" : hi > RAHMEN_STD ? "warn" : "ok";
    const msg = lo > RAHMEN_STD ? `${lo - RAHMEN_STD}${hi > lo ? "–" + (hi - RAHMEN_STD) : ""} Std. über dem Rahmen` : hi > RAHMEN_STD ? `bis ${hi - RAHMEN_STD} Std. über dem Rahmen` : "im Rahmen";
    return `<div class="hbar ${cls} ${compact ? "compact" : ""}">
      <div class="track">${segs}<span class="limit" style="left:${pct(RAHMEN_STD)}" title="Rahmen: ca. ${RAHMEN_STD} Std."></span></div>
      <div class="hlabel"><b>${fmtStd([lo, hi])}</b> von ca. ${RAHMEN_STD} Std. · <span class="hmsg">${msg}</span>${f === "hw" ? ' <small class="muted">(Aufteilung Doppel-/Einzelstunde im HW-Plan nicht ausgewiesen)</small>' : ""}</div></div>`;
  }

  /* =======================================================================
     Unterrichtsvorhaben (gleiches Raster für beide Fächer)
     ======================================================================= */
  function renderUV(m) {
    const f = m.fach, F = FACH[f];
    const seqRows = m.sequenzen.map((s) => {
      const nk = `${m.id}-s${s.nr}`, has = !!store.get("note:" + nk) || foreignNotes(nk).length;
      return `<tr id="uv-${m.id}-s${s.nr}" class="seqrow">
      <td class="s1"><b>${s.nr}. Sequenz</b><div class="stitle">${esc(s.titel)}</div>
        <div class="themen">${s.themen.length ? `<span class="h">Themen</span>${ul(s.themen)}` : ""}</div>
        ${s.zeit ? `<span class="chip time ${f}">${esc(s.zeit)}</span>` : ""}
        <div class="rowtools noprint"><button class="mini" data-seqnote="${nk}">✎ Notiz</button>${linkBtn(`uv-${m.id}-s${s.nr}`)}</div></td>
      <td class="cx">${s.ideen.map((g) => `<div class="${g.cls || ""}">${g.label ? `<span class="h">${esc(g.label)}</span>` : ""}${ul(g.items)}</div>`).join("")}</td>
      <td class="cx"><span class="h ${f}">${F}</span>${ul(s.kompFach, f) || '<p class="muted">–</p>'}
        ${s.kompWi.length ? `<div class="t-wi wi"><span class="h wi">Wirtschaft</span>${ul(s.kompWi)}</div>` : ""}</td>
      <td class="cx">${s.matFach.length ? `<span class="h ${f}">${F}</span>${ul(s.matFach)}` : ""}
        ${s.matWi.length ? `<div class="t-wi"><span class="h wi">Wirtschaft</span>${ul(s.matWi)}</div>` : ""}</td>
    </tr>
    <tr class="seqnote ${has ? "" : "hidden"}" data-seqnoterow="${nk}"><td colspan="4">${noteBox(nk, `Notiz ${m.label} · Sequenz ${s.nr}`, { small: true })}</td></tr>`;
    }).join("");

    const x = m.extras;
    const extras = `
      <div class="detail">
      <h4 class="sec">Querschnittsaufgaben und Lernorganisation</h4>
      <div class="grid g3">
        <div class="box bo t-bo"><h5>Berufsorientierung</h5>${x ? `<p><b>Berufe</b></p>${ul(x.bo.berufe)}<p><b>Elemente</b></p>${ul(x.bo.elemente)}` : notGiven()}</div>
        <div class="box bne t-bne"><h5>Bildung für nachhaltige Entwicklung</h5>${x ? `<div>${x.bne.sdg.map((n) => `<span class="chip bne">SDG ${n} · ${esc(SDG[n])}</span>`).join(" ")}</div>${ul(x.bne.punkte)}` : notGiven()}</div>
        <div class="box"><h5>Produkte und Leistungsnachweise</h5>${x ? ul(x.produkte) + `<p class="muted">${esc(x.leistung)}</p>` : notGiven()}</div>
      </div>
      <div class="grid g2" style="margin-top:12px">
        <div class="box srl t-srl"><h5>Selbstreguliertes Lernen</h5>${x ? `<div class="grid g3 tight"><div><b>Planung</b>${ul(x.srl.planung)}</div><div><b>Durchführung</b>${ul(x.srl.durchfuehrung)}</div><div><b>Reflexion</b>${ul(x.srl.reflexion)}</div></div>` : notGiven()}</div>
        <div class="box"><h5>Außerschulische Lernorte</h5>${x ? ul(x.lernorte) : notGiven()}</div>
      </div>
      <div class="card inner t-srl"><h5>Kompetenzraster <small class="muted">„Ich kann …“ – Mindest-, Regel-, Expertenstandard</small></h5>
        ${x ? `<div class="tablewrap"><table class="raster"><thead><tr><th>Bereich</th><th class="m">Mindeststandard</th><th class="r">Regelstandard</th><th class="e">Expertenstandard</th></tr></thead><tbody>
          ${x.raster.map((r) => `<tr class="${r.wi ? "wi t-wi" : ""}${r.bo ? " bo t-bo" : ""}${r.bne ? " bne t-bne" : ""}"><td class="b">${esc(r.bereich)}<small>${esc(r.codes)}</small></td><td>${esc(r.m)}</td><td>${esc(r.r)}</td><td>${esc(r.e)}</td></tr>`).join("")}
        </tbody></table></div>` : notGiven("Im HW-Plan ist kein Kompetenzraster ausgewiesen.")}
      </div>
      ${x ? `<div class="grid g2"><div class="box"><h5>Bezug zum anderen Fach</h5><p>${esc(x.hwBezug)}</p></div><div class="box"><h5>Bezug zum bisherigen SchiLP Technik</h5><p>${esc(x.bisher)}</p></div></div>` : ""}
      </div>`;

    return `<details class="uv ${f}" id="uv-${m.id}" data-uvfach="${f}">
      <summary>
        <span class="fbadge ${f}">${F}</span>
        <span class="sumt"><b>${esc(m.label)}</b> ${esc(m.titel)}${m.untertitel ? ` <small>– ${esc(m.untertitel)}</small>` : ""}<span class="ndot" title="Notizen vorhanden"></span></span>
        <span class="sumchips">${m.fachIF.map((n) => chipF(f, n)).join("")}${m.wiIF.map((w) => chipWI(w.n, w.opt)).join("")}<span class="chip time ${f}">${esc(m.zeit.replace(/\s*\(.*\)/, ""))}</span></span>
      </summary>
      <div class="body">
        <div class="uvhead">
          <div>${src(m.quelle)} ${m.leitfrage ? `<div class="leitfrage">Leitfrage: ${esc(m.leitfrage)}</div>` : ""}</div>
          <div class="noprint uvtools">${linkBtn("uv-" + m.id, "Link")}${statusSelect(m.id)}</div>
        </div>
        <div class="detail">
        <div class="grid g2">
          <div class="box ${f}"><h5>Inhaltsfelder</h5>${ul(m.ifText)}<p class="muted">Zeitbedarf: ${esc(m.zeit)}</p></div>
          <div class="box mkr t-mkr"><h5>Einbindung in den MKR</h5>${ul(m.mkr)}${f === "hw" ? '<small class="muted">Der HW-Plan nennt keine MKR-Codes.</small>' : ""}</div>
        </div>
        <div class="grid g2">
          <div class="box ${f}"><h5>Schwerpunkte der Kompetenzentwicklung</h5><p class="muted">Die Lernenden …</p>${ul(m.kompFach, f)}</div>
          <div class="box wi t-wi"><h5>Ergänzend Wirtschaft</h5>${m.kompWi.length ? `<p class="muted">Die Lernenden …</p>${ul(m.kompWi)}` : notGiven("Kein Wirtschaftsbezug ausgewiesen.")}</div>
        </div>
        <div class="grid g2">
          <div class="box ${f}"><h5>Inhaltliche Schwerpunkte · Bereich ${F}</h5>${ul(m.inhFach)}</div>
          <div class="box wi t-wi"><h5>Inhaltliche Schwerpunkte · Bereich Wirtschaft</h5>${m.inhWi.length ? ul(m.inhWi) : notGiven("–")}</div>
        </div>
        </div>
        <h4 class="sec">Sequenzen</h4>
        <div class="tablewrap"><table class="seq ${f}">
          <thead><tr><th>Sequenz / Themen / Zeitumfang</th><th class="cx">Fachdidaktische Ideen / Inhalte des Lern- und Arbeitsprozesses</th><th class="cx">Konkretisierte Kompetenzerwartungen</th><th class="cx">Materialvorschläge</th></tr></thead>
          <tbody>${seqRows}</tbody></table></div>
        ${extras}
        ${noteBox(m.id, `Notizen ${m.label}`)}
      </div></details>`;
  }

  /* =======================================================================
     Ansichten
     ======================================================================= */
  function viewRahmen() {
    const sec = RAHMEN.map((r, i) => {
      const neu = r.teile.filter((t) => t.q === "neu");
      const hw = r.teile.find((t) => t.q === "hw"), tc = r.teile.find((t) => t.q === "tc");
      const part = (t) => t ? `${src(t.q)}${t.hinweis ? `<p class="hinweis">${esc(t.hinweis)}</p>` : ""}${(t.absaetze || []).map((a) => `<p>${esc(a)}</p>`).join("")}${ul(t.liste)}${(t.nach || []).map((a) => `<p>${esc(a)}</p>`).join("")}` : notGiven("In diesem Plan nicht ausgewiesen.");
      return `<div class="card" id="rahmen-${i}"><h3>1.${i + 1} ${esc(r.titel)} ${linkBtn("rahmen-" + i)}</h3>
        ${neu.map((t) => `<div class="box neu">${src("neu")}${t.absaetze.map((a) => `<p>${esc(a)}</p>`).join("")}</div>`).join("")}
        ${hw || tc ? `<div class="grid g2" style="margin-top:${neu.length ? 12 : 0}px"><div class="col hw">${part(hw)}</div><div class="col tc">${part(tc)}</div></div>` : ""}
        ${noteBox("rahmen-" + i, "Notizen " + r.titel)}</div>`;
    }).join("");
    const g = GRUNDSAETZE_TC;
    return `
    <div class="card"><h2>1 Rahmenbedingungen der fachlichen Arbeit</h2>
      <p>Die Texte beider bisherigen Pläne stehen nebeneinander und sind nach Quelle gekennzeichnet: ${src("hw")} ${src("tc")} ${src("neu")}. Für den gemeinsamen Plan ist je Abschnitt eine gemeinsame Fassung zu beschließen.</p></div>
    ${sec}
    <div class="card" id="rahmen-grundsaetze"><h3>1.${RAHMEN.length + 1} Grundsätze der fachmethodischen und fachdidaktischen Arbeit</h3>
      <div class="grid g2"><div class="col hw">${src("hw")}${notGiven("Im HW-Plan kein eigenes Kapitel; Grundsätze sind in Abschnitt 1.5 „Fachliche Bezüge zu schulischen Standards“ enthalten.")}</div>
      <div class="col tc">${src("tc")}<p>${esc(g.einleitung)}</p><p><b>Überfachliche Grundsätze</b></p><ol>${g.ueberfachlich.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p><b>Fachliche Grundsätze</b></p><ol start="15">${g.fachlich.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div></div>
      ${noteBox("grundsaetze", "Notizen Grundsätze")}</div>`;
  }

  function viewUebersicht() {
    const modell = JGS.map((jg) => `
      <div class="jgl">Jg. ${jg}</div>
      <div class="hj hw"><b>Schwerpunkthalbjahr Hauswirtschaft</b><div class="row"><span class="bar ds hw">2 Std. Hauswirtschaft</span><span class="bar es">1 Std. Wirtschaft</span></div></div>
      <div class="hj tc"><b>Schwerpunkthalbjahr Technik</b><div class="row"><span class="bar ds tc">2 Std. Technik</span><span class="bar es">1 Std. Wirtschaft</span></div></div>`).join("");
    const cell = (jg, f) => byJg(jg, f).map((m) => `<div class="ovitem"><a class="t" href="#uv-${m.id}"><b>${esc(m.label)}</b> ${esc(m.titel)}</a>
        <div>${m.fachIF.map((n) => chipF(f, n)).join("")}${m.wiIF.map((w) => chipWI(w.n, w.opt)).join("") || '<span class="chip">ohne Wi-IF</span>'}<small class="muted"> ${esc(m.zeit.replace(/\s*\(.*\)/, ""))}</small></div></div>`).join("") + hoursBar(jg, f, true);
    const rows = JGS.map((jg) => `<tr><td><a href="#jg${jg}" class="t">${jg}</a></td><td class="fcol hw">${cell(jg, "hw")}</td><td class="fcol tc">${cell(jg, "tc")}</td></tr>`).join("");
    return `
    <div class="card"><h2>2 Übersicht über die Unterrichtsvorhaben</h2>
      <p>Wirtschaft und Arbeitswelt wird in den Jahrgängen 7–10 dreistündig in <b>Schwerpunkthalbjahren</b> unterrichtet: je Jahrgang ein Halbjahr Hauswirtschaft und ein Halbjahr Technik. Die <b>Doppelstunde</b> trägt den fachpraktischen Schwerpunkt, die <b>Einzelstunde</b> Wirtschaftsthemen, die mit dem Fach verknüpft sind. Die Reihenfolge der Halbjahre hängt von der Personalplanung ab.</p>
      <div class="modell">${modell}</div>
    </div>
    <div class="card">
      <div class="legend" style="margin-bottom:8px"><span><i class="sw" style="background:var(--hw)"></i>Hauswirtschaft</span><span><i class="sw" style="background:var(--tc)"></i>Technik</span><span><i class="sw" style="background:var(--wi)"></i>Wirtschaft</span><span><i class="sw limitsw"></i>Rahmen ca. ${RAHMEN_STD} Std.</span></div>
      <div class="tablewrap"><table class="ov">
        <thead><tr><th>Jg.</th><th class="hw">Schwerpunkthalbjahr Hauswirtschaft ${src("hw")}</th><th class="tc">Schwerpunkthalbjahr Technik ${src("tcneu")}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="muted" style="margin-top:8px">Tipp: Codes und Inhaltsfelder sind anklickbar – die Seitenleiste zeigt Bedeutung und alle Fundstellen.</p>
    </div>
    ${noteBox("uebersicht", "Notizen zur Gesamtstruktur")}`;
  }

  /* Gegenüberstellung: beide Fächer Zeile für Zeile nach Gliederungspunkten */
  function compareTable(jg) {
    const col = (f, fn) => `<td class="fcol ${f}">${byJg(jg, f).map((m) => `<div class="cmpuv"><a href="#uv-${m.id}" class="cmpl">${esc(m.label)}</a>${fn(m)}</div>`).join("")}</td>`;
    const row = (title, fn) => `<tr><th class="rowh">${title}</th>${col("hw", fn)}${col("tc", fn)}</tr>`;
    return `<div class="tablewrap"><table class="cmp">
      <thead><tr><th></th><th class="hw">Hauswirtschaft</th><th class="tc">Technik</th></tr></thead><tbody>
      ${row("Vorhaben", (m) => `<b>${esc(m.titel)}</b>${m.leitfrage ? `<div class="muted"><i>${esc(m.leitfrage)}</i></div>` : ""}`)}
      ${row("Zeitbedarf", (m) => esc(m.zeit))}
      ${row("Inhaltsfelder", (m) => `${m.fachIF.map((n) => chipF(m.fach, n)).join("")}${m.wiIF.map((w) => chipWI(w.n, w.opt)).join("")}`)}
      ${row("Kompetenzschwerpunkte", (m) => codesOf(m.kompFach).map((c) => `<button class="code-link ${m.fach}" data-code="${m.fach}:${c}">${spaced(c)}</button>`).join(" "))}
      ${row("Ergänzend Wirtschaft", (m) => ul(m.kompWi) || '<span class="nicht">–</span>')}
      ${row("Inhaltliche Schwerpunkte Fach", (m) => ul(m.inhFach))}
      ${row("Inhaltliche Schwerpunkte Wirtschaft", (m) => ul(m.inhWi) || '<span class="nicht">–</span>')}
      ${row("Medienkompetenz", (m) => ul(m.mkr))}
      ${row("Sequenzen", (m) => `<ol class="seqlist">${m.sequenzen.map((s) => `<li><a href="#uv-${m.id}-s${s.nr}">${esc(s.titel)}</a> <small class="muted">${esc(s.zeit)}</small></li>`).join("")}</ol>`)}
      ${row("BO · BNE · SRL", (m) => m.extras ? `<span class="chip bo">BO</span><span class="chip bne">BNE</span><span class="chip srl">SRL + Kompetenzraster</span>` : '<span class="nicht">im HW-Plan nicht ausgewiesen</span>')}
      <tr><th class="rowh">Stunden</th><td class="fcol hw">${hoursBar(jg, "hw", true)}</td><td class="fcol tc">${hoursBar(jg, "tc", true)}</td></tr>
      </tbody></table></div>`;
  }

  function viewJahrgang(jg) {
    const card = (f) => {
      const ms = byJg(jg, f);
      return `<div class="jgcard ${f}"><div class="jgct"><span class="fbadge ${f}">${FACH[f]}</span> Schwerpunkthalbjahr</div>
        ${ms.map((m) => `<a href="#uv-${m.id}" class="jgitem"><b>${esc(m.label)}</b> ${esc(m.titel)}</a>`).join("")}
        ${hoursBar(jg, f)}</div>`;
    };
    const toc = ["hw", "tc"].map((f) => `<div class="toc-f ${f}"><div class="toc-h ${f}">${FACH[f]}</div>${byJg(jg, f).map((m) => `
        <a href="#uv-${m.id}" class="toc-uv" data-toc="uv-${m.id}"><b>${esc(m.label)}</b> ${esc(m.titel.length > 48 ? m.titel.slice(0, 46) + "…" : m.titel)}</a>
        ${m.sequenzen.map((s) => `<a href="#uv-${m.id}-s${s.nr}" class="toc-s" data-toc="uv-${m.id}-s${s.nr}">${s.nr}. ${esc(s.titel.length > 40 ? s.titel.slice(0, 38) + "…" : s.titel)}</a>`).join("")}`).join("")}</div>`).join("");
    return `
    <div class="card"><h2>Jahrgang ${jg}</h2>
      <div class="grid g2">${card("hw")}${card("tc")}</div>
      <div class="noprint jgtools">
        <span class="seg small"><button data-jgmode="vorhaben">Vorhaben</button><button data-jgmode="vergleich">Gegenüberstellung</button></span>
        <button class="btn" data-act="openall">Alle aufklappen</button><button class="btn" data-act="closeall">Alle zuklappen</button>
      </div>
    </div>
    <div class="jgmode-vergleich card">${compareTable(jg)}</div>
    <div class="jgmode-vorhaben jgwrap">
      <div class="jgmain">
        <div class="fachblock hw"><h3 class="fh hw">Hauswirtschaft · Jahrgang ${jg}</h3>${byJg(jg, "hw").map(renderUV).join("")}</div>
        <div class="fachblock tc"><h3 class="fh tc">Technik · Jahrgang ${jg}</h3>${byJg(jg, "tc").map(renderUV).join("")}</div>
      </div>
      <aside class="toc noprint"><div class="toc-in"><div class="toc-title">Auf dieser Seite</div>${toc}</div></aside>
    </div>
    ${noteBox("jg" + jg, `Notizen Jahrgang ${jg} (fachübergreifend)`)}`;
  }

  function viewAbdeckung() {
    const head = `<th>Jg. 7</th><th>Jg. 8</th><th>Jg. 9</th><th>Jg. 10</th>`;
    const uvChip = (m, extra) => `<a class="chip ${m.fach} lnk" href="#uv-${m.id}">${esc(m.label)}${extra || ""}</a>`;
    const wiRows = Object.keys(IF_WI).map((k) => {
      const n = +k;
      return `<tr><td><button class="code-link wi" data-code="wi:${n}">IF ${n}</button> ${esc(IF_WI[n].name)}</td>${JGS.map((jg) => `<td>${["hw", "tc"].flatMap((f) => byJg(jg, f).filter((m) => m.wiIF.some((w) => w.n === n)).map((m) => uvChip(m, m.wiIF.find((w) => w.n === n).opt ? " (erg.)" : ""))).join("")}</td>`).join("")}</tr>`;
    }).join("");
    const fachIF = (f, dict) => Object.keys(dict).map((k) => {
      const n = +k, name = f === "hw" ? dict[n] : dict[n].name;
      return `<tr><td><button class="code-link ${f}" data-code="${f}if:${n}">IF ${n}</button> ${esc(name)}</td>${JGS.map((jg) => `<td>${byJg(jg, f).filter((m) => m.fachIF.includes(n)).map((m) => uvChip(m)).join("")}</td>`).join("")}</tr>`;
    }).join("");
    const kompRows = (f) => {
      const all = {};
      JGS.forEach((jg) => byJg(jg, f).forEach((m) => codesOf(m.kompFach).forEach((c) => { ((all[c] = all[c] || {})[jg] = all[c][jg] || []).push(m); })));
      const order = (c) => ["SK", "MK", "UK", "HK"].indexOf(c.slice(0, 2)) * 100 + +c.slice(2);
      const codes = f === "tc" ? Object.keys(KLP_TC) : Object.keys(all).sort((a, b) => order(a) - order(b));
      return codes.map((c) => {
        const n = all[c] ? Object.keys(all[c]).length : 0;
        return `<tr><td><button class="code-link ${f}" data-code="${f}:${c}">${spaced(c)}</button>${f === "tc" ? ` <small>${esc(KLP_TC[c])}</small>` : ""}</td>${JGS.map((jg) => `<td>${all[c] && all[c][jg] ? all[c][jg].map((m) => `<a class="dot ${f}" href="#uv-${m.id}" title="${esc(m.label)}"></a>`).join("") : ""}</td>`).join("")}<td class="${n ? "" : "zero"}">${n}</td></tr>`;
      }).join("");
    };
    const mkrRows = JGS.map((jg) => `<tr><td><b>${jg}</b></td>${["hw", "tc"].map((f) => `<td class="fcol ${f}">${byJg(jg, f).map((m) => `<div><a href="#uv-${m.id}"><b>${esc(m.label)}</b></a>${ul(m.mkr)}</div>`).join("")}</td>`).join("")}</tr>`).join("");
    const kw = (re) => (m) => [...new Set(m.sequenzen.flatMap((s) => [...s.themen, ...s.ideen.flatMap((g) => g.items)]).filter((t) => re.test(t)))];
    const boHW = kw(/Beruf/i), bneHW = kw(/nachhaltig|klima|Ressourc|fair/i);
    const qRows = JGS.map((jg) => {
      const h = byJg(jg, "hw"), t = byJg(jg, "tc")[0].extras;
      return `<tr><td><b>${jg}</b></td>
        <td class="fcol hw t-bo">${h.map((m) => { const l = boHW(m); return l.length ? `<div><b>${esc(m.label)}</b>${ul(l)}</div>` : ""; }).join("") || '<span class="muted">keine Fundstelle</span>'}</td>
        <td class="fcol tc t-bo">${esc(t.bo.berufe.join(", "))}${ul(t.bo.elemente)}</td>
        <td class="fcol hw t-bne">${h.map((m) => { const l = bneHW(m); return l.length ? `<div><b>${esc(m.label)}</b>${ul(l)}</div>` : ""; }).join("") || '<span class="muted">keine Fundstelle</span>'}</td>
        <td class="fcol tc t-bne">${t.bne.sdg.map((n) => `<span class="chip bne">SDG ${n}</span>`).join("")}${ul(t.bne.punkte)}</td></tr>`;
    }).join("");
    const bil = JGS.map((jg) => `<tr><td><b>${jg}</b></td><td>${hoursBar(jg, "hw", true)}</td><td>${hoursBar(jg, "tc", true)}</td></tr>`).join("");

    return `
    <div class="card"><h2>Abdeckung des Kernlehrplans</h2>
      <p class="muted">Automatisch aus den Planungsdaten berechnet. Codes, Inhaltsfelder und Einträge sind anklickbar. HW-Werte stammen aus den Angaben des HW-Plans.</p></div>
    <div class="card"><h3>Stundenbilanz pro Schwerpunkthalbjahr</h3><table class="bil"><thead><tr><th>Jg.</th><th class="hw">Hauswirtschaft (laut HW-Plan)</th><th class="tc">Technik (Entwurf)</th></tr></thead><tbody>${bil}</tbody></table></div>
    <div class="card t-wi"><h3>Wirtschaft: Inhaltsfelder nach Jahrgang und Fach</h3><div class="tablewrap"><table class="matrix">
      <thead><tr><th>Inhaltsfeld Wirtschaft</th>${head}</tr></thead><tbody>${wiRows}</tbody></table></div>
      <small class="muted">„(erg.)“ = im HW-Plan in Klammern als ergänzend angegeben.</small></div>
    <div class="grid g2">
      <div class="card"><h3>Hauswirtschaft: Inhaltsfelder</h3><div class="tablewrap"><table class="matrix"><thead><tr><th>Inhaltsfeld</th>${head}</tr></thead><tbody>${fachIF("hw", IF_HW)}</tbody></table></div></div>
      <div class="card"><h3>Technik: Inhaltsfelder</h3><div class="tablewrap"><table class="matrix"><thead><tr><th>Inhaltsfeld</th>${head}</tr></thead><tbody>${fachIF("tc", IF_TC)}</tbody></table></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Hauswirtschaft: Kompetenzschwerpunkte</h3><div class="tablewrap"><table class="matrix"><thead><tr><th>Code</th>${head}<th>Σ</th></tr></thead><tbody>${kompRows("hw")}</tbody></table></div>
        <small class="muted">Nur Codes, die im HW-Plan genannt sind (Abschnitt Hauswirtschaft des KLP).</small></div>
      <div class="card"><h3>Technik: Kompetenzschwerpunkte</h3><div class="tablewrap"><table class="matrix"><thead><tr><th>Code</th>${head}<th>Σ</th></tr></thead><tbody>${kompRows("tc")}</tbody></table></div>
        <small class="muted">Alle Codes des Abschnitts Technik (Kurzfassung); rote 0 = nicht abgedeckt.</small></div>
    </div>
    <div class="card t-mkr"><h3>Einbindung in den Medienkompetenzrahmen</h3><div class="tablewrap"><table><thead><tr><th>Jg.</th><th class="hw">Hauswirtschaft</th><th class="tc">Technik</th></tr></thead><tbody>${mkrRows}</tbody></table></div></div>
    <div class="card"><h3>Berufsorientierung und BNE</h3>
      <p class="muted">Der HW-Plan weist BO und BNE nicht gesondert aus. Angezeigt werden wörtliche Fundstellen aus den HW-Sequenzen (Suche nach „Beruf“ bzw. „nachhaltig / Klima / Ressourcen / fair“).</p>
      <div class="tablewrap"><table><thead><tr><th>Jg.</th><th class="hw">BO · HW (Fundstellen)</th><th class="tc">BO · Technik</th><th class="hw">BNE · HW (Fundstellen)</th><th class="tc">BNE · Technik</th></tr></thead><tbody>${qRows}</tbody></table></div></div>
    ${noteBox("abdeckung", "Notizen zur Abdeckung")}`;
  }

  function viewLeistung() {
    const L = LEISTUNG;
    const c = (id, inner) => `<div class="card" id="leistung-${id}">${inner}</div>`;
    return `
    <div class="card" id="leistung-einleitung"><h2>5 Grundsätze der Leistungsbewertung und Rückmeldung</h2>
      <div class="box neu">${src("hw")} <b>Vorschlag:</b> Kapitel 5 des HW-Plans ist bereits für den gesamten Wahlpflichtbereich formuliert und wird hier als gemeinsame Grundlage angezeigt. Technikspezifische Ergänzungen stehen am Ende und sind gekennzeichnet.</div>
      ${L.einleitung.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <div class="grid g2">
      ${c("grundsaetze", `<h3>Grundsätze</h3>${ul(L.grundsaetze)}`)}
      ${c("absprachen", `<h3>Verbindliche Absprachen</h3><ol>${L.absprachen.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`)}
    </div>
    <div class="grid g2">
      ${c("instr-s", `<h3>Verbindliche Instrumente: Schriftliche Arbeiten</h3>${ul(L.instrSchriftlich)}`)}
      ${c("instr-o", `<h3>Verbindliche Instrumente: Sonstige Leistungen</h3>${ul(L.instrSonstige)}`)}
    </div>
    <div class="grid g2">
      ${c("schriftlich", `<h3>Schriftliche Arbeiten</h3>${L.schriftlich.map((p) => `<p>${esc(p)}</p>`).join("")}
        <table><thead><tr><th>Prozentpunkte</th><th>Note</th></tr></thead><tbody>${L.schluessel.map(([p, n]) => `<tr><td>${p}</td><td>${n}</td></tr>`).join("")}</tbody></table>`)}
      ${c("sonstige", `<h3>Sonstige Leistungen im Unterricht</h3>${L.sonstige.map((p) => `<p>${esc(p)}</p>`).join("")}
        <div class="grid g2 tight"><div><b>Theoretische Arbeit</b>${ul(L.theoretisch)}</div><div><b>Praktische Arbeit</b>${ul(L.praktisch)}</div></div>`)}
    </div>
    <div class="grid g2">
      ${c("allgemein", `<h3>Allgemeine Kriterien</h3><p>Die folgenden allgemeinen Kriterien gelten für schriftliche, mündliche, praktische und projektorientierte Formen der Leistungsbewertung:</p>${ul(L.allgemein)}`)}
      ${c("gruppe", `<h3>Kriterien bei Partner- und Gruppenarbeiten</h3><p>Bei Partner- und Gruppenarbeiten kann der individuelle Beitrag zum Ergebnis der Partner- bzw. Gruppenarbeit in die Bewertung einbezogen werden. Bewertet werden insbesondere:</p>${ul(L.gruppe)}`)}
    </div>
    ${c("praxis", `<h3>Konkretisierte Kriterien für praktische Leistungen</h3>
      <div class="grid g2"><div class="col hw">${src("hw")}<p>Für praktische Leistungen, insbesondere im fachpraktischen Unterricht der Hauswirtschaft, gelten folgende Kriterien:</p>${ul(L.praxisHW)}</div>
      <div class="col tc">${src("tcneu")}<p>Entwurf für den fachpraktischen Unterricht in Technik:</p>${ul(L.tcPraxisEntwurf)}</div></div>`)}
    <div class="grid g2">
      ${c("mappe", `<h3>Arbeitsmappe, Portfolio oder digitale Dokumentation</h3><p>Bewertet werden insbesondere:</p>${ul(L.mappe)}`)}
      ${c("vortrag", `<h3>Kurzvortrag, Referat oder Präsentation</h3><p>Bewertet werden insbesondere:</p>${ul(L.vortrag)}`)}
    </div>
    ${c("rueckmeldung", `<h3>Grundsätze der Leistungsrückmeldung und Beratung</h3>${L.rueckmeldung.map((p) => `<p>${esc(p)}</p>`).join("")}`)}
    ${c("technik", `<h3>Technik: Ergänzungen</h3>
      <div class="grid g2"><div class="col tc">${src("tc")}<p><b>Beitragsformen im Fach Technik</b> (bisheriger Plan, Pflichtfach)</p>${ul(L.tcBeitraege)}<p><b>Kriterien für Beobachtungsbögen</b></p>${ul(L.tcBeobachtung)}</div>
      <div class="col tc">${src("tcneu")}<p><b>Leistungsnachweise je Technik-Halbjahr</b></p><table><tbody>${TC.map((t) => `<tr><td><b>Jg. ${t.jg}</b></td><td>${esc(t.leistung)}</td></tr>`).join("")}</tbody></table></div></div>`)}
    ${noteBox("leistung", "Notizen zur Leistungsbewertung")}`;
  }

  function viewLehrwerke() {
    return `
    <div class="card" id="lehrwerke-liste"><h2>6 Lehr- und Lernmittel</h2>
      <div class="grid g2">
        <div class="col hw"><h3>Hauswirtschaft</h3>${src("hw")}${ul(LEHRWERKE.hw)}</div>
        <div class="col tc"><h3>Technik</h3>${src("tcneu")}<p class="hinweis">${esc(LEHRWERKE.tcHinweis)}</p>${ul(LEHRWERKE.tc)}</div>
      </div></div>
    ${noteBox("lehrwerke", "Notizen Lehrwerke")}`;
  }

  const TAGS = { organisation: ["Organisation", "neu"], wirtschaft: ["Wirtschaft", "wi"], technik: ["Technik", "tc"], struktur: ["Struktur", "neu"], leistung: ["Leistung", "srl"], bo: ["Berufsorientierung", "bo"] };
  function statusCounts() {
    const c = { offen: 0, diskutiert: 0, beschlossen: 0, zurückgestellt: 0 };
    DISKUSSION.forEach((d) => { c[store.get("status:" + d.id) || "offen"]++; });
    return c;
  }
  function statusOverview() {
    const c = statusCounts(), n = DISKUSSION.length;
    const seg = (k, cls) => c[k] ? `<span class="sp ${cls}" style="width:${(c[k] / n * 100).toFixed(1)}%" title="${k}: ${c[k]}"></span>` : "";
    return `<div class="sprog">${seg("beschlossen", "b")}${seg("diskutiert", "d")}${seg("zurückgestellt", "z")}${seg("offen", "o")}</div>
      <div class="slegend"><span><i class="b"></i>beschlossen ${c.beschlossen}</span><span><i class="d"></i>diskutiert ${c.diskutiert}</span><span><i class="z"></i>zurückgestellt ${c.zurückgestellt}</span><span><i class="o"></i>offen ${c.offen}</span></div>`;
  }
  function viewSitzung() {
    return `
    <div class="card"><h2>Gesprächsgrundlage für die Sitzung</h2>
      <p>Offene Punkte aus dem Abgleich beider Planungen. Status und Notizen werden lokal in diesem Browser gespeichert.</p>
      <div id="status-overview">${statusOverview()}</div>
      <div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn primary" data-act="meeting">▶ Sitzungsmodus starten</button>
        <button class="btn" data-act="protokoll">Protokoll herunterladen</button>
      </div></div>
    ${DISKUSSION.map((d, i) => `<div class="card tight disc" id="disk-${d.id}">
        <div><h3>${i + 1}. ${esc(d.titel)} <span class="chip ${TAGS[d.tag][1]}">${TAGS[d.tag][0]}</span> ${linkBtn("disk-" + d.id)}</h3><p>${esc(d.text)}</p></div>
        <div class="noprint">${statusSelect(d.id)}</div>
        <div class="tagline">${noteBox(d.id, `Ergebnis zu Punkt ${i + 1}: ${d.titel}`)}</div></div>`).join("")}
    <div class="card">${noteBox("protokoll", "Protokoll / weitere Punkte")}</div>`;
  }

  function collectNotes() {
    const all = store.all(), own = [], foreign = {};
    Object.keys(all).forEach((k) => {
      if (!all[k]) return;
      let m = k.match(/^note:(.+)$/);
      if (m) { own.push({ id: m[1], label: NOTE_LABEL[m[1]] || m[1], text: all[k], status: all["status:" + m[1]] || "" }); return; }
      m = k.match(/^ext:(.+?)::note:(.+)$/);
      if (m) (foreign[m[1]] = foreign[m[1]] || []).push({ id: m[2], label: NOTE_LABEL[m[2]] || m[2], text: all[k] });
    });
    return { own, foreign };
  }
  function viewNotizen() {
    return `
    <div class="card"><h2>Notizen</h2>
      <p>Notizen und Bearbeitungsstände werden <b>nur lokal in diesem Browser</b> gespeichert. Zum Einsammeln von Rückmeldungen: Jede Lehrkraft trägt ihren Namen ein und lädt ihre Sicherung herunter. Wer die Dateien einliest, sieht fremde Notizen mit Namen direkt an den passenden Stellen – die eigenen Notizen bleiben unverändert.</p>
      <div class="namerow noprint"><label for="myname"><b>Mein Name</b> (für den Export):</label> <input id="myname" type="text" value="${esc(store.get("ui:name"))}" placeholder="z. B. C. Wegemann"></div>
      <div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn primary" data-act="export-json">Meine Notizen als Datei herunterladen</button>
        <button class="btn" data-act="import-json">Notiz-Dateien einlesen (auch mehrere)</button>
        <button class="btn" data-act="export-md">Alle Notizen als Markdown</button>
        <button class="btn danger" data-act="clear">Meine Notizen löschen</button>
      </div></div>
    <div id="notelist"></div>`;
  }
  function fillNotelist() {
    const el = document.getElementById("notelist"); if (!el) return;
    const { own, foreign } = collectNotes();
    const item = (n) => `<div class="item"><a href="#${anchorForNote(n.id)}"><b>${esc(n.label)}</b></a> ${n.status ? `<span class="chip srl">${esc(n.status)}</span>` : ""}<pre>${esc(n.text)}</pre></div>`;
    el.innerHTML = `<div class="card notelist"><h3>Meine Notizen (${own.length})</h3>${own.length ? own.map(item).join("") : '<p class="muted">Noch keine Notizen. Notizfelder gibt es in jedem Abschnitt und an jeder Sequenz.</p>'}</div>` +
      Object.keys(foreign).map((name) => `<div class="card notelist foreign"><h3>Notizen von ${esc(name)} (${foreign[name].length}) <button class="btn small danger" data-removeext="${esc(name)}">entfernen</button></h3>${foreign[name].map(item).join("")}</div>`).join("");
  }
  function anchorForNote(id) {
    if (/^(hw|tc)\d/.test(id)) { const m = id.match(/^(.+?)-s(\d+)$/); return m ? `uv-${m[1]}-s${m[2]}` : `uv-${id}`; }
    if (/^d\d+$/.test(id)) return "disk-" + id;
    if (/^rahmen-\d+$/.test(id)) return id;
    return NOTE_VIEW[id] || "rahmen";
  }

  /* =======================================================================
     Ansichten registrieren und aufbauen
     ======================================================================= */
  const VIEWS = [
    { id: "rahmen", label: "1 Rahmen", render: viewRahmen },
    { id: "uebersicht", label: "2 Übersicht", render: viewUebersicht },
    ...JGS.map((jg) => ({ id: "jg" + jg, label: "Jg. " + jg, render: () => viewJahrgang(jg) })),
    { id: "abdeckung", label: "Abdeckung KLP", render: viewAbdeckung },
    { id: "leistung", label: "5 Leistung", render: viewLeistung },
    { id: "lehrwerke", label: "6 Lehrwerke", render: viewLehrwerke },
    { id: "sitzung", label: "Sitzung", render: viewSitzung },
    { id: "notizen", label: "Notizen", render: viewNotizen },
  ];
  function renderView(v) { renderingView = v.id; const h = v.render(); renderingView = ""; return h; }

  function build() {
    document.title = `${META.titel} – gemeinsamer SchiLP (Arbeitsversion)`;
    document.getElementById("app").innerHTML = `
      <header class="topbar">
        <div class="brand"><b>${esc(META.titel)}</b><span>${esc(META.untertitel)} · ${esc(META.schule)}</span></div>
        <span class="badge-draft">${esc(META.version)}</span>
        <span class="spacer"></span>
        <button class="searchbtn" data-act="search" title="Suchen (Strg+K oder /)">🔍 Suchen <kbd>Strg K</kbd></button>
        <button data-act="printdlg">Drucken …</button>
        <button data-act="help" title="Tastenkürzel">?</button>
      </header>
      <nav class="tabs"><div class="inner">${VIEWS.map((v) => `<a href="#${v.id}" data-view="${v.id}">${v.label}<span class="tabdot"></span>${v.id === "sitzung" ? '<span class="tabbadge" id="sitz-badge"></span>' : ""}</a>`).join("")}</div>
        <div class="filterbar">
          <span class="lbl">Fach:</span>
          <span class="seg"><button data-fach="beide">Beide</button><button data-fach="hw">Hauswirtschaft</button><button data-fach="tc">Technik</button></span>
          <span class="lbl" style="margin-left:10px">Ansicht:</span>
          <span class="seg"><button data-dichte="detail">Detail</button><button data-dichte="kompakt">Kompakt</button></span>
          <span class="lbl" style="margin-left:10px">Hervorheben:</span>
          <button class="fchip" data-f="wi">Wirtschaft</button>
          <button class="fchip" data-f="bo">Berufsorientierung</button>
          <button class="fchip" data-f="bne">BNE</button>
          <button class="fchip" data-f="mkr">Medienkompetenz</button>
          <button class="fchip" data-f="srl">SRL</button>
        </div></nav>
      <main>${VIEWS.map((v) => `<section class="view" id="view-${v.id}">${renderView(v)}</section>`).join("")}</main>
      <div class="foot">${esc(META.schule)} · Gemeinsamer SchiLP Wirtschaft und Arbeitswelt · ${esc(META.version)} · Stand ${esc(META.stand)} · HW-Inhalte wörtlich aus dem SchiLP Hauswirtschaft (Stand 31.08.2026) · Notizen nur lokal gespeichert</div>

      <aside class="drawer" id="drawer" aria-hidden="true"><div class="drawer-head"><span id="drawer-title"></span><button class="x" data-act="drawer-close" title="Schließen (Esc)">✕</button></div><div class="drawer-body" id="drawer-body"></div></aside>
      <div class="overlay" id="search" hidden><div class="sbox">
        <input id="sinput" type="search" placeholder="Suchen in Vorhaben, Sequenzen, Kompetenzen, Materialien, Kapiteln …" autocomplete="off">
        <div class="sinfo" id="sinfo">Mindestens 2 Zeichen · ↑↓ auswählen · Enter öffnen · Esc schließen</div>
        <div class="sres" id="sres"></div></div></div>
      <div class="overlay" id="printdlg" hidden><div class="dlg">
        <h3>Drucken</h3>
        <p class="muted">Kapitel auswählen:</p>
        <div class="pchecks">${VIEWS.filter((v) => v.id !== "notizen").map((v) => `<label><input type="checkbox" value="${v.id}"> ${v.label}</label>`).join("")}</div>
        <p class="muted" style="margin-top:10px">Fächer:</p>
        <div class="pchecks"><label><input type="radio" name="pfach" value="beide" checked> beide</label><label><input type="radio" name="pfach" value="hw"> nur Hauswirtschaft</label><label><input type="radio" name="pfach" value="tc"> nur Technik</label></div>
        <label style="display:block;margin-top:10px"><input type="checkbox" id="pnotes" checked> ausgefüllte Notizen mitdrucken</label>
        <div class="dlgbtns"><button class="btn" data-act="psel-cur">nur aktuelle Ansicht</button><button class="btn" data-act="psel-all">alle</button><span class="spacer"></span><button class="btn" data-act="printdlg-close">Abbrechen</button><button class="btn primary" data-act="print-go">Drucken</button></div>
      </div></div>
      <div class="overlay" id="help" hidden><div class="dlg">
        <h3>Bedienung</h3>
        <table><tbody>
          <tr><td><kbd>Strg</kbd>+<kbd>K</kbd> oder <kbd>/</kbd></td><td>Suche öffnen</td></tr>
          <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>vorheriger / nächster Reiter (im Sitzungsmodus: Punkte)</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Seitenleiste, Suche oder Sitzungsmodus schließen</td></tr>
          <tr><td>Codes, Inhaltsfelder</td><td>anklicken → Seitenleiste mit Bedeutung und Fundstellen</td></tr>
          <tr><td>🔗</td><td>Link auf diese Stelle kopieren</td></tr>
          <tr><td>✎ Notiz</td><td>Notiz an einer einzelnen Sequenz</td></tr>
        </tbody></table>
        <div class="dlgbtns"><span class="spacer"></span><button class="btn primary" data-act="help-close">Schließen</button></div></div></div>
      <div class="meeting" id="meeting" hidden></div>
      <div class="toast" id="toast"></div>
      <input type="file" id="importfile" accept="application/json" multiple hidden>`;
  }

  /* =======================================================================
     Navigation
     ======================================================================= */
  function viewOfAnchor(a) {
    if (!a) return null;
    if (VIEWS.some((v) => v.id === a)) return a;
    let m = a.match(/^uv-(.+?)(?:-s\d+)?$/);
    if (m) { const mod = modelById(m[1]); return mod ? "jg" + mod.jg : null; }
    if (a.startsWith("rahmen")) return "rahmen";
    if (a.startsWith("disk-")) return "sitzung";
    if (a.startsWith("leistung-")) return "leistung";
    if (a.startsWith("lehrwerke")) return "lehrwerke";
    return null;
  }
  function show(anchor, opts = {}) {
    const id = viewOfAnchor(anchor) || "rahmen";
    document.querySelectorAll("section.view").forEach((s) => s.classList.toggle("active", s.id === "view-" + id));
    document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === id));
    if (id === "notizen") fillNotelist();
    store.set("ui:view", id);
    if (anchor && anchor !== id) reveal(anchor, opts.term);
    else if (!opts.keepScroll) window.scrollTo({ top: 0 });
    setupScrollspy(id);
  }
  function reveal(anchor, term) {
    const el = document.getElementById(anchor); if (!el) return;
    if (/^uv-/.test(anchor) && document.body.classList.contains("jg-vergleich")) setJgMode("vorhaben");
    const det = el.tagName === "DETAILS" ? el : el.closest("details"); if (det) det.open = true;
    if (/^uv-.+-s\d+$/.test(anchor)) document.body.classList.remove("kompakt-tmp");
    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
      if (term) markTerm(el, term);
    }, 60);
  }
  function markTerm(root, term) {
    document.querySelectorAll("mark.hit").forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
    const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 1); if (!words.length) return;
    const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement.closest("textarea,script,style,button,select") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (!re.test(n.nodeValue)) return; re.lastIndex = 0;
      const span = document.createElement("span"); span.innerHTML = esc(n.nodeValue).replace(re, '<mark class="hit">$1</mark>');
      n.replaceWith(...span.childNodes);
    });
    setTimeout(() => document.querySelectorAll("mark.hit").forEach((m) => m.replaceWith(document.createTextNode(m.textContent))), 6000);
  }
  function go(anchor, term) { if (location.hash.slice(1) === anchor) show(anchor, { term }); else { pendingTerm = term; location.hash = anchor; } }
  let pendingTerm = "";

  /* Mitlaufende Seitennavigation (Scrollspy) */
  let spy = null;
  function setupScrollspy(viewId) {
    if (spy) { spy.disconnect(); spy = null; }
    if (!/^jg/.test(viewId) || !("IntersectionObserver" in window)) return;
    const sec = document.getElementById("view-" + viewId);
    const links = sec.querySelectorAll("[data-toc]");
    const vis = new Map();
    spy = new IntersectionObserver((ents) => {
      ents.forEach((e) => vis.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null));
      let best = null, bestTop = Infinity;
      vis.forEach((top, id) => { if (top !== null && top < bestTop) { best = id; bestTop = top; } });
      if (!best) return;
      links.forEach((l) => l.classList.toggle("on", l.dataset.toc === best || (best.startsWith(l.dataset.toc + "-s"))));
    }, { rootMargin: "-120px 0px -55% 0px" });
    sec.querySelectorAll("details.uv, tr.seqrow").forEach((el) => spy.observe(el));
  }

  /* =======================================================================
     Seitenleiste: Bedeutung und Fundstellen eines Codes
     ======================================================================= */
  function openDrawer(code) {
    const [typ, val] = code.split(":");
    let title = "", body = "";
    const uvLink = (m, extra) => `<a href="#uv-${m.id}" class="dlink ${m.fach}"><span class="fbadge ${m.fach}">${m.fach === "hw" ? "HW" : "TC"}</span> <b>${esc(m.label)}</b> ${esc(m.titel)}${extra ? `<small class="muted"> ${extra}</small>` : ""}</a>`;
    const seqLink = (m, s) => `<a href="#uv-${m.id}-s${s.nr}" class="dlink sub">${esc(m.label)} · ${s.nr}. ${esc(s.titel)}</a>`;
    if (typ === "tc" || typ === "hw") {
      const f = typ, c = val;
      title = `${FACH[f]} · ${spaced(c)}`;
      const re = new RegExp("\\(" + c.slice(0, 2) + "\\s?" + c.slice(2) + "\\)");
      const ms = MODELS.filter((m) => m.fach === f && m.kompFach.some((s) => re.test(s)));
      const seqs = MODELS.filter((m) => m.fach === f).flatMap((m) => m.sequenzen.filter((s) => s.kompFach.some((t) => re.test(t))).map((s) => [m, s]));
      let def = "";
      if (f === "tc") def = `<p class="def">${esc(KLP_TC[c] || "")}</p><small class="muted">Kurzfassung nach KLP WAW, Abschnitt Technik</small>`;
      else { const s = MODELS.filter((m) => m.fach === "hw").flatMap((m) => m.kompFach).find((t) => re.test(t)); def = s ? `<p class="def">… ${esc(s.replace(re, "").trim())}</p><small class="muted">Formulierung im HW-Plan (Abschnitt Hauswirtschaft des KLP)</small>` : ""; }
      body = `${def}<h5>Schwerpunkt in ${ms.length} Vorhaben</h5>${ms.map((m) => uvLink(m)).join("") || '<p class="muted">–</p>'}
        ${seqs.length ? `<h5>In Sequenzen</h5>${seqs.map(([m, s]) => seqLink(m, s)).join("")}` : ""}
        <p class="muted" style="margin-top:12px">Hinweis: Gleich lautende Codes meinen in Hauswirtschaft und Technik Verschiedenes.</p>`;
    } else if (typ === "wi") {
      const n = +val; title = `Wirtschaft · IF ${n}`;
      const ms = MODELS.filter((m) => m.wiIF.some((w) => w.n === n));
      body = `<p class="def">${esc(IF_WI[n].name)}</p><h5>Vorhaben (${ms.length})</h5>${JGS.map((jg) => { const l = ms.filter((m) => m.jg === jg); return l.length ? `<div class="djg">Jg. ${jg}</div>${l.map((m) => uvLink(m, m.wiIF.find((w) => w.n === n).opt ? "(ergänzend)" : "")).join("")}` : ""; }).join("")}`;
    } else if (typ === "hwif" || typ === "tcif") {
      const f = typ.slice(0, 2), n = +val; title = `${FACH[f]} · IF ${n}`;
      const ms = MODELS.filter((m) => m.fach === f && m.fachIF.includes(n));
      body = `<p class="def">${esc(f === "hw" ? IF_HW[n] : IF_TC[n].name)}</p>${f === "tc" ? `<h5>Inhaltliche Schwerpunkte (KLP)</h5>${ul(IF_TC[n].sp)}${IF_TC[n].hinweis ? `<p class="muted">${esc(IF_TC[n].hinweis)}</p>` : ""}` : ""}<h5>Vorhaben (${ms.length})</h5>${ms.map((m) => uvLink(m)).join("") || '<p class="muted">–</p>'}`;
    } else if (typ === "mkr") {
      title = `Medienkompetenzrahmen · ${val}`;
      const ms = MODELS.filter((m) => m.mkrCodes.includes(val));
      const parent = MKR[val.split(".")[0]];
      body = `<p class="def">${esc(MKR[val] || "")}</p><small class="muted">Kompetenzbereich ${val.split(".")[0]}: ${esc(parent || "")}</small><h5>Vorhaben mit diesem Code (${ms.length})</h5>${ms.map((m) => uvLink(m)).join("") || '<p class="muted">–</p>'}<p class="muted" style="margin-top:12px">Der HW-Plan beschreibt die MKR-Einbindung ohne Codes; HW-Vorhaben erscheinen hier deshalb nicht.</p>`;
    }
    document.getElementById("drawer-title").textContent = title;
    document.getElementById("drawer-body").innerHTML = body;
    const d = document.getElementById("drawer"); d.classList.add("open"); d.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() { const d = document.getElementById("drawer"); d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }

  /* =======================================================================
     Volltextsuche
     ======================================================================= */
  let INDEX = [];
  function buildIndex() {
    const add = (anchor, crumb, title, parts, fach) => INDEX.push({ anchor, crumb, title, fach, text: parts.flat(Infinity).filter(Boolean).join(" · ") });
    MODELS.forEach((m) => {
      add("uv-" + m.id, `Jg. ${m.jg} · ${FACH[m.fach]}`, `${m.label} ${m.titel}`, [m.titel, m.untertitel, m.leitfrage, m.ifText, m.kompFach, m.kompWi, m.inhFach, m.inhWi, m.mkr,
        m.extras ? [m.extras.bo.berufe, m.extras.bo.elemente, m.extras.bne.punkte, m.extras.produkte, m.extras.lernorte, m.extras.raster.map((r) => [r.bereich, r.m, r.r, r.e])] : []], m.fach);
      m.sequenzen.forEach((s) => add(`uv-${m.id}-s${s.nr}`, `Jg. ${m.jg} · ${m.label}`, `${s.nr}. Sequenz: ${s.titel}`, [s.titel, s.themen, s.zeit, s.ideen.map((g) => g.items), s.kompFach, s.kompWi, s.matFach, s.matWi], m.fach));
    });
    RAHMEN.forEach((r, i) => add("rahmen-" + i, "1 Rahmen", r.titel, r.teile.map((t) => [t.absaetze, t.liste, t.nach])));
    add("rahmen-grundsaetze", "1 Rahmen", "Grundsätze der fachmethodischen Arbeit", [GRUNDSAETZE_TC.ueberfachlich, GRUNDSAETZE_TC.fachlich]);
    const L = LEISTUNG;
    [["einleitung", "Leistungsbewertung: Einleitung", L.einleitung], ["grundsaetze", "Grundsätze", L.grundsaetze], ["absprachen", "Verbindliche Absprachen", L.absprachen],
     ["instr-s", "Instrumente schriftlich", L.instrSchriftlich], ["instr-o", "Instrumente sonstige", L.instrSonstige], ["schriftlich", "Schriftliche Arbeiten", L.schriftlich],
     ["sonstige", "Sonstige Leistungen", [L.sonstige, L.theoretisch, L.praktisch]], ["allgemein", "Allgemeine Kriterien", L.allgemein], ["gruppe", "Gruppenarbeit", L.gruppe],
     ["praxis", "Praktische Leistungen", [L.praxisHW, L.tcPraxisEntwurf]], ["mappe", "Mappe/Portfolio", L.mappe], ["vortrag", "Vortrag/Präsentation", L.vortrag],
     ["rueckmeldung", "Rückmeldung", L.rueckmeldung], ["technik", "Technik-Ergänzungen", [L.tcBeitraege, L.tcBeobachtung]]].forEach(([id, t, p]) => add("leistung-" + id, "5 Leistung", t, p));
    add("lehrwerke-liste", "6 Lehrwerke", "Lehr- und Lernmittel", [LEHRWERKE.hw, LEHRWERKE.tc]);
    DISKUSSION.forEach((d, i) => add("disk-" + d.id, "Sitzung", `${i + 1}. ${d.titel}`, [d.text]));
    INDEX.forEach((e) => { e.lc = (e.title + " · " + e.text).toLowerCase(); });
  }
  let sResults = [], sSel = 0;
  function runSearch(q) {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    const box = document.getElementById("sres"), info = document.getElementById("sinfo");
    if (!words.length) { box.innerHTML = ""; info.textContent = "Mindestens 2 Zeichen · ↑↓ auswählen · Enter öffnen · Esc schließen"; sResults = []; return; }
    const fachFilter = document.body.classList.contains("only-hw") ? "hw" : document.body.classList.contains("only-tc") ? "tc" : null;
    sResults = INDEX.filter((e) => words.every((w) => e.lc.includes(w)) && (!fachFilter || !e.fach || e.fach === fachFilter))
      .map((e) => ({ e, score: words.reduce((a, w) => a + (e.title.toLowerCase().includes(w) ? 5 : 0) + (e.lc.split(w).length - 1), 0) }))
      .sort((a, b) => b.score - a.score).slice(0, 40).map((x) => x.e);
    sSel = 0;
    info.textContent = sResults.length ? `${sResults.length}${sResults.length === 40 ? "+" : ""} Treffer${fachFilter ? " (nur " + FACH[fachFilter] + ")" : ""}` : "Keine Treffer";
    const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    box.innerHTML = sResults.map((e, i) => {
      const pos = e.text.toLowerCase().indexOf(words[0]);
      const snip = pos < 0 ? e.text.slice(0, 160) : (pos > 60 ? "…" : "") + e.text.slice(Math.max(0, pos - 60), pos + 120) + "…";
      return `<button class="sitem ${i === 0 ? "sel" : ""}" data-sidx="${i}"><span class="scrumb">${e.fach ? `<span class="fbadge ${e.fach}">${e.fach === "hw" ? "HW" : "TC"}</span> ` : ""}${esc(e.crumb)}</span><span class="stitle2">${esc(e.title).replace(re, "<mark>$1</mark>")}</span><span class="ssnip">${esc(snip).replace(re, "<mark>$1</mark>")}</span></button>`;
    }).join("");
  }
  function openSearch() { const o = document.getElementById("search"); o.hidden = false; const i = document.getElementById("sinput"); i.focus(); i.select(); runSearch(i.value); }
  function closeSearch() { document.getElementById("search").hidden = true; }
  function pickResult(i) {
    const e = sResults[i]; if (!e) return;
    const q = document.getElementById("sinput").value; closeSearch(); closeDrawer();
    if (e.fach && document.body.classList.contains("only-" + (e.fach === "hw" ? "tc" : "hw"))) setFach("beide");
    go(e.anchor, q);
  }

  /* =======================================================================
     Sitzungsmodus
     ======================================================================= */
  const meet = { i: 0, running: false, tick: null, start: 0 };
  const getTime = (id) => +(store.get("timer:" + id) || 0);
  const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  function meetingRender() {
    const d = DISKUSSION[meet.i], n = DISKUSSION.length, st = store.get("status:" + d.id) || "offen";
    const plan = +(store.get("ui:meetmin") || 10);
    document.getElementById("meeting").innerHTML = `
      <div class="m-top"><span>Sitzung · Punkt ${meet.i + 1} von ${n}</span><div class="m-dots">${DISKUSSION.map((x, k) => `<button class="mdot s-${(store.get("status:" + x.id) || "offen").replace("ü", "ue")} ${k === meet.i ? "cur" : ""}" data-mgo="${k}" title="${k + 1}. ${esc(x.titel)}"></button>`).join("")}</div><button class="x" data-act="meeting-close" title="Beenden (Esc)">✕</button></div>
      <div class="m-main">
        <div class="m-tag"><span class="chip ${TAGS[d.tag][1]}">${TAGS[d.tag][0]}</span></div>
        <h1>${meet.i + 1}. ${esc(d.titel)}</h1>
        <p class="m-text">${esc(d.text)}</p>
        <div class="m-status">${STATI.map((s) => `<button class="mst ${s === st ? "on" : ""} s-${s.replace("ü", "ue")}" data-mstatus="${s}">${s}</button>`).join("")}</div>
        <div class="m-note"><label>Ergebnis / Notiz</label><textarea data-note="${d.id}" placeholder="Ergebnis festhalten …">${esc(store.get("note:" + d.id))}</textarea></div>
      </div>
      <div class="m-bottom">
        <button class="btn" data-act="m-prev" ${meet.i === 0 ? "disabled" : ""}>← zurück</button>
        <div class="m-timer"><span id="m-time" class="${getTime(d.id) > plan * 60 ? "late" : ""}">${fmtT(getTime(d.id))}</span> / <input id="m-plan" type="number" min="1" max="90" value="${plan}"> min
          <button class="btn" data-act="m-timer">${meet.running ? "⏸ Pause" : "▶ Start"}</button><button class="btn" data-act="m-reset" title="Zeit zurücksetzen">↺</button></div>
        ${meet.i === n - 1 ? `<button class="btn primary" data-act="protokoll">Protokoll herunterladen</button>` : `<button class="btn primary" data-act="m-next">weiter →</button>`}
      </div>`;
  }
  function meetingStopTimer() {
    if (!meet.running) return;
    const d = DISKUSSION[meet.i];
    store.set("timer:" + d.id, String(getTime(d.id) + Math.round((Date.now() - meet.start) / 1000)));
    meet.running = false; clearInterval(meet.tick);
  }
  function meetingStartTimer() {
    meet.running = true; meet.start = Date.now();
    const d = DISKUSSION[meet.i], base = getTime(d.id);
    meet.tick = setInterval(() => {
      const t = base + Math.round((Date.now() - meet.start) / 1000), el = document.getElementById("m-time");
      if (el) { el.textContent = fmtT(t); el.classList.toggle("late", t > +(store.get("ui:meetmin") || 10) * 60); }
    }, 500);
  }
  function meetingGo(i) {
    const was = meet.running; meetingStopTimer();
    meet.i = Math.max(0, Math.min(DISKUSSION.length - 1, i)); meetingRender();
    if (was) { meetingStartTimer(); meetingRender(); }
  }
  function openMeeting() { meet.i = +(store.get("ui:meeti") || 0) || 0; document.getElementById("meeting").hidden = false; document.body.classList.add("meeting-on"); meetingRender(); }
  function closeMeeting() {
    meetingStopTimer(); store.set("ui:meeti", String(meet.i));
    document.getElementById("meeting").hidden = true; document.body.classList.remove("meeting-on");
    refreshStatusUI(); syncNotesFromStore();
  }
  function protokollMD() {
    const today = new Date().toLocaleDateString("de-DE");
    let md = `# Protokoll – Gemeinsamer SchiLP Wirtschaft und Arbeitswelt\n\nDatum: ${today}  \nGrundlage: ${META.version}\n\n`;
    const c = statusCounts(); md += `Stand: ${c.beschlossen} beschlossen, ${c.diskutiert} diskutiert, ${c.zurückgestellt} zurückgestellt, ${c.offen} offen\n\n`;
    DISKUSSION.forEach((d, i) => {
      const t = getTime(d.id);
      md += `## ${i + 1}. ${d.titel}\n\n**Status:** ${store.get("status:" + d.id) || "offen"}${t ? ` · **Dauer:** ${fmtT(t)} min` : ""}\n\n${store.get("note:" + d.id) || "_kein Ergebnis notiert_"}\n\n`;
    });
    const p = store.get("note:protokoll"); if (p) md += `## Weitere Punkte\n\n${p}\n`;
    return md;
  }

  /* =======================================================================
     Diverses: Fach, Dichte, Jahrgangsmodus, Toast, Download, Markierungen
     ======================================================================= */
  function setFach(f) {
    document.body.classList.remove("only-hw", "only-tc");
    if (f === "hw" || f === "tc") document.body.classList.add("only-" + f);
    document.querySelectorAll("button[data-fach]").forEach((b) => b.classList.toggle("on", b.dataset.fach === (f || "beide")));
    store.set("ui:fach", f === "beide" ? "" : f);
  }
  function setDichte(d) {
    document.body.classList.toggle("kompakt", d === "kompakt");
    document.querySelectorAll("[data-dichte]").forEach((b) => b.classList.toggle("on", b.dataset.dichte === d));
    store.set("ui:dichte", d === "kompakt" ? d : "");
  }
  function setJgMode(mo) {
    document.body.classList.toggle("jg-vergleich", mo === "vergleich");
    document.querySelectorAll("[data-jgmode]").forEach((b) => b.classList.toggle("on", b.dataset.jgmode === mo));
    store.set("ui:jgmode", mo === "vergleich" ? mo : "");
  }
  function toast(msg) {
    const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type }); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copyText(txt) {
    const done = () => toast("Link kopiert");
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, () => fallback());
    else fallback();
    function fallback() { const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) { prompt("Link kopieren:", txt); } t.remove(); }
  }
  function refreshStatusUI() {
    const c = statusCounts(), b = document.getElementById("sitz-badge");
    if (b) { b.textContent = `${c.beschlossen}/${DISKUSSION.length}`; b.title = `${c.beschlossen} von ${DISKUSSION.length} Punkten beschlossen`; }
    const o = document.getElementById("status-overview"); if (o) o.innerHTML = statusOverview();
    document.querySelectorAll("select[data-status]").forEach((s) => { const v = store.get("status:" + s.dataset.status) || "offen"; s.value = v; s.dataset.v = v; });
  }
  function hasNote(key) { return !!store.get("note:" + key) || foreignNotes(key).length > 0; }
  function refreshNoteMarks() {
    const views = new Set();
    Object.keys(NOTE_VIEW).forEach((k) => { if (hasNote(k)) views.add(NOTE_VIEW[k]); });
    document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("hasnotes", views.has(a.dataset.view)));
    MODELS.forEach((m) => {
      const d = document.getElementById("uv-" + m.id); if (!d) return;
      const any = hasNote(m.id) || m.sequenzen.some((s) => hasNote(`${m.id}-s${s.nr}`));
      d.classList.toggle("hasnotes", any);
    });
  }
  function syncNotesFromStore() {
    document.querySelectorAll("textarea[data-note]").forEach((t) => { const v = store.get("note:" + t.dataset.note); if (t.value !== v) t.value = v; const box = t.closest(".note"); if (box) box.classList.toggle("has", !!v); });
    refreshNoteMarks();
  }

  /* Druck */
  function openPrintDlg() {
    const dlg = document.getElementById("printdlg"); dlg.hidden = false;
    const cur = store.get("ui:view") || "rahmen";
    dlg.querySelectorAll(".pchecks input[type=checkbox]").forEach((c) => c.checked = c.value === cur);
    const f = store.get("ui:fach") || "beide"; dlg.querySelectorAll("input[name=pfach]").forEach((r) => r.checked = r.value === f);
  }
  function doPrint() {
    const dlg = document.getElementById("printdlg");
    const sel = [...dlg.querySelectorAll(".pchecks input[type=checkbox]:checked")].map((c) => c.value);
    if (!sel.length) { toast("Bitte mindestens ein Kapitel wählen"); return; }
    const f = dlg.querySelector("input[name=pfach]:checked").value, prevF = store.get("ui:fach") || "beide";
    dlg.hidden = true;
    document.querySelectorAll("section.view").forEach((s) => s.classList.toggle("psel", sel.includes(s.id.slice(5))));
    document.body.classList.add("printsel"); document.body.classList.toggle("print-nonotes", !document.getElementById("pnotes").checked);
    const wasK = document.body.classList.contains("kompakt"), wasV = document.body.classList.contains("jg-vergleich");
    document.body.classList.remove("kompakt", "jg-vergleich"); setFach(f);
    const opened = []; document.querySelectorAll("details.uv:not([open])").forEach((d) => { d.open = true; opened.push(d); });
    setTimeout(() => {
      window.print();
      document.body.classList.remove("printsel", "print-nonotes"); opened.forEach((d) => d.open = false);
      if (wasK) document.body.classList.add("kompakt"); if (wasV) document.body.classList.add("jg-vergleich"); setFach(prevF);
    }, 80);
  }

  /* Notizen exportieren / zusammenführen */
  function exportJSON() {
    const name = (store.get("ui:name") || "").trim();
    if (!name) { toast("Bitte zuerst einen Namen eintragen"); const i = document.getElementById("myname"); if (i) i.focus(); return; }
    const all = store.all(), daten = {};
    Object.keys(all).forEach((k) => { if (/^(note|status|timer):/.test(k)) daten[k] = all[k]; });
    download(`schilp-waw-notizen-${name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ format: "schilp-waw-notizen", version: 2, name, exportiert: new Date().toISOString(), daten }, null, 2), "application/json");
  }
  function importFiles(files) {
    const me = (store.get("ui:name") || "").trim();
    const list = [...files], total = list.length;
    let n = 0, done = 0;
    list.forEach((file) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(r.result);
          if (j && j.format === "schilp-waw-notizen" && j.name && j.name !== me) {
            Object.keys(store.all()).forEach((k) => { if (k.startsWith(`ext:${j.name}::`)) store.set(k, ""); });
            Object.entries(j.daten || {}).forEach(([k, v]) => { if (k.startsWith("note:") && v) store.set(`ext:${j.name}::${k}`, v); });
            n++;
          } else {
            const d = j && j.format ? j.daten : j;   // eigene Sicherung oder altes Format
            Object.entries(d || {}).forEach(([k, v]) => { if (/^(note|status|timer|ui):/.test(k)) store.set(k, v); });
            n++;
          }
        } catch (e) { toast(`${file.name}: nicht lesbar`); }
        if (++done === total) { rerender(); toast(`${n} Datei(en) eingelesen`); }
      };
      r.readAsText(file);
    });
  }
  let clearArmed = 0;
  function confirmTwice() {
    if (Date.now() - clearArmed < 4000) { clearArmed = 0; return true; }
    clearArmed = Date.now(); toast("Zum Bestätigen innerhalb von 4 Sekunden erneut klicken"); return false;
  }

  /* =======================================================================
     Ereignisse
     ======================================================================= */
  function bind() {
    const timers = {};
    document.addEventListener("input", (e) => {
      if (e.target.id === "sinput") { runSearch(e.target.value); return; }
      if (e.target.id === "myname") { store.set("ui:name", e.target.value.trim()); return; }
      if (e.target.id === "m-plan") { store.set("ui:meetmin", e.target.value); return; }
      const ta = e.target.closest("textarea[data-note]"); if (!ta) return;
      const key = ta.dataset.note; clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        store.set("note:" + key, ta.value);
        document.querySelectorAll(`textarea[data-note="${key}"]`).forEach((o) => { if (o !== ta) o.value = ta.value; const b = o.closest(".note"); if (b) b.classList.toggle("has", !!ta.value); });
        const box = ta.closest(".note");
        if (box) { box.classList.toggle("has", !!ta.value); const s = box.querySelector(".saved"); if (s) { s.classList.add("show"); setTimeout(() => s.classList.remove("show"), 1200); } }
        refreshNoteMarks();
      }, 350);
    });
    document.addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-status]");
      if (sel) { store.set("status:" + sel.dataset.status, sel.value === "offen" ? "" : sel.value); sel.dataset.v = sel.value; refreshStatusUI(); toast("Status gespeichert"); }
      if (e.target.id === "importfile") { if (e.target.files.length) importFiles(e.target.files); e.target.value = ""; }
    });
    document.addEventListener("click", (e) => {
      const t = e.target;
      // Codes → Seitenleiste
      const code = t.closest("[data-code]");
      if (code) { e.preventDefault(); e.stopPropagation(); openDrawer(code.dataset.code); return; }
      // Links innerhalb der Seite (#uv-…, #jg… usw.)
      const a = t.closest('a[href^="#"]');
      if (a) {
        const anchor = a.getAttribute("href").slice(1);
        if (a.closest("#drawer")) closeDrawer();
        if (a.closest("summary")) return;
        e.preventDefault();
        const vtarget = viewOfAnchor(anchor);
        if (vtarget && document.body.classList.contains("only-hw") && /^uv-tc/.test(anchor)) setFach("beide");
        if (vtarget && document.body.classList.contains("only-tc") && /^uv-hw/.test(anchor)) setFach("beide");
        go(anchor); return;
      }
      if (t.closest(".fchip")) {
        const f = t.closest(".fchip"); f.classList.toggle("on"); document.body.classList.toggle("hl-" + f.dataset.f, f.classList.contains("on"));
        store.set("ui:filter", [...document.querySelectorAll(".fchip.on")].map((x) => x.dataset.f).join(",")); return;
      }
      if (t.closest("button[data-fach]")) { setFach(t.closest("button[data-fach]").dataset.fach); return; }
      if (t.closest("[data-dichte]")) { setDichte(t.closest("[data-dichte]").dataset.dichte); return; }
      if (t.closest("[data-jgmode]")) { setJgMode(t.closest("[data-jgmode]").dataset.jgmode); return; }
      if (t.closest("[data-copy]")) { e.preventDefault(); const u = location.href.split("#")[0] + "#" + t.closest("[data-copy]").dataset.copy; copyText(u); return; }
      if (t.closest("[data-seqnote]")) {
        const k = t.closest("[data-seqnote]").dataset.seqnote, row = document.querySelector(`[data-seqnoterow="${k}"]`);
        row.classList.toggle("hidden"); if (!row.classList.contains("hidden")) row.querySelector("textarea").focus(); return;
      }
      if (t.closest("[data-sidx]")) { pickResult(+t.closest("[data-sidx]").dataset.sidx); return; }
      if (t.closest("[data-mgo]")) { meetingGo(+t.closest("[data-mgo]").dataset.mgo); return; }
      if (t.closest("[data-mstatus]")) {
        const s = t.closest("[data-mstatus]").dataset.mstatus, d = DISKUSSION[meet.i];
        store.set("status:" + d.id, s === "offen" ? "" : s); meetingRender(); refreshStatusUI(); return;
      }
      if (t.closest("[data-removeext]")) {
        const name = t.closest("[data-removeext]").dataset.removeext;
        if (!confirmTwice()) return;
        Object.keys(store.all()).forEach((k) => { if (k.startsWith(`ext:${name}::`)) store.set(k, ""); });
        rerender(); toast(`Notizen von ${name} entfernt`); return;
      }
      if (t.classList.contains("overlay")) { t.hidden = true; return; }
      const b = t.closest("[data-act]"); if (!b) return;
      switch (b.dataset.act) {
        case "search": openSearch(); break;
        case "help": document.getElementById("help").hidden = false; break;
        case "help-close": document.getElementById("help").hidden = true; break;
        case "drawer-close": closeDrawer(); break;
        case "printdlg": openPrintDlg(); break;
        case "printdlg-close": document.getElementById("printdlg").hidden = true; break;
        case "psel-cur": { const cur = store.get("ui:view") || "rahmen"; document.querySelectorAll("#printdlg .pchecks input[type=checkbox]").forEach((c) => c.checked = c.value === cur); break; }
        case "psel-all": document.querySelectorAll("#printdlg .pchecks input[type=checkbox]").forEach((c) => c.checked = true); break;
        case "print-go": doPrint(); break;
        case "openall": case "closeall": document.querySelectorAll("section.view.active details.uv").forEach((d) => d.open = b.dataset.act === "openall"); break;
        case "meeting": openMeeting(); break;
        case "meeting-close": closeMeeting(); break;
        case "m-prev": meetingGo(meet.i - 1); break;
        case "m-next": meetingGo(meet.i + 1); break;
        case "m-timer": if (meet.running) { meetingStopTimer(); } else { meetingStartTimer(); } meetingRender(); break;
        case "m-reset": { const was = meet.running; meetingStopTimer(); store.set("timer:" + DISKUSSION[meet.i].id, ""); if (was) meetingStartTimer(); meetingRender(); break; }
        case "protokoll": if (meet.running) { meetingStopTimer(); meetingStartTimer(); } download(`protokoll-schilp-waw-${new Date().toISOString().slice(0, 10)}.md`, protokollMD(), "text/markdown"); break;
        case "export-json": exportJSON(); break;
        case "import-json": document.getElementById("importfile").click(); break;
        case "export-md": {
          const { own, foreign } = collectNotes(), me = store.get("ui:name") || "ich";
          let md = `# Notizen gemeinsamer SchiLP WAW (${new Date().toLocaleDateString("de-DE")})\n\n## Notizen von ${me}\n\n` + (own.map((n) => `### ${n.label}${n.status ? ` _(Status: ${n.status})_` : ""}\n\n${n.text}\n`).join("\n") || "_keine_\n");
          Object.keys(foreign).forEach((nm) => { md += `\n## Notizen von ${nm}\n\n` + foreign[nm].map((n) => `### ${n.label}\n\n${n.text}\n`).join("\n"); });
          download(`schilp-waw-notizen-${new Date().toISOString().slice(0, 10)}.md`, md, "text/markdown"); break;
        }
        case "clear":
          if (confirmTwice()) { Object.keys(store.all()).forEach((k) => { if (/^(note|status|timer):/.test(k)) store.set(k, ""); }); rerender(); toast("Eigene Notizen gelöscht"); }
          break;
      }
    });
    document.addEventListener("keydown", (e) => {
      const typing = e.target.closest("input,textarea,select,[contenteditable]");
      const searchOpen = !document.getElementById("search").hidden;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchOpen ? closeSearch() : openSearch(); return; }
      if (searchOpen) {
        if (e.key === "Escape") { closeSearch(); return; }
        const items = document.querySelectorAll("#sres .sitem");
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); if (!items.length) return;
          sSel = (sSel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items.forEach((it, i) => it.classList.toggle("sel", i === sSel)); items[sSel].scrollIntoView({ block: "nearest" }); return;
        }
        if (e.key === "Enter") { e.preventDefault(); pickResult(sSel); return; }
        return;
      }
      if (e.key === "Escape") {
        ["printdlg", "help"].forEach((id) => { document.getElementById(id).hidden = true; });
        if (!document.getElementById("meeting").hidden) closeMeeting(); else closeDrawer();
        return;
      }
      if (typing) return;
      if (!document.getElementById("meeting").hidden) {
        if (e.key === "ArrowRight") meetingGo(meet.i + 1);
        if (e.key === "ArrowLeft") meetingGo(meet.i - 1);
        return;
      }
      if (e.key === "/") { e.preventDefault(); openSearch(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const cur = VIEWS.findIndex((v) => v.id === (store.get("ui:view") || "rahmen"));
        const nx = VIEWS[(cur + (e.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length];
        location.hash = nx.id;
      }
    });
    window.addEventListener("hashchange", () => { const t = pendingTerm; pendingTerm = ""; show(location.hash.slice(1), { term: t }); });
  }

  function rerender() {
    const open = [...document.querySelectorAll("details.uv[open]")].map((d) => d.id);
    VIEWS.forEach((v) => { document.getElementById("view-" + v.id).innerHTML = renderView(v); });
    open.forEach((id) => { const d = document.getElementById(id); if (d) d.open = true; });
    restoreUI(true);
    show(location.hash.slice(1) || store.get("ui:view") || "rahmen", { keepScroll: true });
  }
  function restoreUI(partial) {
    if (!partial) {
      (store.get("ui:filter") || "").split(",").filter(Boolean).forEach((f) => {
        const b = document.querySelector(`.fchip[data-f="${f}"]`); if (b) { b.classList.add("on"); document.body.classList.add("hl-" + f); }
      });
    }
    setFach(store.get("ui:fach") || "beide");
    setDichte(store.get("ui:dichte") || "detail");
    setJgMode(store.get("ui:jgmode") || "vorhaben");
    refreshStatusUI(); refreshNoteMarks();
  }

  build(); buildIndex(); bind(); restoreUI();
  show(location.hash.slice(1) || store.get("ui:view") || "rahmen");
})();
