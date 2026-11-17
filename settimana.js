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
function limitiGiorno(base) { return [Math.max(leggiProfilo().bmr, Math.round(base * 0.8)), Math.round(base * 1.2)]; }
const limita = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
const arr10 = (v) => Math.round(v / 10) * 10;

// Il piano della settimana che contiene `data`.
// Giorno per giorno, il budget che resta si divide tra il giorno e quelli seguenti;
// i giorni spostati da te restano fissi. Un giorno passato conta per il suo
// obiettivo, oppure per quello che hai mangiato davvero se hai scelto di recuperare.
// Il piano è costoso (legge tutta la settimana dal diario) e viene richiesto decine di volte per ogni disegno: si ricorda finché i dati non cambiano
let _memoPianoChiave = "", _memoPiano = new Map();
function pianoSettimana(data) {
  let k; try { k = ["mp_diario", "mp_spostamenti", "mp_recuperi", "mp_profilo", "mp_tipi"].map(x => localStorage.getItem(x) || "").join("\u0001") + "|" + oggiISO(); } catch (e) { return pianoSettimanaCalc(data); }
  if (k !== _memoPianoChiave) { _memoPiano = new Map(); _memoPianoChiave = k; }
  const lun = dateSettimanaDi(data)[0];
  if (!_memoPiano.has(lun)) _memoPiano.set(lun, pianoSettimanaCalc(data));
  return _memoPiano.get(lun);
}
function pianoSettimanaCalc(data) {
  const date = dateSettimanaDi(data);
  const oggi = oggiISO();
  const sp = leggiSpostamenti(), rec = leggiRecuperi();
  const base = date.map(d => targetBase(d).kcal);
  const budget = base.reduce((a, b) => a + b, 0);
  const fisso = date.map((d, i) => sp[d] ? limita(base[i] + sp[d], limitiGiorno(base[i])) : null);
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
      target[i] = arr10(limita((resto - fissiDopo) * base[i] / liberi, limitiGiorno(base[i])));
    }
    const recupera = d < oggi && completo[i] && rec[d] === "si";
    resto -= recupera ? mangiato[i] : target[i];
  });
  const finoAOggi = date.reduce((a, d, i) => a + (d <= oggi ? mangiato[i] : 0), 0);
  return { date, base, fisso, target, budget, mangiato, completo, finoAOggi, scarto: Math.round(-resto) };
}

// Obiettivo del giorno (kcal e macro) tenendo conto del budget settimanale
function targetEffettivo(data) {
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
  // una riga sola: cosa è successo e quanto al giorno; ✓ sì, ✕ no
  return `<div class="recupero">
    <p>↩ ${quando} ${sopra ? "+" : "−"}${Math.abs(r.diff)} kcal · ${sopra ? "−" : "+"}${alGiorno}/giorno${r.giorni === 1 ? "" : ` × ${r.giorni}`}</p>
    <button class="nav-btn" data-recupero="no" data-giorno="${r.data}" aria-label="No">✕</button>
    <button class="nav-btn recupero-si" data-recupero="si" data-giorno="${r.data}" aria-label="${sopra ? "Recupera" : "Riprendile"}">✓</button>
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
  return `<div class="budget-sett">
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
          <span><b>${p.target[i]}</b><small>kcal</small></span>
          <button class="nav-btn" data-sett-passo="1" data-giorno="${d}" ${p.target[i] >= hi ? "disabled" : ""} aria-label="100 kcal in più">＋</button>
        </div>
      </div>
      <button class="tipo-btn gs-tipo" data-scegli-allen-data="${d}">${TIPI_GIORNATA[giornoDiario(d).tipo].icone} ${esc(TIPI_GIORNATA[giornoDiario(d).tipo].label)} <span class="caret">▾</span></button>
    </div>`;
  }).join("");
  return futuriHTML;
}

function impostaSpostamento(data, valore) {
  const sp = leggiSpostamenti();
  const base = targetBase(data).kcal;
  const v = Math.round(limita(base + valore, limitiGiorno(base)) - base);
  if (v) sp[data] = v; else delete sp[data];
  salvaSpostamenti(sp);
}

// ridisegna dove è visibile la striscia (schermata principale e/o Andamento)
// i menu già compilati seguono il nuovo budget: la schermata si aggiorna subito, l'adattamento parte un istante dopo (e se tocchi più volte di fila, una volta sola)
let _riadTimer = null;
function riadattaDopo(dataRif) {
  clearTimeout(_riadTimer);
  _riadTimer = setTimeout(() => {
    riadattaSettimana(dataRif);
    if (document.querySelector("#modal-content .budget-sett") && !document.getElementById("modal").hidden) rirenderAndamento();
    renderOggi();
  }, 350);
}
function aggiornaSettimana() {
  riadattaDopo(giornoSelSett || dataDiario);
  if (document.querySelector("#modal-content .budget-sett") && !document.getElementById("modal").hidden) rirenderAndamento();
  renderOggi();
}
function clickSettimana(e) {
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
    impostaSpostamento(giornoSelSett, p.target[i] - p.base[i] + +ps.dataset.settPasso * PASSO_SPOSTAMENTO);
    aggiornaSettimana(); return true;
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
    const sp = leggiSpostamenti();
    dateSettimanaDi(az.dataset.settAzzera).forEach(d => { if (d >= oggiISO()) delete sp[d]; });
    salvaSpostamenti(sp); giornoSelSett = null; aggiornaSettimana(); return true;
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
