/* =========================================================================
   SchiLP WAW – Rendering, Navigation, Filter, Notizen (localStorage)
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- Speicher (localStorage mit Fallback) ---------- */
  const PREFIX = "schilp-waw:";
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(PREFIX + k); return v === null ? (mem[k] ?? "") : v; } catch (e) { return mem[k] ?? ""; } },
    set(k, v) { mem[k] = v; try { if (v === "" || v == null) localStorage.removeItem(PREFIX + k); else localStorage.setItem(PREFIX + k, v); } catch (e) { /* privat/gesperrt */ } },
    all() {
      const out = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = localStorage.getItem(k); } } catch (e) { Object.assign(out, mem); }
      return out;
    },
  };

  /* ---------- Hilfen ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ul = (arr, cls = "") => arr && arr.length ? `<ul class="${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">–</p>`;
  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
  const chipTC = (n) => `<span class="chip tc" title="${esc(IF_TC[n].name)}">TC IF ${n} · ${esc(IF_TC[n].name)}</span>`;
  const chipWI = (n, short) => `<span class="chip wi t-wi" title="${esc(IF_WI[n].name)}">Wi IF ${n}${short ? " · " + esc(IF_WI[n].kurz) : " · " + esc(IF_WI[n].name)}</span>`;
  const chipHW = (n) => `<span class="chip hw" title="${esc(IF_HW[n])}">HW IF ${n} · ${esc(IF_HW[n])}</span>`;
  const chipCode = (c, dict) => `<span class="chip code" title="${esc(dict[c] || "")}">${c.replace(/(\D+)(\d+)/, "$1 $2")}</span>`;
  const chipMKR = (c) => `<span class="chip mkr t-mkr" title="${esc(MKR[c] || "")}">MKR ${c}</span>`;
  const chipSDG = (n) => `<span class="chip bne" title="${esc(SDG[n] || "")}">SDG ${n}${SDG[n] ? " · " + esc(SDG[n]) : ""}</span>`;
  const hwLabel = (h) => `HW ${h.jg}.${h.nr}`;

  const STATI = ["offen", "diskutiert", "beschlossen", "zurückgestellt"];
  function statusSelect(key) {
    const v = store.get("status:" + key) || "offen";
    return `<select class="status noprint-ok" data-status="${key}" data-v="${v}" title="Bearbeitungsstand (lokal gespeichert)">${STATI.map((s) => `<option ${s === v ? "selected" : ""}>${s}</option>`).join("")}</select>`;
  }
  function noteBox(key, label) {
    const v = store.get("note:" + key);
    return `<div class="note ${v ? "has" : ""}"><label><span>✎ ${esc(label || "Notizen")}</span><span class="saved">gespeichert ✓</span></label><textarea data-note="${key}" data-label="${esc(label || "")}" placeholder="Eigene Notizen, Änderungswünsche, Fragen … (werden nur in diesem Browser gespeichert)">${esc(v)}</textarea></div>`;
  }

  /* ---------- Ansichten ---------- */
  function viewUebersicht() {
    const modell = [7, 8, 9, 10].map((jg) => `
      <div class="jgl">Jg. ${jg}</div>
      <div class="hj tc"><b>Schwerpunkt Technik</b><div class="row"><span class="bar ds tc">2 Std. Technik (Fachraum)</span><span class="bar es">1 Std. Wirtschaft</span></div></div>
      <div class="hj hw"><b>Schwerpunkt Hauswirtschaft</b><div class="row"><span class="bar ds hw">2 Std. HW (Lehrküche)</span><span class="bar es">1 Std. Wirtschaft</span></div></div>`).join("");

    const rows = [7, 8, 9, 10].map((jg) => {
      const t = TC.find((x) => x.jg === jg);
      const hws = HW.filter((x) => x.jg === jg);
      return `<tr>
        <td>${jg}</td>
        <td>
          <a class="t" href="#jg${jg}">${esc(t.titel)}</a><small>${esc(t.untertitel)}</small><br>
          ${t.tcIF.map((n) => `<span class="chip tc">TC IF ${n}</span>`).join("")}
          ${t.wiIF.map((n) => chipWI(n, true)).join("")}<br>
          <span class="chip bo t-bo">BO: ${esc(t.bo.berufe[0])} …</span>
          ${t.bne.sdg.map((n) => `<span class="chip bne t-bne">SDG ${n}</span>`).join("")}
          ${t.mkr.map((m) => chipMKR(m.code)).join("")}
        </td>
        <td>${hws.map((h) => `<div class="hwitem"><b>${hwLabel(h)}</b> ${esc(h.titel)}<br>${h.hwIF.map((n) => `<span class="chip hw">HW IF ${n}</span>`).join("")}${h.wiIF.map((n) => chipWI(n, true)).join("") || '<span class="chip">ohne Wi-Bezug</span>'} <small>${esc(h.zeit)}</small></div>`).join("")}</td>
      </tr>`;
    }).join("");

    return `
    <div class="card">
      <h2>Organisationsmodell</h2>
      <p>Das Wahlpflichtfach <b>Wirtschaft und Arbeitswelt</b> wird in den Jahrgängen 7–10 mit <b>drei Wochenstunden</b> unterrichtet – fächerintegriert in <b>Schwerpunkthalbjahren</b>. Jeder Jahrgang hat ein Halbjahr Schwerpunkt Technik und ein Halbjahr Schwerpunkt Hauswirtschaft (insgesamt je vier Halbjahre). Die <b>Doppelstunde</b> trägt den fachpraktischen Schwerpunkt, die <b>Einzelstunde</b> den Wirtschaftsschwerpunkt, der mit dem Fachthema verknüpft ist. <b>Es gibt keinen eigenständigen Wirtschaftsunterricht.</b></p>
      <div class="box warn"><b>Reihenfolge variabel:</b> Welches Halbjahr Technik bzw. Hauswirtschaft ist, hängt von der Personalplanung ab. Jedes Vorhaben ist deshalb in sich geschlossen geplant.</div>
      <div class="modell" style="margin-top:14px">${modell}</div>
      <p class="muted" style="margin-top:10px">Zeitrahmen pro Schwerpunkthalbjahr (ca. 18 Unterrichtswochen): ca. 36 Std. fachpraktisch + ca. 18 Std. Wirtschaft.</p>
    </div>

    <div class="card">
      <h2>Übersicht der Unterrichtsvorhaben</h2>
      <div class="legend" style="margin-bottom:8px"><span><i class="sw" style="background:var(--tc)"></i>Technik</span><span><i class="sw" style="background:var(--hw)"></i>Hauswirtschaft</span><span><i class="sw" style="background:var(--wi)"></i>Wirtschaft</span><span><i class="sw" style="background:var(--bo)"></i>Berufsorientierung</span><span><i class="sw" style="background:var(--bne)"></i>BNE</span><span><i class="sw" style="background:var(--mkr)"></i>Medienkompetenz</span></div>
      <div class="tablewrap"><table class="ov">
        <thead><tr><th>Jg.</th><th>Schwerpunkthalbjahr Technik (Entwurf)</th><th>Schwerpunkthalbjahr Hauswirtschaft (Planung HW)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>Grundlagen</h3>
        <ul>
          <li>Kernlehrplan Wahlpflichtfach Wirtschaft und Arbeitswelt, Gesamtschule NRW (Heft 31031) – Abschnitte Wirtschaft, Hauswirtschaft, Technik</li>
          <li>Medienkompetenzrahmen NRW · Leitlinie BNE · Rahmenvorgabe Verbraucherbildung · KAoA</li>
          <li>Technik: <i>${esc(META.lehrwerkTC)}</i></li>
          <li>Wirtschaft: <i>${esc(META.lehrwerkWI)}</i></li>
          <li>Hauswirtschaft: <i>${esc(META.lehrwerkHW)}</i></li>
        </ul>
      </div>
      <div class="card">
        <h3>Leitideen für den Technik-Teil</h3>
        <ul>
          <li><b>Progression:</b> Einzelfertigung (7) → Serienfertigung (8) → Automatisierung (9) → vernetzte Systeme (10)</li>
          <li><b>Selbstreguliertes Lernen:</b> Kompetenzraster mit Mindest-, Regel- und Expertenstandard; Phasen Planung – Durchführung – Reflexion</li>
          <li><b>Wirtschaft eingebunden:</b> jede Einzelstunde greift das Technikthema auf (Betrieb, Kosten, Markt, Arbeit, Region)</li>
          <li><b>IF 1 „Zukunftsgestaltung durch Technik“</b> als Querschnitt in allen vier Halbjahren</li>
        </ul>
      </div>
    </div>
    ${noteBox("uebersicht", "Notizen zur Gesamtstruktur")}`;
  }

  function viewTC(t) {
    const ds = sum(t.sequenzen, "ds"), es = sum(t.sequenzen, "es");
    const seqRows = t.sequenzen.map((s, i) => `<tr>
        <td>${i + 1}. ${esc(s.titel)}</td>
        <td>${s.ds ? `<span class="chip time">${s.ds} Std.</span>` : '<span class="muted">–</span>'}${ul(s.praxis)}</td>
        <td class="wi t-wi">${s.es ? `<span class="chip time es">${s.es} Std.</span>` : ""}${ul(s.wirtschaft)}</td>
        <td>${s.bp ? `<span class="h">Blickpunkt Technik</span>${esc(s.bp)}` : ""}${s.ss ? `<span class="h" style="margin-top:6px">starkeSeiten Wirtschaft</span>${esc(s.ss)}` : ""}</td>
      </tr>`).join("");

    const raster = t.raster.map((r) => `<tr class="${r.wi ? "wi t-wi" : ""}${r.bo ? " bo t-bo" : ""}${r.bne ? " bne t-bne" : ""}">
        <td class="b">${esc(r.bereich)}<small>${esc(r.codes)}</small></td><td>${esc(r.m)}</td><td>${esc(r.r)}</td><td>${esc(r.e)}</td></tr>`).join("");

    const hws = HW.filter((h) => h.jg === t.jg);

    return `
    <div class="card">
      <div class="hero">
        <div class="jg"><small>Jg.</small><b>${t.jg}</b></div>
        <div class="ttl">
          <h2>${esc(t.titel)}</h2>
          <div class="sub">Schwerpunkthalbjahr Technik · ${esc(t.untertitel)}</div>
          <div><span class="chip time">${ds} Std. Doppelstunde Technik</span> <span class="chip time es">${es} Std. Einzelstunde Wirtschaft</span></div>
          <div class="leitfrage">Leitfrage: ${esc(t.leitfrage)}</div>
        </div>
        <div class="noprint">${statusSelect(t.id)}</div>
      </div>
    </div>

    <div class="grid g2">
      <div class="box tc"><h4>Inhaltsfelder Technik</h4>
        ${t.tcIF.map(chipTC).join("<br>")}
        <p style="margin-top:8px"><b>Inhaltliche Schwerpunkte</b></p>${ul(t.tcSP)}
        <p><b>Schwerpunkte der Kompetenzentwicklung</b></p>
        <div>${t.kompetenzen.map((c) => chipCode(c, KLP_TC)).join("")}</div>
        <details class="noprint" style="margin-top:6px"><summary class="muted" style="cursor:pointer">Kompetenzen ausformuliert</summary>
          <ul>${t.kompetenzen.map((c) => `<li><b>${c}</b> – ${esc(KLP_TC[c])}</li>`).join("")}</ul></details>
      </div>
      <div class="box wi t-wi"><h4>Ergänzend Wirtschaft (Einzelstunde)</h4>
        ${t.wiIF.map((n) => chipWI(n)).join("<br>")}
        <p style="margin-top:8px"><b>Inhaltliche Schwerpunkte</b></p>${ul(t.wiSP)}
        <p><b>Die Lernenden …</b></p>${ul(t.wiKompetenzen)}
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <h3>Sequenzplanung</h3>
      <div class="tablewrap"><table class="seq">
        <thead><tr><th>Sequenz</th><th>Doppelstunde: Technik</th><th>Einzelstunde: Wirtschaft</th><th>Lehrwerk</th></tr></thead>
        <tbody>${seqRows}</tbody>
        <tfoot><tr><td>Summe</td><td>${ds} Std.</td><td>${es} Std.</td><td></td></tr></tfoot>
      </table></div>
    </div>

    <div class="grid g3">
      <div class="box bo t-bo"><h4>Berufsorientierung</h4>
        <p><b>Berufe</b></p>${ul(t.bo.berufe)}<p><b>Elemente</b></p>${ul(t.bo.elemente)}</div>
      <div class="box bne t-bne"><h4>Bildung für nachhaltige Entwicklung</h4>
        <div>${t.bne.sdg.map(chipSDG).join("<br>")}</div>${ul(t.bne.punkte)}</div>
      <div class="box mkr t-mkr"><h4>Medienkompetenzrahmen</h4>
        <ul>${t.mkr.map((m) => `<li><b>${m.code} ${esc(MKR[m.code])}</b><br><small>${esc(m.text)}</small></li>`).join("")}</ul></div>
    </div>

    <div class="card t-srl" style="margin-top:18px">
      <h3>Selbstreguliertes Lernen</h3>
      <div class="grid g3">
        <div class="box srl"><h4>Planung</h4>${ul(t.srl.planung)}</div>
        <div class="box srl"><h4>Durchführung</h4>${ul(t.srl.durchfuehrung)}</div>
        <div class="box srl"><h4>Reflexion</h4>${ul(t.srl.reflexion)}</div>
      </div>
    </div>

    <div class="card t-srl">
      <h3>Kompetenzraster <small class="muted">– „Ich kann …“ für Selbsteinschätzung und Lerngespräche</small></h3>
      <div class="tablewrap"><table class="raster">
        <thead><tr><th>Bereich</th><th class="m">Mindeststandard</th><th class="r">Regelstandard</th><th class="e">Expertenstandard</th></tr></thead>
        <tbody>${raster}</tbody>
      </table></div>
    </div>

    <div class="grid g2">
      <div class="card tight"><h3>Produkte und Leistungsnachweise</h3>${ul(t.produkte)}<p class="muted">${esc(t.leistung)}</p></div>
      <div class="card tight"><h3>Außerschulische Lernorte</h3>${ul(t.lernorte)}</div>
    </div>
    <div class="grid g2">
      <div class="box hw"><h4>Bezug zur Hauswirtschaft</h4><p>${esc(t.hwBezug)}</p></div>
      <div class="box"><h4>Bezug zum bisherigen Plan</h4><p>${esc(t.bisher)}</p></div>
    </div>
    ${noteBox(t.id, `Notizen Technik Jg. ${t.jg}`)}

    <h2 style="margin-top:34px">Schwerpunkthalbjahr Hauswirtschaft · Jg. ${t.jg}</h2>
    <p class="muted">Planung der Fachschaft Hauswirtschaft (SchiLP, Stand 31.08.2026), hier zusammengefasst. Kompetenzcodes = HW-Codes.</p>
    ${hws.map(viewHW).join("")}`;
  }

  function viewHW(h) {
    return `<details class="hwuv" id="${h.id}">
      <summary><span class="chip hw">${hwLabel(h)}</span> ${esc(h.titel)} <small class="muted">${esc(h.zeit)}</small></summary>
      <div class="body">
        <div class="grid g2">
          <div class="box hw"><h4>Inhaltsfelder Hauswirtschaft</h4>${h.hwIF.map(chipHW).join("<br>")}
            <p style="margin-top:8px"><b>Inhaltliche Schwerpunkte</b></p>${ul(h.inhalteHW)}
            <p><b>Kompetenzschwerpunkte</b></p><div>${h.kompetenzen.map((c) => chipCode(c, KLP_HW)).join("")}</div></div>
          <div class="box wi t-wi"><h4>Ergänzend Wirtschaft</h4>${h.wiIF.length ? h.wiIF.map((n) => chipWI(n)).join("<br>") : '<p class="muted">kein Wirtschaftsbezug ausgewiesen</p>'}
            ${h.inhalteWi.length ? `<p style="margin-top:8px"><b>Inhaltliche Schwerpunkte</b></p>${ul(h.inhalteWi)}` : ""}
            ${h.wi.length ? `<p><b>Die Lernenden …</b></p>${ul(h.wi)}` : ""}</div>
        </div>
        <div class="grid g3" style="margin-top:12px">
          <div class="box"><h4>Sequenzen</h4><ul>${h.sequenzen.map((s) => `<li>${esc(s.titel)} <small class="muted">${s.std !== "–" ? "(" + esc(s.std) + " Std.)" : ""}</small></li>`).join("")}</ul></div>
          <div class="box mkr t-mkr"><h4>Medienkompetenz</h4>${ul(h.mkrText)}<div>${h.mkr.map(chipMKR).join("")}</div><small class="muted">Codes: Zuordnung als Vorschlag</small></div>
          <div class="box bne"><h4>BO · BNE</h4>
            <div class="t-bo"><b>BO:</b> ${h.bo ? esc(h.bo) : '<span class="muted">nicht explizit</span>'}</div>
            <div class="t-bne" style="margin-top:6px"><b>BNE:</b> ${esc(h.bne)}<br>${h.sdg.map((n) => `<span class="chip bne">SDG ${n}</span>`).join("")}</div>
            <small class="muted">abgeleitet aus dem HW-Plan</small></div>
        </div>
        ${noteBox(h.id, `Notizen ${hwLabel(h)}`)}
      </div></details>`;
  }

  function viewAbdeckung() {
    const jgs = [7, 8, 9, 10];
    // Technik-Kompetenzen
    const kRows = Object.keys(KLP_TC).map((c) => {
      const hits = jgs.map((jg) => TC.find((t) => t.jg === jg).kompetenzen.includes(c));
      const n = hits.filter(Boolean).length;
      return `<tr><td><b>${c}</b> <small>${esc(KLP_TC[c])}</small></td>${hits.map((h) => `<td>${h ? '<span class="dot"></span>' : ""}</td>`).join("")}<td class="${n ? "" : "zero"}">${n}</td></tr>`;
    }).join("");
    // Technik-IF
    const ifRows = Object.keys(IF_TC).map((k) => {
      const n = +k;
      return `<tr><td><b>IF ${n}</b> ${esc(IF_TC[n].name)}</td>${jgs.map((jg) => { const t = TC.find((x) => x.jg === jg); const i = t.tcIF.indexOf(n); return `<td>${i === 0 ? '<span class="dot" title="Schwerpunkt"></span>' : i > 0 ? '<span class="dot q" title="Querschnitt"></span>' : ""}</td>`; }).join("")}</tr>`;
    }).join("");
    // Wirtschaft-IF
    const wiRows = Object.keys(IF_WI).map((k) => {
      const n = +k;
      const cells = jgs.map((jg) => {
        const t = TC.find((x) => x.jg === jg);
        const tc = t.wiIF.includes(n) ? `<span class="chip tc">TC ${jg}</span>` : "";
        const hw = HW.filter((h) => h.jg === jg && h.wiIF.includes(n)).map((h) => `<span class="chip hw">${hwLabel(h)}</span>`).join("");
        return `<td>${tc}${hw}</td>`;
      }).join("");
      return `<tr><td><b>IF ${n}</b> ${esc(IF_WI[n].name)}</td>${cells}</tr>`;
    }).join("");
    // MKR
    const mkrCodes = Object.keys(MKR).filter((c) => c.includes("."));
    const mkrRows = mkrCodes.map((c) => {
      const cells = jgs.map((jg) => {
        const t = TC.find((x) => x.jg === jg);
        const tc = t.mkr.some((m) => m.code === c) ? `<span class="chip tc">TC</span>` : "";
        const hw = HW.filter((h) => h.jg === jg && h.mkr.includes(c)).map((h) => `<span class="chip hw">${h.jg}.${h.nr}</span>`).join("");
        return `<td>${tc}${hw}</td>`;
      }).join("");
      const any = /chip/.test(cells);
      return `<tr><td><b>${c}</b> ${esc(MKR[c])}</td>${cells}<td class="${any ? "" : "muted"}">${any ? "✓" : "–"}</td></tr>`;
    }).join("");
    // Stundenbilanz
    const bil = jgs.map((jg) => {
      const t = TC.find((x) => x.jg === jg);
      const hws = HW.filter((h) => h.jg === jg);
      const hwStd = hws.map((h) => h.zeit.replace("ca. ", "")).join(" + ");
      return `<tr><td><b>${jg}</b></td><td>${sum(t.sequenzen, "ds")} + ${sum(t.sequenzen, "es")} = <b>${sum(t.sequenzen, "ds") + sum(t.sequenzen, "es")} Std.</b></td><td>${esc(hwStd)}</td><td>ca. 54 Std.</td></tr>`;
    }).join("");
    // BO/BNE
    const bobne = jgs.map((jg) => {
      const t = TC.find((x) => x.jg === jg);
      const hws = HW.filter((h) => h.jg === jg);
      return `<tr><td><b>${jg}</b></td>
        <td class="t-bo">${esc(t.bo.berufe.join(", "))}<br><small>${esc(t.bo.elemente[0])}</small></td>
        <td class="t-bo">${hws.map((h) => h.bo ? `<b>${hwLabel(h)}:</b> ${esc(h.bo)}` : "").filter(Boolean).join("<br>") || '<span class="muted">–</span>'}</td>
        <td class="t-bne">${t.bne.sdg.map((n) => `<span class="chip tc">SDG ${n}</span>`).join("")} ${hws.flatMap((h) => h.sdg).filter((v, i, a) => a.indexOf(v) === i).map((n) => `<span class="chip hw">SDG ${n}</span>`).join("")}</td></tr>`;
    }).join("");

    return `
    <div class="card"><h2>Abdeckung des Kernlehrplans</h2>
      <p class="muted">Wird automatisch aus den Planungsdaten berechnet. Rote „0“ = Kompetenz in keinem Technik-Halbjahr ausgewiesen.</p></div>
    <div class="grid g2">
      <div class="card"><h3>Technik: übergeordnete Kompetenzen</h3><div class="tablewrap"><table class="matrix">
        <thead><tr><th>Kompetenz</th>${jgs.map((j) => `<th>Jg. ${j}</th>`).join("")}<th>Σ</th></tr></thead><tbody>${kRows}</tbody></table></div>
        <small class="muted">Kurzfassungen; Wortlaut und Nummerierung gegen KLP Gesamtschule prüfen.</small></div>
      <div>
        <div class="card"><h3>Technik: Inhaltsfelder</h3><div class="tablewrap"><table class="matrix">
          <thead><tr><th>Inhaltsfeld</th>${jgs.map((j) => `<th>Jg. ${j}</th>`).join("")}</tr></thead><tbody>${ifRows}</tbody></table></div>
          <div class="legend" style="margin-top:6px"><span><span class="dot"></span> Schwerpunkt</span><span><span class="dot q"></span> Querschnitt</span></div></div>
        <div class="card"><h3>Stundenbilanz pro Schwerpunkthalbjahr</h3><div class="tablewrap"><table>
          <thead><tr><th>Jg.</th><th>Technik (DS + ES)</th><th>HW geplant</th><th>verfügbar</th></tr></thead><tbody>${bil}</tbody></table></div>
          <small class="muted">HW-Planung übersteigt den Zeitrahmen eines Halbjahres → siehe Sitzung, Punkt 2.</small></div>
      </div>
    </div>
    <div class="card t-wi"><h3>Wirtschaft: Inhaltsfelder nach Jahrgang und Fach</h3><div class="tablewrap"><table class="matrix">
      <thead><tr><th>Inhaltsfeld Wirtschaft</th>${jgs.map((j) => `<th>Jg. ${j}</th>`).join("")}</tr></thead><tbody>${wiRows}</tbody></table></div></div>
    <div class="card t-mkr"><h3>Medienkompetenzrahmen nach Jahrgang und Fach</h3><div class="tablewrap"><table class="matrix">
      <thead><tr><th>Teilkompetenz</th>${jgs.map((j) => `<th>Jg. ${j}</th>`).join("")}<th></th></tr></thead><tbody>${mkrRows}</tbody></table></div></div>
    <div class="card"><h3>Berufsorientierung und BNE</h3><div class="tablewrap"><table>
      <thead><tr><th>Jg.</th><th>BO Technik</th><th>BO Hauswirtschaft</th><th>BNE (SDG) – <span class="chip tc">TC</span><span class="chip hw">HW</span></th></tr></thead><tbody>${bobne}</tbody></table></div></div>
    ${noteBox("abdeckung", "Notizen zur Abdeckung")}`;
  }

  function viewLeistung() {
    return `
    <div class="card"><h2>Grundsätze der Leistungsbewertung</h2>
      <p>Gemeinsame Grundsätze für den Wahlpflichtbereich Wirtschaft und Arbeitswelt (aus dem SchiLP Hauswirtschaft übernommen), ergänzt um technikspezifische Formen.</p>
      <div class="box wi"><b>Gewichtung:</b> ${esc(LEISTUNG.gewichtung)}</div></div>
    <div class="grid g3">
      <div class="card"><h3>Schriftliche Arbeiten</h3>${ul(LEISTUNG.schriftlich)}
        <div class="box warn"><b>Vorschlag Technik:</b> pro Schwerpunkthalbjahr eine Klassenarbeit und eine Projektarbeit (Werkstück + Dokumentation). Rechtliche Prüfung des Ersatzes nötig.</div></div>
      <div class="card"><h3>Sonstige Leistungen Technik</h3>${ul(LEISTUNG.sonstigeTC)}</div>
      <div class="card"><h3>Kriterien fachpraktischer Arbeit</h3>${ul(LEISTUNG.kriterienPraxisTC)}</div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Notenschlüssel</h3><table><thead><tr><th>Prozent</th><th>Note</th></tr></thead>
        <tbody>${LEISTUNG.schluessel.map(([p, n]) => `<tr><td>${p}</td><td>${n}</td></tr>`).join("")}</tbody></table></div>
      <div class="card"><h3>Leistungsnachweise je Technik-Halbjahr</h3>
        <table><tbody>${TC.map((t) => `<tr><td><b>Jg. ${t.jg}</b></td><td>${esc(t.leistung)}</td></tr>`).join("")}</tbody></table></div>
    </div>
    ${noteBox("leistung", "Notizen zur Leistungsbewertung")}`;
  }

  function viewSitzung() {
    const tags = { organisation: ["Organisation", "tc"], wirtschaft: ["Wirtschaft", "wi"], technik: ["Technik", "tc"], leistung: ["Leistung", "srl"], bo: ["Berufsorientierung", "bo"] };
    return `
    <div class="card"><h2>Gesprächsgrundlage für die Sitzung</h2>
      <p>Offene Punkte, die sich aus dem Abgleich von Technik-Entwurf und HW-Planung ergeben. Status und Notizen werden lokal in diesem Browser gespeichert – vor der Sitzung ggf. exportieren.</p></div>
    ${DISKUSSION.map((d, i) => `<div class="card tight disc">
        <div><h3>${i + 1}. ${esc(d.titel)} <span class="chip ${tags[d.tag][1]}">${tags[d.tag][0]}</span></h3><p>${esc(d.text)}</p></div>
        <div class="noprint">${statusSelect(d.id)}</div>
        <div class="tagline">${noteBox(d.id, "Ergebnis / Notiz")}</div>
      </div>`).join("")}
    <div class="card">${noteBox("protokoll", "Protokoll / weitere Punkte")}</div>`;
  }

  function collectNotes() {
    const all = store.all();
    const labels = {};
    document.querySelectorAll("textarea[data-note]").forEach((t) => { labels[t.dataset.note] = t.dataset.label; });
    return Object.keys(all).filter((k) => k.startsWith("note:") && all[k]).map((k) => {
      const id = k.slice(5);
      return { id, label: labels[id] || id, text: all[k], status: all["status:" + id] || "" };
    });
  }

  function viewNotizen() {
    return `
    <div class="card"><h2>Meine Notizen</h2>
      <p>Alle Notizen und Bearbeitungsstände werden <b>nur lokal in diesem Browser</b> gespeichert (localStorage). Sie gehen verloren, wenn der Browserspeicher gelöscht wird. Zum Teilen oder Sichern exportieren.</p>
      <div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" data-act="export-md">Notizen als Markdown herunterladen</button>
        <button class="btn" data-act="export-json">Sicherung (JSON) herunterladen</button>
        <button class="btn" data-act="import-json">Sicherung einlesen</button>
        <button class="btn" data-act="clear" style="border-color:var(--color-error);color:var(--color-error)">Alle Notizen löschen</button>
      </div></div>
    <div class="card notelist" id="notelist"></div>`;
  }
  function fillNotelist() {
    const el = document.getElementById("notelist");
    if (!el) return;
    const notes = collectNotes();
    el.innerHTML = notes.length ? notes.map((n) => `<div class="item"><b>${esc(n.label)}</b> ${n.status ? `<span class="chip srl">${esc(n.status)}</span>` : ""}<pre>${esc(n.text)}</pre></div>`).join("") : `<p class="muted">Noch keine Notizen. Notizfelder gibt es in jedem Abschnitt.</p>`;
  }

  /* ---------- Aufbau ---------- */
  const VIEWS = [
    { id: "uebersicht", label: "Übersicht", render: viewUebersicht },
    ...TC.map((t) => ({ id: "jg" + t.jg, label: "Jahrgang " + t.jg, render: () => viewTC(t) })),
    { id: "abdeckung", label: "Abdeckung KLP", render: viewAbdeckung },
    { id: "leistung", label: "Leistungsbewertung", render: viewLeistung },
    { id: "sitzung", label: "Sitzung", render: viewSitzung },
    { id: "notizen", label: "Meine Notizen", render: viewNotizen },
  ];

  function build() {
    document.title = `${META.titel} – SchiLP Arbeitsversion`;
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
        <div class="filterbar"><span class="lbl">Hervorheben:</span>
          <button class="fchip" data-f="wi">Wirtschaft</button>
          <button class="fchip" data-f="bo">Berufsorientierung</button>
          <button class="fchip" data-f="bne">BNE</button>
          <button class="fchip" data-f="mkr">Medienkompetenz</button>
          <button class="fchip" data-f="srl">SRL</button>
        </div></nav>
      <main>${VIEWS.map((v) => `<section class="view" id="view-${v.id}">${v.render()}</section>`).join("")}</main>
      <div class="foot">${esc(META.schule)} · SchiLP WP Wirtschaft und Arbeitswelt · ${esc(META.version)} · Notizen werden nur lokal gespeichert</div>
      <div class="toast" id="toast"></div>
      <input type="file" id="importfile" accept="application/json" hidden>`;
  }

  function show(id) {
    if (!VIEWS.some((v) => v.id === id)) id = "uebersicht";
    document.querySelectorAll("section.view").forEach((s) => s.classList.toggle("active", s.id === "view-" + id));
    document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === id));
    if (id === "notizen") fillNotelist();
    store.set("ui:view", id);
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
      const ta = e.target.closest("textarea[data-note]");
      if (!ta) return;
      const key = ta.dataset.note;
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        store.set("note:" + key, ta.value);
        const box = ta.closest(".note"); box.classList.toggle("has", !!ta.value);
        const s = box.querySelector(".saved"); s.classList.add("show"); setTimeout(() => s.classList.remove("show"), 1200);
        // gleiche Notiz an anderer Stelle (Druckansicht) synchron halten
        document.querySelectorAll(`textarea[data-note="${key}"]`).forEach((o) => { if (o !== ta) o.value = ta.value; });
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
        const on = [...document.querySelectorAll(".fchip.on")].map((x) => x.dataset.f).join(",");
        store.set("ui:filter", on); return;
      }
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "print") { document.body.classList.remove("printall"); document.querySelectorAll("section.view.active details.hwuv").forEach((d) => d.open = true); window.print(); }
      if (act === "printall") { document.body.classList.add("printall"); document.querySelectorAll("details.hwuv").forEach((d) => d.open = true); window.print(); setTimeout(() => document.body.classList.remove("printall"), 500); }
      if (act === "export-md") {
        const notes = collectNotes();
        const md = `# Notizen SchiLP WAW (${new Date().toLocaleDateString("de-DE")})\n\n` + (notes.map((n) => `## ${n.label}${n.status ? ` _(Status: ${n.status})_` : ""}\n\n${n.text}\n`).join("\n") || "_keine Notizen_\n");
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
  // Sicherheitsabfrage ohne blockierenden Browser-Dialog: zweimal klicken
  let clearArmed = 0;
  function confirmClear() {
    if (Date.now() - clearArmed < 4000) { clearArmed = 0; return true; }
    clearArmed = Date.now(); toast("Zum Löschen innerhalb von 4 Sekunden erneut klicken"); return false;
  }
  function rerender() {
    const cur = location.hash.slice(1) || store.get("ui:view") || "uebersicht";
    VIEWS.forEach((v) => { document.getElementById("view-" + v.id).innerHTML = v.render(); });
    show(cur);
  }
  function restoreFilters() {
    (store.get("ui:filter") || "").split(",").filter(Boolean).forEach((f) => {
      const b = document.querySelector(`.fchip[data-f="${f}"]`); if (b) { b.classList.add("on"); document.body.classList.add("hl-" + f); }
    });
  }

  build(); bind(); restoreFilters();
  show(location.hash.slice(1) || store.get("ui:view") || "uebersicht");
})();
