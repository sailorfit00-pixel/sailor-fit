// =============================================================
//  Andamento — com'è andata la settimana / il mese
//  Calorie e macro dal diario, peso, e un'analisi automatica con
//  cosa va bene, cosa migliorare e suggerimenti pratici.
// =============================================================

let periodoAnd = "settimana"; // "giorno" | "settimana" | "mese"
let offsetAnd = 0;            // 0 = periodo attuale, -1 = precedente…

const isoDi = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const addGiorni = (iso, n) => { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); return isoDi(d); };

// Date del periodo scelto
function datePeriodo() {
  const oggi = oggiISO();
  if (periodoAnd === "giorno") return [addGiorni(oggi, offsetAnd)];
  if (periodoAnd === "settimana") {
    const lun = addGiorni(oggi, -indiceSettimana(oggi) + offsetAnd * 7);
    return Array.from({ length: 7 }, (_, k) => addGiorni(lun, k));
  }
  const d = new Date(oggi + "T12:00");
  d.setDate(1); d.setMonth(d.getMonth() + offsetAnd);
  const mese = d.getMonth(), out = [];
  while (d.getMonth() === mese) { out.push(isoDi(d)); d.setDate(d.getDate() + 1); }
  return out;
}
// in Andamento si guardano solo i periodi passati e quello in corso (la pianificazione è in Settimana)
const maxOffsetAnd = () => 0;
function titoloPeriodo(date) {
  if (periodoAnd === "giorno") return offsetAnd === 0 ? "Oggi" : offsetAnd === -1 ? "Ieri" : fmtGiornoLungo(date[0]);
  if (periodoAnd === "mese") {
    const s = new Date(date[0] + "T12:00").toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (offsetAnd === 0) return "Questa settimana";
  if (offsetAnd === -1) return "Settimana scorsa";
  if (offsetAnd === 1) return "Settimana prossima";
  return `${fmtData(date[0])} – ${fmtData(date[6])}`;
}

// Dati di ogni giorno del periodo
function datiGiorni(date) {
  const oggi = oggiISO();
  const diario = leggiDiario();
  return date.map(data => {
    const g = giornoDiario(data);
    const tg = TIPI_GIORNATA[g.tipo];
    const t = sommaMacro(g.pasti);
    const registrato = !!(diario[data] && g.pasti.length);
    // giornata "completa": almeno 3 pasti o almeno il 70% delle calorie
    const completo = registrato && (g.pasti.length >= 3 || t.kcal >= tg.target.kcal * 0.7);
    const ex = extraDa(g.pasti.flatMap(p => p.ingredienti || []));
    return { data, futuro: data > oggi, oggi: data === oggi, tipo: g.tipo, T: targetData(data), fabbisogno: tg.fabbisogno, t, ex, pasti: g.pasti, registrato, completo };
  });
}

const media = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// -------- Zuccheri, fibre e sale --------
// Da dove arrivano gli zuccheri aggiunti (o il sale): alimento -> grammi, i più alti per primi
function fontiDi(pasti, indice) {
  const f = {};
  pasti.forEach(p => (p.ingredienti || []).forEach(i => {
    const x = (window.NUTRIENTI_EXTRA || {})[i.nome]; if (!x || !x[indice]) return;
    f[i.nome] = (f[i.nome] || 0) + x[indice] * grammiIng(i) / 100;
  }));
  return Object.entries(f).filter(([, g]) => g >= 0.5).sort((a, b) => b[1] - a[1]);
}
// Righe con barra: zuccheri aggiunti (max 40, ideale 20), fibre (almeno 25), sale (max 5)
function extraHTML(ex, pasti, intestazione) {
  const L = LIMITI_EXTRA;
  const riga = (nome, val, rif, tipo, nota) => {
    const w = Math.min(100, val / rif * 100);
    const cls = tipo === "min" ? (val >= rif ? "ok" : "basso") : (val > rif ? "sopra" : tipo === "zuc" && val > L.aggiuntiIdeale ? "medio" : "ok");
    return `<div class="ex-riga"><div class="ex-top"><span>${nome}</span><span><b>${fmtG(val)}</b> / ${rif} g ${tipo === "min" ? "minimo" : "massimo"}</span></div>
      <div class="ex-bar"><span class="${cls}" style="width:${w}%"></span>${tipo === "zuc" ? `<i style="left:${L.aggiuntiIdeale / rif * 100}%" title="ideale"></i>` : ""}</div>
      ${nota ? `<small>${nota}</small>` : ""}</div>`;
  };
  const fonti = fontiDi(pasti, 1).slice(0, 3);
  return `<h4>${intestazione}</h4>
    ${riga("Zuccheri aggiunti", ex.aggiunti, L.aggiunti, "zuc", `${fmtG(ex.zuccheri)} g di zuccheri totali, compresi quelli naturali di frutta e latte · ideale sotto ${L.aggiuntiIdeale} g`)}
    ${fonti.length ? `<p class="ex-fonti">Da dove arrivano: ${fonti.map(([n, g]) => `<b>${esc(n)}</b> ${fmtG(g)} g`).join(" · ")}</p>` : ""}
    ${riga("Fibre", ex.fibre, L.fibre, "min")}
    ${riga("Sale", ex.sale, L.sale, "max")}`;
}
const fmtG = (v) => v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace(".", ",");

// Legenda del grafico: solo i colori che compaiono davvero nel periodo
function legendaKcalHTML(giorni) {
  const usati = new Set();
  giorni.forEach(g => { if (!g.registrato) return; const r = g.t.kcal / g.T.kcal; usati.add(!g.completo ? "gk-parz" : r > 1.15 ? "gk-bad" : r > 1.06 ? "gk-warn" : r < 0.85 ? "gk-low" : "gk-ok"); });
  const voci = [["gk-ok", "in linea"], ["gk-warn", "sopra"], ["gk-bad", "molto sopra"], ["gk-low", "sotto"], ["gk-parz", "incompleta"]].filter(([k]) => usati.has(k));
  return voci.length ? `<div class="macro-pct legenda-kcal">${voci.map(([k, l]) => `<span><i class="lk ${k}"></i>${l}</span>`).join("")}</div>` : "";
}
// -------- Grafico a barre calorie (SVG) --------
function graficoKcalSVG(giorni) {
  const W = 340, H = 150, PL = 6, PR = 6, PT = 10, PB = 20;
  const n = giorni.length;
  const max = Math.max(...giorni.map(g => Math.max(g.t.kcal, g.T.kcal))) * 1.1 || 2000;
  const slot = (W - PL - PR) / n, bw = Math.max(3, slot * 0.62);
  const Y = (v) => PT + (1 - v / max) * (H - PT - PB);
  const lett = ["L", "M", "M", "G", "V", "S", "D"];
  return `<svg class="grafico-kcal" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorie per giorno">
    ${giorni.map((g, k) => {
      const x = PL + k * slot + (slot - bw) / 2;
      const lab = n <= 7 ? lett[k] : ((k + 1) % 5 === 0 || k === 0 ? k + 1 : "");
      const etich = lab !== "" ? `<text x="${x + bw / 2}" y="${H - 6}" class="gr-lab" text-anchor="middle">${lab}</text>` : "";
      const tick = `<line x1="${x - 2}" x2="${x + bw + 2}" y1="${Y(g.T.kcal)}" y2="${Y(g.T.kcal)}" class="gk-target"/>`;
      if (!g.registrato) return `${etich}<rect x="${x}" y="${H - PB - 3}" width="${bw}" height="3" rx="1.5" class="gk-vuoto"/>${g.futuro ? "" : tick}`;
      const r = g.t.kcal / g.T.kcal;
      const cls = !g.completo ? "gk-parz" : r > 1.15 ? "gk-bad" : r > 1.06 ? "gk-warn" : r < 0.85 ? "gk-low" : "gk-ok";
      return `${etich}<rect x="${x}" y="${Y(g.t.kcal)}" width="${bw}" height="${H - PB - Y(g.t.kcal)}" rx="${Math.min(4, bw / 3)}" class="${cls}"><title>${fmtData(g.data)}: ${Math.round(g.t.kcal)} / ${g.T.kcal} kcal</title></rect>${tick}`;
    }).join("")}
  </svg>
  ${legendaKcalHTML(giorni)}`;
}

// -------- Analisi: cosa va bene, cosa migliorare --------
function analisi(giorni, pesiPeriodo) {
  const out = []; // { liv: "ok"|"warn"|"info", testo, peso }
  const passati = giorni.filter(g => !g.futuro);
  const compl = giorni.filter(g => g.completo && !g.oggi);
  const reg = passati.filter(g => g.registrato).length;

  // 1. costanza nel registrare
  if (passati.length && reg < passati.length * 0.7)
    out.push({ liv: "info", peso: 5, testo: `Hai registrato <b>${reg} ${reg === 1 ? "giorno" : "giorni"} su ${passati.length}</b>. Più giorni registri, più l'analisi è affidabile: anche un pasto veloce scritto "a occhio" è meglio di niente.` });
  if (compl.length < 2) {
    if (!out.length) out.push({ liv: "info", peso: 5, testo: "Servono almeno 2 giornate complete (non contando oggi) per l'analisi. Continua a registrare!" });
    return out;
  }

  // 2. calorie medie
  const kcalM = media(compl.map(g => g.t.kcal)), targM = media(compl.map(g => g.T.kcal));
  const diffK = Math.round(kcalM - targM);
  if (diffK > targM * 0.05)
    out.push({ liv: "warn", peso: 10, testo: `In media mangi <b>${diffK} kcal in più</b> al giorno rispetto all'obiettivo. È la prima cosa da sistemare per dimagrire.` });
  else if (diffK < -targM * 0.15)
    out.push({ liv: "warn", peso: 8, testo: `In media mangi <b>${-diffK} kcal in meno</b> dell'obiettivo. Troppo poco: rischi di perdere muscolo ed energia in allenamento.` });
  else out.push({ liv: "ok", peso: 6, testo: `Calorie in linea con l'obiettivo (media ${Math.round(kcalM)} kcal su ${Math.round(targM)}). 👏` });

  // 3. proteine
  const protBasse = compl.filter(g => g.t.proteine < g.T.proteine * 0.85);
  if (protBasse.length >= Math.max(2, compl.length * 0.4)) {
    // pasto più "povero" di proteine rispetto alla sua quota
    const perSlot = ORDINE_TEMPO.map(p => {
      const val = compl.map(g => sommaMacro(g.pasti.filter(x => x.pasto === p)).proteine);
      return { p, gap: media(compl.map(g => g.T.proteine * quotaPasto(g.data, p))) - media(val), val: media(val) };
    }).sort((a, b) => b.gap - a.gap)[0];
    const idee = { colazione: "yogurt greco, kefir, uova o albumi", mattina: "uno yogurt greco o qualche fetta di bresaola", pranzo: "una porzione piena di carne, pesce o legumi", spuntino: "yogurt greco, fiocchi di latte o un frullato proteico", cena: "pesce, carne bianca, uova o tofu" };
    out.push({ liv: "warn", peso: 9, testo: `Proteine sotto l'obiettivo in <b>${protBasse.length} giorni su ${compl.length}</b>. Il pasto più povero è <b>${nomePasto(perSlot.p)}</b> (media ${Math.round(perSlot.val)} g): prova ad aggiungere ${idee[perSlot.p]}.` });
  } else out.push({ liv: "ok", peso: 5, testo: `Proteine centrate in <b>${compl.length - protBasse.length} giorni su ${compl.length}</b>: ottimo per proteggere i muscoli.` });

  // 4. pasto che sfora di più la sua quota
  const sfora = ORDINE_TEMPO.map(p => {
    const vals = compl.map(g => sommaMacro(g.pasti.filter(x => x.pasto === p)).kcal);
    return { p, extra: media(vals) - media(compl.map(g => g.T.kcal * quotaPasto(g.data, p))) };
  }).sort((a, b) => b.extra - a.extra)[0];
  if (sfora.extra > 120 && diffK > 0)
    out.push({ liv: "warn", peso: 7, testo: `Il pasto che sfora di più è <b>${nomePasto(sfora.p)}</b>: in media <b>+${Math.round(sfora.extra)} kcal</b> rispetto alla sua quota. Lì conviene ridurre carboidrati o condimenti.` });

  // 5. effetto weekend
  const fine = compl.filter(g => indiceSettimana(g.data) >= 5), feriali = compl.filter(g => indiceSettimana(g.data) < 5);
  if (fine.length && feriali.length) {
    const ext = media(fine.map(g => g.t.kcal - g.T.kcal)) - media(feriali.map(g => g.t.kcal - g.T.kcal));
    if (ext > 200) out.push({ liv: "warn", peso: 7, testo: `Nel weekend mangi in media <b>${Math.round(ext)} kcal in più</b> rispetto ai giorni feriali. Un'idea: decidi prima cosa mangerai fuori e alleggerisci gli altri pasti.` });
  }

  // 6. grassi alti (condimenti)
  const grM = media(compl.map(g => g.t.grassi)), grT = media(compl.map(g => g.T.grassi));
  if (grM > grT * 1.2) out.push({ liv: "warn", peso: 6, testo: `Grassi in media a <b>${Math.round(grM)} g</b> (obiettivo ${Math.round(grT)} g). Spesso sono i condimenti: pesa l'olio (1 cucchiaio = 10 g = 90 kcal) e attenzione a formaggi e frutta secca.` });
  else if (grM < grT * 0.7) out.push({ liv: "info", peso: 4, testo: `Grassi un po' bassi (media ${Math.round(grM)} g). Non scendere sotto ~50 g: aggiungi un filo d'olio, avocado o frutta secca.` });

  // 7. carboidrati: allenamento vs riposo
  const riposo = compl.filter(g => g.tipo === "riposo"), allen = compl.filter(g => g.tipo !== "riposo");
  if (riposo.length && media(riposo.map(g => g.t.carboidrati / g.T.carboidrati)) > 1.25)
    out.push({ liv: "info", peso: 5, testo: `Nei giorni di riposo i carboidrati sono alti (+${Math.round((media(riposo.map(g => g.t.carboidrati / g.T.carboidrati)) - 1) * 100)}%). Spostali sui giorni di allenamento, dove servono davvero.` });
  if (allen.length && media(allen.map(g => g.t.carboidrati / g.T.carboidrati)) < 0.7)
    out.push({ liv: "info", peso: 5, testo: `Nei giorni di allenamento i carboidrati sono bassi: se ti senti scarica al CrossFit, aggiungi pane, riso o frutta prima dell'allenamento.` });

  // zuccheri aggiunti, fibre e sale (medie)
  const zM = media(compl.map(g => g.ex.aggiunti)), fM = media(compl.map(g => g.ex.fibre)), sM = media(compl.map(g => g.ex.sale));
  const fz = fontiDi(compl.flatMap(g => g.pasti), 1)[0];
  const quotaZ = Math.round(zM * 4 / (kcalM || 1) * 100);
  if (zM > LIMITI_EXTRA.aggiunti) out.push({ liv: "warn", peso: 9, testo: `Zuccheri aggiunti in media <b>${fmtG(zM)} g al giorno</b> (il ${quotaZ}% delle calorie; massimo ${LIMITI_EXTRA.aggiunti} g).${fz ? ` Il primo responsabile è <b>${esc(fz[0])}</b>.` : ""} Sono calorie che saziano poco: ridurle è il modo più facile per stare nel budget.` });
  else if (zM > LIMITI_EXTRA.aggiuntiIdeale) out.push({ liv: "info", peso: 4, testo: `Zuccheri aggiunti in media ${fmtG(zM)} g al giorno: entro il limite, ma sopra l'ideale di ${LIMITI_EXTRA.aggiuntiIdeale} g.${fz ? ` Arrivano soprattutto da ${esc(fz[0])}.` : ""}` });
  else out.push({ liv: "ok", peso: 3, testo: `Zuccheri aggiunti bassi (${fmtG(zM)} g al giorno di media): non sono loro il problema. 👍` });
  if (fM < 20) out.push({ liv: "info", peso: 5, testo: `Fibre in media ${fmtG(fM)} g al giorno (consigliate almeno 25): aggiungi verdura, legumi o cereali integrali, ti aiutano a sentire meno fame.` });
  if (sM > LIMITI_EXTRA.sale) out.push({ liv: "warn", peso: 5, testo: `Sale in media ${fmtG(sM)} g al giorno (massimo ${LIMITI_EXTRA.sale} g): attenzione a salumi, formaggi stagionati e piatti pronti.` });

  // 8. peso: atteso vs reale
  const deficit = compl.reduce((s, g) => s + (g.fabbisogno - g.t.kcal), 0) / compl.length; // kcal/giorno
  const atteso = deficit * 7 / 7700; // kg/settimana
  const trend = andamento(pesiPeriodo.length >= 3 ? pesiPeriodo : leggiPesi());
  if (trend !== null) {
    if (atteso > 0.15 && trend > -0.05)
      out.push({ liv: "warn", peso: 8, testo: `Dal diario dovresti perdere ~${fmtKg(atteso)} kg a settimana, ma il peso è fermo. Di solito vuol dire che alcune quantità sono sottostimate: pesa gli alimenti per qualche giorno e registra anche condimenti, assaggi e bevande.` });
    else if (trend <= -0.15) out.push({ liv: "ok", peso: 6, testo: `Il peso scende di <b>${fmtKg(-trend)} kg a settimana</b>: il piano sta funzionando. 💪` });
  } else if (!leggiPesi().length) out.push({ liv: "info", peso: 3, testo: `Registra il peso 2–3 volte a settimana (al mattino, a digiuno): così posso dirti se il piano funziona davvero.` });

  return out.sort((a, b) => b.peso - a.peso);
}

// Riepilogo per settimana (solo nella vista mese)
function tabellaSettimaneHTML(giorni) {
  const gruppi = [];
  giorni.filter(g => !g.futuro).forEach(g => {
    const lun = addGiorni(g.data, -indiceSettimana(g.data));
    let gr = gruppi.find(x => x.lun === lun);
    if (!gr) gruppi.push(gr = { lun, giorni: [] });
    gr.giorni.push(g);
  });
  const pesi = leggiPesi();
  return `<table class="tab-sett"><thead><tr><th>Settimana</th><th>Giorni</th><th>Media kcal</th><th>Proteine</th><th>Peso</th></tr></thead><tbody>
    ${gruppi.map(gr => {
      const c = gr.giorni.filter(g => g.completo);
      const fin = addGiorni(gr.lun, 6);
      const ps = pesi.filter(p => p.data >= gr.lun && p.data <= fin);
      const km = c.length ? Math.round(media(c.map(g => g.t.kcal))) : null;
      const kt = c.length ? Math.round(media(c.map(g => g.T.kcal))) : null;
      return `<tr><td>${fmtData(gr.giorni[0].data)}</td><td>${gr.giorni.filter(g => g.registrato).length}/${gr.giorni.filter(g => !g.futuro).length}</td>
        <td>${km === null ? "—" : `<span class="${km > kt * 1.05 ? "t-warn" : km < kt * 0.85 ? "t-low" : "t-ok"}">${km}</span>`}</td>
        <td>${c.length ? Math.round(media(c.map(g => g.t.proteine))) + " g" : "—"}</td>
        <td>${ps.length ? fmtKg(media(ps.map(p => p.kg))) : "—"}</td></tr>`;
    }).join("")}
  </tbody></table>`;
}

// -------- Vista "Giorno": com'è andata una singola giornata --------
function analisiGiorno(g) {
  const out = [];
  const T = g.T, t = g.t;
  if (!g.registrato) return [{ liv: "info", testo: "Nessun pasto registrato in questo giorno." }];
  if (!g.completo && !g.oggi) out.push({ liv: "info", testo: "Giornata registrata solo in parte: l'analisi è indicativa." });
  if (g.oggi && !g.completo) out.push({ liv: "info", testo: "La giornata è ancora in corso: l'analisi si completa man mano che aggiungi i pasti." });
  // calorie
  const dk = Math.round(t.kcal - T.kcal);
  // pasto che sfora di più la sua quota
  const perPasto = ORDINE_TEMPO.map(p => ({ p, kcal: sommaMacro(g.pasti.filter(x => x.pasto === p)).kcal, quota: T.kcal * quotaPasto(g.data, p) }))
    .filter(x => x.kcal > 0).sort((a, b) => (b.kcal - b.quota) - (a.kcal - a.quota));
  if (dk > T.kcal * 0.05) out.push({ liv: "warn", testo: `Sopra di <b>${dk} kcal</b>.${perPasto[0] && perPasto[0].kcal > perPasto[0].quota + 80 ? ` Il pasto più abbondante rispetto al suo obiettivo è <b>${nomePasto(perPasto[0].p, g.data)}</b> (${Math.round(perPasto[0].kcal)} kcal).` : ""}${g.data < oggiISO() ? " Domani in Oggi puoi scegliere se recuperarle nei giorni seguenti." : ""}` });
  else if (g.completo && dk < -T.kcal * 0.12) out.push({ liv: "info", testo: `Sotto di <b>${-dk} kcal</b>: una volta va bene, ma se capita spesso rischi di perdere energia e muscolo.` });
  else if (g.completo) out.push({ liv: "ok", testo: `In linea: ${Math.round(t.kcal)} su ${T.kcal} kcal. 👏` });
  // proteine
  if (g.completo || g.oggi) {
    if (t.proteine < T.proteine * 0.85) {
      const povero = ORDINE_TEMPO.map(p => ({ p, prot: sommaMacro(g.pasti.filter(x => x.pasto === p)).proteine, q: T.proteine * quotaPasto(g.data, p) }))
        .sort((a, b) => (b.q - b.prot) - (a.q - a.prot))[0];
      out.push({ liv: "warn", testo: `Proteine <b>${Math.round(t.proteine)} g</b> su ${T.proteine}: ne mancano ${Math.round(T.proteine - t.proteine)} g. Il pasto più povero è <b>${nomePasto(povero.p)}</b> (${Math.round(povero.prot)} g).` });
    } else out.push({ liv: "ok", testo: `Proteine centrate (${Math.round(t.proteine)} g).` });
  }
  // grassi: la fonte principale
  if (t.grassi > T.grassi * 1.2) {
    const fonti = {};
    g.pasti.forEach(p => (p.ingredienti || []).forEach(i => { const a = (window.ALIMENTI || {})[i.nome]; if (a) fonti[i.nome] = (fonti[i.nome] || 0) + a[3] * grammiIng(i) / 100; }));
    const top = Object.entries(fonti).sort((a, b) => b[1] - a[1])[0];
    out.push({ liv: "warn", testo: `Grassi alti (${Math.round(t.grassi)} g su ${T.grassi}).${top ? ` La fonte principale è <b>${esc(top[0])}</b> (${Math.round(top[1])} g di grassi).` : ""}` });
  }
  // zuccheri aggiunti, fibre, sale
  if (g.completo || g.oggi) {
    const ex = g.ex, L = LIMITI_EXTRA, fz = fontiDi(g.pasti, 1)[0], fs = fontiDi(g.pasti, 3)[0];
    if (ex.aggiunti > L.aggiunti) out.push({ liv: "warn", testo: `Zuccheri aggiunti <b>${fmtG(ex.aggiunti)} g</b> (massimo ${L.aggiunti}).${fz ? ` Il primo responsabile: <b>${esc(fz[0])}</b> (${fmtG(fz[1])} g).` : ""}` });
    else if (ex.aggiunti > L.aggiuntiIdeale) out.push({ liv: "info", testo: `Zuccheri aggiunti ${fmtG(ex.aggiunti)} g: sotto il massimo, sopra l'ideale di ${L.aggiuntiIdeale} g.` });
    if (g.completo && ex.fibre < 18) out.push({ liv: "info", testo: `Fibre basse (${fmtG(ex.fibre)} g su 25): verdura, legumi, frutta e cereali integrali aiutano anche la sazietà.` });
    if (ex.sale > L.sale) out.push({ liv: "warn", testo: `Sale ${fmtG(ex.sale)} g (massimo ${L.sale}).${fs ? ` Arriva soprattutto da <b>${esc(fs[0])}</b>.` : ""}` });
  }
  if (g.tipo === "riposo" && t.carboidrati > T.carboidrati * 1.25) out.push({ liv: "info", testo: "Giorno di riposo con molti carboidrati: tienili per i giorni di allenamento." });
  // l'alimento che ha pesato di più
  const kcalIng2 = {};
  g.pasti.forEach(p => (p.ingredienti || []).forEach(i => { kcalIng2[i.nome] = (kcalIng2[i.nome] || 0) + kcalIng(i); }));
  const piu = Object.entries(kcalIng2).sort((a, b) => b[1] - a[1])[0];
  if (piu && piu[1] > T.kcal * 0.2) out.push({ liv: "info", testo: `L'alimento che ha pesato di più: <b>${esc(piu[0])}</b> (${Math.round(piu[1])} kcal).` });
  return out;
}
function giornoHTML(g) {
  const T = g.T, t = g.t;
  const pct = g.pasti.length ? pctMacro(t) : null;
  const peso = leggiPesi().find(p => p.data === g.data);
  const icona = { ok: "✅", warn: "⚠️", info: "💡" };
  const pasti = g.pasti.map(p => p).sort((a, b) => ORDINE_TEMPO.indexOf(a.pasto) - ORDINE_TEMPO.indexOf(b.pasto));
  return `
    <div class="and-stat">
      <div><span>Mangiate</span><b>${Math.round(t.kcal)}</b><small>obiettivo ${T.kcal} kcal</small></div>
      <div><span>Differenza</span><b>${g.registrato ? `${t.kcal - T.kcal > 0 ? "+" : ""}${Math.round(t.kcal - T.kcal)}` : "—"}</b><small>kcal</small></div>
      <div><span>Peso</span><b>${peso ? fmtKg(peso.kg) : "—"}</b><small>kg</small></div>
    </div>
    <section class="and-sez"><h4>Macro</h4>
    ${barraProgressoHTML("Proteine", "dot-p", t.proteine, T.proteine, pct && pct.p)}
    ${barraProgressoHTML("Carboidrati", "dot-c", t.carboidrati, T.carboidrati, pct && pct.c)}
    ${barraProgressoHTML("Grassi", "dot-g", t.grassi, T.grassi, pct && pct.g)}</section>
    ${g.registrato ? `<section class="and-sez">${extraHTML(g.ex, g.pasti, "Zuccheri, fibre e sale")}</section>` : ""}
    ${pasti.length ? `<section class="and-sez"><h4>Pasti</h4><ul class="and-pasti">${pasti.map(p => {
      const quota = Math.round(T.kcal * (quotaPasto(g.data, p.pasto) || 0.1));
      return `<li><span class="pr-icona">${ICONA_PASTO[p.pasto] || "🍽️"}</span>
        <span class="ap-testo"><b>${esc(typeof nomeVisibile === "function" ? nomeVisibile(p) : p.nome.replace(/^✍️\s*/, ""))}</b><small>${nomePasto(p.pasto, g.data)}</small>${macroStileHTML(p, { senzaKcal: true })}</span>
        <span class="ap-kcal"><b>${p.kcal}</b><small class="${p.kcal > quota * 1.25 ? "manca-txt" : ""}">obiettivo ~${quota}</small></span></li>`;
    }).join("")}</ul></section>` : ""}
    <section class="and-sez"><h4>Cosa dice l'analisi</h4>
    <ul class="insight">${analisiGiorno(g).map(x => `<li class="ins-${x.liv}"><span>${icona[x.liv]}</span><p>${x.testo}</p></li>`).join("")}</ul></section>
    <button class="btn-sec block" data-and-apri-diario="${g.data}">Apri questo giorno nel diario</button>`;
}

function andamentoHTML() {
  const date = datePeriodo();
  const giorni = datiGiorni(date);
  const compl = giorni.filter(g => g.completo);
  const pesi = leggiPesi();
  const pesiP = pesi.filter(p => p.data >= date[0] && p.data <= date[date.length - 1]);
  const kcalM = compl.length ? Math.round(media(compl.map(g => g.t.kcal))) : null;
  const targM = compl.length ? Math.round(media(compl.map(g => g.T.kcal))) : null;
  const deficitTot = compl.reduce((s, g) => s + (g.fabbisogno - g.t.kcal), 0);
  const macroM = compl.length ? { proteine: media(compl.map(g => g.t.proteine)), carboidrati: media(compl.map(g => g.t.carboidrati)), grassi: media(compl.map(g => g.t.grassi)) } : null;
  const macroT = compl.length ? { proteine: media(compl.map(g => g.T.proteine)), carboidrati: media(compl.map(g => g.T.carboidrati)), grassi: media(compl.map(g => g.T.grassi)) } : null;
  const ultimoPeso = pesi[pesi.length - 1];
  const varPeso = pesiP.length >= 2 ? pesiP[pesiP.length - 1].kg - pesiP[0].kg : null;

  return `<div class="and-vista">
    <h3 class="modal-title">📊 Andamento</h3>
    <div class="viste and-viste">
      <button class="vista-btn ${periodoAnd === "giorno" ? "on" : ""}" data-and-periodo="giorno">Giorno</button>
      <button class="vista-btn ${periodoAnd === "settimana" ? "on" : ""}" data-and-periodo="settimana">Settimana</button>
      <button class="vista-btn ${periodoAnd === "mese" ? "on" : ""}" data-and-periodo="mese">Mese</button>
    </div>
    <div class="oggi-nav">
      <button class="nav-btn" data-and-off="-1" aria-label="Periodo precedente">‹</button>
      <div class="oggi-data"><b>${titoloPeriodo(date)}</b><span>${periodoAnd === "giorno" ? `${offsetAnd >= -1 ? fmtGiornoLungo(date[0]) + " · " : ""}${TIPI_GIORNATA[giornoDiario(date[0]).tipo].icone} ${esc(TIPI_GIORNATA[giornoDiario(date[0]).tipo].label)}` : (() => { const n = giorni.filter(g => g.registrato).length; return n === 1 ? "1 giorno registrato" : `${n} giorni registrati`; })()}</span></div>
      <button class="nav-btn" data-and-off="1" aria-label="Periodo successivo" ${offsetAnd >= maxOffsetAnd() ? "disabled" : ""}>›</button>
    </div>
    ${periodoAnd === "giorno" ? giornoHTML(giorni[0]) : `

    <div class="and-stat">
      <div><span>Media al giorno</span><b>${kcalM ?? "—"}</b><small>${targM ? `obiettivo ${targM} kcal` : "kcal"}</small></div>
      <div><span>${deficitTot >= 0 ? "Grasso perso" : "Grasso in più"}</span><b>${compl.length ? fmtKg(Math.abs(deficitTot) / 7700) : "—"}</b><small>kg (stima dal diario)</small></div>
      <div><span>Peso</span><b>${ultimoPeso ? fmtKg(ultimoPeso.kg) : "—"}</b><small>${varPeso !== null ? `${varPeso > 0 ? "+" : ""}${fmtKg(varPeso)} kg nel periodo` : "kg"}</small></div>
    </div>

    <section class="and-sez"><h4>kcal giorno per giorno</h4>
    ${graficoKcalSVG(giorni)}
    ${periodoAnd === "settimana" ? `<button class="btn-link" data-and-pianifica>Sposta kcal tra i giorni ›</button>` : ""}
    ${periodoAnd === "mese" ? `<h4>Settimana per settimana</h4>${tabellaSettimaneHTML(giorni)}` : ""}</section>

    ${macroM ? `<section class="and-sez"><h4>Macro medi</h4>
      ${barraProgressoHTML("Proteine", "dot-p", macroM.proteine, Math.round(macroT.proteine), null)}
      ${barraProgressoHTML("Carboidrati", "dot-c", macroM.carboidrati, Math.round(macroT.carboidrati), null)}
      ${barraProgressoHTML("Grassi", "dot-g", macroM.grassi, Math.round(macroT.grassi), null)}</section>` : ""}


    ${compl.length ? `<section class="and-sez">${extraHTML({ zuccheri: media(compl.map(g => g.ex.zuccheri)), aggiunti: media(compl.map(g => g.ex.aggiunti)), fibre: media(compl.map(g => g.ex.fibre)), sale: media(compl.map(g => g.ex.sale)) },
      compl.flatMap(g => g.pasti), `Zuccheri, fibre e sale <span class="hint-inline">— media al giorno</span>`)
      + (() => { const n = compl.filter(g => g.ex.aggiunti > LIMITI_EXTRA.aggiunti).length; return `<p class="ex-fonti">Giorni sopra i ${LIMITI_EXTRA.aggiunti} g di zuccheri aggiunti: <b>${n} su ${compl.length}</b></p>`; })()}</section>` : ""}


    <section class="and-sez"><h4>Peso</h4>
    <div class="peso-form">
      <input id="peso-data" class="qta-input" type="date" value="${oggiISO()}" max="${oggiISO()}">
      <input id="peso-kg" class="qta-input" type="number" inputmode="decimal" step="0.1" min="30" max="200" placeholder="kg" value="${ultimoPeso ? ultimoPeso.kg : ""}">
      <button class="btn" data-azione="peso-salva">✓ Salva</button>
    </div>
    ${pesiP.length >= 2 ? graficoPesoSVG(pesiP) : `<p class="hint">${pesiP.length ? "Una sola pesata in questo periodo." : "Nessuna pesata in questo periodo."}</p>`}
    ${pesi.length ? `<details class="and-pesate" ${pesateAperte ? "open" : ""}><summary>Tutte le pesate <em>${pesi.length}</em></summary><ul class="lista-pesi">${pesi.slice().reverse().map(p =>
      `<li><span>${fmtData(p.data)}</span><b>${fmtKg(p.kg)} kg</b><button class="lib-del" data-peso-del="${p.data}" aria-label="Elimina pesata">${ICONA_CESTINO}</button></li>`).join("")}</ul></details>` : ""}</section>
    `}
  </div>`;
}

let pesateAperte = false;
function apriAndamento() { editCtx = null; openModal(andamentoHTML()); }
function rirenderAndamento() {
  const sheet = document.querySelector(".modal-sheet");
  const sc = sheet ? sheet.scrollTop : 0;
  document.getElementById("modal-content").innerHTML = andamentoHTML();
  const s2 = document.querySelector(".modal-sheet"); if (s2) s2.scrollTop = sc;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("apri-andamento").addEventListener("click", () => { periodoAnd = "settimana"; offsetAnd = 0; apriAndamento(); });
  document.getElementById("modal-content").addEventListener("click", (e) => {
    const per = e.target.closest("[data-and-periodo]");
    if (per) { periodoAnd = per.dataset.andPeriodo; offsetAnd = 0; rirenderAndamento(); return; }
    const off = e.target.closest("[data-and-off]");
    if (off) { offsetAnd = Math.min(maxOffsetAnd(), offsetAnd + +off.dataset.andOff); rirenderAndamento(); return; }
    if (e.target.closest(".and-pesate > summary")) setTimeout(() => { const d = document.querySelector(".and-pesate"); pesateAperte = !!(d && d.open); }, 0);   // l'elenco resta aperto se si ridisegna
    if (e.target.closest("[data-and-pianifica]")) { const off = offsetAnd; closeModal(); vistaHome = "settimana"; offsetSettHome = off; giornoSelSett = null; renderOggi(); window.scrollTo(0, 0); return; }
    const ad = e.target.closest("[data-and-apri-diario]");
    if (ad) { dataDiario = ad.dataset.andApriDiario; vistaHome = "oggi"; closeModal(); renderOggi(); window.scrollTo(0, 0); }
  });
});
