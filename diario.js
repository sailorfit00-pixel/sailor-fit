// =============================================================
//  Diario "Oggi" — inserisci cosa mangi, l'app ti dice cosa ti manca
//  Ogni data ha: tipo di giornata (allenamento) + pasti mangiati.
//  I suggerimenti (ricette e alimenti) partono da quello che resta.
// =============================================================

let dataDiario = oggiISO(); // giorno visualizzato

// Ordine "nel tempo" dei pasti e quota indicativa di ciascuno sulla giornata
// "spuntino" è quello del pomeriggio (pre-workout): così i pasti già salvati restano al loro posto
const ORDINE_TEMPO = ["colazione", "mattina", "pranzo", "spuntino", "cena"];
const QUOTA_PASTO = { colazione: 0.22, mattina: 0.08, pranzo: 0.30, spuntino: 0.12, cena: 0.28 };
const ICONA_PASTO = { colazione: "☕", mattina: "🍎", pranzo: "🍽️", spuntino: "🍌", cena: "🌙" };
const NOME_PASTO = { colazione: "colazione", mattina: "spuntino", pranzo: "pranzo", spuntino: "pre-workout", cena: "cena" };
// Il pomeriggio è "pre-workout" nei giorni di sport e "merenda" nei giorni di riposo (se si passa la data)
const nomePasto = (p, data) => p === "spuntino" && data && !preSera(data) ? "spuntino" : (NOME_PASTO[p] || p);
const NomePasto = (p, data) => { const n = nomePasto(p, data); return n.charAt(0).toUpperCase() + n.slice(1); };
// giorno con sport: lo spuntino del pomeriggio è il pre-workout
const conSport = (data) => sportDelTipo(giornoDiario(data).tipo).some(id => id !== "camminata");   // una semplice camminata non cambia i pasti (niente pre-workout)
// a che ora ti alleni: di sera (ore 18) tranne il sabato mattina; si può cambiare giorno per giorno
const orarioAllen = (data) => giornoDiario(data).orario || (indiceSettimana(data) === 5 ? "mattina" : "sera");
const preSera = (data) => conSport(data) && orarioAllen(data) === "sera";          // il pre-workout è lo spuntino del pomeriggio
// il pasto subito dopo l'allenamento: la cena (allenamento di sera) o il pranzo (di mattina)
const pastoPost = (data) => !conSport(data) ? null : orarioAllen(data) === "sera" ? "cena" : "pranzo";
// i pasti di un giorno: nei giorni di riposo il pre-workout non c'è
// (resta solo se quel giorno c'è già qualcosa salvato lì, es. i vecchi spuntini del pomeriggio)
function momentiTutti(data) {
  return ORDINE_TEMPO;   // lo spuntino del pomeriggio c'è sempre, anche nei giorni di riposo (se lo salti resta tratteggiato)
}
const momentiGiorno = momentiTutti;

// -------- Dati --------
function leggiDiario() { try { return JSON.parse(localStorage.getItem("mp_diario")) || {}; } catch (e) { return {}; } }
// lettura veloce SOLA LETTURA (si rilegge solo se il diario è cambiato): per chi deve solo guardare, mai modificare l'oggetto che torna
let _rawLS = null, _objLS = {};
function leggiDiarioSolaLettura() { try { const raw = localStorage.getItem("mp_diario") || ""; if (raw !== _rawLS) { _objLS = raw ? (JSON.parse(raw) || {}) : {}; _rawLS = raw; } return _objLS; } catch (e) { return {}; } }
function salvaDiario(d) { localStorage.setItem("mp_diario", JSON.stringify(d)); }
function giornoDiario(data) {
  const d = leggiDiario()[data] || {};
  return { tipo: d.tipo || tipoDefault(data), pasti: d.pasti || [], ...(d.orario ? { orario: d.orario } : {}) };
}
function scriviGiorno(data, g) { const ora = Date.now(); (g.pasti || []).forEach(p => { if (!p.ts) p.ts = ora; });   // quando è stato aggiunto: serve a mostrare per primo l'ultimo arrivato
  const d = leggiDiario(); d[data] = g; salvaDiario(d); }
// Lunedì = 0 … Domenica = 6 (come la settimana del piano)
const indiceSettimana = (data) => (new Date(data + "T12:00").getDay() + 6) % 7;
function tipoDefault(data) { return leggiTipi()[indiceSettimana(data)] || "riposo"; }
// obiettivo del giorno: quello del tipo di giornata, o quello del budget settimanale se attivo (settimana.js)
const targetData = (data) => typeof targetEffettivo === "function" ? targetEffettivo(data) : TIPI_GIORNATA[giornoDiario(data).tipo].target;
function totaliData(data) { return sommaMacro(giornoDiario(data).pasti); }
const esclusoIdx = (escl, k) => escl instanceof Set ? escl.has(k) : k === escl;   // un indice oppure un insieme di indici (tutti i piatti di un momento)
function mancaData(data, escludiIdx = null) {
  const T = targetData(data);
  const pasti = giornoDiario(data).pasti.filter((_, k) => !esclusoIdx(escludiIdx, k));
  const t = sommaMacro(pasti);
  const r = {};
  MACRO_K.forEach(k => { r[k] = Math.round(T[k] - t[k]); });
  return r;
}

// Quota di un pasto sul totale del giorno (i pasti di quel giorno fanno sempre il 100%)
function quotaPasto(data, pasto) {
  const m = momentiGiorno(data);
  if (!m.includes(pasto)) return 0;
  return (QUOTA_PASTO[pasto] || 0) / m.reduce((s, p) => s + QUOTA_PASTO[p], 0);
}
// Il pre-workout prende più carboidrati e pochi grassi: si digerisce meglio prima di allenarsi.
// (quello che non prende passa agli altri pasti)
const PESO_MACRO_PRE = { carboidrati: 1.3, grassi: 0.4 };
const pesoMacro = (data, pasto, k) => pasto === "spuntino" && preSera(data) ? (PESO_MACRO_PRE[k] || 1) : 1;
// Obiettivo di un pasto = quota di ciò che manca, divisa tra i pasti non ancora mangiati
function targetPastoDiario(data, pasto, escludiIdx = null) {
  const g = giornoDiario(data);
  const manca = mancaData(data, escludiIdx);
  const fatti = new Set(g.pasti.filter((_, k) => !esclusoIdx(escludiIdx, k)).map(p => p.pasto));
  // un pasto di oggi già passato e vuoto è saltato: la sua quota va ai pasti che restano (non "ruba" calorie)
  const saltato = (p) => data === oggiISO() && pastoPassato(data, p);
  const restanti = momentiGiorno(data).filter(p => p !== pasto && !fatti.has(p) && !saltato(p));
  const r = {};
  MACRO_K.forEach(k => {
    const w = (QUOTA_PASTO[pasto] || 0.2) * pesoMacro(data, pasto, k);
    const quota = w / (w + restanti.reduce((s, p) => s + QUOTA_PASTO[p] * pesoMacro(data, p, k), 0));
    r[k] = Math.max(0, Math.round(manca[k] * quota));
  });
  // le kcal seguono i macro del pasto (per il pre-workout cambiano un po')
  if (pesoMacro(data, pasto, "grassi") !== 1) r.kcal = Math.min(Math.round(r.proteine * 4 + r.carboidrati * 4 + r.grassi * 9), Math.max(0, manca.kcal));   // mai più di ciò che resta davvero nella giornata
  return r;
}

// Obiettivo di quello che resta da aggiungere a un pasto: la sua quota intera meno ciò che c'è già dentro (es. colazione 352 kcal con un cappuccino da 35 → ne restano ~317).
// A pasto vuoto è la quota normale. Serve per dare porzioni e idee giuste quando AGGIUNGI qualcosa a un pasto già scritto.
function targetResiduoPasto(data, pasto) {
  const g = giornoDiario(data), idx = new Set(g.pasti.map((p, k) => p.pasto === pasto ? k : -1).filter(k => k >= 0));
  if (!idx.size) return targetPastoDiario(data, pasto);
  const Tq = targetPastoDiario(data, pasto, idx), gia = sommaMacro(g.pasti.filter((_, k) => idx.has(k))), r = {};
  ["kcal", "proteine", "carboidrati", "grassi"].forEach(k => { r[k] = Math.max(0, Math.round((Tq[k] || 0) - (gia[k] || 0))); });
  return r;
}
// Prossimo pasto da fare: in base all'ora (oggi) e a quelli già inseriti
function etichettaMomento(data, momento) {
  return nomePasto(momento, data);
}
// ora attuale (decimale); per provare l'app si può forzare con window.__ora
const oraDecimale = () => typeof window.__ora === "number" ? window.__ora : new Date().getHours() + new Date().getMinutes() / 60;
// i tuoi orari: colazione 8–8:30, spuntino 11–11:30, pranzo 13:30–14:30, pre-workout 16–16:30 (allenamento ~18), cena 20:30–21:30.
// Un momento resta "in corso" fino a un po' dopo il suo orario, poi passa al successivo
const indiceOra = () => { const h = oraDecimale(); return h < 9.5 ? 0 : h < 12.5 ? 1 : h < 15.5 ? 2 : h < 17.5 ? 3 : h < 22 ? 4 : 5; };   // dopo le 22 anche la cena è passata
// un pasto è "passato" se è di un giorno precedente, o di oggi ma di un momento già trascorso: lì non si propongono cambi a ciò che hai già mangiato
function pastoPassato(data, pasto) {
  const oggi = oggiISO();
  if (data < oggi) return true;
  if (data > oggi) return false;
  const i = ORDINE_TEMPO.indexOf(pasto);
  return i >= 0 && i < indiceOra();
}
function prossimoPasto(data) {
  const fatti = new Set(giornoDiario(data).pasti.map(p => p.pasto));
  const liberi = momentiGiorno(data).filter(p => !fatti.has(p));
  if (!liberi.length) return null;
  if (data === oggiISO()) {
    const ora = indiceOra();
    const dopo = liberi.find(p => ORDINE_TEMPO.indexOf(p) >= ora);
    return dopo || null;   // un pasto saltato (già passato e vuoto) non è "il prossimo": resta solo tratteggiato
  }
  return data < oggiISO() ? null : liberi[0];
}

// -------- Inserimento / modifica di un pasto --------
// `pastoIniz` null = "aggiungi altro": si sceglie il pasto dai bottoni
// Le cose "sciolte" (non da una ricetta) di uno stesso pasto stanno in UN solo piatto libero, così "Già mangiato" è un elenco di alimenti,
// non un insieme di blocchi secondo quando le hai aggiunte. Le ricette restano blocchi a sé.
function aggiungiIngredienteA(piatto, ing) {
  const e = (piatto.ingredienti || []).find(x => x.nome === ing.nome && (x.unita || "g") === (ing.unita || "g"));
  if (e) e.qta = (+e.qta || 0) + (+ing.qta || 0);
  else (piatto.ingredienti = piatto.ingredienti || []).push(clone(ing));
}
// Una ricetta resta la ricetta anche se ne cambi gli ingredienti (`prima` = gli ingredienti di prima del cambio):
// - cambi un ingrediente che non è nel nome, ne togli uno che non è nel nome o ne aggiungi uno → il nome resta («Pancake proteici»)
// - cambi un ingrediente che è nel nome → cambia la parola nel nome («Pollo con basmati» → «Coniglio con basmati»)
// - togli un ingrediente che è nel nome → il piatto si divide: ciò che resta diventa alimenti singoli («Yogurt greco e datteri» senza datteri → yogurt)
function rinominaLibero(p, prima) {
  if (p.ricetta) {
    const r = typeof ricettaDaNome === "function" ? ricettaDaNome(p.ricetta) : null, A = window.ALIMENTI || {};
    if (r) {
      const conta = (lista) => (lista || []).filter(i => i.unita !== "q.b." && A[i.nome] && grammiIng(i) > 0).map(i => i.nome);   // q.b. e alimenti sconosciuti non contano
      let nome = String(p.nome || "").replace(/\s*\(con [^)]*\)\s*$/, "");
      if (!nome.trim() || /^✍️/.test(nome)) nome = r.nome;   // piatti rinominati con l'elenco degli ingredienti dalle versioni vecchie: torna il nome della ricetta
      if (prima && typeof ingredienteNelNome === "function") {
        const vecchi = conta(prima), nuovi = conta(p.ingredienti), sNuovi = new Set(nuovi), sVecchi = new Set(vecchi);
        // stesso posto, alimento diverso = sostituzione (il cambio avviene sul posto); conta solo se il numero di ingredienti è lo stesso
        const coppie = vecchi.length === nuovi.length ? vecchi.map((v, k) => [v, nuovi[k]]).filter(([v, n]) => v !== n && !sNuovi.has(v) && !sVecchi.has(n)) : [];
        const sostituiti = new Set(coppie.map(x => x[0]));
        const tolti = vecchi.filter(v => !sNuovi.has(v) && !sostituiti.has(v));
        if (tolti.some(v => ingredienteNelNome(nome, v))) { delete p.ricetta; delete p.nPezzi; }
        else coppie.forEach(([v, n]) => { const x = nomeConSostituzione(nome, v, n); if (x) nome = x; });
      }
      if (p.ricetta) {
        const base = new Set(((r._orig || r).ingredienti || []).filter(i => i.unita !== "q.b." && A[i.nome]).map(i => i.nome));
        const att = new Set((p.ingredienti || []).filter(i => i.unita !== "q.b." && A[i.nome]).map(i => i.nome));
        if (!(base.size === att.size && [...att].every(n => base.has(n)))) delete p.nPezzi;   // non è più la ricetta com'era: niente contatore porzioni (la ricetta resta per i passaggi e i macro)
        p.nome = nome; aggiornaMacro(p); return;
      }
    } else { delete p.ricetta; delete p.nPezzi; }   // ricetta che non esiste più: piatto di ingredienti singoli
  }
  p.nome = "✍️ " + nomeAutomatico((p.ingredienti || []).map(i => ({ nome: i.nome, cercato: i.cercato, qta: grammiIng(i) || i.qta })));
  aggiornaMacro(p);
}
// fonde i piatti liberi di un momento in uno solo, sulla giornata già caricata; vero se ha cambiato qualcosa
function unisciPastiLiberiIn(g, momento) {
  const liberi = g.pasti.filter(p => p.pasto === momento && !p.ricetta);
  if (liberi.length < 2) return false;
  const base = liberi[0], altri = new Set(liberi.slice(1));
  liberi.slice(1).forEach(p => (p.ingredienti || []).forEach(i => aggiungiIngredienteA(base, i)));
  g.pasti = g.pasti.filter(p => !altri.has(p));
  delete base.auto;   // piatto fuso con cose tue: non è più solo dell'app
  rinominaLibero(base);
  return true;
}
function unisciPastiLiberi(data, momento) {
  const g = giornoDiario(data);
  if (unisciPastiLiberiIn(g, momento)) scriviGiorno(data, g);
}
// Nomi ricette accorciati e quantità davanti ("3 Pancake proteici"): i pasti già registrati si aggiornano una volta sola
// Dopo aver ripristinato un backup (anche di una versione vecchia) i dati si adattano a quella nuova:
// tipi di giornata con le chiavi di una volta, numeri salvati male, macro dei pasti ricalcolati con gli alimenti di adesso
function adattaDatiRipristinati() {
  if (localStorage.getItem("mp_adatta") !== "1") return;
  localStorage.removeItem("mp_adatta");
  try {
    const dati = leggiDiario(); let cambiato = false;
    Object.values(dati).forEach(g => {
      if (!g || typeof g !== "object") return;
      if (!Array.isArray(g.pasti)) { g.pasti = []; cambiato = true; }
      if (typeof VECCHI_TIPI !== "undefined" && VECCHI_TIPI[g.tipo] && VECCHI_TIPI[g.tipo] !== g.tipo) { g.tipo = VECCHI_TIPI[g.tipo]; cambiato = true; }
      g.pasti.forEach(p => {
        if (!p || typeof p !== "object") return;
        const prima = [p.kcal, p.proteine, p.carboidrati, p.grassi].join("|");
        if (Array.isArray(p.ingredienti) && p.ingredienti.length) aggiornaMacro(p);
        else ["kcal", "proteine", "carboidrati", "grassi"].forEach(k => { p[k] = Number.isFinite(+p[k]) ? +p[k] : 0; });
        if (prima !== [p.kcal, p.proteine, p.carboidrati, p.grassi].join("|")) cambiato = true;
      });
    });
    if (cambiato) salvaDiario(dati);
  } catch (e) {}
}
// «Non gradisco i peperoni»: nei dati già salvati (pasti, ricette tue, piano, varianti) diventano zucchine. Si può rifare a ogni avvio: se non c'è più niente da cambiare non fa nulla.
const NO_ALIMENTO = { da: "Peperoni", a: "Zucchine" };
function migraNoPeperoni() {
  const testoVecchio = /Manzo saltato con peperoni e riso/g, nomeNuovo = "Manzo saltato con zucchine e riso";
  // 1) testi salvati (ricette tue, piano, varianti, in casa): si sostituisce il nome dell'alimento e della ricetta
  ["mp_ricette_custom", "mp_piano", "mp_varianti", "mp_incasa", "mp_incasa_q", "mp_ricette"].forEach(k => {
    try {
      const t = localStorage.getItem(k); if (!t) return;
      const n = t.replace(/"Peperoni"/g, '"Zucchine"').replace(testoVecchio, nomeNuovo);
      if (n !== t) localStorage.setItem(k, n);
    } catch (e) {}
  });
  // 2) diario: gli ingredienti «Peperoni» diventano «Zucchine» (se ci sono già si sommano), i macro si ricalcolano, i nomi si aggiornano
  try {
    const dati = leggiDiario(); let cambiato = false;
    Object.values(dati).forEach(g => (g && g.pasti || []).forEach(p => {
      if (!p || !Array.isArray(p.ingredienti) || !p.ingredienti.some(i => i && i.nome === NO_ALIMENTO.da)) { if (p && p.nome && p.nome.includes("Manzo saltato con peperoni e riso")) { p.nome = p.nome.replace(testoVecchio, nomeNuovo); cambiato = true; } return; }
      p.ingredienti.forEach(i => { if (i.nome === NO_ALIMENTO.da) { i.nome = NO_ALIMENTO.a; if (i.cercato) i.cercato = NO_ALIMENTO.a; } });
      const unite = [];
      p.ingredienti.forEach(i => { const e = unite.find(x => x.nome === i.nome && (x.unita || "g") === (i.unita || "g")); if (e) e.qta = (+e.qta || 0) + (+i.qta || 0); else unite.push(i); });
      p.ingredienti = unite;
      if (p.ricetta === "Manzo saltato con peperoni e riso") p.ricetta = nomeNuovo;
      if (p.nome) p.nome = p.nome.replace(testoVecchio, nomeNuovo);
      aggiornaMacro(p);
      if (!p.ricetta && typeof rinominaLibero === "function") rinominaLibero(p);   // i pasti scritti da te: il nome segue gli ingredienti
      cambiato = true;
    }));
    if (cambiato) salvaDiario(dati);
  } catch (e) {}
}
// «Pasta di semola» si chiama ora «Pasta» (e «Pasta di semola cotta» → «Pasta cotta»): i dati già salvati prendono il nome nuovo, una volta sola
function migraPastaSemola() {
  if (localStorage.getItem("mp_migr_pasta") || typeof rinominaAlimentoTuo !== "function") return;
  let tuoi = {}; try { tuoi = JSON.parse(localStorage.getItem("mp_alimenti_custom")) || {}; } catch (e) {}
  [["Pasta di semola cotta", "Pasta cotta"], ["Pasta di semola", "Pasta"]].forEach(([v, n]) => {
    if (n in tuoi) return;   // hai già un alimento tuo con quel nome: non lo tocco
    const c = ["mp_diario", "mp_ricette_custom", "mp_ricette", "mp_piano", "mp_varianti", "mp_spesa_extra", "mp_spesa_presi", "mp_unita", "mp_incasa", "mp_incasa_q", "mp_codici", "mp_alimenti_pz", "mp_alimenti_custom"];
    if (c.some(k => (localStorage.getItem(k) || "").includes(JSON.stringify(v)))) rinominaAlimentoTuo(v, n);
  });
  localStorage.setItem("mp_migr_pasta", "1");
}
function migraNomiRicette() {
  const A = window.ALIAS_RICETTE || {}; if (!Object.keys(A).length) return;
  let cambiato = false;
  const d = leggiDiario();
  Object.values(d).forEach(g => (g.pasti || []).forEach(p => {
    const vecchioNome = p.ricetta;
    if (p.ricetta && A[p.ricetta]) { p.ricetta = A[p.ricetta]; cambiato = true; }
    const r = p.ricetta && ricette.find(x => x.nome === p.ricetta);
    // wrap: le vecchie «2 metà di Wrap…» ora sono «1 wrap» (le quantità degli ingredienti restano quelle: erano già per quelle metà)
    if (r && r._orig && r._orig.pezzo === "wrap" && r._orig.porzioni === 1 && p.nPezzi && /metà/i.test(p.nome || "")) { p.nPezzi = Math.max(0.5, p.nPezzi / 2); cambiato = true; }
    if (r && r._orig && p.nPezzi) { const nn = nomeRicettaConPezzi(r, p.nPezzi); if (p.nome !== nn) { p.nome = nn; cambiato = true; } }
    else if (r && !r._orig && vecchioNome !== p.ricetta && p.nome === vecchioNome) { p.nome = p.ricetta; cambiato = true; }
  }));
  if (cambiato) salvaDiario(d);
  try { localStorage.removeItem("mp_preferiti"); } catch (e) {}   // i Preferiti non esistono più
}
// Elenco di idee (ricette per il pasto), massimo tre alla volta. Prima le ricette che scegli più spesso (dal diario), poi ciò che hai in casa e le migliori per il pasto, poi i dolci. ↻ mostra le tre successive.
// escludiIdx: pasto già segnato che si sta modificando (il suo obiettivo è quello di quel pasto, e la sua ricetta non si ripropone)
function ideeBloccoHTML(c, titolo, escludiIdx = null) {
  const data = c.data, esistente = escludiIdx !== null && escludiIdx !== undefined;
  const restaIdee = Math.round(mancaData(data).kcal);   // kcal che restano oggi: le idee che le superano si segnano e vanno in fondo
  if (!c._idee || c._ideePasto !== c.pasto || c._ideeResta !== restaIdee) {
    const attuale = esistente ? (giornoDiario(data).pasti[escludiIdx] || {}).ricetta : null;
    const casa = esistente ? [] : ricetteInCasa(data, c.pasto, 3);
    const inCasaNomi = new Set(casa.map(x => x.r.nome));
    const cons = casa.concat(ricetteConsigliate(data, c.pasto, 12, esistente ? escludiIdx : null).filter(x => !inCasaNomi.has(x.r.nome) && x.r.nome !== attuale && !ricettaEsclusa(x.r)));   // niente tonno (mercurio)
    const dolci = esistente ? [] : dolciConsigliati(data, c.pasto).filter(x => !new Set(cons.slice(0, 3).map(y => famigliaDolce(y.r)).filter(Boolean)).has(famigliaDolce(x.r)));
    const scelte = new Map();   // quante volte hai mangiato ogni ricetta
    try { Object.values(leggiDiario()).forEach(g => (g.pasti || []).forEach(q => { if (q.ricetta) scelte.set(q.ricetta, (scelte.get(q.ricetta) || 0) + 1); })); } catch (e) {}
    const pool = cons.concat(dolci).map((x, k) => ({ x, k, n: scelte.get(x.r.nome) || 0 }));
    pool.sort((a, b) => (b.n >= 2 ? b.n : 0) - (a.n >= 2 ? a.n : 0) || a.k - b.k);   // le più scelte (almeno 2 volte) in testa, il resto nell'ordine di prima
    pool.forEach(o => { o.sf = Math.round(o.x.tot.kcal - restaIdee); });
    pool.sort((a, b) => (a.sf > 15 ? 1 : 0) - (b.sf > 15 ? 1 : 0));   // quelle che sforano le kcal di oggi in fondo (l'ordinamento resta stabile)
    c._idee = pool.map(({ x, sf }) => `<button class="riga-ricetta con-piu" data-oggi-ricetta="${esc(x.r.nome)}">
          <span class="rr-nome">${esc(x.r.nome)}</span>
          ${macroStileHTML(x.tot)}${sf > 15 ? `<span class="rr-sfora" aria-label="Sopra di ${sf} kcal oggi">+${sf}</span>` : ""}
          <span class="rr-piu" role="button" aria-label="Aggiungi subito">＋</span>
        </button>`);
    c._ideePasto = c.pasto; c._ideeResta = restaIdee;
  }
  const tutte = c._idee, n = tutte.length;
  if (!n) return "";
  const da = ((c.ideeGiro || 0) * 3) % n, mostra = Array.from({ length: Math.min(3, n) }, (_, k) => tutte[(da + k) % n]);
  return `<h4 class="cosa-testa"><span>${titolo}</span>${n > 3 ? `<button class="cosa-altre" data-idee-altre aria-label="Altre idee">${ICONA_ALTRE}</button>` : ""}</h4><div class="sugg-ricette">${mostra.join("")}</div>`;
}
// Pannello del pasto: UN solo schermo. Le righe (cose libere + ingredienti delle ricette, ognuna con − quantità + unità cestino)
// sono salvate nel diario a ogni modifica (vedi `commit` e `rirenderLibero`). Le ricette hanno solo un'intestazione con le porzioni.
// `idx` resta per compatibilità: se è un piatto, si apre il pasto di quel piatto.
function caricaItemiVivi(data, momento) {
  const g = giornoDiario(data), items = [], gruppi = [];
  const mappa = (p, grp) => (p.ingredienti || []).filter(x => (window.ALIMENTI || {})[x.nome] && grammiIng(x) > 0)
    .map(x => Object.assign({ nome: x.nome, qta: Math.round(grammiIng(x) * 10) / 10, lock: true, cercato: x.cercato, grp, t: +x.t || +p.ts || 0 }, x.vis ? { unita: x.vis } : {}));
  const lib = g.pasti.find(p => p.pasto === momento && !p.ricetta);
  if (lib) items.push(...mappa(lib, null));
  let n = 0;
  g.pasti.forEach(p => { if (p.pasto !== momento || !p.ricetta) return; gruppi.push({ n, ricetta: p.ricetta, nome: nomeConQuantita(p), nPezzi: p.nPezzi, intatta: !!pastoRicettaIntatta(p) }); items.push(...mappa(p, n)); n++; });
  return { items, gruppi };
}
// ricarica le righe dal diario e ridisegna il pannello sul posto (resta lo scorrimento)
function ricaricaViva(c) {
  if (!c || liberoCtx !== c) return;
  const r = caricaItemiVivi(c.data, c.pasto);
  c.items = r.items; c.gruppi = r.gruppi;
  rirenderLibero();
}
function apriPastoDiario(data, idx = null, pastoIniz = null) {
  const g0 = giornoDiario(data);
  if (idx !== null && g0.pasti[idx]) pastoIniz = g0.pasti[idx].pasto;
  if (!pastoIniz) return;
  unisciPastiLiberi(data, pastoIniz);
  const ctx = {
    pasto: pastoIniz, data, vivo: true,
    gruppiAperti: new Set(),   // quali ricette sono aperte (di default tutte chiuse): resta mentre lavori nel pasto
    vociAperte: new Set(),     // quali ingredienti scritti a mano sono aperti (per nome)
    target: () => targetPastoDiario(data, liberoCtx.pasto, indiciPastoDi(liberoCtx)),   // l'obiettivo è quello di tutto il pasto: le sue righe non contano come "già mangiato"
    // ogni modifica alle righe va subito nel diario: il piatto libero e ogni ricetta del momento; senza righe un piatto sparisce
    commit: (c) => {
      const gg = giornoDiario(data), A = window.ALIMENTI || {};
      const riga = (x) => Object.assign({ nome: x.nome, qta: Math.round(x.qta * 10) / 10, unita: "g", lock: true, cercato: x.cercato || x.nome }, x.unita && x.unita !== "g" ? { vis: x.unita } : {}, x.t ? { t: x.t } : {});   // vis = l'unità con cui l'hai scritto (pz, cucchiaio…)
      const senzaT = ({ t, ...r }) => r;   // l'ora non conta per capire se una riga è cambiata
      const norm = (p) => JSON.stringify((p.ingredienti || []).filter(i => A[i.nome] && grammiIng(i) > 0).map(i => Object.assign({ nome: i.nome, qta: Math.round(grammiIng(i) * 10) / 10, unita: "g", lock: true, cercato: i.cercato || i.nome }, i.vis ? { vis: i.vis } : {})));
      let cambiato = false, struttura = false;
      const oraAgg = Date.now(); c.items.forEach(x => { if (x.t == null) x.t = oraAgg; });   // le righe appena aggiunte portano l'ora: in "Già mangiato" l'ultima va in cima
      // piatto libero
      const righeLib = c.items.filter(x => x.grp == null && +x.qta > 0 && A[x.nome]).map(riga);
      const k = gg.pasti.findIndex(p => p.pasto === c.pasto && !p.ricetta);
      if (!righeLib.length) { if (k >= 0) { gg.pasti.splice(k, 1); cambiato = true; struttura = true; } }
      else {
        let p = k >= 0 ? gg.pasti[k] : null;
        if (!p) { p = { nome: "", pasto: c.pasto, passaggi: [], ingredienti: righeLib }; gg.pasti.push(p); rinominaLibero(p); cambiato = true; struttura = true; }
        else if (norm(p) !== JSON.stringify(righeLib.map(senzaT))) { p.ingredienti = righeLib; delete p.auto; rinominaLibero(p); cambiato = true; }   // l'hai toccato tu: non è più «compilato dall'app»
      }
      // ricette: i gruppi si riconoscono dall'ordine tra i piatti-ricetta del momento
      const ric = gg.pasti.filter(p => p.pasto === c.pasto && p.ricetta);
      ric.forEach((p, n) => {
        const righe = c.items.filter(x => x.grp === n && +x.qta > 0 && A[x.nome]).map(riga);
        if (!righe.length) { gg.pasti.splice(gg.pasti.indexOf(p), 1); cambiato = true; struttura = true; return; }
        if (norm(p) === JSON.stringify(righe.map(senzaT))) return;
        const rimasti = (p.ingredienti || []).filter(i => !A[i.nome] || grammiIng(i) <= 0);   // q.b. e simili restano com'erano
        const ingrPrima = p.ingredienti;
        p.ingredienti = righe.concat(rimasti); delete p.auto;
        const ricettaPrima = p.ricetta, nPrima = p.nPezzi;
        rinominaLibero(p, ingrPrima);   // cambi un ingrediente del nome → cambia il nome; togli un ingrediente del nome → il piatto si divide; il resto lascia il nome
        if (!p.ricetta || p.ricetta !== ricettaPrima || p.nPezzi !== nPrima) struttura = true;
        cambiato = true;
      });
      if (!cambiato) return;
      scriviGiorno(data, gg);
      renderOggi();
      if (struttura) {   // è cambiata la struttura dei piatti (ricetta tolta o diventata libera): si ricarica il raggruppamento
        unisciPastiLiberi(data, c.pasto);
        const r = caricaItemiVivi(data, c.pasto);
        c.items = r.items; c.gruppi = r.gruppi; c._ult = JSON.stringify(c.items);
        if (c.gruppiAperti) c.gruppiAperti.clear();   // le ricette hanno cambiato posto: si richiudono
      } else c.gruppi = caricaItemiVivi(data, c.pasto).gruppi;   // le intestazioni seguono lo stato (il contatore porzioni c'è solo se la ricetta è intatta)
    },
    intestazione: () => liberoCtx.items.length ? "" : liberoCtx.obiettivo(),   // con delle righe la riga "ti restano" sta sotto il risultato
    // pasto vuoto: stessa testata del pasto pieno («Obiettivo · 0 kcal / 299 kcal», sotto P C G con gli obiettivi)
    obiettivo: () => { const T = liberoCtx.target(), z = { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 };
      return `<p class="pm-tot lib-obiettivo"><span>Obiettivo</span><span class="pm-kcal"><b>0 kcal</b><em> / ${Math.round(T.kcal)} kcal</em></span></p><div class="r-macro lib-ob-macro">${macroHaObiettivoHTML(z, T, true)}</div>`; },
    // quando il pasto è vuoto: pasti recenti e idee dal ricettario
    idee: () => { const ric = ideeBloccoHTML(liberoCtx, "💡 Idee", null); return consiglioFurboHTML(liberoCtx, { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 }) + (ric || alimentiIdeaHTML(liberoCtx)); },   // nessuna ricetta che ci stia: almeno gli alimenti singoli giusti
    tutteRicette: true,
    titolo: () => `${ICONA_PASTO[ctx.pasto]} ${NomePasto(ctx.pasto, data)}`,
  };
  const r = caricaItemiVivi(data, pastoIniz);
  ctx.gruppi = r.gruppi;
  ctx._creatoOra = !r.items.length;   // aperto vuoto: quello che salvi ora non si blocca subito (il 🔒 arriva quando lo riapri)
  apriEditorPasto(ctx, r.items, "", false);
}
// − / ＋ delle porzioni di una ricetta, nell'intestazione del suo gruppo: cambia le quantità nel diario e ridisegna sul posto
function cambiaPezziViva(n, delta) {
  const c = liberoCtx; if (!c || !c.vivo) return;
  const g = giornoDiario(c.data), p = g.pasti.filter(x => x.pasto === c.pasto && x.ricetta)[n], r = p && pastoRicettaIntatta(p);
  if (!r) return;
  const passo = passoPezzi(r._orig), singola = !aPezzi(r._orig);
  const nuovo = prossimoPasso(p.nPezzi, delta, passo);   // anche i pasti vecchi con ¼ tornano su multipli di mezza porzione
  if (nuovo === p.nPezzi) return;
  if (singola) {
    const f = nuovo / p.nPezzi;
    p.ingredienti = p.ingredienti.map(i => Object.assign({}, i, { qta: Math.round(i.qta * f * 10) / 10 }));
  } else {
    const m = versioneAPezzi(r._orig, nuovo);
    p.ingredienti = m.ingredienti.filter(i => (window.ALIMENTI || {})[i.nome]).map(i => ({ nome: i.nome, qta: Math.round(grammiIng(i)), unita: "g", lock: true, cercato: i.nome }));
  }
  p.nPezzi = nuovo; p.nome = nomeRicettaConPezzi(r, nuovo); delete p.auto;
  aggiornaMacro(p); scriviGiorno(c.data, g); renderOggi();
  ricaricaViva(c);
}
// cestino dell'intestazione: toglie la ricetta intera (con Annulla)
function togliRicettaViva(n) {
  const c = liberoCtx; if (!c || !c.vivo) return;
  const g = giornoDiario(c.data), p = g.pasti.filter(x => x.pasto === c.pasto && x.ricetta)[n];
  if (!p) return;
  const copia = clone(p), nome = nomeVisibile(p);
  c.items = c.items.filter(x => x.grp !== n);
  rirenderLibero();   // il salvataggio toglie il piatto e ricarica i gruppi
  mostraToast(`Tolta: ${nome}`, "Annulla", () => {   // anche a pannello chiuso: la ricetta torna nel diario
    const g2 = giornoDiario(c.data); g2.pasti.push(copia); scriviGiorno(c.data, g2); renderOggi();
    if (liberoCtx === c) ricaricaViva(c);
  });
}

// Ingredienti di una ricetta in grammi (pz -> g, q.b. esclusi), con porzioni adattate
// Una ricetta adattata all'obiettivo del pasto: { items (in grammi), nome, tot }
// - ricette a porzioni (pancake…): si sceglie quanti pezzi mangiare
// - le altre: si adattano carboidrati e grassi
function porzioneSuMisura(r, target) {
  let m, nome = r.nome;
  if (r._orig) {
    // numero di pezzi (per difetto o per eccesso) che si avvicina di più all'obiettivo
    const k0 = pezziPer(r._orig, target.kcal);
    const passo = passoPezzi(r._orig);
    const cand = [k0 - passo, k0, k0 + passo].filter(x => x >= passo);
    const unico = r._orig.porzioni === 1;   // pezzo intero (1 wrap): non si raddoppia solo per arrivare alle kcal del pasto
    const k = (unico ? [passo, passo * 2] : cand.length ? cand : [passo]).filter(x => !unico || x === passo || calcolaMacro(versioneAPezzi(r._orig, x)).kcal <= target.kcal * 1.15)   // (se l'obiettivo del pasto non è valido si parte da 1 pezzo)
      .map(x => ({ x, p: punteggioPasto(calcolaMacro(versioneAPezzi(r._orig, x)), target) }))
      .sort((a, b) => a.p - b.p)[0].x;
    m = versioneAPezzi(r._orig, k);
    nome = nomeRicettaConPezzi(r, k);
  } else {
    const sc = fattoriScala({ kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 }, [r], target);
    m = scalaPasto(r, sc.fc, sc.fg);
  }
  const items = m.ingredienti
    .filter(i => i.unita !== "q.b." && (window.ALIMENTI || {})[i.nome])
    .map(i => ({ nome: i.nome, qta: Math.round(grammiIng(i)), lock: true }));
  const tot = calcolaMacro(m);
  // ricetta singola: il contatore parte da 1
  const kSingola = !r._orig ? 1 : null;   // ricetta singola: 1 porzione = quella già adattata al tuo obiettivo (due sarebbero troppe calorie)
  return { items, nome, tot, k: r._orig ? m.nPezzi : kSingola };
}
// Ricetta a porzioni collegata a un pasto (per il − N pancake +)
// Ricetta con il contatore delle porzioni: quelle a teglia (pancake, banana bread…) e anche le singole (brownie al microonde, pollo al limone), che contano ¼ di porzione alla volta
// Nessuna ricetta è esclusa (tonno e skyr li mangi): il tonno in scatola si limita con la penalità in ricetteConsigliate e con tonnoOk
const ricettaEsclusa = (r) => false;   // nessuna ricetta è esclusa: il tonno in scatola resta solo meno frequente (penalità in ricetteConsigliate)
const ricettaAPezzi = (nome) => {
  const t = ricette.find(x => x.nome === nome && x._orig);
  if (t) return t;
  const r = nome && ricette.find(x => x.nome === nome);
  return r ? { nome: r.nome, _orig: r } : undefined;
};
// Ricetta singola: le quantità di adesso portate a k porzioni (gli ingredienti aggiunti da te restano come sono)
function scalaSingola(c, r, k2) {
  const nomiR = new Set(r._orig.ingredienti.map(i => i.nome)), f = k2 / (c.nPezzi || 1);
  return c.items.map(x => nomiR.has(x.nome) ? Object.assign({}, x, { qta: Math.round(x.qta * f * 10) / 10 }) : x);
}
// Un pasto già segnato è ancora "la ricetta col contatore" se ha gli stessi ingredienti della ricetta (le quantità possono cambiare)
function pastoRicettaIntatta(p) {
  const r = p && p.ricetta && p.nPezzi ? ricettaAPezzi(p.ricetta) : null;
  if (!r) return null;
  const base = new Set(r._orig.ingredienti.filter(i => i.unita !== "q.b." && (window.ALIMENTI || {})[i.nome]).map(i => i.nome));
  const att = new Set((p.ingredienti || []).map(i => i.nome));
  if (base.size !== att.size) return null;
  for (const n of att) if (!base.has(n)) return null;
  return r;
}
function cambiaPezzi(delta) {
  const c = liberoCtx, r = c && ricettaAPezzi(c.ricetta);
  if (!r || !c.nPezzi) return;
  const passo = passoPezzi(r._orig);
  if (!aPezzi(r._orig)) {   // ricetta singola: da 1 porzione adattata si scende o sale di ½ (senza limite), scalando le quantità di ora
    const k2 = prossimoPasso(c.nPezzi, delta, passo);   // sempre su multipli di mezza porzione
    if (k2 === c.nPezzi) return;
    c.items = scalaSingola(c, r, k2); c.nPezzi = k2; c.nome = nomeRicettaConPezzi(r, k2);
    rirenderLibero(); return;
  }
  const k = prossimoPasso(c.nPezzi, delta, passo);
  const m = versioneAPezzi(r._orig, k);
  const nomiRicetta = new Set(r._orig.ingredienti.map(i => i.nome));
  const extra = c.items.filter(x => !nomiRicetta.has(x.nome)); // es. mirtilli aggiunti ai pancake
  c.nPezzi = k;
  c.nome = nomeRicettaConPezzi(r, k);
  c.items = m.ingredienti.filter(i => (window.ALIMENTI || {})[i.nome]).map(i => ({ nome: i.nome, qta: Math.round(grammiIng(i)), lock: true })).concat(extra);
  rirenderLibero();
}
function ingredientiRicettaInGrammi(r, target) { return porzioneSuMisura(r, target).items; }
// Sceglie un'idea dal ricettario: il pasto viene aggiunto subito
// Tocco sulla ricetta: se si conta a pezzi (pancake, girelle, fette…) si apre il pasto con il selettore dei pezzi,
// così scegli quanti mangiarne PRIMA di aggiungerlo. Il ＋ aggiunge subito; le ricette senza pezzi si aggiungono subito.
function usaRicettaNellEditor(nomeRicetta) {
  const c = liberoCtx;
  if (!c || !c.vivo) return;
  if (c.bozza && typeof salvaBozzaAperta === "function") salvaBozzaAperta();   // prima si salva la bozza: ricaricando dal diario le righe non confermate andrebbero perse
  const snapUsa = JSON.stringify(giornoDiario(c.data));
  if (aggiungiRicettaIn(c.data, c.pasto, nomeRicetta) < 0) return;   // la ricetta entra nel pasto: le sue righe compaiono nell'elenco
  renderOggi(); ricaricaViva(c);
  mostraToast("Aggiunto", "Annulla", () => { if (liberoCtx !== c) return; scriviGiorno(c.data, JSON.parse(snapUsa)); renderOggi(); ricaricaViva(c); });
  const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = 0;
}

// Avviso temporaneo in basso, con un'azione facoltativa (es. Annulla)
let _toastTimer = null;
function mostraToast(testo, etichetta, azione, tutto, extra) {   // extra: un secondo tasto (rosso) che chiude e basta, es. «Annulla» accanto a «Cambia»
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(testo)}</span>${etichetta ? `<button${etichetta === "Annulla" ? ' class="t-rosso"' : ""}>${esc(etichetta)}</button>` : ""}${extra ? `<button class="t-rosso" data-t-extra>${esc(extra)}</button>` : ""}`;
  t.classList.remove("ok"); t.classList.add("on");
  const chiudi = () => { t.classList.remove("on"); clearTimeout(_toastTimer); };
  t.onclick = null; t.classList.toggle("tocca", !!(tutto && azione));
  if (tutto && azione) t.onclick = () => { chiudi(); azione(); };           // tutto il banner è un tasto
  else if (etichetta) t.querySelector("button").onclick = () => { chiudi(); azione && azione(); };
  const ex = t.querySelector("[data-t-extra]"); if (ex) ex.onclick = () => chiudi();
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(chiudi, etichetta || extra ? 3500 : 2200);   // un messaggio semplice dura poco; con «Annulla» un po' di più
}

// Ultimi pasti diversi mangiati in quel momento della giornata (ultimi 30 giorni)
const nomePulito = (n) => String(n || "").replace(/^✍️\s*/, "");
// Il nome di un pasto come si legge in Oggi: una ricetta a porzioni è solo "Banana bread" (le porzioni si vedono aprendo il pasto)
// Nella riga di Oggi: la quantità davanti ("1 wrap di…", "2 fette di…") per le ricette a pezzi ancora intatte
const nomeConQuantita = (p) => { const r = p && p.ricetta && p.nPezzi && pastoRicettaIntatta(p); return r && r._orig && aPezzi(r._orig) ? nomeRicettaConPezzi(r, p.nPezzi) : nomeVisibile(p); };
const nomeVisibile = (p) => p && p.ricetta && p.nPezzi ? nomePulito(p.ricetta) : nomePulito(p && p.nome);

function pastiRecenti(data, pasto, n = 3) {
  const d = leggiDiario();
  const visti = new Set(giornoDiario(data).pasti.map(p => p.nome));
  const per = {};   // nome → quante volte l'hai mangiato in questo momento negli ultimi 30 giorni, e l'ultima volta
  Object.keys(d).filter(x => x !== data && x < addGiorniISO(data, 1) && x >= addGiorniISO(data, -30)).sort().reverse().forEach(x => {
    (d[x].pasti || []).forEach((p, idx) => {
      if (p.pasto !== pasto || visti.has(p.nome)) return;
      if (per[p.nome]) per[p.nome].volte++; else per[p.nome] = { data: x, idx, p, volte: 1 };
    });
  });
  // prima quelli che mangi più spesso, a parità i più recenti
  return Object.values(per).sort((a, b) => (b.volte - a.volte) || (a.data < b.data ? 1 : -1)).slice(0, n).map(({ data, idx, p }) => ({ data, idx, p }));
}
function addGiorniISO(iso, n) { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fmtQuando(iso, rispetto) {
  const g = Math.round((new Date(rispetto + "T12:00") - new Date(iso + "T12:00")) / 86400000);
  return g === 1 ? "ieri" : g > 1 ? `${g} giorni fa` : fmtData(iso);
}
// Reinserisce un pasto già mangiato (stesse quantità) con un tocco
function ripetiPasto(rif) {
  const c = liberoCtx;
  if (!c || !c.vivo) return;
  const [dataOrig, idx] = rif.split("|");
  const orig = (leggiDiario()[dataOrig] || {}).pasti?.[+idx];
  if (!orig) return;
  if (c.bozza && typeof salvaBozzaAperta === "function") salvaBozzaAperta();   // la bozza non si perde ricaricando dal diario
  const snapRip = JSON.stringify(giornoDiario(c.data));
  const g = giornoDiario(c.data);
  const copia = clone(orig);
  copia.pasto = c.pasto; delete copia.auto;
  g.pasti.push(copia);
  scriviGiorno(c.data, g);
  unisciPastiLiberi(c.data, c.pasto);
  renderOggi(); ricaricaViva(c);
  mostraToast("Aggiunto", "Annulla", () => { if (liberoCtx !== c) return; scriviGiorno(c.data, JSON.parse(snapRip)); renderOggi(); ricaricaViva(c); });
}

// -------- Suggerimenti in base a ciò che manca --------
// Quanto un pasto si discosta dalla sua quota (più basso = meglio). Rispetto alla
// giornata: le proteine in più pesano poco (in dimagrimento vanno bene) e i
// grassi del singolo pasto contano meno, perché si compensano negli altri pasti.
function punteggioPasto(t, T) {
  const rel = (a, b) => b > 0 ? (a - b) / b : 0;
  const p = rel(t.proteine, T.proteine);
  // se carboidrati o grassi di oggi sono già finiti (obiettivo del pasto ~0) ogni grammo in più pesa: prima non contava nulla
  const carbo = T.carboidrati >= 8 ? Math.abs(rel(t.carboidrati, T.carboidrati)) : t.carboidrati / 15;
  const grassi = T.grassi >= 3 ? Math.abs(rel(t.grassi, T.grassi)) * 0.5 : t.grassi / 8;
  return Math.abs(rel(t.kcal, T.kcal)) * 2
       + (p < 0 ? -p * 1.5 : p * 0.3)
       + carbo
       + grassi;
}
// I dolci proteici di casa (pancake, cinnamon rolls, banana bread, brownie) compaiono sempre tra i suggerimenti
// di colazione e spuntini, adattati alle kcal del pasto: una sola proposta per tipo (la versione che calza meglio)
const FAMIGLIE_DOLCI = [["pancake", /pancake/i], ["rolls", /cinnamon/i], ["bread", /banana bread/i], ["brownie", /brownie/i]];
const famigliaDolce = (r) => { const f = FAMIGLIE_DOLCI.find(([, re]) => re.test(r.nome)); return f ? f[0] : null; };
function dolciConsigliati(data, pasto) {
  if (!["colazione", "mattina", "spuntino"].includes(pasto)) return [];
  const T = targetResiduoPasto(data, pasto);
  if (T.kcal < 120) return [];
  const migliori = {};
  ricette.forEach(r => {
    const f = famigliaDolce(r); if (!f) return;
    if (f === "pancake" && !r.porzioni) return; // i pancake di casa: quelli a porzioni (farina integrale, senza burro né zuccheri)
    const ps = porzioneSuMisura(r, T);
    const p = punteggioPasto(ps.tot, T);
    if (!migliori[f] || p < migliori[f].p) migliori[f] = { r, p, tot: ps.tot, nome: ps.nome };
  });
  return FAMIGLIE_DOLCI.map(([f]) => migliori[f]).filter(Boolean);
}
// Ricette del pasto che puoi fare con quello che hai comprato (spuntato nella lista della spesa): tutto in casa, o manca una cosa sola
function ricetteInCasa(data, pasto, n = 3) {
  const pantry = typeof leggiInCasa === "function" ? leggiInCasa() : [];
  if (!pantry.length) return [];
  const T = targetPastoDiario(data, pasto);
  if (T.kcal < 120) return [];
  const viste = new Set();
  return ricette
    .filter(r => r.pasto === (pasto === "mattina" ? "spuntino" : pasto) && !viste.has(r.nome) && viste.add(r.nome))
    .filter(r => !ricettaEsclusa(r))
    .map(r => ({ r, a: analizzaDispensa(r._orig || r, pantry) }))
    .filter(x => x.a.matched >= 2 && x.a.mancanti.length <= 1)
    .map(x => { const ps = porzioneSuMisura(x.r, T); return { r: x.r, p: punteggioPasto(ps.tot, T) + x.a.mancanti.length * 0.6, tot: ps.tot, nome: ps.nome, mancanti: x.a.mancanti }; })
    .sort((a, b) => a.p - b.p)
    .slice(0, n);
}
// Ricette del ricettario che, adattate, si avvicinano di più all'obiettivo del pasto
function ricetteConsigliate(data, pasto, n = 3, escludiIdx = null) {
  const T = escludiIdx !== null && escludiIdx !== undefined ? targetPastoDiario(data, pasto, escludiIdx) : targetResiduoPasto(data, pasto);   // aggiungendo a un pasto già scritto contano solo le kcal che restano a quel pasto
  if (T.kcal < 120) return [];
  const giaMangiate = new Set(giornoDiario(data).pasti.map(p => p.ricetta).filter(Boolean));
  const basiOggi = giornoDiario(data).pasti.map(p => rilevaBaseProt(p)).filter(Boolean);
  const viste = new Set();
  return ricette
    .filter(r => r.pasto === (pasto === "mattina" ? "spuntino" : pasto) && !viste.has(r.nome) && viste.add(r.nome))
    .filter((r, i, arr) => pasto === "mattina" ? !r.preworkout : pasto !== "spuntino" || !preSera(data) || !arr.some(x => x.preworkout) || r.preworkout)
    .map(r => {
      const ps = porzioneSuMisura(r, T);
      let p = punteggioPasto(ps.tot, T);
      if (giaMangiate.has(r.nome)) p += 1;
      if ((r._orig || r).ingredienti.some(i => TONNO_SCATOLA.test(i.nome))) p += [0.15, 0.5, 4][Math.min(2, tonnoUltimi7(data))];   // tonno in scatola: al massimo 2 volte a settimana (mercurio) e meglio la varietà: un po' penalizzato anche se non l'hai mangiato, molto dopo 2 volte
      if (r.base && basiOggi.includes(r.base)) p += 0.4; // varietà
      return { r, p, tot: ps.tot, nome: ps.nome };
    })
    .sort((a, b) => a.p - b.p)
    // tra quelle "buone" (vicine alla migliore) se ne pescano n a rotazione:
    // cambiano da un giorno all'altro ma restano le stesse se riapri lo stesso pasto
    .filter((x, i, arr) => i < n || x.p <= arr[0].p + 0.75)
    .slice(0, Math.max(12, n))
    .map(x => ({ x, h: hashStr(data + pasto + x.r.nome) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, n)
    .map(y => y.x)
    .sort((a, b) => a.p - b.p);
}
// In quanti giorni, negli ultimi 7 (oggi compreso), hai mangiato tonno in scatola
const TONNO_SCATOLA = /^Tonno (in scatola|sott)/;   // il tonno in scatola si limita (mercurio); il fresco no
function tonnoUltimi7(data) {
  const dati = leggiDiario(); let giorni = 0;
  for (let k = 0; k < 7; k++) {
    const dd = addGiorniISO(data, -k);
    if (((dati[dd] || {}).pasti || []).some(p => (p.ingredienti || []).some(i => TONNO_SCATOLA.test(i.nome)))) giorni++;
  }
  return giorni;
}
// Quanto tonno in scatola (g) negli ultimi 7 giorni, oggi compreso. Consigliato: al massimo 160 g a settimana (2 scatolette: il tonno in scatola italiano è per lo più pinna gialla; FDA/EPA indicano 1 porzione da ~113 g per pinna gialla/albacore e 2–3 per il light)
const TONNO_MAX_SETT_G = 160;
function grammiTonnoSettimana(data) {
  const dati = leggiDiario(); let g = 0;
  for (let k = 0; k < 7; k++) ((dati[addGiorniISO(data, -k)] || {}).pasti || []).forEach(p => (p.ingredienti || []).forEach(i => { if (TONNO_SCATOLA.test(i.nome)) g += grammiIng(i) || 0; }));
  return Math.round(g);
}
// il tonno in scatola si propone solo se resti sotto il limite settimanale (scriverlo a mano si può sempre: in quel caso compare un ⚠ sulla riga)
const tonnoOk = (data) => grammiTonnoSettimana(data) < TONNO_MAX_SETT_G;
// al posto del tonno: pesce magro con le stesse proteine
function alternativeTonno(it, k) {
  const A = window.ALIMENTI || {}, tonno = A[it.nome]; if (!tonno) return [];
  return ["Merluzzo", "Nasello", "Branzino", "Orata", "Gamberi"].filter(n => A[n]).slice(0, 4)
    .map(n => ({ nome: n, g: Math.max(20, Math.round((+it.qta || grammiIng(it)) * tonno[1] / A[n][1] / 5) * 5) }));
}
// ⚠ sulla riga del tonno scritto a mano: testo di una riga, o "" se sei nei limiti
function avvisoTonnoRiga(c, it) {
  if (!c || !c.data || !it || !TONNO_SCATOLA.test(it.nome)) return "";
  let tot = grammiTonnoSettimana(c.data);
  if (c.bozza) tot += (c.items || []).filter(x => TONNO_SCATOLA.test(x.nome)).reduce((s, x) => s + (grammiIng(x) || +x.qta || 0), 0);   // la bozza non è ancora nel diario
  return tot > TONNO_MAX_SETT_G ? `Tonno: ${tot} g in 7 giorni · consigliati max ${TONNO_MAX_SETT_G} g` : "";
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Nota di fine giornata (quando tutti i pasti sono inseriti)
// Avvisi sui macro della giornata: carboidrati o grassi oltre l'obiettivo, proteine ancora indietro
function situazioneMacro(data) {
  const T = targetData(data), m = mancaData(data), g = giornoDiario(data);
  if (!g.pasti.length) return null;
  const sopraC = -m.carboidrati > Math.max(10, T.carboidrati * 0.05);
  const sopraG = -m.grassi > Math.max(5, T.grassi * 0.1);
  const indietroP = m.proteine > Math.max(20, T.proteine * 0.2);
  const finitiC = m.carboidrati <= 5, finitiG = m.grassi <= 2;
  // proteine e carboidrati già al loro obiettivo ma calorie ancora da mangiare: sono tutte da grassi (1 g = 9 kcal)
  const raggiunti = m.proteine <= 5 && m.carboidrati <= 8 && m.kcal >= 150 && m.grassi >= 8;
  return { T, m, sopraC, sopraG, indietroP, finitiC, finitiG, raggiunti };
}
// Gli avvisi sono come notifiche: li leggi, tocchi OK e per quell'argomento non tornano più fino a domani.
// Tre argomenti: carboidrati (sia "quasi finiti" sia "oltre"), grassi, proteine. Si mostrano solo per oggi.
const leggiAvvisiVisti = () => { try { return JSON.parse(localStorage.getItem("mp_avvisi")) || {}; } catch (e) { return {}; } };
const avvisoVisto = (data, k, ora) => { const v = leggiAvvisiVisti()[data] || {}; if (k === "carbo" && v.carbo0 !== undefined) return true;
  if (v[k] === undefined) return false;
  return !(typeof ora === "number" && Math.abs(ora) > Math.abs(+v[k]) * 1.15 + 20 && k !== "ritmo");   // se la cosa peggiora di più del 15% (+20 di margine) l'avviso torna
}; // carbo0: nome usato nella versione precedente
// la giornata è "programmata" quando ci sono colazione, pranzo e cena (gli spuntini sono facoltativi)
const giornataPronta = (data) => { const f = new Set(giornoDiario(data).pasti.map(p => p.pasto)); return ["colazione", "pranzo", "cena"].every(p => f.has(p)); };
const sopraKcal = (m) => m.kcal < 0;   // qualsiasi sforamento delle calorie conta come «sopra»
// «⚠ Sopra di N kcal oggi» quando le kcal già registrate nel giorno + quelle che stai per aggiungere (kcalExtra) superano l'obiettivo: si vede mentre componi, con l'anello coperto dal pannello
function sopraGiornoHTML(data, kcalExtra) {
  try { const oltre = Math.round((+kcalExtra || 0) - mancaData(data).kcal); return oltre >= 1 ? `<span class="avv-giorno">⚠ Sopra di ${oltre} kcal${data === oggiISO() ? " oggi" : ""}</span>` : ""; } catch (e) { return ""; }
}
// Quanto di ciò che manca ci sta davvero nelle kcal rimaste (1 g di proteine o carboidrati = 4 kcal, 1 g di grassi = 9): 10 g di grassi con 68 kcal non si possono colmare
function mancantiColmabili(m) { const k = Math.max(0, m.kcal); return { proteine: Math.min(m.proteine, k / 4), carboidrati: Math.min(m.carboidrati, k / 4), grassi: Math.min(m.grassi, k / 9) }; }
function mancaGiornata(data) {   // cosa manca e cosa è sopra rispetto agli obiettivi di tutta la giornata
  const T = targetData(data), m = mancaData(data), c = mancantiColmabili(m), manca = [], sopra = [];
  if (m.proteine > 10 && c.proteine >= 6) manca.push(`${Math.round(c.proteine)} g di proteine`);
  if (m.carboidrati > 15 && c.carboidrati >= 10) manca.push(`${Math.round(c.carboidrati)} g di carboidrati`); else if (-m.carboidrati > Math.max(10, T.carboidrati * 0.05)) sopra.push(`carboidrati +${Math.round(-m.carboidrati)} g`);
  if (m.grassi > 8 && c.grassi >= 3.5) manca.push(`${Math.round(c.grassi)} g di grassi`); else if (-m.grassi > Math.max(5, T.grassi * 0.1)) sopra.push(`grassi +${Math.round(-m.grassi)} g`);
  if (sopraKcal(m)) sopra.push(`kcal +${Math.round(-m.kcal)}`);
  if (!manca.length && !sopra.length && m.kcal > 150) manca.push(`${Math.round(m.kcal)} kcal`);
  const testo = [manca.length ? `Mancano ${manca.join(" · ")}` : "", sopra.length ? `${manca.length ? "sopra: " : "Sopra: "}${sopra.join(" · ")}` : ""].filter(Boolean).join(" — ");
  // calorie a posto ma un macro molto sotto (es. grassi −13 g con le proteine oltre): non è «in linea», si propone di riequilibrare
  if (!sopra.length && !sopraKcal(m) && !(m.proteine > 10)) {
    const squil = [];   // il macro è molto sotto e le kcal rimaste ne coprirebbero meno di 6 decimi: la giornata non è davvero «in linea»
    if (m.grassi >= Math.max(8, T.grassi * 0.25) && c.grassi < m.grassi * 0.6) squil.push({ macro: "grassi", g: Math.round(m.grassi) });
    if (m.carboidrati >= Math.max(20, T.carboidrati * 0.15) && c.carboidrati < m.carboidrati * 0.6) squil.push({ macro: "carboidrati", g: Math.round(m.carboidrati) });
    if (squil.length) return { manca, sopra, squil, squilibrio: true, testo: `Calorie ok · ${squil.map(s => `${s.macro} −${s.g} g`).join(" · ")}`, m, T, ok: false };
  }
  return { manca, sopra, testo, m, T, ok: !manca.length && !sopra.length };
}
// Durante la giornata conta il totale delle kcal, non il singolo pasto: si avvisa solo quando quello che resta
// non basta più (o non permette le proteine) per i pasti ancora da fare. `m` è la situazione da dare alle mosse.
function scartoPasti(data) {
  const T = targetData(data), g = giornoDiario(data), real = mancaData(data);
  const vuoti = momentiGiorno(data).filter(p => !g.pasti.some(x => x.pasto === p) && !pastoPassato(data, p));
  if (!vuoti.length) return { m: real, voce: null };
  const quota = vuoti.reduce((s, p) => s + T.kcal * quotaPasto(data, p), 0);
  const stretto = real.kcal < quota * 0.6;                                                   // restano meno del 60% di ciò che servirebbe ai pasti che mancano
  const proteineDure = real.proteine > 15 && real.proteine * 4 > real.kcal * 0.5;            // le proteine che mancano da sole riempirebbero metà delle kcal rimaste
  const voce = stretto ? { v: real.kcal, testo: `Restano ${Math.max(0, real.kcal)} kcal per ${vuoti.length === 1 ? "l'ultimo pasto" : "gli altri pasti"}`, t: `⚠️ <b>Restano ${Math.max(0, real.kcal)} kcal</b> per ${vuoti.length === 1 ? "l'ultimo pasto" : "gli altri pasti"}` }
    : proteineDure ? { v: real.proteine, testo: `Proteine: ${real.proteine} g in ${real.kcal} kcal`, t: `💪 Proteine <b>${real.proteine} g</b> in ${real.kcal} kcal` } : null;
  const m = stretto ? Object.assign({}, real, { kcal: Math.min(-1, Math.round(real.kcal - quota)) }) : real;   // «sopra» rispetto a ciò che servirebbe: parte la modalità leggera
  return { m, voce };
}
// -------- Movimento consigliato quando sfori le kcal: camminata per poco, allenamento per tanto; un tocco = l'hai fatto, finisce tra gli sport di oggi --------
// Si reintegra la quota del Profilo (es. 80%) delle kcal bruciate: i minuti sono quelli che riportano il giorno in pari.
// l'obiettivo sale a gradini di 50 kcal: si cerca la durata più corta che porta davvero l'obiettivo sopra quanto hai mangiato
function durataPerRientro(data, id, stima, passo, eccesso) {
  const tipo = giornoDiario(data).tipo, ids = sportDelTipo(tipo), dur = durateDelTipo(tipo), ora = TIPI_GIORNATA[tipo].target.kcal;
  for (let v = Math.max(passo, stima - 2 * passo), n = 0; n < 60; v += passo, n++) {
    const d = Object.assign({}, dur, { [id]: v });
    if (TIPI_GIORNATA[chiaveTipo(ids.concat(id), d)].target.kcal - ora >= eccesso) return v;
  }
  return stima;
}
function proposteMovimento(data) {
  if (data !== oggiISO() || !sopraKcal(mancaData(data))) return [];
  const eccesso = -mancaData(data).kcal, pf = leggiProfilo(), q = (pf.recupero || 80) / 100, peso = pf.peso || 59;
  if (eccesso < 30) return [];                                   // sforo minimo: non vale la pena
  const fatti = new Set(sportDelTipo(giornoDiario(data).tipo));
  const r5 = (x) => Math.max(5, Math.round(x / 5) * 5);
  const out = [];
  // senza palestra (si fanno ovunque, anche nel weekend): ognuna con la durata massima che ha senso; le alternative sono a scelta
  const MAX = { camminata: 90, bici: 75, ballo: 40, corpolibero: 45 };   // minuti
  leggiSport().filter(sp => (MAX[sp.id] || sp.id === "corsa") && !fatti.has(sp.id)).forEach(sp => {
    if (sp.perKm) {
      const km = durataPerRientro(data, sp.id, Math.max(1, Math.round(eccesso / (peso * q) * 2) / 2), 0.5, eccesso);
      if (km <= 10) out.push({ id: sp.id, nome: sp.nome, icona: sp.icona, val: km, txt: `${fmtKm(km)} km` });
    } else {
      const min = durataPerRientro(data, sp.id, r5(eccesso / (sp.kMin * peso * q)), 5, eccesso);
      if (min <= MAX[sp.id]) out.push({ id: sp.id, nome: sp.nome, icona: sp.icona, val: min, txt: `${min}′` });
    }
  });
  const cam = leggiSport().find(sp => sp.id === "camminata");
  if (!out.length && cam && !fatti.has("camminata")) out.push({ id: "camminata", nome: cam.nome, icona: cam.icona, val: 60, txt: "60′" });   // sforo enorme: almeno un'ora di camminata, il resto si aggiusta con i pasti
  return out;
}
function camminataHTML(data) {
  const p = proposteMovimento(data);
  if (!p.length) return "";
  const eccesso = Math.round(-mancaData(data).kcal);
  const verbo = (x) => x.id === "camminata" ? `<b>Cammina ${x.txt.replace("′", " min")}</b>` : x.id === "corsa" ? `<b>Corri ${x.txt}</b>` : `<b>${esc(x.nome)} ${x.txt.replace("′", " min")}</b>`;
  return `<div class="sugg-ricette avviso-muovi">${p.map(x => `<button type="button" class="var-furbo lib-furbo" data-muovi="${x.id}:${x.val}">${x.icona} ${verbo(x)}<em>−${eccesso} kcal</em></button>`).join("")}</div>`;
}
function segnaMovimento(id, val) {
  const data = oggiISO(), g = giornoDiario(data), prima = g.tipo;
  const ids = sportDelTipo(prima), dur = durateDelTipo(prima);
  ids.push(id); dur[id] = +val;
  g.tipo = chiaveTipo(ids, dur);
  scriviGiorno(data, g);
  if (!document.getElementById("modal").hidden) closeModal();
  renderOggi();
  avviso("Movimento segnato", "Annulla", () => { const x = giornoDiario(data); x.tipo = prima; scriviGiorno(data, x); renderOggi(); });
}
function avvisiMacroHTML(data) {
  if (data < oggiISO()) return "";
  const s = situazioneMacro(data); if (!s) return "";
  const voci = [];
  const pronta = giornataPronta(data), mg = pronta ? mancaGiornata(data) : null;
  if (!pronta) {
  if (s.sopraC) voci.push({ k: "carbo", v: -s.m.carboidrati, t: `⚠️ Carboidrati <b>+${-s.m.carboidrati} g</b>` });
  else if (s.finitiC && !s.raggiunti) voci.push({ k: "carbo", v: 0, t: `🌾 Carboidrati finiti` });
  if (s.sopraG) voci.push({ k: "grassi", v: -s.m.grassi, t: `⚠️ Grassi <b>+${-s.m.grassi} g</b>` });
  if (s.raggiunti) voci.push({ k: "grassiResto", v: s.m.kcal, t: `🥑 Restano <b>${s.m.kcal} kcal</b>: grassi buoni` });
  }
  if (!pronta && sopraKcal(mancaData(data))) voci.push({ k: "manca", v: Math.round(mancaData(data).kcal), t: `⚠️ <b>Sopra di ${-mancaData(data).kcal} kcal</b>` });
  if (!pronta && !sopraKcal(mancaData(data))) { const sp = scartoPasti(data); if (sp.voce) voci.push({ k: "ritmo", v: sp.voce.v, t: sp.voce.t }); }   // durante la giornata: pasti fatti fuori quota
  if (pronta && !mg.ok) voci.push({ k: "manca", v: Math.round(mancaData(data).kcal), t: `🎯 <b>${esc(mg.testo)}</b>` });
  const PRIORITA = { manca: 0, ritmo: 1, carbo: 2, grassi: 3, grassiResto: 4 };   // un avviso alla volta: il più importante; l'informativo «carboidrati quasi finiti» (senza azione) non si mostra più
  const daMostrare = voci.filter(x => !(x.k === "carbo" && x.v === 0) && !avvisoVisto(data, x.k, x.v)).sort((p, q) => (PRIORITA[p.k] ?? 9) - (PRIORITA[q.k] ?? 9)).slice(0, 1);
  return daMostrare.length ? `<div class="oggi-avvisi">${daMostrare.map(x => (x.k === "manca" || x.k === "ritmo" || ((x.k === "carbo" || x.k === "grassi") && x.v > 0))
    ? `<p class="avviso avviso-tocca" data-avviso-cosa="${x.k}" role="button"><span>${x.t}</span><span class="avviso-freccia">›</span><button class="avviso-ok" data-avviso-ok="${x.k}" data-v="${x.v}" hidden>OK</button></p>`
    : `<p class="avviso"><span>${x.t}</span><button class="avviso-ok" data-avviso-ok="${x.k}" data-v="${x.v}">OK</button></p>`).join("")}</div>` : "";
}
// -------- "Cosa aggiungo?": dall'avviso delle proteine, idee per i prossimi pasti, e scegli tu dove metterle --------
function aggiungiAlimentoAlPasto(data, pasto, nome, grammi) {
  const g = giornoDiario(data);
  const p = { nome, pasto, passaggi: [], ingredienti: [{ nome, qta: grammi, unita: "g", lock: true, cercato: nome }] };
  aggiornaMacro(p);
  g.pasti.push(p); scriviGiorno(data, g);
  return g.pasti.length - 1;
}
function aggiungiRicettaIn(data, pasto, nomeRicetta) {
  const r = ricette.find(x => x.nome === nomeRicetta && x.pasto === (pasto === "mattina" ? "spuntino" : pasto)) || ricette.find(x => x.nome === nomeRicetta);
  if (!r) return -1;
  const ps = porzioneSuMisura(r, targetResiduoPasto(data, pasto));
  const g = giornoDiario(data);
  const p = { nome: ps.nome, pasto, passaggi: [], ricetta: r.nome, nPezzi: ps.k, ingredienti: ps.items.map(x => ({ nome: x.nome, qta: qtaPezziInteri(x.nome, unitaDi({ nome: x.nome }), x.qta), unita: "g", lock: true, cercato: x.cercato })) };   // tortilla, piadina…: pezzi interi
  aggiornaMacro(p);
  g.pasti.push(p); scriviGiorno(data, g);
  return g.pasti.length - 1;
}
let cosaGiro = {};   // per ogni pasto, quante volte hai toccato ↻ (altre idee)
const ICONA_ALTRE = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4C7.58 4 4.01 7.58 4.01 12S7.58 20 12 20c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
// le mosse possibili su un pasto già scritto: quelle del "consiglio furbo" che riempiono quello che manca (mai sopra calorie e macro della giornata)
function mosseCosaAggiungere(data, p, m) {
  const T = targetData(data);
  const cm = mancantiColmabili(m), mP = m.proteine > 10 && cm.proteine >= 6, mC = m.carboidrati > 15 && cm.carboidrati >= 10, mG = m.grassi > 8 && cm.grassi >= 3.5;   // si propone solo ciò che nelle kcal rimaste si può davvero colmare
  const oC = -m.carboidrati > Math.max(10, T.carboidrati * 0.05), oG = -m.grassi > Math.max(5, T.grassi * 0.1), oK = sopraKcal(m);
  const solo = !mP && !mC && !mG && !oC && !oG && !oK;
  // utile: aggiunge ciò che manca, oppure toglie ciò che è sopra
  const utile = (d) => (mP && d.proteine >= Math.min(5, cm.proteine * 0.6)) || (mC && d.carboidrati >= Math.min(8, Math.max(3, cm.carboidrati * 0.35))) || (mG && d.grassi >= Math.min(5, cm.grassi * 0.5)) || (oC && d.carboidrati <= -6) || (oG && d.grassi <= -4) || (oK && d.kcal <= -20) || (solo && d.kcal >= 60);
  const out = [];
  const ctx = { data, pasto: p, items: [], target: () => targetPastoDiario(data, p) };
  let e = null; try { e = elencoConsigli(ctx, { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 }); } catch (er) {}
  // sforamento: alleggerire i pasti già scritti (riduci o togli) ciò che pesa di più su carboidrati, grassi e calorie, senza perdere le proteine che servono
  if (oC || oG || oK) {
    const A = window.ALIMENTI || {}, r5 = (x) => Math.round(x / 5) * 5;
    const eccesso = (d) => (oC ? Math.min(-d.carboidrati, -m.carboidrati) * 1.5 : 0) + (oG ? Math.min(-d.grassi, -m.grassi) * 3 : 0) + (oK ? Math.min(-d.kcal, -m.kcal) * 0.15 : 0) - (mP ? Math.max(0, -d.proteine) * 2.5 : Math.max(0, -d.proteine) * 0.5);
    const ridu = [];
    try { ingredientiPastoTutti(data, p).forEach(r => {
      if (!A[r.nome] || r.qta < 15) return;
      const mac = (g) => macroAlimento(r.nome, g);   // kcal 4/4/9 come nel diario
      const cur = mac(r.qta);
      let best = null;
      const eccTot = (oC ? -m.carboidrati * 1.5 : 0) + (oG ? -m.grassi * 3 : 0) + (oK ? -m.kcal * 0.15 : 0);
      const condimento = A[r.nome][3] >= 30 || r.qta < 25;   // olio, frutta secca, burro… si possono anche togliere; riso, pasta, carne si riducono soltanto
      for (const f of [0.8, 0.65, 0.5, 0.35, 0]) {
        const nuova = f ? qtaPezziInteri(r.nome, "pz", r5(r.qta * f)) : 0; if (f && (nuova < 5 || nuova >= r.qta)) continue;
        if ((f < 0.5 && f > 0 || f === 0) && !condimento) continue;
        const n = mac(nuova), d = { kcal: n.kcal - cur.kcal, proteine: n.proteine - cur.proteine, carboidrati: n.carboidrati - cur.carboidrati, grassi: n.grassi - cur.grassi };
        const kPf = A[r.nome][1] * 4 / Math.max(1, A[r.nome][0]);   // quanta parte delle calorie sono proteine: riso e pasta ne hanno poche, pollo e pesce molte
        if (!utile(d) || -d.proteine > (kPf >= 0.25 ? (mP ? 2 : Math.max(0, -m.proteine) + 3) : 10)) continue;   // togliere proteine che servono non va bene (a meno che siano poche, di riso o pasta: si recuperano altrove)
        const v = eccesso(d);
        best = { nuova, d, v, f };
        if (v >= eccTot * 0.5) break;   // la riduzione più piccola che sistema metà dello sforamento
      }
      if (best && best.v > 0) ridu.push({ r, ...best });
    }); } catch (er) {}
    ridu.sort((a, b) => b.v - a.v).forEach(x => {
      const nome = esc(x.r.nome.toLowerCase());
      out.push(x.nuova ? { key: `${p}|por|${x.r.rif[0]}|${x.r.rif[1]}|${x.nuova}`, testa: `Porta <b>${nome}</b> da ${Math.round(x.r.qta)} a <b>${x.nuova} g</b>`, d: x.d }
        : { key: `${p}|tol|${x.r.rif[0]}|${x.r.rif[1]}`, testa: `Togli <b>${nome}</b> (${Math.round(x.r.qta)} g)`, d: x.d });
    });
  }
  // verdura: nei pasti principali ci deve essere una fonte di fibre (non prima dell'allenamento), pesa pochissimo
  if (!oK && (p === "pranzo" || p === "cena") && !(typeof preSera === "function" && p === "spuntino" && preSera(data))) {   // sopra le kcal non si aggiunge nemmeno la verdura
    const X = window.NUTRIENTI_EXTRA || {}, A2 = window.ALIMENTI || {};
    const righe = (() => { try { return ingredientiRegistrati(ctx); } catch (er) { return []; } })();
    if (righe.length && !righe.some(r => /zucchin|spinac|brocc|insalat|pomodor|carot|finocch|peperon|cetriol|rucola|asparag|fagiolin|cavol|melanzan|funghi|zucca|radicchio|bietol|cipoll|lattuga|verdur|ceci|lentic|fagioli|piselli|edamame|carciof|porri|sedano|rapa|spugnole|bimi/i.test(r.nome))) {
      const liberi = VERDURE_CONSIGLI.filter(v => A2[v] && !righe.some(r => r.nome === v));
      const n = liberi.length ? liberi[hashStr(data + p) % liberi.length] : null;
      if (n) out.push({ key: `${p}|agg|${n}|150`, testa: `Aggiungi <b>150 g di ${esc(n.toLowerCase())}</b>`, d: macroAlimento(n, 150), verdura: true });
    }
  }
  (e ? e.scelte : []).filter(a => a.tipo !== "verdura" && utile(a.d)).forEach(a => {
    if (a.tipo === "aggiungi") out.push({ key: `${p}|agg|${a.n}|${a.g}`, testa: `Aggiungi <b>${a.g} g di ${esc(a.n.toLowerCase())}</b>`, d: a.d });
    else if (a.tipo === "porta") out.push({ key: `${p}|por|${a.r.rif[0]}|${a.r.rif[1]}|${a.nuova}`, testa: `Porta <b>${esc(a.r.nome.toLowerCase())}</b> da ${Math.round(a.r.qta)} a <b>${a.nuova} g</b>`, d: a.d });
    else if (a.tipo === "cambia") out.push({ key: `${p}|cam|${a.r.rif[0]}|${a.r.rif[1]}|${a.a}|${a.g || 0}`, testa: `Cambia <b>${esc(a.r.nome.toLowerCase())}</b> (${Math.round(a.r.qta)} g) con <b>${a.g ? a.g + " g di " : ""}${esc(a.a.toLowerCase())}</b>`, d: a.d });
  });
  // macro quasi a posto ma restano kcal: piccoli completamenti (grassi per primi), mai oltre quello che resta; nel pre-workout niente grassi
  if (solo && m.kcal >= 60) out.push(...piccoliCompletamenti(data, p, m));
  return out.filter((x, i, a) => a.findIndex(y => y.key === x.key) === i);
}
// Piccoli completamenti: poche kcal da riempire (macro a posto, oppure qualche grammo di grassi/carboidrati/proteine che manca).
// Quantità piccole (anche 5 g di olio o 4 anacardi), mai oltre le kcal che restano; prima ciò che colma il macro che manca. Nel pre-workout niente grassi.
const POOL_COMPLETAMENTI = [
  ["Olio EVO", [3, 5, 8, 10], "g"], ["Anacardi", [5, 7, 9, 11, 15], "n"], ["Mandorle", [5, 7, 10, 15, 20], "n"], ["Noci", [5, 8, 10, 15], "g"], ["Avocado", [20, 30, 50], "g"],
  ["Yogurt greco 0%", [50, 100, 150], "g"], ["Albume", [50, 100], "g"], ["Fesa di tacchino", [20, 30, 50], "g"],
  ["Banana", [40, 60, 100], "g"], ["Mela", [80, 100, 150], "g"], ["Gallette di riso", [8, 16], "g"],
];
function piccoliCompletamenti(data, p, m) {
  const A = window.ALIMENTI || {}, pre = p === "spuntino" && typeof preSera === "function" && preSera(data);
  const cm = mancantiColmabili(m), manca = { proteine: m.proteine > 4 ? cm.proteine : 0, carboidrati: m.carboidrati > 5 ? cm.carboidrati : 0, grassi: m.grassi > 2 ? cm.grassi : 0 };
  const qualcosa = manca.proteine + manca.carboidrati + manca.grassi > 0;
  const out = [];
  POOL_COMPLETAMENTI.forEach(([n, grammi, modo]) => {
    if (!A[n] || MAI_CONSIGLIATI.test(n)) return;
    let best = null;
    grammi.forEach(g => {
      const dd = macroAlimento(n, g);   // kcal 4/4/9 come nel diario
      if (dd.kcal < Math.min(25, m.kcal * 0.4) || dd.kcal > m.kcal + 10) return;
      if (dd.grassi > Math.max(m.grassi, 0) + 2 || dd.carboidrati > Math.max(m.carboidrati, 0) + 4 || dd.proteine > Math.max(m.proteine, 0) + 4) return;
      if (pre && dd.grassi > 3) return;
      // quanto colma ciò che manca (se manca qualcosa), altrimenti quante kcal riempie
      const v = qualcosa ? Math.min(dd.grassi, manca.grassi) * 9 + Math.min(dd.carboidrati, manca.carboidrati) * 4 + Math.min(dd.proteine, manca.proteine) * 4 : dd.kcal;
      if (qualcosa && v < 12) return;
      if (!best || v > best.v || (v === best.v && dd.kcal < best.d.kcal)) best = { g, d: dd, v };
    });
    if (!best) return;
    const pz = modo === "n" && (window.PESO_PZ || {})[n], k = pz ? Math.round(best.g / pz) : 0;
    const testa = k >= 2 ? `Aggiungi <b>${k} ${esc(n.toLowerCase())}</b> (${best.g} g)` : `Aggiungi <b>${best.g} g di ${esc(n.toLowerCase())}</b>`;
    out.push({ key: `${p}|agg|${n}|${best.g}`, testa, d: best.d, _v: best.v });
  });
  return out.sort((a, b) => b._v - a._v);
}
// i pasti ancora vuoti: ricette che ci stanno (calorie e macro che restano, quota del pasto) e riempiono quello che manca; senza ripetere base o proteina già nei pasti scritti
function ideeCosaAggiungere(data, p, m, usate, basiC, basiP) {
  const T = targetData(data), Tp = targetPastoDiario(data, p), pre = p === "spuntino" && preSera(data);
  if (m.kcal < 120 || sopraKcal(m)) return [];
  const mP = m.proteine > 10, mC = m.carboidrati > 15, mG = m.grassi > 8;
  const spuntino = p === "mattina" || p === "spuntino";
  const ci = (t) => t.kcal <= m.kcal + 15 && t.carboidrati <= m.carboidrati + 1 && t.grassi <= m.grassi + 1 && t.kcal <= Tp.kcal * 1.1 + 15 && !(pre && t.grassi > 6) && !(spuntino && t.kcal > 300);   // gli spuntini restano spuntini
  const pool = ricetteConsigliate(data, p, 14).filter(x => !ricettaEsclusa(x.r) && !usate.has(x.r.nome) && ci(x.tot));
  pool.forEach(x => { const o = x.r._orig || x.r, c = rilevaBaseCarbo(o), pr = rilevaBaseProt(o); x._pun = (mP ? x.tot.proteine : 0) + (mC && !mP ? x.tot.carboidrati : 0) + (mG && !mP && !mC ? x.tot.grassi * 2 : 0) - (c && basiC.has(c) ? 1000 : 0) - (pr && basiP.has(pr) ? 25 : 0); });
  pool.sort((a, b) => b._pun - a._pun);
  return pool.map(x => ({ key: `${p}|ric|${x.r.nome}`, testa: `<b>${esc(x.nome)}</b>`, d: x.tot, nome: x.r.nome }));
}
// Piatti fatti con singoli alimenti che stanno bene insieme: una fonte di proteine (P), una di carboidrati (C), grassi buoni (F) e verdura o frutta (V, quantità fissa).
// Le quantità si calcolano sull'obiettivo del pasto, così non si sfora.
const PIATTI_COMPOSTI = {
  colazione: [
    { P: "Yogurt greco 0%", C: "Fiocchi d'avena", F: "Mandorle", V: ["Frutti rossi", 100] },
    { P: "Yogurt greco 0%", C: "Pane integrale", F: "Noci", V: ["Banana", 100] },
    { P: "Fiocchi di latte", C: "Pane integrale", F: "Mandorle", V: ["Mela", 120] },
    { P: "Yogurt greco 0%", C: "Fiocchi d'avena", F: "Noci", V: ["Kiwi", 100] },
  ],
  spuntino: [
    { P: "Yogurt greco 0%", C: "Banana", F: "Mandorle" },
    { P: "Yogurt greco 0%", C: "Mela", F: "Noci" },
    { P: "Fiocchi di latte", C: "Gallette di riso", F: "Mandorle" },
  ],
  pre: [   // prima dell'allenamento: niente grassi né fibre
    { P: "Yogurt greco 0%", C: "Banana" },
    { P: "Yogurt greco 0%", C: "Gallette di riso", V: ["Miele", 10] },
    { P: "Fiocchi di latte", C: "Pane bianco" },
  ],
  principale: [
    { P: "Petto di pollo", C: "Riso integrale cotto", F: "Olio EVO", V: ["Zucchine", 200] },
    { P: "Fesa di tacchino", C: "Patate lesse", F: "Olio EVO", V: ["Spinaci", 200] },
    { P: "Merluzzo", C: "Quinoa cotta", F: "Olio EVO", V: ["Broccoli", 200] },
    { P: "Nasello", C: "Couscous cotto", F: "Avocado", V: ["Insalata", 100] },
    { P: "Gamberi", C: "Riso basmati cotto", F: "Olio EVO", V: ["Fagiolini", 200] },
    { P: "Tofu", C: "Quinoa cotta", F: "Olio EVO", V: ["Zucchine", 200] },
    { P: "Petto di pollo", C: "Patate lesse", F: "Avocado", V: ["Insalata", 100] },
    { P: "Merluzzo", C: "Riso basmati cotto", F: "Olio EVO", V: ["Pomodoro", 150] },
  ],
};
function piattoComposto(data, pasto, T, scarta = () => false, giro = 0) {
  const A = window.ALIMENTI || {};
  const pre = pasto === "spuntino" && preSera(data) || (pasto === "mattina" && conSport(data) && orarioAllen(data) === "mattina");
  const chiave = pasto === "principale" ? "principale" : pre ? "pre" : (pasto === "pranzo" || pasto === "cena") ? "principale" : pasto === "colazione" ? "colazione" : "spuntino";
  const lista = PIATTI_COMPOSTI[chiave].filter(t => !scarta(t) && [t.P, t.C, t.F, t.V && t.V[0]].filter(Boolean).every(n => A[n]));
  if (!lista.length) return null;
  const costruisci = (t) => {
    const per = (n, g, i) => A[n][i] * g / 100;
    let gp = 0, gc = 0, gf = 0;
    const gv = t.V ? t.V[1] : 0;
    const altro = (i, esclusi) => (t.V ? per(t.V[0], gv, i) : 0) + [["P", gp], ["C", gc], ["F", gf]].filter(([k]) => k !== esclusi && t[k]).reduce((a, [k, g]) => a + per(t[k], g, i), 0);
    const maxP = (typeof GRAMMI_MAX_FONTI !== "undefined" ? GRAMMI_MAX_FONTI : {})[t.P] || 250;
    for (let k = 0; k < 25; k++) {
      gp = Math.max(0, Math.min(maxP, (T.proteine - altro(1, "P")) / (A[t.P][1] / 100)));
      gc = t.C ? Math.max(0, (T.carboidrati - altro(2, "C")) / (A[t.C][2] / 100)) : 0;
      gf = t.F ? Math.max(0, (T.grassi - altro(3, "F")) / (A[t.F][3] / 100)) : 0;
    }
    const r5 = (x) => Math.round(x / 5) * 5;
    const maxF = { "Avocado": 80, "Olio EVO": 20, "Mandorle": 30, "Noci": 30 };
    gp = r5(gp); gc = r5(gc); gf = t.F ? Math.min(Math.floor(gf / 5) * 5, maxF[t.F] || 30) : 0;
    if (gc < 20) gc = 0;   // pochi carboidrati da aggiungere: bastano quelli della frutta e del resto
    const righe = () => [[t.P, gp], [t.C, gc], [t.F, gf], t.V || [null, 0]].filter(([n, g]) => n && g > 0);
    const tot = () => righe().reduce((a, [n, g]) => ({ kcal: a.kcal + per(n, g, 0), proteine: a.proteine + per(n, g, 1), carboidrati: a.carboidrati + per(n, g, 2), grassi: a.grassi + per(n, g, 3) }), { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 });
    for (let k = 0; k < 20 && tot().kcal > T.kcal + 30 && gc >= 10; k++) gc -= 5;   // l'arrotondamento non deve far sforare
    for (let k = 0; k < 20 && tot().grassi > T.grassi + 0.5 && gf >= 5; k++) gf -= 5;
    if (gp < 40) return null;   // senza una porzione sensata di proteine non è un piatto
    const tt = tot(), sopra = Math.max(0, tt.grassi - T.grassi) * 3 + Math.max(0, tt.carboidrati - T.carboidrati) * 1.5 + Math.max(0, tt.kcal - T.kcal - 30) * 0.15;
    const x = { nome: "", pasto: pasto === "principale" ? "pranzo" : pasto, passaggi: [], ingredienti: righe().map(([n, g]) => ({ nome: n, qta: g, unita: "g", lock: true, cercato: n })) };
    rinominaLibero(x);
    return { piatto: x, tot: tt, base: t.P, sopra };
  };
  // il primo abbinamento (a rotazione) che sta dentro i limiti; se nessuno ci sta, quello che sfora meno
  const n0 = (hashStr(data + pasto) + giro) % lista.length;
  let migliore = null;
  for (let k = 0; k < lista.length; k++) {
    const c = costruisci(lista[(n0 + k) % lista.length]);
    if (!c) continue;
    if (c.sopra <= 0.3) return c;
    if (!migliore || c.sopra < migliore.sopra) migliore = c;
  }
  return migliore;
}
// la ricetta ci sta se non fa sforare grassi, carboidrati e calorie di quello che resta (e dà proteine a sufficienza)
function ricettaCi(tot, T, rem, stretto) {
  const [g, c, k] = stretto ? [0.5, 1, 30] : [3, 8, 45];   // con la tolleranza larga il ritocco finale delle dosi rimette tutto nei valori
  return tot.grassi <= Math.min(T.grassi, rem.grassi) + g && tot.carboidrati <= Math.min(T.carboidrati, rem.carboidrati) + c
    && tot.kcal <= Math.min(T.kcal, rem.kcal) + k && (T.proteine < 8 || tot.proteine >= T.proteine * 0.9);
}
// Controllo finale: un giorno compilato non deve mai sforare grassi, carboidrati e calorie. Se succede, si ritoccano di poco (al massimo 20%) le dosi dei pasti appena compilati
function rifinisciGiorno(data, slot) {
  const A = window.ALIMENTI || {};
  const sfora = () => { const m = mancaData(data); return m.grassi < 0 || m.carboidrati < 0 || m.kcal < -KCAL_EXTRA; };
  const eccesso = () => { const m = mancaData(data); return Math.max(0, -m.grassi) * 3 + Math.max(0, -m.carboidrati) * 1.5 + Math.max(0, -m.kcal - KCAL_EXTRA) * 0.15; };
  const orig = new Map();
  for (let giro = 0; giro < 60 && sfora(); giro++) {
    const g = giornoDiario(data), prima = eccesso();
    let best = null;
    g.pasti.forEach((p, pi) => { if (!(slot.has(p.pasto) && p.auto)) return;
      (p.ingredienti || []).forEach((ing, ii) => {
        const a = A[ing.nome]; if (!a || ing.unita === "q.b." || !(ing.qta > 0)) return;
        const k = pi + "|" + ii, base = orig.get(k) || ing.qta;
        const passo = a[3] >= 30 ? 2 : (ing.unita === "pz" ? 1 : 5);
        if (ing.qta - passo < base * 0.75 || ing.qta - passo < 0) return;
        const prova = JSON.parse(JSON.stringify(g)); prova.pasti[pi].ingredienti[ii].qta = ing.qta - passo; aggiornaMacro(prova.pasti[pi]);
        const gg = leggiDiario(); const salvato = gg[data]; gg[data] = prova; salvaDiario(gg);
        const dopo = eccesso(), perso = Math.max(0, (a[1] * (passo / 100)) * (ing.unita === "pz" ? (window.PESO_PZ || {})[ing.nome] || 1 : 1));
        gg[data] = salvato; salvaDiario(gg);
        const v = (prima - dopo) - perso * (a[1] >= 15 ? 2 : 0.3);   // le fonti di proteine si toccano per ultime
        if (prima - dopo > 0 && (!best || v > best.v)) best = { pi, ii, k, base, v, nuova: ing.qta - passo };
      });
    });
    if (!best) break;
    orig.set(best.k, best.base);
    g.pasti[best.pi].ingredienti[best.ii].qta = best.nuova; aggiornaMacro(g.pasti[best.pi]);
    scriviGiorno(data, g);
  }
}
const KCAL_EXTRA = 0;   // niente sforamenti: ogni kcal sopra viene segnalata (prima si tollerava +50 per arrivare alle proteine)
// Le proteine hanno la precedenza: se mancano, si alza una fonte magra già presente o se ne aggiunge una (skyr negli spuntini, albume ai pasti), senza far sforare grassi e carboidrati
function completaProteine(data, slot) {
  const A = window.ALIMENTI || {}, MAX = typeof GRAMMI_MAX_FONTI !== "undefined" ? GRAMMI_MAX_FONTI : {};
  const ok = () => { const m = mancaData(data); return m.grassi >= 0 && m.carboidrati >= 0 && m.kcal >= -KCAL_EXTRA; };
  const prova = (modifica) => {
    const g = giornoDiario(data), copia = JSON.parse(JSON.stringify(g));
    if (!modifica(g)) return false;
    g.pasti.forEach(p => aggiornaMacro(p)); scriviGiorno(data, g);
    if (ok()) return true;
    scriviGiorno(data, copia); return false;   // sforava: si torna indietro
  };
  for (let giro = 0; giro < 25 && mancaData(data).proteine > 2; giro++) {
    const fatto =
      // 1) una fonte magra già nel piatto: qualche grammo in più
      prova(g => { for (const p of g.pasti) { if (!(slot.has(p.pasto) && p.auto)) continue; for (const i of p.ingredienti || []) { const a = A[i.nome];
        if (a && a[1] >= 15 && a[3] <= 4 && i.unita === "g" && i.qta + 10 <= (MAX[i.nome] || 250)) { i.qta += 10; return true; } } } return false; })
      // 2) yogurt greco in uno spuntino o a colazione
      || prova(g => { const p = g.pasti.find(x => slot.has(x.pasto) && x.auto && ["spuntino", "mattina", "colazione"].includes(x.pasto) && !(x.ingredienti || []).some(i => i.nome === "Yogurt greco 0%")); if (!p) return false; p.ingredienti.push({ nome: "Yogurt greco 0%", qta: 50, unita: "g", lock: true, cercato: "Yogurt greco 0%" }); return true; })
      // 3) albume a pranzo o a cena
      || prova(g => { const p = g.pasti.find(x => slot.has(x.pasto) && x.auto && ["cena", "pranzo"].includes(x.pasto) && !(x.ingredienti || []).some(i => i.nome === "Albume")); if (!p) return false; p.ingredienti.push({ nome: "Albume", qta: 60, unita: "g", lock: true, cercato: "Albume" }); return true; });
    if (!fatto) break;
  }
}
// Quando cambia l'obiettivo di un giorno (calorie spostate, allenamento diverso, recupero) i pasti compilati dall'app si adattano:
// si ritoccano di poco le dosi (carboidrati e grassi mai oltre l'obiettivo, proteine prima di tutto); i piatti restano gli stessi
function ingrandisciGiorno(data, slot) {
  const A = window.ALIMENTI || {}, PZ = window.PESO_PZ || {};
  const ok = () => { const m = mancaData(data); return m.grassi >= 0 && m.carboidrati >= 0 && m.kcal >= -KCAL_EXTRA; };
  const orig = new Map(), bloccati = new Set();
  for (let giro = 0; giro < 90; giro++) {
    const m = mancaData(data);
    if (m.carboidrati <= 3 && m.grassi <= 2 && m.kcal <= 40) break;
    const g = giornoDiario(data); let best = null;
    g.pasti.forEach((p, pi) => { if (!(slot.has(p.pasto) && p.auto) || pastoPassato(data, p.pasto)) return;
      (p.ingredienti || []).forEach((ing, ii) => {
        const a = A[ing.nome], k = pi + "|" + ii; if (!a || ing.unita === "q.b." || !(ing.qta > 0) || bloccati.has(k)) return;
        const base = orig.get(k) || ing.qta, passo = a[3] >= 30 ? 2 : ing.unita === "pz" ? 0.5 : 5;
        if (ing.qta + passo > base * 1.35) return;
        const gr = ing.unita === "pz" ? passo * (PZ[ing.nome] || 0) : passo, dC = a[2] * gr / 100, dG = a[3] * gr / 100, dK = a[0] * gr / 100;
        const v = (m.carboidrati > 3 ? dC : 0) + (m.grassi > 2 ? dG * 2 : 0) + (m.kcal > 40 ? dK * 0.05 : 0);
        if (v > 0 && (!best || v > best.v)) best = { pi, ii, k, base, passo, v };
      });
    });
    if (!best) break;
    const copia = JSON.parse(JSON.stringify(g)), ing = g.pasti[best.pi].ingredienti[best.ii];
    orig.set(best.k, best.base); ing.qta += best.passo; aggiornaMacro(g.pasti[best.pi]); scriviGiorno(data, g);
    if (!ok()) { scriviGiorno(data, copia); bloccati.add(best.k); }   // sforava: quell'alimento non si ritocca più
  }
}
function riadattaSettimana(dataRif) {
  const prima = {};   // giorno → com'era, per l'Annulla (solo i giorni che cambiano davvero)
  const oggi = oggiISO(), lun = (x) => addGiorniISO(x, -indiceSettimana(x));
  [...new Set([lun(dataRif), lun(oggi)])].forEach(l => dateSettimanaDi(l).forEach(d => {
    if (d < oggi) return;
    const slot = new Set(giornoDiario(d).pasti.filter(p => p.auto && !pastoPassato(d, p.pasto)).map(p => p.pasto));
    if (!slot.size) return;
    const orig = JSON.stringify(leggiDiario()[d] || null);
    const m0 = mancaData(d);
    if (m0.grassi >= 0 && m0.carboidrati >= 0 && m0.kcal <= 40 && m0.kcal >= -KCAL_EXTRA && m0.proteine <= 2) return;   // già nei valori: niente da ritoccare
    rifinisciGiorno(d, slot); ingrandisciGiorno(d, slot); completaProteine(d, slot); rifinisciGiorno(d, slot);
    const m = mancaData(d);
    if (m.grassi < 0 || m.carboidrati < 0) {   // cambio troppo grande per ritoccare le dosi: quei pasti si rifanno con piatti che stanno nel nuovo obiettivo
      const g = giornoDiario(d); g.pasti = g.pasti.filter(p => !(slot.has(p.pasto) && p.auto)); scriviGiorno(d, g);
      pianificaSettimana(d, d, { stretto: true });
    }
    if (JSON.stringify(leggiDiario()[d] || null) !== orig) prima[d] = orig;
  }));
  return prima;
}
// Quello che mangi di solito si capisce dal diario: gli alimenti dei pasti che hai scritto tu negli ultimi due mesi (e quelli che hai spuntato nella spesa)
function alimentiAbituali() {
  const d = leggiDiario(), oggi = oggiISO(), da = addGiorniISO(oggi, -60), set = new Set(); let giorni = 0;
  Object.keys(d).filter(x => x >= da && x <= oggi).forEach(x => { const pasti = ((d[x] || {}).pasti || []).filter(p => !p.auto); if (pasti.length) giorni++; pasti.forEach(p => (p.ingredienti || []).forEach(i => set.add(i.nome))); });
  if (typeof leggiInCasa === "function") leggiInCasa().forEach(n => set.add(n.toLowerCase()));
  return { set, giorni };
}
// -------- Settimana già pronta --------
// Riempie i momenti ancora vuoti dei giorni da oggi a domenica con le ricette: porzioni su misura, così ogni giornata torna con i macro;
// varietà (poche ripetizioni nella settimana, base di carboidrati e proteine diverse nello stesso giorno) e preferenza per ciò che hai in casa
function pianificaSettimana(dataRif, soloData, opz = {}) {   // soloData: compila un giorno solo (il resto della settimana serve per la varietà)
  const p = pianoSettimana(dataRif), oggi = oggiISO(), giorni = p.date.filter(d => d >= oggi && (!soloData || d === soloData));
  const prima = {}; giorni.forEach(d => { prima[d] = JSON.stringify(leggiDiario()[d] || null); });
  const incasa = new Set((typeof leggiInCasa === "function" ? leggiInCasa() : []).map(x => x.toLowerCase()));
  const abit = alimentiAbituali(), conosco = abit.giorni >= 7 && abit.set.size >= 15;   // con poco diario non si può dire cosa non usi
  const usate = {};   // ricetta → in che giorni (indice) è già comparsa
  p.date.forEach((d, i) => giornoDiario(d).pasti.forEach(x => { if (x.ricetta) (usate[x.ricetta] ||= []).push(i); }));
  let messe = 0; const aggiunti = {};
  p.date.forEach((d, i) => {
    if (d < oggi || (soloData && d !== soloData)) return;
    if (!soloData && giornoDiario(d).pasti.length) return;   // la settimana compila i giorni ancora vuoti; un giorno già iniziato resta com'è (per quello c'è ✨ in Oggi)
    const slot = momentiGiorno(d).filter(x => !opz.soloSlot || x === opz.soloSlot);
    slot.forEach(s => {
      if (giornoDiario(d).pasti.some(x => x.pasto === s) || pastoPassato(d, s)) return;
      const gOggi = giornoDiario(d).pasti, basiC = new Set(gOggi.map(x => rilevaBaseCarbo(x)).filter(Boolean)), basiP = new Set(gOggi.map(x => rilevaBaseProt(x)).filter(Boolean));
      const Tp = targetPastoDiario(d, s), rem = mancaData(d);
      if (Tp.kcal < 80) return;
      const cand = ricetteConsigliate(d, s, 30).filter(x => !ricettaEsclusa(x.r) && !(opz.escludi && opz.escludi.has(x.r.nome)) && ricettaCi(x.tot, Tp, rem, opz.stretto));
      const scelta = cand.map(x => {
        const o = x.r._orig || x.r, c = rilevaBaseCarbo(o), pr = rilevaBaseProt(o), ing = o.ingredienti.filter(g => g.unita !== "q.b.");
        const uso = usate[x.r.nome] || [];
        let punti = x.p + uso.length * 0.8 + (uso.some(k => Math.abs(k - i) <= 2) ? 1.8 : 0) + (c && basiC.has(c) ? 0.8 : 0) + (pr && basiP.has(pr) ? 0.6 : 0);
        punti -= 0.5 * (ing.length ? ing.filter(g => incasa.has(g.nome.toLowerCase())).length / ing.length : 0);
        if (conosco) punti += Math.min(1.5, 0.5 * ing.filter(g => !abit.set.has(g.nome) && !abit.set.has(g.nome.toLowerCase())).length);   // alimenti che di solito non mangi: meno probabili
        return { x, punti: punti + (hashStr(d + s + x.r.nome + (opz.seme || "")) % 100) / 400 };
      }).sort((a, b) => a.punti - b.punti)[0];
      if (!scelta) {   // nessuna ricetta sta nei limiti: un piatto con singoli alimenti sul tuo obiettivo
        const prot = new Set(gOggi.flatMap(x => (x.ingredienti || []).map(g => g.nome)));
        const c = piattoComposto(d, s, Tp, t => prot.has(t.P) || (opz.escludi && opz.escludi.has(t.P)), (usate["§" + s] || []).length + (opz.seme || 0));
        if (!c) return;
        c.piatto.auto = true; const g = giornoDiario(d); g.pasti.push(c.piatto); scriviGiorno(d, g);
        (usate["§" + s] ||= []).push(i); messe++; (aggiunti[d] ||= new Set()).add(s); return;
      }
      if (aggiungiRicettaIn(d, s, scelta.x.r.nome) < 0) return;
      { const gg = giornoDiario(d), pp = gg.pasti.filter(x => x.pasto === s && x.ricetta === scelta.x.r.nome).pop(); if (pp) { pp.auto = true; scriviGiorno(d, gg); } }   // segnato: è un pasto compilato dall'app
      (usate[scelta.x.r.nome] ||= []).push(i); messe++; (aggiunti[d] ||= new Set()).add(s);
    });
  });
  Object.entries(aggiunti).forEach(([d, set]) => {
    rifinisciGiorno(d, set); completaProteine(d, set); rifinisciGiorno(d, set);
    const m = mancaData(d);
    if (!opz.stretto && (m.grassi < 0 || m.carboidrati < 0)) {   // il ritocco non è bastato: quei pasti si rifanno con la scelta più rigorosa
      const g = giornoDiario(d); g.pasti = g.pasti.filter(p => !(set.has(p.pasto) && p.auto)); scriviGiorno(d, g);
      pianificaSettimana(d, d, { ...opz, stretto: true, soloSlot: undefined });
    }
  });
  return { prima, messe };
}
// Rifà il menu di un giorno con altre scelte (solo i pasti non ancora passati); stesse regole della compilazione
const rigenerati = {};   // giorno → nomi già proposti, per non ripetersi
function rigeneraGiorno(data, momento, tutti) {   // momento: solo quel pasto; senza, tutti i pasti compilati del giorno
  const orig = JSON.stringify(leggiDiario()[data] || null);
  const sopra = () => { const m = mancaData(data); return Math.max(0, -m.grassi) + Math.max(0, -m.carboidrati) + Math.max(0, -m.kcal - KCAL_EXTRA) / 10; };
  const sopraPrima = sopra();
  const g0 = giornoDiario(data), tolti0 = g0.pasti.filter(p => momento ? p.pasto === momento && (tutti || p.auto) : !pastoPassato(data, p.pasto));
  const esc = rigenerati[data + (momento || "")] ||= { seme: 0, nomi: new Set() };
  const vecchi = JSON.stringify(tolti0.map(p => p.ricetta || p.nome));
  tolti0.forEach(p => { esc.nomi.add(p.ricetta || ""); (p.ingredienti || []).forEach(i => esc.nomi.add(i.nome)); });
  const ripristina = () => { const d = leggiDiario(); if (orig === "null") delete d[data]; else d[data] = JSON.parse(orig); salvaDiario(d); };
  // escludendo piatti e ingredienti del menu di prima, un pasto può restare senza alternative (es. uno spuntino di solo «fiocchi di latte»):
  // in quel caso si riempie comunque, anche con piatti già visti, invece di lasciarlo vuoto
  const slotPrima = new Set(tolti0.map(p => p.pasto));
  const riempiVuoti = () => {
    const vuoti = [...slotPrima].filter(s => !giornoDiario(data).pasti.some(p => p.pasto === s));
    vuoti.forEach((s, k) => pianificaSettimana(data, data, { seme: esc.seme + 101 + k, soloSlot: s }));
  };
  // si prova con altre scelte finché il giorno non peggiora (mai più grassi o carboidrati del giusto) e il pasto è davvero diverso
  for (let prova = 0; prova < 8; prova++) {
    ripristina();
    const g = giornoDiario(data); g.pasti = g.pasti.filter(p => !tolti0.some(t => JSON.stringify(t) === JSON.stringify(p))); scriviGiorno(data, g);
    esc.seme++;
    if (prova === 4) esc.nomi.clear();   // finite le alternative nuove: si riconsiderano anche quelle già viste
    const r = pianificaSettimana(data, data, { seme: esc.seme + prova, escludi: prova < 4 ? esc.nomi : undefined, soloSlot: momento, stretto: prova >= 3 });
    const nuovi = JSON.stringify(giornoDiario(data).pasti.filter(p => momento ? p.pasto === momento : p.auto).map(p => p.ricetta || p.nome));
    if (r.messe) riempiVuoti();
    const restaVuoto = [...slotPrima].some(s => !giornoDiario(data).pasti.some(p => p.pasto === s));
    if (r.messe && !restaVuoto && sopra() <= sopraPrima + 0.01 && (nuovi !== vecchi || prova >= 7)) return { prima: { [data]: orig }, messe: r.messe };   // un menu che lascia un pasto vuoto si scarta
  }
  ripristina();   // nessuna alternativa che stia nei valori del giorno: resta il pasto di prima
  return { prima: { [data]: orig }, messe: 0 };
}
function annullaPianificazione(prima) {
  const d = leggiDiario();
  Object.entries(prima).forEach(([k, v]) => { if (v === "null") delete d[k]; else d[k] = JSON.parse(v); });
  salvaDiario(d);
}
function ingredientiPastoTutti(data, pasto) {
  const lista = [];
  try { giornoDiario(data).pasti.forEach((p, pi) => { if (p.pasto !== pasto) return; (p.ingredienti || []).forEach((i, ii) => { const g = grammiIng(i); if (g > 0 && !(i.unita === "q.b.")) lista.push({ nome: i.nome, qta: g, rif: [pi, ii] }); }); }); } catch (e) {}
  return lista;
}
// -------- Proteine che mancano / grassi e carboidrati sopra: per ogni pasto non ancora fatto, cosa fare (scegli tu dove) --------
// Fonti di proteine magre adatte al pasto (grammi massimi ragionevoli); il tonno in scatola solo con moderazione (mercurio)
const FONTI_PROT_PASTO = {
  colazione: [["Yogurt greco 0%", 250], ["Skyr", 250], ["Kefir bianco", 250], ["Albume", 250], ["Fiocchi di latte", 200], ["Proteine in polvere", 40]],
  spuntino: [["Yogurt greco 0%", 200], ["Skyr", 200], ["Kefir bianco", 250], ["Fiocchi di latte", 200], ["Bresaola", 60], ["Fesa di tacchino", 80], ["Proteine in polvere", 30]],
  pre: [["Yogurt greco 0%", 200], ["Skyr", 200], ["Fesa di tacchino", 80], ["Proteine in polvere", 30]],   // prima dell'allenamento: niente grassi né fibre
  principale: [["Petto di pollo", 200], ["Fesa di tacchino", 200], ["Tonno in scatola al naturale", 120], ["Gamberi", 250], ["Merluzzo", 250], ["Nasello", 250], ["Albume", 250], ["Tofu", 200], ["Manzo magro", 150], ["Bresaola", 80]],
};
const tipoFontiPasto = (data, p) => p === "colazione" ? "colazione" : p === "mattina" ? "spuntino" : p === "spuntino" ? (preSera(data) ? "pre" : "spuntino") : "principale";
const macroDi = (nome, g) => macroAlimento(nome, g);   // le kcal promesse = quelle registrate (4/4/9, come calcolaMacro)
// quanti grammi di un alimento stanno in ciò che resta (grassi e carboidrati mai oltre; le calorie di poco)
function grammiCheCi(nome, voluti, massimo, m) {
  const kcalMax = m.kcal + KCAL_EXTRA, cMax = Math.max(0, m.carboidrati) + 1, gMax = Math.max(0, m.grassi) + 0.5;
  for (let g = Math.min(massimo, Math.max(5, Math.ceil(voluti / 5) * 5)); g >= 5; g -= 5) {   // anche porzioni piccole: con poche kcal 10 g di frutta secca possono starci
    const d = macroDi(nome, g);
    if (d.kcal <= kcalMax && d.carboidrati <= cMax && d.grassi <= gMax) return { g, d };
  }
  return null;
}
// proteine che mancano: per questo pasto le fonti giuste (e, se c'è già una fonte nel pasto, portarla a più grammi)
function mosseProteine(data, p, m, scritto) {
  const A = window.ALIMENTI || {}, need = m.proteine, out = [];
  if (scritto) {
    try { ingredientiPastoTutti(data, p).forEach(r => {
      const a = A[r.nome]; if (!a || a[1] * 4 / Math.max(1, a[0]) < 0.25 || !(a[1] >= 10)) return;      // solo fonti di proteine vere
      const extra = grammiCheCi(r.nome, need * 100 / a[1], Math.min(Math.round(r.qta * 0.7), 120), m); if (!extra || extra.d.proteine < Math.min(need * 0.5, 8)) return;
      const nuova = Math.round((r.qta + extra.g) / 5) * 5;
      out.push({ key: `${p}|por|${r.rif[0]}|${r.rif[1]}|${nuova}`, testa: `Porta <b>${esc(r.nome.toLowerCase())}</b> da ${Math.round(r.qta)} a <b>${nuova} g</b>`, d: extra.d, _p: Math.abs(extra.d.proteine - need) - 3 });
    }); } catch (e) {}
  }
  (FONTI_PROT_PASTO[tipoFontiPasto(data, p)] || []).forEach(([nome, massimo]) => {
    if (!A[nome] || (TONNO_SCATOLA.test(nome) && !tonnoOk(data))) return;
    const r = grammiCheCi(nome, need * 100 / A[nome][1], massimo, m); if (!r || r.d.proteine < Math.min(need * 0.5, 8)) return;
    out.push({ key: `${p}|agg|${nome}|${r.g}`, testa: `Aggiungi <b>${r.g} g di ${esc(nome.toLowerCase())}</b>`, d: r.d, _p: Math.abs(r.d.proteine - need) + (TONNO_SCATOLA.test(nome) ? 6 : 0) });   // tonno: mai in testa
  });
  const ruota = hashStr(data + p);
  return out.sort((a, b) => (a._p + (((hashStr(a.key) + ruota) % 7) * 0.3)) - (b._p + (((hashStr(b.key) + ruota) % 7) * 0.3)));
}
// carboidrati che mancano: per un pasto ancora vuoto, le fonti giuste di carboidrati (pre-workout senza grassi né fibre)
const FONTI_CARBO_PASTO = {
  colazione: [["Fiocchi d'avena", 80], ["Pane integrale", 100], ["Banana", 150], ["Mela", 200], ["Gallette di riso", 40]],
  spuntino: [["Banana", 150], ["Mela", 200], ["Gallette di riso", 40], ["Pane integrale", 80]],
  pre: [["Banana", 150], ["Gallette di riso", 40], ["Pane bianco", 80]],
  principale: [["Riso basmati cotto", 300], ["Pasta", 100], ["Patate", 350], ["Pane integrale", 100], ["Farro", 90]],
};
function mosseCarbo(data, p, m) {
  const A = window.ALIMENTI || {}, need = m.carboidrati, out = [];
  (FONTI_CARBO_PASTO[tipoFontiPasto(data, p)] || []).forEach(([nome, massimo]) => {
    if (!A[nome] || MAI_CONSIGLIATI.test(nome)) return;
    const r = grammiCheCi(nome, need * 100 / A[nome][2], massimo, m); if (!r || r.d.carboidrati < Math.min(need * 0.4, 15)) return;
    out.push({ key: `${p}|agg|${nome}|${r.g}`, testa: `Aggiungi <b>${r.g} g di ${esc(nome.toLowerCase())}</b>`, d: r.d, _p: Math.abs(r.d.carboidrati - need) });
  });
  const ruota = hashStr(data + p);
  return out.sort((a, b) => (a._p + (((hashStr(a.key) + ruota) % 7) * 0.5)) - (b._p + (((hashStr(b.key) + ruota) % 7) * 0.5)));
}
// grassi che mancano: grassi buoni a piccole dosi (mai nel pre-workout)
const FONTI_GRASSI = [["Olio EVO", 15], ["Mandorle", 30], ["Noci", 30], ["Avocado", 80]];
function mosseGrassi(data, p, m) {
  const A = window.ALIMENTI || {}, need = m.grassi, out = [];
  if (tipoFontiPasto(data, p) === "pre") return out;
  FONTI_GRASSI.forEach(([nome, massimo]) => {
    if (!A[nome] || MAI_CONSIGLIATI.test(nome)) return;
    const r = grammiCheCi(nome, need * 100 / A[nome][3], massimo, m); if (!r || r.d.grassi < Math.min(need * 0.5, 5)) return;
    out.push({ key: `${p}|agg|${nome}|${r.g}`, testa: `Aggiungi <b>${r.g} g di ${esc(nome.toLowerCase())}</b>`, d: r.d, _p: Math.abs(r.d.grassi - need) });
  });
  return out;
}
// divario piccolo (poche kcal o pochi grammi): ingredienti singoli per OGNI macro che manca, alternati (proteine, carboidrati, grassi) perché le prime scelte coprano macro diversi
function mosseSingole(data, p, m, scritto) {
  const c = mancantiColmabili(m);
  const liste = [
    m.proteine > 10 && c.proteine >= 6 ? mosseProteine(data, p, m, scritto) : [],
    m.carboidrati > 15 && c.carboidrati >= 10 ? mosseCarbo(data, p, m) : [],
    m.grassi > 8 && c.grassi >= 3.5 ? mosseGrassi(data, p, m) : [],
  ].filter(l => l.length);
  const out = [], visti = new Set();
  for (let i = 0; liste.some(l => i < l.length); i++) liste.forEach(l => { const x = l[i]; if (x && !visti.has(x.key)) { visti.add(x.key); out.push(x); } });
  return out;
}
// Pasto vuoto e nessuna ricetta che ci stia nelle kcal che restano: si propongono singoli alimenti (quello che manca, nei limiti del pasto)
function alimentiIdeaHTML(c) {
  try {
    if (pastoPassato(c.data, c.pasto)) return "";
    const m0 = mancaData(c.data), T = targetPastoDiario(c.data, c.pasto);
    const m = { kcal: Math.min(m0.kcal, T.kcal + 20), proteine: m0.proteine, carboidrati: Math.min(m0.carboidrati, T.carboidrati + 3), grassi: Math.min(m0.grassi, T.grassi + 1) };
    if (m.kcal < 40) return `<p class="hint">Niente che ci stia nelle kcal che restano</p>`;
    const pre = c.pasto === "spuntino" && preSera(c.data), sp = c.pasto === "mattina" || c.pasto === "spuntino";
    let mosse = mosseSingole(c.data, c.pasto, m, false);
    // la quota di questo pasto può essere piccola (restano altri pasti da fare): soglie più basse, poi i piccoli completamenti
    if (!mosse.length && m.carboidrati >= 5) mosse = mosseCarbo(c.data, c.pasto, m);
    if (!mosse.length && m0.proteine > 4) mosse = mosseProteine(c.data, c.pasto, m, false);
    if (!mosse.length && typeof piccoliCompletamenti === "function") mosse = piccoliCompletamenti(c.data, c.pasto, m);
    mosse = mosse.filter(x => !String(x.key).includes("|lig|") && !(sp && x.d.kcal > 320) && !(pre && x.d.grassi > 3) && !furbiScartati.has(x.key)).slice(0, 3);
    if (!mosse.length) return `<p class="hint">Niente che ci stia nelle kcal che restano</p>`;
    return `<h4 class="cosa-testa"><span>💡 Idee</span></h4><div class="sugg-ricette">${mosse.map(x => { const [, , nome, g] = x.key.split("|"); return `<button class="var-furbo lib-furbo" data-lib-add="${esc(nome)}" data-lib-g="${g}" data-lib-fisso="1">${x.testa}<em>${numeriMossa(x.d)}</em></button>`; }).join("")}</div>`;
  } catch (e) { return ""; }
}
// grassi o carboidrati sopra: per un pasto ancora vuoto, una versione leggera (proteina magra + verdura)
function mosseLeggere(data, p, m) {
  const A = window.ALIMENTI || {}, tipo = tipoFontiPasto(data, p);
  const voluti = Math.min(40, Math.max(m.proteine, 25));
  const magre = (FONTI_PROT_PASTO[tipo] || []).filter(([n]) => A[n] && A[n][3] <= 3 && A[n][2] <= 5 && n !== "Proteine in polvere");
  const verdure = VERDURE_CONSIGLI.filter(v => A[v]);
  const out = [];
  magre.forEach(([nome, massimo], i) => {
    const kcalMax = sopraKcal(m) ? 200 : m.kcal + KCAL_EXTRA;   // se si è già sopra con le kcal, il pasto che resta può comunque essere leggero; altrimenti mai oltre quelle che restano
    for (let g = Math.min(massimo, Math.max(40, Math.ceil(voluti * 100 / A[nome][1] / 5) * 5)); g >= 40; g -= 10) {
      if (tipo !== "principale") { const d = macroDi(nome, g); if (d.kcal <= kcalMax) { out.push({ key: `${p}|agg|${nome}|${g}`, testa: `Leggero: <b>${g} g di ${esc(nome.toLowerCase())}</b>`, d }); break; } continue; }
      const v = verdure[(hashStr(data + p) + i) % verdure.length], dp = macroDi(nome, g), dv = macroDi(v, 200);
      const d = { kcal: dp.kcal + dv.kcal, proteine: dp.proteine + dv.proteine, carboidrati: dp.carboidrati + dv.carboidrati, grassi: dp.grassi + dv.grassi };
      if (d.kcal <= kcalMax) { out.push({ key: `${p}|lig|${nome}|${g}|${v}|200`, testa: `Leggero: <b>${g} g di ${esc(nome.toLowerCase())}</b> con <b>200 g di ${esc(v.toLowerCase())}</b>`, d }); break; }
    }
  });
  return out;
}
// un suggerimento tolto con lo swipe (cestino): sparisce e ne arriva un altro
function scartaSuggerimento(chiave) {
  furbiScartati.add(chiave);
  if (!document.getElementById("modal").hidden && document.querySelector("[data-cosa-mossa]")) aggiornaCosaAggiungere(); else if (liberoCtx) rirenderLibero();
}
// Calorie a posto ma un macro (grassi o carboidrati) molto sotto, con proteine in più: si porta un po' di una fonte proteica in eccesso
// a quanto serve e con le calorie liberate si aggiunge il macro che manca, nello stesso pasto. Un tocco applica entrambe le cose.
function mosseRiequilibra(data, mg) {
  const A = window.ALIMENTI || {}, m = mg.m, out = [], g = giornoDiario(data);
  let slots = momentiGiorno(data).filter(p => !pastoPassato(data, p));
  if (!slots.length && momentiGiorno(data).includes("cena")) slots = ["cena"];   // a cena passata si riequilibra la cena
  const eccP = Math.max(0, -m.proteine);
  if (eccP < 8) return out;
  g.pasti.forEach((p, pi) => {
    if (!slots.includes(p.pasto)) return;
    const tipo = tipoFontiPasto(data, p.pasto);
    (p.ingredienti || []).forEach((ing, ii) => {
      const a = A[ing.nome], q = grammiIng(ing);
      if (!a || ing.unita === "q.b." || !(a[1] >= 15) || !(q >= 60)) return;   // solo fonti di proteine vere
      const ridG = Math.min(Math.round(q * 0.4 / 5) * 5, Math.floor(eccP * 100 / a[1] / 5) * 5);
      if (ridG < 20) return;
      const lib = macroDi(ing.nome, ridG), nuova = Math.round(q - ridG);
      mg.squil.forEach(s => {
        const fonti = s.macro === "grassi" ? (tipo === "pre" ? [] : FONTI_GRASSI) : (FONTI_CARBO_PASTO[tipo] || []);
        const col = s.macro === "grassi" ? 3 : 2;
        for (const [nome, massimo] of fonti) {
          if (!A[nome] || MAI_CONSIGLIATI.test(nome)) continue;
          for (let gg = Math.min(massimo, Math.max(5, Math.ceil(Math.min(s.g, 20) * 100 / A[nome][col] / 5) * 5)); gg >= 5; gg -= 5) {
            const add = macroDi(nome, gg), d = { kcal: add.kcal - lib.kcal, proteine: add.proteine - lib.proteine, carboidrati: add.carboidrati - lib.carboidrati, grassi: add.grassi - lib.grassi };
            if (d.kcal > m.kcal + 5 || (s.macro === "grassi" && d.carboidrati > Math.max(0, m.carboidrati) + 3) || (s.macro === "carboidrati" && d.grassi > Math.max(0, m.grassi) + 1)) continue;
            if ((s.macro === "grassi" ? add.grassi : add.carboidrati) < Math.min(s.g * 0.4, 8)) break;
            out.push({ key: `${p.pasto}|sco|${pi}|${ii}|${nuova}|${nome}|${gg}`, testa: `Porta <b>${esc(ing.nome.toLowerCase())}</b> da ${Math.round(q)} a <b>${nuova} g</b> e aggiungi <b>${gg} g di ${esc(nome.toLowerCase())}</b>`, d, _p: Math.abs((s.macro === "grassi" ? add.grassi : add.carboidrati) - s.g) });
            break;
          }
        }
      });
    });
  });
  return out.sort((x, y) => x._p - y._p).filter((x, i, arr) => arr.findIndex(z => z.key === x.key) === i).slice(0, 4);
}
function cosaAggiungereHTML() {
  const data = dataDiario, sp = !giornataPronta(data) ? scartoPasti(data) : null;
  const m = sp && sp.voce ? sp.m : mancaData(data);   // a metà giornata si ragiona sui pasti già fatti, non sul totale del giorno
  const mg = sp && sp.voce ? { ok: false, testo: sp.voce.testo } : mancaGiornata(data);
  if (mg.ok) return `<h3 class="modal-title">Giornata completa ✓</h3>`;
  if (mg.squilibrio) {   // calorie ok ma un macro molto sotto: soluzioni per riequilibrare la giornata
    const mosse = mosseRiequilibra(data, mg).filter(x => !furbiScartati.has(x.key));
    return `<h3 class="modal-title">${esc(mg.testo)}</h3>
      ${mosse.length ? `<h4 class="cosa-testa"><span>⚖️ Riequilibra</span></h4><div class="sugg-ricette">${mosse.map(x => `<button class="var-furbo lib-furbo" data-furbo-k="${esc(x.key)}" data-cosa-mossa="${esc(x.key)}">${x.testa}<em>${numeriMossa(x.d)}</em></button>`).join("")}</div>` : `<p class="hint">Niente da spostare oggi: lo recuperi domani</p>`}`;
  }
  const gOggi = giornoDiario(data).pasti, usate = new Set();
  const basiC = new Set(gOggi.map(x => rilevaBaseCarbo(x)).filter(Boolean)), basiP = new Set(gOggi.map(x => rilevaBaseProt(x)).filter(Boolean));
  let momenti = momentiGiorno(data).filter(p => !pastoPassato(data, p));
  if (!momenti.length && momentiGiorno(data).includes("cena")) momenti = ["cena"];   // la sera, a cena passata, il completamento va nella cena
  const ultimo = momenti[momenti.length - 1];
  const mReale = mancaData(data);   // in «modalità leggera» m è spostato apposta: i piccoli completamenti guardano le kcal che restano davvero
  const poche = mReale.kcal >= 25 && mReale.kcal <= 220 && !sopraKcal(mReale);   // restano poche kcal: piccoli completamenti (olio, frutta secca, yogurt…)
  const righe = momenti.map(p => {
    const scritto = gOggi.some(x => x.pasto === p);
    const kcalPasto = gOggi.filter(x => x.pasto === p).reduce((a, x) => a + (x.kcal || 0), 0), spuntino = p === "mattina" || p === "spuntino";
    const sopra = -m.carboidrati > Math.max(10, targetData(data).carboidrati * 0.05) || -m.grassi > Math.max(5, targetData(data).grassi * 0.1) || sopraKcal(m);
    const mp = m.proteine > 10;
    const piccolo = !sopra && (m.kcal <= 200 || Math.max(m.proteine, m.carboidrati, m.grassi) <= 25);   // poche kcal o pochi grammi da colmare: bastano ingredienti singoli, per ogni macro che manca
    let mosse = piccolo ? mosseSingole(data, p, m, scritto).filter(x => !(spuntino && kcalPasto + Math.max(0, x.d.kcal) > 320)) : [];
    if (!mosse.length) mosse = mp ? mosseProteine(data, p, m, scritto).filter(x => !(spuntino && kcalPasto + Math.max(0, x.d.kcal) > 320)) : [];   // mancano proteine: solo fonti di proteine, in ogni pasto che resta
    if (!mosse.length) mosse = scritto ? mosseCosaAggiungere(data, p, m).filter(x => !(spuntino && kcalPasto + Math.max(0, x.d.kcal) > 320)) : ideeCosaAggiungere(data, p, m, usate, basiC, basiP);
    if (!piccolo && !scritto && !mp && m.carboidrati > 15 && !sopra) mosse = mosse.concat(mosseCarbo(data, p, m).filter(x => !(spuntino && x.d.kcal > 320)));   // pasto vuoto e carboidrati che mancano: anche singoli alimenti, non solo ricette intere
    if (!scritto && sopra) mosse = mosseLeggere(data, p, m).concat(mosse);                // grassi o carboidrati sopra: un pasto vuoto può essere leggero
    if (poche && p === ultimo) mosse = piccoliCompletamenti(data, p, mReale).concat(mosse);   // con poche kcal: quantità piccole che colmano quello che manca, nell'ultimo pasto
    mosse = mosse.filter((x, i, a) => a.findIndex(y => y.key === x.key) === i);
    mosse = mosse.filter(x => !furbiScartati.has(x.key));   // suggerimenti tolti con lo swipe
    if (!mosse.length) return "";
    const giro = cosaGiro[p] || 0;
    const verd = mosse.filter(x => x.verdura), altre = mosse.filter(x => !x.verdura);
    const pagine = Math.max(1, Math.ceil(altre.length / 2)), pg = giro % pagine;   // ↻: due idee nuove ogni volta, mai quelle appena viste
    const scelte = altre.slice(pg * 2, pg * 2 + 2).concat(verd.slice(0, 1));
    scelte.forEach(x => { if (x.nome) usate.add(x.nome); });
    return `<h4 class="cosa-testa"><span>${ICONA_PASTO[p]} ${esc(etichettaMomento(data, p))}</span>${pagine > 1 ? `<button class="cosa-altre" data-cosa-altre="${p}" aria-label="Altre idee">${ICONA_ALTRE}</button>` : ""}</h4>
      <div class="sugg-ricette">${scelte.map(x => `<button class="var-furbo lib-furbo" data-furbo-k="${esc(x.key)}" data-cosa-mossa="${esc(x.key)}">${x.testa}<em>${numeriMossa(x.d)}</em></button>`).join("")}</div>`;
  }).join("");
  return `<h3 class="modal-title">${esc(mg.testo)}</h3>
    ${camminataHTML(data)}
    ${righe ? `<p class="cosa-sez">🌙 Consigli furbi</p>` : ""}
    ${righe || `<p class="hint">${momentiGiorno(data).some(p => !pastoPassato(data, p)) ? "Niente che ci stia nelle kcal che restano" : "Giornata finita: lo recuperi domani"}</p>`}`;
}
function aggiornaCosaAggiungere() {   // riscrive il foglio senza riaprirlo (la posizione di scorrimento resta)
  if (document.getElementById("modal").hidden) return;
  const sh = document.querySelector(".modal-sheet"), y = sh ? sh.scrollTop : 0;
  document.getElementById("modal-content").innerHTML = cosaAggiungereHTML();
  if (sh) sh.scrollTop = y;
}
function apriCosaAggiungere() { editCtx = null; liberoCtx = null; cosaGiro = {}; furbiScartati.clear(); openModal(cosaAggiungereHTML()); }
// applica una mossa scelta nel foglio, direttamente sulla giornata
function applicaMossaCosa(data, key) {
  const [p, tipo, a, b, c, d, e] = key.split("|");
  const g = giornoDiario(data), prima = JSON.stringify(g);
  if (tipo === "ric") { if (aggiungiRicettaIn(data, p, a) < 0) return false; return prima; }
  if (tipo === "agg") {
    const x = { nome: a, pasto: p, passaggi: [], ingredienti: [{ nome: a, qta: +b, unita: "g", lock: true, cercato: a }] };
    aggiornaMacro(x); g.pasti.push(x);
  } else if (tipo === "sco") {   // riequilibra: meno di una fonte proteica e, nello stesso pasto, il macro che mancava
    const x = g.pasti[+a], ing = x && (x.ingredienti || [])[+b]; if (!ing) return false;
    const ingrPrima = clone(x.ingredienti);
    x.ingredienti[+b] = { nome: ing.nome, qta: +c, unita: UNITA_LIQUIDI.test(ing.nome) ? "ml" : "g", lock: true, cercato: ing.cercato || ing.nome };
    delete x.auto; rinominaLibero(x, ingrPrima);
    const y = { nome: d, pasto: p, passaggi: [], ingredienti: [{ nome: d, qta: +e, unita: "g", lock: true, cercato: d }] };
    aggiornaMacro(y); g.pasti.push(y);
  } else if (tipo === "lig") {
    const x = { nome: `${a} con ${String(c).toLowerCase()}`, pasto: p, passaggi: [], ingredienti: [{ nome: a, qta: +b, unita: "g", lock: true, cercato: a }, { nome: c, qta: +d, unita: "g", lock: true, cercato: c }] };
    aggiornaMacro(x); g.pasti.push(x);
  } else {
    const pi = +a, ii = +b, x = g.pasti[pi], ing = x && (x.ingredienti || [])[ii]; if (!ing) return false;
    const ingrPrima = clone(x.ingredienti);
    if (tipo === "tol") x.ingredienti.splice(ii, 1);
    else if (tipo === "por") x.ingredienti[ii] = { nome: ing.nome, qta: +c, unita: UNITA_LIQUIDI.test(ing.nome) ? "ml" : "g", lock: true, cercato: ing.cercato || ing.nome };
    else { const nuovo = c; x.ingredienti[ii] = { nome: nuovo, qta: +d > 0 ? +d : Math.round(grammiIng(ing)), unita: UNITA_LIQUIDI.test(nuovo) ? "ml" : "g", lock: true, cercato: nuovo }; }
    if (!x.ingredienti.length) g.pasti.splice(pi, 1); else { delete x.auto; rinominaLibero(x, ingrPrima); if (!x.ricetta) unisciPastiLiberiIn(g, x.pasto); }
  }
  scriviGiorno(data, g);
  return prima;
}
function notaFineGiornataHTML(data) {
  const T = targetData(data);
  const manca = mancaData(data);
  const sm = situazioneMacro(data);
  if (sm && (sm.sopraC || sm.sopraG || sm.indietroP || sm.finitiC || sm.raggiunti) && !sopraKcal(manca)) { // i macro li dicono già gli avvisi: qui solo le calorie
    return manca.kcal > T.kcal * 0.05 ? `<p class="nota">Mancano <b>${manca.kcal} kcal</b></p>` : "";
  }
  if (sopraKcal(manca))
    return "";   // l'avviso «Sopra di X kcal ›» di Oggi apre già i rimedi
  const sugg = suggerimentiMacro(manca);
  if (manca.kcal <= T.kcal * 0.05 && !sugg.length && !sopraKcal(manca)) return `<p class="nota ok">✅ Giornata in linea</p>`;
  const sg = sugg[0];
  // calorie finite ma un macro che manca: non si aggiunge niente (sforeresti), si scambia un alimento della cena
  if (sg && manca.kcal < 60 && !sopraKcal(manca))
    return `<p class="nota">Calorie finite · mancano ~${sg.manca} g di ${NOMI_MACRO[sg.macro]}</p>`;
  return `<p class="nota">${manca.kcal > 0 ? `Mancano <b>${manca.kcal} kcal</b>` : "Calorie ok"}${sg ? ` · ~${sg.manca} g di ${NOMI_MACRO[sg.macro]}` : ""}</p>`;
}

// -------- Vista "Oggi" --------
// Anello delle calorie: quanto hai mangiato rispetto all'obiettivo, al centro quanto manca
function anelloCalorieHTML(mangiate, obiettivo) {
  const R = 52, C = 2 * Math.PI * R;
  const frac = obiettivo > 0 ? mangiate / obiettivo : 0;
  const resto = Math.round(obiettivo - mangiate);
  const sopra = resto < 0;   // qualsiasi sforamento: il cerchio non è più viola
  const arco = Math.min(1, frac) * C;
  return `<button class="anello" data-apri-settimana aria-label="${resto >= 0 ? `${resto} kcal da mangiare` : `${-resto} kcal sopra`}, apri la settimana">
    <svg viewBox="0 0 120 120" class="${sopra ? "sopra" : ""}">
      <circle cx="60" cy="60" r="${R}" class="an-fondo"/>
      ${arco > 0.5 ? `<circle cx="60" cy="60" r="${R}" class="an-arco" stroke-dasharray="${arco.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>` : ""}
    </svg>
    <span class="an-centro ${sopra ? "sopra" : ""}"><b>${Math.abs(resto)}</b><small>${resto >= 0 ? "da mangiare" : "sopra"}</small><em>${Math.round(mangiate)} / ${obiettivo}</em></span>
  </button>`;
}
// Riga compatta di un macro: nome e grammi, con barretta colorata
function macroCompattoHTML(nome, k, val, tot, pct) {
  const w = tot > 0 ? Math.min(100, val / tot * 100) : 0;
  const sopra = Math.round(val) > tot;                    // contorno bianco e "+N" appena superi l'obiettivo, anche di poco
  const piu = sopra ? Math.round(val) - tot : 0;
  return `<div class="mc">
    <div class="mc-top"><span><i class="dot-${k}"></i>${nome}</span><span>${piu ? `<em class="mc-piu">+${piu}</em> ` : ""}<b>${Math.round(val)}</b>/${tot} g</span></div>
    <div class="mc-bar"><span class="mb-${k}${sopra ? " sopra" : ""}" style="width:${w}%"></span></div>
  </div>`;
}
function fmtGiornoLungo(data) {
  const s = new Date(data + "T12:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function barraProgressoHTML(nome, cls, val, tot, pct) {
  const w = tot > 0 ? Math.min(100, val / tot * 100) : 0;
  const resta = Math.round(tot - val);
  const sopra = resta < 0;                                  // stessa regola di "Oggi": contorno bianco appena c'è un eccesso
  return `<div class="prog">
    <div class="prog-top"><span><i class="${cls}"></i>${nome}${pct !== null ? ` <em>${pct}%</em>` : ""}</span>
      <span><b>${Math.round(val)}</b> / ${tot} g${resta < 0 ? ` <em class="${sopra ? "sopra" : ""}">+${-resta}</em>` : ""}</span></div>
    <div class="prog-bar"><span class="${cls.replace("dot-", "mb-")}${sopra ? " sopra" : ""}" style="width:${w}%"></span></div>
  </div>`;
}
// -------- Scelta degli sport di un giorno (o di un giorno della settimana tipo) --------
let sceltaAllenOrario = null;
let sceltaAllen = null; // { titolo, sel: Set di id sport, salva(chiave), dopo() }
function apriSceltaAllenamenti(titolo, chiave, salva, dopo, data) {
  sceltaAllen = { titolo, sel: new Set(sportDelTipo(chiave)), salva, dopo, data, orario: data ? orarioAllen(data) : null };
  editCtx = null;
  openModal(sceltaAllenHTML());
}
function sceltaAllenHTML() {
  const c = sceltaAllen;
  const info = TIPI_GIORNATA[chiaveTipo([...c.sel])];
  return `<h3 class="modal-title">${esc(c.titolo)}</h3>
    <div class="sport-griglia">
      ${leggiProfilo().sport.filter(sp => !sp.nascosto || c.sel.has(sp.id)).map(sp => `<button class="sport-btn ${c.sel.has(sp.id) ? "on" : ""}" data-allen-sport="${sp.id}">
        <span class="sb-ico">${sp.icona}</span><b>${esc(sp.nome)}</b><small>~${kcalSport(sp)} kcal</small></button>`).join("")}
      <button class="sport-btn ${c.sel.size ? "" : "on"}" data-allen-riposo><span class="sb-ico">😴</span><b>Riposo</b><small>niente sport</small></button>
    </div>
    ${c.sel.size && c.orario ? `<p class="hint">A che ora ti alleni?</p><div class="chips">
      <button class="chip ${c.orario === "mattina" ? "attivo" : ""}" data-allen-orario="mattina">☀️ Mattina</button>
      <button class="chip ${c.orario === "sera" ? "attivo" : ""}" data-allen-orario="sera">🌙 Pomeriggio / sera</button></div>` : ""}
    <div class="allen-anteprima">Obiettivo del giorno: <b>${info.target.kcal} kcal</b> · P ${info.target.proteine} · C ${info.target.carboidrati} · G ${info.target.grassi} g</div>
    <button class="btn-link link-ricette" data-azione="profilo">Aggiungi o modifica gli sport (Profilo) ›</button>
    <div class="lib-footer"><button class="btn lib-salva" data-allen-salva>✓ Salva</button></div>`;
}

// -------- Schermata principale: Oggi | Settimana --------
let vistaHome = "oggi";
let offsetSettHome = 0; // 0 = questa settimana, -1 = scorsa, +1 = prossima
function vaiA(dove, data) {
  const oggi = oggiISO();
  if (dove === "oggi") { vistaHome = "oggi"; dataDiario = oggi; }
  else if (dove === "ieri") { vistaHome = "oggi"; dataDiario = addGiorniISO(oggi, -1); }
  else if (dove === "data" && data && data <= oggi) { vistaHome = "oggi"; dataDiario = data; }
  else if (dove === "settimana") { vistaHome = "settimana"; offsetSettHome = 0; }
  else if (dove === "settimana-prossima") { vistaHome = "settimana"; offsetSettHome = 1; }
  if (typeof giornoSelSett !== "undefined") giornoSelSett = null;
  renderOggi(); window.scrollTo(0, 0);
}
function renderSettimanaHome(cont) {
  const oggi = oggiISO();
  const lun = addGiorniISO(addGiorniISO(oggi, -indiceSettimana(oggi)), offsetSettHome * 7);
  const p = pianoSettimana(lun);
  const titolo = offsetSettHome === 0 ? "Questa settimana" : offsetSettHome === -1 ? "Settimana scorsa" : offsetSettHome === 1 ? "Settimana prossima" : `${fmtData(p.date[0])} – ${fmtData(p.date[6])}`;
  cont.innerHTML = `
    ${recuperoHTML(oggi)}
    <div class="oggi-nav">
      <button class="nav-btn" data-sett-home="-1" aria-label="Settimana precedente">‹</button>
      <div class="oggi-data"><b>${titolo}</b><span>${fmtData(p.date[0])} – ${fmtData(p.date[6])}</span></div>
      <button class="nav-btn" data-sett-home="1" aria-label="Settimana successiva" ${offsetSettHome >= 1 ? "disabled" : ""}>›</button>
    </div>
    <div class="oggi-card">${budgetSettimanaHTML(lun)}</div>
    <div class="gs-lista">${giorniSettimanaHTML(lun)}</div>`;
}

function renderOggi() {
  const cont = document.getElementById("oggi");
  if (!cont) return;
  if (document.getElementById("modal").hidden && typeof segnaTab === "function") segnaTab(vistaHome); // scheda evidenziata nella barra in basso
  if (vistaHome === "settimana" && typeof budgetSettimanaHTML === "function") { renderSettimanaHome(cont); return; }
  const data = dataDiario;
  const g = giornoDiario(data);
  const T = targetData(data);
  const t = sommaMacro(g.pasti);
  const restoKcal = Math.round(T.kcal - t.kcal);
  const isOggi = data === oggiISO();
  const prox = prossimoPasto(data);
  const pct = g.pasti.length ? pctMacro(t) : null;
  // i pasti nell'ordine della giornata; per ogni momento i pasti inseriti oppure un riquadro vuoto
  const righe = momentiTutti(data).map(momento => {
    const inseriti = g.pasti.map((p, k) => ({ p, k })).filter(x => x.p.pasto === momento);
    // pasto già inserito: un solo riquadro con i nomi dei piatti; toccandolo si vede l'elenco dei piatti
    if (inseriti.length) {
      const kcal = inseriti.reduce((a, x) => a + (x.p.kcal || 0), 0);
      const nomi = inseriti.map(x => nomeConQuantita(x.p)).join(", ");
      return `<div class="pasto-gruppo ${data >= oggiISO() && !pastoPassato(data, momento) ? "auto" : ""}${pastoPassato(data, momento) ? " passato" : ""}" data-momento="${momento}">
        <button class="pasto-riga fatto" data-oggi-momento="${momento}">
        <span class="pr-icona">${ICONA_PASTO[momento]}</span>
        <span class="pr-testo"><small>${etichettaMomento(data, momento)}</small><b class="pr-nomi">${esc(nomi)}</b></span>
        <span class="pr-kcal">${Math.round(kcal)}<small> kcal</small></span><span class="pr-check" aria-label="registrato"><svg viewBox="0 0 22 22" aria-hidden="true"><path d="M6.2 11.4l3.3 3.3 6.3-6.9" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      </div>`;
    }
    const next = momento === prox;
    const quota = next ? targetPastoDiario(data, momento).kcal : null;
    return `<button class="pasto-riga vuoto ${next ? "prossimo" : ""}" data-oggi-scrivi="${momento}" data-momento="${momento}">
        <span class="pr-icona">${ICONA_PASTO[momento]}</span>
        <span class="pr-testo"><small>${etichettaMomento(data, momento)}</small><b>${next ? "Cosa mangi?" : "＋"}</b></span>
        <span class="pr-kcal">${next ? `~${quota}<small> kcal</small>` : ""}</span></button>`;
  }).join("");

  const avvisoOggi = avvisiMacroHTML(data);   // un solo messaggio in basso: l'avviso, altrimenti la nota
  cont.innerHTML = `
    ${typeof recuperoHTML === "function" ? recuperoHTML(data) : ""}
    <div class="oggi-nav">
      <button class="nav-btn" data-oggi-giorno="-1" aria-label="Giorno precedente">‹</button>
      <div class="oggi-data"><b>${isOggi ? "Oggi" : fmtGiornoLungo(data)}</b>
        <button class="tipo-btn" data-scegli-allen-data="${data}">${TIPI_GIORNATA[g.tipo].icone} ${esc(TIPI_GIORNATA[g.tipo].label)} <span class="caret">▾</span></button></div>
      <button class="nav-btn" data-oggi-giorno="1" aria-label="Giorno successivo">›</button>
    </div>
    <div class="oggi-card riepilogo">
      ${anelloCalorieHTML(t.kcal, T.kcal)}
      <div class="rp-macro">
        ${macroCompattoHTML("Proteine", "p", t.proteine, T.proteine, pct && pct.p)}
        ${macroCompattoHTML("Carboidrati", "c", t.carboidrati, T.carboidrati, pct && pct.c)}
        ${macroCompattoHTML("Grassi", "g", t.grassi, T.grassi, pct && pct.g)}
      </div>
    </div>
    <div class="oggi-pasti">${righe}
      ${avvisoOggi || (giornataPronta(data) && mancaGiornata(data).ok ? `<p class="nota ok">✅ Giornata in linea</p>` : !prox && !giornataPronta(data) ? notaFineGiornataHTML(data) : "")}
      <div class="oggi-azioni">
        ${(() => {   // un solo pulsante alla volta: se c'è qualcosa da riempire "Compila", altrimenti "Cambia menu" (anche se i pasti li hai scritti tu)
          if (data < oggiISO()) return "";
          const vuoto = momentiGiorno(data).some(s => !g.pasti.some(x => x.pasto === s) && !pastoPassato(data, s));
          if (vuoto) return `<button class="btn-link" data-compila-giorno>✨ Compila i pasti ${data === oggiISO() ? "di oggi" : "del giorno"}</button>`;
          if (!g.pasti.some(x => !pastoPassato(data, x.pasto))) return "";
          return `<button class="btn-link btn-cambia" data-rigenera-giorno>♺︎ Cambia menu del giorno</button>`;
        })()}
      </div>
    </div>
  `;
  initTrascinaPasti();
}

// Tenendo premuto un pasto lo si trascina su un altro momento (es. colazione ↔ spuntino): i due si scambiano di posto.
// Se l'altro momento è vuoto, il pasto ci si sposta.
let _sortOggi = null;
function initTrascinaPasti() {
  if (_sortOggi) { try { _sortOggi.destroy(); } catch (e) {} _sortOggi = null; }
  const box = document.querySelector("#oggi .oggi-pasti");
  if (!box || typeof Sortable === "undefined") return;
  _sortOggi = Sortable.create(box, {
    animation: 150, delay: 180, delayOnTouchOnly: true, preventOnFilter: false,
    draggable: "[data-momento]",
    onEnd: (e) => { if (e.oldIndex !== e.newIndex) spostaPasto(dataDiario, e.oldIndex, e.newIndex); },
  });
}
function spostaPasto(data, da, a) {
  const m = momentiTutti(data), md = m[da], ma = m[a];
  if (!md || !ma) return;
  const g = giornoDiario(data);
  g.pasti.forEach(p => { if (p.pasto === md) p.pasto = ma; else if (p.pasto === ma) p.pasto = md; });
  scriviGiorno(data, g);
  setTimeout(renderOggi, 0);   // dopo che SortableJS ha finito di muovere il DOM
}

// Piatti già mangiati in un pasto (es. tutta la colazione), in cima al pannello del pasto;
// toccando un piatto si aprono i suoi ingredienti
// Come si legge una quantità: "Yogurt greco 235 g", "1 mela", "2 cucchiai" (+ peso in g e quanto pesare da crudo riso, pasta…)
function titoloIngredienteHTML(ing) {
  const u = unitaDi({ nome: ing.nome }), gu = grammiPerUnita(ing.nome, u);
  const conta = gu ? (+ing.qta || 0) / gu : 0;
  const unitaTesto = u === "cucchiaio" ? (Math.abs(conta - 1) < 0.05 || conta < 1 ? "cucchiaio" : "cucchiai") : u === "cucchiaino" ? (Math.abs(conta - 1) < 0.05 || conta < 1 ? "cucchiaino" : "cucchiaini") : u;
  const grammi = UNITA_LIQUIDI.test(ing.nome) ? "ml" : "g";
  const qta = gu ? `${fmtQta(conta)} ${unitaTesto}` : `${Math.round(+ing.qta || 0)} ${grammi}`;
  const crudo = /cott/i.test(ing.nome) ? crudoLabel(ing.nome, +ing.qta || 0) : null;   // riso, pasta… cotti: quanto pesarli da crudo
  const peso = [gu ? `${Math.round(+ing.qta || 0)} ${grammi}` : "", crudo || ""].filter(Boolean).join(" · "); // cucchiai e pezzi: anche il peso in grammi
  const aPezzi = u === "pz" && gu; // a pezzi: "1 Mela"; altrimenti "Yogurt greco 235 g"
  return (aPezzi ? esc(nomeConNumero(ing.nome, conta, true)) : `${esc(ing.nome)} <em class="pm-qta">${esc(qta)}</em>`) + (peso ? ` <em class="pm-peso">· ${esc(peso)}</em>` : "");
}

// Dalla lista "Tutte le ricette": aggiunge la ricetta (adattata alle kcal del pasto) al pasto che stavi scrivendo
// A quale pasto di quel giorno va una ricetta, se non scegli tu: colazione → colazione, spuntini → spuntino (o pre-workout nei giorni di sport)
function pastoPerRicetta(r, data) {
  if (r.pasto === "colazione") return "colazione";
  if (r.pasto === "spuntino") return r.preworkout && preSera(data) ? "spuntino" : "mattina";
  if (r.pasto === "pranzo" || r.pasto === "cena") return r.pasto;
  return new Date().getHours() < 16 ? "pranzo" : "cena";
}
function aggiungiRicettaAlPasto(nome, mod) {   // mod: le quantità scelte nel riepilogo (se le hai modificate prima di aggiungere)
  const c0 = contestoAgg || { data: dataDiario, pasto: null, fatte: new Set() };
  const r = ricette.find(x => x.nome === nome && (!c0.pasto || x.pasto === c0.pasto)) || ricette.find(x => x.nome === nome);
  if (!r) return;
  const c = { data: c0.data, pasto: c0.pasto || pastoPerRicetta(r, c0.data), fatte: c0.fatte };
  const ps = porzioneSuMisura(r, targetResiduoPasto(c.data, c.pasto));
  const g = giornoDiario(c.data);
  const voci = mod && mod.nome === nome ? mod.items.filter(x => +x.qta > 0) : ps.items.map(x => Object.assign({}, x, { qta: qtaPezziInteri(x.nome, unitaDi({ nome: x.nome }), x.qta) })).filter(x => +x.qta > 0);   // le quantità che hai scelto tu, altrimenti quelle su misura
  const p = { nome: ps.nome, pasto: c.pasto, passaggi: [], ricetta: r.nome, nPezzi: ps.k,
    ingredienti: voci.map(x => Object.assign({ nome: x.nome, qta: +x.qta, unita: "g", lock: true, cercato: x.cercato || x.nome }, x.u && x.u !== "g" ? { vis: x.u } : {})) };
  aggiornaMacro(p);
  g.pasti.push(p);
  scriviGiorno(c.data, g);
  c.fatte.add(nome);
  renderOggi();
  if (typeof aggiornaListaRicette === "function") aggiornaListaRicette();
  const testo = `✓ ${r.nome} aggiunta a ${nomePasto(c.pasto, c.data)}${c.data === oggiISO() ? "" : " · " + fmtGiornoLungo(c.data)}`;
  const idx = g.pasti.length - 1;
  // se si può rendere più leggera, il banner porta subito ai consigli "Più fit"
  const fit = typeof mosseFit === "function" ? mosseFit({ items: p.ingredienti.map(x => ({ nome: x.nome, qta: x.qta })) }) : [];
  if (fit.length) avviso(testo, "Più fit ›", () => { contestoAgg = null; closeModal(); renderOggi(); apriPastoDiario(c.data, idx); }, true);
  else avviso(testo);
}

function cambiaGiornoDiario(delta) {
  const d = new Date(dataDiario + "T12:00");
  d.setDate(d.getDate() + delta);
  const iso = d.toISOString().slice(0, 10);
  if (iso > addGiorniISO(oggiISO(), 60)) return; // si può guardare e pianificare avanti fino a 2 mesi
  dataDiario = iso;
  renderOggi();
}

// -------- Viste: Oggi (principale) / Piano settimana --------
// (resta una sola vista: Oggi)
function mostraVista() { window.scrollTo(0, 0); renderOggi(); }
const vistaCorrente = () => "oggi";

document.addEventListener("DOMContentLoaded", () => {
  adattaDatiRipristinati();
  try { migraNoPeperoni(); } catch (e) {}
  try { migraNomiRicette(); } catch (e) {}
  try { migraPastaSemola(); } catch (e) {}
  mostraVista("oggi");
  document.querySelectorAll("[data-vista]").forEach(b => b.addEventListener("click", () => mostraVista(b.dataset.vista)));

  const oggi = document.getElementById("oggi");
  // swipe sulla parte in alto (data e riepilogo): a sinistra il giorno dopo, a destra il giorno prima
  let _sw = null;
  oggi.addEventListener("touchstart", (e) => {
    const zona = e.target.closest && e.target.closest(".oggi-nav, .oggi-card.riepilogo");
    _sw = zona && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  oggi.addEventListener("touchend", (e) => {
    if (!_sw || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - _sw.x, dy = e.changedTouches[0].clientY - _sw.y; _sw = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;   // solo un gesto chiaramente orizzontale
    const btn = oggi.querySelector(`[data-oggi-giorno="${dx < 0 ? 1 : -1}"]`);
    if (btn) btn.click();
  }, { passive: true });
  oggi.addEventListener("click", (e) => {
    const sa = e.target.closest("[data-scegli-allen-data]");
    if (sa) {
      const d = sa.dataset.scegliAllenData;
      apriSceltaAllenamenti(`Allenamenti · ${d === oggiISO() ? "oggi" : fmtGiornoLungo(d)}`, giornoDiario(d).tipo,
        (k) => { const gg = giornoDiario(d); gg.tipo = k; if (sceltaAllenOrario) gg.orario = sceltaAllenOrario; scriviGiorno(d, gg); }, () => { closeModal(); renderOggi(); }, d);
      return;
    }
    const sh = e.target.closest("[data-sett-home]");
    if (sh) { offsetSettHome = Math.min(1, offsetSettHome + +sh.dataset.settHome); giornoSelSett = null; renderOggi(); return; }
    const ag = e.target.closest("[data-apri-giorno]");
    if (ag) { dataDiario = ag.dataset.apriGiorno; vistaHome = "oggi"; renderOggi(); window.scrollTo(0, 0); return; }
    const nav = e.target.closest("[data-oggi-giorno]");
    if (nav) { cambiaGiornoDiario(+nav.dataset.oggiGiorno); return; }
    const scrivi = e.target.closest("[data-oggi-scrivi]");
    if (scrivi) {
      apriPastoDiario(dataDiario, null, scrivi.dataset.oggiScrivi); return;
    }
    if (!e.target.closest("[data-avviso-ok]") && e.target.closest("[data-avviso-cosa]")) { apriCosaAggiungere(); return; }
    const okA = e.target.closest("[data-avviso-ok]");
    if (okA) {
      const p = okA.closest(".avviso");
      const tutti = leggiAvvisiVisti(); const g = tutti[dataDiario] = tutti[dataDiario] || {};
      g[okA.dataset.avvisoOk] = +okA.dataset.v;
      for (const k of Object.keys(tutti)) if (k < addGiorniISO(oggiISO(), -7)) delete tutti[k]; // niente archivio vecchio
      try { localStorage.setItem("mp_avvisi", JSON.stringify(tutti)); } catch (err) {}
      if (p) { p.classList.add("sparisce"); setTimeout(() => renderOggi(), 220); } else renderOggi();
      return;
    }
    const mom = e.target.closest("[data-oggi-momento]");
    if (mom) { apriPastoDiario(dataDiario, null, mom.dataset.oggiMomento); return; }
    if (e.target.closest("[data-rigenera-giorno]")) {
      // sostituisce tutti i pasti non ancora passati (anche quelli scritti da te): spunta un pannello dal basso con «Annulla» / «Cambia», perché ci si finisce per sbaglio subito dopo «Compila i pasti»
      const giorno = dataDiario;
      chiediConferma("Cambiare il menu?", "Sostituisce i pasti non ancora passati", "Cambia", () => {
        if (dataDiario !== giorno) return;
        const r = rigeneraGiorno(dataDiario);
        renderOggi();
        if (!r.messe) { avviso("Nessuna alternativa che stia nei tuoi valori", "", () => {}); return; }
        avviso("✓ Pasti cambiati", "Annulla", () => { annullaPianificazione(r.prima); renderOggi(); });
      });
      return;
    }
    if (e.target.closest("[data-compila-giorno]")) {
      const r = pianificaSettimana(dataDiario, dataDiario);
      renderOggi(); if (r.messe) avviso("✓ Pasti pronti", "Annulla", () => { annullaPianificazione(r.prima); renderOggi(); });
      return;
    }
  });
  oggi.addEventListener("change", (e) => {
    if (!e.target.classList.contains("oggi-tipo")) return;
    const g = giornoDiario(dataDiario);
    g.tipo = e.target.value;
    scriviGiorno(dataDiario, g);
    renderOggi();
  });

  // Elenco dei piatti di un pasto
  // foglio "Cosa aggiungo?" (dall'avviso di quello che manca)
  document.getElementById("modal-content").addEventListener("click", (e) => {
    const mo = e.target.closest("[data-cosa-mossa]"), alt = e.target.closest("[data-cosa-altre]");
    if (!mo && !alt) return;
    if (alt) { cosaGiro[alt.dataset.cosaAltre] = (cosaGiro[alt.dataset.cosaAltre] || 0) + 1; aggiornaCosaAggiungere(); return; }
    const data = dataDiario, prima = applicaMossaCosa(data, mo.dataset.cosaMossa);
    if (prima === false) return;
    closeModal(); renderOggi(); window.scrollTo(0, 0);   // scelto: si chiude e vedi tutta la giornata in Oggi
    avviso("✓ Fatto", "Annulla", () => { scriviGiorno(data, JSON.parse(prima)); renderOggi(); });
  });
  document.getElementById("modal-content").addEventListener("click", (e) => {
    const pz = e.target.closest("[data-grp-pz]");
    if (pz) { const [n, d] = pz.dataset.grpPz.split("|").map(Number); cambiaPezziViva(n, d); return; }   // − / ＋ delle porzioni nell'intestazione della ricetta
    const gd = e.target.closest("[data-grp-del]");
    if (gd) { togliRicettaViva(+gd.dataset.grpDel); return; }
    const vt = e.target.closest("[data-voce-toggle]");
    if (vt && e.target.closest("[data-lib-avv],[data-lib-avvt],[data-lib-del]")) return;   // il ⚠ ha il suo comando: non apre la scheda
    if (vt && liberoCtx && liberoCtx.vociAperte) { const nm = vt.dataset.voceToggle, A = liberoCtx.vociAperte; A.has(nm) ? A.delete(nm) : A.add(nm); rirenderLibero(); return; }
    const gt = e.target.closest("[data-grp-toggle]");
    if (gt && liberoCtx && liberoCtx.gruppiAperti) { const n = +gt.dataset.grpToggle, A = liberoCtx.gruppiAperti; A.has(n) ? A.delete(n) : A.add(n); rirenderLibero(); return; }   // un tocco sul riquadro: apre o chiude gli ingredienti
  });

  // Pannello degli sport del giorno + settimana tipo dal Profilo
  document.getElementById("modal-content").addEventListener("click", (e) => {
    const st = e.target.closest("[data-scegli-allen-sett]");
    if (st) {
      const i = +st.dataset.scegliAllenSett;
      apriSceltaAllenamenti(`Di solito il ${["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"][i]}`, leggiTipi()[i],
        (k) => { const t = leggiTipi(); t[i] = k; salvaTipi(t); }, () => { riapriProfilo(); renderOggi(); });
      return;
    }
    if (!sceltaAllen) return;
    const sp = e.target.closest("[data-allen-sport]");
    if (sp) { const id = sp.dataset.allenSport; sceltaAllen.sel.has(id) ? sceltaAllen.sel.delete(id) : sceltaAllen.sel.add(id); document.getElementById("modal-content").innerHTML = sceltaAllenHTML(); return; }
    const ao = e.target.closest("[data-allen-orario]");
    if (ao) { sceltaAllen.orario = ao.dataset.allenOrario; document.getElementById("modal-content").innerHTML = sceltaAllenHTML(); return; }
    if (e.target.closest("[data-allen-riposo]")) { sceltaAllen.sel.clear(); document.getElementById("modal-content").innerHTML = sceltaAllenHTML(); return; }
    if (e.target.closest("[data-allen-salva]")) { const c = sceltaAllen; sceltaAllen = null; sceltaAllenOrario = c.orario; c.salva(chiaveTipo([...c.sel])); c.dopo(); riadattaDopo(dataDiario); }
  });

  // Dentro l'editor: scelta del pasto e idee dal ricettario
  document.getElementById("modal-content").addEventListener("click", (e) => {
    if (!liberoCtx) return;
    if (e.target.closest("[data-idee-altre]") && liberoCtx) { liberoCtx.ideeGiro = (liberoCtx.ideeGiro || 0) + 1; rirenderLibero(); return; }
    const ric = e.target.closest("[data-oggi-ricetta]");
    if (ric) {   // ＋ = aggiungi subito; tocco sulla ricetta = anteprima con la versione più fit
      if (e.target.closest(".rr-piu")) { usaRicettaNellEditor(ric.dataset.oggiRicetta); return; }
      liberoCtx.anteprima = ric.dataset.oggiRicetta; liberoCtx.fitApplicato = null; liberoCtx.antQta = {}; liberoCtx.antK = null; liberoCtx.antUni = null; rirenderLibero(); return;
    }
    const pz = e.target.closest("[data-pezzi]");
    if (pz) { cambiaPezzi(+pz.dataset.pezzi); return; }
    const rec = e.target.closest("[data-oggi-recente]");
    if (rec) ripetiPasto(rec.dataset.oggiRecente);
  });

  document.addEventListener("click", (e) => { const c = e.target.closest("[data-muovi]"); if (c) { const [id, v] = c.dataset.muovi.split(":"); segnaMovimento(id, v); } });

  // Tornando sull'app: se stavi guardando "oggi" ed è passata la mezzanotte, mostra il giorno nuovo
  let oggiVisto = oggiISO();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const ora = oggiISO();
    if (ora !== oggiVisto) { if (dataDiario === oggiVisto) dataDiario = ora; oggiVisto = ora; }
    if (vistaCorrente() === "oggi") renderOggi();
  });
});
