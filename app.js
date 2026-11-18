// =============================================================
//  Generatore di pasti — logica principale
// =============================================================

const PASTI = ["colazione", "pranzo", "cena", "spuntino"];
const GIORNI = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

// -------- Profilo e obiettivi --------
// Gli obiettivi si calcolano dal profilo (modificabile in ⚙︎ → Profilo):
//  base del giorno   = BMR × 1,2 (vita quotidiana) − deficit %
//  calorie obiettivo = base + solo una quota (es. 60%) delle kcal bruciate in
//                      allenamento (le stime dei consumi sono spesso ottimistiche)
//  mai sotto il BMR
//  proteine = peso × g/kg · grassi = peso × g/kg · carboidrati = calorie rimanenti
// Così i carboidrati salgono nei giorni di allenamento e scendono a riposo.
const PROFILO_DEFAULT = { peso: 59, bmr: 1300, deficit: 15, recupero: 80, protKg: 2.4, grassiKg: 0.6 };
// Gli sport: le kcal le calcola l'app (in più rispetto a stare ferma), dal tuo peso.
// - a minuti: kcal al minuto per kg di peso × minuti (i minuti si scelgono ogni volta)
// - la corsa a km: circa 1 kcal per kg di peso per km
// Valori di partenza da tabelle di dispendio (MET), modificabili nel Profilo.
const SPORT_DEFAULT = [
  { id: "crossfit", nome: "CrossFit", icona: "🏋️", kMin: 0.1, min: 60 },
  { id: "equitazione", nome: "Equitazione", icona: "🐴", kMin: 0.075, min: 60 },
  { id: "kitesurf", nome: "Kitesurf", icona: "🪁", kMin: 0.085, min: 90 },
  { id: "corsa", nome: "Corsa", icona: "🏃", perKm: true, km: 5 },
  { id: "funzionale", nome: "Allenamento funzionale", icona: "🤸‍♀️", kMin: 0.093, min: 60 },
  { id: "pesi", nome: "Sala pesi", icona: "💪", kMin: 0.068, min: 60 },
  { id: "camminata", nome: "Camminata", icona: "🚶", kMin: 0.05, min: 30 },
  { id: "bici", nome: "Bici", icona: "🚴", kMin: 0.075, min: 45 },
  { id: "ballo", nome: "Ballo", icona: "💃", kMin: 0.065, min: 30 },
  { id: "corpolibero", nome: "Corpo libero", icona: "🤸", kMin: 0.1, min: 30 },
];
// intensità tra cui scegliere per uno sport nuovo (kcal al minuto per kg)
const INTENSITA_SPORT = [["leggera", "Leggera (yoga, camminata, pilates)", 0.05], ["media", "Media (pesi, bici tranquilla, padel)", 0.075], ["intensa", "Intensa (circuiti, spinning, nuoto veloce)", 0.1]];
// sport a sessione salvati prima dei minuti: le kcal di una sessione diventano kcal al minuto
function sportAMinuti(sp, peso) {
  if (sp.perKm || sp.kMin) return sp;
  const def = SPORT_DEFAULT.find(d => d.id === sp.id);
  const min = (def && def.min) || 60;
  return Object.assign({}, sp, { kMin: Math.round((+sp.kcal || 300) / min / peso * 1000) / 1000, min });
}
function leggiProfilo() {
  let pf;
  try {
    const salvato = JSON.parse(localStorage.getItem("mp_profilo")) || {};
    // dal 21/10/2026 si reintegra l'80% delle kcal di allenamento (era 60%): una volta sola, anche per i profili già salvati
    if (salvato.recupero === 60 && !salvato.recupero80) { salvato.recupero = 80; salvato.recupero80 = true; localStorage.setItem("mp_profilo", JSON.stringify(salvato)); }
    // dal 23/10/2026 deficit 15%, proteine 2,4 e grassi 0,6 g/kg: una volta sola, e solo se avevi ancora i valori di prima
    if (!salvato.macro1023) {
      if ((salvato.deficit ?? 10) === 10 && (salvato.protKg ?? 2.2) === 2.2 && (salvato.grassiKg ?? 0.9) === 0.9) Object.assign(salvato, { deficit: 15, protKg: 2.4, grassiKg: 0.6 });
      salvato.macro1023 = true; localStorage.setItem("mp_profilo", JSON.stringify(salvato));
    }
    pf = Object.assign({}, PROFILO_DEFAULT, salvato);
  }
  catch (e) { pf = Object.assign({}, PROFILO_DEFAULT); }
  if (!Array.isArray(pf.sport) || !pf.sport.length) pf.sport = SPORT_DEFAULT.map(sp => Object.assign({}, sp));
  pf.sport = pf.sport.filter(sp => sp.id !== "scale").map(sp => sportAMinuti(sp, pf.peso));   // «Scale / trekking» tolto
  // gli sport nuovi (corsa, funzionale, sala pesi) arrivano anche nei profili già salvati, se non li hai tolti
  const tolti = new Set(pf.sportTolti || (pf.corsaTolta ? ["corsa"] : []));
  SPORT_DEFAULT.forEach(d => { if (!pf.sport.some(sp => sp.id === d.id) && !tolti.has(d.id) && ["corsa", "funzionale", "pesi", "camminata", "bici", "ballo", "corpolibero"].includes(d.id)) pf.sport.push(Object.assign({}, d)); });
  return pf;
}
function salvaProfilo(p) { localStorage.setItem("mp_profilo", JSON.stringify(p)); calcolaTarget(); }
// gli sport tra cui scegliere: quelli «tolti» restano salvati (nascosto: true) perché i giorni passati li usano ancora
const leggiSport = () => leggiProfilo().sport.filter(sp => !sp.nascosto);

// -------- Tipo di giornata = gli sport che fai quel giorno --------
// La chiave è l'elenco degli sport separati da "+", con la durata di quel giorno:
// "pesi:45+corsa:6.5" (minuti per gli sport a tempo, km per la corsa).
// "riposo" se non ti alleni. Le chiavi di prima (alta, media, equit, senza durata) restano valide.
const VECCHI_TIPI = { alta: "crossfit+equitazione", media: "crossfit", equit: "equitazione", riposo: "riposo" };
function sportDelTipo(chiave) {
  const k = VECCHI_TIPI[chiave] || chiave || "riposo";
  return k === "riposo" ? [] : k.split("+").filter(Boolean).map(x => x.split(":")[0]);
}
// durate di quel giorno: { pesi: 45, corsa: 6.5 }
function durateDelTipo(chiave) {
  const out = {};
  String(VECCHI_TIPI[chiave] || chiave || "").split("+").forEach(x => { const [id, v] = x.split(":"); const n = parseFloat(v); if (!isNaN(n)) out[id] = n; });
  return out;
}
const kmDelTipo = (chiave) => durateDelTipo(chiave).corsa ?? null;
function chiaveTipo(ids, durate = {}) {
  const ordine = leggiProfilo().sport.map(sp => sp.id);   // anche i nascosti: l'ordine di un giorno passato non cambia
  const v = [...new Set(ids)].sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
  return v.length ? v.map(id => durate[id] ? `${id}:${durate[id]}` : id).join("+") : "riposo";
}
// durata di uno sport in un giorno: quella scritta quel giorno, altrimenti la sessione standard
// (così i giorni salvati senza durata non cambiano quando cambi i minuti di oggi)
const durataSport = (sp, v) => v || (sp.perKm ? sp.km || 5 : sp.min || 60);
// durata da proporre quando scegli lo sport: quella dell'ultima volta
const durataProposta = (sp) => sp.ultimo || durataSport(sp);
// kcal di uno sport in quel giorno
function kcalSport(sp, v, pf = leggiProfilo()) {
  if (sp.perKm) return Math.round(durataSport(sp, v) * pf.peso);
  if (sp.kMin) return Math.round(sp.kMin * pf.peso * durataSport(sp, v));
  return +sp.kcal || 0;
}
const kcalMinuto = (sp, pf = leggiProfilo()) => Math.round(sp.kMin * pf.peso * 10) / 10;
const fmtKm = (km) => String(Math.round(km * 10) / 10).replace(".", ",");
const fmtMin = (m) => m >= 60 && m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60}′` : `${m}′`;
const etichettaDurata = (sp, v) => sp.perKm ? `${fmtKm(durataSport(sp, v))} km` : fmtMin(durataSport(sp, v));
const arr50 = (x) => Math.round(x / 50) * 50;
let _cacheTipi = {}, _cacheChiaveProfilo = "";
// Obiettivo, fabbisogno, nome e icone di un tipo di giornata, dal profilo
function tipoInfo(chiave) {
  const pf = leggiProfilo();
  const firma = JSON.stringify(pf);
  if (firma !== _cacheChiaveProfilo) { _cacheTipi = {}; _cacheChiaveProfilo = firma; }
  const k = VECCHI_TIPI[chiave] || chiave || "riposo";
  if (_cacheTipi[k]) return _cacheTipi[k];
  const sport = sportDelTipo(k).map(id => pf.sport.find(sp => sp.id === id)).filter(Boolean);
  const dur = durateDelTipo(k);
  const allen = sport.reduce((tot, sp) => tot + kcalSport(sp, dur[sp.id], pf), 0);
  const base = pf.bmr * 1.2;
  const kcal = Math.max(pf.bmr, arr50(base * (1 - pf.deficit / 100) + allen * pf.recupero / 100));
  const proteine = Math.round(pf.peso * pf.protKg / 5) * 5;
  const grassi = Math.round(pf.peso * pf.grassiKg);
  const carboidrati = Math.max(50, Math.round((kcal - proteine * 4 - grassi * 9) / 4 / 5) * 5);
  return (_cacheTipi[k] = {
    chiave: k,
    sport,
    label: sport.length ? sport.map(sp => sp.nome).join(" + ") : "Riposo",
    icone: sport.length ? sport.map(sp => sp.icona).join("") : "😴",
    fabbisogno: Math.round(base + allen),
    target: { kcal, proteine, carboidrati, grassi },
    range: `${kcal - 50}–${kcal + 50}`,
  });
}
// Il tipo di giornata come rettangoli: uno per sport (icona + nome), affiancati, e un ＋ per aggiungerne; senza sport, «Riposo»
const tipoSportHTML = (t) => `<span class="tipo-sport">${t.sport && t.sport.length ? t.sport.map(sp => `<span class="tipo-chip">${sp.icona} ${esc(sp.nome)}</span>`).join("") : `<span class="tipo-chip">${t.icone} ${esc(t.label)}</span>`}<span class="tipo-chip tipo-piu" aria-label="Aggiungi o cambia sport">＋</span></span>`;
// Compatibilità: TIPI_GIORNATA[chiave] restituisce le info di qualsiasi combinazione di sport;
// l'elenco (Object.entries) contiene riposo, ogni sport da solo e le combinazioni della settimana tipo.
const TIPI_GIORNATA = new Proxy({}, {
  get: (_, chiave) => typeof chiave === "string" ? tipoInfo(chiave) : undefined,
  has: () => true,
  ownKeys: () => {
    const chiavi = ["riposo", ...leggiSport().map(sp => sp.id)];
    try { (JSON.parse(localStorage.getItem("mp_tipi")) || []).forEach(t => { const k = VECCHI_TIPI[t] || t; if (!chiavi.includes(k)) chiavi.push(k); }); } catch (e) {}
    return chiavi;
  },
  getOwnPropertyDescriptor: (_, chiave) => ({ enumerable: true, configurable: true, value: tipoInfo(chiave) }),
});
function calcolaTarget() { _cacheChiaveProfilo = ""; } // gli obiettivi si ricalcolano al prossimo uso
// Versione degli obiettivi: se cambia, il piano salvato viene rigenerato
const VERSIONE_TARGET = 3;
// Assegnazione di default (Lun→Dom), dalla routine del profilo
// lun sala pesi · mar crossfit (o equitazione) · mer crossfit · gio equitazione · ven crossfit · sab crossfit + sala pesi (o + equitazione) · dom riposo
const DEFAULT_TIPI = ["pesi", "crossfit", "crossfit", "equitazione", "crossfit", "crossfit+pesi", "riposo"];

// Stato: ricette in uso (ricettario di base + le tue)
let ricette = [];
let editCtx = null;                       // (vecchio piano settimanale: resta solo per compatibilità, sempre null)

// slug per collegare i pasti del piano alle schede ricetta
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
const clone = (o) => JSON.parse(JSON.stringify(o));

// -------- Macro calcolati dagli ingredienti (tabella nutrition.js) --------
function grammiIng(i) {
  if (i.unita === "pz") return i.qta * ((window.PESO_PZ || {})[i.nome] || 0);
  if (i.unita === "g" || i.unita === "ml") return i.qta;
  if (i.unita === "cucchiaio") return i.qta * window.pesoCucchiaio(i.nome, false);
  if (i.unita === "cucchiaino") return i.qta * window.pesoCucchiaio(i.nome, true);
  if (i.unita === "pizzico") return i.qta * 0.5;
  return 0; // q.b.
}
const UNITA = ["g", "ml", "pz", "cucchiaio", "cucchiaino", "pizzico", "q.b."];
// cestino rosso per togliere un singolo elemento (ingrediente, passaggio, voce della spesa, sport)
const ICONA_CESTINO = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>`;

// -------- Lettura di una lista di ingredienti scritta a mano --------
// Capisce righe come "120 farina", "100gr albume", "1 cucchiaio yogurt greco",
// "farina 120 g", "2 uova", "½ cucchiaino di lievito", "sale".
const SINONIMI_UNITA = [
  [/^(g|gr|grammi|grammo)\.?$/, "g", 1], [/^kg$/, "g", 1000],
  [/^(ml|millilitri)$/, "ml", 1], [/^(l|lt|litro|litri)$/, "ml", 1000], [/^(dl)$/, "ml", 100], [/^(cl)$/, "ml", 10],
  [/^(cucchiaio|cucchiai|cucch|cc)\.?$/, "cucchiaio", 1], [/^(cucchiaino|cucchiaini)$/, "cucchiaino", 1],
  [/^(pizzico|pizzichi)$/, "pizzico", 1], [/^(pz|pezzo|pezzi|n)\.?$/, "pz", 1], [/^(q\.?b\.?)$/, "q.b.", 1],
  [/^(calic[ei]|bicchier[ei]|lattin[ae]|bottigli[ae]|fett[ae]|porzion[ei]|tranci|trancio|tazz[ae]|tazzin[ae])$/, "pz", 1],
];
function numeroDa(t) {
  t = t.replace(",", ".").replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75");
  const f = t.match(/^(\d+)\/(\d+)$/);
  return f ? +f[1] / +f[2] : parseFloat(t);
}
function leggiRigaIngrediente(riga) {
  let t = riga.toLowerCase().replace(/[’`]/g, "'").replace(/^[-•*·\s]+/, "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // suggerimenti e alternative: "2 banane (200 gr circa) - o purea di mela", "latte a scelta (per me avena)", "180 gr farina 00 (o riso)"
  t = t.replace(/^(\d+)\s+([a-zà-ù' ]+?)\s*\((?:circa\s*)?(\d+)\s*(?:g|gr)\s*(?:circa)?\)/, (m, n, c, g) => `${g} g ${c} `);   // "2 carote (120 gr circa)" -> 120 g carote
  t = t.replace(/^(\d+)\s+(.+?)\s+e\s+mezz[oa]\b/, (m, n, c) => `${+n + 0.5} ${c}`);                                    // "1 mela e mezza" -> 1.5 mela
  const altTesti = [];                                                                                      // "(o riso)", "- o purea di mela", "o cocco/semi": diventano varianti
  t = t.replace(/\(\s*o\s+([^)]*)\)/g, (m, x) => { altTesti.push(x); return " "; })
    .replace(/\s+[-–]\s*o\s+(.+)$/, (m, x) => { altTesti.push(x); return ""; })
    .replace(/\s+o\s+(?=[a-zà-ù])(.+)$/, (m, x) => { altTesti.push(x); return ""; });
  t = t.replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ").trim().replace(/\s*\b(a scelta|a piacere|a gusto|facoltativ[oiae]|opzionale|senza buccia|per me\b.*)\s*$/g, "").replace(/\s+/g, " ").trim();
  t = t.replace(/\b(bel|bella|abbondante)\s+(?=pizzic|cucchia|mazzett|ciuff|po\b)/, "");   // "un bel pizzico di sale"
  t = t.replace(/^(qb|q\.b\.?|quanto basta)\s+(.+)$/, "$2 q.b.").replace(/^(sale|pepe)\s*(?:e|,|&)\s*(?:sale|pepe)\b.*$/, "sale q.b.");   // "qb sale", "sale e pepe"
  // numeri in lettere e unità senza numero: "un pizzico di sale", "mezzo cucchiaino", "due uova"
  t = t.replace(/^(?:un|uno|una)?\s*(?:filo|giro|goccio|goccia|po')\s+(?:di|d')\s*(.+)$/, "1 cucchiaio $1");   // "un filo d'olio", "un goccio di latte"
  const PAROLE = { "un": 1, "uno": 1, "una": 1, "mezzo": 0.5, "mezza": 0.5, "due": 2, "tre": 3, "quattro": 4, "cinque": 5, "sei": 6 };
  t = t.replace(/^(un|uno|una|mezzo|mezza|due|tre|quattro|cinque|sei)\s+/, (_, w) => PAROLE[w] + " ").replace(/^un'/, "1 ");
  if (/^(cucchiai[on]?[oi]?|cucchiaini|pizzic[oh]i?)\b/.test(t)) t = "1 " + t;
  t = t.replace(/^(\d+(?:\.\d+)?)?\s*bustin[ae]\s+(?:di\s+)?lievito.*$/, (m, n) => `${(+n || 1) * 16} g lievito per dolci`);   // 1 bustina = 16 g
  // misure "a occhio" che compaiono nelle ricette: si trasformano in grammi o in q.b.
  const nn = x => (x === undefined || x === "" ? 1 : parseFloat(String(x).replace(",", ".")));
  t = t.replace(/^(\d+(?:[.,]\d+)?)?\s*scatolett[ae]\s+(?:di\s+)?(.+)$/, (m, n, c) => `${Math.round(nn(n) * 80)} g ${c}`)
    .replace(/^(\d+(?:[.,]\d+)?)?\s*spicch[io]\w*\s+(?:di\s+)?(.+)$/, (m, n, c) => `${Math.round(nn(n) * 4)} g ${c}`)
    .replace(/^(\d+(?:[.,]\d+)?)?\s*vasett[io]\s+(?:di\s+)?(.+)$/, (m, n, c) => `${Math.round(nn(n) * 125)} g ${c}`)
    .replace(/^(\d+(?:[.,]\d+)?)?\s*fett[ae]\s+(?:di\s+)?(pane.*)$/, (m, n, c) => `${Math.round(nn(n) * 30)} g ${c}`)
    .replace(/^(\d+(?:[.,]\d+)?)?\s*(?:foglie|foglia|rametti|rametto|ciuff[io]|mazzett[io])\s+(?:di\s+)?(.+)$/, (m, n, c) => `${c} q.b.`);
  let qta = null, unita = null;
  const numRe = "(\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|[½¼¾])";   // la frazione prima del numero semplice: «1/2» non deve leggersi «1»
  const unitaDa = (u) => { const s = SINONIMI_UNITA.find(([re]) => re.test(u)); return s ? s : null; };
  // numero (+ unità) all'inizio: "120 farina", "100gr albume", "1 cucchiaio di yogurt"
  let m = t.match(new RegExp("^" + numRe + "\\s*([a-zà-ù.]+)?\\s*(.*)$"));
  if (m) {
    qta = numeroDa(m[1]);
    const u = m[2] && unitaDa(m[2]);
    if (u) { unita = u[1]; qta *= u[2]; t = m[3]; } else t = ((m[2] || "") + " " + m[3]).trim();
  } else {
    // numero (+ unità) alla fine: "farina 120 g", "yogurt greco 1 cucchiaio"
    m = t.match(new RegExp("^(.*?)\\s+" + numRe + "\\s*([a-zà-ù.]+)?$"));
    if (m) { const u = m[3] && unitaDa(m[3]); if (!m[3] || u) { t = m[1]; qta = numeroDa(m[2]); if (u) { unita = u[1]; qta *= u[2]; } } }
  }
  t = t.replace(/^(di|d'|del|della|dello|dei|degli|delle)\s*/, "").replace(/\s*(q\.?b\.?)$/, "").trim();
  // aggettivi che non cambiano l'alimento: "1 banana matura", "2 uova medie"
  t = t.replace(/\b(matur[aeio]|bel|bella|abbondante|abbondanti|scars[oa]|colm[oi]|ras[oi]|medi[aeio]|grand[ei]|piccol[aeio]|fresc[aoh]i?e?|bio|biologic[aoh]i?e?|tritat[aoei]|grattugiat[aoei]|sbucciat[aoei]|lavat[aoei]|a pezzetti|a cubetti|a fette)\b/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\b(uova|uovo)\s+inter[aeio]\b/, "$1").replace(/\bgocce di cioccolato\s+(?:extra\s+)?fondente\b/, "gocce di cioccolato");   // "uova intere", "gocce di cioccolato fondente"
  const trovati = typeof cercaAlimenti === "function" ? cercaAlimenti(t) : [];
  const nome = trovati[0] || "";
  if (qta === null) { qta = 1; unita = unita || "q.b."; }            // "sale" -> q.b.
  if (!unita) unita = (((window.pzPredefinito && window.pzPredefinito(nome)) || (window.PESO_PZ || {})[nome] >= 15) && qta <= 12) ? "pz" : (UNITA_LIQUIDI.test(nome) || /^acqua\b/i.test(nome)) ? "ml" : "g"; // "2 uova" -> pz
  const out = { nome, cercato: t, qta: Math.round(qta * 100) / 100, unita };
  const alt = altTesti.length ? alternativeDaTesto(altTesti, t, nome) : [];
  if (alt.length) out.alt = alt;
  return out;
}
// "o riso per renderlo senza glutine", "cocco/semi" -> nomi di alimenti conosciuti (prima nel contesto: "farina di riso", "olio di cocco")
function alternativeDaTesto(testi, testoBase, nomeBase) {
  const parola = (testoBase || "").split(" ")[0], chiavi = Object.keys(window.ALIMENTI || {}), trovate = [];
  testi.join(" / ").split(/\s*(?:\/|,|;|\s+o\s+)\s*/).forEach(p => {
    p = p.replace(/\s+(per|senza|se|che|come)\b.*$/i, "").replace(/\s*(a scelta|a piacere|circa).*$/i, "").trim();
    if (p.length < 3) return;
    const ctx = `${parola} di ${p}`;
    const nome = chiavi.find(k => norm(k) === norm(ctx)) || chiavi.find(k => norm(k) === norm(p)) || cercaAlimenti(p)[0];
    if (nome && nome !== nomeBase && !trovate.includes(nome)) trovate.push(nome);
  });
  return trovate.slice(0, 4);
}

// -------- Ricette a porzioni (es. "fa 4 pancake") --------
// La ricetta resta salvata intera; per il piano e il diario si usa una
// versione "a pezzi": k pancake, con k scelto in base alle calorie.
const QUOTA_TIPICA = { colazione: 0.22, mattina: 0.08, pranzo: 0.30, cena: 0.28, spuntino: 0.12 };
function ingredientiPerPezzi(orig, k) {
  const n = orig.porzioni || 1;
  return orig.ingredienti.filter(i => i.unita !== "q.b.").map(i => {
    // niente arrotondamenti grossi (al grammo o al decimo di pezzo): 1,5 g di olio diventava 2 g e ¼ di uovo 0,3, e una fetta "pesava" il 5% in più
    if (i.unita === "pz") return { nome: i.nome, qta: Math.round(i.qta / n * k * 100) / 100, unita: "pz" };
    return { nome: i.nome, qta: Math.round(grammiIng(i) / n * k * 10) / 10, unita: i.unita === "ml" ? "ml" : "g" };
  });
}
// Valori di 1 pezzo (fetta, pancake…) = ricetta intera ÷ numero di pezzi
function macroPerPezzo(orig) {
  const m = calcolaMacro({ ingredienti: orig.ingredienti }), n = orig.porzioni || 1;
  return { kcal: Math.round(m.kcal / n), proteine: Math.round(m.proteine / n), carboidrati: Math.round(m.carboidrati / n), grassi: Math.round(m.grassi / n) };
}
// k pezzi = esattamente k volte i valori di 1 pezzo (2 fette = 2 × 1 fetta, senza scarti di arrotondamento)
function macroPezzi(orig, k) {
  const u = macroPerPezzo(orig);
  return { kcal: Math.round(u.kcal * k), proteine: Math.round(u.proteine * k), carboidrati: Math.round(u.carboidrati * k), grassi: Math.round(u.grassi * k) };
}
// Di quanto cambia il contatore: pezzi con nome (fetta, pancake…) di 1; teglia senza nome del pezzo di ½; ricetta singola ("1 porzione") di ½
function passoPezzi(orig) { return orig.pezzo && orig.pezzo !== "porzione" ? 1 : 0.5; }   // mezze porzioni: i quarti erano troppo fini
// il prossimo multiplo del passo, in su o in giù (un vecchio ¼ passa al ½ più vicino)
const prossimoPasso = (cur, delta, passo) => Math.max(passo, (delta > 0 ? Math.floor(cur / passo + 1e-9) + 1 : Math.ceil(cur / passo - 1e-9) - 1) * passo);
function kcalPerPezzo(orig) { return macroPerPezzo(orig).kcal || 1; }
// Quanti pezzi per avvicinarsi a `kcal` (interi, o mezze porzioni se è una "porzione")
function pezziPer(orig, kcal) {
  const passo = passoPezzi(orig);
  const k = Math.round(kcal / kcalPerPezzo(orig) / passo) * passo;
  return Math.max(passo, Math.min((orig.porzioni || 1) * 2, k));
}
// plurale semplice: fetta -> fette, girella -> girelle, muffin/pancake restano uguali
function plurale(p) { return p === "taco" ? "tacos" : p === "nugget" ? "nuggets" : /ie$/.test(p) ? p : /a$/.test(p) ? p.slice(0, -1) + "e" : /[oe]$/.test(p) && !/cake$/.test(p) ? p.slice(0, -1) + "i" : p; }
// Le quantità si dicono col pezzo della ricetta ("1 fetta", "2 fette", "3 pancake"); senza un pezzo con nome, in porzioni ("1 porzione", "1½ porzioni")
function nomePezzo(orig, k) {
  const p = orig && orig.porzioni > 1 && String(orig.pezzo || "").trim();
  if (!p || p === "porzione") return k <= 1 ? "porzione" : "porzioni";
  return k <= 1 ? p : plurale(p);
}
const etichettaPezzi = (orig, k) => `${fmtQta(k)} ${nomePezzo(orig, k)}`;
function versioneAPezzi(orig, k) {
  const v = Object.assign({}, orig, { ingredienti: ingredientiPerPezzi(orig, k), _orig: orig, porzionabile: true, nPezzi: k });
  delete v.porzioni;
  Object.assign(v, macroPezzi(orig, k));   // k pezzi = k × 1 pezzo, come nell'elenco ricette
  return v;
}
function derivaPorzioni(r) {
  if (!r.porzioni || r.porzioni <= 1) return r;
  const k = pezziPer(r, (QUOTA_TIPICA[r.pasto] || 0.25) * TIPI_GIORNATA.crossfit.target.kcal);
  return versioneAPezzi(r, k);
}
// Quantità scritta bene: 3, ½, 1½, 2,5
function fmtQta(n) {
  if (Math.abs(n * 4 - Math.round(n * 4)) < 0.08 && Math.round(n * 4) % 2 === 1) {   // quarti: ¼ ¾ 1¼ 1¾
    const q = Math.round(n * 4), intero = Math.floor(q / 4);
    return `${intero || ""}${q % 4 === 1 ? "¼" : "¾"}`;
  }
  const x = Math.round(n * 10) / 10, intero = Math.floor(x), fr = Math.round((x - intero) * 10) / 10;
  if (fr === 0) return String(intero);
  if (fr === 0.5) return intero ? `${intero}½` : "½";
  return String(x).replace(".", ",");
}
// Singolare e plurale degli alimenti che si contano a pezzi: uno solo → "uovo" (senza numero), più di uno → "2 uova"
const FORME_PEZZI = {
  "Uova": ["uovo", "uova"], "Uova al tegamino": ["uovo al tegamino", "uova al tegamino"],
  "Gallette di riso": ["galletta di riso", "gallette di riso"], "Gallette di mais": ["galletta di mais", "gallette di mais"], "Gallette di quinoa": ["galletta di quinoa", "gallette di quinoa"], "Gallette di grano saraceno": ["galletta di grano saraceno", "gallette di grano saraceno"], "Mela": ["mela", "mele"], "Banana": ["banana", "banane"], "Pera": ["pera", "pere"], "Pesca": ["pesca", "pesche"],
  "Albicocche": ["albicocca", "albicocche"], "Prugne": ["prugna", "prugne"], "Kiwi": ["kiwi", "kiwi"], "Avocado": ["avocado", "avocado"], "Mandarino": ["mandarino", "mandarini"],
  "Fichi freschi": ["fico", "fichi"], "Limone": ["limone", "limoni"], "Pompelmo": ["pompelmo", "pompelmi"], "Cachi": ["cachi", "cachi"], "Melagrana": ["melagrana", "melagrane"], "Lime": ["lime", "lime"],
  "Datteri": ["dattero", "datteri"], "Mandorle": ["mandorla", "mandorle"], "Noci": ["noce", "noci"], "Nocciole": ["nocciola", "nocciole"], "Pistacchi": ["pistacchio", "pistacchi"],
  "Anacardi": ["anacardo", "anacardi"], "Olive": ["oliva", "olive"], "Cioccolato fondente": ["quadretto di cioccolato fondente", "quadretti di cioccolato fondente"],
  "Fette biscottate integrali": ["fetta biscottata integrale", "fette biscottate integrali"], "Crackers integrali": ["cracker integrale", "crackers integrali"],
  "Biscotti secchi": ["biscotto secco", "biscotti secchi"], "Nettarina": ["nettarina", "nettarine"], "Nespole": ["nespola", "nespole"], "Fico d'India": ["fico d'India", "fichi d'India"], "Pomodoro": ["pomodoro", "pomodori"], "Pomodori": ["pomodoro", "pomodori"], "Pomodorini": ["pomodorino", "pomodorini"], "Cetriolo": ["cetriolo", "cetrioli"], "Zucchine": ["zucchina", "zucchine"],
  "Peperoni": ["peperone", "peperoni"], "Carote": ["carota", "carote"], "Cipolla": ["cipolla", "cipolle"], "Melanzane": ["melanzana", "melanzane"], "Finocchi": ["finocchio", "finocchi"], "Patate": ["patata", "patate"], "Patata dolce": ["patata dolce", "patate dolci"],
  "Aglio": ["spicchio d'aglio", "spicchi d'aglio"], "Carciofi": ["carciofo", "carciofi"], "Porri": ["porro", "porri"], "Barbabietola": ["barbabietola", "barbabietole"], "Ravanelli": ["ravanello", "ravanelli"], "Funghi champignon": ["fungo champignon", "funghi champignon"], "Cavolini di Bruxelles": ["cavolino", "cavolini"], "Sedano": ["costa di sedano", "coste di sedano"],
  "Albume": ["albume", "albumi"], "Tuorlo": ["tuorlo", "tuorli"], "Pane bianco": ["fetta di pane bianco", "fette di pane bianco"], "Pane di segale": ["fetta di pane di segale", "fette di pane di segale"], "Pancarrè": ["fetta di pancarrè", "fette di pancarrè"], "Grissini": ["grissino", "grissini"], "Taralli": ["tarallo", "taralli"], "Tortilla integrale": ["tortilla integrale", "tortillas integrali"], "Fogli di riso": ["foglio di riso", "fogli di riso"],
  "Gamberi": ["gambero", "gamberi"], "Salsiccia": ["salsiccia", "salsicce"], "Wurstel": ["wurstel", "wurstel"], "Hamburger di manzo": ["hamburger di manzo", "hamburger di manzo"], "Coscia di pollo": ["coscia di pollo", "cosce di pollo"], "Cozze": ["cozza", "cozze"], "Sardine": ["sardina", "sardine"], "Alici": ["alice", "alici"], "Surimi": ["bastoncino di surimi", "bastoncini di surimi"],
  "Tonno in scatola al naturale": ["scatoletta di tonno", "scatolette di tonno"], "Tonno sott'olio sgocciolato": ["scatoletta di tonno sott'olio", "scatolette di tonno sott'olio"], "Prosciutto cotto": ["fetta di prosciutto cotto", "fette di prosciutto cotto"], "Prosciutto crudo": ["fetta di prosciutto crudo", "fette di prosciutto crudo"], "Bresaola": ["fetta di bresaola", "fette di bresaola"], "Mortadella": ["fetta di mortadella", "fette di mortadella"], "Salmone affumicato": ["fetta di salmone affumicato", "fette di salmone affumicato"], "Fesa di tacchino": ["fetta di fesa di tacchino", "fette di fesa di tacchino"],
  "Mozzarella": ["mozzarella", "mozzarelle"], "Mozzarella light": ["mozzarella light", "mozzarelle light"], "Burrata": ["burrata", "burrate"], "Yogurt bianco intero": ["vasetto di yogurt", "vasetti di yogurt"], "Yogurt di soia": ["vasetto di yogurt di soia", "vasetti di yogurt di soia"], "Yogurt greco 0%": ["vasetto di yogurt greco", "vasetti di yogurt greco"], "Yogurt greco intero": ["vasetto di yogurt greco intero", "vasetti di yogurt greco intero"], "Skyr": ["vasetto di skyr", "vasetti di skyr"],
  "Formaggio fuso light": ["fetta di formaggio fuso", "fette di formaggio fuso"], "Cioccolato al latte": ["quadretto di cioccolato al latte", "quadretti di cioccolato al latte"], "Cioccolato bianco": ["quadretto di cioccolato bianco", "quadretti di cioccolato bianco"], "Torta (ciambellone)": ["fetta di ciambellone", "fette di ciambellone"], "Crostata alla marmellata": ["fetta di crostata", "fette di crostata"],
  "Arancia": ["arancia", "arance"], "Clementine": ["clementina", "clementine"], "Mango": ["mango", "mango"], "Fragole": ["fragola", "fragole"], "Uva": ["acino d'uva", "acini d'uva"], "Ciliegie": ["ciliegia", "ciliegie"], "Lamponi": ["lampone", "lamponi"], "More": ["mora", "more"], "Ananas": ["fetta di ananas", "fette di ananas"], "Anguria": ["fetta di anguria", "fette di anguria"], "Melone": ["fetta di melone", "fette di melone"], "Papaya": ["papaya", "papaya"], "Prugne secche": ["prugna secca", "prugne secche"], "Fichi secchi": ["fico secco", "fichi secchi"], "Albicocche secche": ["albicocca secca", "albicocche secche"], "Pavesini": ["pavesino", "pavesini"], "Lotus Biscoff": ["biscotto Lotus", "biscotti Lotus"], "Pane integrale": ["fetta di pane integrale", "fette di pane integrale"], "Piadina": ["piadina", "piadine"],
  "Cappuccino": ["cappuccino", "cappuccini"], "Cappuccino scremato": ["cappuccino scremato", "cappuccini scremati"], "Cappuccino parzialmente scremato": ["cappuccino parzialmente scremato", "cappuccini parzialmente scremati"],
  "Cappuccino intero": ["cappuccino intero", "cappuccini interi"], "Cappuccino di soia": ["cappuccino di soia", "cappuccini di soia"], "Cappuccino di avena": ["cappuccino di avena", "cappuccini di avena"], "Cappuccino di mandorla": ["cappuccino di mandorla", "cappuccini di mandorla"], "Caffè": ["caffè", "caffè"], "Birra": ["birra", "birre"], "Cornetto": ["cornetto", "cornetti"],
  "Vino rosso": ["bicchiere di vino rosso", "bicchieri di vino rosso"], "Vino bianco": ["bicchiere di vino bianco", "bicchieri di vino bianco"], "Prosecco": ["calice di prosecco", "calici di prosecco"],
  "Coca cola": ["lattina di coca cola", "lattine di coca cola"], "Coca cola zero": ["lattina di coca cola zero", "lattine di coca cola zero"], "Succo di frutta": ["succo di frutta", "succhi di frutta"],
  "Panino hamburger": ["panino hamburger", "panini hamburger"], "Panino con prosciutto": ["panino con prosciutto", "panini con prosciutto"], "Pizza al taglio": ["trancio di pizza", "tranci di pizza"],
  "Focaccia": ["focaccia", "focacce"], "Sushi": ["pezzo di sushi", "pezzi di sushi"],
};
function formePezzi(nome) {
  if (FORME_PEZZI[nome]) return FORME_PEZZI[nome];
  const b = nome.toLowerCase();
  return /^pizza /.test(b) ? [b, b.replace(/^pizza/, "pizze")] : [b, b];
}
// "uovo" se è uno solo, "2 uova", "½ mela", "1½ mele"
function nomeConNumero(nome, quanti, maiuscola) {
  const c = Math.max(0.5, Math.round(quanti * 2) / 2), [s, p] = formePezzi(nome);
  const cap = (t) => maiuscola ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  if (c === 1) return cap(s);
  return `${fmtQta(c)} ${c < 1 ? s : p}`;
}
// Nome di una ricetta con il contatore: prima la quantità, col pezzo della ricetta. "2 fette di Banana bread", "3 pancake di Pancake proteici", "1 porzione di Chili"
function nomeRicettaConPezzi(r, k) {
  const et = etichettaPezzi(r && (r._orig || r), k);
  // «3 pancake di Pancake proteici» → «3 Pancake proteici»: se il nome dice già cos'è il pezzo, basta il numero
  const m = String(et).match(/^([\d½¼¾⅓⅔,.\s]+)\s+(\S.*)$/);
  if (m && m[2].length >= 4 && String(r.nome).toLowerCase().includes(m[2].toLowerCase().slice(0, 5))) return `${m[1].trim()} ${r.nome}`;
  return `${et} di ${r.nome}`;
}
const nomeConPezzi = (r) => r.porzionabile && r._orig ? nomeRicettaConPezzi(r, r.nPezzi) : r.nome;
// Zuccheri (totali e aggiunti), fibre e sale di un elenco di ingredienti, in grammi
function extraDa(ingredienti) {
  const r = { zuccheri: 0, aggiunti: 0, fibre: 0, sale: 0 };
  (ingredienti || []).forEach(i => {
    const x = (window.NUTRIENTI_EXTRA || {})[i.nome]; if (!x) return;
    const q = grammiIng(i) / 100;
    r.zuccheri += x[0] * q; r.aggiunti += x[1] * q; r.fibre += x[2] * q; r.sale += x[3] * q;
  });
  return r;
}
// Riferimenti giornalieri (OMS/EFSA): zuccheri aggiunti max 40 g (ideale 20), fibre almeno 25 g, sale max 5 g
const LIMITI_EXTRA = { aggiunti: 40, aggiuntiIdeale: 20, fibre: 25, sale: 5 };
// alimenti personali: si salvano con i valori extra se disponibili
function salvaAlimentoPersonale(nome, base4, extra4, pesoPz, correzione) {
  let custom = {};
  try { custom = JSON.parse(localStorage.getItem("mp_alimenti_custom")) || {}; } catch (e) {}
  custom[nome] = extra4 ? base4.concat(extra4) : base4;
  localStorage.setItem("mp_alimenti_custom", JSON.stringify(custom));
  window.ALIMENTI[nome] = base4;
  if (extra4) window.NUTRIENTI_EXTRA[nome] = extra4;
  if (pesoPz > 0) {   // la tabella era "per porzione/pezzo": si ricorda quanto pesa, così nei pasti si conta a pezzi
    let pz = {}; try { pz = JSON.parse(localStorage.getItem("mp_alimenti_pz")) || {}; } catch (e) {}
    pz[nome] = Math.round(pesoPz * 10) / 10; localStorage.setItem("mp_alimenti_pz", JSON.stringify(pz));
    if (window.PESO_PZ) window.PESO_PZ[nome] = pz[nome];
  } else if (correzione) {   // correggendo un alimento da «per pezzo» a «per 100 g» il peso del pezzo non vale più
    let pz = {}; try { pz = JSON.parse(localStorage.getItem("mp_alimenti_pz")) || {}; } catch (e) {}
    if (pz[nome]) { delete pz[nome]; localStorage.setItem("mp_alimenti_pz", JSON.stringify(pz)); }
    if (window.PESO_PZ) delete window.PESO_PZ[nome];
  }
}
// peso del pezzo salvato per un alimento tuo (la sua tabella era «per pezzo»), 0 se era per 100 g
function pesoPzTuo(nome) { try { return +(JSON.parse(localStorage.getItem("mp_alimenti_pz")) || {})[nome] || 0; } catch (e) { return 0; } }

// ===== I miei alimenti: quelli aggiunti da te (a mano, dalla foto della tabella o dal codice a barre), da rivedere e correggere =====
function alimentiTuoi() { try { return JSON.parse(localStorage.getItem("mp_alimenti_custom")) || {}; } catch (e) { return {}; } }
function apriMieiAlimenti() {
  editCtx = null;
  const tutti = Object.entries(alimentiTuoi()).sort((a, b) => a[0].localeCompare(b[0], "it"));
  const f = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  openModal(`<button class="btn-link modal-indietro" data-mio-menu>‹ Altro</button>
    <h3 class="modal-title">I miei alimenti</h3>
    ${tutti.length ? `<p class="hint">Gli alimenti che hai aggiunto tu. Toccane uno per correggere nome e valori.</p>
    <div class="mio-lista">${tutti.map(([n, v]) => { const pz = pesoPzTuo(n);
      return `<button class="mio-riga" data-mio-apri="${esc(n)}"><span class="mio-nome">${esc(n)}</span>
        <span class="mio-val">${Math.round(v[0])} kcal · P ${f(v[1])} · C ${f(v[2])} · G ${f(v[3])} <i>per 100 g${pz ? ` · 1 pezzo = ${f(pz)} g` : ""}</i></span><span class="mv-freccia">›</span></button>`; }).join("")}</div>`
    : `<p class="hint">Non hai ancora aggiunto alimenti. Quando ne aggiungi uno (dal codice a barre o dalla foto della tabella) lo trovi qui.</p>`}`);
}
function apriMioAlimento(nome) {
  const v = valoriAlimento(nome); if (!v) return apriMieiAlimenti();
  openModal(`<button class="btn-link modal-indietro" data-mio-lista>‹ I miei alimenti</button>
    <h3 class="modal-title">Modifica alimento</h3>
    <div class="lib-ignoto pagina">${fotoEtichettaHTML("etic-mio")}
      <p class="et-sez">Nome</p>
      <input id="mio-nome" class="qta-input wiz-full" autocomplete="off" value="${esc(nome)}" data-orig="${esc(nome)}">
      <div class="etic-box">${campiEtichettaHTML("etic-mio", v, { senzaFoto: true, pesoPz: pesoPzTuo(nome) })}</div>
      <div class="wiz-nav"><button class="btn-sec" data-mio-lista>Annulla</button><button class="btn" data-mio-salva>✓ Salva alimento</button></div>
      <button class="btn-link mio-elimina" data-mio-elimina>${ICONA_CESTINO} Elimina alimento</button>
    </div>`);
}
// Modificando un alimento già salvato: i campi che non hai toccato tengono il valore salvato (niente arrotondamenti
// per pezzo ⇄ per 100 g, es. sale 0,3 → 0,31) e gli zuccheri aggiunti (che il modulo non mostra) restano quelli di prima.
// Se hai cambiato «per 100 g / per pezzo» o il peso del pezzo, valgono i numeri scritti (tranne gli zuccheri aggiunti).
function conservaValoriAlimento(id, nome, et) {
  const orig = alimentiTuoi()[nome]; if (!orig || !et || et.errore) return et;
  const box = document.getElementById(id), per = document.querySelector(`[data-etic-per-for="${id}"]`);
  const stessoModo = !!per && (+per.dataset.pz0 || 0) === (et.pesoPz || 0);
  const intatto = (k) => { const el = box && box.querySelector(`[data-etic="${k}"]`); return stessoModo && !!el && el.dataset.v !== undefined && String(el.value).trim() === el.dataset.v; };
  const conExtra = orig.length >= 8;
  const base4 = [0, 1, 2, 3].map(k => intatto(k) ? orig[k] : et.base4[k]);
  let extra4 = et.extra4;
  if (extra4) extra4 = [intatto(4) && conExtra ? orig[4] : extra4[0], conExtra ? orig[5] : 0, intatto(5) && conExtra ? orig[6] : extra4[2], intatto(6) && conExtra ? orig[7] : extra4[3]];
  return Object.assign({}, et, { base4, extra4 });
}
// Corretti i valori di un alimento: tutti i pasti del diario che lo contengono (di tutti i giorni) si ricalcolano
function ricalcolaPastiCon(nome) {
  if (typeof leggiDiario !== "function") return 0;
  const d = leggiDiario(); let n = 0;
  Object.values(d).forEach(g => (g && g.pasti || []).forEach(p => {
    if (p && Array.isArray(p.ingredienti) && p.ingredienti.some(i => i && i.nome === nome)) { aggiornaMacro(p); n++; }
  }));
  if (n) salvaDiario(d);
  return n;
}
// rinominare un alimento: cambia dappertutto (pasti del diario, ricette tue, piano, codici a barre, pezzi, unità, spesa, in casa), così nulla resta «orfano»
function rinominaAlimentoTuo(vecchio, nuovo) {
  const leggi = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } };
  const sposta = (chiave) => { try { const o = JSON.parse(localStorage.getItem(chiave)) || {}; if (vecchio in o) { o[nuovo] = o[vecchio]; delete o[vecchio]; localStorage.setItem(chiave, JSON.stringify(o)); } } catch (e) {} };
  sposta("mp_alimenti_custom"); sposta("mp_alimenti_pz");
  sposta("mp_unita"); sposta("mp_incasa"); sposta("mp_incasa_q");   // { nome: unità preferita / data in cui l'hai preso / grammi della scorta }
  try { const c = JSON.parse(localStorage.getItem("mp_codici")) || {}; Object.keys(c).forEach(k => { if (c[k] === vecchio) c[k] = nuovo; }); localStorage.setItem("mp_codici", JSON.stringify(c)); } catch (e) {}
  try { const d = JSON.parse(localStorage.getItem("mp_diario")) || {};
    Object.values(d).forEach(g => (g.pasti || []).forEach(p => { if (p.nome === vecchio) p.nome = nuovo; (p.ingredienti || []).forEach(i => { if (i.nome === vecchio) i.nome = nuovo; if (i.cercato === vecchio) i.cercato = nuovo; }); }));
    localStorage.setItem("mp_diario", JSON.stringify(d)); } catch (e) {}
  // ricette tue, ricettario importato e piano: si cambiano gli ingredienti (in qualsiasi «ingredienti» dentro, anche le versioni originali _orig)
  const rinominaIngr = (x) => {
    if (Array.isArray(x)) { x.forEach(rinominaIngr); return; }
    if (!x || typeof x !== "object") return;
    Object.keys(x).forEach(k => {
      if (k === "ingredienti" && Array.isArray(x[k])) x[k].forEach(i => { if (i && i.nome === vecchio) i.nome = nuovo; if (i && i.cercato === vecchio) i.cercato = nuovo; });
      else rinominaIngr(x[k]);
    });
  };
  ["mp_ricette_custom", "mp_ricette", "mp_piano"].forEach(k => { const v = leggi(k, null); if (!v) return; const prima = JSON.stringify(v); rinominaIngr(v); if (JSON.stringify(v) !== prima) localStorage.setItem(k, JSON.stringify(v)); });
  // varianti scelte nelle ricette { ricetta: { ingrediente: alimento } }: il nome cambia sia come ingrediente sostituito sia come sostituto
  try { const v = leggi("mp_varianti", {}); let ok = false; Object.values(v).forEach(m => { if (!m) return; Object.keys(m).forEach(k => { if (m[k] === vecchio) { m[k] = nuovo; ok = true; } if (k === vecchio) { m[nuovo] = m[k]; delete m[k]; ok = true; } }); }); if (ok) salvaVarianti(v); } catch (e) {}
  ["mp_spesa_extra", "mp_spesa_presi"].forEach(k => { const a = leggi(k, []); if (Array.isArray(a) && a.includes(vecchio)) localStorage.setItem(k, JSON.stringify([...new Set(a.map(x => x === vecchio ? nuovo : x))])); });
  if (window.ALIMENTI[vecchio]) { window.ALIMENTI[nuovo] = window.ALIMENTI[vecchio]; delete window.ALIMENTI[vecchio]; }
  if (window.NUTRIENTI_EXTRA && window.NUTRIENTI_EXTRA[vecchio]) { window.NUTRIENTI_EXTRA[nuovo] = window.NUTRIENTI_EXTRA[vecchio]; delete window.NUTRIENTI_EXTRA[vecchio]; }
  if (window.PESO_PZ && window.PESO_PZ[vecchio]) { window.PESO_PZ[nuovo] = window.PESO_PZ[vecchio]; delete window.PESO_PZ[vecchio]; }
  try { caricaRicette(); } catch (e) {}   // l'elenco delle ricette in memoria si ricostruisce con il nome nuovo
}
// Eliminare un alimento tuo: sparisce dagli alimenti, dai pezzi e dai codici a barre; i pasti già registrati tengono le kcal salvate (non si ricalcolano)
function eliminaAlimentoTuo(nome) {
  const leggi = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const custom = leggi("mp_alimenti_custom"), pz = leggi("mp_alimenti_pz"), cod = leggi("mp_codici");
  const prima = { v: custom[nome], pz: pz[nome], codici: Object.keys(cod).filter(k => cod[k] === nome) };
  delete custom[nome]; localStorage.setItem("mp_alimenti_custom", JSON.stringify(custom));
  if (nome in pz) { delete pz[nome]; localStorage.setItem("mp_alimenti_pz", JSON.stringify(pz)); }
  if (prima.codici.length) { prima.codici.forEach(k => delete cod[k]); localStorage.setItem("mp_codici", JSON.stringify(cod)); }
  if (window.ALIMENTI) delete window.ALIMENTI[nome];
  if (window.NUTRIENTI_EXTRA) delete window.NUTRIENTI_EXTRA[nome];
  if (window.PESO_PZ) delete window.PESO_PZ[nome];
  return prima;
}
function ripristinaAlimentoTuo(nome, prima) {
  if (!prima || !prima.v) return;
  salvaAlimentoPersonale(nome, prima.v.slice(0, 4), prima.v.length >= 8 ? prima.v.slice(4, 8) : null, prima.pz || 0);
  if (prima.codici.length) { let cod = {}; try { cod = JSON.parse(localStorage.getItem("mp_codici")) || {}; } catch (e) {} prima.codici.forEach(k => { cod[k] = nome; }); localStorage.setItem("mp_codici", JSON.stringify(cod)); }
}
document.addEventListener("click", (e) => {
  if (!e.target.closest || !e.target.closest("#modal-content")) return;
  if (e.target.closest("[data-mio-menu]")) { apriMenu(); return; }
  if (e.target.closest("[data-mio-lista]")) { apriMieiAlimenti(); return; }
  const ap = e.target.closest("[data-mio-apri]"); if (ap) { apriMioAlimento(ap.dataset.mioApri); return; }
  if (e.target.closest("[data-mio-elimina]")) {
    const n = (document.getElementById("mio-nome") || {}).dataset.orig; if (!n) return;
    chiediConferma(`Eliminare «${n}»?`, "Sparisce dai tuoi alimenti. I pasti già registrati tengono le loro calorie.", "Elimina", () => {
      const prima = eliminaAlimentoTuo(n);
      apriMieiAlimenti();
      avviso(`Eliminato: ${n}`, "Annulla", () => { ripristinaAlimentoTuo(n, prima); if (document.querySelector("#modal-content .mio-lista, #modal-content [data-mio-menu]")) apriMieiAlimenti(); });
    }, () => apriMioAlimento(n));
    return;
  }
  const sv = e.target.closest("[data-mio-salva]"); if (!sv) return;
  const inp = document.getElementById("mio-nome"), vecchio = inp.dataset.orig;
  let et = leggiCampiEtichetta("etic-mio");
  if (et && et.errore) { avviso(et.errore); return; }
  if (!et || !et.base4[0]) { avviso("Inserisci almeno le kcal."); return; }
  et = conservaValoriAlimento("etic-mio", vecchio, et);   // i campi non toccati restano come erano salvati
  let nome = inp.value.trim(); if (!nome) { avviso("Scrivi il nome dell'alimento."); return; }
  nome = nome.charAt(0).toUpperCase() + nome.slice(1);
  if (nome !== vecchio && (window.ALIMENTI || {})[nome]) { avviso("Esiste già un alimento con questo nome."); return; }
  if (!verificaEtichetta("etic-mio", sv, et)) return;
  if (nome !== vecchio) rinominaAlimentoTuo(vecchio, nome);
  salvaAlimentoPersonale(nome, et.base4, et.extra4, et.pesoPz, true);
  ricalcolaPastiCon(nome);   // i pasti già registrati con questo alimento prendono i valori corretti
  if (typeof renderOggi === "function") renderOggi();
  apriMieiAlimenti(); avviso("✓ Alimento aggiornato");
});

// Prima di salvare: i numeri della tabella tornano? (valori portati a 100 g). Restituisce gli avvisi con il campo da evidenziare.
function controlliEtichetta(et) {
  const [kcal, p, c, g] = et.base4, f = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  const zuc = et.extra4 ? et.extra4[0] : 0, a = [];
  const per = et.pesoPz ? ` (riportati a 100 g, con 1 pezzo = ${f(et.pesoPz)} g)` : "";
  [[1, "Le proteine", p], [2, "I carboidrati", c], [3, "I grassi", g]].forEach(([k, n, v]) => { if (v > 100) a.push({ k, t: `${n} sono ${f(v)} g su 100 g${per}: non è possibile.` }); });
  if (!a.length && p + c + g > 102) a.push({ k: [1, 2, 3], t: `Proteine, carboidrati e grassi insieme fanno ${f(p + c + g)} g su 100 g${per}: non è possibile.` });
  if (kcal > 900) a.push({ k: 0, t: `${f(kcal)} kcal su 100 g${per}: non è possibile (al massimo circa 900).` });
  const attese = 4 * p + 4 * c + 9 * g;
  if (!a.length && kcal > 0 && attese > 0 && Math.abs(kcal - attese) > Math.max(25, attese * 0.2)) a.push({ k: [0, 1, 2, 3], t: `Le kcal (${f(kcal)}) non tornano con proteine, carboidrati e grassi (fanno circa ${Math.round(attese)} kcal). Controlla che non ci sia una cifra letta male.` });
  if (zuc > c + 0.5) a.push({ k: 4, t: `Gli zuccheri (${f(zuc)} g) sono più dei carboidrati (${f(c)} g): di solito sono una parte dei carboidrati.` });
  return a;
}
// Mostra gli avvisi sopra i tasti e trasforma «Salva» in «Salva comunque». true = si può salvare.
function verificaEtichetta(id, bottone, et) {
  if (bottone && bottone.dataset.forza === "1") return true;
  const avv = controlliEtichetta(et);
  if (!avv.length) return true;
  const box = document.getElementById(id), nav = bottone && bottone.closest(".wiz-nav");
  document.querySelectorAll(".et-avvisi").forEach(x => x.remove());
  avv.forEach(x => [].concat(x.k).forEach(k => { const el = box && box.querySelector(`[data-etic="${k}"]`); if (el) el.classList.add("et-errore"); }));
  const div = document.createElement("div"); div.className = "et-avvisi";
  div.innerHTML = `<b>⚠️ Controlla i valori</b>${avv.map(x => `<p>${esc(x.t)}</p>`).join("")}<p class="et-avv-nota">Correggi i campi in rosso, oppure salva comunque.</p>`;
  const prima = nav || bottone; if (prima) prima.parentNode.insertBefore(div, prima);
  if (bottone) { bottone.dataset.testo = bottone.innerHTML; bottone.dataset.forza = "1"; bottone.innerHTML = "Salva comunque"; bottone.classList.add("et-forza"); }
  div.scrollIntoView({ block: "center", behavior: "smooth" });
  return false;
}
// appena cambi un valore, l'avviso sparisce e il tasto torna «Salva»
document.addEventListener("input", (e) => {
  if (!e.target.closest || !e.target.closest(".lib-nuovo, .etic-per")) return;
  document.querySelectorAll(".et-avvisi").forEach(x => x.remove());
  document.querySelectorAll(".et-errore").forEach(x => x.classList.remove("et-errore"));
  document.querySelectorAll("[data-forza='1']").forEach(b => { b.innerHTML = b.dataset.testo || b.innerHTML; delete b.dataset.forza; b.classList.remove("et-forza"); });
});
document.addEventListener("change", (e) => { if (e.target.matches && e.target.matches(".et-seg input")) e.target.dispatchEvent(new Event("input", { bubbles: true })); });
// Campi dell'etichetta (per 100 g) per un alimento nuovo: i primi 4 servono, gli altri sono facoltativi
const CAMPI_ETICHETTA = ["Kcal", "Proteine", "Carboidrati", "Grassi", "Zuccheri", "Fibre", "Sale"];
// La foto della tabella: due tasti normali (non colorati: nessuno dei due è «scelto»), e sotto lo stato della lettura
function fotoEtichettaHTML(id) {
  return `<div class="et-foto"><p class="et-sez">Foto della tabella nutrizionale</p>
    <div class="foto-due"><label class="et-btn">📸 Scatta foto<input type="file" accept="image/*" capture="environment" hidden data-foto-etic="${id}"></label><label class="et-btn">🖼️ Dalla galleria<input type="file" accept="image/*" hidden data-foto-etic="${id}"></label></div>
    <div class="foto-stato" id="foto-stato-${id}"></div></div>`;
}
// Campi dell'etichetta per un alimento nuovo: tutta la tabella in due righe (kcal, proteine, carboidrati, grassi · zuccheri, fibre, sale); servono i primi 4
function campiEtichettaHTML(id, valori, opz = {}) {
  const pz = opz.pesoPz > 0 ? opz.pesoPz : 0, r = (x) => Math.round(x * 100) / 100;
  const v = (valori || []).map(x => (x === null || x === undefined) ? x : pz ? r(x * pz / 100) : x);   // per pezzo: si mostrano i numeri della tabella com'era (per 1 pezzo)
  const campo = (k) => `<label class="et-campo"><span>${CAMPI_ETICHETTA[k]}</span><input class="qta-input" type="number" inputmode="decimal" min="0" step="0.1" placeholder="${k ? "g" : "kcal"}" data-etic="${k}"${v[k] !== undefined && v[k] !== null && !(k >= 4 && !v.length) ? ` value="${v[k]}" data-v="${v[k]}"` : ""}></label>`;   // data-v: il valore mostrato, per capire poi quali campi hai cambiato
  return `${opz.senzaFoto ? "" : fotoEtichettaHTML(id)}
    <p class="et-sez">Valori nutrizionali</p>
    <div class="etic-per" data-etic-per-for="${id}" data-pz0="${pz}">
      <div class="et-seg">
        <input type="radio" name="per-${id}" id="per100-${id}" value="100"${pz ? "" : " checked"}><label for="per100-${id}">Per 100 g</label>
        <input type="radio" name="per-${id}" id="perpz-${id}" value="pz"${pz ? " checked" : ""}><label for="perpz-${id}">Per 1 pezzo</label>
      </div>
      <label class="etic-pzg"><span>Peso di 1 pezzo</span><input class="qta-input" type="number" inputmode="decimal" min="1" step="0.1" data-etic-pzg placeholder="es. 35"${pz ? ` value="${pz}"` : ""} aria-label="Grammi di un pezzo o porzione"><span>g</span></label>
    </div>
    <div class="lib-nuovo" id="${id}">
      <div class="et-griglia">${[0, 1, 2, 3].map(campo).join("")}</div>
      <div class="et-griglia et-tre">${[4, 5, 6].map(campo).join("")}</div>
    </div>`;
}
// legge i campi: { base4, extra4 } (extra4 null se zuccheri, fibre e sale sono tutti vuoti)
function leggiCampiEtichetta(id) {
  const box = document.getElementById(id); if (!box) return null;
  const val = (k) => { const el = box.querySelector(`[data-etic="${k}"]`); const t = el ? String(el.value).trim() : ""; return t === "" ? null : (parseFloat(t.replace(",", ".")) || 0); };
  const per = document.querySelector(`[data-etic-per-for="${id}"]`);
  const aPezzo = !!(per && per.querySelector('input[value="pz"]').checked);
  const pesoPz = aPezzo ? parseFloat(String(per.querySelector("[data-etic-pzg]").value).replace(",", ".")) || 0 : 0;
  if (aPezzo && !(pesoPz > 0)) return { errore: "Scrivi quanti grammi pesa 1 pezzo." };
  const f = aPezzo ? 100 / pesoPz : 1;   // la tabella per pezzo si porta a 100 g: dentro l'app tutto è per 100 g
  const r1 = (x) => Math.round(x * f * 100) / 100;
  const base4 = [0, 1, 2, 3].map(k => r1(val(k) || 0));
  const zuc = val(4), fib = val(5), sale = val(6);
  const extra4 = (zuc === null && fib === null && sale === null) ? null : [r1(zuc || 0), 0, r1(fib || 0), r1(sale || 0)];   // zuccheri aggiunti = 0: un prodotto nuovo non conta nei «zuccheri aggiunti» della giornata
  return { base4, extra4, pesoPz };
}
function kcalIng(i) { const a = (window.ALIMENTI || {})[i.nome]; return a ? a[0] * grammiIng(i) / 100 : 0; }
function calcolaMacro(r) {
  let k = 0, p = 0, c = 0, g = 0, alcol = 0;
  r.ingredienti.forEach(i => {
    const a = (window.ALIMENTI || {})[i.nome]; if (!a) return;
    const q = grammiIng(i) / 100;
    k += a[0] * q; p += a[1] * q; c += a[2] * q; g += a[3] * q;
    const manca = a[0] - (4 * a[1] + 4 * a[2] + 9 * a[3]);   // kcal che non stanno in proteine, carboidrati e grassi: l'alcol (7 kcal/g) di vino, birra, cocktail e superalcolici
    if (manca >= 20) alcol += manca * q;
  });
  // le kcal si contano dai macro (4/4/9), come gli obiettivi: i numeri di kcal e di proteine/carboidrati/grassi tornano sempre; l'alcol si aggiunge a parte (prima un bicchiere di vino contava ~0 kcal)
  return { kcal: Math.round(4 * p + 4 * c + 9 * g + alcol), proteine: Math.round(p), carboidrati: Math.round(c), grassi: Math.round(g) };
}
// Un pasto del diario fatto di k pezzi di una ricetta a porzioni, con le quantità della ricetta (al grammo): vale esattamente k × 1 pezzo.
// Se hai cambiato quantità o ingredienti, si torna al calcolo dagli ingredienti.
function macroPastoRicetta(p) {
  if (!p || !p.ricetta || !(p.nPezzi > 0) || typeof ricette === "undefined") return null;
  const r = ricette.find(x => x.nome === p.ricetta && x._orig), o = r && r._orig;
  if (!o || !(o.porzioni > 1)) return null;
  const A = window.ALIMENTI || {}, volte = {};
  const somma = (lista, conta) => { const t = {}; lista.forEach(i => { const g = grammiIng(i); if (A[i.nome] && g > 0) { t[i.nome] = (t[i.nome] || 0) + g; if (conta) volte[i.nome] = (volte[i.nome] || 0) + 1; } }); return t; };
  const att = somma(ingredientiPerPezzi(o, p.nPezzi), true), ora = somma(p.ingredienti || []);
  if (!Object.keys(ora).every(n => att[n] !== undefined)) return null;
  // ogni quantità uguale a quella della ricetta, al grammo (un pizzico sotto il mezzo grammo, salvato come 0 g, può mancare)
  if (!Object.keys(att).every(n => ora[n] === undefined ? att[n] < 0.6 : Math.abs(ora[n] - att[n]) <= 0.6 * volte[n] + att[n] * 0.01)) return null;
  return macroPezzi(o, p.nPezzi);
}
function aggiornaMacro(r) { const m = macroPastoRicetta(r) || calcolaMacro(r); r.kcal = m.kcal; r.proteine = m.proteine; r.carboidrati = m.carboidrati; r.grassi = m.grassi; }

// Rileva la "base di carboidrati" prevalente (per non ripeterla nello stesso giorno)
const CARBO_FAMIGLIE = [
  [/riso/i, "riso"], [/pasta/i, "pasta"], [/pane/i, "pane"], [/patat/i, "patate"],
  [/couscous/i, "couscous"], [/quinoa/i, "quinoa"], [/avena/i, "avena"], [/granola/i, "avena"],
  [/tortilla/i, "tortilla"], [/gallett/i, "gallette"], [/crackers/i, "pane"],
  [/noodles/i, "noodles"], [/farro/i, "farro"], [/mais/i, "mais"],
];
function rilevaBaseCarbo(r) {
  let best = "", bestC = 0;
  r.ingredienti.forEach(i => {
    const fam = CARBO_FAMIGLIE.find(([re]) => re.test(i.nome));
    const a = (window.ALIMENTI || {})[i.nome];
    if (!fam || !a) return;
    const cg = a[2] * grammiIng(i) / 100; // grammi di carboidrati da questo ingrediente
    if (cg > bestC) { bestC = cg; best = fam[1]; }
  });
  return bestC >= 12 ? best : "";
}
// Rileva la "base proteica" (ingrediente che dà più proteine). Usata per le
// ricette senza `base` esplicita (es. quelle create dall'utente).
const PROT_FAMIGLIE = [
  [/fiocchi di latte/, "fiocchi di latte"], [/pollo/, "pollo"], [/tacchino/, "tacchino"],
  [/manzo/, "manzo"], [/bresaola/, "bresaola"], [/prosciutto/, "prosciutto"],
  [/salmone/, "salmone"], [/tonno/, "tonno"], [/gamber/, "gamberi"], [/merluzzo/, "merluzzo"],
  [/sgombro/, "sgombro"], [/uov|albume/, "uova"], [/tofu/, "tofu"], [/tempeh/, "tempeh"],
  [/seitan/, "seitan"], [/ceci/, "ceci"], [/fagioli/, "fagioli"], [/lenticchie/, "lenticchie"],
  [/edamame/, "edamame"], [/skyr/, "skyr"], [/yogurt/, "yogurt"], [/ricotta/, "ricotta"],
  [/feta/, "feta"], [/proteine/, "proteine"],
];
function rilevaBaseProt(r) {
  let best = "", bestP = 0;
  r.ingredienti.forEach(i => {
    const fam = PROT_FAMIGLIE.find(([re]) => re.test(i.nome.toLowerCase()));
    const a = (window.ALIMENTI || {})[i.nome];
    if (!fam || !a) return;
    const pg = a[1] * grammiIng(i) / 100;
    if (pg > bestP) { bestP = pg; best = fam[1]; }
  });
  return best;
}
// Prepara le ricette: base proteica/carbo + macro ricalcolati (se ingredienti noti)
function preparaRicette() {
  ricette.forEach(r => {
    if (!r.base) r.base = rilevaBaseProt(r);
    r.baseCarbo = rilevaBaseCarbo(r);
    const tuttiNoti = r.ingredienti.every(i => i.unita === "q.b." || (window.ALIMENTI || {})[i.nome]);
    if (tuttiNoti) aggiornaMacro(r);
  });
}

// -------- Porzioni adattive --------
// Le ricette hanno porzioni fisse: per centrare obiettivi più bassi (es. giorni
// di riposo) si riducono/aumentano solo le fonti di CARBOIDRATI (pane, riso,
// pasta, avena…) e di GRASSI (olio, frutta secca, avocado…). Proteine,
// verdure e frutta leggera restano invariate. Solo ingredienti in g/ml.
const SCALA_C = [0.35, 1.3];  // limiti fattore carboidrati
const SCALA_G = [0.4, 1.3];   // limiti fattore grassi
function gruppoIng(i) {
  if (i.unita !== "g" && i.unita !== "ml") return "o";
  const a = (window.ALIMENTI || {})[i.nome];
  if (!a || a[0] < 60) return "o";            // verdure/frutta leggera: non si toccano
  const kP = a[1] * 4 / a[0], kC = a[2] * 4 / a[0], kG = a[3] * 9 / a[0];
  if (kP >= 0.25) return "o";                 // fonte proteica: non si toccano
  if (kC >= 0.55) return "c";
  if (kG >= 0.55) return "g";
  return "o";
}
// Macro di una ricetta divisi per gruppo (o = fisso, c = carboidrati, g = grassi)
const _cacheParti = new WeakMap();
function partiRicetta(r) {
  if (_cacheParti.has(r)) return _cacheParti.get(r);
  const vuoto = () => ({ kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 });
  const parti = { o: vuoto(), c: vuoto(), g: vuoto() };
  const noti = r.ingredienti.length && r.ingredienti.every(i => i.unita === "q.b." || (window.ALIMENTI || {})[i.nome]);
  // ricette a porzioni (pancake…) non si "deformano": si cambia il numero di pezzi
  if (!noti || r.porzionabile) { // o senza dati per ingrediente (es. da CSV): tutta fissa
    parti.o = { kcal: r.kcal, proteine: r.proteine, carboidrati: r.carboidrati, grassi: r.grassi };
  } else {
    r.ingredienti.forEach(i => {
      const a = window.ALIMENTI[i.nome]; if (!a) return;
      const q = grammiIng(i) / 100, p = parti[gruppoIng(i)];
      p.kcal += a[0] * q; p.proteine += a[1] * q; p.carboidrati += a[2] * q; p.grassi += a[3] * q;
    });
  }
  _cacheParti.set(r, parti);
  return parti;
}
const clamp = (x, [lo, hi]) => Math.max(lo, Math.min(hi, x));
// Dati i pasti fissi (`fissi`, totali) e quelli da adattare, trova i fattori
// per carboidrati (fc) e grassi (fg) che avvicinano la giornata al target.
function fattoriScala(fissi, lista, target) {
  const o = { ...fissi }, c = { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 }, g = { ...c };
  lista.forEach(r => {
    const p = partiRicetta(r);
    for (const k in o) { o[k] += p.o[k]; c[k] += p.c[k]; g[k] += p.g[k]; }
  });
  const fc = c.carboidrati > 0 ? clamp((target.carboidrati - o.carboidrati - g.carboidrati) / c.carboidrati, SCALA_C) : 1;
  const kcalSenzaG = o.kcal + c.kcal * fc;
  const fg = g.kcal > 0 ? clamp((target.kcal - kcalSenzaG) / g.kcal, SCALA_G) : 1;
  const tot = {};
  for (const k in o) tot[k] = o[k] + c[k] * fc + g[k] * fg;
  return { fc, fg, totali: tot };
}
// Applica i fattori a una copia del pasto (quantità arrotondate a 5 g)
function scalaPasto(r, fc, fg) {
  const m = clone(r);
  if (fc === 1 && fg === 1) return m;
  const parti = partiRicetta(r);
  if (parti.c.kcal === 0 && parti.g.kcal === 0) return m;
  m.ingredienti.forEach(i => {
    const gr = gruppoIng(i);
    const f = gr === "c" ? fc : gr === "g" ? fg : 1;
    if (f !== 1) i.qta = Math.max(5, Math.round(i.qta * f / 5) * 5);
  });
  aggiornaMacro(m);
  m.adattato = true;
  return m;
}

// Ricette create dall'utente (in aggiunta al ricettario di base)
function leggiCustom() { try { return JSON.parse(localStorage.getItem("mp_ricette_custom")) || []; } catch (e) { return []; } }
function salvaCustom(arr) { localStorage.setItem("mp_ricette_custom", JSON.stringify(arr)); }
// -------- Varianti: ogni ingrediente può avere alternative (scritte nella ricetta o della stessa "famiglia") --------
// Scegli una variante e la ricetta si ricalcola ovunque (elenco, diario, piano): è una scelta tua, non cambia la ricetta salvata.
const SCAMBI_LEGGERI = {
  "Latte intero": ["Latte scremato", "Bevanda di soia", "Bevanda di mandorla"],
  "Latte parzialmente scremato": ["Latte scremato", "Bevanda di mandorla", "Bevanda di soia"],
  "Yogurt greco intero": ["Yogurt greco 0%"], "Yogurt bianco intero": ["Yogurt greco 0%", "Yogurt di soia"],
  "Miele": ["Eritritolo"], "Zucchero": ["Eritritolo"], "Zucchero di canna": ["Eritritolo"],
  "Ricotta": ["Fiocchi di latte", "Formaggio spalmabile light"], "Formaggio spalmabile (tipo Philadelphia)": ["Formaggio spalmabile light"],
  "Mozzarella": ["Mozzarella light"], "Mascarpone": ["Ricotta", "Yogurt greco 0%"], "Panna fresca": ["Yogurt greco 0%"], "Maionese": ["Yogurt greco 0%"],
  "Manzo magro macinato": ["Fesa di tacchino macinata"], "Pancetta": ["Prosciutto cotto"], "Prosciutto crudo": ["Bresaola"],
  "Marmellata": ["Sciroppo senza zucchero"], "Pane bianco": ["Pane integrale"], "Riso bianco cotto": ["Riso integrale cotto"],
};
function leggiVarianti() { try { return JSON.parse(localStorage.getItem("mp_varianti")) || {}; } catch (e) { return {}; } }
function salvaVarianti(v) { localStorage.setItem("mp_varianti", JSON.stringify(v)); }
// Alternative: quelle scritte nella ricetta + solo scambi che davvero rendono il piatto più leggero (e non tolgono troppe proteine).
// Mela e purea di mela, o due frutti simili, non sono un vero risparmio: non si propongono.
function alternativeIngrediente(i) {
  const b = i.base || i, k0 = kcalIng(b), a0 = (window.ALIMENTI || {})[b.nome];
  const utili = (SCAMBI_LEGGERI[b.nome] || []).filter(n => {
    const a1 = (window.ALIMENTI || {})[n];
    if (!a1 || b.unita === "q.b.") return false;
    const c = ingredienteCon(i, n), risparmio = k0 - kcalIng(c);
    const proteineOk = !a0 || (a1[1] * grammiIng(c) / 100) >= 0.75 * (a0[1] * grammiIng(b) / 100) - 0.5;
    return risparmio >= 20 && risparmio >= 0.08 * k0 && proteineOk;
  });
  return [...(i.alt || []), ...utili].filter((n, k, arr) => n !== b.nome && (window.ALIMENTI || {})[n] && arr.indexOf(n) === k).slice(0, 5);
}
// La stessa quantità con l'alimento alternativo (se l'altro non si conta a pezzi, i pezzi diventano grammi)
function ingredienteCon(i, nome) {
  const b = i.base || { nome: i.nome, qta: i.qta, unita: i.unita };
  let qta = b.qta, unita = b.unita;
  if (unita === "pz" && !(window.PESO_PZ || {})[nome]) { qta = Math.round(b.qta * ((window.PESO_PZ || {})[b.nome] || 100)); unita = "g"; }
  return Object.assign({}, i, { nome, qta, unita, base: b });
}
// Le varianti si ricordano per nome dell'ingrediente (es. { "Chili…": { "Manzo magro macinato": "Fesa di tacchino macinata" } }):
// togliendo o spostando un ingrediente nella ricetta, le altre scelte restano sugli ingredienti giusti
const haChiave = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function conVarianti(r) {
  const sc = leggiVarianti()[r.nome];
  if (!sc || !r.ingredienti) return r;
  const c = clone(r);
  c.ingredienti = c.ingredienti.map(i => { const n = haChiave(sc, i.nome) ? sc[i.nome] : null; return n && (window.ALIMENTI || {})[n] && n !== i.nome ? ingredienteCon(i, n) : i; });
  return c;
}
// Le varianti salvate con la vecchia chiave (posizione dell'ingrediente: "0", "1"…) passano al nome dell'ingrediente che c'è oggi in quella posizione
function migraVarianti(lista) {
  const v = leggiVarianti();
  let cambiato = false;
  Object.keys(v).forEach(nomeRic => {
    const sc = v[nomeRic];
    if (!sc || typeof sc !== "object") { delete v[nomeRic]; cambiato = true; return; }
    const vecchie = Object.keys(sc).filter(k => /^\d+$/.test(k));
    if (!vecchie.length) return;
    const r = lista.find(x => x.nome === nomeRic), ings = (r && (r._orig || r).ingredienti) || [];
    vecchie.forEach(k => {
      const i = ings[+k];
      if (i && i.nome && !haChiave(sc, i.nome)) sc[i.nome] = sc[k];
      delete sc[k];
    });
    if (!Object.keys(sc).length) delete v[nomeRic];
    cambiato = true;
  });
  if (cambiato) salvaVarianti(v);
}
// Dopo aver modificato una ricetta: le varianti degli ingredienti che non ci sono più si tolgono (e se la ricetta cambia nome, le varianti la seguono)
function aggiornaVariantiRicetta(vecchioNome, nuovoNome, ingredienti) {
  const v = leggiVarianti(), sc = v[vecchioNome];
  if (!sc) return;
  const nomi = new Set(ingredienti.map(i => i.nome)), resta = {};
  Object.keys(sc).forEach(k => { if (nomi.has(k)) resta[k] = sc[k]; });
  delete v[vecchioNome];
  if (Object.keys(resta).length) v[nuovoNome] = resta;
  salvaVarianti(v);
}
// Il suggerimento più utile: cosa sostituire per avere lo stesso piatto con meno calorie (senza perdere troppe proteine)
function suggerimentiLeggeri(o) {
  const out = [];
  o.ingredienti.forEach((i, idx) => {
    if (i.base || i.unita === "q.b.") return;                       // già sostituito, o quantità libera
    const k0 = kcalIng(i), a0 = (window.ALIMENTI || {})[i.nome];
    let migliore = null;
    alternativeIngrediente(i).forEach(n => {
      const c = ingredienteCon(i, n), k1 = kcalIng(c), a1 = (window.ALIMENTI || {})[n];
      const proteineAlte = a0 && a1 ? (a1[1] * grammiIng(c) / 100) >= 0.75 * (a0[1] * grammiIng(i) / 100) - 0.5 : true;   // non perde più di un quarto delle proteine
      const risparmio = k0 - k1;
      if (risparmio >= 20 && risparmio >= 0.08 * k0 && proteineAlte && (!migliore || risparmio > migliore.risparmio)) migliore = { idx, da: i.nome, a: n, risparmio: Math.round(risparmio) };
    });
    if (migliore) out.push(migliore);
  });
  return out.sort((x, y) => y.risparmio - x.risparmio).slice(0, 5);
}
function suggerimentiLeggeriHTML(r) {
  const o = r._orig || r, s = suggerimentiLeggeri(o), n = o.porzioni > 1 ? o.porzioni : 1;
  if (!s.length) return "";
  const tot = s.reduce((x, y) => x + y.risparmio, 0), per = x => n > 1 ? `${Math.round(x / n)} kcal a ${esc(o.pezzo || "porzione")}` : `${x} kcal`;
  return `<details class="sugg-leggera"><summary>💡 Stesso piatto, meno kcal <em>−${per(tot)}</em></summary>
    ${s.map(x => `<button class="sugg-riga" data-var-scegli="${esc(r.nome)}" data-var-idx="${x.idx}" data-var-nome="${esc(x.a)}"><span>${esc(x.da)} → <b>${esc(x.a)}</b></span><em>−${per(x.risparmio)}</em></button>`).join("")}
    ${s.length > 1 ? `<button class="btn-link" data-var-tutte="${esc(r.nome)}" data-var-lista="${esc(JSON.stringify(s.map(x => [x.da, x.a])))}">Applica tutte</button>` : ""}</details>`;
}
// Tocchi ⇄ accanto a un ingrediente: compare l'elenco delle alternative con la differenza di calorie
function apriListaVarianti(nomeRic, idx) {
  const r = ricette.find(x => x.nome === nomeRic), box = document.getElementById("var-" + idx);
  if (!r || !box) return;
  if (!box.hidden) { box.hidden = true; return; }
  document.querySelectorAll(".var-lista").forEach(b => { b.hidden = true; });
  const o = r._orig || r, i = o.ingredienti[idx], b = i.base || i;
  const kBase = kcalIng(b), scelta = i.base ? i.nome : "";
  const riga = (nome, etichetta, k) => `<button class="var-opz ${nome === scelta ? "attiva" : ""}" data-var-scegli="${esc(nomeRic)}" data-var-idx="${idx}" data-var-nome="${esc(nome)}">
    <span>${esc(etichetta)}</span><em>${Math.round(k)} kcal${nome ? ` (${k - kBase >= 0 ? "+" : ""}${Math.round(k - kBase)})` : ""}</em></button>`;
  const opz = alternativeIngrediente(i).map(n => ({ n, c: ingredienteCon(i, n) })).map(x => Object.assign(x, { k: kcalIng(x.c) })).sort((x, y) => x.k - y.k);   // le più leggere in cima
  // suggerimento furbo: l'alternativa più leggera che non toglie troppe proteine
  const a0 = (window.ALIMENTI || {})[b.nome], p0 = a0 ? a0[1] * grammiIng(b) / 100 : 0;
  const furbo = opz.map(x => { const a1 = (window.ALIMENTI || {})[x.n], p1 = a1 ? a1[1] * grammiIng(x.c) / 100 : 0; return { n: x.n, risparmio: Math.round(kBase - x.k), dp: p1 - p0, p0 }; })
    .filter(x => x.risparmio >= 10 && x.risparmio >= 0.08 * kBase && x.dp >= -0.25 * x.p0 - 0.5).sort((x, y) => y.risparmio - x.risparmio)[0];
  const testoFurbo = f => `Con <b>${esc(f.n)}</b> risparmi <b>${f.risparmio} kcal</b> ${Math.abs(f.dp) < 1 || Math.abs(f.dp) < 0.1 * f.p0 ? "e le proteine restano quasi uguali" : f.dp > 0 ? `e prendi ${Math.round(f.dp)} g di proteine in più` : `(${Math.round(-f.dp)} g di proteine in meno)`}`;
  box.innerHTML = riga("", b.nome, kBase) + opz.slice(0, 4).map(x => riga(x.n, x.n, x.k)).join("") +
    (furbo && furbo.n !== scelta ? `<button class="var-furbo" data-var-scegli="${esc(nomeRic)}" data-var-idx="${idx}" data-var-nome="${esc(furbo.n)}">🌙 <b>Consiglio furbo</b> · ${esc(furbo.n)} <em>−${furbo.risparmio} kcal${Math.abs(furbo.dp) < 1 || Math.abs(furbo.dp) < 0.1 * furbo.p0 ? ", stesse proteine" : furbo.dp > 0 ? `, +${Math.round(furbo.dp)} g proteine` : `, −${Math.round(-furbo.dp)} g proteine`}</em></button>` : "");
  box.hidden = false;
}
function scegliVariante(nomeRic, idx, nome) {
  const r = ricette.find(x => x.nome === nomeRic), i = r && (r._orig || r).ingredienti[idx];
  if (!i) return;
  const chiave = (i.base || i).nome;   // si ricorda per nome dell'ingrediente originale, non per posizione
  const v = leggiVarianti();
  v[nomeRic] = v[nomeRic] || {};
  if (nome) v[nomeRic][chiave] = nome; else delete v[nomeRic][chiave];
  if (!Object.keys(v[nomeRic]).length) delete v[nomeRic];
  salvaVarianti(v);
  caricaRicette();
  apriRicetta(nomeRic);
  avviso(nome ? `Variante: ${nome}` : "Ingrediente originale ripristinato");
}

// Costruisce l'elenco ricette in uso = base (o CSV importato) + ricette utente
// Ricette del ricettario di base eliminate (o sostituite da una versione modificata)
function leggiNascoste() { try { return new Set(JSON.parse(localStorage.getItem("mp_ricette_nascoste")) || []); } catch (e) { return new Set(); } }
function salvaNascoste(set) { localStorage.setItem("mp_ricette_nascoste", JSON.stringify([...set])); }
function caricaRicette() {
  const nascoste = leggiNascoste();
  const custom = leggiCustom();
  const nomiCustom = new Set(custom.map(r => r.nome)); // una tua versione sostituisce quella di base
  const base = (leggiRicette() || window.RICETTE_ESEMPIO).filter(r => !nascoste.has(r.nome) && !nomiCustom.has(r.nome));
  migraVarianti(base.concat(custom));
  ricette = base.concat(custom).map(conVarianti).map(derivaPorzioni);
  preparaRicette();
}
// Escape per testo inserito in HTML/attributi
const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// -------- Persistenza semplice via localStorage --------
// Assegnazione tipo-giornata per i 7 giorni (Lun→Dom)
function leggiTipi() {
  if (localStorage.getItem("mp_tipi_nov26") !== "1") { localStorage.setItem("mp_tipi", JSON.stringify(DEFAULT_TIPI)); localStorage.setItem("mp_tipi_nov26", "1"); }   // una volta sola: la nuova settimana tipo
  const raw = localStorage.getItem("mp_tipi");
  const t = raw ? JSON.parse(raw) : null;
  return (Array.isArray(t) && t.length === 7 && t.every(x => TIPI_GIORNATA[x])) ? t : DEFAULT_TIPI.slice();
}
function salvaTipi(t) { localStorage.setItem("mp_tipi", JSON.stringify(t)); }
function targetGiorno(i) { return TIPI_GIORNATA[leggiTipi()[i]].target; }

function leggiRicette() {
  const raw = localStorage.getItem("mp_ricette");
  return raw ? JSON.parse(raw) : null;
}

// -------- Utility --------
// Avviso breve in basso (al posto delle finestre "OK"); mostraToast è in diario.js
function avviso(msg, etichetta, azione, tutto) {
  if (typeof mostraToast === "function") mostraToast(msg, etichetta, azione, tutto); else window.alert(msg);
}
function sommaMacro(lista) {
  return lista.reduce((acc, r) => ({
    kcal: acc.kcal + r.kcal,
    proteine: acc.proteine + r.proteine,
    carboidrati: acc.carboidrati + r.carboidrati,
    grassi: acc.grassi + r.grassi,
  }), { kcal:0, proteine:0, carboidrati:0, grassi:0 });
}

// -------- Percentuali dei macro (quota delle calorie) --------
// 1 g di proteine o carboidrati = 4 kcal, 1 g di grassi = 9 kcal
function pctMacro(m) {
  const kP = m.proteine * 4, kC = m.carboidrati * 4, kG = m.grassi * 9;
  const tot = kP + kC + kG;
  if (!tot) return { p: 0, c: 0, g: 0 };
  const p = Math.round(kP / tot * 100), c = Math.round(kC / tot * 100);
  return { p, c, g: 100 - p - c };
}
// Barra colorata P/C/G con le percentuali
function barraMacroHTML(m, obi) {
  const x = pctMacro(m), o = obi && (obi.proteine * 4 + obi.carboidrati * 4 + obi.grassi * 9) > 0 ? pctMacro(obi) : null;   // senza obiettivo (giornata già completa) niente "/ 0%"
  return `<div class="macro-bar" title="Quota delle calorie da proteine, carboidrati e grassi">
      <span class="mb-p" style="width:${x.p}%"></span><span class="mb-c" style="width:${x.c}%"></span><span class="mb-g" style="width:${x.g}%"></span>
    </div>
    <div class="macro-pct">
      <span><i class="dot-p"></i>Proteine <b>${x.p}%</b>${o ? ` <em>/ ${o.p}%</em>` : ""}</span>
      <span><i class="dot-c"></i>Carboidrati <b>${x.c}%</b>${o ? ` <em>/ ${o.c}%</em>` : ""}</span>
      <span><i class="dot-g"></i>Grassi <b>${x.g}%</b>${o ? ` <em>/ ${o.g}%</em>` : ""}</span>
    </div>`;
}

// Etichetta "peso da crudo" per i carboidrati (riso, pasta, ecc.)
function crudoLabel(nome, grammi) {
  for (const [re, f] of (window.CRUDO_FATTORE || [])) {
    if (re.test(nome)) {
      if (/cott/i.test(nome)) return "≈ " + (Math.round(grammi / f / 5) * 5) + " g da crudo";
      return "peso da crudo"; // è già indicato da crudo (es. pasta)
    }
  }
  return null;
}

// Piatti e preparazioni che non si comprano già fatti (si preparano in casa o si mangiano fuori): non compaiono in lista
const SPESA_COMPOSTI = /^(cappuccino|frittata|pizza|sushi|nigiri|maki|uramaki|poke|kebab|panino|hot dog|club sandwich|tramezzino|cotoletta|gyoza|involtini|lasagne|minestrone|zuppa|crema di verdure|brodo|verdure (grigliate|al forno)|caponata|rag[uù]|besciamella|suppl[iì]|crostini|caprese|ossobuco|saltimbocca|brasato|bollito|ribollita|panzanella|smoothie|frullato|cioccolata calda|gin tonic|spritz|mojito|negroni|aperitivo|salumi misti|formaggi misti|tiramis[uù]|brownie|muffin|pancake|cheesecake|crostata|torta|crepes|waffle|quesadilla|paella|pad thai|cornetto|poke|pasta (al|alla|all|cacio|ai|agli)|risotto|riso alla|insalata di riso|porridge|spremuta|pur[eèé] |purea|crocchette|vellutata|bruschetta|sugo|patate (lesse|al forno)|patatine fritte|toast|polpette|tartare|carpaccio|sashimi|arrosto|pollo arrosto|spezzatino|straccetti|tempura|pollo al curry|nachos|stufato|nuggets|bevanda isotonica|gel energetico|energy drink|maltodestrine|bcaa|glutammina|creatina|collagene|magnesio|vitamina|omega|ginseng|caseina)/i;
// Reparto del supermercato per ogni ingrediente (prima regola che combacia). Non esiste «Altro»: ogni voce ha un reparto.
function repartoDi(nome) {
  const n = nome.toLowerCase();
  const R = [
    ["Casa e igiene", /carta (igienica|assorbente|da cucina|forno)|scottex|tovagli|fazzolett|detersiv|detergent|sapone|bagnoschiuma|shampoo|balsamo|dentifric|spazzolin|deodorant|assorbent|cotone|cotton fioc|rasoi|schiuma da barba|crema (viso|mani|corpo)|spugn|strofinacc|pezz[ae]|candeggin|ammorbidente|lavastoviglie|lavatrice|pulitor|sgrassator|anticalcare|ammoniaca|sacchett|sacchi|pellicola|alluminio|carta forno|stuzzicadenti|candele|lampadin|pile\b|batterie|insetticida|deumidificator|igienizzant|mascherin|cerotti|disinfettant|salviett|spray|lucido|scopa|paletta|secchio|guanti|filtri|capsule (caff|lavast)|lettiera|mangime/],
    ["Dispensa", /^(burro d'arachidi|burro di mandorle|fecola|amido|lievito|bicarbonato|vaniglia|zucchero|eritritolo|dolcificante|stevia|sciroppo|miele|marmellata|confettura|nutella|crema di (nocciole|pistacchio)|cacao|pangrattato|gelatina|proteine in polvere|tapioca|semolino|maltodestrine|t[eè]$|tisana|matcha|caff[eè]|patatine in busta|popcorn)/],
    ["Bevande", /^(acqua|coca cola|fanta|succo|limonata|birra|vino|prosecco|gin$|vodka|rum$|tonica|bevanda isotonica|energy)/],
    ["Pane, pasta e cereali", /^farina|noodles|^pasta|ramen|fogli di riso|ravioli|tagliatelle|gnocchi|tortellini|biscotti secchi|^pane|^pancarr/],
    ["Carne e pesce", /bresaola|tacchino|pollo|manzo|vitello|maiale|salmone|tonno|gamber|merluzzo|sgombro|prosciutto|dentice|spigola|branzino|orata|sogliola|totani|scampi|mazzancolle|aragosta|ostriche|polpo|calamari|cozze|vongole|trota|nasello|pesce|baccal|stoccafisso|aringa|guanciale|salame|salsiccia|speck|trippa|coniglio|agnello|anatra|cavallo|wurstel|mortadella|pancetta|sardine|alici|seppie|platessa|surimi|strutto/],
    ["Latticini e uova", /uov|albume|tuorlo|skyr|yogurt|ricotta|fiocchi di latte|feta|parmigiano|\bgrana\b|pecorino|formaggio|^latte(?! di cocco)|bevanda (di|al)|mozzarella|crescenza|asiago|fontina|provol|scamorz|stracchino|burrata|mascarpone|panna|burro|kefir|gorgonzola|caciotta|taleggio|emmental|quark|budino|gelato|ghiacciolo|margarina|besciamella/],
    ["Legumi e scatolame", /burger vegetale|falafel|ceci|cicerchie|lupini|fagioli|lenticchie|edamame|tofu|tempeh|seitan|\bmais\b|olive|passata|latte di cocco|kimchi|piselli|fave\b|concentrato di pomodoro|latte di cocco|soia texturizzata|alghe|nori|wakame|miso|shirataki/],
    ["Pane, pasta e cereali", /pane|pasta|riso|quinoa|couscous|noodles|avena|gallett|crackers|granola|tortilla|farro|bulgur|orzo|piadina|fette biscottate|polenta|miglio|grano saraceno|muesli|cornflakes|pancarr|grissini|taralli|focaccia|pita|naan|wrap|udon|spaghetti|tortellini|amaranto|pavesini|popcorn|spaghetti di soia/],
    ["Salse e spezie", /guacamole|olio|salsa|teriyaki|pesto|tahina|hummus|curry|cannella|\bsale\b|curcuma|cumino|origano|rosmarino|salvia|\btimo|alloro|zafferano|garam|peperoncino|paprika|spezie|cardamomo|chiodi di garofano|sumac|za'atar|harissa|capperi|tamari|erbe aromatiche|dado|coriandolo|erba cipollina|aceto|senape|maionese|ketchup|wasabi|zenzero|prezzemolo|basilico/],
    ["Frutta secca", /mandorl|noci|arachid|semi|sesamo|cocco|chia|datter|pistacch|nocciol|anacardi|pinoli|uvetta|prugne secche|fichi secchi|albicocche secche|bacche di goji|cranberries|frutta secca/],
    ["Dolci", /cioccolat|biscotti|lotus|wafer|plumcake|barretta|merendin|crostata|brownie|gelato|caramell/],
    ["Frutta e verdura", /avocado|banana|broccoli|carot|cetriol|fragol|frutti rossi|insalata|kiwi|lime|limone|mango|mela\b|mele\b|mirtill|arancia|peperon|pomodor|rucola|spinaci|zucchin|asparagi|cavol|funghi|cipoll|melanzan|zucca|patat|broccoletti|valeriana|rafano|porcini|scalogn|ribes|topinambur|crauti|finocchi|sedano|carota|lattuga|porri|bietol|radicch|cicoria|rape\b|ravanelli|verza|cime di rapa|indivia|carciofi|melagrana|pera\b|pesca|uva\b|ananas|anguria|melone|clementine|prugne|albicocche|mandarino|pompelmo|fichi|ciliegie|cachi|lamponi|more\b|papaya|nettarina|nespole|fico d'india|aglio|agrumi|frutta|verdur/],
  ];
  for (const [rep, re] of R) if (re.test(n)) return rep;
  // nessuna regola per nome (alimenti nuovi o rari): si decide dai valori nutrizionali, così nessuna voce resta senza reparto
  const a = (window.ALIMENTI || {})[nome];
  if (a) {
    if (a[0] < 60) return "Frutta e verdura";
    if (a[1] >= 15 && a[2] < 8) return /latte|yogurt|formagg/.test(n) ? "Latticini e uova" : "Carne e pesce";
    if (a[3] >= 35) return "Frutta secca";
    if (a[2] >= 55 && a[1] < 14) return "Pane, pasta e cereali";
    if (a[2] >= 40 && a[3] < 20) return "Dolci";
  }
  return "Dispensa";
}
const ORDINE_REPARTI = [
  "Frutta e verdura", "Carne e pesce", "Latticini e uova",
  "Pane, pasta e cereali", "Legumi e scatolame", "Salse e spezie",
  "Frutta secca", "Dolci", "Dispensa", "Bevande", "Casa e igiene",
];

// Voci "già prese" (spuntate): memorizzate per nome, così restano tra un'apertura e l'altra
function leggiPresi() { try { return new Set(JSON.parse(localStorage.getItem("mp_spesa_presi")) || []); } catch (e) { return new Set(); } }
function salvaPresi(set) { localStorage.setItem("mp_spesa_presi", JSON.stringify([...set])); }
// Quello che hai comprato (spuntato in lista) resta "in casa" per 14 giorni anche dopo "Nuova spesa": serve a suggerirti pasti e ricette con quello che hai già
const GIORNI_IN_CASA = 14;
function leggiInCasaRaw() { try { return JSON.parse(localStorage.getItem("mp_incasa")) || {}; } catch (e) { return {}; } }
function leggiScorte() { try { return JSON.parse(localStorage.getItem("mp_incasa_q")) || {}; } catch (e) { return {}; } }
function segnaInCasa(nome, si, grammi) {
  const c = leggiInCasaRaw(), q = leggiScorte();
  if (si) { c[nome] = oggiISO(); q[nome] = Math.max(grammi || 0, paccoG(nome)); } else { delete c[nome]; delete q[nome]; }
  try { localStorage.setItem("mp_incasa", JSON.stringify(c)); localStorage.setItem("mp_incasa_q", JSON.stringify(q)); } catch (e) {}
}
// Quanto ne hai in casa: alla spesa si assume una confezione tipica (in grammi, per il riso e la pasta da crudo);
// ogni volta che lo scrivi nel diario si sottrae. Quando è quasi finito torna da solo in lista; se non lo usi, comunque dopo qualche giorno.
const PACCO_TIPICO = [
  [/^albume/i, 500], [/^uova/i, 330], [/^skyr/i, 450], [/^yogurt/i, 250], [/^fiocchi di latte/i, 200], [/^ricotta/i, 250], [/^mozzarella|^burrata|^scamorza|^feta/i, 250],
  [/^petto di pollo|^coscia/i, 500], [/^fesa di tacchino|^bresaola|^prosciutto/i, 150], [/^tofu|^seitan|^tempeh/i, 200], [/^proteine in polvere/i, 900],
  [/^riso|^pasta|^couscous|^quinoa|^farro|^noodles|^orzo|^bulgur|^miglio/i, 500], [/^fiocchi d'avena|^farina|^granola|^muesli/i, 500], [/^pane|^piadina|^tortilla|^crackers|^gallette/i, 300],
  [/^olio|^aceto|^salsa di soia/i, 500], [/^parmigiano|^grana|^pecorino/i, 200], [/^mandorle|^noci|^nocciole|^anacardi|^pistacchi|^arachidi|^semi|^burro d'arachidi|^burro di mandorle/i, 200],
  [/^ceci|^lenticchie|^fagioli|^piselli|^edamame/i, 400], [/^banana/i, 700], [/^miele|^marmellata|^sciroppo/i, 350],
];
const PACCO_REPARTO = { "Frutta e verdura": 700, "Carne e pesce": 400, "Latticini e uova": 300, "Pane, pasta e cereali": 500, "Legumi e scatolame": 400, "Salse e spezie": 250, "Frutta secca": 200, "Dolci": 150, "Dispensa": 500, "Bevande": 1000, "Casa e igiene": 1 };
const paccoG = (nome) => { const t = PACCO_TIPICO.find(([re]) => re.test(nome)); return t ? t[1] : (PACCO_REPARTO[repartoDi(nome)] || 300); };
// grammi usati dal giorno dell'acquisto (cotto → crudo per riso, pasta…)
function consumatoDa(nome, da) {
  const d = typeof leggiDiario === "function" ? leggiDiario() : {};
  let g = 0;
  Object.keys(d).filter(x => x >= da && x <= oggiISO()).forEach(x => (d[x].pasti || []).forEach(p => (p.ingredienti || []).forEach(i => {
    if (nomeSpesa(i.nome).toLowerCase() !== nome.toLowerCase() || !(window.ALIMENTI || {})[i.nome]) return;
    const f = /cott/i.test(i.nome) && (window.CRUDO_FATTORE || []).find(([re]) => re.test(i.nome));
    g += grammiIng(i) / (f ? f[1] : 1);
  })));
  return g;
}
// la scorta è la quantità che la lista ti ha suggerito di comprare (se non c'era, una confezione tipica)
const scortaG = (nome) => leggiScorte()[nome] || paccoG(nome);
function restoInCasa(nome) { const da = leggiInCasaRaw()[nome]; return da ? scortaG(nome) - consumatoDa(nome, da) : null; }
const finito = (nome) => { if (scortaG(nome) <= 1) return false; const r = restoInCasa(nome);   // le cose non alimentari (detersivo, carta…) non hanno grammi: restano spuntate
   return r !== null && r < Math.max(30, scortaG(nome) * 0.12); };
const GIORNI_PRESI = 10;
function scadiPresi() {
  const presi = leggiPresi(); if (!presi.size) return presi;
  const c = leggiInCasaRaw(), da = addGiorniISO(oggiISO(), -GIORNI_PRESI);
  let cambiato = false;
  [...presi].forEach(n => { if (!c[n] || c[n] < da || finito(n)) { presi.delete(n); cambiato = true; } });
  if (cambiato) salvaPresi(presi);
  return presi;
}
function leggiInCasa() {
  const c = leggiInCasaRaw(), da = addGiorniISO(oggiISO(), -GIORNI_IN_CASA);
  return Object.entries(c).filter(([n, d]) => d >= da && !finito(n)).map(([n]) => n.toLowerCase());
}

// -------- Lista della spesa: da quello che mangi più spesso --------
// Guarda il diario delle ultime 4 settimane: per ogni ingrediente quanti giorni
// l'hai mangiato e quanto in media a settimana. In cima ciò che mangi più spesso.
const GIORNI_SPESA = 28;
// Consumo per alimento nei giorni indicati: contano solo i giorni con almeno 3 pasti scritti (un giorno dimenticato non abbassa la media).
// `g` è già «a settimana» (grammi totali / giorni validi × 7); `giorni` = in quanti dei giorni validi l'hai mangiato.
// Piatti → ingredienti da comprare, con quanti grammi di ingrediente ci sono in 1 g di piatto (vale anche per gli alimenti che hai aggiunto tu con quel nome)
function lattePiatto(n) {
  return /scremat/.test(n) && !/parzial/.test(n) ? "Latte scremato" : /parzial/.test(n) ? "Latte parzialmente scremato" : /intero/.test(n) ? "Latte intero"
    : /soia/.test(n) ? "Bevanda di soia" : /avena/.test(n) ? "Bevanda di avena" : /mandorl/.test(n) ? "Bevanda di mandorla" : /riso/.test(n) ? "Bevanda di riso" : "Latte parzialmente scremato";
}
const PIATTI_SPESA = [
  [/^(cappuccino|caff[eè] ?latte|latte macchiato|caff[eè] macchiato)/, (n) => [[lattePiatto(n), 0.8]]],
  [/^(frittata di albumi|omelette? di albumi)/, () => [["Albume", 0.95]]],
  [/^(omelette?|frittata|uova (strapazzate|al tegamino|in camicia|sode|alla coque)|uovo (sodo|alla coque|in camicia))/, () => [["Uova", 0.9]]],
  [/^porridge/, (n) => [["Fiocchi d'avena", 0.25], [lattePiatto(n.replace(/^porridge|avena col|d'avena|di avena/g, "")), 0.7]]],   // «avena» qui sono i fiocchi, non la bevanda
  [/^pancake/, () => [["Fiocchi d'avena", 0.35], ["Uova", 0.25], ["Latte parzialmente scremato", 0.35]]],
  [/^(pur[eèé] di patate|purea di patate)/, () => [["Patate", 0.85], ["Latte parzialmente scremato", 0.15]]],
  [/^(patate (lesse|al forno|arrosto|bollite)|crocchette di patate|hash brown)/, () => [["Patate", 1]]],
  [/^spremuta d'aranc/, () => [["Arancia", 2]]],
  [/^frullato proteico/, (n) => [["Proteine in polvere", 0.1], [lattePiatto(n), 0.85]]],
  [/^(smoothie|frullato)/, () => [["Banana", 0.4], ["Frutti rossi", 0.4]]],
  [/^toast/, () => [["Pane in cassetta (toast)", 0.55], ["Prosciutto cotto", 0.2], ["Formaggio a fette (sottiletta)", 0.2]]],
  [/^pasta al pomodoro/, () => [["Pasta di semola", 0.35], ["Passata di pomodoro", 0.4]]],
  [/^pasta al pesto/, () => [["Pasta di semola", 0.35], ["Pesto", 0.12]]],
  [/^insalata di riso/, () => [["Riso crudo", 0.3], ["Tonno in scatola al naturale", 0.1], ["Mais", 0.1]]],
  [/^(verdure (grigliate|al forno))/, () => [["Zucchine", 0.4], ["Melanzane", 0.3], ["Peperoni", 0.3]]],
  [/^(polpette di manzo)/, () => [["Manzo magro macinato", 0.8]]],
  [/^(polpette di (pollo|tacchino)|polpette di pollo o tacchino)/, () => [["Fesa di tacchino macinata", 0.8]]],
  [/^(pollo arrosto|straccetti di pollo)/, () => [["Petto di pollo", 1]]],
  [/^arrosto di tacchino/, () => [["Fesa di tacchino", 1]]],
  [/^(tartare|carpaccio) di manzo/, () => [["Manzo magro", 1]]],
  [/^(tartare|sashimi) di salmone/, () => [["Salmone fresco", 1]]],
  [/^caprese/, () => [["Mozzarella", 0.5], ["Pomodoro", 0.5]]],
  [/^(sugo al pomodoro)/, () => [["Passata di pomodoro", 0.9]]],
  [/^(vellutata di zucca)/, () => [["Zucca", 0.8], ["Patate", 0.15]]],
];
function ingredientiSpesa(nome) {
  const n = String(nome).toLowerCase().trim();
  const r = PIATTI_SPESA.find(([re]) => re.test(n));
  if (!r) return null;
  return r[1](n).filter(([x]) => (window.ALIMENTI || {})[x]);
}
function consumiPerAlimento(giorniISO) {
  const d = typeof leggiDiario === "function" ? leggiDiario() : {};
  const validi = giorniISO.filter(x => d[x] && (d[x].pasti || []).length >= 3);
  const st = {};
  validi.forEach(x => {
    const visti = new Set();
    d[x].pasti.forEach(p => (p.ingredienti || []).forEach(i => {
      if (!(window.ALIMENTI || {})[i.nome] || i.unita === "q.b.") return;
      // un piatto (cappuccino, omelette, porridge…) in lista diventa i suoi ingredienti: si compra il latte, non il cappuccino
      const parti = ingredientiSpesa(i.nome) || [[i.nome, 1]];
      parti.forEach(([nome, fr]) => {
        const e = st[nome] ||= { giorni: 0, g: 0 };
        e.g += grammiIng(i) * fr;
        if (!visti.has(nome)) { visti.add(nome); e.giorni++; }
      });
    }));
  });
  const k = validi.length ? 7 / validi.length : 0;
  Object.values(st).forEach(e => { e.g *= k; });
  return { st, nValidi: validi.length, validi };
}
// La lista della spesa mostra ciò che consumi di solito: ultime 4 settimane, solo giorni passati (né oggi né quelli pianificati)
function statSpesa() {
  const oggi = oggiISO();
  const giorni = []; for (let k = 1; k <= GIORNI_SPESA; k++) giorni.push(addGiorniISO(oggi, -k));
  const r = consumiPerAlimento(giorni);
  return { st: r.st, nGiorni: r.nValidi };
}
function fmtPeso(x, u) {
  if (x >= 1000) return (Math.round(x / 100) / 10).toString().replace(".", ",") + (u === "ml" ? " l" : " kg");
  return (Math.round(x / 10) * 10 || Math.round(x)) + " " + u;
}
// "~600 g" (quantità media a settimana; uova in pezzi, riso/pasta cotti convertiti a crudo)
function qtaSettimanaLabel(nome, gSett) {
  const pz = window.pzPredefinito && window.pzPredefinito(nome) && !/^(Uva|Fragole|Ciliegie|Lamponi|More)$/.test(nome) ? window.PESO_PZ[nome] : 0;   // la spesa di fragole e uva si fa a peso
  if (pz && pz >= 1 && pz < 300) return `~${Math.max(1, Math.round(gSett / pz))} pz`; // alimenti a pezzi: quanti ne compri
  const fatt = /cott/i.test(nome) && (window.CRUDO_FATTORE || []).find(([re]) => re.test(nome));
  if (fatt) return `~${fmtPeso(gSett / fatt[1], "g")} da crudo`;
  return `~${fmtPeso(gSett, UNITA_LIQUIDI.test(nome) ? "ml" : "g")}`;
}
// i grammi che l'etichetta suggerisce di comprare (da crudo per riso e pasta): se compri quella quantità, quella è la scorta
function qtaSettimanaG(nome, gSett) {
  const pz = window.pzPredefinito && window.pzPredefinito(nome) && !/^(Uva|Fragole|Ciliegie|Lamponi|More)$/.test(nome) ? window.PESO_PZ[nome] : 0;
  if (pz && pz >= 1 && pz < 300) return Math.max(1, Math.round(gSett / pz)) * pz;
  const fatt = /cott/i.test(nome) && (window.CRUDO_FATTORE || []).find(([re]) => re.test(nome));
  const g = fatt ? gSett / fatt[1] : gSett;
  return g >= 1000 ? Math.round(g / 100) * 100 : (Math.round(g / 10) * 10 || Math.round(g));
}
function leggiExtraSpesa() { try { return JSON.parse(localStorage.getItem("mp_spesa_extra")) || []; } catch (e) { return []; } }
function salvaExtraSpesa(a) { localStorage.setItem("mp_spesa_extra", JSON.stringify(a)); }
function voceSpesaHTML(nome, preso, info, extra, q) {
  return `<li class="voce${preso ? " preso" : ""}"><label>
    <input type="checkbox" data-spesa="${esc(nome)}" ${q ? `data-q="${Math.round(q)}"` : ""} ${preso ? "checked" : ""}><span>${esc(nome)}</span>${info ? `<em class="spesa-qta">${info}</em>` : ""}</label>
    ${extra ? `<button class="lib-del" data-spesa-del="${esc(nome)}" aria-label="Togli dalla lista">${ICONA_CESTINO}</button>` : ""}</li>`;
}
let spesaDispensaAperta = false;
const SPESA_SALTA = /^(acqua|sale|spezie|tè|caffè|bicarbonato|lievito per dolci|vaniglia|purea di mela|salsa yogurt-limone|uova al tegamino|patate lesse|patate al forno|gin|gin tonic|vodka|rum|whisky|birra|prosecco|spritz|vino|vino bianco|vino rosso|liquore|amaro|grappa|aperol|campari)$/i;   // + alcolici (si bevono fuori: in lista solo se li aggiungi tu a mano)   // quello che non si compra (si prepara in casa)
// in negozio non esiste "riso cotto": si compra il riso (le legumi cotti sono ceci e lenticchie)
const nomeSpesa = (n) => /prosciutto/i.test(n) ? n : n.replace(/ (cotto|cotta|cotti|cotte)$/i, "");
function spesaHTML() {
  const { st } = statSpesa();
  const presi = scadiPresi();
  // quanto ne consumi di solito in una settimana (non quello che serve per il futuro e non meno quello che hai in casa)
  // "Pasta di semola cotta" e "Pasta di semola" sono la stessa cosa da comprare: una riga sola, coi grammi da crudo sommati
  const unite = {};
  Object.entries(st).filter(([nome]) => !SPESA_SALTA.test(nome) && !SPESA_COMPOSTI.test(nome)).forEach(([nome, e]) => {
    const n = nomeSpesa(nome), fatt = /cott/i.test(nome) && n !== nome && (window.CRUDO_FATTORE || []).find(([re]) => re.test(nome));
    const u = unite[n] ||= { nome: n, giorni: 0, g: 0, fonti: [] };
    u.g += fatt ? e.g / fatt[1] : e.g;   // cotto → crudo (come nell'etichetta della quantità)
    u.giorni = Math.max(u.giorni, e.giorni);
    u.fonti.push([nome, e.g]);
  });
  const voci = Object.values(unite).map(u => {
    const [nome0, g0] = u.fonti.length === 1 ? u.fonti[0] : [u.nome, u.g];   // una fonte sola: etichetta di sempre ("~200 g da crudo")
    return { nome: u.nome, giorni: u.giorni, info: qtaSettimanaLabel(nome0, g0), q: qtaSettimanaG(nome0, g0) };
  });
  leggiExtraSpesa().forEach(nome => { if (!voci.some(v => v.nome.toLowerCase() === nome.toLowerCase())) voci.push({ nome, giorni: -1, info: "aggiunto da te", extra: true }); });
  const introVuota = voci.length ? "" : `<li class="hint">🛒 Si riempie con i tuoi pasti</li>`;
  // dispensa: gli ingredienti del ricettario che non sono già nella lista, i più usati nelle ricette per primi
  const conta = {};
  const viste = new Set();
  (typeof ricette !== "undefined" ? ricette : []).forEach(r => { const o = r._orig || r; if (viste.has(o.nome)) return; viste.add(o.nome);
    new Set((o.ingredienti || []).filter(i => i.unita !== "q.b.").map(i => i.nome)).forEach(n => { if (!SPESA_SALTA.test(n) && !SPESA_COMPOSTI.test(n) && (window.ALIMENTI || {})[n]) conta[nomeSpesa(n)] = (conta[nomeSpesa(n)] || 0) + 1; }); });
  const inLista = new Set(voci.map(v => v.nome.toLowerCase()));
  const dispensa = Object.entries(conta).filter(([n]) => !inLista.has(n.toLowerCase())).map(([nome, n]) => ({ nome, n, giorni: -1 }));
  const gruppi = {};
  voci.filter(v => !presi.has(v.nome)).forEach(v => (gruppi[repartoDi(v.nome)] ||= []).push(v));
  let html = introVuota + ORDINE_REPARTI.map(rep => {
    const g = gruppi[rep];
    if (!g || !g.length) return "";
    g.sort((a, b) => (b.giorni - a.giorni) || a.nome.localeCompare(b.nome)); // prima ciò che mangi più spesso
    return `<li class="reparto-h">${rep}</li>` + g.map(v => voceSpesaHTML(v.nome, false, v.info, v.extra, v.q)).join("");
  }).join("");
  const dGruppi = {};
  dispensa.filter(v => !presi.has(v.nome)).forEach(v => (dGruppi[repartoDi(v.nome)] ||= []).push(v));
  const nDisp = dispensa.filter(v => !presi.has(v.nome)).length;
  if (nDisp) html += `<li class="dispensa"><details id="spesa-disp" ${spesaDispensaAperta ? "open" : ""}><summary>🧺 Dispensa dal ricettario <em>${nDisp}</em></summary><ul>${ORDINE_REPARTI.map(rep => {
    const g = dGruppi[rep]; if (!g || !g.length) return "";
    g.sort((a, b) => (b.n - a.n) || a.nome.localeCompare(b.nome));
    return `<li class="reparto-h">${rep}</li>` + g.map(v => voceSpesaHTML(v.nome, false, "", false)).join("");
  }).join("")}</ul></details></li>`;
  const giaPresi = voci.concat(dispensa).filter(v => presi.has(v.nome)).sort((a, b) => a.nome.localeCompare(b.nome));
  if (giaPresi.length) html += `<li class="reparto-h presi-h">✓ Già presi</li>` + giaPresi.map(v => voceSpesaHTML(v.nome, true, "", v.extra)).join("");
  return html;
}
function renderSpesa() { const ul = document.getElementById("spesa"); if (ul) ul.innerHTML = spesaHTML(); }
// Apre la lista della spesa nel pannello (bottom-sheet)
function apriSpesa() {
  editCtx = null;
  const { nGiorni } = statSpesa();
  openModal(`<h3 class="modal-title">🛒 Lista della spesa</h3>
    <div class="lib-add">
      <input id="spesa-nuova" class="qta-input wiz-full" placeholder="Aggiungi alla lista…" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
      <button class="btn lib-piu" data-azione="spesa-aggiungi" aria-label="Aggiungi">＋</button>
    </div>
    <ul id="spesa">${spesaHTML()}</ul>`);
}
function aggiungiVoceSpesa() {
  const inp = document.getElementById("spesa-nuova");
  const v = (inp && inp.value || "").trim();
  if (!v) return;
  const t = typeof cercaAlimenti === "function" ? cercaAlimenti(v) : [];
  const nome = (window.ALIMENTI || {})[v] ? v : (t[0] && (t[0].toLowerCase() === v.toLowerCase() || (typeof distanzaTesto === "function" && v.length >= 4 && distanzaTesto(norm(v), norm(t[0])) <= 2)) ? t[0] : v.charAt(0).toUpperCase() + v.slice(1));   // "banna" → Banana; "detersivo piatti" resta com'è
  const extra = leggiExtraSpesa();
  if (!extra.includes(nome)) { extra.push(nome); salvaExtraSpesa(extra); }
  const presi = leggiPresi(); presi.delete(nome); salvaPresi(presi);
  renderSpesa();
  inp.value = ""; inp.focus();
}

// -------- Modale ricette (bottom sheet) --------
function macroPillsHTML(r) {
  return `<span class="pill">${r.pasto}</span>
    <span><b>${r.kcal}</b> kcal</span>${r.tempo ? `<span>· ${r.tempo}′</span>` : ""}
    <span>P ${r.proteine}g</span><span>C ${r.carboidrati}g</span><span>G ${r.grassi}g</span>
    ${r.adattato ? `<span class="pill adattato" title="Quantità di carboidrati/grassi adattate all'obiettivo del giorno">porzione adattata</span>` : ""}
    ${barraMacroHTML(r)}`;
}
// Pulsante ⇄ (se l'ingrediente ha alternative) e, se hai scelto una variante, da cosa parte
function varBtnHTML(nomeRic, i, idx) {
  const alt = alternativeIngrediente(i);
  return (i.base ? ` <small class="var-tag">invece di ${esc(i.base.nome)}</small>` : "") +
    (alt.length ? ` <button class="var-btn" data-var-ric="${esc(nomeRic)}" data-var-idx="${idx}" aria-label="Cambia ingrediente" title="Cambia ingrediente">⇄</button>` : "");
}
function ingredienteHTML(i, idx, editable, nomeRic) {
  const crudo = crudoLabel(i.nome, grammiIng(i));
  const nota = crudo ? ` <span class="crudo">(${crudo})</span>` : "";
  if (editable && i.unita !== "q.b.") {
    const step = i.unita === "pz" ? 1 : 5;
    return `<li class="ing-edit">
      <span class="ing-nome">${i.nome}${nota}</span>
      <span class="ing-qta"><input type="number" class="qta-input" data-idx="${idx}" value="${i.qta}" min="0" step="${step}"><em>${i.unita}</em></span>
    </li>`;
  }
  return `<li class="${i.base ? "ing-var" : ""}">${i.nome}${nota} — <strong>${i.qta} ${i.unita}</strong>${nomeRic ? varBtnHTML(nomeRic, i, idx) + `<div class="var-lista" id="var-${idx}" hidden></div>` : ""}</li>`;
}
// Dal dettaglio di una ricetta: la aggiungi al diario con un tocco (al pasto da cui arrivi, o a quello giusto di oggi)
function bottoneAggiungiRicettaHTML(r) {
  if (typeof aggiungiRicettaAlPasto !== "function" || r.nome === undefined) return "";
  const c = contestoAgg && !contestoAgg.auto ? contestoAgg : null;
  const dove = c ? `${nomePasto(c.pasto, c.data || dataDiario)}` : (typeof pastoPerRicetta === "function" ? nomePasto(pastoPerRicetta(r, dataDiario), dataDiario) : "oggi");
  return `<div class="barra-salva"><button class="btn block" data-agg-ricetta="${esc(r.nome)}" data-agg-chiudi="1">✓ Aggiungi a ${esc(dove)}</button></div>`;   // fisso in fondo al pannello
}
// Le quantità che finiscono nel pasto (su misura per il tuo obiettivo): si modificano nel riepilogo, prima di aggiungere
let _aggQta = null;
function totaleAggHTML() {
  if (!_aggQta || typeof macroAlimento !== "function") return "";
  const t = _aggQta.items.reduce((a, i) => { const d = macroAlimento(i.nome, +i.qta || 0); return { kcal: a.kcal + d.kcal, proteine: a.proteine + d.proteine, carboidrati: a.carboidrati + d.carboidrati, grassi: a.grassi + d.grassi }; }, { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 });
  const giorno = contestoAgg && !contestoAgg.auto ? contestoAgg.data : dataDiario;
  return `<b>${Math.round(t.kcal)}</b> kcal · P ${Math.round(t.proteine)} · C ${Math.round(t.carboidrati)} · G ${Math.round(t.grassi)}${typeof sopraGiornoHTML === "function" ? sopraGiornoHTML(giorno, t.kcal) : ""}`;
}
function quantitaPastoHTML(r) {
  _aggQta = null;
  if (typeof aggiungiRicettaAlPasto !== "function" || typeof porzioneSuMisura !== "function" || typeof targetPastoDiario !== "function" || typeof pastoPerRicetta !== "function") return "";
  try {
    const c = contestoAgg && !contestoAgg.auto ? contestoAgg : { data: dataDiario, pasto: null };
    const pasto = c.pasto || pastoPerRicetta(r, c.data), ps = porzioneSuMisura(r, targetResiduoPasto(c.data, pasto));
    _aggQta = { nome: r.nome, items: ps.items.map(x => { const u = typeof unitaDi === "function" ? unitaDi({ nome: x.nome }) : "g"; return { nome: x.nome, qta: typeof qtaPezziInteri === "function" ? qtaPezziInteri(x.nome, u, Math.round(x.qta)) : Math.round(x.qta), cercato: x.cercato, u }; }) };
  } catch (e) { _aggQta = null; return ""; }
  if (!_aggQta.items.length) return "";
  return `<h4>Le tue quantità</h4><div class="lib-righe agg-righe" id="agg-lista">${aggListaHTML()}</div><p class="agg-totale" id="agg-totale">${totaleAggHTML()}</p>`;
}
// righe delle quantità (nome · − quantità + · unità · cestino): stesso aspetto del pannello del pasto
function aggListaHTML() { return _aggQta ? _aggQta.items.map((i, k) => i.tolto ? "" : rigaQuantitaHTML("agg", k, i, i.u)).join("") : ""; }
function aggAggiorna() { const l = document.getElementById("agg-lista"), t = document.getElementById("agg-totale"); if (l) l.innerHTML = aggListaHTML(); if (t) t.innerHTML = totaleAggHTML(); }
function ricettaDetailHTML(r, editable) {
  if (!editable && r._orig) {
    const o = r._orig, n = o.porzioni, uno = macroPerPezzo(o);
    return `
    <h3 class="modal-title">${esc(r.nome)}</h3>
    <div class="r-macro"><span class="pill">${r.pasto}</span>${r.preworkout ? `<span class="pill">pre-workout</span>` : ""}${r.tempo ? `<span>${r.tempo}′</span>` : ""}
      <span>1 ${esc(o.pezzo || "porzione")}: <b>${uno.kcal}</b> kcal</span><span>P ${uno.proteine}g</span><span>C ${uno.carboidrati}g</span><span>G ${uno.grassi}g</span>
      ${barraMacroHTML(uno)}</div>
    ${quantitaPastoHTML(r)}
    <h4>Ingredienti <span class="hint-inline">— per ${n} ${esc(plurale(o.pezzo || "porzione"))}</span></h4>
    <ul class="r-ing">${o.ingredienti.map((i, idx) => `<li class="${i.base ? "ing-var" : ""}">${esc(i.nome)} — <strong>${i.unita === "q.b." ? "q.b." : `${String(i.qta).replace(".", ",")} ${i.unita}`}</strong>${["cucchiaio", "cucchiaino"].includes(i.unita) ? ` <span class="crudo">(${Math.round(grammiIng(i))} g)</span>` : ""}${varBtnHTML(r.nome, i, idx)}<div class="var-lista" id="var-${idx}" hidden></div></li>`).join("")}</ul>
    ${suggerimentiLeggeriHTML(r)}
    ${o.passaggi && o.passaggi.length ? `<h4>Procedimento</h4><ol class="r-steps">${o.passaggi.map(p => `<li>${esc(p)}</li>`).join("")}</ol>` : ""}
    <div class="r-azioni">
      <button class="btn-sec" data-modifica="${esc(r.nome)}">✏️ Modifica</button>
      <button class="btn-sec danger" data-elimina="${esc(r.nome)}">🗑 Elimina</button></div>
    ${bottoneAggiungiRicettaHTML(r)}`;
  }
  return `
    <h3 class="modal-title">${esc(nomeConPezzi(r))}</h3>
    <div class="r-macro" id="r-macro">${macroPillsHTML(r)}</div>
    ${!editable ? quantitaPastoHTML(r) : ""}
    <h4>Ingredienti${editable ? '' : ""}</h4>
    <ul class="r-ing">${r.ingredienti.map((i, idx) => ingredienteHTML(i, idx, editable, !editable && !r.adattato ? r.nome : "")).join("")}</ul>
    ${!editable && !r.adattato ? suggerimentiLeggeriHTML(r) : ""}
    ${r.passaggi && r.passaggi.length ? `<h4>Procedimento</h4><ol class="r-steps">${r.passaggi.map(p => `<li>${p}</li>`).join("")}</ol>` : ""}
    ${!editable ? `<div class="r-azioni">
      <button class="btn-sec" data-modifica="${esc(r.nome)}">✏️ Modifica</button>
      <button class="btn-sec danger" data-elimina="${esc(r.nome)}">🗑 Elimina</button></div>${bottoneAggiungiRicettaHTML(r)}` : ""}
  `;
}

// Dispensa base: condimenti/spezie che di solito si hanno sempre in casa
const STAPLE = /olio|\bsale\b|pepe|acqua|aceto|cannella|curry|paprika|cumino|origano|spezie|lime|limone|miele/i;
function parsePantry(str) { return (str || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean); }
// Per una ricetta: quanti ingredienti cercati usa (matched) e quali mancano.
// Gli ingredienti "staple" (olio, sale, spezie…) non contano né come match né come mancanti.
function analizzaDispensa(r, pantry) {
  let matched = 0;
  const mancanti = [];
  r.ingredienti.forEach(ing => {
    const n = ing.nome.toLowerCase();
    if (pantry.some(p => n.includes(p) || p.includes(n) || n.split(/[\s']+/).some(w => typeof paroleVicine === "function" && paroleVicine(p, w)))) { matched++; return; } // usa un ingrediente cercato (anche con un errore di battitura)
    if (STAPLE.test(n)) return; // ingrediente base non cercato: non lo conto come mancante
    mancanti.push(ing.nome);
  });
  return { matched, mancanti };
}
// Se apri "Tutte le ricette" mentre scrivi un pasto, ogni ricetta ha un ＋ per aggiungerla subito a quel pasto
let contestoAgg = null; // { data, pasto, fatte: Set di nomi }
// Calorie e macro: UNO stile solo, ovunque (elenco ricette, suggerimenti, piatti mangiati): kcal, poi P · C · G con i pallini colorati
function macroStileHTML(m, o = {}) {
  const r = (x) => Math.round(+x || 0);
  return `<span class="rr-macro">${o.senzaKcal ? "" : `<b>${r(m.kcal)}</b> kcal`}<i class="dot-p"></i>P ${r(m.proteine)}<i class="dot-c"></i>C ${r(m.carboidrati)}<i class="dot-g"></i>G ${r(m.grassi)}${o.extra ? `<em>${o.extra}</em>` : ""}</span>`;
}
// nell'elenco ricette: per una porzione (o per 1 pezzo, nelle ricette a pezzi) così le confronti a colpo d'occhio
function macroRigaRicettaHTML(r) {
  const m = r._orig ? macroPerPezzo(r._orig) : r;
  return macroStileHTML(m, { extra: `/ ${esc(r._orig ? `1 ${r._orig.pezzo || "porz."}` : "porz.")}` });
}
function rigaRicettaHTML(r, mancanti) {
  let meta;
  if (mancanti === null) meta = r._orig ? `${r.pasto} · fa ${r._orig.porzioni} ${plurale(r._orig.pezzo || "porzione")}` : `${r.pasto}`;
  else if (mancanti.length === 0) meta = `<span class="ok-txt">✓ hai tutto</span> · ${r.pasto}`;
  else meta = `<span class="manca-txt">manca: ${mancanti.join(", ")}</span>`;
  const agg = contestoAgg ? (contestoAgg.fatte.has(r.nome)
    ? `<span class="rr-agg fatto" aria-label="Aggiunta">✓</span>`
    : `<button class="rr-agg" data-agg-ricetta="${esc(r.nome)}" aria-label="Aggiungi al diario">＋</button>`) : "";
  return `<div class="riga-ricetta ${contestoAgg ? "con-agg" : ""}" role="button" tabindex="0" data-ricetta="${slug(r.nome)}" data-nome="${esc(r.nome)}">
    <span class="rr-nome">${r.nome}</span>
    <span class="rr-meta">${meta}</span>
    ${macroRigaRicettaHTML(r)}${agg}
  </div>`;
}
function listaRicetteHTML(filtro, pantry, testo) {
  const ordine = { colazione: 0, pranzo: 1, cena: 2, spuntino: 3 };
  const viste = new Set();
  let lista = ricette.filter(r => {
    if (filtro !== "tutte" && r.pasto !== filtro) return false;
    if (viste.has(r.nome)) return false; // i principali compaiono a pranzo e cena: una volta sola
    viste.add(r.nome);
    return true;
  });

  const quotaP = (r) => { const m = r._orig ? macroPerPezzo(r._orig) : r; return { q: (m.proteine * 4) / Math.max(1, m.kcal), k: m.kcal }; };
  // per aggiungere a un pasto: prima le più proteiche (a parità, meno calorie); nel ricettario: ordine alfabetico
  const perPasto = !!(contestoAgg && !contestoAgg.auto);
  const ordina = (arr) => perPasto
    ? arr.sort((a, b) => { const x = quotaP(a), y = quotaP(b); return (y.q - x.q) || (x.k - y.k) || a.nome.localeCompare(b.nome); })
    : arr.sort((a, b) => a.nome.localeCompare(b.nome));
  if (pantry && pantry.length) {
    // prima le ricette che hanno il nome cercato, poi quelle che usano gli ingredienti cercati (le più fattibili per prime)
    const perNome = ordina(lista.filter(r => nomeCorrisponde(r.nome, testo || pantry.join(" "))));
    const nomi = new Set(perNome.map(r => r.nome));
    const casa = typeof leggiInCasa === "function" ? leggiInCasa() : [];
    const res = lista
      .filter(r => !nomi.has(r.nome))
      .map(r => Object.assign({ r }, analizzaDispensa(r, pantry), { mancanti: analizzaDispensa(r, pantry.concat(casa)).mancanti })) // manca solo ciò che non hai scritto e non hai spuntato nella spesa
      .filter(x => x.matched >= 1) // deve usare almeno un ingrediente cercato
      .sort((a, b) => (a.mancanti.length - b.mancanti.length) || a.r.nome.localeCompare(b.r.nome));
    return perNome.map(r => rigaRicettaHTML(r, null)).join("") + res.map(x => rigaRicettaHTML(x.r, x.mancanti)).join("")
      || `<p class="hint">Nessuna ricetta trovata.</p>`;
  }
  ordina(lista);
  return lista.map(r => rigaRicettaHTML(r, null)).join("") || `<p class="hint">Nessuna ricetta per questo filtro.</p>`;
}

// Rigenera l'elenco ricette con filtro pasto + ingredienti cercati
let filtroRicetteCorr = "tutte";
function aggiornaListaRicette() {
  const pantry = parsePantry(document.getElementById("cerca-ingredienti") ? document.getElementById("cerca-ingredienti").value : "");
  const cont = document.getElementById("lista-ricette");
  if (cont) cont.innerHTML = listaRicetteHTML(filtroRicetteCorr, pantry, document.getElementById("cerca-ingredienti").value);
}

// Ricetta aperta dall'elenco: chiudendola (✕, fuori, Esc) si torna all'elenco com'era (ricerca, filtro e punto dove eri)
let _ricettaDaLista = false, _statoLista = null;
function apriListaRicetteCome() {
  apriListaRicette(true);
  if (!_statoLista) return;
  const inp = document.getElementById("cerca-ingredienti");
  if (inp && _statoLista.q) { inp.value = _statoLista.q; aggiornaListaRicette(); }
  const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = _statoLista.sc || 0;
}
function openModal(html) {
  _ricettaDaLista = false;
  document.getElementById("modal-content").innerHTML = html;
  const m = document.getElementById("modal");
  m.hidden = false;
  document.body.classList.add("no-scroll");
  m.querySelector(".modal-sheet").scrollTop = 0;
}
// Dopo la chiusura di un pannello, su iPhone un tocco può "ripetersi" sulla schermata
// sotto (es. finire su 📊): per mezzo secondo i tocchi fuori dai pannelli si ignorano.
let _chiusoAlle = 0;
document.addEventListener("click", (e) => {
  // (la scelta di un file, es. "Ripristina da un backup", parte subito dopo la chiusura del pannello e non va bloccata)
  if (Date.now() - _chiusoAlle < 500 && !e.target.closest("#modal") && !(e.target.type === "file")) { e.preventDefault(); e.stopPropagation(); }
}, true);
// sezione evidenziata nella barra in basso
function segnaTab(nome) { document.body.dataset.tab = nome || ""; }
function closeModal() {
  if (typeof fermaFotocamera === "function") fermaFotocamera();
  if (typeof sceltaAllen !== "undefined") sceltaAllen = null;
  segnaTab(typeof vistaHome !== "undefined" ? vistaHome : "oggi");
  _chiusoAlle = Date.now();
  document.getElementById("modal").hidden = true;
  document.body.classList.remove("no-scroll");
  editCtx = null;
  if (nuovaRic && nuovaRic === bozzaRic) bozzaStep = wizStep;   // la ricetta nuova a metà resta nella bozza
  nuovaRic = null;
  contestoAgg = null;   // il "dove aggiungere le ricette" non sopravvive alla chiusura del pannello
  if (typeof salvaBozzaAperta === "function") salvaBozzaAperta();   // chiudere con ✕ o toccando fuori salva la bozza del pasto, non la butta
  if (typeof liberoCtx !== "undefined") liberoCtx = null;
  if (typeof ribloccaPasti === "function") ribloccaPasti();   // chiuso il pasto, il lucchetto si rimette da solo
}
// Pannello di conferma dal basso (titolo, nota grigia, «Annulla» rosso e il tasto verde che esegue): per le azioni che cancellano o sostituiscono dati
// Le azioni che cancellano o sovrascrivono dati (Elimina, Togli, Azzera, Ripristina…) hanno il tasto rosso e «Annulla» grigio; le altre il tasto verde e «Annulla» rosso.
const AZIONI_DISTRUTTIVE = /^(elimina|togli|rimuovi|cancella|svuota|azzera|ripristina|sostituisci)/i;
function chiediConferma(titolo, nota, etichettaSi, azione, indietro, verde) {   // verde: forza il tasto verde (e «Annulla» rosso) anche per un'azione che sostituisce dati, es. il ripristino del backup
  const rossa = !verde && AZIONI_DISTRUTTIVE.test(String(etichettaSi).trim());
  openModal(`<h3 class="modal-title">${esc(titolo)}</h3>${nota ? `<p class="hint">${esc(nota)}</p>` : ""}
    <div class="wiz-nav"><button class="btn-sec${rossa ? "" : " danger"}" data-cf-no>Annulla</button><button class="btn${rossa ? " btn-danger" : ""}" data-cf-si>${esc(etichettaSi)}</button></div>`);
  document.querySelector("[data-cf-no]").onclick = () => { if (indietro) indietro(); else closeModal(); };
  document.querySelector("[data-cf-si]").onclick = () => { closeModal(); azione(); };
}

// Apre una ricetta in sola lettura (dall'elenco "Tutte le ricette")
function apriRicetta(nomeOrSlug, daLista) {
  editCtx = null;
  const r = ricette.find(x => x.nome === nomeOrSlug || slug(x.nome) === nomeOrSlug);
  if (r) openModal((daLista ? `<button class="btn-link modal-indietro" data-indietro-lista>‹ Ricette</button>` : "") + ricettaDetailHTML(r, false));
  if (r) _ricettaDaLista = !!daLista;   // dalla lista: freccia per tornarci
}

// Il filtro dell'elenco che corrisponde a un pasto del diario: colazione, pranzo e cena il loro; gli altri momenti (mattina, merenda…) sono spuntini
const filtroPerPasto = (pasto) => ["colazione", "pranzo", "cena", "spuntino"].includes(pasto) ? pasto : "spuntino";
// Apre l'elenco completo con i filtri per pasto
function apriListaRicette(mantieni = false, daPasto = false) {
  editCtx = null;
  const precedente = contestoAgg;
  // se arrivi dall'inserimento di un pasto nel diario, ricordo dove aggiungere le ricette
  contestoAgg = (daPasto && typeof liberoCtx !== "undefined" && liberoCtx && liberoCtx.vivo && liberoCtx.tutteRicette)
    ? { data: liberoCtx.data, pasto: liberoCtx.pasto, fatte: new Set() }
    : (mantieni && precedente ? precedente : { data: dataDiario, pasto: null, fatte: new Set(), auto: true }); // da Altro: ＋ aggiunge al pasto giusto di oggi
  if (typeof liberoCtx !== "undefined") liberoCtx = null;
  if (!mantieni) filtroRicetteCorr = contestoAgg && !contestoAgg.auto && contestoAgg.pasto ? filtroPerPasto(contestoAgg.pasto) : "tutte";   // dal pranzo: già filtrate per pranzo (si può toccare "Tutte"); tornando dalla scheda di una ricetta resta il filtro che avevi scelto
  openModal(`
    ${contestoAgg && !contestoAgg.auto ? `<button class="btn-link torna-pasto" data-agg-torna>‹ Torna al pasto</button>` : ""}
    <h3 class="modal-title">📖 Ricette</h3>
    ${contestoAgg && contestoAgg.auto ? `<button class="btn-link" data-azione="nuova">＋ Ricetta</button>` : ""}
    <input id="cerca-ingredienti" class="qta-input wiz-full" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="🔍 Ricetta o ingredienti" aria-label="Cerca per nome della ricetta o per ingredienti">
    <div class="chips" id="filtri-ricette">
      ${[["tutte", "Tutte"], ["colazione", "Colazione"], ["pranzo", "Pranzo"], ["cena", "Cena"], ["spuntino", "Spuntino"]].map(([f, t]) => `<button class="chip ${filtroRicetteCorr === f ? "attivo" : ""}" data-f="${f}">${t}</button>`).join("")}
    </div>
    <div id="lista-ricette">${listaRicetteHTML(filtroRicetteCorr)}</div>
    <details class="altre-opz"><summary aria-label="Altre opzioni">⋯</summary>
      <button class="btn-sec block" data-azione="scarica">⬇️ Esporta PDF</button>
      <button class="btn-sec block" data-azione="importa">⬆️ Importa CSV</button>
    </details>
  `);
}

// ================== Wizard "Nuova ricetta" ==================
let nuovaRic = null;   // ricetta in costruzione
let wizStep = 0;       // 0=info, 1=ingredienti, 2=procedimento

const PASTI_OPZIONI = [
  ["colazione", "Colazione"], ["pranzo", "Pranzo"], ["cena", "Cena"],
  ["principale", "Pranzo e cena (principale)"], ["spuntino", "Spuntino"],
];
// per scegliere il pasto: bottoni grandi, si vede subito quale è acceso
const PASTI_CHIP = [["colazione", "☕", "Colazione"], ["spuntino", "🍎", "Spuntino"], ["pranzo", "🍽️", "Pranzo"], ["cena", "🌙", "Cena"]];
// i pasti si accendono e si spengono a piacere (anche più di uno: es. pranzo e spuntino); una ricetta nuova parte senza pasto e si sceglie prima di salvare
const pastiRic = (r) => r.pasti && r.pasti.length ? r.pasti : (r.pasto === "principale" ? ["pranzo", "cena"] : [r.pasto || "pranzo"]);
const pastoAcceso = (r, v) => (r.pasti || []).includes(v);
function scegliPasto(r, v) {
  const sel = new Set(r.pasti || []);
  if (sel.has(v)) sel.delete(v); else sel.add(v);
  r.pasti = PASTI_CHIP.map(x => x[0]).filter(x => sel.has(x));
  r.pasto = r.pasti[0] || "";
}
const pastoValido = (r) => (r.pasti || []).some(p => PASTI_CHIP.some(x => x[0] === p));

// La ricetta nuova lasciata a metà (pannello chiuso toccando fuori, ✕ o Esc) resta qui: riaprendo "Nuova ricetta" si riprende da dove eri.
// Si butta solo dopo il salvataggio o con «Annulla».
let bozzaRic = null, bozzaStep = 0;
function apriWizard() {
  editCtx = null;
  if (!bozzaRic) { bozzaRic = { nome: "", pasto: "", pasti: [], tempo: 15, porzioni: 1, pezzo: "", ingredienti: [], passaggi: [""] }; bozzaStep = 0; }
  nuovaRic = bozzaRic;   // stesso oggetto: quello che scrivi resta nella bozza
  wizStep = bozzaStep;
  openModal(wizardHTML());
}
function annullaWizard() {
  if (nuovaRic && !nuovaRic.originale) { bozzaRic = null; bozzaStep = 0; }
  nuovaRic = null;
  closeModal();
}

// Apre il wizard precompilato per modificare una ricetta esistente (base o tua)
function apriWizardModifica(nome) {
  const stesse = ricette.filter(r => r.nome === nome);
  if (!stesse.length) return;
  const r = stesse[0]._orig || stesse[0]; // per le ricette a porzioni: quella intera
  const pasti = new Set(stesse.map(x => x.pasto));
  editCtx = null;
  nuovaRic = {
    originale: nome,
    nome: r.nome,
    pasto: r.pasto === "principale" ? "pranzo" : r.pasto,
    pasti: PASTI_CHIP.map(x => x[0]).filter(x => pasti.has(x) || (pasti.has("principale") && (x === "pranzo" || x === "cena"))),
    tempo: r.tempo || 15,
    porzioni: r.porzioni || 1,
    pezzo: r.pezzo || "",
    ingredienti: clone(r.ingredienti).map(i => { if (i.base) { Object.assign(i, i.base); delete i.base; } return i; }),   // si modifica la ricetta com'è, non la variante scelta
    passaggi: (r.passaggi && r.passaggi.length) ? r.passaggi.slice() : [""],
  };
  wizStep = 0;
  openModal(wizardHTML());
}

// Riepilogo macro calcolati dagli ingredienti (in tempo reale)
function macroRigaHTML(r) {
  const m = calcolaMacro(r);
  const n = Math.max(1, Math.round(+r.porzioni || 1));
  const ignoti = r.ingredienti.filter(i => !i.nome && i.cercato).length;
  const per = (v) => Math.round(v / n);
  return `<div class="wiz-macro" id="wiz-macro">
    ${n > 1 ? `<div>1 ${esc(r.pezzo || "porzione")}: <strong>${per(m.kcal)}</strong> kcal · P ${per(m.proteine)}g · C ${per(m.carboidrati)}g · G ${per(m.grassi)}g</div>
      <small>Ricetta intera (${n} ${esc(plurale(r.pezzo || "porzione"))}): ${m.kcal} kcal</small>`
    : `<strong>${m.kcal}</strong> kcal · P ${m.proteine}g · C ${m.carboidrati}g · G ${m.grassi}g`}
    ${ignoti ? `<small class="manca-txt">${ignoti} ingrediente/i non riconosciuti: non contano nelle kcal</small>` : ""}</div>`;
}

// Nuova ricetta / modifica: tutto in una pagina, un solo "Salva"
function wizardHTML() {
  const r = nuovaRic;
  const righe = r.ingredienti.map((ing, i) => {
    const nomeHTML = `<input class="qta-input ing-n ${ing.nome || !ing.cercato ? "" : "sconosciuto"}${ing._errore ? " et-errore" : ""}" autocomplete="off" autocorrect="off" spellcheck="false" data-ing="${i}" data-k="nome" value="${esc(ing.nome || ing.cercato || "")}" placeholder="ingrediente" aria-label="Ingrediente">`;
    const ignoto = !ing.nome && ing.cercato ? `<div class="wiz-ignoto">
        <span>⚠ Non conosco “${esc(ing.cercato)}”: scrivi i valori dall'etichetta</span>
        <div class="etic-box">${campiEtichettaHTML(`etic-ing-${i}`)}</div>
        <button class="btn-link" data-wiz="nuovo-al" data-idx="${i}">Salva alimento</button></div>` : "";
    const altHTML = ing.nome ? `<div class="wiz-alt"><span>${(ing.alt || []).length ? "oppure" : ""}</span>${(ing.alt || []).map((x, k) => `<button class="chip-alt" data-wiz="del-alt" data-idx="${i}" data-k="${k}" aria-label="Togli ${esc(x)}">${esc(x)} ✕</button>`).join("")}${ing._nuovaAlt ? `<input class="qta-input wiz-alt-in" list="dl-ali" data-alt-new="${i}" placeholder="es. farina di riso" autocomplete="off" autocorrect="off" spellcheck="false">` : `<button class="btn-link" data-wiz="add-alt" data-idx="${i}">＋ variante</button>`}</div>` : "";
    // il contenitore dello swipe (.sw) è già nell'HTML: così swipe.js non sposta la riga e il campo appena aperto resta col cursore (e la tastiera)
    return `<div class="sw"><div class="wiz-ing ${ing.nome || !ing.cercato ? "" : "da-fare"}${ing._errore ? " wiz-errore" : ""}">
        ${nomeHTML}
        <input class="qta-input ing-q" type="number" inputmode="decimal" min="0" step="any" data-ing="${i}" data-k="qta" value="${ing.unita === "q.b." || !ing.qta ? "" : ing.qta}" ${ing.unita === "q.b." ? "disabled" : ""} aria-label="Quantità">
        <select class="qta-input ing-u" data-ing="${i}" data-k="unita" aria-label="Unità">
          ${UNITA.map(u => `<option ${ing.unita === u ? "selected" : ""}>${u}</option>`).join("")}
        </select>
        <button class="lib-del" data-wiz="del-ing" data-idx="${i}" aria-label="Rimuovi">${ICONA_CESTINO}</button>
        <div class="wiz-sub"><span class="ing-kcal">${ing.nome && ing.unita !== "q.b." ? `${Math.round(kcalIng(ing))} kcal${!["g", "ml"].includes(ing.unita) ? ` · ${Math.round(grammiIng(ing))} g` : ""}` : ""}</span>${altHTML}</div>
      </div></div>${ignoto}`;
  }).join("");
  return `
    ${r.originale ? `<button class="modal-trash" data-elimina="${esc(r.originale)}" aria-label="Elimina ricetta" title="Elimina ricetta">🗑</button>` : ""}
    <h3 class="modal-title">${r.originale ? "✏️ Modifica ricetta" : "➕ Nuova ricetta"}</h3>
    <label class="btn-sec block wiz-foto wiz-foto-tutto">📷 Importa da foto<input type="file" accept="image/*" multiple hidden data-foto="tutto"></label>
    <div class="foto-stato" id="foto-stato-tutto"></div>

    <div class="wiz-sez">
      <div class="wiz-sez-t">Nome</div>
      <input class="qta-input wiz-full wiz-titolo" data-campo="nome" value="${esc(r.nome)}" placeholder="es. Pancake proteici" autocomplete="off">
    </div>

    <div class="wiz-sez">
      <div class="wiz-sez-t">Pasto</div>
      <div class="wiz-pasti" role="group" aria-label="Pasto">
        ${PASTI_CHIP.map(([v, ico, l]) => `<button type="button" class="wiz-pasto ${pastoAcceso(r, v) ? "on" : ""}" aria-pressed="${pastoAcceso(r, v)}" data-wiz="pasto" data-idx="${v}"><span class="wp-ico">${ico}</span><span>${l}</span></button>`).join("")}
      </div>
    </div>

    <div class="wiz-sez">
      <div class="wiz-riga wiz-extra">
        <label class="wiz-pill"><span class="wiz-pill-i">⏱</span><input class="qta-input" type="number" inputmode="numeric" min="1" data-campo="tempo" value="${r.tempo}" aria-label="Minuti"><span>min</span></label>
        <label class="wiz-pill"><span class="wiz-pill-i">🍽</span><input class="qta-input" type="number" inputmode="numeric" min="1" step="1" data-campo="porzioni" value="${r.porzioni || 1}" aria-label="Porzioni"><span>${(+r.porzioni || 1) > 1 ? "porzioni" : "porzione"}</span></label>
        ${(+r.porzioni || 1) > 1 ? `<input class="qta-input wiz-pezzo" data-campo="pezzo" value="${esc(r.pezzo || "")}" placeholder="es. pancake" aria-label="Come si chiamano le porzioni">` : ""}
      </div>
    </div>

    <div class="wiz-sez">
      <div class="wiz-sez-t">Ingredienti</div>
      ${righe ? `<div class="wiz-ings">${righe}</div>` : ""}
      <button class="btn-link" data-wiz="add-ing">＋ Ingrediente</button>
      <div class="foto-stato" id="foto-stato-ing"></div>
    </div>

    <div class="wiz-sez">
      <div class="wiz-sez-t">Procedimento <span class="hint-inline">facoltativo</span></div>
      <div class="wiz-steps-list">
        ${r.passaggi.map((p, i) => `<div class="wiz-step">
          <span class="wiz-num">${i + 1}</span>
          <textarea class="qta-input wiz-ta" data-step="${i}" placeholder="descrivi il passaggio…">${esc(p)}</textarea>
          <button class="lib-del" data-wiz="del-step" data-idx="${i}" aria-label="Rimuovi">${ICONA_CESTINO}</button>
        </div>`).join("")}
      </div>
      <button class="btn-link" data-wiz="add-step">＋ Passaggio</button>
      <div class="foto-stato" id="foto-stato-proc"></div>
    </div>

    <datalist id="dl-ali">${Object.keys(window.ALIMENTI || {}).map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="wiz-fondo">${macroRigaHTML(r)}<button class="btn block wiz-salva" data-wiz="save">✓ Salva ricetta</button>${r.originale ? "" : `<button class="btn-link wiz-annulla" data-wiz="annulla">Annulla</button>`}</div>`;
}

// Ridisegna il wizard conservando lo scroll (per add/del riga e navigazione)
function renderWizard() {
  const sheet = document.querySelector(".modal-sheet");
  const sc = sheet ? sheet.scrollTop : 0;
  document.getElementById("modal-content").innerHTML = wizardHTML();
  const s2 = document.querySelector(".modal-sheet");
  if (s2) s2.scrollTop = sc;
}
function aggiornaMacroLive() {
  const el = document.getElementById("wiz-macro");
  if (el && nuovaRic) el.outerHTML = macroRigaHTML(nuovaRic);
}

function salvaNuovaRicetta() {
  const r = nuovaRic;
  r.nome = (r.nome || "").trim();
  if (!r.nome) { avviso("Dai un nome alla ricetta."); return; }
  const senzaQ = r.ingredienti.findIndex(i => i.nome && (window.ALIMENTI || {})[i.nome] && i.unita !== "q.b." && !(+i.qta > 0));
  if (senzaQ >= 0) {      // un ingrediente senza quantità: si fa vedere quale
    avviso(`Manca la quantità: ${r.ingredienti[senzaQ].nome}`);
    const q = document.querySelector(`[data-ing="${senzaQ}"][data-k="qta"]`); if (q) { q.scrollIntoView({ block: "center" }); q.focus(); }
    return;
  }
  // un ingrediente che non conosco non si butta in silenzio: si chiede di scrivere i valori o di toglierlo
  r.ingredienti.forEach(i => { delete i._errore; });
  const ignoto = r.ingredienti.findIndex(i => !(i.nome && (window.ALIMENTI || {})[i.nome]) && ((i.cercato || i.nome || "").trim()));
  if (ignoto >= 0) {
    const x = r.ingredienti[ignoto], nomeX = (x.cercato || x.nome).trim();
    x._errore = true;
    renderWizard();
    avviso(`${nomeX.charAt(0).toUpperCase() + nomeX.slice(1)}: inserisci i valori o toglilo`);
    const riga = document.querySelector(`[data-ing="${ignoto}"][data-k="nome"]`); if (riga) riga.scrollIntoView({ block: "center" });
    return;
  }
  if (!pastoValido(r)) { avviso("Scegli per quale pasto è"); const p = document.querySelector(".wiz-pasti"); if (p) p.scrollIntoView({ block: "center" }); return; }
  r.ingredienti = r.ingredienti.filter(i => i.nome && i.nome.trim() && (window.ALIMENTI || {})[i.nome]);   // restano fuori solo le righe vuote
  const noti = r.ingredienti.filter(i => (window.ALIMENTI || {})[i.nome]);
  if (noti.length === 0) { avviso("Aggiungi almeno un ingrediente riconosciuto per calcolare le kcal."); return; }
  r.passaggi = r.passaggi.map(p => p.trim()).filter(Boolean);
  const m = calcolaMacro(r);
  const nomeC = new Set(ricette.map(x => x.nome).filter(n => n !== r.originale));
  if (nomeC.has(r.nome)) { avviso("Esiste già una ricetta con questo nome. Cambialo."); return; }

  const base = { nome: r.nome, tempo: +r.tempo || null, custom: true,
    kcal: m.kcal, proteine: m.proteine, carboidrati: m.carboidrati, grassi: m.grassi,
    ingredienti: r.ingredienti.map(i => Object.assign({ nome: i.nome, qta: +i.qta || 0, unita: i.unita }, i.alt && i.alt.length ? { alt: i.alt.slice(0, 6) } : {})),
    passaggi: r.passaggi };
  const n = Math.max(1, Math.round(+r.porzioni || 1));
  if (n > 1) { base.porzioni = n; base.pezzo = (r.pezzo || "").trim() || ""; }
  const pasti = pastiRic(r);
  let custom = leggiCustom();
  if (r.originale) {
    // Modifica: la versione precedente viene sostituita (le ricette di base vengono nascoste)
    if (custom.some(x => x.nome === r.originale)) custom = custom.filter(x => x.nome !== r.originale);
    else { const n = leggiNascoste(); n.add(r.originale); salvaNascoste(n); }
  }
  pasti.forEach(p => custom.push(Object.assign({}, base, { pasto: p, ingredienti: clone(base.ingredienti), passaggi: base.passaggi.slice() })));
  salvaCustom(custom);
  if (r.originale) aggiornaVariantiRicetta(r.originale, r.nome, base.ingredienti);   // varianti di ingredienti tolti: via
  caricaRicette();
  if (!r.originale) { bozzaRic = null; bozzaStep = 0; }   // salvata: la bozza non serve più
  nuovaRic = null;
  closeModal();
  const nomeSalvata = r.nome;
  avviso(`✓ Ricetta salvata · ${n > 1 ? `${Math.round(m.kcal / n)} kcal a ${base.pezzo || "porzione"}` : `${m.kcal} kcal`}`, "Vedi ›", () => apriRicetta(nomeSalvata), true);   // toccando il banner si apre la ricetta
}

// «Più fit» scelto nell'anteprima: la ricetta diventa la tua versione fit (stesso nome), così le volte dopo te la propone già così.
// mosse: [{tipo:"cambia", nome, a} | {tipo:"porta", nome, fattore}] riferite agli ingredienti per nome. Restituisce una funzione per annullare.
function rendiRicettaFit(nome, mosse) {
  const versioni = ricette.filter(x => x.nome === nome); if (!versioni.length || !mosse.length) return null;
  const o = clone(versioni[0]._orig || versioni[0]);
  o.ingredienti = (o.ingredienti || []).map(i => {
    const m = mosse.find(x => x.nome === i.nome); if (!m) return i;
    if (m.tipo === "cambia") return Object.assign({}, i, { nome: m.a, cercato: m.a });
    return Object.assign({}, i, { qta: Math.max(1, Math.round((+i.qta || 0) * m.fattore)) });
  });
  const primaC = JSON.stringify(leggiCustom()), primaN = JSON.stringify([...leggiNascoste()]);
  const m = calcolaMacro(o), pasti = [...new Set(versioni.map(x => x.pasto))];
  const base = Object.assign({}, o, { custom: true, kcal: m.kcal, proteine: m.proteine, carboidrati: m.carboidrati, grassi: m.grassi });
  delete base._orig;
  let custom = leggiCustom();
  if (custom.some(x => x.nome === nome)) custom = custom.filter(x => x.nome !== nome);
  else { const n = leggiNascoste(); n.add(nome); salvaNascoste(n); }   // la ricetta di base si nasconde: al suo posto la tua versione fit
  pasti.forEach(p => custom.push(Object.assign(clone(base), { pasto: p })));
  salvaCustom(custom); caricaRicette();
  return () => { localStorage.setItem("mp_ricette_custom", primaC); localStorage.setItem("mp_ricette_nascoste", primaN); caricaRicette(); };
}

// Elimina una ricetta (per nome): le tue vengono cancellate, quelle del
// ricettario di base vengono nascoste.
function eliminaRicetta(nome) {
  const custom = leggiCustom();
  const primaC = JSON.stringify(custom), primaN = JSON.stringify([...leggiNascoste()]);
  if (custom.some(r => r.nome === nome)) salvaCustom(custom.filter(r => r.nome !== nome));
  else { const n = leggiNascoste(); n.add(nome); salvaNascoste(n); }
  caricaRicette();
  apriListaRicette(true);
  avviso(`"${nome}" eliminata`, "Annulla", () => {
    localStorage.setItem("mp_ricette_custom", primaC);
    localStorage.setItem("mp_ricette_nascoste", primaN);
    caricaRicette();
    if (!document.getElementById("modal").hidden && document.getElementById("lista-ricette")) aggiornaListaRicette();
  });
}

// Gli ingredienti scritti o incollati diventano righe della ricetta (anche senza premere "Riconosci")
function leggiIngredientiIncollati() {
  const ta = document.getElementById("wiz-incolla");
  if (!ta || !ta.value.trim()) return;
  const nuove = String(ta.value).split(/\n|;/).map(leggiRigaIngrediente).filter(Boolean);
  nuovaRic.ingredienti = nuovaRic.ingredienti.filter(i => i.nome || i.cercato).concat(nuove);
  ta.value = "";
}
// Azioni dei pulsanti del wizard
function azioneWizard(a, idx, k) {
  if (!nuovaRic) return;
  if (a === "next") { wizStep = Math.min(2, wizStep + 1); renderWizard(); }
  else if (a === "prev") { wizStep = Math.max(0, wizStep - 1); renderWizard(); }
  else if (a === "save") { leggiIngredientiIncollati(); salvaNuovaRicetta(); } // niente "Riconosci" obbligatorio: si riconoscono da soli
  else if (a === "annulla") annullaWizard();   // butta la bozza della ricetta nuova
  else if (a === "leggi") { leggiIngredientiIncollati(); renderWizard(); }
  else if (a === "add-ing") {      // una riga vuota: scrivi il nome e compaiono le opzioni
    leggiIngredientiIncollati();
    nuovaRic.ingredienti.push({ nome: "", cercato: "", qta: 0, unita: "g" });
    renderWizard();
    const ns = document.querySelectorAll(".wiz-ing .ing-n"); if (ns.length) ns[ns.length - 1].focus();
  }
  else if (a === "del-ing") { nuovaRic.ingredienti.splice(+idx, 1); renderWizard(); }
  else if (a === "nuovo-al") {
    // alimento sconosciuto: salva i valori per 100 g e lo usa subito
    const ing = nuovaRic.ingredienti[+idx];
    const et = leggiCampiEtichetta(`etic-ing-${idx}`);
    if (et && et.errore) { avviso(et.errore); return; }
    if (!et || !et.base4[0]) { avviso("Inserisci almeno le kcal."); return; }
    if (!verificaEtichetta(`etic-ing-${idx}`, document.querySelector(`[data-wiz="nuovo-al"][data-idx="${idx}"]`), et)) return;
    const nome = ing.cercato.charAt(0).toUpperCase() + ing.cercato.slice(1);
    salvaAlimentoPersonale(nome, et.base4, et.extra4, et.pesoPz);
    ing.nome = nome; delete ing._errore;
    renderWizard();
  }
  else if (a === "pasto") { leggiIngredientiIncollati(); scegliPasto(nuovaRic, idx); renderWizard(); }
  else if (a === "add-alt") { nuovaRic.ingredienti[+idx]._nuovaAlt = true; renderWizard(); const inp = document.querySelector("[data-alt-new]"); if (inp) inp.focus(); }
  else if (a === "del-alt") { const ing = nuovaRic.ingredienti[+idx]; if (ing && ing.alt) { ing.alt.splice(+k, 1); if (!ing.alt.length) delete ing.alt; } renderWizard(); }
  else if (a === "add-step") { nuovaRic.passaggi.push(""); renderWizard(); }
  else if (a === "del-step") { nuovaRic.passaggi.splice(+idx, 1); if (!nuovaRic.passaggi.length) nuovaRic.passaggi.push(""); renderWizard(); }
}

// Il nome scritto è quasi uguale a quello trovato (maiuscole, o un errore di battitura: "banna" → Banana)? Solo allora si sostituisce da solo
function quasiUguale(a, b) {
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  if (typeof PREFERITI !== "undefined" && typeof norm === "function" && PREFERITI[norm(a)] === b) return true;   // un sinonimo noto: "olio extravergine di oliva" = Olio EVO
  return typeof distanzaTesto === "function" && typeof norm === "function" && a.length >= 4 && distanzaTesto(norm(a), norm(b)) <= 2;
}
// Mentre scrivi un ingrediente ("for…") compaiono subito gli alimenti che corrispondono
function wizSuggerisci(inp, soloAlternative) {
  const old = document.getElementById("wiz-sug"); if (old) old.remove();
  const x = nuovaRic && nuovaRic.ingredienti[+inp.dataset.ing];
  if (!x || typeof cercaAlimenti !== "function") return;
  const q = soloAlternative ? (x.cercato || "") : inp.value.trim();
  const lista = q ? cercaAlimenti(q).filter(n => n !== x.nome && !(typeof PIATTI_PRONTI !== "undefined" && PIATTI_PRONTI.has(n))).slice(0, 6) : [];      // in una ricetta solo alimenti singoli
  if (!lista.length) return;
  const box = document.createElement("div");
  box.id = "wiz-sug"; box.className = "wiz-sug";
  box.innerHTML = lista.map(n => `<button type="button" class="autoc-voce" data-wiz-sug="${esc(n)}" data-ing="${inp.dataset.ing}">${esc(n)}</button>`).join("");
  inp.closest(".wiz-ing").after(box);
}

// Aggiorna lo stato della ricetta in costruzione mentre l'utente digita
function wizFieldUpdate(e) {
  if (!nuovaRic || !document.querySelector("#modal-content .wiz-salva")) return;   // solo dentro il pannello della ricetta
  const campo = e.target.closest("[data-campo]");
  if (campo) {
    const k = campo.dataset.campo;
    nuovaRic[k] = (k === "tempo" || k === "porzioni") ? +campo.value : campo.value;
    if (k === "porzioni" && e.type === "change") { renderWizard(); return; }   // da 1 porzione a più: compare il nome (es. pancake)
    if (k === "porzioni" || k === "pezzo") aggiornaMacroLive();
    return;
  }
  const ing = e.target.closest("[data-ing]");
  if (ing) {
    const i = +ing.dataset.ing, k = ing.dataset.k, x = nuovaRic.ingredienti[i];
    if (!x) return;   // la riga non c'è più (es. cancellata o ridisegnata dopo una lettura da foto)
    if (k === "qta") { x.qta = parseFloat(String(ing.value).replace(",", ".")) || 0; if (e.type === "change") { renderWizard(); return; } }
    else if (k === "alt") x.nome = ing.value;
    else if (k === "unita") { x.unita = ing.value; if (e.type === "change") { renderWizard(); return; } }
    else if (k === "nome") {
      if (e.type === "input") { wizSuggerisci(ing); return; }   // intanto compaiono le opzioni
      if (e.type !== "change") return; // si riconosce quando hai finito di scrivere
      const v = ing.value.trim();
      delete x._errore;
      if ((window.ALIMENTI || {})[v]) { x.nome = v; x.cercato = ""; }
      else { const t = cercaAlimenti(v); x.cercato = v; x.nome = quasiUguale(v, t[0]) ? t[0] : ""; }   // "farina di castagne" non diventa "Farina 00": restano i suggerimenti e i valori da scrivere
      renderWizard(); return;
    }
    aggiornaMacroLive();
    return;
  }
  const an = e.target.closest("[data-alt-new]");
  if (an) {
    if (e.type !== "change") return;
    const ing = nuovaRic.ingredienti[+an.dataset.altNew], v = an.value.trim();
    if (!ing) return;
    const nome = (window.ALIMENTI || {})[v] ? v : (typeof cercaAlimenti === "function" ? cercaAlimenti(v)[0] : "");
    delete ing._nuovaAlt;
    if (nome && nome !== ing.nome && !(ing.alt || []).includes(nome)) ing.alt = (ing.alt || []).concat(nome);
    else if (v && !nome) avviso("Non conosco “" + v + "”.");
    renderWizard(); return;
  }
  const step = e.target.closest("[data-step]");
  if (step) { nuovaRic.passaggi[+step.dataset.step] = step.value; return; }
}

// Numero di ricette uniche (i principali valgono pranzo e cena: contano una volta)
function contaRicetteUniche() { return new Set(ricette.map(r => r.nome)).size; }

// Menù impostazioni (calorie per tipo di giornata + gestione ricettario)
function apriMenu() {
  editCtx = null;
  const voce = (az, icona, titolo, sotto, azione) => `<button class="menu-voce" data-azione="${az}">
    <span class="mv-icona">${icona}</span><span class="mv-testo"><b>${titolo}</b>${sotto ? `<small>${sotto}</small>` : ""}</span>${azione ? "" : `<span class="mv-freccia">›</span>`}</button>`;   // › = apre un altro pannello; senza freccia = fa subito la cosa
  openModal(`
    <h3 class="modal-title">Altro</h3>
    <div class="menu-lista">
      ${voce("vai-spesa", "🛒", "Lista della spesa", "")}
      ${voce("vai-ricette", "📖", "Ricette", `${contaRicetteUniche()}`)}
      ${voce("miei-alimenti", "🥫", "I miei alimenti", `${Object.keys(alimentiTuoi()).length || ""}`)}
      ${voce("profilo", "👤", "Profilo", "")}
      ${voce("backup", "💾", "Backup", "")}
    </div>
  `);
}
function apriBackup() {
  editCtx = null;
  openModal(`
    <h3 class="modal-title">💾 Backup</h3>
    <button class="btn block" data-azione="esporta">💾 Salva</button>
    <button class="btn-sec block" data-azione="ripristina">↺ Ripristina</button>
  `);
}

// ================== Profilo ==================
// icone tra cui scegliere per un nuovo sport
const ICONE_SPORT = ["🏃‍♀️", "🚴‍♀️", "🏊‍♀️", "🧘‍♀️", "🎾", "🏸", "🏐", "⛷️", "🏄‍♀️", "🥾", "🤸‍♀️", "🥊", "💃", "⛵", "🧗‍♀️", "🏋️", "🐴", "🪁"];
const CAMPI_PROFILO = [
  ["peso", "Peso (kg)", 0.1], ["bmr", "Basale (kcal)", 10],
  ["deficit", "Deficit (%)", 1],
  ["recupero", "Allenamento reintegrato (%)", 5, "% delle calorie dell'allenamento che puoi mangiare (100% = tutte)"],
  ["protKg", "Proteine (g/kg)", 0.1], ["grassiKg", "Grassi (g/kg)", 0.1],
];
// Perdita di peso attesa a settimana con la settimana tipo attuale (7700 kcal ≈ 1 kg)
function perditaSettimanale() {
  const deficit = leggiTipi().reduce((s, t) => s + TIPI_GIORNATA[t].fabbisogno - TIPI_GIORNATA[t].target.kcal, 0);
  return deficit / 7700;
}
// Riassunto degli obiettivi: una riga (media della settimana tipo e kg a settimana) e una tabellina
// con i soli tipi di giornata della settimana tipo (+ Riposo), non una scheda per ogni sport
function anteprimaProfiloHTML() {
  const tipi = leggiTipi().map(t => VECCHI_TIPI[t] || t || "riposo");
  const media = Math.round(tipi.reduce((s, t) => s + TIPI_GIORNATA[t].target.kcal, 0) / tipi.length / 10) * 10;
  const kg = perditaSettimanale(), kgTxt = `${kg >= 0 ? "−" : "+"}${Math.abs(kg).toFixed(2).replace(".", ",")} kg a settimana`;
  const chiavi = [...new Set(tipi)]; if (!chiavi.includes("riposo")) chiavi.push("riposo");
  const quanti = (k) => tipi.filter(t => t === k).length;
  return `<p class="pf-riassunto">Con questi dati: in media <b>${media} kcal</b> al giorno · <b>${kgTxt}</b></p>
    <table class="pf-tabella"><thead><tr><th>Giornata</th><th>kcal</th><th>P</th><th>C</th><th>G</th></tr></thead><tbody>
    ${chiavi.map(k => { const tg = TIPI_GIORNATA[k], t = tg.target, n = quanti(k);
      return `<tr><td><span class="pf-ico">${tg.icone}</span> ${esc(tg.label)}${n ? ` <em>×${n}</em>` : ""}</td><td><b>${t.kcal}</b></td><td>${t.proteine}</td><td>${t.carboidrati}</td><td>${t.grassi}</td></tr>`; }).join("")}
    </tbody></table>
    <p class="hint">P, C, G in grammi · ×N = quante volte a settimana nella settimana tipo</p>`;
}
function apriProfilo() {
  editCtx = null;
  const pf = leggiProfilo();
  openModal(`
    <h3 class="modal-title">👤 Profilo</h3>
    <div id="form-profilo">
      ${CAMPI_PROFILO.map(([k, l, st, nota]) => `<label class="wiz-l">${l}</label>${nota ? `<p class="campo-nota">${nota}</p>` : ""}
        <input class="qta-input wiz-full" type="number" inputmode="decimal" step="${st}" min="0" data-profilo="${k}" value="${pf[k]}">${k === "bmr" ? `
        <button class="btn-link bmr-link" data-bmr-apri>Non lo sai? Calcolalo ›</button><div id="bmr-calc" hidden></div>` : ""}`).join("")}
    </div>
    <h4>I tuoi sport</h4>
    <div class="sport-lista">${pf.sport.filter(sp => !sp.nascosto).map(sp => `<div class="sport-riga">
        <span class="sr-ico">${sp.icona}</span><span class="sr-nome">${esc(sp.nome)}</span>
        <input class="qta-input sr-dur" type="text" inputmode="decimal" autocomplete="off" data-sport-dur="${sp.id}" value="${sp.perKm ? fmtKm(sp.km || 5) : (sp.min || 60)}"><em>${sp.perKm ? "km" : "min"}</em><em class="sr-kcal">≈ ${kcalSport(sp, 0, pf)} kcal</em>
        <button class="lib-del" data-sport-del="${sp.id}" aria-label="Togli ${esc(sp.nome)}">${ICONA_CESTINO}</button></div>`).join("")}
      <div class="sport-riga nuovo">
        <select class="qta-input sr-ico-sel" id="nuovo-sport-icona" aria-label="Icona">${ICONE_SPORT.map(i => `<option>${i}</option>`).join("")}</select>
        <input class="qta-input sr-nome-in" id="nuovo-sport-nome" placeholder="Nuovo sport, es. Padel">
        <select class="qta-input sr-int-sel" id="nuovo-sport-intensita" aria-label="Intensità">${INTENSITA_SPORT.map(([k, l, v]) => `<option value="${v}" ${k === "media" ? "selected" : ""}>${l} · ~${Math.round(v * pf.peso * 10) / 10} kcal/min</option>`).join("")}</select>
        <button class="btn lib-piu" data-azione="sport-aggiungi" aria-label="Aggiungi sport">＋</button></div>
    </div>
    <h4>La tua settimana tipo</h4>
    <div class="sett-tipo">${["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"].map((n, i) => { const t = TIPI_GIORNATA[leggiTipi()[i]]; return `<div class="st-riga"><span>${n}</span>
      <button class="tipo-btn" data-scegli-allen-sett="${i}">${tipoSportHTML(t)} <span class="caret">▾</span></button></div>`; }).join("")}</div>
    <h4>Obiettivi che ne risultano</h4>
    <div id="anteprima-profilo">${anteprimaProfiloHTML()}</div>
`);
}
// ridisegna il profilo restando allo stesso punto della pagina
// (sc: la posizione da ritrovare, se il profilo era già stato chiuso, es. da una richiesta di conferma)
function riapriProfilo(sc) {
  const sheet = document.querySelector(".modal-sheet");
  if (typeof sc !== "number") sc = sheet ? sheet.scrollTop : 0;
  apriProfilo();
  const s2 = document.querySelector(".modal-sheet"); if (s2) s2.scrollTop = sc;
}
function leggiFormProfilo() {
  const pf = leggiProfilo();
  document.querySelectorAll("[data-profilo]").forEach(inp => {
    const v = parseFloat(String(inp.value).replace(",", "."));
    const k = inp.dataset.profilo, puoZero = k === "deficit" || k === "recupero";   // deficit e reintegro possono essere 0 (mantenimento, niente kcal dall'allenamento); mai negativi
    if (!isNaN(v) && (v > 0 || (puoZero && v === 0))) pf[k] = v;
  });
  return pf;
}
// Il profilo si salva mentre lo modifichi: obiettivi, diario e piano si aggiornano
let _profiloTimer = null;
function aggiornaAnteprimaProfilo() {
  salvaProfilo(leggiFormProfilo());
  document.getElementById("anteprima-profilo").innerHTML = anteprimaProfiloHTML();
  if (typeof renderOggi === "function") renderOggi();

}
function salvaProfiloForm() {
  salvaProfilo(leggiFormProfilo());
  closeModal();

  if (typeof renderOggi === "function") renderOggi();
}

// ===== Calcolo del basale (Mifflin-St Jeor) dal Profilo: sesso, età, altezza e il peso del campo Peso =====
// donna: 10·kg + 6,25·cm − 5·età − 161 · uomo: stessa formula + 5. Sesso, età e altezza si ricordano nel profilo.
function pesoDelForm() {
  const inp = document.querySelector('[data-profilo="peso"]'), v = inp ? parseFloat(String(inp.value).replace(",", ".")) : NaN;
  return v > 0 ? v : leggiProfilo().peso;
}
function basaleCalcolato() {
  const box = document.getElementById("bmr-calc"); if (!box) return null;
  const uomo = !!box.querySelector('input[value="uomo"]:checked');
  const num = (k) => parseFloat(String((box.querySelector(`[data-bmr="${k}"]`) || {}).value || "").replace(",", "."));
  const eta = num("eta"), cm = num("altezza"), kg = pesoDelForm();
  if (!(eta >= 10 && eta <= 100 && cm >= 100 && cm <= 230 && kg > 0)) return { uomo, eta, cm, kg, kcal: 0 };
  return { uomo, eta, cm, kg, kcal: Math.round((10 * kg + 6.25 * cm - 5 * eta + (uomo ? 5 : -161)) / 10) * 10 };
}
function bmrCalcHTML() {
  const pf = leggiProfilo(), uomo = pf.sesso === "uomo";
  return `<div class="bmr-calc">
    <div class="et-seg">
      <input type="radio" name="bmr-sesso" id="bmr-donna" value="donna"${uomo ? "" : " checked"}><label for="bmr-donna">Donna</label>
      <input type="radio" name="bmr-sesso" id="bmr-uomo" value="uomo"${uomo ? " checked" : ""}><label for="bmr-uomo">Uomo</label>
    </div>
    <div class="bmr-griglia">
      <label class="et-campo"><span>Età (anni)</span><input class="qta-input" type="number" inputmode="numeric" min="10" max="100" step="1" data-bmr="eta" placeholder="es. 30"${pf.eta ? ` value="${pf.eta}"` : ""}></label>
      <label class="et-campo"><span>Altezza (cm)</span><input class="qta-input" type="number" inputmode="numeric" min="100" max="230" step="1" data-bmr="altezza" placeholder="es. 165"${pf.altezza ? ` value="${pf.altezza}"` : ""}></label>
    </div>
    <p class="bmr-ris" id="bmr-ris"></p>
    <div class="wiz-nav"><button class="btn-sec" data-bmr-chiudi>Annulla</button><button class="btn" data-bmr-usa>Usa questo valore</button></div>
  </div>`;
}
function aggiornaBasaleCalcolato() {
  const r = basaleCalcolato(), out = document.getElementById("bmr-ris"), usa = document.querySelector("[data-bmr-usa]");
  if (!r || !out) return;
  const fk = String(Math.round(r.kg * 10) / 10).replace(".", ",");
  out.innerHTML = r.kcal ? `Il tuo basale è circa <b>${r.kcal} kcal</b><small>con il peso del Profilo: ${fk} kg</small>` : `<small>Scrivi età e altezza: il peso è quello del Profilo (${fk} kg).</small>`;
  if (usa) usa.disabled = !r.kcal;
}
function ricordaDatiBasale(r) {
  const pf = leggiProfilo();
  pf.sesso = r.uomo ? "uomo" : "donna";
  if (r.eta >= 10 && r.eta <= 100) pf.eta = Math.round(r.eta);
  if (r.cm >= 100 && r.cm <= 230) pf.altezza = Math.round(r.cm);
  salvaProfilo(pf);
}
function chiudiCalcoloBasale() {
  const box = document.getElementById("bmr-calc"), link = document.querySelector("[data-bmr-apri]");
  if (box) { box.hidden = true; box.innerHTML = ""; }
  if (link) link.hidden = false;
}
document.addEventListener("click", (e) => {
  if (!e.target.closest || !e.target.closest("#modal-content")) return;
  if (e.target.closest("[data-bmr-apri]")) {
    const box = document.getElementById("bmr-calc"); if (!box) return;
    box.innerHTML = bmrCalcHTML(); box.hidden = false; e.target.closest("[data-bmr-apri]").hidden = true;
    aggiornaBasaleCalcolato();
    const vuoto = box.querySelector('[data-bmr="eta"]:placeholder-shown') || box.querySelector('[data-bmr="altezza"]:placeholder-shown'); if (vuoto) vuoto.focus();
    return;
  }
  if (e.target.closest("[data-bmr-chiudi]")) { chiudiCalcoloBasale(); return; }
  if (e.target.closest("[data-bmr-usa]")) {
    const r = basaleCalcolato(); if (!r || !r.kcal) return;
    ricordaDatiBasale(r);
    const inp = document.querySelector('[data-profilo="bmr"]');
    if (inp) { inp.value = r.kcal; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); }   // come se l'avessi scritto: si salva e l'anteprima si aggiorna
    chiudiCalcoloBasale();
    avviso(`Basale: ${r.kcal} kcal`);
  }
});
document.addEventListener("input", (e) => {
  if (!e.target.closest || !e.target.closest("#bmr-calc")) {
    if (e.target.matches && e.target.matches('[data-profilo="peso"]') && document.getElementById("bmr-ris")) aggiornaBasaleCalcolato();   // cambia il peso: il calcolo segue
    return;
  }
  aggiornaBasaleCalcolato();
  const r = basaleCalcolato(); if (r) ricordaDatiBasale(r);
});

// ================== Diario del peso ==================
function leggiPesi() { try { return JSON.parse(localStorage.getItem("mp_pesi")) || []; } catch (e) { return []; } }
function salvaPesi(arr) { arr.sort((a, b) => a.data.localeCompare(b.data)); localStorage.setItem("mp_pesi", JSON.stringify(arr)); }
const oggiISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const giorniTra = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const fmtData = (iso) => new Date(iso + "T12:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const fmtKg = (x) => x.toFixed(1).replace(".", ",");

// Media mobile a 7 giorni (le oscillazioni giornaliere di acqua/sale contano poco)
function mediaMobile(pesi) {
  return pesi.map(p => {
    const fin = pesi.filter(q => { const d = giorniTra(q.data, p.data); return d >= 0 && d < 7; });
    return { data: p.data, kg: fin.reduce((s, q) => s + q.kg, 0) / fin.length };
  });
}
// Andamento in kg/settimana (regressione lineare sugli ultimi 28 giorni)
function andamento(pesi) {
  if (!pesi.length) return null;
  const ult = pesi[pesi.length - 1].data;
  const rec = pesi.filter(p => giorniTra(p.data, ult) <= 28);
  if (rec.length < 3 || giorniTra(rec[0].data, ult) < 10) return null;
  const xs = rec.map(p => giorniTra(rec[0].data, p.data)), ys = rec.map(p => p.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? num / den * 7 : null;
}
function consiglioPeso(trend, giorniDati) {
  if (trend === null) return "Pesati 2–3 volte a settimana, al mattino a digiuno: dopo 10 giorni di dati compare l'andamento.";
  if (giorniDati >= 21 && trend > -0.1) return "⚠️ Il peso è fermo da 3 settimane: aumenta il deficit di 5% nel Profilo (oppure riduci la quota di kcal da allenamento).";
  if (trend < -0.7) return "⚠️ Stai scendendo troppo in fretta: rischi di perdere muscolo ed energia. Riduci il deficit di 5% nel Profilo.";
  if (trend <= -0.2) return "✅ Ritmo ideale: continua così.";
  return "Andamento lento: se resta così per 3 settimane, aumenta un po' il deficit.";
}
function graficoPesoSVG(pesi) {
  if (pesi.length < 2) return `<p class="hint">Il grafico compare dalla seconda pesata.</p>`;
  const mm = mediaMobile(pesi);
  const W = 340, H = 170, PL = 34, PR = 8, PT = 10, PB = 22;
  const d0 = pesi[0].data, span = Math.max(1, giorniTra(d0, pesi[pesi.length - 1].data));
  const kgs = pesi.map(p => p.kg);
  let lo = Math.floor(Math.min(...kgs) - 0.5), hi = Math.ceil(Math.max(...kgs) + 0.5);
  const X = (d) => PL + giorniTra(d0, d) / span * (W - PL - PR);
  const Y = (k) => PT + (hi - k) / (hi - lo) * (H - PT - PB);
  const passo = Math.max(1, Math.ceil((hi - lo) / 4));
  let griglia = "";
  for (let k = lo; k <= hi; k += passo) griglia += `<line x1="${PL}" x2="${W - PR}" y1="${Y(k)}" y2="${Y(k)}" class="gr-grid"/><text x="${PL - 5}" y="${Y(k) + 3}" class="gr-lab" text-anchor="end">${k}</text>`;
  const linea = mm.map((p, i) => `${i ? "L" : "M"}${X(p.data).toFixed(1)},${Y(p.kg).toFixed(1)}`).join("");
  const punti = pesi.map(p => `<circle cx="${X(p.data).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="2.6" class="gr-pt"><title>${fmtData(p.data)}: ${fmtKg(p.kg)} kg</title></circle>`).join("");
  return `<svg class="grafico-peso" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del peso">
    ${griglia}${punti}<path d="${linea}" class="gr-line"/>
    <text x="${PL}" y="${H - 6}" class="gr-lab">${fmtData(d0)}</text>
    <text x="${W - PR}" y="${H - 6}" class="gr-lab" text-anchor="end">${fmtData(pesi[pesi.length - 1].data)}</text>
  </svg>
  <div class="macro-pct"><span><i class="leg-pt"></i>pesate</span><span><i class="leg-line"></i>media 7 giorni</span></div>`;
}
// Il peso del Profilo segue la media degli ultimi 7 giorni (per le proteine in g/kg); senza pesate resta com'è
function aggiornaPesoProfilo() {
  const mm = mediaMobile(leggiPesi());
  if (!mm.length) return;
  const pf = leggiProfilo();
  pf.peso = Math.round(mm[mm.length - 1].kg * 10) / 10;
  salvaProfilo(pf);
  if (typeof renderOggi === "function") renderOggi();
}
function salvaPesata() {
  const data = document.getElementById("peso-data").value || oggiISO();
  const kg = parseFloat(String(document.getElementById("peso-kg").value).replace(",", "."));
  if (isNaN(kg) || kg < 30 || kg > 200) { avviso("Inserisci un peso valido in kg."); return; }
  const kg1 = Math.round(kg * 10) / 10;
  const registra = () => {
    const pesi = leggiPesi().filter(p => p.data !== data); // una pesata per giorno
    pesi.push({ data, kg: kg1 });
    salvaPesi(pesi);
    aggiornaPesoProfilo();
    rirenderAndamento();
    avviso(`Peso salvato: ${fmtKg(kg1)} kg`);
  };
  // più di 3 kg di differenza dall'ultima pesata: quasi sempre una cifra sbagliata, si chiede prima di salvare
  const altre = leggiPesi().filter(p => p.data !== data), ultima = altre[altre.length - 1];
  const diff = ultima ? Math.round((kg1 - ultima.kg) * 10) / 10 : 0;
  if (Math.abs(diff) > 3) {
    const sheet = document.querySelector(".modal-sheet"), sc = sheet ? sheet.scrollTop : 0;
    const torna = () => { apriAndamento(); const s2 = document.querySelector(".modal-sheet"); if (s2) s2.scrollTop = sc; };
    const f = (x) => String(x).replace(".", ",");
    chiediConferma(`${f(kg1)} kg: ${diff > 0 ? "+" : "−"}${f(Math.abs(diff))} kg dall'ultima pesata. È giusto?`, `L'ultima pesata (${fmtData(ultima.data)}) era ${fmtKg(ultima.kg)} kg.`, "Sì, salva",
      () => { torna(); registra(); }, torna);
    return;
  }
  registra();
}
function eliminaPesata(data) {
  const prima = leggiPesi();
  salvaPesi(prima.filter(p => p.data !== data));
  aggiornaPesoProfilo();   // il peso del Profilo si ricalcola dalle pesate rimaste
  rirenderAndamento();
  avviso(`Pesata del ${fmtData(data)} eliminata`, "Annulla", () => { salvaPesi(prima); aggiornaPesoProfilo(); rirenderAndamento(); });
}

// ================== Backup ==================
function esportaBackup() {
  const dati = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("mp_") && k !== "mp_adatta" && k !== "mp_storico") dati[k] = localStorage.getItem(k);   // il "torna indietro" non entra nel backup
  }
  const blob = new Blob([JSON.stringify({ app: "piano-pasti", creato: new Date().toISOString(), dati }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sailor-fit-backup-${oggiISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function ripristinaBackup(testo) {
  let b;
  try { b = JSON.parse(testo); } catch (e) { avviso("File non valido."); return; }
  if (!b || b.app !== "piano-pasti" || typeof b.dati !== "object") { avviso("Questo file non è un backup di Sailor Fit."); return; }
  const quando = b.creato ? new Date(b.creato).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "data sconosciuta";
  chiediConferma("Ripristinare il backup?", `Del ${quando}: i dati attuali verranno sostituiti`, "Ripristina", () => {
    Object.keys(localStorage).filter(k => k.startsWith("mp_")).forEach(k => localStorage.removeItem(k));
    Object.entries(b.dati).forEach(([k, v]) => { if (k.startsWith("mp_") && k !== "mp_adatta" && k !== "mp_storico") localStorage.setItem(k, v); });
    localStorage.setItem("mp_adatta", "1");   // al riavvio i dati vecchi si adattano alla versione nuova
    location.reload();
  }, null, true);   // tasto di conferma verde
}

// -------- Import CSV --------
// Colonne attese (con intestazione, separate da , oppure ;):
//  nome, pasto, kcal, proteine, carboidrati, grassi, ingredienti   (kcal e macro si ricalcolano dagli ingredienti)
//  ingredienti nel formato: "Riso 80 g; Pollo 150 g" (tra virgolette se contiene il separatore)
// Righe e campi di un CSV: virgolette (anche "" dentro un campo e a capo dentro le virgolette), campi vuoti, separatore , o ; (quello dell'intestazione)
function righeCSV(testo) {
  testo = String(testo || "").replace(/^﻿/, "");
  let sep = ",";
  { let dentro = false, virgole = 0, puntiVirgola = 0;   // il separatore si capisce dalla prima riga (fuori dalle virgolette)
    for (const ch of testo) { if (ch === '"') dentro = !dentro; else if (!dentro && (ch === "\n" || ch === "\r")) break; else if (!dentro && ch === ",") virgole++; else if (!dentro && ch === ";") puntiVirgola++; }
    if (puntiVirgola > virgole) sep = ";"; }
  const righe = [];
  let riga = [], campo = "", dentro = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (dentro) {
      if (ch === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else dentro = false; }
      else campo += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === sep) { riga.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && testo[i + 1] === "\n") i++;
      riga.push(campo); campo = "";
      if (riga.some(c => c.trim())) righe.push(riga);
      riga = [];
    } else campo += ch;
  }
  riga.push(campo);
  if (riga.some(c => c.trim())) righe.push(riga);
  return righe;
}
// "Petto di pollo 150 g", "Uova 2 pz", "150 g riso", "Sale q.b." → ingrediente conosciuto, oppure null (alimento che non conosco)
function ingredienteDaCSV(s) {
  const unitaDa = (u) => { const x = u && SINONIMI_UNITA.find(([re]) => re.test(u.toLowerCase())); return x || null; };
  let nome = s.trim(), qta = null, unita = null, m;
  if ((m = nome.match(/^(.+?)\s+q\.?\s?b\.?$/i))) { nome = m[1]; qta = 1; unita = "q.b."; }
  else if ((m = nome.match(/^(.+?)\s+(\d+(?:[.,]\d+)?|\d+\/\d+)\s*([a-zà-ù.]+)?$/i)) && (!m[3] || unitaDa(m[3]))) { nome = m[1]; qta = numeroDa(m[2]); const u = unitaDa(m[3]); if (u) { unita = u[1]; qta *= u[2]; } }
  else if ((m = nome.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*([a-zà-ù.]+)?\s+(?:di\s+)?(.+)$/i)) && (!m[2] || unitaDa(m[2]))) { nome = m[3]; qta = numeroDa(m[1]); const u = unitaDa(m[2]); if (u) { unita = u[1]; qta *= u[2]; } }
  nome = nome.trim();
  const A = window.ALIMENTI || {};
  let trovato = A[nome] ? nome : Object.keys(A).find(k => k.toLowerCase() === nome.toLowerCase());
  if (!trovato && typeof cercaAlimenti === "function") { const t = cercaAlimenti(nome)[0]; if (quasiUguale(nome, t)) trovato = t; }   // solo nomi quasi uguali: niente sostituzioni a sorpresa
  if (!trovato || !(qta > 0)) return null;
  if (!unita) unita = window.pzPredefinito && window.pzPredefinito(trovato) && qta <= 12 ? "pz" : (UNITA_LIQUIDI.test(trovato) ? "ml" : "g");
  return { nome: trovato, qta: Math.round(qta * 100) / 100, unita };
}
function parseCSV(testo) {
  const righe = righeCSV(testo);
  if (!righe.length) return { ricette: [], saltate: 0, ignoti: 0 };
  const header = righe[0].map(h => h.trim().toLowerCase());
  const idx = n => header.indexOf(n);
  const out = [];
  let saltate = 0, ignoti = 0;
  for (let i = 1; i < righe.length; i++) {
    const campi = righe[i];
    const get = n => { const j = idx(n); return j >= 0 && campi[j] !== undefined ? campi[j].trim() : ""; };
    if (!get("nome")) { saltate++; continue; }
    const letti = get("ingredienti").split(/;|\n/).map(s => s.trim()).filter(Boolean).map(ingredienteDaCSV);
    const ingredienti = letti.filter(Boolean);
    if (!ingredienti.some(x => x.unita !== "q.b.")) { saltate++; continue; }   // nessun ingrediente valido: la riga non si importa
    ignoti += letti.length - ingredienti.length;
    const p = get("pasto").toLowerCase();
    const pasti = /principale|pranzo e cena|pranzo\/cena/.test(p) ? ["pranzo", "cena"] : PASTI_CHIP.some(x => x[0] === p) ? [p] : ["pranzo"];
    out.push({ nome: get("nome"), pasti, ingredienti });
  }
  return { ricette: out, saltate, ignoti };
}
// Le ricette del CSV si AGGIUNGONO al ricettario: sostituiscono solo le tue ricette con lo stesso nome;
// se il nome è di una ricetta di base, l'importata si chiama "… (importata)" e quella di base resta
function importaRicetteCSV(lista) {
  let custom = leggiCustom();
  const nomiCustom = new Set(custom.map(r => r.nome));
  const nomiBase = new Set((leggiRicette() || window.RICETTE_ESEMPIO || []).map(r => r.nome));
  lista.forEach(r => {
    let nome = r.nome;
    if (!nomiCustom.has(nome) && nomiBase.has(nome)) nome += " (importata)";
    custom = custom.filter(x => x.nome !== nome);
    const m = calcolaMacro(r);
    r.pasti.forEach(p => custom.push({ nome, pasto: p, custom: true, tempo: null, kcal: m.kcal, proteine: m.proteine, carboidrati: m.carboidrati, grassi: m.grassi, ingredienti: clone(r.ingredienti), passaggi: [] }));
    nomiCustom.add(nome);
  });
  salvaCustom(custom);
  caricaRicette();
}

// -------- Scarica ricettario in PDF (via jsPDF) --------
// la libreria PDF (360 KB) si scarica solo quando serve, così l'app si apre più in fretta
let _pdfCaricamento = null;
function caricaJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
  if (!_pdfCaricamento) _pdfCaricamento = new Promise((ok, ko) => {
    const s = document.createElement("script"); s.src = "jspdf.umd.min.js";
    s.onload = ok; s.onerror = () => { _pdfCaricamento = null; ko(new Error("libreria")); };
    document.head.appendChild(s);
  });
  return _pdfCaricamento;
}
async function scaricaRicettario() {
  try { await caricaJsPdf(); } catch (e) { avviso("Libreria PDF non caricata. Controlla la connessione e riprova."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    avviso("Libreria PDF non caricata. Riprova tra un istante o ricarica la pagina.");
    return;
  }
  const ordine = { colazione: 0, pranzo: 1, cena: 2, spuntino: 3 };
  // i "principali" compaiono sia a pranzo che a cena: nel ricettario li mostriamo una volta
  const titoli = { colazione: "Colazioni", pranzo: "Piatti principali (pranzo e cena)", spuntino: "Spuntini" };
  const viste = new Set();
  const uniche = ricette
    .filter(r => { if (viste.has(r.nome)) return false; viste.add(r.nome); return true; })
    .sort((a, b) => (ordine[a.pasto] - ordine[b.pasto]) || a.nome.localeCompare(b.nome));

  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 48, MR = 48, MT = 54, MB = 48;
  const maxW = PW - ML - MR;
  let y = MT;

  const nuovaPagina = () => { doc.addPage(); y = MT; };
  const assicura = (h) => { if (y + h > PH - MB) nuovaPagina(); };
  // Scrive un blocco di testo con a-capo automatico; opz. elenco puntato/numerato
  const testo = (str, o = {}) => {
    const size = o.size || 11, style = o.style || "normal", col = o.color || [30, 30, 30];
    const gap = o.gap != null ? o.gap : 4, indent = o.indent || 0, bullet = o.bullet || null;
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(col[0], col[1], col[2]);
    const bulletW = bullet ? 16 : 0;
    const righe = doc.splitTextToSize(str, maxW - indent - bulletW);
    const lh = size * 1.4;
    righe.forEach((r, i) => {
      assicura(lh);
      if (bullet && i === 0) doc.text(bullet, ML + indent, y);
      doc.text(r, ML + indent + bulletW, y);
      y += lh;
    });
    y += gap;
  };

  // Intestazione
  testo("Ricettario Sailor Fit", { size: 24, style: "bold", color: [26, 122, 76], gap: 2 });
  testo(uniche.length + " ricette · generato con Sailor Fit", { size: 10, color: [130, 130, 130], gap: 12 });

  ["colazione", "pranzo", "spuntino"].forEach(p => {
    const gruppo = uniche.filter(r => r.pasto === p);
    if (!gruppo.length) return;
    assicura(50);
    y += 6;
    testo(titoli[p], { size: 15, style: "bold", color: [26, 122, 76], gap: 3 });
    doc.setDrawColor(53, 192, 125);
    doc.setLineWidth(1.2);
    assicura(8);
    doc.line(ML, y - 6, PW - MR, y - 6);
    y += 6;

    gruppo.forEach(rr => {
      // ricette a porzioni: ricetta intera + valori per pezzo
      const r = rr._orig || rr;
      const m = rr._orig ? macroPerPezzo(r) : r;
      const per = rr._orig ? ` (1 ${r.pezzo || "porzione"} su ${r.porzioni})` : "";
      assicura(64); // evita di lasciare il titolo ricetta orfano a fine pagina
      testo(r.nome, { size: 13, style: "bold", color: [25, 25, 25], gap: 1 });
      testo(`${m.kcal} kcal${per}${r.tempo ? ` · ${r.tempo} min` : ""} · P ${m.proteine}g · C ${m.carboidrati}g · G ${m.grassi}g`,
        { size: 9.5, color: [120, 120, 120], gap: 5 });
      testo("INGREDIENTI", { size: 8, style: "bold", color: [150, 150, 150], gap: 2 });
      r.ingredienti.forEach(i => {
        const crudo = crudoLabel(i.nome, grammiIng(i));
        testo(`${i.nome} — ${i.qta} ${i.unita}${crudo ? ` (${crudo})` : ""}`, { size: 10.5, gap: 1, bullet: "•" });
      });
      if (r.passaggi && r.passaggi.length) {
        y += 3;
        testo("PROCEDIMENTO", { size: 8, style: "bold", color: [150, 150, 150], gap: 2 });
        r.passaggi.forEach((s, k) => testo(s, { size: 10.5, gap: 2, bullet: (k + 1) + "." }));
      }
      y += 12;
    });
  });

  // Numeri di pagina
  const tot = doc.internal.getNumberOfPages();
  for (let p = 1; p <= tot; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${p} / ${tot}`, PW / 2, PH - 22, { align: "center" });
  }

  doc.save("ricettario-sailor-fit.pdf");
}

// -------- Inizializzazione UI --------
document.addEventListener("DOMContentLoaded", () => {
  caricaRicette();


  document.getElementById("apri-menu").addEventListener("click", () => { apriMenu(); segnaTab("altro"); });
  // barra in basso: ogni sezione si apre come pannello sopra Oggi; "Oggi" li chiude
  document.getElementById("tab-oggi").addEventListener("click", () => {
    closeModal();
    if (vistaHome !== "oggi" || dataDiario !== oggiISO()) vaiA("oggi"); else window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("tab-settimana").addEventListener("click", () => {
    closeModal();
    if (vistaHome !== "settimana" || offsetSettHome !== 0) vaiA("settimana"); else window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("apri-andamento").addEventListener("click", () => segnaTab("andamento"));
  segnaTab("oggi");

  document.getElementById("file-csv").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { ricette: nuove, saltate, ignoti } = parseCSV(reader.result);
        if (nuove.length === 0) { avviso(saltate ? `Nessuna ricetta importata: ${saltate} righe senza ingredienti che conosco.` : "Nessuna ricetta trovata nel CSV."); return; }
        importaRicetteCSV(nuove);   // si aggiungono a quelle che hai già
        avviso(`${nuove.length} ${nuove.length === 1 ? "ricetta importata" : "ricette importate"}${saltate ? ` · ${saltate} saltate` : ""}${ignoti ? ` · ${ignoti} ingredienti sconosciuti tolti` : ""}`);
      } catch (err) {
        avviso("Errore nella lettura del CSV: " + err.message);
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = ""; // permette di reimportare lo stesso file
  });

  // Chiusura del modale (X, backdrop, tasto Esc)
  document.getElementById("modal").addEventListener("click", (e) => {
    const ch = e.target.closest("[data-chiudi]");
    if (ch) {
      if (ch.classList.contains("modal-close") && typeof indietroAnteprima === "function" && indietroAnteprima()) { e.__tornaIdee = true; return; }   // ✕ nell'anteprima di un'idea: torna alle idee (sfondo e Esc chiudono tutto)
      if (_ricettaDaLista) apriListaRicetteCome(); else closeModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("modal").hidden) { if (_ricettaDaLista) apriListaRicetteCome(); else closeModal(); }
  });

  // Interazioni dentro il modale: wizard, menù, lista ricette, filtri, quantità
  document.getElementById("modal-content").addEventListener("click", (e) => {
    const vb = e.target.closest("[data-var-ric]");
    if (vb) { apriListaVarianti(vb.dataset.varRic, +vb.dataset.varIdx); return; }
    const vt = e.target.closest("[data-var-tutte]");
    if (vt) { const v = leggiVarianti(), nm = vt.dataset.varTutte; v[nm] = v[nm] || {}; JSON.parse(vt.dataset.varLista).forEach(([k, n]) => { v[nm][k] = n; }); salvaVarianti(v); caricaRicette(); apriRicetta(nm); avviso("Versione più leggera applicata", "Annulla", () => { const w = leggiVarianti(); delete w[nm]; salvaVarianti(w); caricaRicette(); apriRicetta(nm); }); return; }
    const vs = e.target.closest("[data-var-scegli]");
    if (vs) { scegliVariante(vs.dataset.varScegli, +vs.dataset.varIdx, vs.dataset.varNome); return; }
    const wiz = e.target.closest("[data-wiz]");
    if (wiz) { azioneWizard(wiz.dataset.wiz, wiz.dataset.idx, wiz.dataset.k); return; }
    const sdel = e.target.closest("[data-sport-del]");
    if (sdel) {
      // lo sport non si cancella: diventa «nascosto» (sparisce dalle scelte), così i giorni passati tengono obiettivi e statistiche
      const idSport = sdel.dataset.sportDel, nomeSport = (leggiProfilo().sport.find(x => x.id === idSport) || {}).nome || "lo sport";
      const sheet = document.querySelector(".modal-sheet"), sc = sheet ? sheet.scrollTop : 0;
      const tipi = leggiTipi(), senza = (t) => { const parti = String(VECCHI_TIPI[t] || t).split("+").filter(x => x && x.split(":")[0] !== idSport); return parti.length ? parti.join("+") : "riposo"; };
      const giorniUsa = tipi.map((t, i) => sportDelTipo(t).includes(idSport) ? i : -1).filter(i => i >= 0);
      // nella settimana tipo quei giorni diventano riposo (se c'era anche un altro sport, resta quello)
      const cosaDiventa = giorniUsa.map(i => { const k = senza(tipi[i]); return `${GIORNI[i].toLowerCase()} ${k === "riposo" ? "diventa riposo" : `resta ${TIPI_GIORNATA[k].label}`}`; });
      const nota = (giorniUsa.length ? `Nella settimana tipo: ${cosaDiventa.join(", ")}. ` : "") + "I giorni passati non cambiano.";
      chiediConferma(`Togliere ${nomeSport}?`, nota, "Togli", () => {
        const pf = leggiProfilo(), sp = pf.sport.find(x => x.id === idSport); if (sp) sp.nascosto = true;
        if (giorniUsa.length) {
          // i giorni passati senza tipo salvato seguivano la settimana tipo: si fissano com'erano prima di cambiarla
          const oggi = oggiISO(), d = leggiDiario(); let cambiato = false;
          Object.keys(d).forEach(data => { if (data < oggi && d[data] && !d[data].tipo && giorniUsa.includes(indiceSettimana(data))) { d[data].tipo = tipi[indiceSettimana(data)]; cambiato = true; } });
          if (cambiato) salvaDiario(d);
          salvaTipi(tipi.map((t, i) => giorniUsa.includes(i) ? senza(t) : t));
        }
        salvaProfilo(pf); riapriProfilo(sc); if (typeof renderOggi === "function") renderOggi();
      }, () => riapriProfilo(sc));
      return;
    }
    const sd = e.target.closest("[data-spesa-del]");
    if (sd) {
      const nomeVoce = sd.dataset.spesaDel, prima = leggiExtraSpesa();
      salvaExtraSpesa(prima.filter(x => x !== nomeVoce)); renderSpesa();
      avviso(`Tolto: ${nomeVoce.toLowerCase()}`, "Annulla", () => { salvaExtraSpesa(prima); renderSpesa(); });   // si rimedia con un tocco, come per pasti e ingredienti
      return;
    }
    const elim = e.target.closest("[data-elimina]");
    if (elim) { eliminaRicetta(elim.dataset.elimina); return; }
    const mod = e.target.closest("[data-modifica]");
    if (mod) { apriWizardModifica(mod.dataset.modifica); return; }
    const pdel = e.target.closest("[data-peso-del]");
    if (pdel) { eliminaPesata(pdel.dataset.pesoDel); return; }
    const az = e.target.closest("[data-azione]");
    if (az) {
      if (az.dataset.azione === "scarica") scaricaRicettario();
      else if (az.dataset.azione === "importa") { const f = document.getElementById("file-csv"); f.value = ""; f.click(); closeModal(); }
      else if (az.dataset.azione === "nuova") apriWizard();
      else if (az.dataset.azione === "profilo") apriProfilo();
      else if (az.dataset.azione === "miei-alimenti") apriMieiAlimenti();
      else if (az.dataset.azione === "spesa-aggiungi") aggiungiVoceSpesa();
      else if (az.dataset.azione === "spesa-nuova") { salvaPresi(new Set()); renderSpesa(); }
      else if (az.dataset.azione === "vai-spesa") apriSpesa();
      else if (az.dataset.azione === "sport-aggiungi") {
        const nome = (document.getElementById("nuovo-sport-nome").value || "").trim();
        if (!nome) { avviso("Scrivi il nome dello sport."); return; }
        const pf = leggiProfilo(), uguale = pf.sport.find(x => String(x.nome).trim().toLowerCase() === nome.toLowerCase());
        if (uguale && !uguale.nascosto) { avviso("C'è già uno sport con questo nome"); return; }
        if (uguale) { delete uguale.nascosto; salvaProfilo(pf); riapriProfilo(); avviso(`${uguale.nome} è di nuovo tra i tuoi sport`); return; }   // era stato tolto: torna com'era (stesso id, i giorni passati restano collegati)
        let id = slug(nome) || "sport"; while (pf.sport.some(x => x.id === id)) id += "2";
        pf.sport.push({ id, nome: nome.charAt(0).toUpperCase() + nome.slice(1), icona: document.getElementById("nuovo-sport-icona").value, kMin: +document.getElementById("nuovo-sport-intensita").value || 0.075, min: 60 });
        salvaProfilo(pf); riapriProfilo();
      }
      else if (az.dataset.azione === "vai-ricette") apriListaRicette();
      else if (az.dataset.azione === "ricette-da-pasto") apriListaRicette(false, true);
      else if (az.dataset.azione === "profilo-salva") salvaProfiloForm();
      else if (az.dataset.azione === "profilo-default") {
        document.querySelectorAll("[data-profilo]").forEach(inp => { inp.value = PROFILO_DEFAULT[inp.dataset.profilo]; });
        aggiornaAnteprimaProfilo();
      }
      else if (az.dataset.azione === "peso-salva") salvaPesata();
      else if (az.dataset.azione === "backup") apriBackup();
      else if (az.dataset.azione === "esporta") esportaBackup();
      else if (az.dataset.azione === "ripristina") { const f = document.getElementById("file-backup"); f.value = ""; f.click(); closeModal(); } // prima si apre la scelta del file, poi si chiude il pannello
      return;
    }
    const aggR = e.target.closest("[data-agg-ricetta]");
    if (aggR) {
      if (typeof aggiungiRicettaAlPasto === "function") aggiungiRicettaAlPasto(aggR.dataset.aggRicetta, aggR.dataset.aggChiudi ? _aggQta : null);   // le quantità modificate valgono solo per il tasto del riepilogo
      _aggQta = null;
      if (aggR.dataset.aggChiudi) { contestoAgg = null; closeModal(); renderOggi(); } // dal dettaglio: torni a Oggi
      return;
    }
    if (e.target.closest("[data-agg-fine]")) { contestoAgg = null; closeModal(); renderOggi(); return; }
    if (e.target.closest("[data-agg-torna]")) {                       // dall'elenco ricette si torna al pasto che stavi componendo
      const c = contestoAgg; contestoAgg = null;
      if (c && c.data && typeof apriPastoDiario === "function") { renderOggi(); apriPastoDiario(c.data, null, c.pasto); } else { closeModal(); renderOggi(); }
      return;
    }
    if (e.target.closest("[data-indietro-lista]")) { apriListaRicetteCome(); return; }
    const riga = e.target.closest(".riga-ricetta");
    if (riga) {
      const inp = document.getElementById("cerca-ingredienti"), sh = document.querySelector(".modal-sheet");
      if (inp) _statoLista = { q: inp.value, sc: sh ? sh.scrollTop : 0 };       // dove eri nell'elenco
      apriRicetta(riga.dataset.ricetta, true); return;
    }
    const chip = e.target.closest(".chip");
    if (chip) {
      document.querySelectorAll("#filtri-ricette .chip").forEach(c => c.classList.toggle("attivo", c === chip));
      filtroRicetteCorr = chip.dataset.f;
      aggiornaListaRicette();
    }
  });

  // Aggiornamento live dei campi del wizard mentre si digita (input + select)
  document.getElementById("modal-content").addEventListener("input", wizFieldUpdate);
  document.getElementById("modal-content").addEventListener("input", (e) => {   // quantità del riepilogo ricetta: il totale si aggiorna mentre scrivi
    const q = e.target.closest && e.target.closest("[data-agg-qta]");
    if (!q || !_aggQta) return;
    const it = _aggQta.items[+q.dataset.aggQta]; if (!it) return;
    const v = typeof leggiNumero === "function" ? leggiNumero(q.value) : +q.value, pz = +q.dataset.pz || 0;   // virgola ok; in pezzi/cucchiai si converte in grammi
    it.qta = Math.max(0, isNaN(v) ? 0 : Math.round((pz ? v * pz : v) * 10) / 10);
    const tot = document.getElementById("agg-totale"); if (tot) tot.innerHTML = totaleAggHTML();
  });
  document.getElementById("modal-content").addEventListener("click", (e) => {   // − / ＋ e cestino delle quantità del riepilogo ricetta
    if (!_aggQta) return;
    const st = e.target.closest("[data-agg-step]");
    if (st) { const [k, d] = st.dataset.aggStep.split("|").map(Number), it = _aggQta.items[k]; if (it) { it.qta = qtaDopoStep(it.nome, +it.qta, it.u, d); aggAggiorna(); } return; }
    const del = e.target.closest("[data-agg-del]");
    if (del) { const it = _aggQta.items[+del.dataset.aggDel]; if (it) { it.qta = 0; it.tolto = true; aggAggiorna(); } }
  });
  document.getElementById("modal-content").addEventListener("change", (e) => {   // unità del riepilogo ricetta: g ⇄ pz…
    const un = e.target.closest && e.target.closest("[data-agg-unita]");
    if (!un || !_aggQta) return;
    const it = _aggQta.items[+un.dataset.aggUnita]; if (!it) return;
    it.u = un.value; if (typeof salvaUnitaPreferita === "function") salvaUnitaPreferita(it.nome, un.value); if (typeof qtaPezziInteri === "function") it.qta = qtaPezziInteri(it.nome, it.u, +it.qta); aggAggiorna();
  });
  document.getElementById("modal-content").addEventListener("change", wizFieldUpdate);
  // toccando un'opzione si sceglie subito (prima che il campo perda il fuoco)
  document.getElementById("modal-content").addEventListener("pointerdown", (e) => {
    const b = e.target.closest && e.target.closest("[data-wiz-sug]");
    if (!b || !nuovaRic) return;
    const x = nuovaRic.ingredienti[+b.dataset.ing];
    if (!x) return;
    e.preventDefault();
    const vuota = !x.nome && !x.cercato && !x.qta;      // riga appena aggiunta: unità giusta e si passa alla quantità
    x.nome = b.dataset.wizSug; x.cercato = ""; delete x._errore;
    if (vuota) { const u = typeof unitaPreferita === "function" ? unitaPreferita(x.nome) : "g"; if (UNITA.includes(u)) x.unita = u; }
    renderWizard();
    if (vuota) setTimeout(() => { const q = document.querySelector(`[data-ing="${b.dataset.ing}"][data-k="qta"]`); if (q) q.focus(); }, 60);
  });
  document.getElementById("modal-content").addEventListener("focusin", (e) => {
    if (nuovaRic && e.target.dataset && e.target.dataset.k === "nome" && nuovaRic.ingredienti[+e.target.dataset.ing] && nuovaRic.ingredienti[+e.target.dataset.ing].cercato) wizSuggerisci(e.target, true);   // alimento riconosciuto da un testo: le alternative
  });

  // Profilo: durata tipica di uno sport (minuti, o km per la corsa)
  document.getElementById("modal-content").addEventListener("change", (e) => {
    const du = e.target.closest("[data-sport-dur]");
    if (!du) return;
    const pf = leggiProfilo(), sp = pf.sport.find(x => x.id === du.dataset.sportDur);
    const v = parseFloat(String(du.value).replace(",", "."));
    if (sp && v > 0) { if (sp.perKm) sp.km = Math.min(60, Math.round(v * 10) / 10); else sp.min = Math.min(600, Math.round(v)); salvaProfilo(pf); }
    riapriProfilo();
    if (typeof renderOggi === "function") renderOggi();
  });
  // Profilo: calorie di uno sport
  document.getElementById("modal-content").addEventListener("change", (e) => {
    const sk = e.target.closest("[data-sport-kcal]");
    if (!sk) return;
    const pf = leggiProfilo(), sp = pf.sport.find(x => x.id === sk.dataset.sportKcal);
    if (sp) { sp.kcal = Math.max(0, Math.round(+sk.value || 0)); salvaProfilo(pf); }
    const ant = document.getElementById("anteprima-profilo"); if (ant) ant.innerHTML = anteprimaProfiloHTML();
    if (typeof renderOggi === "function") renderOggi();
  });

  // Lista della spesa: Invio = aggiungi voce
  document.getElementById("modal-content").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "spesa-nuova") { e.preventDefault(); aggiungiVoceSpesa(); }
  });

  // Profilo: anteprima obiettivi mentre si digita
  document.getElementById("modal-content").addEventListener("input", (e) => {
    if (e.target.closest("[data-profilo]")) aggiornaAnteprimaProfilo();
  });
  // Profilo: ogni valore si salva appena lo cambi (anche se chiudi senza premere Salva)
  document.getElementById("modal-content").addEventListener("change", (e) => {
    if (!e.target.closest("[data-profilo]")) return;
    salvaProfilo(leggiFormProfilo());
    if (typeof renderOggi === "function") renderOggi();
  });
  // Peso: Invio = salva
  document.getElementById("modal-content").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "peso-kg") salvaPesata();
  });


  document.addEventListener("toggle", (e) => { if (e.target.id === "spesa-disp") spesaDispensaAperta = e.target.open; }, true);   // la dispensa resta aperta quando spunti una voce

  document.getElementById("file-backup").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => ripristinaBackup(reader.result);
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  });

  // Ricerca ricette per ingredienti che hai in casa
  document.getElementById("modal-content").addEventListener("input", (e) => {
    if (e.target.id === "cerca-ingredienti") aggiornaListaRicette();
  });

  // Lista spesa: spunta una voce -> va in fondo (presa); togli la spunta -> torna in lista
  document.getElementById("modal-content").addEventListener("change", (e) => {
    const chk = e.target.closest("input[data-spesa]");
    if (!chk) return;
    const presi = leggiPresi();
    if (chk.checked) presi.add(chk.dataset.spesa); else presi.delete(chk.dataset.spesa);
    segnaInCasa(chk.dataset.spesa, chk.checked, +chk.dataset.q || 0);
    salvaPresi(presi);
    const ul = document.getElementById("spesa");
    if (ul) ul.innerHTML = spesaHTML();
  });

  // Chiede al telefono di non cancellare da solo i dati dell'app (es. se manca spazio)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
});

// Chiede al telefono di non cancellare mai i dati dell'app (diario, preferiti, prodotti)
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
// Service worker (solo in contesto sicuro: https o localhost)
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
  // quando arriva una versione nuova dell'app, ricarica una volta da sola (niente "apri due volte")
  const avevaVersione = !!navigator.serviceWorker.controller;
  let ricaricata = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (avevaVersione && !ricaricata) { ricaricata = true; location.reload(); }
  });
}
