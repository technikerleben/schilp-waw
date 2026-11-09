/* =========================================================================
   Gemeinsamer SchiLP WAW – Rendering, Navigation, Filter, Notizen (localStorage)
   HW-Inhalte stammen wörtlich aus src/hw-data.js (aus dem PDF erzeugt).
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- Speicher (localStorage mit Fallback) ---------- */
  const PREFIX = "schilp-waw:";
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(PREFIX + k); return v === null ? (mem[k] ?? "") : v; } catch (e) { return mem[k] ?? ""; } },
    set(k, v) { mem[k] = v; try { if (v === "" || v == null) localStorage.removeItem(PREFIX + k); else localStorage.setItem(PREFIX + k, v); } catch (e) { /* gesperrt */ } },
    all() {
      const out = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = localStorage.getItem(k); } } catch (e) { Object.assign(out, mem); }
      return out;
    },
  };

  /* ---------- Hilfen ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ul = (arr) => arr && arr.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
  const JGS = [7, 8, 9, 10];
  const FACH = { hw: "Hauswirtschaft", tc: "Technik" };
  const SRC = { hw: ["SchiLP Hauswirtschaft", "hw"], tc: ["SchiLP Technik (bisher)", "tc"], neu: ["Entwurf / Beschluss neu", "neu"], tcneu: ["Entwurf Technik", "neu"] };
  const src = (q) => `<span class="src ${SRC[q][1]}">${SRC[q][0]}</span>`;
  const notGiven = (txt) => `<p class="nicht">${esc(txt || "Im HW-Plan nicht ausgewiesen.")}</p>`;
  const chipWI = (n, opt) => `<span class="chip wi t-wi" title="${esc(IF_WI[n].name)}">${opt ? "(" : ""}Wi IF ${n} · ${esc(IF_WI[n].kurz)}${opt ? ")" : ""}</span>`;
  const chipF = (fach, n) => fach === "hw"
    ? `<span class="chip hw" title="${esc(IF_HW[n])}">HW IF ${n}</span>`
    : `<span class="chip tc" title="${esc(IF_TC[n].name)}">TC IF ${n}</span>`;
  const codesOf = (arr) => [...new Set(arr.flatMap((s) => [...s.matchAll(/\((SK|MK|UK|HK)\s?(\d+)\)/g)].map((m) => m[1] + m[2])))];

  /* ---------- Einheitliches Modell für beide Fächer ---------- */
  function hwModel(h) {
    const fachIF = [], wiIF = [];
    h.inhaltsfelder.forEach((s) => {
      const m = s.match(/(Hauswirtschaft|Wirtschaft):\s*IF\s*(\d)/); if (!m) return;
      if (m[1] === "Hauswirtschaft") fachIF.push(+m[2]); else wiIF.push({ n: +m[2], opt: s.trim().startsWith("(") });
    });
    return {
      fach: "hw", id: h.id, jg: h.jg, label: `HW ${h.jg}.${h.nr}`, titel: h.titel, zeit: h.zeit,
      ifText: h.inhaltsfelder, fachIF, wiIF,
      kompFach: h.kompetenzen, kompWi: h.wirtschaft, inhFach: h.inhalteHW, inhWi: h.inhalteWi, mkr: h.mkr,
      sequenzen: h.sequenzen.map((s) => ({ nr: s.nr, titel: s.titel, themen: s.themen, zeit: s.zeit,
        ideen: [{ items: s.ideen }], kompFach: s.kompHW, kompWi: s.kompWI, matFach: s.matHW, matWi: s.matWI })),
      extras: null, quelle: "hw",
    };
  }
  function tcModel(t) {
    const ds = sum(t.sequenzen, "ds"), es = sum(t.sequenzen, "es");
    return {
      fach: "tc", id: t.id, jg: t.jg, label: `TC ${t.jg}`, titel: t.titel, untertitel: t.untertitel, leitfrage: t.leitfrage,
      zeit: `ca. ${ds + es} Std. (${ds} Doppelstunde Technik + ${es} Einzelstunde Wirtschaft)`,
      ifText: [...t.tcIF.map((n) => `Technik: IF ${n} ${IF_TC[n].name}`), ...t.wiIF.map((n) => `Wirtschaft: IF ${n} ${IF_WI[n].name}`)],
      fachIF: t.tcIF, wiIF: t.wiIF.map((n) => ({ n, opt: false })),
      kompFach: t.kompetenzen.map((c) => `${KLP_TC[c]} (${c.replace(/(\D+)(\d+)/, "$1 $2")})`),
      kompWi: t.wiKompetenzen, inhFach: t.tcSP, inhWi: t.wiSP,
      mkr: t.mkr.map((m) => `${m.text} (MKR ${m.code})`), mkrCodes: t.mkr.map((m) => m.code),
      sequenzen: t.sequenzen.map((s, i) => ({ nr: i + 1, titel: s.titel, themen: [],
        zeit: [s.ds ? `${s.ds} Std. Technik` : "", s.es ? `${s.es} Std. Wirtschaft` : ""].filter(Boolean).join(" + "),
        ideen: [{ label: "Doppelstunde · Technik", items: s.praxis, cls: "" }, { label: "Einzelstunde · Wirtschaft", items: s.wirtschaft, cls: "t-wi wi" }],
        kompFach: s.k.map((c) => `${KLP_TC[c]} (${c.replace(/(\D+)(\d+)/, "$1 $2")})`), kompWi: s.wk.map((i) => t.wiKompetenzen[i]),
        matFach: s.bp ? [`Blickpunkt Technik: ${s.bp}`] : [], matWi: s.ss ? [`starkeSeiten Wirtschaft: ${s.ss}`] : [] })),
      extras: t, quelle: "tcneu",
    };
  }
  const MODELS = [...HW.map(hwModel), ...TC.map(tcModel)];
  const byJg = (jg, fach) => MODELS.filter((m) => m.jg === jg && m.fach === fach);
  const zeitText = (jg, fach) => byJg(jg, fach).map((m) => m.zeit.replace(/^ca\.\s*/, "").replace(/\s*\(.*\)/, "").replace(/\s*(Stunden|Std\.?)\s*$/, "")).join(" + ");

  const STATI = ["offen", "diskutiert", "beschlossen", "zurückgestellt"];
  function statusSelect(key) {
    const v = store.get("status:" + key) || "offen";
    return `<select class="status" data-status="${key}" data-v="${v}" title="Bearbeitungsstand (lokal gespeichert)">${STATI.map((s) => `<option ${s === v ? "selected" : ""}>${s}</option>`).join("")}</select>`;
  }
  function noteBox(key, label) {
    const v = store.get("note:" + key);
    return `<div class="note ${v ? "has" : ""}"><label><span>✎ ${esc(label || "Notizen")}</span><span class="saved">gespeichert ✓</span></label><textarea data-note="${key}" data-label="${esc(label || "")}" placeholder="Eigene Notizen, Änderungswünsche, Fragen … (werden nur in diesem Browser gespeichert)">${esc(v)}</textarea></div>`;
  }

  /* ---------- Unterrichtsvorhaben (gleiches Raster für beide Fächer) ---------- */
  function renderUV(m) {
    const f = m.fach, F = FACH[f];
    const seqRows = m.sequenzen.map((s) => `<tr>
      <td class="s1"><b>${s.nr}. Sequenz</b><div class="stitle">${esc(s.titel)}</div>
        ${s.themen.length ? `<span class="h">Themen</span>${ul(s.themen)}` : ""}
        ${s.zeit ? `<span class="chip time ${f}">${esc(s.zeit)}</span>` : ""}</td>
      <td>${s.ideen.map((g) => `<div class="${g.cls || ""}">${g.label ? `<span class="h">${esc(g.label)}</span>` : ""}${ul(g.items)}</div>`).join("")}</td>
      <td><span class="h ${f}">${F}</span>${ul(s.kompFach) || '<p class="muted">–</p>'}
        ${s.kompWi.length ? `<div class="t-wi wi"><span class="h wi">Wirtschaft</span>${ul(s.kompWi)}</div>` : ""}</td>
      <td>${s.matFach.length ? `<span class="h ${f}">${F}</span>${ul(s.matFach)}` : ""}
        ${s.matWi.length ? `<div class="t-wi"><span class="h wi">Wirtschaft</span>${ul(s.matWi)}</div>` : ""}</td>
    </tr>`).join("");

    const x = m.extras;
    const extras = `
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
      ${x ? `<div class="grid g2"><div class="box"><h5>Bezug zum anderen Fach</h5><p>${esc(x.hwBezug)}</p></div><div class="box"><h5>Bezug zum bisherigen SchiLP Technik</h5><p>${esc(x.bisher)}</p></div></div>` : ""}`;

    return `<details class="uv ${f}" id="uv-${m.id}" data-fach="${f}">
      <summary>
        <span class="fbadge ${f}">${F}</span>
        <span class="sumt"><b>${esc(m.label)}</b> ${esc(m.titel)}${m.untertitel ? ` <small>– ${esc(m.untertitel)}</small>` : ""}</span>
        <span class="sumchips">${m.fachIF.map((n) => chipF(f, n)).join("")}${m.wiIF.map((w) => chipWI(w.n, w.opt)).join("")}<span class="chip time ${f}">${esc(m.zeit.replace(/\s*\(.*\)/, ""))}</span></span>
      </summary>
      <div class="body">
        <div class="uvhead">
          <div>${src(m.quelle)} ${m.leitfrage ? `<div class="leitfrage">Leitfrage: ${esc(m.leitfrage)}</div>` : ""}</div>
          <div class="noprint">${statusSelect(m.id)}</div>
        </div>
        <div class="grid g2">
          <div class="box ${f}"><h5>Inhaltsfelder</h5>${ul(m.ifText)}<p class="muted">Zeitbedarf: ${esc(m.zeit)}</p></div>
          <div class="box mkr t-mkr"><h5>Einbindung in den MKR</h5>${ul(m.mkr)}</div>
        </div>
        <div class="grid g2">
          <div class="box ${f}"><h5>Schwerpunkte der Kompetenzentwicklung</h5><p class="muted">Die Lernenden …</p>${ul(m.kompFach)}</div>
          <div class="box wi t-wi"><h5>Ergänzend Wirtschaft</h5>${m.kompWi.length ? `<p class="muted">Die Lernenden …</p>${ul(m.kompWi)}` : notGiven("Kein Wirtschaftsbezug ausgewiesen.")}</div>
        </div>
        <div class="grid g2">
          <div class="box ${f}"><h5>Inhaltliche Schwerpunkte · Bereich ${F}</h5>${ul(m.inhFach)}</div>
          <div class="box wi t-wi"><h5>Inhaltliche Schwerpunkte · Bereich Wirtschaft</h5>${m.inhWi.length ? ul(m.inhWi) : notGiven("–")}</div>
        </div>
        <h4 class="sec">Sequenzen</h4>
        <div class="tablewrap"><table class="seq ${f}">
          <thead><tr><th>Sequenz / Themen / Zeitumfang</th><th>Fachdidaktische Ideen / Inhalte des Lern- und Arbeitsprozesses</th><th>Konkretisierte Kompetenzerwartungen</th><th>Materialvorschläge</th></tr></thead>
          <tbody>${seqRows}</tbody></table></div>
        ${extras}
        ${noteBox(m.id, `Notizen ${m.label}`)}
      </div></details>`;
  }

  /* ---------- Ansichten ---------- */
  function viewRahmen() {
    const sec = RAHMEN.map((r, i) => {
      const neu = r.teile.filter((t) => t.q === "neu");
      const hw = r.teile.find((t) => t.q === "hw"), tc = r.teile.find((t) => t.q === "tc");
      const part = (t) => t ? `${src(t.q)}${t.hinweis ? `<p class="hinweis">${esc(t.hinweis)}</p>` : ""}${(t.absaetze || []).map((a) => `<p>${esc(a)}</p>`).join("")}${ul(t.liste)}${(t.nach || []).map((a) => `<p>${esc(a)}</p>`).join("")}` : notGiven("In diesem Plan nicht ausgewiesen.");
      return `<div class="card"><h3>1.${i + 1} ${esc(r.titel)}</h3>
        ${neu.map((t) => `<div class="box neu">${src("neu")}${t.absaetze.map((a) => `<p>${esc(a)}</p>`).join("")}</div>`).join("")}
        ${hw || tc ? `<div class="grid g2" style="margin-top:${neu.length ? 12 : 0}px"><div class="col hw">${part(hw)}</div><div class="col tc">${part(tc)}</div></div>` : ""}
        ${noteBox("rahmen-" + i, "Notizen " + r.titel)}</div>`;
    }).join("");
    const g = GRUNDSAETZE_TC;
    return `
    <div class="card"><h2>1 Rahmenbedingungen der fachlichen Arbeit</h2>
      <p>Die Texte beider bisherigen Pläne stehen nebeneinander und sind nach Quelle gekennzeichnet: ${src("hw")} ${src("tc")} ${src("neu")}. Für den gemeinsamen Plan ist je Abschnitt eine gemeinsame Fassung zu beschließen.</p></div>
    ${sec}
    <div class="card"><h3>1.${RAHMEN.length + 1} Grundsätze der fachmethodischen und fachdidaktischen Arbeit</h3>
      <div class="grid g2"><div class="col hw">${src("hw")}${notGiven("Im HW-Plan kein eigenes Kapitel; Grundsätze sind in Abschnitt 1.5 „Fachliche Bezüge zu schulischen Standards“ enthalten.")}</div>
      <div class="col tc">${src("tc")}<p>${esc(g.einleitung)}</p><p><b>Überfachliche Grundsätze</b></p><ol>${g.ueberfachlich.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p><b>Fachliche Grundsätze</b></p><ol start="15">${g.fachlich.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div></div>
      ${noteBox("grundsaetze", "Notizen Grundsätze")}</div>`;
  }

  function viewUebersicht() {
    const modell = JGS.map((jg) => `
      <div class="jgl">Jg. ${jg}</div>
      <div class="hj hw"><b>Schwerpunkthalbjahr Hauswirtschaft</b><div class="row"><span class="bar ds hw">2 Std. Hauswirtschaft</span><span class="bar es">1 Std. Wirtschaft</span></div></div>
      <div class="hj tc"><b>Schwerpunkthalbjahr Technik</b><div class="row"><span class="bar ds tc">2 Std. Technik</span><span class="bar es">1 Std. Wirtschaft</span></div></div>`).join("");
    const cell = (jg, f) => byJg(jg, f).map((m) => `<div class="ovitem"><a class="t" href="#jg${jg}" data-open="uv-${m.id}"><b>${esc(m.label)}</b> ${esc(m.titel)}</a>
        <div>${m.fachIF.map((n) => chipF(f, n)).join("")}${m.wiIF.map((w) => chipWI(w.n, w.opt)).join("") || '<span class="chip">ohne Wi-IF</span>'}<small class="muted"> ${esc(m.zeit.replace(/\s*\(.*\)/, ""))}</small></div></div>`).join("");
    const rows = JGS.map((jg) => `<tr><td>${jg}</td><td class="fcol hw">${cell(jg, "hw")}</td><td class="fcol tc">${cell(jg, "tc")}</td></tr>`).join("");
    return `
    <div class="card"><h2>2 Übersicht über die Unterrichtsvorhaben</h2>
      <p>Wirtschaft und Arbeitswelt wird in den Jahrgängen 7–10 dreistündig in <b>Schwerpunkthalbjahren</b> unterrichtet: je Jahrgang ein Halbjahr Hauswirtschaft und ein Halbjahr Technik. Die <b>Doppelstunde</b> trägt den fachpraktischen Schwerpunkt, die <b>Einzelstunde</b> Wirtschaftsthemen, die mit dem Fach verknüpft sind. Die Reihenfolge der Halbjahre hängt von der Personalplanung ab.</p>
      <div class="modell">${modell}</div>
    </div>
    <div class="card">
      <div class="legend" style="margin-bottom:8px"><span><i class="sw" style="background:var(--hw)"></i>Hauswirtschaft</span><span><i class="sw" style="background:var(--tc)"></i>Technik</span><span><i class="sw" style="background:var(--wi)"></i>Wirtschaft</span></div>
      <div class="tablewrap"><table class="ov">
        <thead><tr><th>Jg.</th><th class="hw">Schwerpunkthalbjahr Hauswirtschaft ${src("hw")}</th><th class="tc">Schwerpunkthalbjahr Technik ${src("tcneu")}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </div>
    ${noteBox("uebersicht", "Notizen zur Gesamtstruktur")}`;
  }

  function viewJahrgang(jg) {
    const card = (f) => {
      const ms = byJg(jg, f);
      return `<div class="jgcard ${f}"><div class="jgct"><span class="fbadge ${f}">${FACH[f]}</span> Schwerpunkthalbjahr</div>
        ${ms.map((m) => `<a href="#uv-${m.id}" data-open="uv-${m.id}" class="jgitem"><b>${esc(m.label)}</b> ${esc(m.titel)}</a>`).join("")}
        <div class="muted" style="margin-top:6px">Zeitbedarf: ${esc(zeitText(jg, f))} Std. · Rahmen: ca. 54 Std.</div></div>`;
    };
    return `
    <div class="card"><h2>Jahrgang ${jg}</h2>
      <div class="grid g2">${card("hw")}${card("tc")}</div>
      <div class="noprint" style="margin-top:12px;display:flex;gap:8px"><button class="btn" data-act="openall">Alle Vorhaben aufklappen</button><button class="btn" data-act="closeall">Alle zuklappen</button></div>
    </div>
    <div class="fachblock hw"><h3 class="fh hw">Hauswirtschaft · Jahrgang ${jg}</h3>${byJg(jg, "hw").map(renderUV).join("")}</div>
    <div class="fachblock tc"><h3 class="fh tc">Technik · Jahrgang ${jg}</h3>${byJg(jg, "tc").map(renderUV).join("")}</div>
    ${noteBox("jg" + jg, `Notizen Jahrgang ${jg} (fachübergreifend)`)}`;
  }

  function viewAbdeckung() {
    const head = `<th>Jg. 7</th><th>Jg. 8</th><th>Jg. 9</th><th>Jg. 10</th>`;
    const wiRows = Object.keys(IF_WI).map((k) => {
      const n = +k;
      return `<tr><td><b>IF ${n}</b> ${esc(IF_WI[n].name)}</td>${JGS.map((jg) => `<td>${["hw", "tc"].flatMap((f) => byJg(jg, f).filter((m) => m.wiIF.some((w) => w.n === n)).map((m) => `<span class="chip ${f}">${esc(m.label)}${m.wiIF.find((w) => w.n === n).opt ? " (erg.)" : ""}</span>`)).join("")}</td>`).join("")}</tr>`;
    }).join("");
    const fachIF = (f, dict) => Object.keys(dict).map((k) => {
      const n = +k, name = f === "hw" ? dict[n] : dict[n].name;
      return `<tr><td><b>IF ${n}</b> ${esc(name)}</td>${JGS.map((jg) => `<td>${byJg(jg, f).filter((m) => m.fachIF.includes(n)).map((m) => `<span class="chip ${f}">${esc(m.label)}</span>`).join("")}</td>`).join("")}</tr>`;
    }).join("");
    const kompRows = (f) => {
      const all = {};
      JGS.forEach((jg) => byJg(jg, f).forEach((m) => codesOf(m.kompFach).forEach((c) => { (all[c] = all[c] || new Set()).add(jg); })));
      const order = (c) => ["SK", "MK", "UK", "HK"].indexOf(c.slice(0, 2)) * 100 + +c.slice(2);
      const codes = f === "tc" ? Object.keys(KLP_TC) : Object.keys(all).sort((a, b) => order(a) - order(b));
      return codes.map((c) => `<tr><td><b>${c.replace(/(\D+)(\d+)/, "$1 $2")}</b>${f === "tc" ? ` <small>${esc(KLP_TC[c])}</small>` : ""}</td>${JGS.map((jg) => `<td>${all[c] && all[c].has(jg) ? `<span class="dot ${f}"></span>` : ""}</td>`).join("")}<td class="${all[c] ? "" : "zero"}">${all[c] ? all[c].size : 0}</td></tr>`).join("");
    };
    const mkrRows = JGS.map((jg) => `<tr><td><b>${jg}</b></td>${["hw", "tc"].map((f) => `<td class="fcol ${f}">${byJg(jg, f).map((m) => `<div><b>${esc(m.label)}</b>${ul(m.mkr)}</div>`).join("")}</td>`).join("")}</tr>`).join("");
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
    const bil = JGS.map((jg) => `<tr><td><b>${jg}</b></td><td>${esc(zeitText(jg, "hw"))} Std.</td><td>${esc(zeitText(jg, "tc"))} Std.</td><td>ca. 54 Std.</td></tr>`).join("");

    return `
    <div class="card"><h2>Abdeckung des Kernlehrplans</h2>
      <p class="muted">Automatisch aus den Planungsdaten berechnet. HW-Werte stammen aus den Angaben des HW-Plans (Inhaltsfelder, Kompetenzcodes in „Schwerpunkte der Kompetenzentwicklung“).</p></div>
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
    <div class="card"><h3>Stundenbilanz pro Schwerpunkthalbjahr</h3><table><thead><tr><th>Jg.</th><th class="hw">Hauswirtschaft (laut HW-Plan)</th><th class="tc">Technik (Entwurf)</th><th>Rahmen</th></tr></thead><tbody>${bil}</tbody></table></div>
    <div class="card t-mkr"><h3>Einbindung in den Medienkompetenzrahmen</h3><div class="tablewrap"><table><thead><tr><th>Jg.</th><th class="hw">Hauswirtschaft</th><th class="tc">Technik</th></tr></thead><tbody>${mkrRows}</tbody></table></div></div>
    <div class="card"><h3>Berufsorientierung und BNE</h3>
      <p class="muted">Der HW-Plan weist BO und BNE nicht gesondert aus. Angezeigt werden wörtliche Fundstellen aus den HW-Sequenzen (Suche nach „Beruf“ bzw. „nachhaltig / Klima / Ressourcen / fair“).</p>
      <div class="tablewrap"><table><thead><tr><th>Jg.</th><th class="hw">BO · HW (Fundstellen)</th><th class="tc">BO · Technik</th><th class="hw">BNE · HW (Fundstellen)</th><th class="tc">BNE · Technik</th></tr></thead><tbody>${qRows}</tbody></table></div></div>
    ${noteBox("abdeckung", "Notizen zur Abdeckung")}`;
  }

  function viewLeistung() {
    const L = LEISTUNG;
    return `
    <div class="card"><h2>5 Grundsätze der Leistungsbewertung und Rückmeldung</h2>
      <div class="box neu">${src("hw")} <b>Vorschlag:</b> Kapitel 5 des HW-Plans ist bereits für den gesamten Wahlpflichtbereich formuliert und wird hier als gemeinsame Grundlage angezeigt. Technikspezifische Ergänzungen stehen am Ende und sind gekennzeichnet.</div>
      ${L.einleitung.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <div class="grid g2">
      <div class="card"><h3>Grundsätze</h3>${ul(L.grundsaetze)}</div>
      <div class="card"><h3>Verbindliche Absprachen</h3><ol>${L.absprachen.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Verbindliche Instrumente: Schriftliche Arbeiten</h3>${ul(L.instrSchriftlich)}</div>
      <div class="card"><h3>Verbindliche Instrumente: Sonstige Leistungen</h3>${ul(L.instrSonstige)}</div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Schriftliche Arbeiten</h3>${L.schriftlich.map((p) => `<p>${esc(p)}</p>`).join("")}
        <table><thead><tr><th>Prozentpunkte</th><th>Note</th></tr></thead><tbody>${L.schluessel.map(([p, n]) => `<tr><td>${p}</td><td>${n}</td></tr>`).join("")}</tbody></table></div>
      <div class="card"><h3>Sonstige Leistungen im Unterricht</h3>${L.sonstige.map((p) => `<p>${esc(p)}</p>`).join("")}
        <div class="grid g2 tight"><div><b>Theoretische Arbeit</b>${ul(L.theoretisch)}</div><div><b>Praktische Arbeit</b>${ul(L.praktisch)}</div></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Allgemeine Kriterien</h3><p>Die folgenden allgemeinen Kriterien gelten für schriftliche, mündliche, praktische und projektorientierte Formen der Leistungsbewertung:</p>${ul(L.allgemein)}</div>
      <div class="card"><h3>Kriterien bei Partner- und Gruppenarbeiten</h3><p>Bei Partner- und Gruppenarbeiten kann der individuelle Beitrag zum Ergebnis der Partner- bzw. Gruppenarbeit in die Bewertung einbezogen werden. Bewertet werden insbesondere:</p>${ul(L.gruppe)}</div>
    </div>
    <div class="card"><h3>Konkretisierte Kriterien für praktische Leistungen</h3>
      <div class="grid g2"><div class="col hw">${src("hw")}<p>Für praktische Leistungen, insbesondere im fachpraktischen Unterricht der Hauswirtschaft, gelten folgende Kriterien:</p>${ul(L.praxisHW)}</div>
      <div class="col tc">${src("tcneu")}<p>Entwurf für den fachpraktischen Unterricht in Technik:</p>${ul(L.tcPraxisEntwurf)}</div></div></div>
    <div class="grid g2">
      <div class="card"><h3>Arbeitsmappe, Portfolio oder digitale Dokumentation</h3><p>Bewertet werden insbesondere:</p>${ul(L.mappe)}</div>
      <div class="card"><h3>Kurzvortrag, Referat oder Präsentation</h3><p>Bewertet werden insbesondere:</p>${ul(L.vortrag)}</div>
    </div>
    <div class="card"><h3>Grundsätze der Leistungsrückmeldung und Beratung</h3>${L.rueckmeldung.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <div class="card"><h3>Technik: Ergänzungen</h3>
      <div class="grid g2"><div class="col tc">${src("tc")}<p><b>Beitragsformen im Fach Technik</b> (bisheriger Plan, Pflichtfach)</p>${ul(L.tcBeitraege)}<p><b>Kriterien für Beobachtungsbögen</b></p>${ul(L.tcBeobachtung)}</div>
      <div class="col tc">${src("tcneu")}<p><b>Leistungsnachweise je Technik-Halbjahr</b></p><table><tbody>${TC.map((t) => `<tr><td><b>Jg. ${t.jg}</b></td><td>${esc(t.leistung)}</td></tr>`).join("")}</tbody></table></div></div></div>
    ${noteBox("leistung", "Notizen zur Leistungsbewertung")}`;
  }

  function viewLehrwerke() {
    return `
    <div class="card"><h2>6 Lehr- und Lernmittel</h2>
      <div class="grid g2">
        <div class="col hw"><h3>Hauswirtschaft</h3>${src("hw")}${ul(LEHRWERKE.hw)}</div>
        <div class="col tc"><h3>Technik</h3>${src("tcneu")}<p class="hinweis">${esc(LEHRWERKE.tcHinweis)}</p>${ul(LEHRWERKE.tc)}</div>
      </div></div>
    ${noteBox("lehrwerke", "Notizen Lehrwerke")}`;
  }

  function viewSitzung() {
    const tags = { organisation: ["Organisation", "neu"], wirtschaft: ["Wirtschaft", "wi"], technik: ["Technik", "tc"], struktur: ["Struktur", "neu"], leistung: ["Leistung", "srl"], bo: ["Berufsorientierung", "bo"] };
    return `
    <div class="card"><h2>Gesprächsgrundlage für die Sitzung</h2>
      <p>Offene Punkte aus dem Abgleich beider Planungen. Status und Notizen werden lokal in diesem Browser gespeichert – vor der Sitzung ggf. exportieren.</p></div>
    ${DISKUSSION.map((d, i) => `<div class="card tight disc">
        <div><h3>${i + 1}. ${esc(d.titel)} <span class="chip ${tags[d.tag][1]}">${tags[d.tag][0]}</span></h3><p>${esc(d.text)}</p></div>
        <div class="noprint">${statusSelect(d.id)}</div>
        <div class="tagline">${noteBox(d.id, "Ergebnis / Notiz")}</div></div>`).join("")}
    <div class="card">${noteBox("protokoll", "Protokoll / weitere Punkte")}</div>`;
  }

  function collectNotes() {
    const all = store.all(), labels = {};
    document.querySelectorAll("textarea[data-note]").forEach((t) => { labels[t.dataset.note] = t.dataset.label; });
    return Object.keys(all).filter((k) => k.startsWith("note:") && all[k]).map((k) => {
      const id = k.slice(5); return { id, label: labels[id] || id, text: all[k], status: all["status:" + id] || "" };
    });
  }
  function viewNotizen() {
    return `
    <div class="card"><h2>Meine Notizen</h2>
      <p>Alle Notizen und Bearbeitungsstände werden <b>nur lokal in diesem Browser</b> gespeichert (localStorage). Zum Teilen oder Sichern exportieren.</p>
      <div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" data-act="export-md">Notizen als Markdown herunterladen</button>
        <button class="btn" data-act="export-json">Sicherung (JSON) herunterladen</button>
        <button class="btn" data-act="import-json">Sicherung einlesen</button>
        <button class="btn danger" data-act="clear">Alle Notizen löschen</button>
      </div></div>
    <div class="card notelist" id="notelist"></div>`;
  }
  function fillNotelist() {
    const el = document.getElementById("notelist"); if (!el) return;
    const notes = collectNotes();
    el.innerHTML = notes.length ? notes.map((n) => `<div class="item"><b>${esc(n.label)}</b> ${n.status ? `<span class="chip srl">${esc(n.status)}</span>` : ""}<pre>${esc(n.text)}</pre></div>`).join("") : `<p class="muted">Noch keine Notizen. Notizfelder gibt es in jedem Abschnitt.</p>`;
  }

  /* ---------- Aufbau ---------- */
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

  function build() {
    document.title = `${META.titel} – gemeinsamer SchiLP (Arbeitsversion)`;
    document.getElementById("app").innerHTML = `
      <header class="topbar">
        <div class="brand"><b>${esc(META.titel)}</b><span>${esc(META.untertitel)} · ${esc(META.schule)}</span></div>
        <span class="badge-draft">${esc(META.version)}</span>
        <span class="spacer"></span>
        <span style="font-size:.8rem;opacity:.8">Stand ${esc(META.stand)}</span>
        <button data-act="print">Ansicht drucken</button>
        <button data-act="printall">Gesamt drucken</button>
      </header>
      <nav class="tabs"><div class="inner">${VIEWS.map((v) => `<a href="#${v.id}" data-view="${v.id}">${v.label}</a>`).join("")}</div>
        <div class="filterbar">
          <span class="lbl">Fach:</span>
          <span class="seg"><button data-fach="beide">Beide</button><button data-fach="hw">Hauswirtschaft</button><button data-fach="tc">Technik</button></span>
          <span class="lbl" style="margin-left:12px">Hervorheben:</span>
          <button class="fchip" data-f="wi">Wirtschaft</button>
          <button class="fchip" data-f="bo">Berufsorientierung</button>
          <button class="fchip" data-f="bne">BNE</button>
          <button class="fchip" data-f="mkr">Medienkompetenz</button>
          <button class="fchip" data-f="srl">SRL</button>
        </div></nav>
      <main>${VIEWS.map((v) => `<section class="view" id="view-${v.id}">${v.render()}</section>`).join("")}</main>
      <div class="foot">${esc(META.schule)} · Gemeinsamer SchiLP Wirtschaft und Arbeitswelt · ${esc(META.version)} · HW-Inhalte wörtlich aus dem SchiLP Hauswirtschaft (Stand 31.08.2026) · Notizen nur lokal gespeichert</div>
      <div class="toast" id="toast"></div>
      <input type="file" id="importfile" accept="application/json" hidden>`;
  }

  function show(id) {
    let target = null;
    if (id && id.startsWith("uv-")) { target = id; const m = MODELS.find((x) => "uv-" + x.id === id); id = m ? "jg" + m.jg : "uebersicht"; }
    if (!VIEWS.some((v) => v.id === id)) id = "rahmen";
    document.querySelectorAll("section.view").forEach((s) => s.classList.toggle("active", s.id === "view-" + id));
    document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === id));
    if (id === "notizen") fillNotelist();
    store.set("ui:view", id);
    if (target) openUV(target);
  }
  function openUV(domId) {
    const d = document.getElementById(domId); if (!d) return;
    d.open = true; setTimeout(() => d.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  function setFach(f) {
    document.body.classList.remove("only-hw", "only-tc");
    if (f === "hw" || f === "tc") document.body.classList.add("only-" + f);
    document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.fach === (f || "beide")));
    store.set("ui:fach", f === "beide" ? "" : f);
  }
  function toast(msg) {
    const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type }); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function bind() {
    const timers = {};
    document.addEventListener("input", (e) => {
      const ta = e.target.closest("textarea[data-note]"); if (!ta) return;
      const key = ta.dataset.note; clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        store.set("note:" + key, ta.value);
        const box = ta.closest(".note"); box.classList.toggle("has", !!ta.value);
        const s = box.querySelector(".saved"); s.classList.add("show"); setTimeout(() => s.classList.remove("show"), 1200);
      }, 400);
    });
    document.addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-status]");
      if (sel) { store.set("status:" + sel.dataset.status, sel.value === "offen" ? "" : sel.value); sel.dataset.v = sel.value; toast("Status gespeichert"); }
    });
    document.addEventListener("click", (e) => {
      const f = e.target.closest(".fchip");
      if (f) {
        f.classList.toggle("on"); document.body.classList.toggle("hl-" + f.dataset.f, f.classList.contains("on"));
        store.set("ui:filter", [...document.querySelectorAll(".fchip.on")].map((x) => x.dataset.f).join(",")); return;
      }
      const sg = e.target.closest(".seg button"); if (sg) { setFach(sg.dataset.fach); return; }
      const op = e.target.closest("[data-open]");
      if (op) { e.preventDefault(); const id = op.dataset.open; history.replaceState(null, "", "#" + id); show(id); return; }
      const b = e.target.closest("[data-act]"); if (!b) return;
      const act = b.dataset.act;
      if (act === "openall" || act === "closeall") document.querySelectorAll("section.view.active details.uv").forEach((d) => d.open = act === "openall");
      if (act === "print") { document.body.classList.remove("printall"); document.querySelectorAll("section.view.active details.uv").forEach((d) => d.open = true); window.print(); }
      if (act === "printall") { document.body.classList.add("printall"); document.querySelectorAll("details.uv").forEach((d) => d.open = true); window.print(); setTimeout(() => document.body.classList.remove("printall"), 500); }
      if (act === "export-md") {
        const notes = collectNotes();
        const md = `# Notizen gemeinsamer SchiLP WAW (${new Date().toLocaleDateString("de-DE")})\n\n` + (notes.map((n) => `## ${n.label}${n.status ? ` _(Status: ${n.status})_` : ""}\n\n${n.text}\n`).join("\n") || "_keine Notizen_\n");
        download(`schilp-waw-notizen-${new Date().toISOString().slice(0, 10)}.md`, md, "text/markdown");
      }
      if (act === "export-json") download(`schilp-waw-sicherung-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.all(), null, 2), "application/json");
      if (act === "import-json") document.getElementById("importfile").click();
      if (act === "clear" && confirmClear()) {
        Object.keys(store.all()).forEach((k) => { if (k.startsWith("note:") || k.startsWith("status:")) store.set(k, ""); });
        rerender(); toast("Notizen gelöscht");
      }
    });
    document.getElementById("importfile").addEventListener("change", (e) => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        try { const data = JSON.parse(r.result); Object.entries(data).forEach(([k, v]) => { if (/^(note|status|ui):/.test(k)) store.set(k, v); }); rerender(); toast("Sicherung eingelesen"); }
        catch (err) { toast("Datei konnte nicht gelesen werden"); }
      };
      r.readAsText(file); e.target.value = "";
    });
    window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  }
  let clearArmed = 0;
  function confirmClear() {
    if (Date.now() - clearArmed < 4000) { clearArmed = 0; return true; }
    clearArmed = Date.now(); toast("Zum Löschen innerhalb von 4 Sekunden erneut klicken"); return false;
  }
  function rerender() {
    const cur = location.hash.slice(1) || store.get("ui:view") || "rahmen";
    VIEWS.forEach((v) => { document.getElementById("view-" + v.id).innerHTML = v.render(); });
    show(cur);
  }
  function restoreUI() {
    (store.get("ui:filter") || "").split(",").filter(Boolean).forEach((f) => {
      const b = document.querySelector(`.fchip[data-f="${f}"]`); if (b) { b.classList.add("on"); document.body.classList.add("hl-" + f); }
    });
    setFach(store.get("ui:fach") || "beide");
  }

  build(); bind(); restoreUI();
  show(location.hash.slice(1) || store.get("ui:view") || "rahmen");
})();
