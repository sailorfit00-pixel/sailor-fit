// =============================================================
//  Budget settimanale
//  Il budget della settimana (lun–dom) è la somma degli obiettivi dei
//  giorni. Si può spostare calorie tra i giorni in due modi:
//   - programmato: in 📊 Andamento → Settimana tocchi un giorno e gli dai
//     di più (es. "+200 cena fuori") o di meno; gli altri giorni si adattano
//   - recupero (chiesto sul momento): se ieri sei andata sopra/sotto, in Oggi
//     l'app chiede se vuoi recuperare la differenza nei giorni seguenti
//  Regole: nessun giorno sotto il metabolismo basale né oltre ±20% del suo
//  obiettivo normale; le proteine restano uguali, cambiano carboidrati e grassi.
// =============================================================

const PASSO_SPOSTAMENTO = 100; // kcal per ogni tocco su − / +
let giornoSelSett = null; // giorno toccato nella striscia della settimana

function leggiSpostamenti() { try { return JSON.parse(localStorage.getItem("mp_spostamenti")) || {}; } catch (e) { return {}; } }
function salvaSpostamenti(s) { localStorage.setItem("mp_spostamenti", JSON.stringify(s)); }
// decisioni sui recuperi: { "2026-10-15": "si" | "no" }
function leggiRecuperi() { try { return JSON.parse(localStorage.getItem("mp_recuperi")) || {}; } catch (e) { return {}; } }
function salvaRecuperi(r) { localStorage.setItem("mp_recuperi", JSON.stringify(r)); }

const dateSettimanaDi = (data) => { const lun = addGiorniISO(data, -indiceSettimana(data)); return [0, 1, 2, 3, 4, 5, 6].map(k => addGiorniISO(lun, k)); };
const targetBase = (data) => TIPI_GIORNATA[giornoDiario(data).tipo].target;
// un giorno scelto da te: dal metabolismo basale a +50% (una cena fuori ci sta); i giorni che si adattano da soli restano entro ±20%
function limitiGiorno(base) { return [Math.round(leggiProfilo().bmr), Math.round(base * 1.5)]; }
function limitiAuto(base) { return [Math.max(leggiProfilo().bmr, Math.round(base * 0.8)), Math.round(base * 1.2)]; }
// -------- Obiettivo della settimana scelto da te --------
// { sempre: { kcal, da: lunedì } | null, settimane: { lunedì: kcal } }: una settimana sola, oppure da quel lunedì in poi
// aggiunte: { lunedì: kcal } = calorie in più (o in meno) sul totale di quella settimana, date a un giorno con «Cambia il totale»: gli altri giorni restano com'erano
function leggiBudgetSett() { try { const b = JSON.parse(localStorage.getItem("mp_budget_sett")) || {}; return { sempre: b.sempre || null, settimane: b.settimane || {}, aggiunte: b.aggiunte || {} }; } catch (e) { return { sempre: null, settimane: {}, aggiunte: {} }; } }
// «Cambia il totale» su un giorno: il totale sale (o scende) solo di quella differenza. Prima si salvava un nuovo totale, che però si ridistribuiva
// in proporzione su tutti i giorni (anche quelli già passati) e spostava di qualche decina di kcal anche gli altri
function aggiungiAlTotale(lun, d) { const b = leggiBudgetSett(); b.aggiunte[lun] = Math.round((b.aggiunte[lun] || 0) + d); if (!b.aggiunte[lun]) delete b.aggiunte[lun]; salvaBudgetSett(b); }
function salvaBudgetSett(b) { localStorage.setItem("mp_budget_sett", JSON.stringify(b)); }
function budgetScelto(lun) {
  const b = leggiBudgetSett();
  if (b.settimane[lun] > 0) return b.settimane[lun];
  if (b.sempre && b.sempre.kcal > 0 && lun >= b.sempre.da) return b.sempre.kcal;
  return null;
}
const limita = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
// a decine (come il piano), restando nei limiti: 2025 → 2020 se 2025 è il massimo
const limita10 = (v, [lo, hi]) => limita(Math.round(v / 10) * 10, [Math.ceil(lo / 10) * 10, Math.floor(hi / 10) * 10]);
const arr10 = (v) => Math.round(v / 10) * 10;

// Il piano della settimana che contiene `data`.
// Giorno per giorno, il budget che resta si divide tra il giorno e quelli seguenti;
// i giorni spostati da te restano fissi. Un giorno passato conta per il suo
// obiettivo, oppure per quello che hai mangiato davvero se hai scelto di recuperare.
// Il piano è costoso (legge tutta la settimana dal diario) e viene richiesto decine di volte per ogni disegno: si ricorda finché i dati non cambiano
let _memoPianoChiave = "", _memoPiano = new Map();
function pianoSettimana(data) {
  let k; try { k = ["mp_diario", "mp_spostamenti", "mp_recuperi", "mp_profilo", "mp_tipi", "mp_budget_sett"].map(x => localStorage.getItem(x) || "").join("\u0001") + "|" + oggiISO(); } catch (e) { return pianoSettimanaCalc(data); }
  if (k !== _memoPianoChiave) { _memoPiano = new Map(); _memoPianoChiave = k; }
  const lun = dateSettimanaDi(data)[0];
  if (!_memoPiano.has(lun)) _memoPiano.set(lun, pianoSettimanaCalc(data));
  return _memoPiano.get(lun);
}
// Divide il totale in proporzione agli obiettivi naturali dei giorni (allenamento > riposo). Chi scenderebbe sotto il basale resta al basale
// e il resto si divide tra gli altri; gli arrotondamenti vanno sul giorno più grande, così la somma è proprio il totale scelto.
function distribuisciTotale(nat, totale, minimo) {
  const fermi = new Set();
  let out = nat.slice();
  for (let giro = 0; giro < 7; giro++) {
    const restoT = totale - [...fermi].length * minimo, natLiberi = nat.reduce((a, b, i) => a + (fermi.has(i) ? 0 : b), 0) || 1;
    out = nat.map((b, i) => fermi.has(i) ? minimo : b * restoT / natLiberi);
    const nuovi = out.map((v, i) => v < minimo && !fermi.has(i) ? i : -1).filter(i => i >= 0);
    if (!nuovi.length) break;
    nuovi.forEach(i => fermi.add(i));
  }
  out = out.map(v => Math.max(minimo, arr10(v)));
  const diff = totale - out.reduce((a, b) => a + b, 0), iMax = out.indexOf(Math.max(...out));
  out[iMax] += diff;
  return out;
}
// `totaleProva`: per l'anteprima, il piano con un totale settimanale diverso (senza salvarlo)
function pianoSettimanaCalc(data, totaleProva) {
  const date = dateSettimanaDi(data);
  const oggi = oggiISO();
  const sp = leggiSpostamenti(), rec = leggiRecuperi();
  const naturale0 = date.map(d => targetBase(d).kcal);
  const naturale = naturale0.reduce((a, b) => a + b, 0);
  // totale scelto da te: ogni giorno si scala nella stessa proporzione, così un giorno di allenamento resta sopra uno di riposo (mai sotto il basale)
  const scelto = totaleProva > 0 ? totaleProva : budgetScelto(date[0]);
  const bmr = Math.round(leggiProfilo().bmr);
  const base = scelto ? distribuisciTotale(naturale0, scelto, bmr) : naturale0;
  const aggiunta = totaleProva > 0 ? 0 : (leggiBudgetSett().aggiunte[date[0]] || 0);   // da «Cambia il totale»: va al giorno toccato, gli altri non si scalano
  const budget = base.reduce((a, b) => a + b, 0) + aggiunta;
  // un giorno scelto da te: { kcal } = proprio quelle calorie (anche se poi cambi sport o profilo); un numero = la differenza dal previsto (salvati prima)
  const fisso = date.map((d, i) => sp[d] && typeof sp[d] === "object" ? limita(sp[d].kcal, limitiGiorno(base[i])) : sp[d] ? limita(base[i] + sp[d], limitiGiorno(base[i])) : null);
  const g = date.map(d => giornoDiario(d));
  const mangiato = g.map(x => sommaMacro(x.pasti).kcal);
  const completo = g.map((x, i) => x.pasti.length >= 3 || mangiato[i] >= base[i] * 0.7);
  let resto = budget;
  const target = [];
  date.forEach((d, i) => {
    if (fisso[i] !== null) target[i] = arr10(fisso[i]);
    else if (d < oggi) target[i] = base[i]; // i giorni passati restano com'erano
    else {
      const fissiDopo = fisso.reduce((a, f, j) => a + (j > i && f !== null ? f : 0), 0);
      const liberi = base.reduce((a, b, j) => a + (j >= i && fisso[j] === null ? b : 0), 0) || base[i];
      target[i] = arr10(limita((resto - fissiDopo) * base[i] / liberi, limitiAuto(base[i])));
    }
    const recupera = d < oggi && completo[i] && rec[d] === "si";
    resto -= recupera ? mangiato[i] : target[i];
  });
  const finoAOggi = date.reduce((a, d, i) => a + (d <= oggi ? mangiato[i] : 0), 0);
  return { date, base, fisso, target, budget, mangiato, completo, finoAOggi, scarto: Math.round(-resto), naturale, scelto: scelto || (aggiunta ? budget : null) };
}

// Obiettivo del giorno (kcal e macro) tenendo conto del budget settimanale
function targetEffettivo(data) {
  const oggi = oggiISO();
  if (data < oggi) { const salvato = ((leggiDiarioSolaLettura()[data] || {}).tgt); if (salvato && salvato.kcal > 0) return salvato; }   // un giorno passato mantiene l'obiettivo che aveva: Andamento non cambia a posteriori
  const r = targetEffettivoCalcolato(data);
  if (data === oggi) { try { const g0 = leggiDiarioSolaLettura()[data], nuovo = { kcal: r.kcal, proteine: r.proteine, carboidrati: r.carboidrati, grassi: r.grassi };
    if (g0 && (g0.pasti || []).length && JSON.stringify(g0.tgt) !== JSON.stringify(nuovo)) { const d = leggiDiario(), g = d[data]; if (g) { g.tgt = nuovo; salvaDiario(d); } } } catch (e) {} }   // oggi: si ricorda l'ultimo valore visto
  return r;
}
function targetEffettivoCalcolato(data) {
  const T = targetBase(data);
  const p = pianoSettimana(data);
  const kcal = p.target[p.date.indexOf(data)];
  const delta = kcal - T.kcal;
  if (!delta) return T;
  // proteine invariate; la differenza va per il 70% sui carboidrati e il 30% sui grassi
  return {
    kcal,
    proteine: T.proteine,
    carboidrati: Math.max(40, Math.round((T.carboidrati + delta * 0.7 / 4) / 5) * 5),
    grassi: Math.max(Math.round(T.grassi * 0.85), Math.round(T.grassi + delta * 0.3 / 9)),
  };
}

// -------- Recupero chiesto sul momento (in Oggi) --------
// L'ultimo giorno passato di questa settimana, completo, con una differenza
// importante rispetto all'obiettivo e su cui non hai ancora deciso.
function recuperoDaChiedere(data) {
  if (data !== oggiISO()) return null;
  const p = pianoSettimana(data), rec = leggiRecuperi();
  const futuri = p.date.filter(d => d >= data).length;
  for (let i = p.date.indexOf(data) - 1; i >= 0; i--) {
    const d = p.date[i];
    if (!p.completo[i] || rec[d]) continue;
    const diff = Math.round(p.mangiato[i] - p.target[i]);
    if (Math.abs(diff) >= Math.max(150, p.target[i] * 0.08)) return { data: d, diff, giorni: futuri };
  }
  return null;
}
function recuperoHTML(data) {
  const r = recuperoDaChiedere(data);
  if (!r) return "";
  const quando = r.data === addGiorniISO(data, -1) ? "Ieri" : fmtGiornoLungo(r.data);
  const sopra = r.diff > 0;
  const alGiorno = Math.round(Math.abs(r.diff) / r.giorni / 10) * 10;
  // compatto: a sinistra cosa è successo e cosa propongo, a destra «No» / «Sì» piccoli
  const giorni = r.giorni === 1 ? "domani" : `in ${r.giorni} giorni`;
  return `<div class="recupero">
    <p><b>${quando} ${sopra ? "+" : "−"}${Math.abs(r.diff)} kcal</b><span>${sopra ? "Toglierle" : "Recuperarle"} ${giorni}? ${sopra ? "−" : "+"}${alGiorno}/giorno</span></p>
    <div class="recupero-btn"><button class="btn-sec" data-recupero="no" data-giorno="${r.data}">No</button><button class="btn" data-recupero="si" data-giorno="${r.data}">Sì</button></div>
  </div>`;
}

// Riga sotto le barre in Oggi, solo se oggi l'obiettivo è diverso dal solito
function rigaSettimanaHTML(data) {
  const p = pianoSettimana(data);
  const i = p.date.indexOf(data);
  const diff = p.target[i] - p.base[i];
  if (!diff) return "";
  return `<button class="settimana-riga" data-apri-settimana>
    <span>Oggi ${diff > 0 ? "+" : ""}${diff} kcal</span>
    <span>settimana ›</span></button>`;
}

// -------- Andamento → Settimana: budget e striscia dei 7 giorni --------
function budgetSettimanaHTML(dataRif) {
  const p = pianoSettimana(dataRif);
  const oggi = oggiISO();
  const nomi = ["L", "M", "M", "G", "V", "S", "D"];
  const giorniRestanti = p.date.filter(d => d >= oggi).length;
  const finita = giorniRestanti === 0;   // settimana passata: niente avvisi su cosa fare, solo il riepilogo
  // da oggi a domenica: gli obiettivi dei giorni rimasti, meno quanto hai già mangiato oggi
  const restano = p.date.reduce((a, d, i) => a + (d >= oggi ? p.target[i] - (d === oggi ? p.mangiato[i] : 0) : 0), 0);
  const sel = p.date.includes(giornoSelSett) ? giornoSelSett : null;
  const maxT = Math.max(...p.target, ...p.mangiato) || 1;
  const striscia = p.date.map((d, i) => {
    const passato = d < oggi;
    const diff = p.target[i] - p.base[i];
    const h = Math.round((passato ? p.mangiato[i] : p.target[i]) / maxT * 100);
    // giorni passati con gli stessi colori e soglie dell'Andamento: in linea, sopra, sotto, incompleto
    const reg = p.mangiato[i] > 0;
    const cls = passato ? (!reg ? "" : !p.completo[i] ? "gk-parz" : p.mangiato[i] / p.target[i] > 1.15 ? "gk-bad" : p.mangiato[i] / p.target[i] > 1.06 ? "gk-warn" : p.mangiato[i] / p.target[i] < 0.85 ? "gk-low" : "gk-ok") : (diff > 0 ? "piu" : diff < 0 ? "meno" : "");
    return `<button class="ss-giorno ${d === oggi ? "oggi" : ""} ${passato ? "passato" : ""} ${d === sel ? "sel" : ""}" ${passato ? `data-apri-giorno="${d}"` : `data-sett-giorno="${d}"`}>
      <span class="ss-lett">${nomi[i]}</span>
      <span class="ss-barra"><span style="height:${h}%" class="${cls}"></span></span>
      <span class="ss-kcal">${passato ? (p.mangiato[i] ? Math.round(p.mangiato[i]) : "—") : p.target[i]}</span>
      ${p.fisso[i] !== null && !passato ? `<span class="ss-pin">●</span>` : ""}
    </button>`;
  }).join("");
  const k = (x) => Math.round(x).toLocaleString("it-IT");
  // una riga sola: quanto resta (o come è andata) e, solo se non basta il margine, ⚠ con di quanto
  const riga = finita ? `${k(p.finoAOggi)} / ${k(p.budget)} kcal` : `Restano <b>${k(restano)} kcal</b> · ${giorniRestanti} ${giorniRestanti === 1 ? "giorno" : "giorni"}`;
  const tot = `<button class="bs-totale" data-sett-budget="${p.date[0]}" aria-label="Cambia l'obiettivo della settimana"><span>🎯 Settimana <b>${k(p.budget)} kcal</b>${p.scelto ? ` <em class="bs-scelto">scelto da te</em>` : ""}</span><span class="bs-matita">✏️</span></button>`;
  return `<div class="budget-sett">
    ${finita ? "" : tot}
    <div class="bs-top"><span>${riga}</span>${!finita && p.scarto > 20 ? `<span class="bs-warn" aria-label="L'obiettivo della settimana non basta">⚠️ +${p.scarto}</span>` : ""}</div>
    <div class="ss-striscia">${striscia}</div>
    ${p.fisso.some((f, i) => f !== null && p.date[i] >= oggi) ? `<button class="btn-link" data-sett-azzera="${p.date[0]}" aria-label="Azzera le modifiche della settimana">↺</button>` : ""}
  </div>`;
}

// Un contatore per ogni giorno della settimana (da oggi in poi); i giorni passati in breve
function giorniSettimanaHTML(dataRif) {
  const p = pianoSettimana(dataRif);
  const oggi = oggiISO();
  const nomi = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  const passati = p.date.map((d, i) => ({ d, i })).filter(x => x.d < oggi);
  const futuri = p.date.map((d, i) => ({ d, i })).filter(x => x.d >= oggi);
  const futuriHTML = futuri.map(({ d, i }) => {
    const [lo, hi] = limitiGiorno(p.base[i]);
    return `<div class="gs-card ${d === oggi ? "oggi" : ""} ${d === giornoSelSett ? "sel" : ""}" id="gs-${d}">
      <div class="gs-testa">
        <div class="gs-nome"><b>${d === oggi ? "Oggi" : nomi[i]} ${fmtData(d).split(" ")[0]}</b></div>
        <div class="gs-contatore">
          <button class="nav-btn" data-sett-passo="-1" data-giorno="${d}" ${p.target[i] <= lo ? "disabled" : ""} aria-label="100 kcal in meno">−</button>
          <button class="gs-kcal" data-sett-giorno-kcal="${d}" aria-label="Scrivi le kcal di questo giorno"><b>${p.target[i]}</b><small>kcal</small></button>
          <button class="nav-btn" data-sett-passo="1" data-giorno="${d}" ${p.target[i] >= hi ? "disabled" : ""} aria-label="100 kcal in più">＋</button>
        </div>
      </div>
      ${funzioneAttiva("allenamenti") ? `<button class="tipo-btn gs-tipo" data-scegli-allen-data="${d}">${tipoSportHTML(TIPI_GIORNATA[giornoDiario(d).tipo])} <span class="caret">▾</span></button>` : ""}
    </div>`;
  }).join("");
  return futuriHTML;
}

function impostaSpostamento(data, valore) {
  const sp = leggiSpostamenti();
  const p0 = pianoSettimana(data), base = p0.base[p0.date.indexOf(data)];   // valore: la differenza rispetto all'obiettivo del giorno (già scalato sul totale che hai scelto)
  sp[data] = { kcal: limita10(base + valore, limitiGiorno(base)) };   // si salvano le calorie esatte: «sabato 3200» resta 3200 anche se poi allunghi la bici
  salvaSpostamenti(sp);
}

// ridisegna dove è visibile la striscia (schermata principale e/o Andamento)
// i menu già compilati seguono il nuovo budget: la schermata si aggiorna subito, l'adattamento parte un istante dopo (e se tocchi più volte di fila, una volta sola)
let _riadTimer = null;
function riadattaDopo(dataRif) {
  clearTimeout(_riadTimer);
  _riadTimer = setTimeout(() => {
    const prima = riadattaSettimana(dataRif);
    if (Object.keys(prima).length && typeof avviso === "function") avviso("✓ Pasti adattati", "Annulla", () => { annullaPianificazione(prima); renderOggi(); });
    if (document.querySelector("#modal-content .budget-sett") && !document.getElementById("modal").hidden) rirenderAndamento();
    renderOggi();
  }, 350);
}
function aggiornaSettimana() {
  riadattaDopo(giornoSelSett || dataDiario);
  if (document.querySelector("#modal-content .budget-sett") && !document.getElementById("modal").hidden) rirenderAndamento();
  renderOggi();
}
// -------- Pannello: obiettivo della settimana --------
const NOMI_GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const kIt = (x) => Math.round(x).toLocaleString("it-IT");
const numDa = (v) => { const n = parseInt(String(v).replace(/[^\d]/g, ""), 10); return isNaN(n) ? 0 : n; };
function anteprimaBudgetHTML(lun, totale) {
  const p = pianoSettimanaCalc(lun, totale), oggi = oggiISO();
  return p.date.map((d, i) => `<div class="bsp-riga${d < oggi ? " passato" : ""}"><span>${NOMI_GIORNI[i].slice(0, 3)} ${fmtData(d).split(" ")[0]}</span><span class="bsp-tipo">${TIPI_GIORNATA[giornoDiario(d).tipo].icone}</span><b>${kIt(p.target[i])}</b></div>`).join("")
    + `<div class="bsp-riga bsp-tot"><span>Totale</span><span></span><b>${kIt(p.target.reduce((a, b) => a + b, 0))}</b></div>`;
}
function apriBudgetSett(lun) {
  const p = pianoSettimana(lun), b = leggiBudgetSett();
  const sempreAttivo = b.sempre && lun >= b.sempre.da;
  openModal(`<h3 class="modal-title">🎯 Obiettivo della settimana</h3>
    <p class="hint">Scrivi quante kcal vuoi mangiare in tutta la settimana: l'app le divide tra i giorni in base agli allenamenti. Calcolato dal tuo profilo: <b>${kIt(p.naturale)} kcal</b>.</p>
    <div class="bsp-campo"><input id="bs-input" class="qta-input" type="text" inputmode="numeric" value="${p.budget}" data-lun="${lun}" aria-label="kcal della settimana"><span>kcal</span></div>
    <p class="bsp-media" id="bs-media">≈ ${kIt(p.budget / 7)} kcal al giorno in media</p>
    <div class="bsp-lista" id="bs-anteprima">${anteprimaBudgetHTML(lun, p.budget)}</div>
    <div class="bsp-azioni">
      <button class="btn-sec" data-bs-salva="settimana" data-lun="${lun}">Solo questa settimana</button>
      <button class="btn" data-bs-salva="sempre" data-lun="${lun}">Da ora in poi</button>
    </div>
    ${p.scelto || sempreAttivo ? `<button class="btn-link bsp-reset" data-bs-reset="${lun}">↺ Torna al calcolato dal profilo</button>` : ""}`);
}
function salvaBudgetDa(lun, modo) {
  const v = numDa((document.getElementById("bs-input") || {}).value), bmr = Math.round(leggiProfilo().bmr);
  if (v < bmr * 7) { avviso(`Troppo poco: almeno ${kIt(bmr * 7)} kcal (il tuo metabolismo basale × 7)`); return; }
  const b = leggiBudgetSett();
  if (modo === "sempre") { b.sempre = { kcal: v, da: lun }; Object.keys(b.settimane).forEach(l => { if (l >= lun) delete b.settimane[l]; }); Object.keys(b.aggiunte).forEach(l => { if (l >= lun) delete b.aggiunte[l]; }); }
  else { b.settimane[lun] = v; delete b.aggiunte[lun]; }   // il totale scritto da te è quello: niente aggiunte sopra
  salvaBudgetSett(b); closeModal(); aggiornaSettimana();
  avviso(`✓ Obiettivo settimana: ${kIt(v)} kcal${modo === "sempre" ? " da ora in poi" : ""}`);
}
// -------- Pannello: un giorno --------
function apriGiornoSett(data, kcal) {
  const p = pianoSettimana(data), i = p.date.indexOf(data), [lo, hi] = limitiGiorno(p.base[i]);
  const v = limita(kcal || p.target[i], [lo, hi]);
  openModal(`<h3 class="modal-title">${data === oggiISO() ? "Oggi" : NOMI_GIORNI[i]} ${fmtData(data).split(" ")[0]} ${TIPI_GIORNATA[giornoDiario(data).tipo].icone}</h3>
    <p class="hint">Previsto: <b>${kIt(p.target[i])} kcal</b> · settimana ${kIt(p.budget)} kcal</p>
    <div class="gs-contatore gsp-cont">
      <button class="nav-btn" data-gd-passo="-100" aria-label="100 kcal in meno">−</button>
      <input id="gd-input" class="qta-input" type="text" inputmode="numeric" value="${v}" data-data="${data}" data-lo="${lo}" data-hi="${hi}" aria-label="kcal del giorno">
      <button class="nav-btn" data-gd-passo="100" aria-label="100 kcal in più">＋</button>
    </div>
    <p class="bsp-media" id="gd-diff"></p>
    <div class="bsp-azioni">
      <button class="btn-sec" data-gd-salva="compensa">Bilancia la settimana</button>
      <button class="btn" data-gd-salva="totale">Cambia il totale</button>
    </div>
    ${p.fisso[i] !== null ? `<button class="btn-link bsp-reset" data-gd-reset="${data}">↺ Come previsto</button>` : ""}`);
  aggiornaDiffGiorno();
}
function aggiornaDiffGiorno() {
  const inp = document.getElementById("gd-input"), out = document.getElementById("gd-diff"); if (!inp || !out) return;
  const p = pianoSettimana(inp.dataset.data), i = p.date.indexOf(inp.dataset.data), d = numDa(inp.value) - p.target[i];
  const resto = p.date.filter((x, j) => j !== i && x >= oggiISO() && p.fisso[j] === null).length;
  out.innerHTML = !d ? "" : `${d > 0 ? "+" : "−"}${kIt(Math.abs(d))} kcal · compensando: ${resto ? `${d > 0 ? "−" : "+"}${kIt(Math.abs(d) / resto)} negli altri ${resto} giorni` : "nessun altro giorno da adattare"} · oppure settimana ${kIt(p.budget + d)} kcal`;
}
function salvaGiorno(modo) {
  const inp = document.getElementById("gd-input"); if (!inp) return;
  const data = inp.dataset.data, v = limita(numDa(inp.value), [+inp.dataset.lo, +inp.dataset.hi]);
  const p = pianoSettimana(data), i = p.date.indexOf(data), d = v - p.target[i];
  if (modo === "totale" && d) {   // il giorno cambia e la settimana con lui: gli altri giorni restano come sono
    aggiungiAlTotale(p.date[0], d);
  }
  const p2 = pianoSettimana(data);
  impostaSpostamento(data, v - p2.base[p2.date.indexOf(data)]);
  giornoSelSett = data; closeModal(); aggiornaSettimana();
  avviso(`✓ ${kIt(v)} kcal${modo === "totale" && d ? ` · settimana ${kIt(p.budget + d)}` : ""}`);
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("modal-content").addEventListener("input", (e) => {
    if (e.target.id === "bs-input") {
      const v = numDa(e.target.value), box = document.getElementById("bs-anteprima"), m = document.getElementById("bs-media");
      if (v >= 1000 && box) { box.innerHTML = anteprimaBudgetHTML(e.target.dataset.lun, v); if (m) m.textContent = `≈ ${kIt(v / 7)} kcal al giorno in media`; }
    }
    if (e.target.id === "gd-input") aggiornaDiffGiorno();
  });
});
function clickSettimana(e) {
  const bb = e.target.closest("[data-sett-budget]");
  if (bb) { apriBudgetSett(bb.dataset.settBudget); return true; }
  const bs = e.target.closest("[data-bs-salva]");
  if (bs) { salvaBudgetDa(bs.dataset.lun, bs.dataset.bsSalva); return true; }
  const br = e.target.closest("[data-bs-reset]");
  if (br) {
    const lun = br.dataset.bsReset;
    chiediConferma("Tornare al calcolato?", "L'obiettivo della settimana torna quello calcolato dal tuo profilo, da questa settimana in poi", "Sì, torna", () => {
      const b = leggiBudgetSett(); Object.keys(b.settimane).forEach(l => { if (l >= lun) delete b.settimane[l]; }); Object.keys(b.aggiunte).forEach(l => { if (l >= lun) delete b.aggiunte[l]; });
      if (b.sempre) b.sempre = null;
      salvaBudgetSett(b); closeModal(); aggiornaSettimana(); avviso("✓ Obiettivo calcolato dal profilo");
    });
    return true;
  }
  const gk = e.target.closest("[data-sett-giorno-kcal]");
  if (gk) { apriGiornoSett(gk.dataset.settGiornoKcal); return true; }
  const gp = e.target.closest("[data-gd-passo]");
  if (gp) { const inp = document.getElementById("gd-input"); if (inp) { inp.value = limita(numDa(inp.value) + +gp.dataset.gdPasso, [+inp.dataset.lo, +inp.dataset.hi]); aggiornaDiffGiorno(); } return true; }
  const gs = e.target.closest("[data-gd-salva]");
  if (gs) { salvaGiorno(gs.dataset.gdSalva); return true; }
  const gr = e.target.closest("[data-gd-reset]");
  if (gr) { const sp = leggiSpostamenti(); delete sp[gr.dataset.gdReset]; salvaSpostamenti(sp); closeModal(); aggiornaSettimana(); avviso("✓ Come previsto"); return true; }
  const g = e.target.closest("[data-sett-giorno]");
  if (g) {
    giornoSelSett = g.dataset.settGiorno;
    aggiornaSettimana();
    const card = document.getElementById("gs-" + giornoSelSett); if (card) card.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  }
  const ps = e.target.closest("[data-sett-passo]");
  if (ps) {
    giornoSelSett = ps.dataset.giorno;
    const p = pianoSettimana(giornoSelSett), i = p.date.indexOf(giornoSelSett);
    apriGiornoSett(giornoSelSett, p.target[i] + +ps.dataset.settPasso * PASSO_SPOSTAMENTO);   // si sceglie: compensare negli altri giorni o cambiare il totale
    return true;
  }
  const co = e.target.closest("[data-sett-compila]");
  if (co) {
    const r = pianificaSettimana(co.dataset.settCompila);
    if (!r.messe) { avviso("Niente da aggiungere", "", () => {}); return true; }
    aggiornaSettimana();
    avviso("✓ Settimana pronta", "Annulla", () => { annullaPianificazione(r.prima); aggiornaSettimana(); });
    return true;
  }
  const az = e.target.closest("[data-sett-azzera]");
  if (az) {
    const lunedi = az.dataset.settAzzera;
    chiediConferma("Azzerare le modifiche?", "Le calorie dei giorni tornano a quelle di partenza", "Azzera", () => {
      const sp = leggiSpostamenti();
      dateSettimanaDi(lunedi).forEach(d => { if (d >= oggiISO()) delete sp[d]; });
      { const b = leggiBudgetSett(); if (b.aggiunte[lunedi]) { delete b.aggiunte[lunedi]; salvaBudgetSett(b); } }   // anche le kcal aggiunte al totale con «Cambia il totale»
      salvaSpostamenti(sp); giornoSelSett = null; aggiornaSettimana();
    });
    return true;
  }
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("modal-content").addEventListener("click", clickSettimana);
  const oggi = document.getElementById("oggi");
  // tipo di allenamento di un giorno, scelto dalla vista Settimana
  oggi.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-tipo-giorno]");
    if (!sel) return;
    const g = giornoDiario(sel.dataset.tipoGiorno);
    g.tipo = sel.value;
    scriviGiorno(sel.dataset.tipoGiorno, g);
    renderOggi();
    riadattaDopo(sel.dataset.tipoGiorno);
  });
  oggi.addEventListener("click", (e) => {
    if (clickSettimana(e)) return;
    // recupero: Sì / No
    const r = e.target.closest("[data-recupero]");
    if (r) { const rec = leggiRecuperi(); rec[r.dataset.giorno] = r.dataset.recupero; salvaRecuperi(rec); renderOggi(); riadattaDopo(oggiISO()); return; }
    // il numero grande o la riga "rispetto al solito" portano alla vista Settimana
    if (e.target.closest("[data-apri-settimana]")) {
      vistaHome = "settimana";
      offsetSettHome = Math.round((new Date(addGiorniISO(dataDiario, -indiceSettimana(dataDiario)) + "T12:00") - new Date(addGiorniISO(oggiISO(), -indiceSettimana(oggiISO())) + "T12:00")) / (7 * 86400000));
      giornoSelSett = null;
      renderOggi(); window.scrollTo(0, 0);
    }
  });
});
