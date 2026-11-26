// =============================================================
//  Pasto libero — "ho mangiato altro"
//  Scrivi gli ingredienti (es. "pollo, zucca"): l'app calcola i grammi
//  per centrare calorie e macro che restano per quel pasto, e se la
//  giornata non torna suggerisce come completarla.
// =============================================================

let liberoCtx = null; // { giorno, slot, items: [{ nome, qta, lock }], nome, ignoto }

// -------- Riconoscimento alimenti --------
const norm = (x) => String(x).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(d|di)['’]\s*/g, "di ").trim(); // "d'arachidi" = "di arachidi"
const stem = (x) => x.length > 3 ? x.replace(/([cg])h([ei])$/, (m, c, v) => c + (v === "e" ? "a" : "o")).replace(/[aeiou]$/, "") : x;   // pesche -> pesca, fichi -> fico, poi senza vocale finale
// Parola cercata -> alimento preferito (quando ce ne sono tanti simili)
const PREFERITI = {
  "yogurt kefir": "Kefir bianco", "kefir yogurt": "Kefir bianco", "yogurt di kefir": "Kefir bianco", "kefir magro": "Kefir bianco", "yogurt kefir magro": "Kefir bianco", "kefir intero": "Kefir bianco", "kefir bianco": "Kefir bianco", kefir: "Kefir bianco", "kefir da bere": "Kefir da bere", "kefir liquido": "Kefir da bere", "bevanda kefir": "Kefir da bere", "kefir bevanda": "Kefir da bere",
  // sodo, strapazzato, in camicia, frittata: calorie quasi uguali all'uovo normale → un solo alimento; il tegamino ha più grasso
  "uovo sodo": "Uova", "uova sode": "Uova", sodo: "Uova", sode: "Uova", "uovo strapazzato": "Uova", "uova strapazzate": "Uova", strapazzate: "Uova", strapazzato: "Uova",
  "uovo in camicia": "Uova", "uova in camicia": "Uova", camicia: "Uova", frittata: "Uova", omelette: "Uova",
  "uovo al tegamino": "Uova al tegamino", "uova al tegamino": "Uova al tegamino", "uovo fritto": "Uova al tegamino", "uova fritte": "Uova al tegamino", "occhio di bue": "Uova al tegamino", tegamino: "Uova al tegamino",
  fegato: "Fegato di manzo", fegatini: "Fegato di pollo", coniglio: "Coniglio", agnello: "Agnello (carne magra)", anatra: "Petto d'anatra",
  sardine: "Sardine", acciughe: "Alici", trota: "Trota", spada: "Pesce spada", arachidi: "Arachidi", spremuta: "Spremuta d'arancia", te: "Tè",
  cappuccino: "Cappuccino scremato", cappuccini: "Cappuccino scremato",
  pollo: "Petto di pollo", tacchino: "Fesa di tacchino", manzo: "Manzo magro", salmone: "Salmone fresco",
  tonno: "Tonno in scatola al naturale", riso: "Riso basmati cotto", pasta: "Pasta", pane: "Pane integrale",
  yogurt: "Yogurt greco 0%", latte: "Latte parzialmente scremato", uovo: "Uova", olio: "Olio EVO",
  "olio di oliva": "Olio EVO", "manzo macinato": "Manzo magro macinato", pesca: "Pesca", pesche: "Pesca", susina: "Prugne", susine: "Prugne", melograno: "Melagrana", cocomero: "Anguria", pomelo: "Pompelmo", nespola: "Nespole", nespole: "Nespole", "fico d'india": "Fico d'India", "fichi d'india": "Fico d'India", "pesca noce": "Nettarina", "pesche noci": "Nettarina", "nettarine": "Nettarina", "pesca nettarina": "Nettarina", "carne macinata": "Manzo magro macinato", "macinato di manzo": "Manzo magro macinato", "pomodori pelati": "Passata di pomodoro", "pelati": "Passata di pomodoro", "pollo macinato": "Fesa di tacchino macinata", "macinato di pollo": "Fesa di tacchino macinata", "macinato di tacchino": "Fesa di tacchino macinata", "olio extravergine": "Olio EVO", "olio extravergine di oliva": "Olio EVO", "yogurt vegetale": "Yogurt di soia", "yogurt di soia": "Yogurt di soia", "gocce di cioccolato": "Gocce di cioccolato", "caffe solubile": "Caffè", "farina 0": "Farina 00", "latte vegetale": "Bevanda di soia", "bevanda vegetale": "Bevanda di soia", "bevanda di avena": "Bevanda di avena",
  pomodoro: "Pomodori", avena: "Fiocchi d'avena", fagioli: "Fagioli cannellini cotti", ceci: "Ceci cotti",
  lenticchie: "Lenticchie cotte", formaggio: "Grana Padano", parmigiano: "Parmigiano", prosciutto: "Prosciutto cotto",
  maiale: "Lonza di maiale", pesce: "Merluzzo", insalata: "Insalata", patata: "Patate",
  pizza: "Pizza margherita", "pizza bianca": "Pizza bianca mozzarella funghi e speck", "pizza funghi e speck": "Pizza bianca mozzarella funghi e speck",
  aperitivo: "Aperitivo condiviso (tagliere)", tagliere: "Aperitivo condiviso (tagliere)", "tagliere salumi e formaggi": "Aperitivo condiviso (tagliere)",
  salumi: "Salumi misti", formaggi: "Formaggi misti", vino: "Vino rosso", hamburger: "Panino hamburger", panino: "Panino con prosciutto", patatine: "Patatine fritte", caffe: "Caffè", cola: "Coca cola", "coca": "Coca cola", aperol: "Spritz", "aperol spritz": "Spritz",
  farina: "Farina 00", zucchero: "Zucchero", lievito: "Lievito per dolci", sciroppo: "Sciroppo d'acero",
  albumi: "Albume", uova: "Uova",
  "latte di avena": "Bevanda di avena", "latte di soia": "Bevanda di soia", "latte di mandorla": "Bevanda di mandorla",
  "olio di girasole": "Olio di semi", "olio di avocado": "Olio di semi", "farina di grano integrale": "Farina integrale",
  "cioccolato fondente": "Cioccolato fondente", "cocco": "Cocco grattugiato",
  "petto di tacchino": "Fesa di tacchino", "fesa di tacchino": "Fesa di tacchino", spigola: "Branzino", bistecca: "Manzo magro", filetto: "Manzo magro", brioche: "Cornetto", croissant: "Cornetto", stevia: "Dolcificante", camomilla: "Tisana", songino: "Valeriana", amatriciana: "Pasta all'amatriciana", "omega 3": "Omega 3 (capsule)", merendine: "Merendina al cacao", merendina: "Merendina al cacao", gelatina: "Gelatina in fogli", porcini: "Funghi porcini", lupini: "Lupini", frullato: "Smoothie di frutta", smoothie: "Smoothie di frutta", centrifugato: "Smoothie di frutta", crepes: "Crepes dolci", gatorade: "Bevanda isotonica", powerade: "Bevanda isotonica", "integratori salini": "Bevanda isotonica", caseina: "Caseina in polvere", cheeseburger: "Panino hamburger", magnesio: "Magnesio (integratore)", "vitamina c": "Vitamina C (integratore)", ginseng: "Ginseng (bevanda)", collagene: "Collagene in polvere", "gel energetico": "Gel energetico", nuggets: "Nuggets di pollo", "pad thai": "Pad thai",
};
// "cappuccino con latte di soia", "2 cappuccini interi", "cappuccino scremato"…: tutte le forme portano alla variante giusta
[["scremato", "scremati"], ["parzialmente scremato", "parzialmente scremati"], ["intero", "interi"], ["di soia"], ["di avena"], ["di mandorla"], ["soia"], ["avena"], ["mandorla"]].forEach(([k, plur]) => {
  const tipo = k.replace(/^di /, "");
  const nome = "Cappuccino " + (["soia", "avena", "mandorla"].includes(tipo) ? "di " + tipo : tipo);
  ["cappuccino", "cappuccini"].forEach(b => { PREFERITI[`${b} ${k}`] = nome; PREFERITI[`${b} con latte ${tipo.startsWith("di ") ? tipo : (["soia", "avena", "mandorla"].includes(tipo) ? "di " + tipo : tipo)}`] = nome; if (plur) PREFERITI[`${b} ${plur}`] = nome; });
});
// Alimenti in tabella che corrispondono a una parola (il migliore per primo)
// distanza di modifica tra due parole (quante lettere cambiare): serve a perdonare gli errori di battitura
function distanzaTesto(a, b) {
  const m = a.length, k = b.length; let prev = Array.from({ length: k + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= k; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[k];
}
// due parole "uguali a meno di un errore di battitura" (1 lettera, 2 per le parole lunghe)
const paroleVicine = (a, b) => { a = norm(a); b = norm(b); return a.length >= 4 && b.length >= 3 && Math.abs(a.length - b.length) <= 2 && distanzaTesto(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1); };
// Quante volte hai mangiato ogni alimento negli ultimi 60 giorni e l'ultima quantità: la ricerca mette prima ciò che usi di più, e la quantità proposta parte da quella di solito
let _usoCache = { raw: null, freq: {}, ultima: {} };
function usoAlimenti() {
  let raw = null; try { raw = localStorage.getItem("mp_diario"); } catch (e) {}
  if (raw === _usoCache.raw) return _usoCache;
  const freq = {}, ultima = {};
  try {
    const d = JSON.parse(raw) || {}, da = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    Object.keys(d).filter(k => k >= da).sort().forEach(k => (d[k].pasti || []).forEach(p => (p.ingredienti || []).forEach(i => {
      if (!i.nome) return;
      freq[i.nome] = (freq[i.nome] || 0) + 1;
      const g = typeof grammiIng === "function" ? grammiIng(i) : i.qta;
      if (g > 0 && (i.unita || "g") === "g") ultima[i.nome] = g;   // l'ultima volta (i giorni sono in ordine)
    })));
  } catch (e) {}
  _usoCache = { raw, freq, ultima };
  return _usoCache;
}
function cercaAlimenti(q) {
  const n = norm(q);
  if (!n) return [];
  const chiavi = Object.keys(window.ALIMENTI || {});
  const esatto = chiavi.find(k => norm(k) === n);
  const s = stem(n);
  const pref = PREFERITI[n] || PREFERITI[s] || Object.entries(PREFERITI).find(([k]) => stem(k) === s)?.[1];
  // corrispondenza a inizio parola ("pollo" non deve trovare "cipolla")
  const match = chiavi.filter(k => norm(k).startsWith(n) || norm(k).split(/[\s']+/).some(w => w.startsWith(s)));
  const ord = match.sort((a, b) =>
    (b === esatto) - (a === esatto) || (b === pref) - (a === pref) ||
    norm(b).startsWith(s) - norm(a).startsWith(s) || ((usoAlimenti().freq[b] || 0) - (usoAlimenti().freq[a] || 0)) || a.length - b.length);
  if (pref && !ord.includes(pref) && window.ALIMENTI[pref]) ord.unshift(pref);
  // un errore di battitura ("banna", "pettto di polo"): si cercano i nomi con parole quasi uguali (distanza di modifica ≤ 1, ≤ 2 per parole lunghe)
  if (!ord.length && n.length >= 4) {
    const pq = n.split(/[\s']+/).filter(w => w.length >= 4);
    const dist = distanzaTesto;
    const dParola = (w, k) => Math.min(...norm(k).split(/[\s']+/).filter(x => x.length >= 3).map(x => x.startsWith(w) ? 0 : dist(w, x)), 9);
    const lim = (w) => w.length >= 7 ? 2 : 1;
    const per = pq.length ? chiavi.map(k => ({ k, d: pq.reduce((a, w) => a + dParola(w, k), 0), ok: pq.every(w => dParola(w, k) <= lim(w)) })).filter(x => x.ok) : [];
    if (per.length) return per.sort((a, b) => a.d - b.d || a.k.length - b.k.length).slice(0, 12).map(x => x.k);
  }
  // nessuna corrispondenza con tutta la frase ("ricotta light"): si cerca per le singole parole
  if (!ord.length && n.includes(" ")) {
    const parole = n.split(/[\s']+/).filter(w => w.length >= 4).map(stem);
    const per = chiavi.filter(k => parole.some(w => norm(k).split(/[\s']+/).some(x => x.startsWith(w))));
    return per.sort((a, b) => parole.filter(w => norm(b).includes(w)).length - parole.filter(w => norm(a).includes(w)).length || a.length - b.length);
  }
  return ord;
}

// -------- Categorie: limiti e porzione tipica per il calcolo --------
function profiloAlimento(nome) {
  const p = profiloBase(nome), u = usoAlimenti().ultima[nome];
  if (u && u >= p.lo && u <= p.hi) p.tip = Math.round(u);   // la quantità che di solito usi diventa quella di partenza
  return p;
}
function profiloBase(nome) {
  const a = window.ALIMENTI[nome];
  if (/datteri|uvetta|fichi secchi|albicocche secche/i.test(nome)) return { lo: 8, hi: 40, tip: 16 }; // frutta secca zuccherina: poca per volta
  const kP = a[1] * 4 / Math.max(a[0], 1), kC = a[2] * 4 / Math.max(a[0], 1), kG = a[3] * 9 / Math.max(a[0], 1);
  if (a[0] >= 650 && kG >= 0.8) return { lo: 3, hi: 25, tip: 10 };         // olio, burro
  if (a[0] >= 450 && kG >= 0.5) return { lo: 5, hi: 40, tip: 15 };          // frutta secca, semi
  if (a[0] >= 300 && kG >= 0.5) return { lo: 5, hi: 40, tip: 20 };          // formaggi stagionati (parmigiano, grana…): da condimento
  if (kP >= 0.35 && a[0] < 450) return { lo: 50, hi: 300, tip: 150 };       // carne, pesce, uova, latticini magri
  if (a[0] < 45) return { lo: 80, hi: 350, tip: 200 };                       // verdure
  if (kC >= 0.55 && a[0] >= 300) return { lo: 30, hi: 130, tip: 70 };        // pasta/riso crudi, pane secco, cereali
  if (kC >= 0.55 && a[0] >= 100) return { lo: 60, hi: 300, tip: 150 };       // carboidrati cotti, pane
  if (kC >= 0.55) return { lo: 80, hi: 300, tip: 150 };                      // frutta
  return { lo: 20, hi: 250, tip: 100 };
}

// -------- Calcolo dei grammi --------
// Minimi quadrati con limiti (discesa per coordinate): si avvicina a kcal,
// proteine, carboidrati e grassi del target, restando su porzioni sensate.
const MACRO_K = ["kcal", "proteine", "carboidrati", "grassi"];
const PESI_K = [3, 2, 1, 1];
function calcolaGrammi(items, target) {
  const sc = [Math.max(target.kcal, 100), Math.max(target.proteine, 10), Math.max(target.carboidrati, 10), Math.max(target.grassi, 5)];
  const A = items.map(it => window.ALIMENTI[it.nome].map(v => v / 100));
  const prof = items.map(it => profiloAlimento(it.nome));
  const x = items.map((it, i) => it.lock ? it.qta : prof[i].tip);
  const lambda = 0.04; // quanto restare vicino alle porzioni tipiche
  const tot = () => MACRO_K.map((_, k) => x.reduce((s, xi, i) => s + A[i][k] * xi, 0));
  for (let it = 0; it < 300; it++) {
    items.forEach((item, i) => {
      if (item.lock) return;
      const t = tot();
      let num = lambda / prof[i].tip, den = lambda / (prof[i].tip ** 2);
      MACRO_K.forEach((_, k) => {
        const resto = t[k] - A[i][k] * x[i];
        const w = PESI_K[k] / (sc[k] ** 2);
        num += w * A[i][k] * ((target[MACRO_K[k]] || 0) - resto);
        den += w * A[i][k] ** 2;
      });
      x[i] = Math.max(prof[i].lo, Math.min(prof[i].hi, num / den));
    });
  }
  return x.map((v, i) => {
    if (items[i].lock) return items[i].qta;
    const u = unitaDi(items[i]), gu = grammiPerUnita(items[i].nome, u); // a pezzi: pezzi interi; a cucchiai: mezzi cucchiai
    if (u === "pz" && gu) return Math.round(Math.max(1, Math.round(v / gu)) * gu);
    if (gu) return Math.round(Math.max(0.5, Math.round(v / gu * 2) / 2) * gu);
    return Math.max(5, Math.round(v / 5) * 5);
  });
}

// Macro di un insieme di ingredienti in grammi
// Di quanto cambia la quantità a ogni tocco di − / ＋: pezzi interi (mezzi per i frutti grandi), mezzi cucchiai, grammi in base all'alimento
// Cose che si contano a pezzi interi (tortilla, piadina, wrap, panino…): 1, 2, 3… (i mezzi solo se li scrivi tu). Il peso del pezzo cambia con la grandezza.
const PEZZI_INTERI = /tortilla|piadina|wrap|pita\b|naan|panino|pizza|focaccia|cornetto|crepe|cialda/i;
const eIntero = (nome, u) => u === "pz" && PEZZI_INTERI.test(String(nome));
// quantità in grammi portata a pezzi interi (almeno 1) se l'alimento si conta a pezzi interi
// pizza e focaccia: al minimo mezza
const PEZZI_MEZZI = /pizza|focaccia/i;
function qtaPezziInteri(nome, u, qta) { const gu = grammiPerUnita(nome, u); if (!(eIntero(nome, u) && gu)) return qta; const m = PEZZI_MEZZI.test(String(nome)) ? 2 : 1; return Math.max(1, Math.round(qta / gu * m)) / m * gu; }
// prossimo valore dopo un tocco su − / ＋: il multiplo del passo successivo (0,6 pz con passo 1 → 1, non 2)
const prossimoMultiplo = (att, d, passo) => Math.max(passo, (d > 0 ? Math.floor(att / passo + 1e-9) + 1 : Math.ceil(att / passo - 1e-9) - 1) * passo);
// grammi dopo un tocco su − / ＋ (senza unità a pezzi/cucchiai): di 10 in 10 (sotto i 10 di 1 in 1);
// gli alimenti che si usano a piccole dosi (olio, burro, frutta secca, semi, parmigiano…) di 1 in 1 (10 → 11 → 12 g): per i salti grandi ci sono le pillole sotto il contatore
function grammiDopoStep(nome, att, d, minimo) {
  let piccolo = false; try { piccolo = !!(window.ALIMENTI || {})[nome] && profiloBase(nome).tip <= 25; } catch (e) {}
  if (piccolo) return Math.max(minimo, d > 0 ? Math.floor(att + 1e-9) + 1 : Math.ceil(att - 1e-9) - 1);
  return Math.max(minimo, d > 0 ? (att < 10 ? Math.floor(att) + 1 : Math.floor(att / 10) * 10 + 10) : (att <= 10 ? Math.ceil(att) - 1 : Math.ceil(att / 10) * 10 - 10));
}
function passoQuantita(it) {
  const u = unitaDi(it), gu = grammiPerUnita(it.nome, u);
  if (gu) return { gu, passo: eIntero(it.nome, u) && !PEZZI_MEZZI.test(String(it.nome)) || (u === "pz" && gu < 100 && !PEZZI_MEZZI.test(String(it.nome))) ? 1 : 0.5 };
  const tip = profiloAlimento(it.nome).tip;
  return { gu: 0, passo: tip <= 25 ? 5 : tip <= 80 ? 10 : 25 };
}
// Unità di misura di un ingrediente: g (o ml), pezzi (se si contano), cucchiaio, cucchiaino.
// La scelta si ricorda per ogni alimento (es. burro di arachidi a cucchiai).
const UNITA_LIQUIDI = /^(latte|bevanda|kefir da bere|gin|spritz|mojito|negroni|vino|prosecco|birra|vodka|rum|tonica|coca cola|succo|spremuta|panna|aceto|salsa di soia|brodo|tè|cappuccino|caffè|cioccolata calda|energy drink|frullato|limonata)(?![a-zà-ù])/i; // solo se il nome INIZIA così: "Fiocchi di latte", "Cioccolato al latte", "Rucola" non sono liquidi
function unitaPreferita(nome) {
  try { const u = (JSON.parse(localStorage.getItem("mp_unita")) || {})[nome]; if (u) return u; } catch (e) {}
  return window.pzPredefinito && window.pzPredefinito(nome) ? "pz" : UNITA_LIQUIDI.test(nome) ? "ml" : "g";
}
function salvaUnitaPreferita(nome, u) { try { const m = JSON.parse(localStorage.getItem("mp_unita")) || {}; m[nome] = u; localStorage.setItem("mp_unita", JSON.stringify(m)); } catch (e) {} }
// I cucchiai hanno senso solo per creme, oli, polveri, yogurt, salse…: non per una mela o una bistecca
const A_CUCCHIAI = /^olio|burro|crema|tahina|^marmellata|confettura|miele|sciroppo|nutella|zucchero|eritritolo|\bsale\b|cacao|farin|fecola|amido|avena|fiocchi di (?:avena|cereali|riso)|proteine in polvere|semi|chia|sesamo|lino|granola|muesli|yogurt|skyr|ricotta|fiocchi di latte|mascarpone|spalmabile|philadelphia|parmigiano|^grana|pecorino|hummus|pesto|salsa|ketchup|maionese|senape|aceto|^latte|fiocchi di latte|panna|kefir|bevanda|cannella|curry|spezie|lievito|bicarbonato|passata|concentrato|cocco|cioccolato in polvere|gocce di cioccolato|uvetta|quark|stracchino|gorgonzola|pinoli|paprika|zenzero|prezzemolo|basilico|miso|wasabi|guacamole|purea di mela|pangrattato|besciamella|sugo|ragù di carne|vaniglia|cornflakes|frutta secca mista|curcuma|cumino|origano|rosmarino|salvia|timo|alloro|zafferano|garam|peperoncino in polvere|cardamomo|chiodi di garofano|sumac|za'atar|harissa|capperi|matcha|tamari|erbe aromatiche|dado/i;
const puoUsareCucchiai = (nome) => A_CUCCHIAI.test(nome);
const unitaDi = (it) => {
  const u = it.unita || unitaPreferita(it.nome);
  if (u === "pz" && !(window.PESO_PZ || {})[it.nome]) return "g";
  // senza un'unità scelta per questa riga: i pezzi solo se tornano (interi o mezzi), altrimenti grammi («165 g di banana», non «1,4 banane»)
  if (u === "pz" && !it.unita && +it.qta > 0 && typeof pezziPuliti === "function" && !pezziPuliti(it.nome, it.qta / window.PESO_PZ[it.nome])) return UNITA_LIQUIDI.test(it.nome) ? "ml" : "g";
  if ((u === "cucchiaio" || u === "cucchiaino") && !puoUsareCucchiai(it.nome)) return "g";
  return u;
};
// grammi in una unità (0 per i grammi stessi)
function grammiPerUnita(nome, u) {
  if (u === "pz") return (window.PESO_PZ || {})[nome] || 0;
  if (u === "cucchiaio") return window.pesoCucchiaio(nome, false);
  if (u === "cucchiaino") return window.pesoCucchiaio(nome, true);
  return 0;
}
// numero scritto a mano: "0,5", "1/2", "½"
function leggiNumero(t) {
  t = String(t).trim().replace(",", ".");
  const fr = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
  if (fr[t] !== undefined) return fr[t];
  const m = t.match(/^(\d+)\s*\/\s*(\d+)$/); if (m) return +m[1] / +m[2];
  return parseFloat(t);
}
function macroDa(items) {
  return calcolaMacro({ ingredienti: items.map(it => ({ nome: it.nome, qta: it.qta, unita: "g" })) });
}
// Macro di g grammi di un alimento, contati come calcolaMacro (kcal = 4P + 4C + 9G, più l'alcol) ma senza arrotondare:
// così i "+114 kcal" promessi da un consiglio sono quelli che il diario registra davvero (le kcal di etichetta a volte differiscono)
function macroAlimento(nome, g) {
  const a = (window.ALIMENTI || {})[nome]; if (!a) return { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 };
  const q = g / 100, p = a[1] * q, c = a[2] * q, gr = a[3] * q, manca = a[0] - (4 * a[1] + 4 * a[2] + 9 * a[3]);
  return { kcal: 4 * p + 4 * c + 9 * gr + (manca >= 20 ? manca * q : 0), proteine: p, carboidrati: c, grassi: gr };
}


// -------- Suggerimenti --------
// Alimenti "jolly" per colmare un macro mancante
const JOLLY = {
  proteine:    ["Albume", "Yogurt greco 0%", "Fiocchi di latte", "Petto di pollo", "Merluzzo"],
  carboidrati: ["Pane integrale", "Riso basmati cotto", "Patate", "Banana", "Gallette di riso"],
  grassi:      ["Olio EVO", "Mandorle", "Avocado", "Parmigiano", "Noci"],
};
const NOMI_MACRO = { proteine: "proteine", carboidrati: "carboidrati", grassi: "grassi" };
// Per ogni macro che manca: 2–3 alimenti con i grammi per colmarlo
function suggerimentiMacro(diff, esclusi = []) {
  const out = [];
  const soglia = { proteine: 8, carboidrati: 12, grassi: 5 };
  ["proteine", "carboidrati", "grassi"].forEach((k, idx) => {
    if (diff[k] < soglia[k]) return;
    const kk = idx + 1;
    const opz = JOLLY[k].filter(n => window.ALIMENTI[n] && !esclusi.includes(n) && !(typeof alimentoEscluso === "function" && alimentoEscluso(n))).slice(0, 3).map(n => {
      const a = window.ALIMENTI[n];
      let g = diff[k] / (a[kk] / 100);
      // non sforare troppo le calorie che restano (tolleranza 100 kcal)
      const maxKcal = Math.max(diff.kcal, 0) + 100;
      const k100 = macroAlimento(n, 100).kcal;   // kcal come le conta il diario
      if (k100 * g / 100 > maxKcal) g = maxKcal / (k100 / 100);
      const p = profiloAlimento(n);
      g = Math.max(p.lo, Math.min(p.hi, Math.round(g / 5) * 5));
      return { nome: n, g, kcal: Math.round(macroAlimento(n, g).kcal) };
    });
    out.push({ macro: k, manca: Math.round(diff[k]), opz });
  });
  return out;
}

// -------- Modale "pasto libero" (usato dal diario e dal piano) --------
// liberoCtx contiene: items, nome, ignoto e le funzioni del contesto:
//   target()        -> obiettivo del pasto (kcal e macro)
//   intestazione()  -> HTML sopra l'obiettivo
//   salva(pasto)    -> dove salvare il pasto
//   elimina         -> (facoltativo) funzione
//   etichettaSalva  -> testo del pulsante di salvataggio
// Il contenuto del pannello del pasto in un solo blocco, con fuori solo la barra «Salva»: così, a pannello alto e fisso,
// la barra sta sempre in fondo e gli spazi tra i blocchi restano quelli di sempre
function corpoPasto(html) {
  const t = document.createElement("template"); t.innerHTML = html;
  const barra = [...t.content.children].find(e => e.classList.contains("barra-salva"));
  const corpo = document.createElement("div"); corpo.className = "lib-corpo";
  [...t.content.childNodes].filter(n => n !== barra).forEach(n => corpo.appendChild(n));
  t.content.insertBefore(corpo, t.content.firstChild);
  return t.innerHTML;
}
function apriEditorPasto(ctx, items, nome, ricalcola = true) {
  editCtx = null;
  liberoCtx = Object.assign({ items: items || [], nome: nome || "", ignoto: null }, ctx);
  if (ricalcola && liberoCtx.items.length) ricalcolaLibero();
  openModal(corpoPasto(liberoHTML()));
  // il pannello del pasto si apre subito alto quanto può: cambiando quantità o consigli il bordo in alto resta fermo (niente salti sotto il dito)
  document.querySelector("#modal .modal-sheet").classList.add("foglio-pieno");
  if (liberoCtx.vivo && !liberoCtx.items.length) rifocusInput();   // pasto vuoto: si scrive subito
}
// -------- Suggerimenti mentre scrivi: già dalla prima lettera --------
const AUTOC_LEAD = /^\s*(?:\d+(?:[.,]\d+)?|[½¼¾])?\s*(?:(?:g|gr|ml|pz|cucchiai[o]?|cucchiaini?)\b\.?)?\s*(?:di\s+)?/i;
// Ricette del ricettario che corrispondono a quello che scrivi ("pancake" → i pancake di casa)
// Il nome di una ricetta contiene tutto quello che scrivi (parole in qualunque ordine, anche iniziate soltanto)
function nomeCorrisponde(nome, q) {
  const nq = norm(q), nn = norm(nome);
  if (!nq) return false;
  if (nn.includes(nq)) return true;
  const parole = nn.split(/[^a-z0-9]+/).filter(Boolean);
  const tok = nq.split(/[^a-z0-9]+/).filter(Boolean);
  return tok.length > 0 && tok.every(t => { const s = stem(t); return parole.some(w => w.startsWith(t) || w.startsWith(s)); });
}
function cercaRicetteTesto(q, n = 5) {
  const c = liberoCtx, nq = norm(q);
  if (!c || !c.tutteRicette || (c.items.length && !c.vivo) || nq.length < 2 || typeof ricette === "undefined" || typeof porzioneSuMisura !== "function") return [];
  const T = c.target();
  const viste = new Set();
  const quota = (r) => { const ps = porzioneSuMisura(r, T); return { r, ps, q: (ps.tot.proteine * 4) / Math.max(1, ps.tot.kcal), k: ps.tot.kcal }; };
  // le più proteiche (a parità, meno calorie) per prime
  return ricette.filter(r => {
    if (viste.has(r.nome)) return false;
    const ok = nomeCorrisponde(r.nome, q);
    if (ok) viste.add(r.nome);
    return ok;
  }).map(quota).map(x => Object.assign(x, { no: typeof ricettaConEsclusi === "function" && ricettaConEsclusi(x.r) }))
    .sort((a, b) => (a.no - b.no) || (b.q - a.q) || (a.k - b.k)).slice(0, n);   // quelle con ingredienti che hai escluso in fondo
}
function ricetteTestoHTML(q, attr) {
  const lista = cercaRicetteTesto(q);
  if (!lista.length) return "";
  return `<div class="autoc-titolo">📖 Ricette</div>` + lista.map(({ r, ps, no }) =>
    `<button class="autoc-voce autoc-ricetta" ${attr}="${esc(r.nome)}"><b>${esc(r.nome)}</b>${no ? avvisoEsclusoHTML(((r._orig || r).ingredienti || []).map(i => i.nome).find(alimentoEscluso)) : ""}${macroStileHTML(ps.tot)}</button>`).join("");
}
// Piatti composti da più alimenti diversi: non sono ingredienti. (Il modo di cuocere o preparare un alimento — lesso, al forno, arrosto, carpaccio — resta un ingrediente.) Nel pasto si trovano tra gli alimenti, sopra le ricette; nelle ricette non si propongono.
const PIATTI_PRONTI = new Set(["Hamburger di manzo", "Pizza margherita", "Pizza marinara", "Pizza diavola", "Pizza capricciosa", "Pizza quattro formaggi", "Pizza al taglio", "Pizza bianca mozzarella funghi e speck", "Sushi", "Panino hamburger", "Panino con prosciutto", "Aperitivo condiviso (tagliere)", "Crostata alla marmellata", "Torta (ciambellone)", "Tiramisù",
  "Polpette di manzo", "Polpette di pollo o tacchino", "Hamburger di pollo", "Cotoletta di pollo impanata", "Cotoletta alla milanese", "Spezzatino di manzo", "Bastoncini di pesce",
  "Frittata", "Frittata di albumi", "Gyoza", "Involtini primavera", "Tempura di gamberi", "Pollo al curry", "Nigiri", "Maki", "Uramaki", "Poke bowl", "Zuppa di miso", "Ramen (noodles in brodo)", "Purè di patate", "Crocchette di patate",
  "Pasta al pomodoro", "Pasta al ragù", "Pasta alla carbonara", "Pasta cacio e pepe", "Pasta al pesto", "Pasta all'amatriciana", "Lasagne", "Tortellini", "Ravioli ricotta e spinaci", "Risotto ai funghi", "Risotto alla milanese", "Riso alla cantonese", "Insalata di riso", "Minestrone", "Zuppa di legumi", "Vellutata di zucca", "Crema di verdure",
  "Caponata", "Bruschetta al pomodoro", "Tramezzino", "Toast prosciutto e formaggio", "Burger vegetale", "Falafel", "Porridge (avena col latte)", "Brownie", "Muffin", "Pancake", "Cheesecake",
  "Nachos con formaggio", "Quesadilla", "Paella", "Pad thai", "Hot dog", "Club sandwich", "Nuggets di pollo", "Waffle", "Crepes dolci", "Supplì", "Crostini", "Caprese", "Ossobuco", "Saltimbocca alla romana", "Brasato", "Stufato di manzo", "Ribollita", "Panzanella", "Smoothie di frutta", "Frullato proteico", "Poke bowl"]);
// sotto il nome di un alimento che hai escluso (allergie, dieta, cibi che non mangi): «⚠️ contiene lattosio»
// sotto il nome di un alimento che è già nel pasto da solo: «già nel pasto · 150 g»
const giaNelPastoHTML = (c, n) => { const g = c && (c.items || []).find(x => x.grp == null && x.nome === n); return g ? `<small class="autoc-gia">✓ già nel pasto · ${esc(doseLeggibile(n, +g.qta || 0))}</small>` : ""; };
const avvisoEsclusoHTML = (n) => { const m = typeof motivoEscluso === "function" ? motivoEscluso(n) : ""; return m ? `<small class="autoc-escluso">⚠️ ${esc(m)}</small>` : ""; };
// Campo di ricerca toccato e ancora vuoto: sotto compaiono i mangiati di recente (come nelle app di diario alimentare); scrivendo lasciano il posto ai suggerimenti
function recentiNelCampo() {
  const c = liberoCtx, inp = document.getElementById("lib-input");
  if (!c || !inp || document.activeElement !== inp || typeof recentiHTML !== "function") return "";
  return recentiHTML(c, c.items.length > 0);   // «↻ Ripeti» solo a pasto vuoto
}
function mostraAutocompleta(testo) {
  const box = document.getElementById("lib-autoc");
  if (!box) return;
  const ultima = String(testo || "").split(/[,;+]/).pop();
  const q = ultima.replace(AUTOC_LEAD, "").trim();
  if (!q) { box.innerHTML = liberoCtx.doppione ? doppioneHTML(liberoCtx) : recentiNelCampo(); return; }   // la domanda «c'è già» resta finché non rispondi
  liberoCtx.doppione = null;   // scrivi altro: la domanda decade
  const nq = norm(q);
  const trovati = cercaAlimenti(q);   // anche quelli già nel pasto: si vedono con «già nel pasto» e, toccandoli, si chiede se sommare
  // prima quelli che iniziano per quello che hai scritto
  // prima quelli adatti a te (gli esclusi in fondo, con l'avviso), poi quelli che iniziano per quello che hai scritto
  const escl = (n) => typeof alimentoEscluso === "function" && alimentoEscluso(n);
  trovati.sort((a, b) => (escl(a) - escl(b)) || (norm(b).startsWith(nq) - norm(a).startsWith(nq)));
  const ricetteHTML = String(testo || "").includes(",") ? "" : ricetteTestoHTML(q, "data-autoc-ricetta");
  const conQta = !(ultima.match(AUTOC_LEAD) || [""])[0].trim();   // hai già scritto una quantità ("200 pol…")? allora niente dose suggerita
  const dose = (n) => { if (!conQta) return ""; const g = porzioneSolita(n), a = window.ALIMENTI[n]; return g > 0 && a ? `<em class="autoc-dose">${etichettaDose(n, g)} · ${Math.round(a[0] * g / 100)} kcal</em>` : ""; };
  const voce = (n) => `<button class="autoc-voce" data-autoc="${esc(n)}"><span class="autoc-nome">${esc(n)}${avvisoEsclusoHTML(n)}${giaNelPastoHTML(liberoCtx, n)}</span>${dose(n)}</button>`;
  const ingr = trovati.filter(n => !PIATTI_PRONTI.has(n)).slice(0, 6).map(voce).join("");       // alimenti singoli
  const piatti = trovati.filter(n => PIATTI_PRONTI.has(n)).slice(0, 4).map(voce).join("");      // già composti
  // sopra tutti gli alimenti (anche quelli già pronti: pizza, frittata, tiramisù…, che si segnano come un alimento), sotto le ricette
  const alimenti = ingr + piatti;
  box.innerHTML = (alimenti && ricetteHTML ? `<div class="autoc-titolo">🥕 Alimenti</div>` : "") + alimenti + ricetteHTML;
}
// -------- Cambiare un ingrediente: tocchi il nome e scrivi il nuovo --------
// Il nome di un ingrediente è un testo (si legge per intero, anche su due righe); toccandolo diventa un campo dove scrivere il nuovo
function nomeComeTesto(inp, it) {
  const d = document.createElement("div");
  d.className = "lib-nome-txt" + classeNome(it.nome); d.setAttribute("role", "button"); d.tabIndex = 0; d.dataset.libNomeEdit = inp.dataset.libNome; d.innerHTML = `<span class="lib-nome-t">${esc(it.nome)}</span>`;
  inp.replaceWith(d);
}
function nomeComeCampo(el, it) {
  const inp = document.createElement("input");
  inp.type = "text"; inp.className = "qta-input lib-alt lib-nome-in"; inp.dataset.libNome = el.dataset.libNomeEdit; inp.value = it.nome;
  inp.autocomplete = "off"; inp.setAttribute("autocorrect", "off"); inp.setAttribute("autocapitalize", "off"); inp.spellcheck = false; inp.enterKeyHint = "done";
  el.replaceWith(inp); inp.focus(); inp.select();
  if (liberoCtx) liberoCtx.sostGiro = 0;
  mostraSostituzioni(inp);   // subito tre sostituti pronti, senza scrivere
}
function mostraSostituzioni(inp) {
  const c = liberoCtx, k = +inp.dataset.libNome, cont = document.querySelector(".lib-righe");
  let box = document.getElementById("lib-sost");
  const q = inp.value.trim();
  if (!c || !cont || !c.items[k]) { if (box) box.remove(); return; }
  if (!q || norm(q) === norm(c.items[k].nome)) {   // campo non toccato: tre sostituti pronti (↻ per altri tre)
    const tutti = alternativeSostituzione(c, c.items[k].nome, c.items[k].qta, k), n = tutti.length;
    if (!n) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "lib-sost"; box.className = "lib-sost-lista"; cont.appendChild(box); }
    const riga0 = inp.closest(".sw") || inp.closest(".lib-riga");
    box.style.top = (riga0.offsetTop + riga0.offsetHeight + 2) + "px";
    const da = ((c.sostGiro || 0) * 3) % n;
    box.innerHTML = Array.from({ length: Math.min(3, n) }, (_, j) => tutti[(da + j) % n]).map(x => `<button class="autoc-voce" data-sost-scegli="${k}" data-nome="${esc(x.nome)}" data-g="${x.g}">${esc(x.nome)} <b>${x.g} g</b></button>`).join("")
      + (n > 3 ? `<button class="autoc-voce sost-altri" data-sost-altri="${k}" aria-label="Altri sostituti">↻</button>` : "");
    return;
  }
  const escl = (n) => typeof alimentoEscluso === "function" && alimentoEscluso(n);
  const trovati = cercaAlimenti(q).filter(n => n !== c.items[k].nome).sort((a, b) => escl(a) - escl(b)).slice(0, 6);
  if (!box) { box = document.createElement("div"); box.id = "lib-sost"; box.className = "lib-sost-lista"; cont.appendChild(box); }
  const riga = inp.closest(".sw") || inp.closest(".lib-riga");
  box.style.top = (riga.offsetTop + riga.offsetHeight + 2) + "px";
  box.innerHTML = trovati.length ? trovati.map(n => `<button class="autoc-voce" data-sost-scegli="${k}" data-nome="${esc(n)}">${esc(n)}${avvisoEsclusoHTML(n)}</button>`).join("") : `<p class="hint">Nessun alimento trovato</p>`;
}
function sostituisciIngrediente(k, nome, grammi) {
  const c = liberoCtx, vecchio = c && c.items[k];
  if (!vecchio || !window.ALIMENTI[nome]) return;
  if (c.items.some((x, i) => i !== k && x.nome === nome && x.grp == vecchio.grp)) { avviso("C'è già " + nome.toLowerCase() + " nel pasto."); return rirenderLibero(); }
  c.items[k] = { nome, cercato: nome, qta: grammi > 0 ? grammi : vecchio.qta, lock: true, grp: vecchio.grp }; // stessa quantità di prima (o quella del consiglio, a parità di calorie)
  rirenderLibero();
}
// «⚖️ Bilancia»: porta il pasto alle kcal che restano senza cambiare le proporzioni (una ricetta resta la ricetta):
function ricalcolaLibero() {
  const c = liberoCtx;
  if (!c.items.length) return;
  const q = calcolaGrammi(c.items, c.target());
  c.items.forEach((it, k) => { it.qta = q[k]; });
}
// "Torna indietro" dentro il pasto: ogni cambio agli ingredienti (aggiungo, tolgo, cambio un grammaggio, applico un consiglio) si ricorda
function istantaneaItems(c) { return JSON.stringify(c.items); }
function registraStoria(c) {
  const att = istantaneaItems(c);
  if (c._ult === undefined) { c._ult = att; c._storia = []; c._avanti = []; return; }
  if (att === c._ult) return;
  const ora = Date.now();
  // più modifiche ravvicinate (es. scrivi "1", "12", "120") contano come un cambio solo
  if (c._storia.length && ora - (c._tUlt || 0) < 700 && c._burst) { c._ult = att; c._tUlt = ora; return; }
  c._storia.push(c._ult); if (c._storia.length > 40) c._storia.shift();
  c._avanti = []; c._ult = att; c._tUlt = ora; c._burst = true;
  clearTimeout(c._tBurst); c._tBurst = setTimeout(() => { c._burst = false; }, 700);
}
function vaiStoria(verso) {   // "indietro" o "avanti" nelle versioni del pasto
  const c = liberoCtx; if (!c || !c._storia) return;
  const da = verso === "indietro" ? c._storia : c._avanti, a = verso === "indietro" ? c._avanti : c._storia;
  if (!da.length) return;
  a.push(c._ult); const s = da.pop();
  c.items = JSON.parse(s); c._ult = s; c._burst = false;
  rirenderLibero();
}
function rirenderLibero() {
  const cb = liberoCtx;
  if (cb) registraStoria(cb);
  if (cb && cb.vivo) cb.bozza = false;   // niente più bozza: anche nel pasto vuoto gli alimenti passano da «Da aggiungere»
  if (cb && cb.vivo && !cb.bozza && typeof cb.commit === "function") cb.commit(cb);   // dopo la conferma ogni modifica è già nel diario
  const sheet = document.querySelector(".modal-sheet");
  const sc = sheet ? sheet.scrollTop : 0;
  const pagina = !!(cb && (cb.ignoto || cb.ignotoNuovo || cb.scansione)), cambiata = !!cb && cb._pagina !== pagina;   // entrando o uscendo dal nuovo alimento si riparte dall'alto
  if (cb) cb._pagina = pagina;
  document.getElementById("modal-content").innerHTML = corpoPasto(liberoHTML());
  const s2 = document.querySelector(".modal-sheet");
  if (s2) s2.scrollTop = cambiata ? 0 : sc;
}
// -------- Consiglio furbo mentre componi il pasto: cosa cambiare, in base a come sta andando la giornata --------
// Oltre agli scambi "più leggeri" delle ricette, qui ci sono anche quelli che spostano i macro: più proteine, meno grassi, meno carboidrati.
const SCAMBI_FURBI = {
  "Yogurt bianco intero": ["Yogurt greco 0%"], "Yogurt greco intero": ["Yogurt greco 0%"], "Yogurt greco 0%": ["Kefir bianco"],
  "Ricotta": ["Fiocchi di latte", "Quark magro"], "Mascarpone": ["Ricotta", "Quark magro"], "Panna fresca": ["Yogurt greco 0%"],
  "Formaggio spalmabile (tipo Philadelphia)": ["Formaggio spalmabile light", "Fiocchi di latte"], "Formaggio spalmabile light": ["Fiocchi di latte", "Quark magro"],
  "Mozzarella": ["Mozzarella light", "Fiocchi di latte"], "Stracchino": ["Fiocchi di latte", "Formaggio spalmabile light"], "Provolone": ["Mozzarella light"], "Gorgonzola": ["Fiocchi di latte"],
  "Latte intero": ["Latte scremato", "Bevanda di soia"], "Latte parzialmente scremato": ["Latte scremato", "Bevanda di soia"],
  "Manzo magro macinato": ["Fesa di tacchino macinata"], "Hamburger di manzo": ["Fesa di tacchino macinata", "Petto di pollo"], "Salsiccia": ["Fesa di tacchino macinata"],
  "Coscia di pollo": ["Petto di pollo"], "Pancetta": ["Prosciutto cotto", "Bresaola"], "Prosciutto crudo": ["Bresaola"], "Prosciutto cotto": ["Fesa di tacchino"],
  "Mortadella": ["Bresaola", "Prosciutto cotto"], "Salumi misti": ["Bresaola"], "Wurstel": ["Fesa di tacchino"],
  "Salmone fresco": ["Merluzzo", "Branzino"], "Salmone": ["Merluzzo", "Branzino"], "Orata": ["Merluzzo"],
  "Pane bianco": ["Pane integrale"], "Pancarrè": ["Pane integrale"], "Pasta": ["Pasta integrale"], "Pasta cotta": ["Pasta integrale"],
  "Couscous cotto": ["Quinoa cotta", "Riso integrale cotto"], "Riso venere cotto": ["Quinoa cotta"], "Noodles di riso cotti": ["Quinoa cotta", "Riso integrale cotto"], "Uova": ["Albume"],
  "Branzino": ["Merluzzo", "Nasello"], "Orata": ["Merluzzo", "Nasello"], "Salsiccia": ["Fesa di tacchino macinata"],
  "Riso bianco cotto": ["Quinoa cotta", "Riso integrale cotto", "Patate lesse"], "Riso basmati cotto": ["Quinoa cotta", "Riso integrale cotto", "Patate lesse"], "Patatine fritte": ["Patate al forno", "Patate lesse"],
  "Patate al forno": ["Patate lesse"], "Gnocchi di patate": ["Patate lesse"], "Cornflakes": ["Fiocchi d'avena"], "Muesli": ["Fiocchi d'avena"],
  "Maionese": ["Salsa yogurt-limone", "Yogurt greco 0%"], "Miele": ["Eritritolo"], "Zucchero": ["Eritritolo"], "Cioccolato al latte": ["Cioccolato fondente"], "Nutella": ["Burro d'arachidi"],
};
// Famiglie di fonti proteiche: se nel pasto ce n'è già una, non ha senso proporne un'altra "uguale" (yogurt greco + skyr, pollo + tacchino…)
const FAMIGLIE_PROT = [
  ["lattiero", ["Skyr", "Yogurt greco 0%", "Yogurt greco intero", "Yogurt bianco intero", "Yogurt di soia", "Fiocchi di latte", "Quark magro", "Ricotta", "Formaggio spalmabile light", "Formaggio spalmabile (tipo Philadelphia)", "Kefir bianco"]],
  ["pollame", ["Petto di pollo", "Coscia di pollo", "Fesa di tacchino", "Fesa di tacchino macinata"]],
  ["pesce", ["Merluzzo", "Nasello", "Branzino", "Orata", "Salmone", "Salmone selvaggio", "Salmone fresco", "Salmone affumicato", "Sgombro", "Trota", "Platessa", "Pesce spada", "Tonno fresco", "Tonno in scatola al naturale", "Tonno sott'olio sgocciolato", "Gamberi", "Calamari", "Polpo", "Seppie", "Cozze", "Vongole", "Sardine", "Alici", "Surimi"]],
  ["uova", ["Uova", "Albume", "Tuorlo", "Uova al tegamino"]],
  ["legumi", ["Ceci cotti", "Lenticchie cotte", "Lenticchie rosse secche", "Fagioli rossi", "Fagioli cannellini cotti", "Fagioli borlotti cotti", "Edamame", "Fave", "Hummus"]],
  ["vegetale", ["Tofu", "Seitan", "Tempeh"]],
  ["carne", ["Manzo magro", "Manzo magro macinato", "Hamburger di manzo", "Vitello magro", "Lonza di maiale", "Salsiccia", "Coniglio", "Agnello (carne magra)"]],
  ["salumi", ["Bresaola", "Prosciutto cotto", "Prosciutto crudo", "Mortadella", "Salumi misti", "Wurstel"]],
  ["polvere", ["Proteine in polvere", "Proteine vegetali in polvere (pisello)"]],
];
const famigliaProt = (n) => (FAMIGLIE_PROT.find(([, v]) => v.includes(n)) || [])[0] || null;
const MACRO_ZERO = { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 };

// Gli ingredienti dei pasti liberi già registrati in questo pasto (nel diario): servono a dare consigli anche su quello che hai già inserito
// schermo unico ("modalità viva"): le righe del pannello SONO il piatto libero del momento, salvato nel diario a ogni modifica.
// Il suo posto nel diario si cerca ogni volta per momento (gli indici cambiano).
function indiciPastoDi(c) { try { const set = new Set(); giornoDiario(c.data).pasti.forEach((p, k) => { if (p.pasto === c.pasto) set.add(k); }); return set; } catch (e) { return new Set(); } }
const escludiDi = (c) => indiciPastoDi(c);   // tutti i piatti del momento: le righe del pannello sono il pasto intero
function ingredientiRegistrati(c) {
  if (c.vivo) return [];   // le righe libere sono già in c.items; le ricette hanno le loro varianti
  const lista = [];
  try {
    giornoDiario(c.data).pasti.forEach((p, pi) => {
      if (p.pasto !== c.pasto || pi === c.escludi || p.ricetta) return;       // le ricette hanno le loro varianti (⇄)
      (p.ingredienti || []).forEach((i, ii) => { const g = grammiIng(i); if (g > 0) lista.push({ nome: i.nome, qta: g, rif: [pi, ii] }); });
    });
  } catch (e) {}
  return lista;
}
// ===== Consigli furbi: sotto il piatto, un riepilogo di mosse che lo avvicinano all'obiettivo del pasto (e quindi della giornata) =====
// Idea: dall'obiettivo del pasto (che dipende da quello che hai già mangiato oggi) si calcola quanto "manca" o "avanza" per ogni macro.
// Ogni mossa possibile (cambia un alimento, porta una quantità a un'altra, aggiungi qualcosa) si valuta in base a quanto riduce la distanza dall'obiettivo.
const POOL_SOSTITUZIONE = [
  ["Riso basmati cotto", "Riso integrale cotto", "Quinoa cotta", "Couscous cotto", "Patate lesse", "Patata dolce", "Pasta cotta", "Riso bianco cotto", "Noodles di riso cotti"],
  ["Petto di pollo", "Fesa di tacchino", "Merluzzo", "Nasello", "Branzino", "Orata", "Gamberi", "Platessa", "Tofu"],
  ["Yogurt greco 0%", "Yogurt greco intero", "Yogurt bianco intero", "Fiocchi di latte", "Quark magro", "Ricotta", "Formaggio spalmabile light"],
  ["Pane integrale", "Pane bianco", "Pane di segale", "Pancarrè", "Gallette di riso", "Gallette di mais", "Gallette di quinoa", "Gallette di grano saraceno", "Fette biscottate integrali", "Crackers integrali"],
  ["Latte intero", "Latte parzialmente scremato", "Latte scremato", "Bevanda di soia", "Bevanda di avena", "Bevanda di mandorla"],
];
const VERDURE_CONSIGLI = ["Zucchine", "Spinaci", "Broccoli", "Insalata", "Pomodoro", "Carote", "Finocchi", "Cetriolo", "Rucola", "Asparagi", "Fagiolini"];
const GRAMMI_MAX_FONTI = { "Proteine in polvere": 30, "Proteine vegetali in polvere (pisello)": 30, "Albume": 200, "Yogurt greco 0%": 250, "Yogurt greco intero": 200, "Fiocchi di latte": 200, "Quark magro": 250, "Ricotta": 150, "Petto di pollo": 220, "Fesa di tacchino": 200, "Merluzzo": 250, "Nasello": 250, "Branzino": 200, "Orata": 200, "Tofu": 200, "Ceci cotti": 200, "Lenticchie cotte": 200, "Uova": 220, "Salmone fresco": 180, "Bresaola": 90, "Skyr": 250, "Yogurt di soia": 250 };
// porzione massima sensata di un alimento: quella scritta sopra, altrimenti dal tipo di alimento (pasta o riso crudi ~130 g, olio 25 g…), mai oltre «resto»
const tettoFonte = (nome, resto) => GRAMMI_MAX_FONTI[nome] || (() => { try { return (window.ALIMENTI || {})[nome] ? Math.min(resto, Math.max(profiloBase(nome).hi, 25)) : resto; } catch (e) { return resto; } })();
const FONTI_PROTEINE = {
  leggero: ["Yogurt greco 0%", "Fiocchi di latte", "Quark magro"],      // colazione e spuntini: latticini magri
  pasto: ["Petto di pollo", "Fesa di tacchino", "Merluzzo", "Nasello", "Albume", "Tofu", "Fiocchi di latte", "Ceci cotti", "Lenticchie cotte"],   // niente tonno in scatola: per il mercurio si mangia con moderazione
};
const MAI_CONSIGLIATI = /(?!)/;   // nessun alimento è escluso dai consigli (tonno e skyr li mangi: il tonno in scatola si limita a 160 g a settimana, vedi tonnoOk)
const furbiScartati = new Set();   // suggerimenti tolti con lo swipe (cestino): spariscono finché non riapri il foglio                                    // il tonno si mangia con moderazione (mercurio): mai proposto
// Distanza dall'obiettivo del pasto (più bassa = meglio): le proteine mancanti pesano molto, grassi e calorie in eccesso anche
function distanzaPasto(g) {
  const p = (v, sotto, sopra) => v > 0 ? v * sotto : -v * sopra;
  return p(g.proteine, 3, 0.05) + p(g.grassi, 0.35, 3) + p(g.carboidrati, 0.6, 1.4) + p(g.kcal, 0.03, 0.12);
}
// Gli alimenti che mangi davvero (ultime 3 settimane): a parità di valore passano avanti nei consigli
function alimentiFrequenti(giorni = 21) {
  const out = new Map();
  try {
    const lim = Date.now() - giorni * 864e5;
    Object.entries(leggiDiario()).forEach(([d, g]) => { if (new Date(d).getTime() < lim) return; (g.pasti || []).forEach(p => (p.ingredienti || []).forEach(i => out.set(i.nome, (out.get(i.nome) || 0) + 1))); });
  } catch (e) {}
  return out;
}
// Cosa lascia sazi con poche calorie: fibre in più; le calorie da bere la sera no
function bonusSazieta(c, X, A, n, g) {
  const fibre = ((X[n] || [])[2] || 0) * g / 100, kcal = (A[n] || [0])[0] * g / 100;
  return Math.min(4, fibre * 1.2) - (c.pasto === "cena" && UNITA_LIQUIDI.test(n) && kcal > 40 ? 4 : 0);
}
// Il risultato della mossa: pasto a posto, oppure cosa resta ancora (una cosa sola, in breve)
function esitoMossa(gap, d) {
  const r = (v) => Math.round(v), x = { kcal: gap.kcal - d.kcal, proteine: gap.proteine - d.proteine, carboidrati: gap.carboidrati - d.carboidrati, grassi: gap.grassi - d.grassi };
  if (x.proteine > 6) return `−${r(x.proteine)} g proteine`;
  if (x.carboidrati > 12) return `−${r(x.carboidrati)} g carboidrati`;
  if (x.grassi > 6) return `−${r(x.grassi)} g grassi`;
  if (x.kcal < -60) return `+${r(-x.kcal)} kcal`;
  return "✓";
}
// Regole del coach: prima dell'allenamento niente grassi; dopo, proteine e carboidrati. Soglie facili da cambiare.
const PRE_GRASSI_PASTO = 5;                // g di grassi in tutto il pasto (ricetta a ingredienti chiusi) oltre i quali compare ⚠ vicino al risultato
const PRE_GRASSI_MAX = 3;                  // g di grassi in un alimento del pre-workout oltre i quali compare ⚠
const POST_PROT_KG = 0.4, POST_CARBO_KG = 0.5;   // minimi del post-workout, in g per kg di peso
// pre = pasto prima dell'allenamento (spuntino del pomeriggio, o di metà mattina se ti alleni al mattino); post = pasto dopo
function contestoAllenamento(c) {
  const pre = typeof preWorkout === "function" && preWorkout(c.data, c.pasto);
  const post = typeof postWorkout === "function" && postWorkout(c.data, c.pasto);
  return { pre: !!pre, post: !!post };
}
const grassiAlimento = (nome, qta) => { const a = (window.ALIMENTI || {})[nome]; return a ? a[3] * (+qta || 0) / 100 : 0; };
const troppiGrassiPre = (nome, qta) => grassiAlimento(nome, qta) >= PRE_GRASSI_MAX;
// Sostituti pronti per un alimento (per chi non sa con cosa cambiarlo): dello stesso tipo, adatti al momento (pre-workout: niente grassi; post: tengono le proteine), con la quantità a parità di calorie.
// Ordinati dal più simile; ritorna tutti i candidati, chi li mostra ne prende tre per volta.
function alternativeSostituzione(c, nome, qta, k) {
  const A = window.ALIMENTI || {}, a0 = A[nome]; if (!a0) return [];
  const { pre, post } = contestoAllenamento(c);
  const dentro = new Set(c.items.filter(x => x.grp == (c.items[k] || {}).grp).map(x => x.nome));   // conta solo lo stesso piatto (la ricetta o le righe singole)
  const pool = POOL_SOSTITUZIONE.find(p => p.includes(nome)) || [];
  const fam = famigliaProt(nome) ? (FAMIGLIE_PROT.find(([f]) => f === famigliaProt(nome)) || [])[1] || [] : [];
  let cand = [...(typeof SCAMBI_LEGGERI !== "undefined" ? SCAMBI_LEGGERI[nome] || [] : []), ...(SCAMBI_FURBI[nome] || []), ...(FIT_SCAMBI[nome] || []), ...pool, ...fam];
  if (pre) cand = cand.concat(["Banana", "Gallette di riso", "Pane bianco", "Fette biscottate integrali", "Marmellata"]);
  const specifici = new Set(cand);
  cand = cand.concat(POOL_SOSTITUZIONE.flat(), VERDURE_CONSIGLI);   // poi i più comuni, scelti per somiglianza di macro
  const kcal = a0[0] * qta / 100;
  const dist = (n) => (Math.abs(A[n][1] - a0[1]) * 3 + Math.abs(A[n][2] - a0[2]) + Math.abs(A[n][3] - a0[3]) * 2) * (specifici.has(n) ? 0.5 : 1);   // somiglianza dei macro per 100 g; gli scambi noti passano avanti
  return cand.filter((n, i) => cand.indexOf(n) === i && n !== nome && A[n] && !dentro.has(n) && !MAI_CONSIGLIATI.test(n) && !/^Tuorlo/.test(n) && !scambioRompeRicetta(c, k, n))
    .map(n => ({ nome: n, g: Math.max(20, Math.min(300, Math.round(kcal / Math.max(A[n][0], 1) * 100 / 5) * 5)), d: dist(n) }))
    .filter(x => !(pre && grassiAlimento(x.nome, x.g) >= PRE_GRASSI_MAX))
    .filter(x => !(post && famigliaProt(nome) && A[x.nome][1] * x.g / 100 < a0[1] * qta / 100 * 0.6))
    .sort((a, b) => a.d - b.d);
}
// (nel pre-workout il ⚠ sui grassi usa lo stesso elenco)
const alternativePre = (c, nome, qta, k) => alternativeSostituzione(c, nome, qta, k).slice(0, 3);
// Post-workout: servono proteine e carboidrati. Ritorna cosa manca ("−12 g proteine") o "" se è a posto.
function avvisoPost(c, m) {
  if (!m) return "";   // (pasto con solo piatti ancora da aggiungere)
  const A = window.ALIMENTI || {}, peso = (typeof leggiProfilo === "function" && leggiProfilo().peso) || 60;
  let P = m.proteine, C = m.carboidrati;
  ingredientiRegistrati(c).forEach(r => { const a = A[r.nome]; if (a) { P += a[1] * r.qta / 100; C += a[2] * r.qta / 100; } });   // anche quello già scritto in questo pasto
  const minP = Math.round(POST_PROT_KG * peso), minC = Math.round(POST_CARBO_KG * peso);
  if (P < minP) return `−${Math.round(minP - P)} g proteine`;
  if (C < minC) return `−${Math.round(minC - C)} g carboidrati`;
  return "";
}
function elencoConsigli(c, m) {
  if (!c.data || typeof mancaData !== "function" || typeof targetData !== "function") return null;
  m = m || MACRO_ZERO;
  const reg = ingredientiRegistrati(c);
  const composti = c.items.map((it, k) => ({ nome: it.nome, qta: it.qta, rif: k, reg: false }));
  const registrati = reg.map(r => Object.assign({ reg: true }, r));
  const righe = [...composti, ...registrati];
  if (!righe.length) return null;
  let mt = null; try { mt = typeof c.target === "function" ? c.target() : null; } catch (e) {}
  if (!mt) return null;
  const A = window.ALIMENTI || {}, X = window.NUTRIENTI_EXTRA || {}, T = targetData(c.data);
  const gapPasto = { kcal: mt.kcal - m.kcal, proteine: mt.proteine - m.proteine, carboidrati: mt.carboidrati - m.carboidrati, grassi: mt.grassi - m.grassi };
  const rem0 = mancaData(c.data, escludiDi(c));
  const giorno = { kcal: rem0.kcal - m.kcal, proteine: rem0.proteine - m.proteine, carboidrati: rem0.carboidrati - m.carboidrati, grassi: rem0.grassi - m.grassi };
  // lo scarto che conta: il più stretto tra quello del pasto e quello della giornata (se la giornata è già oltre, anche un pasto "in regola" va alleggerito)
  const gap = { kcal: Math.min(gapPasto.kcal, giorno.kcal), proteine: Math.min(gapPasto.proteine, giorno.proteine), carboidrati: Math.min(gapPasto.carboidrati, giorno.carboidrati), grassi: Math.min(gapPasto.grassi, giorno.grassi) };
  const dentro = new Set(righe.map(r => r.nome)), famDentro = new Set([...dentro].map(famigliaProt).filter(Boolean));
  const base = distanzaPasto(gap);
  const freq = alimentiFrequenti(), bonusFreq = (n) => freq.get(n) >= 2 ? 2 : 0;
  // carboidrati, grassi e calorie non si sforano mai: né la quota del pasto (oltre 3 g) né il totale della giornata (oltre 1 g; 15 kcal per le calorie). Le proteine in più non sono un problema
  const sforaCarbo = (d) => (d.carboidrati > 1 && (gap.carboidrati - d.carboidrati < -3 || giorno.carboidrati - d.carboidrati < -1))
    || (d.grassi > 1 && (gap.grassi - d.grassi < -3 || giorno.grassi - d.grassi < -1))
    || (d.kcal > 15 && giorno.kcal - d.kcal < -15);
  const principale = c.pasto === "pranzo" || c.pasto === "cena";
  // pre-workout (lo spuntino del pomeriggio, o quello di metà mattina se ti alleni al mattino): pochi grassi e fibre, si digerisce meglio
  const { pre, post } = contestoAllenamento(c);          // dopo l'allenamento: proteine e carboidrati prima di tutto, i grassi non si spingono
  // i pasti principali hanno quattro componenti: una fonte di proteine, di carboidrati, di grassi e di fibre (verdure e/o legumi)
  const g100 = (r, i) => (A[r.nome] ? A[r.nome][i] : 0) * r.qta / 100;
  const manca = {
    prot: !righe.some(r => A[r.nome] && A[r.nome][1] >= 8 && g100(r, 1) >= 10),
    carbo: !righe.some(r => A[r.nome] && A[r.nome][2] >= 12 && (g100(r, 2) >= 15 || A[r.nome][2] * 4 / Math.max(1, A[r.nome][0]) >= 0.5)),   // anche poche patate o una fetta di pane sono già la base: si aumentano quelle, non se ne aggiunge un'altra
    grassi: !righe.some(r => A[r.nome] && g100(r, 3) >= 5),
    fibre: !righe.some(r => VERDURE_CONSIGLI.includes(r.nome) || /verdur|insalata/i.test(r.nome) || ((X[r.nome] || [])[2] || 0) * r.qta / 100 >= 6),   // fibre vere (legumi, tanta verdura): le patate o un po' di pane integrale non bastano
  };
  const mac = macroAlimento;   // stesse kcal che finiscono nel diario
  const meno = (a, b) => ({ kcal: a.kcal - b.kcal, proteine: a.proteine - b.proteine, carboidrati: a.carboidrati - b.carboidrati, grassi: a.grassi - b.grassi });
  const valore = (d) => base - distanzaPasto(meno(gap, d));                      // quanto la mossa avvicina all'obiettivo
  const azioni = [];
  const attrRiga = (r) => r.reg ? { diario: `${r.rif[0]}|${r.rif[1]}` } : { k: r.rif };
  const rp = ricettaPorzioniIntatta(c), rt = ricettaATeglia(c);   // ricetta a teglia intatta: niente scambi né ritocchi agli ingredienti, solo quante porzioni; le singole hanno anche il contatore
  // 1) CAMBIA un alimento con un altro
  righe.forEach(r => {
    if (rt) return;
    const a0 = A[r.nome]; if (!a0 || !(r.qta > 0)) return;
    const pool = POOL_SOSTITUZIONE.find(p => p.includes(r.nome)) || [];
    const cand = [...(SCAMBI_FURBI[r.nome] || []), ...(typeof SCAMBI_LEGGERI !== "undefined" ? SCAMBI_LEGGERI[r.nome] || [] : []), ...pool];
    cand.filter((n, i) => cand.indexOf(n) === i && n !== r.nome && A[n] && !dentro.has(n) && !MAI_CONSIGLIATI.test(n)).forEach(n => {
      if (scambioRompeRicetta(c, r.rif, n)) return;                                   // su una ricetta non si cambia il principale
      const d = meno(mac(n, r.qta), mac(r.nome, r.qta));
      if (Math.abs(d.proteine) < 3 && Math.abs(d.grassi) < 3 && Math.abs(d.carboidrati) < 6 && Math.abs(d.kcal) < 30) return;      // differenza troppo piccola
      if (d.kcal > 60) return;
      if (pre && d.grassi > 3) return;
      if (sforaCarbo(d)) return;
      if (d.proteine < -4 && gap.proteine - d.proteine > 6) return;                  // uno scambio non deve far mancare le proteine
      if (famigliaProt(r.nome) && d.proteine < -4 && gap.kcal > -150) return;       // …e non le toglie se non sei molto oltre con le calorie
      const dF = (((X[n] || [])[2] || 0) - ((X[r.nome] || [])[2] || 0)) * r.qta / 100;
      if (d.kcal > 25 && dF < 2.5 && d.proteine < 8) return;                          // più calorie senza più fibre né proteine vere (es. riso → pasta): non è una mossa furba
      const v = valore(d) + Math.max(0, dF) * 1.2 + bonusFreq(n) + bonusSazieta(c, X, A, n, r.qta) * 0.5;
      if (v >= 5) azioni.push({ tipo: "cambia", r, a: n, d, dF, v });
    });
  });
  // 1b) A FINE GIORNATA, con le calorie quasi finite e carboidrati che mancano: SCAMBIA un alimento con uno che ha le stesse calorie ma carboidrati (meno hummus, più pane): non si aggiunge niente
  if (!rt && giorno.kcal < 90 && giorno.carboidrati > 12 && !pre) {
    const carbi = ["Pane integrale", "Riso basmati cotto", "Patate lesse", "Patata dolce", "Banana", "Fiocchi d'avena", "Gallette di riso"];
    righe.forEach(r => {
      const a0 = A[r.nome]; if (!a0 || a0[2] >= 15 || a0[0] < 60 || a0[0] * r.qta / 100 < 40 || MAI_CONSIGLIATI.test(r.nome)) return;   // un alimento che pesa almeno 40 kcal (anche 12 g di olio)
      if (famigliaProt(r.nome) && giorno.proteine > -3) return;                         // le proteine che mancano non si tolgono
      carbi.filter(n => A[n] && !dentro.has(n) && !scambioRompeRicetta(c, r.rif, n)).forEach(n => {
        const g = Math.round(r.qta * a0[0] / A[n][0] / 5) * 5;                         // stesse calorie
        if (g < 10 || g > (GRAMMI_MAX_FONTI[n] || 300)) return;
        const d = meno(mac(n, g), mac(r.nome, r.qta));
        if (d.carboidrati < 8 || Math.abs(d.kcal) > 35 || sforaCarbo(d)) return;
        if (d.proteine < -4 && giorno.proteine - d.proteine > 4) return;
        const v = valore(d) + 3;
        if (v >= 4) azioni.push({ tipo: "cambia", r, a: n, g, d, dF: 0, v });
      });
    });
  }
  // 2) PORTA una quantità a un'altra (di più o di meno)
  righe.forEach(r => {
    if (rt) return;
    const a0 = A[r.nome]; if (!a0 || !(r.qta > 0) || MAI_CONSIGLIATI.test(r.nome) || r.qta < 15) return;
    if (a0[0] < 40) return;                                                         // verdure e simili: non serve ritoccarle
    let migliore = null;
    [0.5, 0.7, 1.3, 1.5, 2].forEach(f => {
      let nuova = qtaPezziInteri(r.nome, "pz", Math.round(r.qta * f / 5) * 5);   // pizza, piadina…: pezzi interi
      if (f > 1) nuova = Math.min(nuova, r.qta + 100, tettoFonte(r.nome, 300));
      if (nuova < 5 || Math.abs(nuova - r.qta) < Math.max(10, r.qta * 0.2)) return;
      const d = mac(r.nome, nuova - r.qta);
      if (famigliaProt(r.nome) && d.proteine < -4 && gap.kcal > -150) return;       // le fonti di proteine non si riducono se non sei molto oltre con le calorie
      const nuovo = meno(gap, d);
      if (sforaCarbo(d)) return;
      if (d.kcal > 0 && ((gap.grassi >= -3 && nuovo.grassi < -3) || (gap.carboidrati >= -8 && nuovo.carboidrati < -10) || (gap.kcal >= -40 && nuovo.kcal < -40))) return;
      const v = valore(d) - 1;                                                       // un piccolo "costo" perché cambiare quantità è meno furbo che cambiare alimento
      if (v >= 6 && (!migliore || v > migliore.v) && !(nuova > r.qta && TONNO_SCATOLA.test(r.nome) && !tonnoOk(c.data))) migliore = { tipo: "porta", r, nuova, d, v };
    });
    // completa: la fonte di carboidrati sale alla quantità che colma il buco (o che usa le calorie rimaste), anche di pochi grammi (patate 150 → 170 g)
    if (a0[2] * 4 / a0[0] >= 0.55 && gap.carboidrati >= 8 && gap.kcal >= 15) {
      const extra = Math.min(gap.carboidrati / (a0[2] / 100), gap.kcal / (a0[0] / 100));
      const nuova = Math.min(Math.floor((r.qta + extra) / 5) * 5, r.qta + 100, tettoFonte(r.nome, 400));
      if (nuova - r.qta >= 10) {
        const d = mac(r.nome, nuova - r.qta), nuovo = meno(gap, d);
        if (!sforaCarbo(d) && nuovo.kcal >= -5 && (d.grassi <= 1 || nuovo.grassi >= -3)) {
          const v = valore(d) - 0.5;
          if (v >= 1.5 && (!migliore || v >= migliore.v - 1) && !(nuova > r.qta && TONNO_SCATOLA.test(r.nome) && !tonnoOk(c.data))) migliore = { tipo: "porta", r, nuova, d, v };
        }
      }
    }
    if (migliore) azioni.push(migliore);
  });
  // 2b) QUANTE PORZIONI: una o due in meno o in più, con il risultato sui macro del pasto
  if (rp) {
    const passo = passoPezzi(rp._orig), cur = macroDa(c.items);
    let menoPz = null, piuPz = null;
    [-2, -1, 1, 2].forEach(st => {
      const k2 = c.nPezzi + st * passo; if (k2 < passo) return;
      const singola = !aPezzi(rp._orig);
      const d = meno(singola ? macroDa(scalaSingola(c, rp, k2)) : versioneAPezzi(rp._orig, k2), cur);
      if (d.proteine < -4 && gap.proteine - d.proteine > 6) return;                  // non farne mancare le proteine
      if (st > 0 && sforaCarbo(d)) return;
      const val = valore(d) - 1;
      if (val < 6) return;
      const mossa = { tipo: "pezzi", k: k2, d, v: val };
      if (st < 0 && (!menoPz || val > menoPz.v)) menoPz = mossa;
      if (st > 0 && (!piuPz || val > piuPz.v)) piuPz = mossa;
    });
    [menoPz, piuPz].filter(Boolean).forEach(a => azioni.push(a));
  }
  // 3) AGGIUNGI qualcosa
  const prot = principale ? FONTI_PROTEINE.pasto : FONTI_PROTEINE.leggero;
  const aggiungi = (nomi, grammi, gruppo, ruolo, minV = 6) => nomi.filter(n => A[n] && !dentro.has(n) && !MAI_CONSIGLIATI.test(n) && !famDentro.has(famigliaProt(n))).forEach(n => {
    let migliore = null;
    grammi.filter(g => g <= tettoFonte(n, 300)).forEach(g => {   // mai oltre una porzione sensata (frutta secca 40 g, olio 25 g)
      const d = mac(n, g);
      if (pre && (d.grassi > 3 || (X[n] || [])[2] * g / 100 > 4)) return;           // pre-workout: niente grassi né fibre in più
      if (d.kcal > Math.max(120, gap.kcal + 40)) return;                             // starebbe fuori dal pasto
      if (sforaCarbo(d)) return;                                                     // mai oltre i carboidrati del pasto e della giornata
      if (ruolo === "prot" && d.proteine > Math.max(gap.proteine, 0) * 1.15 + 1) return;   // le proteine da aggiungere colmano quello che manca, non il doppio
      const nuovo = meno(gap, d);                                                    // non si creano nuovi eccessi: ciò che era in regola resta in regola
      if ((gap.grassi >= -3 && nuovo.grassi < -3) || (gap.carboidrati >= -8 && nuovo.carboidrati < -10) || (gap.kcal >= -40 && nuovo.kcal < -40) || (gap.proteine >= -2 && nuovo.proteine < -10)) return;
      const v = valore(d) + bonusFreq(n) + bonusSazieta(c, X, A, n, g);
      const pref = gruppo || !prot.includes(n) ? 0 : 4 * (prot.length - prot.indexOf(n)) / prot.length;   // a parità, le scelte più comuni prima (pollo prima del tofu)
      if (v >= minV && (!migliore || v + pref > migliore.v)) migliore = { tipo: "aggiungi", n, g, d, v: v + pref, gruppo, ruolo: ruolo || gruppo };
    });
    if (migliore) azioni.push(migliore);
  });
  const proteinePasto = m.proteine + (() => { let t = 0; try { giornoDiario(c.data).pasti.forEach((p, k) => { if (p.pasto === c.pasto && !esclusoIdx(escludiDi(c), k)) t += +p.proteine || 0; }); } catch (e) {} return t; })();
  // gli stessi esempi della nota in fondo a Oggi ("Albume 90 g o Skyr 90 g") compaiono anche nel pasto, così le due indicazioni non si contraddicono
  const protTutte = [...prot, ...JOLLY.proteine.filter(n => !prot.includes(n) && n !== "Petto di pollo" && n !== "Merluzzo").slice(0, 2)];
  // se nel piatto c'è già una fonte di proteine (pollo, yogurt, uova…) non se ne aggiunge un'altra (carne + pesce non si mischiano): si può solo portarla a una quantità diversa o cambiarla
  if (gap.proteine > 5 && !famDentro.size) aggiungi(protTutte, [30, 40, 50, 60, 70, 90, 100, 120, 150, 180, 200], undefined, "prot");
  else if (principale && manca.prot && gap.proteine > 4) aggiungi(protTutte, [50, 70, 90, 100, 120, 150], undefined, "prot", 1);   // nel piatto serve comunque una fonte di proteine
  if (gap.proteine > 10 && !famDentro.size && proteinePasto < 12) aggiungi(["Proteine in polvere", "Proteine vegetali in polvere (pisello)"], [20, 25, 30], undefined, "prot");
  const aggiungiCarbo = !principale || manca.carbo;   // nei pasti principali non si aggiunge una seconda base di carboidrati (pasta + pane, riso + patate): si porta quella che c'è a un'altra quantità
  if (aggiungiCarbo && principale && manca.carbo && gap.carboidrati > 8 && gap.kcal > 80 && gap.carboidrati <= 15) aggiungi(["Riso integrale cotto", "Patate lesse", "Quinoa cotta", "Pane integrale"], [30, 40, 50, 60, 80, 100], "carbo", "carbo", 1);
  if (aggiungiCarbo && gap.carboidrati > 15 && gap.kcal > 80) aggiungi(principale ? ["Riso integrale cotto", "Patate lesse", "Quinoa cotta", "Pane integrale"] : ["Banana", "Mela", "Fiocchi d'avena", "Pane integrale", "Gallette di riso"], [30, 40, 50, 60, 80, 100, 120, 150, 180, 200], "carbo");   // una sola proposta di carboidrati, non quattro alternative
  if (principale && !post && manca.grassi && gap.grassi > 2 && gap.grassi <= 5 && gap.kcal > 50) aggiungi(["Olio EVO", "Avocado", "Mandorle", "Noci"], [5, 10, 15, 20, 30], "grassi", "grassi", 1);   // un filo d'olio o un po' di frutta secca: grassi vegetali
  const grassiOk = !post || (gap.proteine <= 5 && gap.carboidrati <= 8);   // dopo l'allenamento i grassi si propongono solo se proteine e carboidrati sono già a posto
  if (grassiOk && gap.grassi > 4 && gap.kcal > 40) aggiungi(["Olio EVO", "Mandorle", "Avocado", "Noci", "Burro di arachidi"], [5, 10, 15, 20, 25, 30, 40, 60], "grassi", undefined, 3);   // i grassi sono quelli che di solito restano indietro: si propongono anche per pochi grammi
  // contorno di verdura nei pasti principali: sazia con pochissime calorie
  if (principale && manca.fibre) {
    // la verdura sazia con pochissime calorie: non si blocca quando calorie e carboidrati sono stretti (è lì che serve di più), si sceglie solo la più leggera
    const stretto = gap.kcal < 40 || gap.carboidrati < 5 || giorno.kcal < 60;
    let libere = VERDURE_CONSIGLI.filter(v => A[v] && !dentro.has(v));
    if (stretto) libere = libere.sort((a, b) => A[a][2] - A[b][2]).slice(0, 5);                      // le cinque con meno carboidrati
    const n = libere.length ? libere[hashStr(c.data + c.pasto) % libere.length] : null;   // cambia da un giorno all'altro, non sempre le stesse zucchine
    const gv = n && mac(n, 150).kcal > 45 ? 100 : 150;
    if (n) azioni.push({ tipo: "verdura", n, g: gv, d: mac(n, gv), v: 0, ruolo: "fibre" });            // nei pasti principali la verdura c'è sempre tra le mosse
  }
  // un pasto già passato (oggi o nei giorni scorsi) e già registrato: nessun consiglio di cambio
  const passato = typeof pastoPassato === "function" && pastoPassato(c.data, c.pasto);
  if (passato && righe.some(r => r.reg)) azioni.length = 0;   // un pasto già mangiato non si ritocca né ci si aggiunge altro; un momento ancora vuoto sì (se scrivi qualcosa che avevi dimenticato)
  // più mosse sullo stesso alimento non servono: si tiene la migliore. Poi le migliori tre, diverse tra loro
  // «Cambia X con Y» nei consigli furbi si applica come AGGIUNTA (X lo togli tu): va valutata come somma, non come scambio. Se aggiungendo si sfora, non si propone
  for (let i = azioni.length - 1; i >= 0; i--) { const a = azioni[i]; if (a.tipo !== "cambia") continue; const gn = a.g || Math.max(5, Math.round(a.r.qta / 5) * 5); a.d = mac(a.a, gn); if (sforaCarbo(a.d)) azioni.splice(i, 1); }
  azioni.sort((a, b) => b.v - a.v);
  const usati = new Set(), scelte = [];
  const iv = azioni.findIndex(a => a.tipo === "verdura");
  const verdura = iv >= 0 ? azioni.splice(iv, 1)[0] : null;   // riservata: si mostra sempre, in fondo alle altre
  azioni.forEach(a => {
    const chiave = a.tipo === "pezzi" ? "pezzi:" + a.k : a.r ? "riga:" + (a.r.reg ? a.r.rif.join("|") : "k" + a.r.rif) : "agg:" + (a.gruppo || a.ruolo || famigliaProt(a.n) || a.n);   // una sola proposta per ruolo (una fonte di proteine, non tre)
    const chiave2 = a.tipo === "cambia" ? "nuovo:" + a.a : null;
    if (usati.has(chiave) || (chiave2 && usati.has(chiave2)) || scelte.length >= 6) return;
    usati.add(chiave); if (chiave2) usati.add(chiave2); scelte.push(a);
  });
  // nei pasti principali ogni componente che manca nel piatto ha un posto riservato tra le mosse
  const ETICHETTA_RUOLO = { prot: "una fonte di proteine", carbo: "una fonte di carboidrati", grassi: "una fonte di grassi buoni" };
  if (principale) (post ? ["prot", "carbo"] : ["prot", "carbo", "grassi"]).filter(k => manca[k] && !scelte.some(a => a.ruolo === k)).forEach(k => {
    const a = azioni.find(x => x.ruolo === k && !scelte.includes(x)); if (!a) return;
    if (scelte.length >= (verdura ? 5 : 6)) { const i = scelte.map((x, j) => x.ruolo && manca[x.ruolo] ? -1 : j).filter(j => j >= 0).pop(); if (i === undefined) return; scelte.splice(i, 1); }
    scelte.push(a);
  });
  scelte.forEach(a => { if (principale && a.ruolo && manca[a.ruolo] && ETICHETTA_RUOLO[a.ruolo]) a.mancante = ETICHETTA_RUOLO[a.ruolo]; });
  if (verdura) { verdura.mancante = "una fonte di fibre (verdura o legumi)"; if (scelte.length >= 6) scelte.pop(); scelte.push(verdura); }
  return { gap, gapPasto, giorno, scelte, T, base, righe };
}
function numeriMossa(d) {
  const s = (x, u) => `${x > 0 ? "+" : "−"}${Math.round(Math.abs(x))} ${u}`;
  const p = [];
  if (Math.abs(d.proteine) >= 2) p.push(s(d.proteine, "g proteine"));
  if (Math.abs(d.grassi) >= 2) p.push(s(d.grassi, "g grassi"));
  if (Math.abs(d.carboidrati) >= 4) p.push(s(d.carboidrati, "g carboidrati"));
  p.push(s(d.kcal || 0.01, "kcal"));
  return p.join(" · ");
}
// La scheda "🌙 Consigli furbi": riepilogo + fino a tre mosse, ognuna applicabile con un tocco
// alimenti aggiunti da te o letti dal codice a barre: i valori sono quelli dell'etichetta
// la parola più lunga del nome decide la grandezza del carattere nel riquadro (così "Parmigiano" sta dentro)
function classeNome(n) { const w = Math.max(0, ...String(n || "").split(/\s+/).map(x => x.length)); return w >= 14 ? " parola-lunga3" : w >= 10 ? " parola-lunga2" : w >= 8 ? " parola-lunga" : ""; }
// i valori (per 100 g) di un alimento tuo, per riaprirli e correggerli
function valoriAlimento(nome) { try { const v = (JSON.parse(localStorage.getItem("mp_alimenti_custom")) || {})[nome]; return v ? (v.length >= 8 ? [v[0], v[1], v[2], v[3], v[4], v[6], v[7]] : v.slice(0, 4)) : null; } catch (e) { return null; } }
function eAlimentoTuo(nome) { try { return !!(JSON.parse(localStorage.getItem("mp_alimenti_custom")) || {})[nome]; } catch (e) { return false; } }
// ===== "Più fit": per ogni piatto (ricette comprese) le mosse che lo rendono più leggero e più sano, anche quando i numeri del pasto sono già in regola =====
// Sono scambi a parità di uso (latte intero → scremato, pane bianco → integrale…) o quantità più basse di grassi e zuccheri.
const FIT_SCAMBI = {
  "Pasta": ["Pasta integrale"], "Pasta cotta": ["Pasta integrale"], "Farina 00": ["Farina integrale"], "Pancarrè": ["Pane integrale"], "Pane bianco": ["Pane integrale"],
  "Riso bianco cotto": ["Riso integrale cotto"], "Prosciutto cotto": ["Fesa di tacchino"], "Cioccolato al latte": ["Cioccolato fondente"], "Latte di cocco": ["Latte di cocco light"],
  "Granola": ["Fiocchi d'avena"], "Sciroppo d'acero": ["Sciroppo senza zucchero", "Eritritolo"], "Uova": ["Albume"], "Olio di semi": ["Olio EVO"], "Burro": ["Olio EVO"], "Panna da cucina": ["Yogurt greco 0%"], "Formaggio spalmabile (tipo Philadelphia)": ["Formaggio spalmabile light"],
};
const SEMPRE_MEGLIO = new Set(["Pasta>Pasta integrale", "Pasta cotta>Pasta integrale", "Farina 00>Farina integrale", "Pancarrè>Pane integrale", "Pane bianco>Pane integrale", "Riso bianco cotto>Riso integrale cotto", "Olio di semi>Olio EVO", "Cioccolato al latte>Cioccolato fondente"]);   // stesse calorie, più sani
const DOLCIFICANTI = /^(Miele|Zucchero|Zucchero di canna|Sciroppo d'acero|Marmellata|Sciroppo)/;
function mosseFit(c) {
  const A = window.ALIMENTI || {}, X = window.NUTRIENTI_EXTRA || {}, out = [];
  const items = (c.items || []).map((it, k) => ({ nome: it.nome, qta: it.qta, k })).filter(r => A[r.nome] && r.qta > 0 && !MAI_CONSIGLIATI.test(r.nome));
  const dentro = new Set(items.map(r => r.nome));
  const mac = macroAlimento;   // stesse kcal che finiscono nel diario
  const meno = (a, b) => ({ kcal: a.kcal - b.kcal, proteine: a.proteine - b.proteine, carboidrati: a.carboidrati - b.carboidrati, grassi: a.grassi - b.grassi });
  items.forEach(r => {
    const cur = mac(r.nome, r.qta);
    let migliore = null;
    // 1) scambi leggeri o più sani
    const cand = [...(typeof SCAMBI_LEGGERI !== "undefined" ? SCAMBI_LEGGERI[r.nome] || [] : []), ...(FIT_SCAMBI[r.nome] || [])];
    cand.filter((n, i) => cand.indexOf(n) === i && A[n] && !dentro.has(n) && !MAI_CONSIGLIATI.test(n) && !scambioRompeRicetta(c, r.k, n)).forEach(n => {
      const d = meno(mac(n, r.qta), cur), dF = (((X[n] || [])[2] || 0) - ((X[r.nome] || [])[2] || 0)) * r.qta / 100;
      const sano = SEMPRE_MEGLIO.has(r.nome + ">" + n) && d.kcal <= 15;
      const leggero = d.kcal <= -20 && d.kcal <= -0.08 * cur.kcal && d.proteine >= -Math.max(3, cur.proteine * 0.25);
      if (!sano && !leggero) return;
      const v = -d.kcal + (sano ? 15 : 0) + Math.max(0, dF) * 3 - Math.max(0, -d.proteine) * 4;
      if (!migliore || v > migliore.v) migliore = { tipo: "cambia", r, a: n, d, v };
    });
    // 2) meno grassi e zuccheri aggiunti: la quantità scende di un terzo o della metà
    if (!migliore && r.qta >= 10 && (A[r.nome][3] >= 30 || DOLCIFICANTI.test(r.nome)) && !/^Proteine/.test(r.nome)) {
      const nuova = qtaPezziInteri(r.nome, "pz", Math.max(5, Math.round(r.qta * 0.6 / 5) * 5)), d = meno(mac(r.nome, nuova), cur);
      if (nuova < r.qta && d.kcal <= -20) migliore = { tipo: "porta", r, nuova, d, v: -d.kcal };
    }
    if (migliore) out.push(migliore);
  });
  return out.sort((a, b) => b.v - a.v).slice(0, 4);
}
// «Consigli furbi» di un pasto: cosa cambiare per stare nelle kcal e nei macro (fitMosse: eventuali consigli «più fit» da mettere in testa)
function consiglioFurboHTML(c, m, fitMosse = []) {
  if (c && c.vivo && typeof pastoPassato === "function" && pastoPassato(c.data, c.pasto)) return "";   // sui pasti passati niente consigli: solo su quelli ancora da venire
  const e = elencoConsigli(c, m);
  const giaFit = new Set(fitMosse.map(a => a.tipo === "cambia" ? `cambia|${a.r.nome}|${a.a}` : `porta|${a.r.nome}|${a.nuova}`));
  const righeFit = fitMosse.map(a => {
    const attr = a.tipo === "cambia" ? `data-sost-scegli="${a.r.k}" data-nome="${esc(a.a)}" data-fit="${esc(`cambia|${a.r.nome}|${a.a}`)}"` : `data-lib-setq="${a.r.k}|${a.nuova}" data-fit="${esc(`porta|${a.r.nome}|${a.nuova}|${Math.round(a.r.qta)}`)}"`;
    const testa = a.tipo === "cambia" ? `Cambia <b>${esc(a.r.nome.toLowerCase())}</b> (${Math.round(a.r.qta)} g) con <b>${esc(a.a.toLowerCase())}</b>` : `Porta <b>${esc(a.r.nome.toLowerCase())}</b> da ${Math.round(a.r.qta)} a <b>${a.nuova} g</b>`;
    if (a.tipo === "cambia" && typeof alimentoEscluso === "function" && alimentoEscluso(a.a)) return null;   // cibi che hai escluso nel Profilo
    return furbiScartati.has(testa) ? null : { a: { tipo: "fit" }, r: { testa, html: `<button class="var-furbo lib-furbo" data-furbo-k="${esc(testa)}" ${attr}><span class="tag-fit">più fit</span>${testa}</button>` } };
  }).filter(Boolean);
  if (!e && !righeFit.length) return "";
  const riga = (a) => {
    let testa, attr;
    if (a.tipo === "pezzi") {
      const rp = ricettaPorzioniIntatta(c);
      testa = `Mangiane <b>${esc(etichettaPezzi(rp._orig, a.k))}</b> invece di ${esc(fmtQta(c.nPezzi))}`;
      attr = `data-pezzi-set="${a.k}"`;
    } else if (a.tipo === "cambia") {
      // l'idea si AGGIUNGE a quello che c'è: niente sostituzione automatica, tolgo io ciò che non voglio (cestino)
      const gn = a.g || Math.max(5, Math.round(a.r.qta / 5) * 5);
      testa = `Aggiungi <b>${gn} g di ${esc(a.a.toLowerCase())}</b>`;
      attr = `data-lib-add="${esc(a.a)}" data-lib-g="${gn}" data-lib-fisso="1"`;
    } else if (a.tipo === "porta") {
      testa = `Porta <b>${esc(a.r.nome.toLowerCase())}</b> da ${Math.round(a.r.qta)} a <b>${a.nuova} g</b>`;
      attr = a.r.reg ? `data-qta-diario="${a.r.rif[0]}|${a.r.rif[1]}|${a.nuova}"` : `data-lib-setq="${a.r.rif}|${a.nuova}"`;
    } else {
      testa = `Aggiungi <b>${a.g} g di ${esc(a.n.toLowerCase())}</b>`;
      attr = `data-lib-add="${esc(a.n)}" data-lib-g="${a.g}" data-lib-fisso="1"`;
    }
    if (furbiScartati.has(testa)) return null;
    if (typeof alimentoEscluso === "function" && ((a.tipo === "cambia" && alimentoEscluso(a.a)) || (a.tipo !== "pezzi" && a.tipo !== "porta" && a.n && alimentoEscluso(a.n)))) return null;   // cibi che hai escluso nel Profilo
    if (giaFit && ((a.tipo === "cambia" && giaFit.has(`cambia|${a.r.nome}|${a.a}`)) || (a.tipo === "porta" && giaFit.has(`porta|${a.r.nome}|${a.nuova}`)))) return null;   // già proposto in «Più fit»
    return { testa, html: `<button class="var-furbo lib-furbo" data-furbo-k="${esc(testa)}" ${attr}>${testa}${cenaDopoHTML(a.d)}</button>` };   // solo la mossa: il box si tocca per applicarla
  };
  // una mossa che aggiunge carboidrati prima di cena dice quanti ne lasci alla cena (e quanto riso sono), così scegli sapendolo
  function cenaDopoHTML(d) {
    if (!d || !(d.carboidrati >= 8) || d.carboidrati * 4 < 0.35 * Math.max(1, d.kcal) || typeof carboCenaDopo !== "function") return "";   // solo mosse fatte soprattutto di carboidrati (riso, pane, patate…), non le mandorle
    const piu = {}; MACRO_K.forEach(k => { piu[k] = ((m || {})[k] || 0) + (d[k] || 0); });
    let x = null; try { x = carboCenaDopo(c.data, c.pasto, escludiDi(c), piu); } catch (err) { return ""; }
    if (x == null) return "";
    const A = window.ALIMENTI || {}, riso = A["Riso basmati cotto"] ? Math.round(x / (A["Riso basmati cotto"][2] / 100) / 10) * 10 : 0;
    return `<small class="furbo-cena">a cena restano ~${Math.max(0, Math.round(x))} g di carboidrati${riso >= 30 ? ` (≈ ${riso} g di riso)` : ""}</small>`;
  }
  // fino a tre idee (con ↻ per altre); nei pasti principali in più la verdura, se manca
  const tutte = righeFit.concat(e ? e.scelte.map(a => ({ a, r: riga(a) })).filter(x => x.r) : []);
  const altre = tutte.filter(x => x.a.tipo !== "verdura"), verd = tutte.find(x => x.a.tipo === "verdura");
  const posti = verd ? 2 : 3;   // al massimo tre idee in tutto; ↻ mostra le tre successive
  // ↻ mostra le idee a «pagine» senza ripetere quelle appena viste; finite, si ricomincia dalle prime
  const pagine = Math.max(1, Math.ceil(altre.length / posti)), pg = (c.furbiGiro || 0) % pagine;
  const mostra = altre.slice(pg * posti, pg * posti + posti).concat(verd ? [verd] : []);
  if (!mostra.length) return "";
  return `<div class="furbi"><h4>🌙 Consigli furbi${altre.length > posti ? `<button class="cosa-altre" data-furbo-altro aria-label="Un'altra idea">${ICONA_ALTRE}</button>` : ""}</h4>${mostra.map(x => x.r.html).join("")}</div>`;
}

// Quello che hai nel pasto rispetto all'obiettivo, in una riga: "88 / 128 kcal · P 11/11 · C 9/14 · G 0/3" (senza obiettivo, solo i valori)
function macroHaObiettivoHTML(m, T, senzaKcal) {
  const r = (x) => Math.round(+x || 0), ob = T && (T.proteine + T.carboidrati + T.grassi) > 0;
  const v = (k) => `${r(m[k])}${ob ? `<em>/${r(T[k])}</em>` : ""}`;
  return `${senzaKcal ? "" : `<span><b>${r(m.kcal)}</b>${ob ? `<em> / ${r(T.kcal)}</em>` : ""} kcal</span>`}<span class="rr-macro"><i class="dot-p"></i><span>P ${v("proteine")}</span><i class="dot-c"></i><span>C ${v("carboidrati")}</span><i class="dot-g"></i><span>G ${v("grassi")}</span></span>`;
}
// La ricetta a porzioni (banana bread, pancake…) già cucinata: si cambia quante ne mangi, non gli ingredienti
function ricettaPorzioniIntatta(c) {
  return c && c.nPezzi && c.ricetta && typeof ricettaAPezzi === "function" && !ricettaModificata(c) ? ricettaAPezzi(c.ricetta) || null : null;
}
// Ricetta a teglia (porzioni > 1: pancake, banana bread…): già cucinata, non si cambiano gli ingredienti
function ricettaATeglia(c) {
  const r = ricettaPorzioniIntatta(c);
  return r && aPezzi(r._orig) ? r : null;
}
// Il campo per scrivere un ingrediente (con 📷 e ＋)
function campoAggiungiHTML(c) {
  return `<div class="lib-add">
      <input id="lib-input" class="qta-input wiz-full" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="${c.items.length ? "Aggiungi altro…" : "Cerca un alimento"}">
      <button class="btn-sec lib-scan" data-lib="scan" aria-label="Leggi il codice a barre">📷</button>
      <button class="btn lib-piu" data-lib="aggiungi" aria-label="Aggiungi ingrediente">＋</button>
    </div>
    <div id="lib-autoc" class="lib-autoc">${doppioneHTML(c)}</div>
    ${dettaHTML(c)}`;
}
// «2 pz», «½ pz» solo se i pezzi tornano (interi o mezzi); altrimenti in grammi: niente «4,4 pz» di fette biscottate
function doseLeggibile(nome, g) {
  const u = unitaDi({ nome }), gu = grammiPerUnita(nome, u), n = gu ? g / gu : 0;
  const passo = gu >= 30 ? 2 : 1;   // mezzo pezzo solo per pezzi grandi (½ banana sì, ½ mandorla no)
  if (gu && n >= 0.5 && Math.abs(n * passo - Math.round(n * passo)) < 0.08) return `${fmtQta(Math.round(n * passo) / passo)} ${sigleUnita(u)}`;
  return `${Math.round(g)} ${UNITA_LIQUIDI.test(nome) ? "ml" : "g"}`;
}
// Il riquadro «c'è già» al posto della riga che hai toccato (nella lista sotto la barra): l'avviso compare dove hai il dito
function chiediDoppioneQui(c, el, nome, qta) {
  c.doppione = { nome, qta: Math.round(qta * 10) / 10 };
  const box = document.getElementById("lib-autoc");
  if (box) box.innerHTML = doppioneHTML(c);   // la lista lascia il posto alla domanda, subito sotto la barra
  const d = document.querySelector("#lib-autoc .lib-doppio"); if (d && d.scrollIntoView) d.scrollIntoView({ block: "nearest" });
}
// la quantità che entrerebbe scrivendo quella riga (la stessa regola di aggiungiDaTesto)
function qtaDaRiga(r) {
  let qta = 0, lock = false;
  if (r.unita !== "q.b.") { qta = Math.round(grammiIng(r)); lock = qta > 0; }
  else if ((window.PORZIONE_INTERA || /$^/).test(r.nome) && (window.PESO_PZ || {})[r.nome]) { qta = window.PESO_PZ[r.nome]; lock = true; }
  if (!qta && r.unita === "q.b.") { qta = porzioneSolita(r.nome); lock = qta > 0; }   // niente quantità scritta: la dose solita
  return { qta, lock };
}
// Alimento già nel pasto da solo: prima di sommare si chiede (dentro il pannello, così il pasto aperto resta com'è)
function doppioneHTML(c) {
  const d = c && c.doppione, gia = d && c.items.find(x => x.grp == null && x.nome === d.nome);
  if (!gia) return "";
  return `<div class="lib-doppio" role="alert"><p>⚠️ C'è già <b>${esc(d.nome.toLowerCase())}</b> (${esc(doseLeggibile(d.nome, +gia.qta || 0))}) nel pasto. Sommo a quello presente? → <b>${esc(doseLeggibile(d.nome, (+gia.qta || 0) + d.qta))}</b></p>
    <div class="lib-doppio-tasti"><button class="btn-sec" data-lib-doppio="no">Annulla</button><button class="btn" data-lib-doppio="si">Sì, somma</button></div></div>`;
}
// Un alimento singolo nel pasto, da qualunque parte arrivi (ricerca, ＋, mangiati di recente, consigli):
// già presente da solo → si chiede se sommare; presente solo in una ricetta → riga a parte, e lo si dice
function aggiungiAlimento(c, nome, qta, lock, extra) {
  const gia = c.items.find(x => x.grp == null && x.nome === nome);
  if (gia) {
    if (!qta) qta = (window.PESO_PZ || {})[nome] || porzioneSolita(nome) || 0;
    if (!qta) { avviso(`${nome} c'è già: cambia la quantità nella sua riga`); return false; }
    c.doppione = { nome, qta: Math.round(qta * 10) / 10 };
    return false;
  }
  const diretto = extra && extra.diretto; if (extra) delete extra.diretto;
  // pasto che ha già qualcosa nel diario: l'alimento nuovo resta «da aggiungere» (scegli la quantità, poi ✓ Aggiungi), come le ricette in anteprima
  const daAggiungere = !diretto && c.vivo;   // nel pasto (vuoto o no) l'alimento scelto resta «da aggiungere»: scegli la quantità, poi ✓ Aggiungi
  c.items.push(Object.assign({ nome, cercato: nome, qta, lock }, extra || {}, daAggiungere ? { nuovo: true } : {}));
  c.ultimoAgg = nome;   // l'ultimo aggiunto mostra subito i pulsanti rapidi della quantità
  if (c.items.some(x => x.grp != null && x.nome === nome)) avviso(`${nome} c'è anche nella ricetta: questo va a parte`);
  return true;
}
// Un pasto già passato (l'ora è trascorsa) e registrato è «bloccato»: non si toglie ciò che hai mangiato. Il lucchetto 🔒 lo sblocca (con conferma);
// 🔓 lo richiude, e quando chiudi il pasto si richiude da solo. Anche bloccato le schede si aprono, in sola lettura, per vedere cosa e quanto hai mangiato.
const pastiSbloccati = new Set();
const chiavePastoSbl = (c) => c.data + "|" + c.pasto;
// Il lucchetto vale solo quando RIAPRI un pasto passato: mentre lo stai componendo (bozza) o subito dopo averlo salvato resta modificabile
// (_creatoOra: il pasto era vuoto quando hai aperto il pannello, quindi lo stai scrivendo adesso)
const pastoBloccato = (c) => !!(c && c.vivo && c.items && c.items.length && !c.bozza && !c._creatoOra && typeof pastoPassato === "function" && pastoPassato(c.data, c.pasto) && !pastiSbloccati.has(chiavePastoSbl(c)));
function ribloccaPasti() { pastiSbloccati.clear(); }
// Annulla di un ingrediente tolto: lo rimette direttamente nel diario (anche se il pannello è chiuso)
// - riga libera: nel piatto libero del pasto (si crea se non c'è più)
// - riga di una ricetta: nella sua ricetta, o la ricetta intera com'era se è sparita
function rimettiNelDiario(c, tolto, primaPasti) {
  if (!(+tolto.qta > 0)) return;
  const g = giornoDiario(c.data);
  const riga = Object.assign({ nome: tolto.nome, qta: Math.round(tolto.qta * 10) / 10, unita: "g", lock: true, cercato: tolto.cercato || tolto.nome }, tolto.unita && tolto.unita !== "g" ? { vis: tolto.unita } : {}, tolto.t ? { t: tolto.t } : {});
  if (tolto.grp == null) {
    let p = g.pasti.find(x => x.pasto === c.pasto && !x.ricetta);
    if (!p) { p = { nome: "", pasto: c.pasto, passaggi: [], ingredienti: [] }; g.pasti.push(p); }
    aggiungiIngredienteA(p, riga); rinominaLibero(p);
  } else {
    const prima = (primaPasti || []).filter(x => x.ricetta)[tolto.grp];
    if (!prima) return;
    const ora = g.pasti.filter(x => x.pasto === c.pasto && x.ricetta)[tolto.grp];
    if (ora && ora.ricetta === prima.ricetta) { aggiungiIngredienteA(ora, riga); rinominaLibero(ora); }
    else {   // la ricetta non c'è più (si è divisa togliendo un ingrediente del nome): il pasto torna com'era, senza doppioni
      g.pasti = g.pasti.filter(x => x.pasto !== c.pasto).concat(clone(primaPasti));
    }
  }
  scriviGiorno(c.data, g);
  if (typeof renderOggi === "function") renderOggi();
}
// Chiudendo il pannello (✕, sfondo, Esc) la bozza con quantità valide si salva come con «✓ Salva pasto»: ciò che hai scritto non si perde
function salvaBozzaAperta() {
  const c = liberoCtx;
  if (!c || !c.vivo || !c.bozza || typeof c.commit !== "function" || !c.items.some(x => +x.qta > 0)) return false;
  c.bozza = false; c.commit(c);   // commit scrive nel diario e aggiorna Oggi
  if (typeof renderOggi === "function") renderOggi();
  return true;
}
// elenco in sola lettura degli ingredienti (pasto bloccato): nome e quantità, niente pulsanti
function righeSolaLetturaHTML(items) {
  return `<ul class="pm-sola-lista">${items.map(it => {
    const u = unitaDi(it), gu = grammiPerUnita(it.nome, u), ug = UNITA_LIQUIDI.test(it.nome) ? "ml" : "g";
    const NOMI = { pz: "pz", cucchiaio: "cucc.", cucchiaino: "c.ino" };
    const pezzi = !!gu;   // l'unità la decide unitaDi (pezzi solo se tornano, altrimenti grammi)
    const q = (it.unita || "g") === "q.b." && !(it.qta > 0) ? "q.b." : pezzi ? `${fmtQta(it.qta / gu)} ${NOMI[u] || u} <small>≈ ${Math.round(it.qta)} ${ug}</small>` : `${Math.round(it.qta)} ${ug}`;
    return `<li><span>${esc(it.nome)}</span><b>${q}</b></li>`;
  }).join("")}</ul>`;
}
const pastoPassatoC = (c) => !!(c && c.vivo && typeof pastoPassato === "function" && pastoPassato(c.data, c.pasto));
// Pasto già salvato e modificato in questa apertura: le modifiche sono già nel diario, il tasto «✓ Salva modifiche» lo conferma e chiude
const firmaPasto = (c) => JSON.stringify((c.items || []).filter(it => !it.nuovo).map(it => [it.nome, Math.round((+it.qta || 0) * 10) / 10, it.unita || ""]));
function pastoModificato(c) {
  if (typeof pastoDaSalvare === "function") return pastoDaSalvare(c);   // diverso dalla foto di quando l'hai aperto (le aggiunte confermate sono già nella foto)
  if (!c || !c.vivo || c.bozza) return false;
  if (c._firma0 === undefined || c._firma0 === "[]") { c._firma0 = firmaPasto(c); c._giorno0 = JSON.stringify(leggiDiario()[c.data] || null); return false; }   // com'era quando l'hai aperto (un pasto vuoto appena riempito non conta come modifica); il giorno serve per «Annulla»
  return firmaPasto(c) !== c._firma0;
}
// «Altre idee» per un pasto già scritto (es. compilato dall'app): fino a 3 ricette simili che stanno nelle calorie e nei macro
// che restano nella giornata (contando gli altri pasti, non questo). ↻ ne mostra altre 3; toccandone una sostituisce il pasto.
function altreIdeeHTML(c) {
  if (!c || !c.vivo || c.bozza || !c.items.length || typeof ricetteConsigliate !== "function") return "";
  // con alimenti «Da aggiungere» non ancora confermati niente idee: le idee non li contano e proporrebbero un pasto intero. Tornano dopo ✓ Aggiungi
  if (c.items.some(it => it.nuovo) || (c.piattiNuovi || []).length) return "";
  const g = giornoDiario(c.data), idx = new Set(g.pasti.map((p, k) => p.pasto === c.pasto ? k : -1).filter(k => k >= 0));
  const attuali = new Set(g.pasti.filter(p => p.pasto === c.pasto).map(p => p.ricetta || p.nome));
  const chiaveAltre = [...attuali].join("|") + "|" + Math.round(mancaData(c.data).kcal);   // si ricalcola se cambia il pasto o le kcal che restano
  if (!c._altre || c._altreChiave !== chiaveAltre) {
    const resta = mancaData(c.data);   // ciò che resta nella giornata CON quello che hai già nel pasto: le idee si aggiungono, non lo sostituiscono
    const ciSta = (t) => t.kcal <= resta.kcal + 15 && t.carboidrati <= Math.max(0, resta.carboidrati) + 4 && t.grassi <= Math.max(0, resta.grassi) + 2;
    const quota = targetResiduoPasto(c.data, c.pasto).kcal;   // quanto resta a QUESTO pasto (quota meno ciò che c'è già)
    c._altre = ricetteConsigliate(c.data, c.pasto, 24).filter(x => !attuali.has(x.r.nome) && ciSta(x.tot) && !(typeof ricettaEsclusa === "function" && ricettaEsclusa(x.r)))
      .sort((a, b) => Math.abs(quota - a.tot.kcal) - Math.abs(quota - b.tot.kcal));   // prima quelle più vicine a quello che resta del pasto
    c._altreChiave = chiaveAltre;
  }
  const tutte = c._altre; if (!tutte.length) return "";
  const pagine = Math.ceil(tutte.length / 3), pg = (c.altreGiro || 0) % pagine;
  return `<div class="altre-idee"><h4 class="cosa-testa"><span>💡 Idee</span>${pagine > 1 ? `<button class="cosa-altre" data-altre-idee aria-label="Altre idee">${ICONA_ALTRE}</button>` : ""}</h4>
    <div class="sugg-ricette">${tutte.slice(pg * 3, pg * 3 + 3).map(x => `<button class="riga-ricetta" data-oggi-ricetta="${esc(x.r.nome)}"><span class="rr-nome">${esc(x.nome || x.r.nome)}</span>${macroStileHTML(x.tot)}</button>`).join("")}</div></div>`;
}
// sostituisce tutto quello che c'è nel pasto con la ricetta scelta (porzione su misura per le kcal che restano), con Annulla
function sostituisciPastoCon(c, nomeRicetta) {
  const dataP = c.data, pastoP = c.pasto, d0 = leggiDiario(), prima = JSON.stringify(d0[dataP] || null);
  const g = giornoDiario(dataP); g.pasti = g.pasti.filter(p => p.pasto !== pastoP); scriviGiorno(dataP, g);
  if (aggiungiRicettaIn(dataP, pastoP, nomeRicetta) < 0) { annullaPianificazione({ [dataP]: prima }); return; }
  if (typeof renderOggi === "function") renderOggi();
  apriPastoDiario(dataP, null, pastoP);
  avviso("✓ Pasto cambiato", "Annulla", () => { annullaPianificazione({ [dataP]: prima }); renderOggi(); if (liberoCtx && liberoCtx.data === dataP && liberoCtx.pasto === pastoP) apriPastoDiario(dataP, null, pastoP); });
}
// Anteprima di una ricetta scelta dalle idee: il piatto con la porzione giusta e, se si può, la sua versione più fit (prima di aggiungerla)
function anteprimaRicetta(c, nomeRicetta) {
  const r = ricette.find(x => x.nome === nomeRicetta && x.pasto === pastoRicetta(c.pasto)) || ricette.find(x => x.nome === nomeRicetta);
  if (!r) return null;
  const ps = porzioneSuMisura(r, targetResiduoPasto(c.data, c.pasto));
  ps.kMisura = ps.k;   // la porzione su misura per le kcal che restano: si parte da 1 e si sale se serve
  // si parte da 1 porzione / 1 fetta; ma se c'è un pezzo intero (tortilla, piadina…) la porzione parte da quella che ne usa almeno ¾ (così «1 metà di wrap» diventa 1 wrap intero, non 0,6 tortilla)
  const kPartenza = (() => {
    if (!r._orig || typeof versioneAPezzi !== "function") return 1;
    const passo = typeof passoPezzi === "function" ? passoPezzi(r._orig) : 1, A = window.ALIMENTI || {};
    for (let k = Math.max(1, passo); k <= (r._orig.porzioni || 1) + 0.001; k += passo) {
      const ing = versioneAPezzi(r._orig, k).ingredienti.filter(i => A[i.nome] && eIntero(i.nome, "pz") && grammiPerUnita(i.nome, "pz"));
      if (!ing.length || ing.every(i => grammiIng(i) / grammiPerUnita(i.nome, "pz") >= 0.75)) return k;
    }
    return 1;
  })();
  const kScelto = r._orig ? (c.antK || kPartenza) : null;
  if (r._orig && kScelto !== ps.k && typeof versioneAPezzi === "function") {
    const m = versioneAPezzi(r._orig, kScelto), A = window.ALIMENTI || {};
    ps.items = m.ingredienti.filter(i => i.unita !== "q.b." && A[i.nome]).map(i => ({ nome: i.nome, qta: Math.round(grammiIng(i)) }));
    ps.nome = nomeRicettaConPezzi(r, kScelto); ps.k = kScelto;
  }
  const items = ps.items.map(x => ({ nome: x.nome, qta: x.qta }));
  const tmp = { items, ricetta: r.nome, data: c.data, pasto: c.pasto };
  const mosse = aPezzi(r._orig || r) ? [] : mosseFit(tmp).slice(0, 1);   // un «Più fit» alla volta (il migliore); niente per le ricette a teglia (banana bread…)
  const fit = items.map((it, k) => { const m = mosse.find(a => a.r.k === k); return !m ? it : m.tipo === "cambia" ? { nome: m.a, qta: it.qta } : { nome: it.nome, qta: m.nuova }; });
  return { r, ps, items, mosse, fit, tot: macroDa(items), totFit: macroDa(fit) };
}
// Riga «nome · − quantità + · unità · cestino» con l'unità cambiabile (g ⇄ pz, cucchiai…): per l'anteprima della ricetta (p = "ant") e per il riepilogo (p = "agg").
// La quantità è sempre in grammi dentro; qui si vede nell'unità scelta.
function opzioniUnita(nome) {
  const pz = (window.PESO_PZ || {})[nome];
  return [...(pz ? [["pz", "pz"]] : []), ...(UNITA_LIQUIDI.test(nome) ? [["ml", "ml"], ["g", "g"]] : [["g", "g"]]), ...(puoUsareCucchiai(nome) ? [["cucchiaio", "cucchiaio"], ["cucchiaino", "cucchiaino"]] : [])];
}
function rigaQuantitaHTML(p, k, it, u) {
  const gu = grammiPerUnita(it.nome, u), ABBR = { pz: "pz", g: "g", ml: "ml", cucchiaio: "cucc.", cucchiaino: "c.ino" };
  const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  const input = gu
    ? `<input class="qta-input lib-qta" type="text" inputmode="decimal" autocomplete="off" data-${p}-qta="${k}" data-pz="${gu}" value="${fmt(it.qta / gu)}" aria-label="Quantità di ${esc(it.nome)}">`
    : `<input class="qta-input lib-qta" type="text" inputmode="decimal" autocomplete="off" data-${p}-qta="${k}" value="${Math.round(it.qta)}" aria-label="Quantità di ${esc(it.nome)}">`;
  return `<div class="lib-riga"><div class="lib-nome-txt${classeNome(it.nome)}"><span class="lib-nome-t">${esc(it.nome)}</span>${avvisoEsclusoHTML(it.nome)}</div>
      <div class="qstep"><button class="qstep-b" data-${p}-step="${k}|-1" aria-label="Meno">−</button>${input}<button class="qstep-b" data-${p}-step="${k}|1" aria-label="Più">＋</button></div>
      <div class="unita-box"><span class="unita-et ${(ABBR[u] || u).length > 3 ? "lunga" : ""}">${ABBR[u] || u}</span><select class="lib-unita-sel" data-${p}-unita="${k}" aria-label="Unità di misura">${opzioniUnita(it.nome).map(([v, l]) => `<option value="${v}" ${u === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <button class="lib-del" data-${p}-del="${k}" aria-label="Rimuovi">${ICONA_CESTINO}</button></div>`;
}
// nuova quantità (in grammi) dopo un tocco su − / ＋, con lo stesso passo del pannello
function qtaDopoStep(nome, qta, u, d) {
  const { gu, passo } = passoQuantita({ nome, qta, unita: u });
  const att = gu ? qta / gu : qta;
  const nuovo = gu ? prossimoMultiplo(att, d, passo) : grammiDopoStep(nome, att, d, 0);
  return gu ? Math.round(nuovo * gu * 10) / 10 : nuovo;
}
// totale del pasto DOPO l'aggiunta: quello che c'è già nel pasto + l'idea che stai guardando (così si confronta con la quota del pasto)
function sommaConPasto(c, t) {
  if (!c.items || !c.items.length) return t;
  const g = macroDa(c.items); return { kcal: g.kcal + t.kcal, proteine: g.proteine + t.proteine, carboidrati: g.carboidrati + t.carboidrati, grassi: g.grassi + t.grassi };
}
// ✕ dentro l'anteprima = un livello indietro (torna alle idee), non chiude il pannello. Vero se ha gestito il tocco.
function indietroAnteprima() {
  const c = liberoCtx; if (!c || !c.vivo || !c.anteprima) return false;
  if (c.confermaFit) { c.confermaFit = false; rirenderLibero(); return true; }
  c.anteprima = null; c.fitApplicato = null; c.confermaFit = false; c.antQta = null; c.antK = null; c.antUni = null; rirenderLibero(); return true;
}
// le quantità dell'anteprima (con «Più fit» se applicato) e quelle che hai cambiato tu a mano
function anteprimaItemsModificati(c, a) {
  const base = c.fitApplicato === "ora" ? a.fit : a.items, mod = c.antQta || {};
  return base.map((it, k) => { const u = (c.antUni && c.antUni[k]) || unitaDi({ nome: it.nome }); return { nome: it.nome, qta: mod[k] != null ? mod[k] : qtaPezziInteri(it.nome, u, it.qta), u }; });   // tortilla, piadina…: pezzi interi
}
function anteprimaHTML(c) {
  const a = anteprimaRicetta(c, c.anteprima); if (!a) { c.anteprima = null; return ""; }
  const descr = a.mosse.map(descrMossaFit).join(" · ");
  // conferma di «Più fit»: solo per questo piatto o per sempre (la ricetta cambia)
  if (c.confermaFit && a.mosse.length) return `<h3 class="modal-title">🥗 Più fit</h3>
    <p class="ant-conf">${descr} <b class="ant-meno">−${Math.round(a.tot.kcal - a.totFit.kcal)} kcal</b></p>
    <p class="hint">«Sempre» cambia anche la ricetta: le prossime volte la trovi già così.</p>
    <div class="wiz-nav"><button class="btn-sec" data-ant-fit-si="ora">Solo questa volta</button><button class="btn" data-ant-fit-si="sempre">Sempre</button></div>`;
  const ora = c.fitApplicato === "ora";
  const items = anteprimaItemsModificati(c, a), tot = macroDa(items);   // le quantità che hai cambiato tu contano nel totale
  const riga = (it, k) => rigaQuantitaHTML("ant", k, it, it.u);
  const rp = a.r._orig && typeof etichettaPezzi === "function" ? a.r._orig : null;
  const misura = rp && a.ps.kMisura !== a.ps.k ? `<button class="btn-link ant-misura" data-ant-misura>≈ ${esc(String(etichettaPezzi(rp, a.ps.kMisura)))} per il tuo obiettivo</button>` : "";
  const cont = rp ? `<div class="ant-cont"><span class="pm-contatore pm-cont-grande"><button class="nav-btn" data-ant-pz="-1" aria-label="Meno porzioni">−</button><b>${esc(String(etichettaPezzi(rp, a.ps.k)))}</b><button class="nav-btn" data-ant-pz="1" aria-label="Più porzioni">＋</button></span>${misura}</div>` : "";
  const fit = c.fitApplicato ? `<p class="ant-fatto">✓ Più fit applicato ${ora ? "solo questa volta" : "sempre"}</p>`
    : a.mosse.length ? `<button class="ant-fit" data-ant-fit>
      <span class="ant-fit-t">🥗 Più fit <span>−${Math.round(a.tot.kcal - a.totFit.kcal)} kcal</span></span>
      <span class="ant-mosse">${descr}</span>
      <span class="ant-fit-nota">Tocca per applicarlo</span>
    </button>` : "";   // niente da alleggerire: non compare niente
  return `<h3 class="modal-title">${esc(a.ps.nome || a.r.nome)}</h3>
    ${cont}<div class="ant-righe"><div class="r-macro ant-tot">${macroHaObiettivoHTML(sommaConPasto(c, tot), c.target())}${sopraGiornoHTML(c.data, tot.kcal)}</div><div class="lib-righe">${items.map((it, k) => it.qta > 0 || !(c.antQta && c.antQta[k] === 0) ? riga(it, k) : "").join("")}</div></div>
    ${fit}
    <div class="barra-salva due"><button class="btn-sec danger" data-ant-chiudi>Annulla</button><button class="btn lib-conferma" data-ant-aggiungi>✓ Aggiungi</button></div>`;
}
const descrMossaFit = (m) => m.tipo === "cambia" ? `${esc(m.r.nome.toLowerCase())} → <b>${esc(m.a.toLowerCase())}</b>` : `${esc(m.r.nome.toLowerCase())}: ${Math.round(m.r.qta)} → <b>${m.nuova} g</b>`;
// risposta alla conferma: «ora» = solo il piatto che aggiungi; «sempre» = anche la ricetta (con Annulla)
function applicaPiuFit(c, quando) {
  const a = anteprimaRicetta(c, c.anteprima); c.confermaFit = false;
  if (!a || !a.mosse.length) { rirenderLibero(); return; }
  c.fitDescr = a.mosse.map(descrMossaFit).join(" · ");
  if (quando === "ora") {
    c.fitApplicato = "ora"; c.fitMosse = a.mosse; rirenderLibero();
    avviso("✓ Più fit applicato a questo piatto", "Annulla", () => { if (liberoCtx === c && c.anteprima) { c.fitApplicato = null; c.fitMosse = null; rirenderLibero(); } });
    return;
  }
  const nome = a.r.nome;
  const annulla = rendiRicettaFit(nome, a.mosse.map(m => m.tipo === "cambia" ? { tipo: "cambia", nome: m.r.nome, a: m.a } : { tipo: "porta", nome: m.r.nome, fattore: m.nuova / Math.max(1, m.r.qta) }));
  c.fitApplicato = "sempre"; c.fitMosse = null; rirenderLibero();
  if (annulla) avviso("✓ Ricetta aggiornata", "Annulla", () => { annulla(); if (liberoCtx && liberoCtx.anteprima === nome) { liberoCtx.fitApplicato = null; rirenderLibero(); } });
}
// aggiunge la ricetta dell'anteprima (normale o più fit) al pasto e torna al pasto
function aggiungiDaAnteprima(c) {
  if (typeof vibra === "function") vibra();   // ✓ Aggiungi della ricetta   // (finali: un pizzico di sale da 0 g resta, ciò che hai tolto col cestino no)
  const a = anteprimaRicetta(c, c.anteprima), stato = c.fitApplicato, mosse = c.fitMosse;
  const tolti0 = c.antQta || {}, tuttiAnt = a ? anteprimaItemsModificati(c, a) : [], finali = tuttiAnt.filter((x, i) => +x.qta > 0 || (+x.qta === 0 && tolti0[i] === undefined && a.items[i] && !(+a.items[i].qta > 0))), kFinale = a ? a.ps.k : null, nomeFinale = a ? a.ps.nome : null, mod = c.antQta || {}, cambiato = Object.keys(mod).length || Object.keys(c.antUni || {}).length || (a && a.ps.kMisura != null && a.ps.k !== a.ps.kMisura) || finali.some((x, i) => a && a.items[i] && Math.abs(x.qta - a.items[i].qta) > 0.5);   // anche se i pezzi interi hanno cambiato un po' i grammi
  c.anteprima = null; c.fitApplicato = null; c.fitMosse = null; c.confermaFit = false; c.antQta = null; c.antK = null; c.antUni = null;
  if (!a) { rirenderLibero(); return; }
  if (c.bozza && typeof salvaBozzaAperta === "function") salvaBozzaAperta();
  const i = aggiungiRicettaIn(c.data, c.pasto, a.r.nome); if (i < 0) { rirenderLibero(); return; }
  if (stato === "ora" && mosse && mosse.length) {   // più fit solo per questo piatto: si cambia nel pasto, la ricetta resta com'è
    const g = giornoDiario(c.data), p = g.pasti[i];
    mosse.forEach(m => { const ing = p.ingredienti[m.r.k]; if (!ing) return; if (m.tipo === "cambia") { ing.nome = m.a; ing.cercato = m.a; } else ing.qta = m.nuova; });
    aggiornaMacro(p); scriviGiorno(c.data, g);
  }
  if (cambiato && finali.length) {   // porzioni e quantità scelte nell'anteprima vincono su quelle calcolate
    const g = giornoDiario(c.data), p = g.pasti[i];
    if (p) {
      const nomiAnt = new Set(tuttiAnt.map(x => x.nome)), ingrPrima = p.ingredienti;
      p.ingredienti = finali.map(x => Object.assign({ nome: x.nome, qta: +x.qta, unita: "g", lock: true, cercato: x.nome }, x.u && x.u !== "g" ? { vis: x.u } : {}))   // vis = l'unità con cui l'hai scelta (pz, cucchiai…)
        .concat((p.ingredienti || []).filter(i => !nomiAnt.has(i.nome)));   // ciò che l'anteprima non mostra resta: la ricetta è ancora intera, col contatore delle porzioni
      if (kFinale) { p.nPezzi = kFinale; if (nomeFinale) p.nome = nomeFinale; }
      if ((ingrPrima || []).some(i => !p.ingredienti.some(x => x.nome === i.nome)) && typeof rinominaLibero === "function") rinominaLibero(p, ingrPrima);   // tolto col cestino un ingrediente del nome: «(senza salmone)»
      aggiornaMacro(p); scriviGiorno(c.data, g);
    }
  }
  if (typeof renderOggi === "function") renderOggi();
  c._firma0 = undefined;   // appena aggiunto: non è una modifica da salvare
  if (typeof aggiuntaNellaFoto === "function") { const pn = giornoDiario(c.data).pasti[i]; if (pn) aggiuntaNellaFoto(c, (gf) => gf.pasti.push(clone(pn))); }   // «✓ Aggiungi» = salvato
  if (typeof apriRicettaNuova === "function") apriRicettaNuova(c, i);
  ricaricaViva(c);
  const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = 0;
  avviso(stato ? "✓ Aggiunta, più fit" : "✓ Aggiunta");
}
// «✓ Aggiungi»: gli alimenti e i piatti in «Da aggiungere» entrano nel pasto e sono salvati (anche nella foto: non sono modifiche da salvare)
function confermaNuovi(c) {
  const cibi = c.items.filter(x => x.nuovo), piatti = c.piattiNuovi || [];
  if (!cibi.length && !piatti.length) return;
  cibi.forEach(x => { delete x.nuovo; x.t = null; });
  c.piattiNuovi = [];
  if (cibi.length && typeof cibiNellaFoto === "function") cibiNellaFoto(c, cibi);   // prima nella foto, poi il disegno (così non compare «Salva»)
  rirenderLibero();   // il salvataggio scrive gli alimenti singoli
  if (piatti.length) {
    const g = giornoDiario(c.data); piatti.forEach(p => g.pasti.push(clone(p))); scriviGiorno(c.data, g);
    if (typeof aggiuntaNellaFoto === "function") aggiuntaNellaFoto(c, (gf) => piatti.forEach(p => gf.pasti.push(clone(p))));
    if (typeof renderOggi === "function") renderOggi();
    ricaricaViva(c);
  }
}
function liberoHTML() {
  const c = liberoCtx;
  if (!c) return "";
  const bloccato = pastoBloccato(c);   // pasto passato e registrato: solo riepilogo, niente modifiche finché non si sblocca
  if (c._ult === undefined) registraStoria(c);   // la versione di partenza del pasto, per poterci tornare
  if (c.scansione && typeof scansioneHTML === "function") return scansioneHTML(c); // fotocamera / codice a barre
  const T = c.target();
  const m = c.items.length ? macroDa(c.items) : null;
  const diff = m ? { kcal: T.kcal - m.kcal, proteine: T.proteine - m.proteine, carboidrati: T.carboidrati - m.carboidrati, grassi: T.grassi - m.grassi } : null;
  const furboBlocco = m ? consiglioFurboHTML(c, m) : "";   // dopo l'aggiunta: solo consigli per stare nei valori («Più fit» si sceglie prima, nell'anteprima della ricetta)

  const { pre, post } = contestoAllenamento(c);
  const righeK = c.items.map((it, k) => {
    const alt = cercaAlimenti(it.cercato || it.nome).slice(0, 6);
    // il nome è un campo: tocchi, scrivi il nuovo ingrediente e scegli dai suggerimenti (la quantità resta)
    const sel = `<div class="lib-nome-txt${classeNome(it.nome)}" role="button" tabindex="0" data-lib-nome-edit="${k}" aria-label="${esc(it.nome)} (tocca per cambiarlo)"><span class="lib-nome-t">${esc(it.nome)}</span>${avvisoEsclusoHTML(it.nome)}</div>`; // testo che va a capo; al tocco diventa un campo. Un cibo che hai escluso (dettato o scritto): «⚠️ contiene lattosio»
    const pz = (window.PESO_PZ || {})[it.nome];
    const u = unitaDi(it), gu = grammiPerUnita(it.nome, u);
    const unitaG = UNITA_LIQUIDI.test(it.nome) ? "ml" : "g";
    const opzioni = [...(pz ? [["pz", "pz"]] : []), ...(UNITA_LIQUIDI.test(it.nome) ? [["ml", "ml"], ["g", "g"]] : [["g", "g"]]), ...(puoUsareCucchiai(it.nome) ? [["cucchiaio", "cucchiaio"], ["cucchiaino", "cucchiaino"]] : [])];
    const ABBR = { pz: "pz", g: "g", ml: "ml", cucchiaio: "cucc.", cucchiaino: "c.ino" }; // nel riquadro si vede la sigla; nel menu che si apre il nome intero
    const cambia = `<div class="unita-box"><span class="unita-et ${(ABBR[u] || u).length > 3 ? "lunga" : ""}">${ABBR[u] || u}</span><select class="lib-unita-sel" data-lib-unita-sel="${k}" aria-label="Unità di misura">${opzioni.map(([v, l]) => `<option value="${v}" ${u === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
    const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
    // stessa logica per tutto: − numero + (come i pezzi delle ricette). Il numero si può anche scrivere.
    const input = gu
      ? `<input class="qta-input lib-qta" type="text" inputmode="decimal" autocomplete="off" data-lib-qta="${k}" data-pz="${gu}" value="${fmt(it.qta / gu)}">`
      : `<input class="qta-input lib-qta" type="text" inputmode="decimal" autocomplete="off" data-lib-qta="${k}" value="${Math.round(it.qta)}">`;
    const qtaHTML = `<div class="qstep"><button class="qstep-b" data-lib-step="${k}" data-d="-1" aria-label="Meno">−</button>${input}<button class="qstep-b" data-lib-step="${k}" data-d="1" aria-label="Più">＋</button></div>${cambia}`;
    const peso = gu ? `≈ ${Math.round(it.qta)} g` : (pz ? `≈ ${fmtQta(it.qta / pz)} pz` : "");
    // una sola riga: nome · quantità · unità · cestino
    const crudo0 = /cott/i.test(it.nome) && typeof crudoLabel === "function" ? crudoLabel(it.nome, it.qta) : null;
    const crudo = [crudo0, eAlimentoTuo(it.nome) ? `<button class="btn-link lib-modifica-al" data-lib="al-modifica" data-nome="${esc(it.nome)}" aria-label="Modifica i valori nutrizionali">✏️ valori</button>` : ""].filter(Boolean).join(" · ") || null;   // riso, pasta… cotti: quanto pesarli da crudo
    const avv = pre && troppiGrassiPre(it.nome, it.qta);   // pre-workout: niente grassi
    const avvT = typeof avvisoTonnoRiga === "function" ? avvisoTonnoRiga(c, it) : "";   // tonno in scatola oltre il consigliato della settimana
    const alt2 = avv && c.avvAperto === k ? alternativePre(c, it.nome, it.qta, k) : [];
    return `<div class="lib-riga${it.grp == null ? " riga-titolo" : ""}">
      ${sel}${qtaHTML}
      ${avv ? `<button class="lib-avv" data-lib-avv="${k}" aria-label="Prima dell'allenamento meglio senza grassi">⚠</button>` : ""}
      ${avvT ? `<button class="lib-avv" data-lib-avvt="${k}" aria-label="Tonno in scatola oltre il consigliato">⚠</button>` : ""}
      <button class="lib-del" data-lib-del="${k}" aria-label="Rimuovi">${ICONA_CESTINO}</button>
    </div>${avvT && c.tonnoAperto === k ? `<div class="lib-avv-lista"><span class="avv-tonno">${esc(avvT)}</span>${alternativeTonno(it, k).map(x => `<button class="var-furbo lib-furbo" data-sost-scegli="${k}" data-nome="${esc(x.nome)}" data-g="${x.g}">${esc(x.nome.toLowerCase())} <b>${x.g} g</b></button>`).join("")}</div>` : ""}${avv && c.avvAperto === k ? `<div class="lib-avv-lista">${alt2.map(x => `<button class="var-furbo lib-furbo" data-sost-scegli="${k}" data-nome="${esc(x.nome)}" data-g="${x.g}">${esc(x.nome.toLowerCase())} <b>${x.g} g</b></button>`).join("")}</div>` : ""}${crudo ? `<div class="lib-crudo">${crudo}</div>` : ""}`;
  });
  // ordine di lettura: prima le righe libere, poi ogni ricetta con la sua intestazione (nome · − porzioni + · cestino); gli indici k restano quelli di c.items
  const rango = (it) => it.grp == null ? -1 : it.grp;
  const ordine = c.items.map((_, k) => k).sort((a, b) => (rango(c.items[a]) - rango(c.items[b])) || (a - b));
  // "Già mangiato": schede tutte uguali (nome, P/C/G, kcal, freccia). Ricetta = una scheda; gli ingredienti scritti a mano = una scheda ciascuno in un unico riquadro.
  // Toccando una scheda si apre e gli ingredienti si modificano lì (− quantità +, unità, cestino); lo swipe a sinistra su una scheda la toglie.
  const frecciaHTML = () => `<span class="pm-freccia"></span>`;   // la freccia gira da sola quando la scheda è aperta (CSS)
  // valori di una ricetta del pasto: k pezzi di una ricetta a porzioni intatta = k × 1 pezzo (come nell'elenco ricette), altrimenti dagli ingredienti
  // ogni riquadro di «Già mangiato» ha i suoi P/C/G (come nelle Idee); sotto, i totali del pasto rispetto all'obiettivo
  const piuPiatti = true;
  const macroGruppo = (n) => {
    const gr = (c.gruppi || []).find(x => x.n === n), it = c.items.filter(x => x.grp === n && x.qta > 0);
    const esatti = gr && gr.intatta && typeof macroPastoRicetta === "function" && macroPastoRicetta({ ricetta: gr.ricetta, nPezzi: gr.nPezzi, ingredienti: it.map(x => ({ nome: x.nome, qta: x.qta, unita: "g" })) });
    return esatti || macroDa(it);
  };
  const ricettaHTML = (n, htmlRighe) => {
    const gr = (c.gruppi || []).find(x => x.n === n); if (!gr) return htmlRighe;
    const aperta = !!(c.gruppiAperti && c.gruppiAperti.has(n));
    const rp = gr.intatta && typeof ricettaAPezzi === "function" ? ricettaAPezzi(gr.ricetta) : null;
    const cont = rp ? `<span class="pm-contatore pm-cont-grande"><button class="nav-btn" data-grp-pz="${n}|-1" aria-label="Meno porzioni">−</button><b>${esc(String(etichettaPezzi(rp._orig, gr.nPezzi)))}</b><button class="nav-btn" data-grp-pz="${n}|1" aria-label="Più porzioni">＋</button></span>` : "";
    const m = macroGruppo(n);
    const r0 = typeof ricettaDaNome === "function" ? ricettaDaNome(gr.ricetta) : null, o = r0 ? (r0._orig || r0) : null, passi = o && Array.isArray(o.passaggi) ? o.passaggi : [];   // un passaggio solo è ovvio («Unisci il kiwi allo yogurt»): nel pasto si mostrano solo i procedimenti veri
    return `<div class="pm-blocco pm-card pm-piatto pm-ricetta${aperta ? " aperto" : ""}" data-grp-box="${n}">
      <div class="pasto-riga pm-testa${bloccato ? " sola-lettura" : ""}" data-grp-t="${n}" data-grp-toggle="${n}" role="button" tabindex="0" aria-expanded="${aperta}">
        <span class="pr-testo"><b><i class="pr-check pm-ck">✓</i>${esc(gr.nome)}</b>${piuPiatti ? macroStileHTML(m, { senzaKcal: true }) : ""}</span>
        <span class="pr-kcal">${Math.round(m.kcal)}<small> kcal</small></span>${frecciaHTML(aperta)}
        <button class="lib-grp-del" data-grp-del="${n}" hidden tabindex="-1" aria-hidden="true"></button>
      </div>
      ${aperta ? `<div class="pm-dett">${bloccato ? righeSolaLetturaHTML(c.items.filter(x => x.grp === n)) : cont + htmlRighe}${passi.length > 1 ? `<ol class="pm-passi">${passi.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}</div>` : ""}
    </div>`;
  };
  // pulsanti rapidi della quantità: ½·1·2 pezzi, ½·1·2·3 cucchiai, oppure metà / solita / una volta e mezza / doppia in grammi
  const presetHTML = (k) => {
    const it = c.items[k], u = unitaDi(it), gu = grammiPerUnita(it.nome, u);
    let vals, suff;
    if (gu) {
      const n = u === "pz" ? (passoQuantita(it).passo === 1 ? [1, 2, 3, 4] : [0.5, 1, 1.5, 2]) : [0.5, 1, 2, 3];
      vals = n.map(x => [Math.round(x * gu * 10) / 10, fmtQta(x)]); suff = sigleUnita(u);
    } else {
      const b = porzioneSolita(it.nome) || 100, r = (g) => g >= 100 ? Math.round(g / 10) * 10 : Math.max(5, Math.round(g / 5) * 5);
      // olio, frutta secca…: il contatore va di 1 g, le pillole fanno i salti
      let piccolo = false; try { piccolo = !!(window.ALIMENTI || {})[it.nome] && profiloBase(it.nome).tip <= 25; } catch (e) {}
      vals = (piccolo ? [5, 10, 15, 20, 30] : [...new Set([0.5, 1, 1.5, 2].map(f => r(b * f)))]).map(g => [g, String(g)]); suff = UNITA_LIQUIDI.test(it.nome) ? "ml" : "g";
    }
    return `<div class="lib-preset" role="group" aria-label="Quantità rapida">${vals.map(([g, t]) => `<button class="lib-preset-b${Math.abs(g - it.qta) < 0.6 ? " on" : ""}" data-lib-preset="${k}|${g}">${t}<small> ${suff}</small></button>`).join("")}</div>`;
  };
  const voceHTML = (k) => {   // ingrediente singolo = scheda come la ricetta: ✓ nome, − N porzione +, P/C/G, kcal
    const it = c.items[k], m = macroDa([it]);
    const u = unitaDi(it), gu = grammiPerUnita(it.nome, u), conta = gu ? it.qta / gu : 0;
    const liq = UNITA_LIQUIDI.test(it.nome), ug = liq ? "ml" : "g", nm = /.[A-ZÀ-Ý]/.test(it.nome) ? it.nome.charAt(0).toLowerCase() + it.nome.slice(1) : it.nome.toLowerCase();   // le marche (Lidl) restano con la maiuscola
    // plurale semplice per i frutti e simili in una sola parola che finisce in -a: pesca → pesche, banana → banane
    // con le forme note (uovo/uova, galletta/gallette…) si usa quelle: «1 uovo», «2 uova»
    const pl = typeof FORME_PEZZI !== "undefined" && FORME_PEZZI[it.nome] ? FORME_PEZZI[it.nome][conta > 1 ? 1 : 0]
      : (conta > 1 && /^[a-zà-ù]+a$/.test(nm) && nm !== "uova") ? nm.replace(/cia$/, "ce").replace(/gia$/, "ge").replace(/ca$/, "che").replace(/ga$/, "ghe").replace(/a$/, "e") : nm;   // «uova» è già plurale; arancia → arance
    // riepilogo: «1 pesca», «150 g di yogurt greco», «2 cucchiai di burro di arachidi»; dentro la scheda c'è il contatore
    const inGrammi = !gu;   // l'unità la decide unitaDi: pezzi solo se tornano, oppure se li hai scelti tu per questa riga
    const riepilogo = inGrammi ? `${Math.round(it.qta)} ${ug} di ${nm}`
      : u === "pz" ? `${fmtQta(conta)} ${pl}`
      : `${fmtQta(conta)} ${u === "cucchiaio" ? (conta > 1 ? "cucchiai" : "cucchiaio") : (conta > 1 ? "cucchiaini" : "cucchiaino")} di ${nm}`;
    const ABBR = { pz: "pz", g: "g", ml: "ml", cucchiaio: "cucchiai", cucchiaino: "cucchiaini" };
    const etic = !gu ? `${Math.round(it.qta)} ${ug}` : `${fmtQta(conta)} ${ABBR[u] || u}`;
    const pzG = (window.PESO_PZ || {})[it.nome];
    const opz = [...(pzG ? ["pz"] : []), ug, ...(!liq && puoUsareCucchiai(it.nome) ? ["cucchiaio", "cucchiaino"] : [])];   // una bevanda non si misura a cucchiai
    const equiv = gu ? `≈ ${Math.round(it.qta)} ${ug}` : (pzG ? `≈ ${fmtQta(it.qta / pzG)} pz` : "");   // quanto pesa quel pezzo / quanti pezzi sono quei grammi
    const scegli = opz.length > 1 ? `<span class="pm-unita">${opz.map(x => `<button class="pm-u${(gu ? u : ug) === x ? " on" : ""}" data-lib-unita-set="${k}|${x}" aria-pressed="${(gu ? u : ug) === x}">${ABBR[x] === "cucchiai" ? "cucc." : ABBR[x] === "cucchiaini" ? "c.ino" : x}</button>`).join("")}</span>` : "";
    const avv = pre && troppiGrassiPre(it.nome, it.qta);
    const avvT = typeof avvisoTonnoRiga === "function" ? avvisoTonnoRiga(c, it) : "";
    const alt2 = avv && c.avvAperto === k ? alternativePre(c, it.nome, it.qta, k) : [];
    // pasto passato: l'alimento singolo dice già tutto nel titolo («60 g di mirtilli»), quindi niente tendina; resta per le ricette
    const aperta = !bloccato && !!(c.vociAperte && c.vociAperte.has(it.nome));
    return `<div class="pm-blocco pm-card pm-piatto lib-voce${aperta ? " aperta" : ""}" data-voce="${esc(it.nome)}">
      <div class="pasto-riga pm-testa pm-ing lib-voce-testa${bloccato ? " sola-lettura pm-fissa" : ""}"${bloccato ? "" : ` data-voce-toggle="${esc(it.nome)}" role="button" tabindex="0" aria-expanded="${aperta}"`}>
        <span class="pr-testo"><b><i class="pr-check pm-ck">✓</i>${esc(riepilogo)}${avvisoEsclusoHTML(it.nome)}${gu && !inGrammi ? `<span class="pm-eq-riep"> ≈ ${Math.round(it.qta)} ${ug}</span>` : ""}</b>${piuPiatti ? macroStileHTML(m, { senzaKcal: true }) : ""}</span>
        <span class="pr-kcal">${Math.round(m.kcal)}<small> kcal</small></span>${avv && !aperta && !bloccato ? `<button class="lib-avv" data-lib-avv="${k}" aria-label="Prima dell'allenamento meglio senza grassi">⚠</button>` : ""}${avvT && !aperta && !bloccato ? `<button class="lib-avv" data-lib-avvt="${k}" aria-label="Tonno in scatola oltre il consigliato">⚠</button>` : ""}${bloccato ? "" : frecciaHTML()}
        <button class="lib-voce-del" data-lib-del="${k}" hidden tabindex="-1" aria-hidden="true"></button>
      </div>${aperta && bloccato ? `<div class="pm-dett">${righeSolaLetturaHTML([it])}</div>` : aperta ? `<div class="pm-dett pm-riga-sola">${righeK[k].replace(/<button class="lib-del"[^>]*>[\s\S]*?<\/button>/, "").replace(/<div class="lib-nome-txt[^"]*"[^>]*>[\s\S]*?<\/div>/, "")}</div>` : ""}${!bloccato && aperta ? presetHTML(k) : ""}${avvT && !aperta && !bloccato && c.tonnoAperto === k ? `<div class="lib-avv-lista"><span class="avv-tonno">${esc(avvT)}</span>${alternativeTonno(it, k).map(x => `<button class="var-furbo lib-furbo" data-sost-scegli="${k}" data-nome="${esc(x.nome)}" data-g="${x.g}">${esc(x.nome.toLowerCase())} <b>${x.g} g</b></button>`).join("")}</div>` : ""}${avv && !aperta && !bloccato && c.avvAperto === k ? `<div class="lib-avv-lista">${alt2.map(x => `<button class="var-furbo lib-furbo" data-sost-scegli="${k}" data-nome="${esc(x.nome)}" data-g="${x.g}">${esc(x.nome.toLowerCase())} <b>${x.g} g</b></button>`).join("")}</div>` : ""}
    </div>`;
  };
  const parti = [];
  const nuovi = ordine.filter(k => c.items[k].nuovo && c.items[k].grp == null);   // scelti ma non ancora aggiunti
  ordine.filter(k => !nuovi.includes(k)).forEach(k => { const gp = c.items[k].grp == null ? null : c.items[k].grp; const ult = parti[parti.length - 1]; if (!ult || ult.grp !== gp) parti.push({ grp: gp, html: "", ks: [] }); const u = parti[parti.length - 1]; u.html += righeK[k]; u.ks.push(k); });
  const gruppiPresenti = [...new Set(c.items.filter(x => x.grp != null).map(x => x.grp))];
  const mPasto = gruppiPresenti.reduce((t, n) => { const g = macroGruppo(n); return { kcal: t.kcal + g.kcal, proteine: t.proteine + g.proteine, carboidrati: t.carboidrati + g.carboidrati, grassi: t.grassi + g.grassi }; }, macroDa(c.items.filter(x => x.qta > 0 && x.grp == null)));
  const kcalTot = Math.round(macroDa(c.items.filter(x => x.qta > 0 && x.grp == null && !x.nuovo)).kcal + [...new Set(c.items.filter(x => x.grp != null).map(x => x.grp))].reduce((s, n) => s + macroGruppo(n).kcal, 0));
  // un riquadro per ogni cosa mangiata, dall'ultima aggiunta alla prima (la riga appena aggiunta non ha ancora l'ora: è la più nuova)
  const quando = (k) => c.items[k].t == null ? Infinity : c.items[k].t;
  const schede = [];
  parti.forEach(x => x.grp === null
    ? x.ks.forEach(k => schede.push({ t: quando(k), k, html: voceHTML(k) }))
    : schede.push({ t: Math.min(...x.ks.map(quando)), k: Math.min(...x.ks), html: ricettaHTML(x.grp, x.html) }));
  schede.sort((p, q) => (q.t === p.t ? 0 : q.t > p.t ? 1 : -1) || (q.k - p.k));
  const righe = !schede.length ? "" : `<div class="pm-sezione${bloccato ? " bloccato" : ""}"><p class="pm-tot"><span>Già mangiato${bloccato ? ` <button class="pm-lucchetto" data-lib-sblocca aria-label="Pasto passato: tocca per sbloccare">🔒</button>` : pastoPassatoC(c) && c.items.length && !c.bozza && !c._creatoOra ? ` <button class="pm-lucchetto aperto" data-lib-riblocca aria-label="Pasto sbloccato: tocca per bloccarlo di nuovo">🔓</button>` : ""}</span><span class="pm-kcal"><b>${kcalTot} kcal</b>${T.kcal > 0 ? `<em> / ${Math.round(T.kcal)} kcal</em>` : ""}</span></p>${schede.map(x => x.html).join("")}</div>`;   // le kcal del pasto rispetto a quelle previste

  const ignoto = (c.ignoto || c.ignotoNuovo) ? `<div class="lib-ignoto pagina${c.ignotoCodice ? " da-codice" : ""}">
      ${c.ignotoNuovo && !c.ignoto && !c.modificaAl ? `<p class="hint">Fotografa la tabella nutrizionale: i valori si compilano da soli. Controllali e salva.</p>` : c.ignotoNuovo && !c.ignoto ? "" : c.ignotoCodice ? `<p class="hint">Codice ${esc(c.ignotoCodice)} · controlla i valori e salva.</p>`
        : `<p class="hint">Non trovo <b>${esc(c.ignoto)}</b> tra gli alimenti.</p>
          ${ricetteTestoHTML(c.ignoto, "data-ignoto-ricetta") ? `<div class="autoc-lista">${ricetteTestoHTML(c.ignoto, "data-ignoto-ricetta")}</div>` : ""}
          <button class="btn-sec block" data-lib="off-cerca">🔎 Cercalo tra i prodotti confezionati</button>
          ${typeof ricercaOFFHTML === "function" ? ricercaOFFHTML(c) : ""}
          `}
      ${fotoEtichettaHTML("etic-libero")}
      <p class="et-sez">Nome</p>
      <input id="ignoto-nome" class="qta-input wiz-full" autocomplete="off" placeholder="${(c.ignotoNuovo && !c.ignoto) || c.ignotoCodice ? "es. Budino proteico Lidl" : ""}" value="${esc(c.modificaAl || (c.ignotoCodice ? (c.nomeArchivio || "") : (c.ignoto || "").charAt(0).toUpperCase() + (c.ignoto || "").slice(1)))}"${c.modificaAl ? " readonly" : ""}>
      <div class="etic-box">${campiEtichettaHTML("etic-libero", c.modificaAl ? valoriAlimento(c.modificaAl) : null, { senzaFoto: true, pesoPz: c.modificaAl ? pesoPzTuo(c.modificaAl) : 0 })}</div>
      <div class="wiz-nav"><button class="btn-sec" data-lib="ignoto-annulla">Annulla</button><button class="btn" data-lib="ignoto-salva">✓ Salva alimento</button></div>
    </div>` : "";

  const avvPre = pre ? c.items.filter(it => troppiGrassiPre(it.nome, it.qta)) : [];   // legenda del ⚠: cosa segnala e perché, così si impara
  const fmtG = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
  const righeBozza = ordine.map(k => righeK[k] + (c.items[k].grp == null ? presetHTML(k) : "")).join("");   // mentre componi: pulsanti rapidi sotto ogni alimento
  // piatti interi da aggiungere (Ripeti, ricette dei mangiati di recente): nome, porzioni, cestino
  const piattiN = (c.piattiNuovi || []).map((p, j) => { const r = typeof pastoRicettaIntatta === "function" ? pastoRicettaIntatta(p) : null;
    return `<div class="pm-nuovo-piatto"><div class="pnp-testa"><b>${esc(typeof nomeConQuantita === "function" ? nomeConQuantita(p) : p.nome)}</b><span class="pr-kcal">${Math.round(+p.kcal || 0)}<small> kcal</small></span><button class="lib-del" data-nuovo-del="${j}" aria-label="Togli">${ICONA_CESTINO}</button></div>${r && p.nPezzi ? `<span class="pm-contatore pm-cont-grande"><button class="nav-btn" data-nuovo-pz="${j}|-1" aria-label="Meno porzioni">−</button><b>${esc(String(etichettaPezzi(r._orig, p.nPezzi)))}</b><button class="nav-btn" data-nuovo-pz="${j}|1" aria-label="Più porzioni">＋</button></span>` : ""}</div>`; }).join("");
  const daAggiungere = nuovi.length || piattiN ? `<div class="pm-nuovi"><p class="pm-tot"><span>Da aggiungere</span></p>${piattiN}${nuovi.map(k => righeK[k] + presetHTML(k)).join("")}</div>` : "";
  const ingrLive = `<div class="lib-righe">${daAggiungere}${c.bozza ? righeBozza : righe}</div>
      ${avvPre.length ? `<div class="lib-legenda-avv" role="note">${avvPre.map(it => `<p><span aria-hidden="true">⚠</span> <b>${esc(it.nome)}</b>: ${fmtG(grassiAlimento(it.nome, it.qta))} g di grassi. Prima di allenarti meglio senza grassi: rallentano la digestione.</p>`).join("")}</div>` : ""}`;
  // inserendo un alimento nuovo si vede solo quello: niente idee né consigli; salvato o annullato, si torna al pasto
  if (c.anteprima) { const h = anteprimaHTML(c); if (h) return h; }
  if (ignoto) return `<button class="btn-link modal-indietro" data-lib="ignoto-annulla">‹ Torna al pasto</button>
    <h3 class="modal-title">${c.modificaAl ? "Modifica alimento" : "Nuovo alimento"}</h3>${ignoto}`;
  return `
    <h3 class="modal-title"><span class="mt-testo">${c.titolo()}</span></h3>
    ${bloccato ? "" : `<div class="lib-box">
    ${campoAggiungiHTML(c)}
    ${c.intestazione()}
    </div>`}
    ${ignoto}
    ${c.items.length || (c.piattiNuovi || []).length ? `
      ${sopraGiornoHTML(c.data, c.bozza ? m.kcal : 0)}
      ${ingrLive}
      <div class="lib-risultato">
        <div class="r-macro">${c.bozza || schede.length > 1 ? macroHaObiettivoHTML(mPasto, T, true) : ""}${post && m && avvisoPost(c, m) ? `<span class="avv-post" aria-label="Dopo l'allenamento servono proteine e carboidrati">⚠ ${avvisoPost(c, m)}</span>` : ""}</div>
      </div>
      ${pastoPassatoC(c) ? "" : furboBlocco}
      ${bloccato ? "" : altreIdeeHTML(c)}
    ` : c.idee()}
    ${c.bozza ? "" : bloccato ? "" : `<button class="btn-link link-ricette" data-azione="ricette-da-pasto">📖 Ricette ›</button>`}
    ${c.bozza ? `<div class="barra-salva"><button class="btn block lib-conferma" data-lib="conferma-bozza">✓ Salva pasto</button></div>` : !bloccato && daAggiungere ? `<div class="barra-salva due"><button class="btn-sec danger" data-lib="annulla-nuovi">Annulla</button><button class="btn lib-conferma" data-lib="aggiungi-nuovi">✓ Aggiungi</button></div>` : !bloccato && pastoModificato(c) ? `<div class="barra-salva due"><button class="btn-sec danger" data-lib="annulla-modifiche">Annulla</button><button class="btn lib-conferma" data-lib="salva-modifiche">✓ Salva</button></div>` : ""}
  `;
}
// Nome automatico con le parole che hai scritto (es. "Pollo, zucca, riso")
// Salva gli ingredienti di questo pasto come ricetta del ricettario (con il nome che scegli)
function salvaPiattoComeRicetta(c, nomeScritto) {
  const nome = String(nomeScritto || "").trim().replace(/^✍️\s*/, "");
  if (!nome) { avviso("Scrivi un nome per il piatto."); return false; }
  if (!c.items.length) return false;
  const custom = leggiCustom();
  const esiste = ricette.some(r => r.nome === nome) && !custom.some(r => r.nome === nome);
  if (esiste) { avviso("Esiste già una ricetta con questo nome. Cambialo."); return false; }
  const pasto = pastoRicetta(c.pasto || "spuntino");
  const ingredienti = c.items.map(it => {
    const u = unitaDi(it), gu = grammiPerUnita(it.nome, u);
    if (gu) return { nome: it.nome, qta: Math.max(0.5, Math.round(it.qta / gu * 2) / 2), unita: u };
    return { nome: it.nome, qta: Math.round(it.qta), unita: UNITA_LIQUIDI.test(it.nome) ? "ml" : "g" };
  });
  const m = calcolaMacro({ ingredienti });
  const nuova = { nome, pasto, tempo: 5, custom: true, kcal: m.kcal, proteine: m.proteine, carboidrati: m.carboidrati, grassi: m.grassi, ingredienti, passaggi: [] };
  salvaCustom(custom.filter(r => r.nome !== nome).concat(nuova));
  caricaRicette();
  c.ricetta = nome; c.nome = nome; // nel diario il piatto porta lo stesso nome
  avviso(`✓ “${nome}” salvato nelle ricette`);
  return true;
}
// A pezzi solo se i pezzi «tornano»: interi o mezzi per quelli grandi (½ banana, 1½ mele), interi per quelli piccoli (mandorle, gallette).
// Altrimenti si scrive in grammi, che possono essere qualsiasi («165 g di banana»): niente «1,4 banane»
function pezziPuliti(nome, conta) {
  const pz = (window.PESO_PZ || {})[nome] || 0, m = pz >= 30 ? 2 : 1;
  return conta >= (m === 2 ? 0.5 : 1) - 0.02 && Math.abs(conta * m - Math.round(conta * m)) < 0.04;
}
// nei nomi dei pasti alcuni alimenti dal nome lungo si accorciano (il nome completo resta nella riga dell'ingrediente)
const NOMI_BREVI = { "Proteine vegetali in polvere (pisello)": "proteine di pisello", "Whey protein (proteine del siero)": "proteine whey" };
function nomeAutomatico(items) {
  const n = items.map(x => { // tutti gli ingredienti, uno per uno; quelli a pezzi con la quantità davanti ("1 mela")
    const nome = NOMI_BREVI[x.nome] && (!x.cercato || x.cercato === x.nome) ? NOMI_BREVI[x.nome] : (x.cercato || x.nome).toLowerCase();
    const u = x.qta ? unitaDi({ nome: x.nome, unita: x.unita }) : "g", gu = u === "pz" ? grammiPerUnita(x.nome, u) : 0;
    return gu && pezziPuliti(x.nome, x.qta / gu) ? nomeConNumero(x.nome, x.qta / gu) : nome; // 1 → "uovo"; più di uno → "2 uova"; pezzi che non tornano: solo il nome
  });
  if (!n.length) return "Pasto libero";
  const s = n.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Aggiunge ingredienti dal campo di testo ("pollo, zucca 300")
// Aggiunge ingredienti dal campo di testo: "pollo, zucca 300", "2 gin tonic", "mezza pizza",
// "un cucchiaio di olio". Con una quantità il peso resta fisso; senza, lo calcola l'app
// (ma pizza, bevande e simili valgono 1 porzione intera).
// Quantità "di solito": la mediana di ciò che hai scelto tu altre volte per quell'alimento (almeno 2 volte); se non c'è storia, una porzione normale per i più comuni.
const QTA_USUALE = { "Yogurt greco 0%": 150, "Yogurt greco": 150, "Yogurt bianco": 125, "Latte scremato": 150, "Fiocchi di latte": 100, "Skyr": 150 };
function quantitaUsuale(nome) {
  const v = [];
  try { Object.values(leggiDiario()).forEach(g => (g.pasti || []).forEach(p => (p.ingredienti || []).forEach(i => { if (i.nome === nome && i.lock && i.qta > 0 && (i.unita || "g") !== "q.b.") v.push(+i.qta); }))); } catch (e) { /* senza storia */ }
  if (v.length >= 2) { v.sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; }
  return QTA_USUALE[nome] || 0;
}
// Dose «solita» di un alimento scritto senza quantità: niente calcoli a sorpresa, si cambia coi pulsanti rapidi.
// Prima la porzione intera (pizza, bevande…), poi quella che usi di solito, poi 1 pezzo (o qualche galletta), poi una porzione normale della sua categoria
function porzioneSolita(nome) {
  const pz = (window.PESO_PZ || {})[nome] || 0;
  if ((window.PORZIONE_INTERA || /$^/).test(nome) && pz) return pz;
  const u = quantitaUsuale(nome); if (u > 0) return u;
  if (pz && window.pzPredefinito && window.pzPredefinito(nome)) return pz < 30 ? Math.max(1, Math.min(pz < 5 ? 99 : 4, Math.round(Math.max(20, profiloBase(nome).tip) / pz))) * pz : pz;   // piccoli (mandorle, noci, gallette): quanti ne fanno una porzione
  return profiloAlimento(nome).tip;
}
const sigleUnita = (u) => u === "pz" ? "pz" : u === "cucchiaio" ? "cucc." : u === "cucchiaino" ? "c.ino" : u;
// "1 pz", "150 g", "2 cucc." per una dose in grammi, nell'unità in cui leggi quell'alimento
function etichettaDose(nome, g) {
  const u = unitaDi({ nome }), gu = grammiPerUnita(nome, u);
  return gu ? `${fmtQta(g / gu)} ${sigleUnita(u)}` : `${Math.round(g)} ${UNITA_LIQUIDI.test(nome) ? "ml" : "g"}`;
}
// dopo un'aggiunta il campo resta pronto per il prossimo alimento (la tastiera non si chiude)
function rifocusInput() { const i = document.getElementById("lib-input"); if (i && liberoCtx && !liberoCtx.ignoto) i.focus({ preventScroll: true }); }
function aggiungiDaTesto(testo) {
  const c = liberoCtx;
  // prima si divide sulle virgole; la "e" divide solo se la frase intera non è un piatto
  // conosciuto ("pizza funghi e speck" resta una pizza, "pollo e zucca" sono due cose)
  const intera = (t) => { const r = leggiRigaIngrediente(t); if (!r || !r.nome) return false; const a = norm(r.nome), b = norm(r.cercato);
    return a === b || a.includes(b) || PREFERITI[b] === r.nome; };
  const parti = String(testo).split(/[,;+]/).map(s => s.trim()).filter(Boolean)
    .flatMap(t => /\se\s/.test(t) && !intera(t) ? t.split(/\se\s/).map(x => x.trim()).filter(Boolean) : [t]);
  for (const p of parti) {
    const r = leggiRigaIngrediente(p);
    if (!r) continue;
    if (!r.nome) { c.ignoto = r.cercato || p; continue; }
    const { qta, lock } = qtaDaRiga(r);   // niente quantità scritta: la dose solita, poi la cambi coi pulsanti rapidi
    const unita = ["g", "ml"].includes(r.unita) ? "g" : ["pz", "cucchiaio", "cucchiaino"].includes(r.unita) ? r.unita : undefined; // l'unità che hai scritto
    aggiungiAlimento(c, r.nome, qta, lock, { cercato: r.cercato, unita });   // già nel pasto da solo: chiede se sommare
  }
  ricalcolaLibero();
}

// -------- Pasto detto a voce (o scritto di fila): «ho mangiato due uova, una fetta di pane e un caffè» --------
// Si usa il 🎤 della tastiera del telefono: qui si «traduce» il parlato in righe che il lettore degli ingredienti capisce.
const RIEMPITIVI_PARLATO = /\b(allora|dunque|ehm|ok|inserisci|aggiungi|metti|segna|registra|scrivi|ho mangiato|ho bevuto|ho preso|mi sono (?:fatt[oa]|pres[oa]|mangiat[oa])|ho fatto|ci ho messo|anche|circa|più o meno|piu o meno|tipo|diciamo|per (?:colazione|pranzo|cena|merenda|spuntino)|a (?:colazione|pranzo|cena|merenda)|stamattina|stamani|oggi|stasera|stanotte)\b/g;
const NUMERI_PAROLA = { un: 1, uno: 1, una: 1, "un'": 1, mezzo: 0.5, mezza: 0.5, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
const NUM_PAROLA_RE = "(\\d+(?:[.,]\\d+)?|un'|un|uno|una|mezzo|mezza|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)";
const numParola = (w) => w === undefined || w === "" ? 1 : NUMERI_PAROLA[w] !== undefined ? NUMERI_PAROLA[w] : parseFloat(String(w).replace(",", "."));
// misure «a voce» → grammi o millilitri; le porzioni («un piatto di…») → la dose solita
const MISURE_PARLATO = [
  [/^(?:etto|etti)$/, 100, "g"], [/^(?:manciata|manciate)$/, 30, "g"], [/^(?:bicchiere|bicchieri)$/, 200, "ml"], [/^(?:tazza|tazze)$/, 250, "ml"],
  [/^(?:tazzina|tazzine)$/, 40, "ml"], [/^(?:lattina|lattine)$/, 330, "ml"], [/^(?:bottiglietta|bottigliette)$/, 500, "ml"], [/^(?:calice|calici)$/, 150, "ml"],
  [/^(?:piatto|piatti|piattino|ciotola|ciotole|porzione|porzioni|scodella|scodelle|coppetta|coppette)$/, 0, "porz"],
];
// a voce le parole arrivano giuste: l'alimento trovato deve contenere la parola principale detta («frittelle di zia Pina» non è «Pinoli»)
// un alimento trovato per una parola detta è credibile se almeno metà delle parole importanti corrisponde a parole del nome
// (prima bastavano le prime lettere della prima parola: «una cosa buona» diventava «Coscia di pollo», «manda un messaggio» «Mandorle»)
const PAROLE_VUOTE_CIBO = /^(?:con|del|della|dello|dei|degli|delle|una|uno|per|alla|allo|alle|agli|nel|nella|sul|sulla|tipo|po|poco|qualche|circa)$/;
function credibile(r) {
  if (!r || !r.nome) return false;
  if (PREFERITI[norm(r.cercato || "")] === r.nome) return true;
  const parole = norm(r.cercato || "").split(/[\s']+/).filter(x => x.length >= 3 && !PAROLE_VUOTE_CIBO.test(x) && !/^\d/.test(x));
  if (!parole.length) return true;
  const nomeP = norm(r.nome).split(/[\s'()]+/).filter(Boolean);
  const tocca = (w) => { const sw = stem(w); return nomeP.some(n => n === w || (sw.length >= 4 && n.startsWith(sw)) || (n.length >= 4 && stem(n).length >= 3 && w.startsWith(stem(n)))); };
  const ok = parole.filter(tocca).length;
  return tocca(parole[0]) && ok >= Math.ceil(parole.length / 2);   // la prima parola (in italiano quella che conta: «spigola al forno») deve esserci
}
function righeDaParlato(testo) {
  let t = String(testo || "").toLowerCase().replace(/[’`]/g, "'").replace(/[.!?\n]+/g, ",").replace(/\b(?:e poi|poi|e dopo|dopo|e anche|inoltre)\b/g, ",").replace(RIEMPITIVI_PARLATO, " ").replace(/\bun paio di\b/g, "2").replace(/\bun (?:po'|pochino|pochettino) d(?:i\s*|')/g, "mezza porzione di ").replace(/\s+/g, " ");
  const intera = (x) => { const r = leggiRigaIngrediente(x); if (!r || !r.nome) return false; const a = norm(r.nome), b = norm(r.cercato); return a === b || a.includes(b) || PREFERITI[b] === r.nome; };
  // si divide su virgole, «e», «più», «con» (ma «pizza funghi e speck» o «pane con pomodoro», se sono un alimento solo, restano interi)
  const parti = t.split(/[,;+]/).map(s => s.trim()).filter(Boolean)
    .flatMap(x => /\s(e|ed|più|piu)\s/.test(x) && !intera(x) ? x.split(/\s(?:e|ed|più|piu)\s/) : [x])
    .flatMap(x => /\scon\s/.test(x) && !intera(x) ? x.split(/\scon\s+(?:(?:il|lo|la|le|gli|i|una|uno|un|della|dello|delle|del|dei|degli)\s+|l'|un'|dell')?/) : [x])
    .map(x => x.trim().replace(/^(?:e|ed|di|il|lo|la|le|gli|i)\s+/, "").replace(/^l'/, "").trim()).filter(x => x.length >= 2);
  return parti.map(p => {
    // «un etto di bresaola», «due bicchieri di latte», «un piatto di pasta al pomodoro»
    const m = p.match(new RegExp("^" + NUM_PAROLA_RE + "?\\s*([a-zà-ù]+)\\s+(?:di|d')\\s*(.+)$"));
    const mis = m && MISURE_PARLATO.find(([re]) => re.test(m[2]));
    if (mis) {
      const n = numParola(m[1]), r = leggiRigaIngrediente(m[3]);
      if (!credibile(r)) return { testo: p };
      if (mis[2] === "porz") return { r, qta: Math.round((porzioneSolita(r.nome) || 0) * n), testo: p };
      return { r, qta: Math.round(mis[1] * n), unita: "g", testo: p };
    }
    const r = leggiRigaIngrediente(p);
    if (!credibile(r)) return { testo: p };
    // «un'insalata», «una pasta al pomodoro»: un numero senza misura per un alimento che non si conta a pezzi = una porzione (non «1 g»)
    const nm = p.match(new RegExp("^" + NUM_PAROLA_RE + "\\s"));
    if ((r.unita === "g" || r.unita === "ml") && r.qta <= 10 && (nm || /^un'/.test(p))) return { r, qta: Math.round((porzioneSolita(r.nome) || 0) * (nm ? numParola(nm[1]) : 1)), testo: p };
    return { r, testo: p };
  });
}
// più alimenti o parole «parlate» nel campo: si legge come una frase
const sembraFrase = (v) => { v = String(v || "").trim(); return v.split(/\s+/).length >= 3 && /[,;.]|\s(?:e|ed|con|più|poi)\s|\b(?:ho|etto|etti|piatto|ciotola|manciata|bicchiere|tazza|inserisci|aggiungi|colazione|pranzo|cena|merenda|spuntino)\b/i.test(v); };
function aggiungiDaParlato(testo) {
  const c = liberoCtx, ignoti = [];
  righeDaParlato(testo).forEach(x => {
    if (!x.r) { ignoti.push(x.testo.replace(/^(?:un'|una|uno|un|le|la|lo|il|gli|i|l')\s*/, "").replace(/^(?:\d+|due|tre|quattro|cinque)\s+/, "")); return; }
    let qta, lock, unita;
    if (x.qta > 0) { qta = x.qta; lock = true; unita = x.unita; }
    else { ({ qta, lock } = qtaDaRiga(x.r)); unita = ["g", "ml"].includes(x.r.unita) ? "g" : ["pz", "cucchiaio", "cucchiaino"].includes(x.r.unita) ? x.r.unita : undefined; }
    aggiungiAlimento(c, x.r.nome, qta, lock, { cercato: x.r.cercato, unita });
  });
  c.ignoti = [...new Set([...(c.ignoti || []), ...ignoti])];   // quello che non conosco: una riga «❓», da cercare con un tocco
  ricalcolaLibero();
}
// il campo per dettare (si apre col pulsante sotto la ricerca) e le cose non riconosciute
function dettaHTML(c) {
  const ign = (c.ignoti || []).map((t, i) => `<div class="lib-ignota"><span>❓ <b>${esc(t)}</b><small>Non lo conosco</small></span><button class="btn-sec" data-lib="ignota-cerca" data-i="${i}">Cerca</button><button class="lib-del" data-lib="ignota-togli" data-i="${i}" aria-label="Togli">✕</button></div>`).join("");
  if (!c.detta) return ign;   // si detta con il tasto «Detta» della barra in basso: con il pasto aperto va in questo pasto
  return `${ign}<div class="lib-detta">
      <textarea id="lib-detta" class="qta-input" rows="3" autocomplete="off" autocapitalize="sentences" placeholder="es. due uova, una fetta di pane integrale e un caffè"></textarea>
      <p class="campo-nota">Tocca il 🎤 della tastiera e parla. Poi controlla le quantità e tocca ✓ Aggiungi.</p>
      <div class="barra-due"><button class="btn-sec" data-lib="detta-chiudi">Annulla</button><button class="btn" data-lib="detta-leggi">Metti nella lista</button></div></div>`;
}

// Una ricetta resta "la ricetta" finché ne mangi gli stessi ingredienti (anche in quantità diverse).
// Se ne cambi, aggiungi o togli, diventa un piatto di ingredienti singoli: la ricetta nel ricettario non cambia.
function ricettaModificata(c) {
  if (!c || !c.ricetta || typeof ricette === "undefined") return false;
  const r = ricette.find(x => x.nome === c.ricetta || x.nome === (window.ALIAS_RICETTE || {})[c.ricetta]);
  if (!r) return false;
  const base = new Set(((r._orig || r).ingredienti || []).filter(i => i.unita !== "q.b." && (window.ALIMENTI || {})[i.nome]).map(i => i.nome));
  const att = new Set(c.items.map(i => i.nome));
  if (base.size !== att.size) return true;
  for (const n of att) if (!base.has(n)) return true;
  return false;
}
// Ingredienti "principali" di una ricetta: le famiglie proteiche (pollame, uova, pesce…; le proteine in polvere sono sostituibili).
// Senza proteine: l'ingrediente nominato nel titolo (zucca). Cambi gli altri e la ricetta resta; cambi il principale con un'altra famiglia e non è più quella.
function principaliRicetta(r) {
  const A = window.ALIMENTI || {}, ingr = (r._orig || r).ingredienti || [];
  const out = new Set();
  ingr.forEach(i => {
    const f = famigliaProt(i.nome);
    if (f === "polvere") return;
    if (f) out.add("f:" + f);
    else if (A[i.nome] && A[i.nome][1] >= 8 && A[i.nome][2] < 30 && A[i.nome][3] <= 15 && A[i.nome][1] * grammiIng(i) / 100 >= 10) out.add("n:" + i.nome);   // fonte di proteine magra fuori famiglia (mozzarella light, ricotta proteica…): almeno 10 g nella ricetta; non farine, burri di frutta secca o formaggi grassi
  });
  if (out.size) return out;
  const t = norm(r.nome);
  // nessuna proteina: l'ingrediente del titolo, ma solo se è davvero la base del piatto (almeno 150 g: la zucca del brownie, non la banana dell'aroma)
  const titolo = ingr.filter(i => { const w = norm(i.nome).split(/\s+/)[0]; return w.length > 3 && t.includes(w); }).sort((x, y) => grammiIng(y) - grammiIng(x))[0];
  if (titolo && grammiIng(titolo) >= 150) out.add("n:" + titolo.nome);
  return out;
}
const ricettaDaNome = (nome) => typeof ricette === "undefined" || !nome ? null : ricette.find(x => x.nome === nome || x.nome === (window.ALIAS_RICETTE || {})[nome]) || null;
// vero se cambiare l'ingrediente k con "nuovo" farebbe perdere il principale della ricetta (pollo → manzo): i consigli non lo propongono
function scambioRompeRicetta(c, k, nuovo) {
  const r = c && c.ricetta && typeof k === "number" ? ricettaDaNome(c.ricetta) : null;
  return !!r && !ricettaMantenuta(r, c.items.map((x, i) => i === k ? { nome: nuovo } : x));
}
function ricettaMantenuta(r, items) {
  const att = new Set((items || []).flatMap(i => [famigliaProt(i.nome) ? "f:" + famigliaProt(i.nome) : null, "n:" + i.nome]).filter(Boolean));
  for (const p of principaliRicetta(r)) if (!att.has(p)) return false;
  return true;
}
// Una ricetta con ingredienti non principali cambiati resta "la ricetta", con lo stesso nome: «Brownie al microonde».
// Cambiato il principale (pollo → manzo) o ricetta sconosciuta: null → diventa un piatto di ingredienti singoli.
function nomeVariante(nomeRicetta, nomeBase, items) {
  if (typeof ricette === "undefined") return null;
  const r = ricettaDaNome(nomeRicetta);
  if (!r || !ricettaMantenuta(r, items)) return null;
  return String(nomeBase || nomeRicetta).replace(/^✍️\s*/, "").replace(/\s*\(con [^)]*\)\s*$/, "");
}
// ---- Nome del piatto quando cambi un ingrediente di una ricetta ----
// «Petto di pollo» nel nome del piatto è solo «pollo»: i tagli e le note (0%, (cotto)) non si scrivono
const TAGLI_NOME = /^(petto|petti|fesa|filetto|filetti|fettina|fettine|bocconcini|coscia|cosce|sovracoscia|sovracosce|macinato|trancio|tranci|lonza|polpa|carpaccio|straccetti)\s+(di\s+|d['’]\s*)/i;
const PAROLE_NON_NOME = new Set(["integrale", "integrali", "light", "scremato", "parzialmente", "intero", "magro", "magra", "fresco", "fresca", "cotto", "cotta", "crudo", "cruda", "secco", "secca", "proteico", "proteica", "greco", "bianco", "bianca", "naturale", "amaro", "polvere", "scatola", "surgelato", "surgelati"]);
function nomeCortoAlimento(nome) {
  return String(nome).replace(TAGLI_NOME, "").replace(/\s*\([^)]*\)/g, "").replace(/\s*\d+([.,]\d+)?\s*%/g, "").replace(/\s+(al naturale|sott['’]olio|in scatola|sgocciolat[oaie])$/i, "").trim();
}
// minuscole e senza accenti, stessa lunghezza del testo (così le posizioni valgono anche sul nome vero)
const normPos = (s) => String(s).normalize("NFC").toLowerCase().replace(/’/g, "'").split("").map(ch => ch.normalize("NFD").replace(/[̀-ͯ]/g, "") || ch).join("");
// dove compare l'alimento nel nome del piatto: prima il nome intero («salmone affumicato»), poi le sue parole importanti («pollo», «basmati»). null se non c'è
function ingredienteNelNome(nomePiatto, nomeAlimento) {
  const t = normPos(nomePiatto), corto = normPos(nomeCortoAlimento(nomeAlimento));
  const cerca = (w) => {
    const re = new RegExp(`(^|[^a-z0-9'])(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^a-z0-9])`);
    const m = re.exec(t);
    return m ? { i: m.index + m[1].length, n: w.length } : null;
  };
  const candidati = [corto, normPos(nomeAlimento), ...corto.split(/[\s']+/).filter(w => w.length > 3 && !PAROLE_NON_NOME.has(w)).sort((a, b) => b.length - a.length)];
  for (const w of candidati) { if (!w) continue; const r = cerca(w); if (r) return r; }
  return null;
}
// articolo della preposizione «a»/«di» giusto per il nuovo alimento: al/allo/alla/all'/ai/agli/alle
function generePerArticolo(parola) {
  const w = normPos(parola).split(/\s+/)[0] || "";
  const z = /^(s[^aeiou]|z|gn|ps|x|y)/.test(w), voc = /^[aeiouh]/.test(w);
  let g;
  if (w === "uova") g = "fp";
  else if (/a$/.test(w)) g = "fs";
  else if (/i$/.test(w)) g = "mp";
  else if (/e$/.test(w)) g = /(one|ale|ile|ore|ume|ce|me)$/.test(w) ? "ms" : "fp";
  else g = "ms";
  return { g, z, voc };
}
const ARTICOLI = {
  a:  { ms: "al", msz: "allo", fs: "alla", sv: "all'", mp: "ai", mpz: "agli", mpv: "agli", fp: "alle" },
  di: { ms: "del", msz: "dello", fs: "della", sv: "dell'", mp: "dei", mpz: "degli", mpv: "degli", fp: "delle" }
};
function articoloPer(base, parola) {
  const { g, z, voc } = generePerArticolo(parola), A = ARTICOLI[base];
  if ((g === "ms" || g === "fs") && voc) return A.sv;
  if (g === "ms") return z ? A.msz : A.ms;
  if (g === "mp") return voc ? A.mpv : z ? A.mpz : A.mp;
  return A[g];
}
// «Pollo con basmati» + (Petto di pollo → Coniglio) = «Coniglio con basmati»; «Pancake ai mirtilli» + (Mirtilli → Banana) = «Pancake alla banana».
// null se il vecchio alimento non compare nel nome
function nomeConSostituzione(nomePiatto, vecchio, nuovo) {
  const pos = ingredienteNelNome(nomePiatto, vecchio);
  if (!pos) return null;
  let nuovoTxt = nomeCortoAlimento(nuovo);
  nuovoTxt = /.[A-ZÀ-Ý]/.test(nuovoTxt) ? nuovoTxt : nuovoTxt.toLowerCase();   // le marche restano con la maiuscola
  let prima = nomePiatto.slice(0, pos.i);
  const dopo = nomePiatto.slice(pos.i + pos.n);
  // preposizione articolata subito prima: si adatta al nuovo alimento
  const mArt = /(^|\s)(al|allo|alla|ai|agli|alle|del|dello|della|dei|degli|delle)\s+$/i.exec(prima) || /(^|\s)(all|dell)'$/i.exec(prima);
  if (mArt) {
    const base = /^a/i.test(mArt[2]) ? "a" : "di", art = articoloPer(base, nuovoTxt);
    prima = prima.slice(0, mArt.index + mArt[1].length) + art + (art.endsWith("'") ? "" : " ");
  }
  if (!prima.trim()) nuovoTxt = nuovoTxt.charAt(0).toUpperCase() + nuovoTxt.slice(1);
  return prima + nuovoTxt + dopo;
}
// I cambi "Più fit" accettati restano nella ricetta: dalle prossime volte è già la versione più leggera. Una tua versione sostituisce quella di base.
function aggiornaRicettaDaFit(nome, mods) {
  const stesse = ricette.filter(x => x.nome === nome);
  if (!stesse.length) return null;
  const r = stesse[0]._orig || stesse[0];
  const pasti = new Set(stesse.map(x => x.pasto));
  const ingr = clone(r.ingredienti).map(i => { if (i.base) { Object.assign(i, i.base); delete i.base; } return i; });   // la ricetta com'è, non la variante scelta
  let cambiato = 0;
  mods.forEach(m => {
    const [tipo, a, b, c] = m.split("|"), k = ingr.findIndex(i => i.nome === a);
    if (k < 0) return;
    if (tipo === "cambia") { const x = ingredienteCon(ingr[k], b); delete x.base; delete x.alt; ingr[k] = x; cambiato++; }
    else if (tipo === "porta" && +c > 0) { ingr[k].qta = Math.max(0.5, Math.round(ingr[k].qta * (+b / +c) * 2) / 2); cambiato++; }
  });
  if (!cambiato) return null;
  const m = calcolaMacro({ ingredienti: ingr, porzioni: r.porzioni });
  const base = { nome: r.nome, tempo: r.tempo || null, custom: true, kcal: m.kcal, proteine: m.proteine, carboidrati: m.carboidrati, grassi: m.grassi, ingredienti: ingr, passaggi: (r.passaggi || []).slice() };
  if (aPezzi(r)) { base.porzioni = r.porzioni; base.pezzo = r.pezzo || ""; }
  const primaC = JSON.stringify(leggiCustom()), primaN = JSON.stringify([...leggiNascoste()]);
  const custom = leggiCustom().filter(x => x.nome !== nome);
  [...pasti].forEach(p => custom.push(Object.assign({}, base, { pasto: p, ingredienti: clone(ingr), passaggi: base.passaggi.slice() })));
  salvaCustom(custom); caricaRicette();
  return () => { localStorage.setItem("mp_ricette_custom", primaC); localStorage.setItem("mp_ricette_nascoste", primaN); caricaRicette(); };
}
// Toccando un consiglio furbo il pasto si salva subito e il foglio resta aperto sul pasto salvato (niente secondo "✓ Aggiungi")

// -------- Eventi --------
document.addEventListener("DOMContentLoaded", () => {
  const mc = document.getElementById("modal-content");
  mc.addEventListener("click", (e) => {
    if (!liberoCtx) return;
    const c = liberoCtx;
    const b = e.target.closest("[data-lib]");
    if (b) {
      const a = b.dataset.lib;
      if (a === "aggiungi") { const inp = document.getElementById("lib-input"); aggiungiDaTesto(inp.value); c.addAperto = false; rirenderLibero(); rifocusInput(); }
      else if (a === "detta-apri") { c.detta = true; rirenderLibero(); const t = document.getElementById("lib-detta"); if (t) t.focus(); }
      else if (a === "detta-chiudi") { c.detta = false; rirenderLibero(); }
      else if (a === "detta-leggi") {
        const t = document.getElementById("lib-detta"), v = String((t && t.value) || "").trim();
        if (!v) { avviso("Scrivi o detta cosa hai mangiato"); return; }
        aggiungiDaParlato(v); c.detta = false; rirenderLibero();
      }
      else if (a === "ignota-cerca") { const i = +b.dataset.i, t = (c.ignoti || [])[i]; c.ignoti.splice(i, 1); c.ignoto = t; c._ignotaTorna = t; rirenderLibero(); }   // la pagina «Non trovo…»: ricette simili, cerca online, crea l'alimento
      else if (a === "ignota-togli") { (c.ignoti || []).splice(+b.dataset.i, 1); rirenderLibero(); }
      else if (a === "mostra-add") { c.addAperto = true; rirenderLibero(); const i2 = document.getElementById("lib-input"); if (i2) i2.focus(); }
      else if (a === "annulla-modifiche") {   // il pasto torna com'era (con le aggiunte confermate)
        if (c._giorno0 !== undefined) tornaAllaFoto(c);
        closeModal(true); if (typeof renderOggi === "function") renderOggi(); avviso("Modifiche annullate");
      }
      else if (a === "salva-modifiche") { if (typeof vibra === "function") vibra(); if (typeof fotoPasto === "function") fotoPasto(c); closeModal(true); avviso("✓ Modifiche salvate"); }
      else if (a === "annulla-nuovi") { c.items = c.items.filter(x => !x.nuovo); c.piattiNuovi = []; c.ignoti = []; ricalcolaLibero(); rirenderLibero(); }   // via quello scelto e non aggiunto
      else if (a === "aggiungi-nuovi") { if (typeof vibra === "function") vibra(); confermaNuovi(c); avviso("✓ Aggiunto"); document.getElementById("toast")?.classList.add("ok"); }
      else if (a === "conferma-bozza") { c._conferma = true; c.bozza = false; try { rirenderLibero(); } finally { c._conferma = false; } if (liberoCtx === c) rirenderLibero(); avviso("✓ Pasto salvato"); document.getElementById("toast")?.classList.add("ok"); }   // ora il pasto è nel diario: si vede il riepilogo
      else if (a === "al-modifica") { c.modificaAl = b.dataset.nome; c.ignotoNuovo = true; c.ignoto = null; c.ignotoCodice = null; rirenderLibero(); }
      else if (a === "ignoto-annulla") { if (c._ignotaTorna && c.ignoto === c._ignotaTorna) c.ignoti = [c._ignotaTorna, ...(c.ignoti || [])]; c._ignotaTorna = null;   // tornando al pasto senza sceglierlo, resta nella lista dei «❓»
        c.modificaAl = null; c.ignotoNuovo = false; c.ignoto = null; c.ignotoCodice = null; c.ricercaOFF = null; rirenderLibero(); }
      else if (a === "ignoto-salva") {
        let et = leggiCampiEtichetta("etic-libero");
        if (et && et.errore) { avviso(et.errore); return; }
        if (!et || !et.base4[0]) { avviso("Inserisci almeno le kcal."); return; }
        let nome = ((document.getElementById("ignoto-nome") || {}).value || c.ignoto || "").trim();
        if (!nome) { avviso("Scrivi il nome dell'alimento."); return; }
        nome = nome.charAt(0).toUpperCase() + nome.slice(1);
        if (!verificaEtichetta("etic-libero", b, et)) return;   // numeri che non tornano: avviso e «Salva comunque»
        const modifica = !!c.modificaAl;
        if (modifica && typeof conservaValoriAlimento === "function") et = conservaValoriAlimento("etic-libero", c.modificaAl, et);   // i campi non toccati (e gli zuccheri aggiunti) restano come erano salvati
        salvaAlimentoPersonale(nome, et.base4, et.extra4, et.pesoPz, modifica);
        if (modifica && typeof ricalcolaPastiCon === "function") ricalcolaPastiCon(nome);   // i pasti già registrati con questo alimento si ricalcolano
        if (c.ignotoCodice && typeof salvaCodice === "function") salvaCodice(c.ignotoCodice, nome);
        c.ignotoNuovo = false; c.ignoto = null; c.ignotoCodice = null; c.ricercaOFF = null; c.modificaAl = null;
        if (!modifica) c.items.push(et.pesoPz ? { nome, cercato: nome, qta: et.pesoPz, lock: true, unita: "pz" } : { nome, qta: 0, lock: false });   // a pezzi: ne metti 1 subito
        ricalcolaLibero(); rirenderLibero();
      }
      return;
    }
    const lock = e.target.closest("[data-lib-lock]");
    if (lock) { const it = c.items[+lock.dataset.libLock]; it.lock = !it.lock; ricalcolaLibero(); rirenderLibero(); return; }
    if (e.target.closest("[data-lib-sblocca]")) {
      const dataP = c.data, pastoP = c.pasto;
      chiediConferma("Sbloccare il pasto?", "Potrai togliere ciò che hai mangiato", "Sblocca", () => { pastiSbloccati.add(dataP + "|" + pastoP); apriPastoDiario(dataP, null, pastoP); }, () => apriPastoDiario(dataP, null, pastoP));
      return;
    }
    if (e.target.closest("[data-ant-chiudi]")) { c.anteprima = null; c.fitApplicato = null; c.confermaFit = false; c.antQta = null; c.antK = null; c.antUni = null; rirenderLibero(); return; }
    if (e.target.closest("[data-ant-fit]")) { c.confermaFit = true; rirenderLibero(); return; }
    if (e.target.closest("[data-ant-fit-no]")) { c.confermaFit = false; rirenderLibero(); return; }
    const fitSi = e.target.closest("[data-ant-fit-si]"); if (fitSi) { applicaPiuFit(c, fitSi.dataset.antFitSi); return; }
    if (e.target.closest("[data-ant-misura]") && c.anteprima) {   // porta alla porzione su misura per le kcal che restano
      const a = anteprimaRicetta(c, c.anteprima); if (a) { c.antK = a.ps.kMisura; c.antQta = {}; c.fitApplicato = null; rirenderLibero(); }
      return;
    }
    const antPz = e.target.closest("[data-ant-pz]");   // porzioni − / ＋ nell'anteprima
    if (antPz && c.anteprima) {
      const r = ricette.find(x => x.nome === c.anteprima), a = anteprimaRicetta(c, c.anteprima);
      if (r && r._orig && a) { c.antK = prossimoPasso(a.ps.k, +antPz.dataset.antPz, passoPezzi(r._orig)); c.antQta = {}; c.fitApplicato = null; rirenderLibero(); }
      return;
    }
    const antSt = e.target.closest("[data-ant-step]");   // − / ＋ sulla quantità
    if (antSt && c.anteprima) {
      const [k, d] = antSt.dataset.antStep.split("|").map(Number), a = anteprimaRicetta(c, c.anteprima); if (!a) return;
      const cur = anteprimaItemsModificati(c, a)[k]; if (!cur) return;
      (c.antQta = c.antQta || {})[k] = qtaDopoStep(cur.nome, +cur.qta, cur.u, d); rirenderLibero(); return;
    }
    const antDel = e.target.closest("[data-ant-del]");   // cestino: l'ingrediente non entra nel pasto
    if (antDel && c.anteprima) { (c.antQta = c.antQta || {})[+antDel.dataset.antDel] = 0; rirenderLibero(); return; }
    const antA = e.target.closest("[data-ant-aggiungi]"); if (antA) { aggiungiDaAnteprima(c); return; }
    const sost = e.target.closest("[data-lib-sostituisci]");
    if (sost) { sostituisciPastoCon(c, sost.dataset.libSostituisci); return; }
    if (e.target.closest("[data-altre-idee]")) { c.altreGiro = (c.altreGiro || 0) + 1; rirenderLibero(); return; }
    if (e.target.closest("[data-lib-riblocca]")) { pastiSbloccati.delete(c.data + "|" + c.pasto); rirenderLibero(); return; }
    const ub = e.target.closest("[data-lib-unita-set]");
    if (ub) { const [kk, uu] = ub.dataset.libUnitaSet.split("|"), it = c.items[+kk]; if (it) { it.unita = uu; salvaUnitaPreferita(it.nome, uu); rirenderLibero(); } return; }   // pz ⇄ g: la quantità resta, cambia come la leggi
    const st = e.target.closest("[data-lib-step]");
    if (st) {
      const it = c.items[+st.dataset.libStep], d = +st.dataset.d, { gu, passo } = passoQuantita(it);
      if (gu && !it.unita) it.unita = unitaDi(it);   // l'unità che vedi resta quella mentre la cambi (niente salti da pezzi a grammi)
      const att = gu ? it.qta / gu : it.qta;
      const nuovo = gu ? prossimoMultiplo(att, d, passo) : grammiDopoStep(it.nome, att, d, 1);   // grammi: di 10 in 10; olio, frutta secca… di 1 in 1
      it.qta = gu ? Math.round(nuovo * gu * 10) / 10 : nuovo; it.lock = true; // un decimale: 11 mandorle restano 11, non 10,8
      ricalcolaLibero(); rirenderLibero(); return;
    }
    if (e.target.closest("[data-lib-indietro]")) { vaiStoria("indietro"); return; }
    if (e.target.closest("[data-lib-avanti]")) { vaiStoria("avanti"); return; }
    const npz = e.target.closest("[data-nuovo-pz]");   // porzioni di un piatto da aggiungere
    if (npz) { const [j, d] = npz.dataset.nuovoPz.split("|").map(Number); if (c.piattiNuovi && c.piattiNuovi[j] && cambiaPorzioniPiatto(c.piattiNuovi[j], d)) rirenderLibero(); return; }
    const ndel = e.target.closest("[data-nuovo-del]");
    if (ndel) { if (c.piattiNuovi) c.piattiNuovi.splice(+ndel.dataset.nuovoDel, 1); rirenderLibero(); return; }
    const del = e.target.closest("[data-lib-del]");
    if (del && liberoCtx && liberoCtx.vivo) {   // cestino: un alimento da aggiungere sparisce e basta; uno già nel pasto è una modifica (Annulla / ✓ Salva)
      c.items.splice(+del.dataset.libDel, 1); ricalcolaLibero(); rirenderLibero(); return;
    }
    if (del) {
      const k = +del.dataset.libDel, tolto = c.items[k], eraBozza = !!c.bozza;
      const primaPasti = c.vivo && !eraBozza ? clone(giornoDiario(c.data).pasti.filter(p => p.pasto === c.pasto)) : [];   // com'era il pasto nel diario, per l'Annulla
      c.items.splice(k, 1); ricalcolaLibero(); rirenderLibero();
      if (c.vivo && tolto && typeof mostraToast === "function") mostraToast(`Tolto: ${String(tolto.nome).toLowerCase()}`, "Annulla", () => {   // salvataggio immediato: togliere per sbaglio si rimedia con un tocco
        if (eraBozza && liberoCtx === c) { c.items.splice(Math.min(k, c.items.length), 0, tolto); rirenderLibero(); return; }   // era ancora una bozza: torna nella bozza
        // pasto salvato (o pannello già chiuso): si rimette nel diario, così l'Annulla non lo lascia come bozza da perdere
        rimettiNelDiario(c, tolto, primaPasti);
        if (liberoCtx === c) ricaricaViva(c);
      });
      return;
    }
    const sa = e.target.closest("[data-sost-altri]");
    if (sa && liberoCtx) { liberoCtx.sostGiro = (liberoCtx.sostGiro || 0) + 1; const campo = document.querySelector(".lib-nome-in"); if (campo) { mostraSostituzioni(campo); campo.focus(); } return; }   // ↻ altri tre sostituti
    const avt = e.target.closest("[data-lib-avvt]");
    if (avt) { const k = +avt.dataset.libAvvt; c.tonnoAperto = c.tonnoAperto === k ? null : k; rirenderLibero(); return; }
    const av = e.target.closest("[data-lib-avv]");
    if (av) { const k = +av.dataset.libAvv; c.avvAperto = c.avvAperto === k ? null : k; rirenderLibero(); return; }
    if (e.target.closest("[data-furbo-altro]")) { c.furbiGiro = (c.furbiGiro || 0) + 1; rirenderLibero(); return; }   // ↻ un'altra idea
    const pr = e.target.closest("[data-lib-preset]");
    if (pr) { const [k, g] = pr.dataset.libPreset.split("|").map(Number); if (c.items[k]) { c.items[k].qta = g; c.items[k].lock = true; c.ultimoAgg = c.items[k].nome; ricalcolaLibero(); rirenderLibero(); } return; }   // pulsante rapido: quella quantità, fissa
    const sq = e.target.closest("[data-lib-setq]");
    if (sq) { const [k, g] = sq.dataset.libSetq.split("|").map(Number); if (c.items[k]) { c.items[k].qta = g; c.items[k].lock = true; ricalcolaLibero(); rirenderLibero(); } return; }   // consiglio furbo: porta la quantità a quella proposta
    const add = e.target.closest("[data-lib-add]");   // anche un consiglio furbo va in «Da aggiungere», con la sua quantità già scritta
    if (add && add.closest("#lib-autoc") && c.items.some(x => x.grp == null && x.nome === add.dataset.libAdd)) { chiediDoppioneQui(c, add, add.dataset.libAdd, +add.dataset.libG); return; }   // recente già nel pasto: la domanda subito
    if (add) { const dalCampo = !!add.closest("#lib-autoc"); aggiungiAlimento(c, add.dataset.libAdd, +add.dataset.libG, add.dataset.libFisso === "1"); ricalcolaLibero(); rirenderLibero(); if (dalCampo) rifocusInput(); return; }
    const dp = e.target.closest("[data-lib-doppio]");
    if (dp) {   // risposta al «c'è già»: somma alla riga presente, oppure niente
      const d = c.doppione, gia = d && c.items.find(x => x.grp == null && x.nome === d.nome);
      c.doppione = null;
      if (dp.dataset.libDoppio === "si" && gia) {
        const prima = +gia.qta || 0;
        gia.qta = Math.round((prima + d.qta) * 10) / 10; gia.lock = true; c.ultimoAgg = gia.nome;
        avviso(`${gia.nome}: ${doseLeggibile(gia.nome, prima)} → ${doseLeggibile(gia.nome, gia.qta)}`);
        ricalcolaLibero();
      }
      if (dp.dataset.libDoppio === "si" && gia && !gia.nuovo && c.vivo && typeof cibiNellaFoto === "function") cibiNellaFoto(c, [gia], true);   // «Sì, somma» a uno già nel pasto è un'aggiunta: confermata, non una modifica da salvare
      rirenderLibero(); return;
    }   // il consiglio furbo mette proprio la quantità proposta
  });
  mc.addEventListener("change", (e) => {
    if (!liberoCtx) return;
    const c = liberoCtx;
    const au = e.target.closest && e.target.closest("[data-ant-unita]");   // unità dell'anteprima: g ⇄ pz…, la quantità resta la stessa
    if (au && c.anteprima) { const k = +au.dataset.antUnita, a = anteprimaRicetta(c, c.anteprima), cur = a && anteprimaItemsModificati(c, a)[k]; if (cur) { (c.antUni = c.antUni || {})[k] = au.value; salvaUnitaPreferita(cur.nome, au.value); (c.antQta = c.antQta || {})[k] = qtaPezziInteri(cur.nome, au.value, +cur.qta); dopoMenu(au, () => rirenderLibero()); } return; }
    const q = e.target.closest("[data-lib-qta]");
    if (q) {
      const it = c.items[+q.dataset.libQta];
      const v = leggiNumero(q.value);
      const pz = +q.dataset.pz || 0;
      if (!isNaN(v) && v === 0) { const cestino = document.querySelector(`[data-lib-del="${+q.dataset.libQta}"]`); if (cestino) { cestino.click(); return; } }   // 0 = lo tolgo: come il cestino, con Annulla
      if (!isNaN(v) && v >= 0) { if (!it.unita) it.unita = unitaDi(it); it.qta = Math.round(pz ? v * pz : v); it.lock = true; }   // scritto in pezzi: resta in pezzi
      ricalcolaLibero(); rirenderLibero(); return;
    }
    const us = e.target.closest("[data-lib-unita-sel]");
    if (us) {
      const it = c.items[+us.dataset.libUnitaSel]; it.unita = us.value; salvaUnitaPreferita(it.nome, us.value);
      const pz = (window.PESO_PZ || {})[it.nome];
      if (us.value === "pz" && pz && +it.qta > 0) { it.qta = Math.max(0.5, Math.round(it.qta / pz * 2) / 2) * pz; it.lock = true; ricalcolaLibero(); }   // in pezzi: interi o mezzi (3,4 pz → 3,5)
      dopoMenu(us, () => rirenderLibero()); return;
    }
    const alt = e.target.closest("[data-lib-alt]");
    if (alt) { const it = c.items[+alt.dataset.libAlt]; it.nome = alt.value; if (!it.lock) it.qta = 0; ricalcolaLibero(); dopoMenu(alt, () => rirenderLibero()); }
  });
  // Su iPhone il menu a tendina si sta ancora chiudendo quando arriva la scelta: ridisegnare il pannello in quell'istante
  // (il menu sparisce da sotto il dito) può far ricaricare la pagina. Prima si chiude il menu, poi si ridisegna.
  function dopoMenu(sel, fn) {
    const cc = liberoCtx;
    try { sel.blur(); } catch (e) {}
    setTimeout(() => { if (liberoCtx === cc) fn(); }, 120);
  }
  mc.addEventListener("focusin", (e) => { if (liberoCtx && e.target.dataset && e.target.dataset.libNome !== undefined) { const t = e.target; setTimeout(() => t.select(), 0); } });
  mc.addEventListener("focusout", (e) => { // se esci dal campo senza scegliere, torna il nome di prima
    const t = e.target;
    if (!liberoCtx || !t.dataset || t.dataset.libNome === undefined) return;
    setTimeout(() => {
      const it = liberoCtx && liberoCtx.items[+t.dataset.libNome];
      if (it && t.isConnected && document.activeElement !== t) { nomeComeTesto(t, it); const b = document.getElementById("lib-sost"); if (b) b.remove(); }
    }, 350);
  });
  // i mangiati di recente si aprono solo quando TU tocchi la barra di ricerca (non dopo ogni aggiunta, quando il campo resta attivo da solo)
  mc.addEventListener("click", (e) => {
    if (!liberoCtx || e.target.id !== "lib-input" || e.target.value.trim()) return;
    mostraAutocompleta("");
    // la lista appare sotto il dito mentre il pannello si allunga: per un attimo non prende tocchi (niente aggiunte per sbaglio)
    const box = document.getElementById("lib-autoc");
    if (box) { box.style.pointerEvents = "none"; setTimeout(() => { box.style.pointerEvents = ""; }, 450); }
  });
  // toccando un recente o un suggerimento il campo resta attivo (la tastiera non si chiude e l'elenco non sparisce sotto il dito)
  mc.addEventListener("mousedown", (e) => { if (e.target.closest && e.target.closest("#lib-autoc") && document.activeElement && document.activeElement.id === "lib-input") e.preventDefault(); });
  mc.addEventListener("focusout", (e) => {   // uscendo dal campo vuoto i recenti si richiudono
    if (e.target.id !== "lib-input") return;
    setTimeout(() => { const inp = document.getElementById("lib-input"), box = document.getElementById("lib-autoc"); if (box && inp && document.activeElement !== inp && !inp.value.trim() && !(liberoCtx && liberoCtx.doppione)) box.innerHTML = ""; }, 250);
  });
  mc.addEventListener("input", (e) => {
    if (!liberoCtx) return;
    if (e.target.dataset && e.target.dataset.libNome !== undefined) { mostraSostituzioni(e.target); return; }
    if (e.target.id === "lib-nome") liberoCtx.nome = e.target.value;
    if (e.target.id === "lib-input") mostraAutocompleta(e.target.value);
    const aq = e.target.closest && e.target.closest("[data-ant-qta]");   // quantità nell'anteprima della ricetta: il totale si aggiorna mentre scrivi
    if (aq && liberoCtx.anteprima) {
      const c = liberoCtx, a = anteprimaRicetta(c, c.anteprima); if (!a) return;
      const vq = leggiNumero(aq.value), pzq = +aq.dataset.pz || 0;   // accetta anche la virgola (7,5); in pezzi/cucchiai si converte in grammi
      (c.antQta = c.antQta || {})[+aq.dataset.antQta] = Math.max(0, isNaN(vq) ? 0 : Math.round((pzq ? vq * pzq : vq) * 10) / 10);
      const box = document.querySelector(".ant-tot"); if (box) { const tq = macroDa(anteprimaItemsModificati(c, a)); box.innerHTML = macroHaObiettivoHTML(sommaConPasto(c, tq), c.target()) + sopraGiornoHTML(c.data, tq.kcal); }
    }
  });
  mc.addEventListener("click", (e) => {
    const ft = e.target.closest("[data-fit]");
    if (ft && liberoCtx && liberoCtx.ricetta) (liberoCtx.modFit = liberoCtx.modFit || []).push(ft.dataset.fit);   // un cambio "Più fit" accettato su una ricetta: si ricorda per aggiornare la ricetta al salvataggio
    const ne = e.target.closest("[data-lib-nome-edit]");
    if (ne && liberoCtx && liberoCtx.items[+ne.dataset.libNomeEdit]) { nomeComeCampo(ne, liberoCtx.items[+ne.dataset.libNomeEdit]); return; }
    const sc = e.target.closest("[data-sost-scegli]");
    if (sc && liberoCtx) {
      const cc = liberoCtx, prima = null;   // uno scambio in un pasto è una modifica: si annulla con «Annulla» della barra (o non si salva)
      sostituisciIngrediente(+sc.dataset.sostScegli, sc.dataset.nome, +sc.dataset.g || 0);
      if (prima && typeof mostraToast === "function") mostraToast("Cambiato", "Annulla", () => { if (liberoCtx !== cc) return; cc.items = prima; ricalcolaLibero(); rirenderLibero(); });
      return;
    }
    const ar = e.target.closest("[data-autoc-ricetta], [data-ignoto-ricetta]");
    if (ar && liberoCtx && liberoCtx.vivo) {   // la ricetta si apre prima in anteprima: scegli quante porzioni e le quantità, poi «Aggiungi» la mette nel pasto
      const cc = liberoCtx, inp = document.getElementById("lib-input");
      if (inp) { inp.value = ""; inp.blur(); }
      cc.anteprima = ar.dataset.autocRicetta || ar.dataset.ignotoRicetta; cc.fitApplicato = null; cc.antQta = {}; cc.antK = null; cc.antUni = null;
      rirenderLibero(); const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = 0; return;
    }
    if (ar && liberoCtx && typeof usaRicettaNellEditor === "function") { usaRicettaNellEditor(ar.dataset.autocRicetta || ar.dataset.ignotoRicetta); return; }
    const av = e.target.closest("[data-autoc]");
    if (av && liberoCtx) {
      const inp = document.getElementById("lib-input");
      const parti = String(inp ? inp.value : "").split(/[,;+]/);
      const ultima = parti.pop();
      const lead = (ultima.match(AUTOC_LEAD) || [""])[0];
      const nome = av.dataset.autoc, r = leggiRigaIngrediente(lead + nome);
      if (!parti.length && r && r.nome === nome && liberoCtx.items.some(x => x.grp == null && x.nome === nome)) {   // già nel pasto: la domanda subito, al posto della lista
        const q = qtaDaRiga(r).qta || (window.PESO_PZ || {})[nome] || porzioneSolita(nome);
        if (q) { if (inp) inp.value = ""; chiediDoppioneQui(liberoCtx, av, nome, q); return; }
      }
      aggiungiDaTesto([...parti, lead + av.dataset.autoc].join(", ")); rirenderLibero(); rifocusInput();
    }
  });
  mc.addEventListener("keydown", (e) => {
    if (liberoCtx && e.key === "Enter" && e.target.dataset && e.target.dataset.libNome !== undefined) { // Invio = il primo suggerimento
      e.preventDefault(); const p = document.querySelector("#lib-sost [data-sost-scegli]"); if (p) sostituisciIngrediente(+p.dataset.sostScegli, p.dataset.nome); else e.target.blur(); return;
    }
    if (liberoCtx && e.key === "Enter" && e.target.id === "lib-input") {
      e.preventDefault();
      // una frase intera (scritta o dettata con il 🎤 della tastiera: «un piatto di pasta e un'insalata») la legge il lettore del parlato
      if (sembraFrase(e.target.value)) aggiungiDaParlato(pastoDaFrase(e.target.value).resto || e.target.value); else aggiungiDaTesto(e.target.value);
      liberoCtx.addAperto = false; rirenderLibero(); rifocusInput(); // il campo resta pronto per il prossimo alimento
    }
  });
  // chiudendo il modale si esce dal pasto libero
  // (la chiusura del pasto la gestisce closeModal: se c'è qualcosa da salvare, prima chiede)
});

// =============================================================
//  «🎤 Detta» (barra in basso): «a colazione 150 g di yogurt greco e un cappuccino»
//  Tocca 🎤 e parla, poi ✓ Fatto: si apre il pasto con gli alimenti da confermare.
//  Dove il telefono non lo permette si apre un campo: lì si usa il 🎤 della tastiera.
// =============================================================
// il pasto detto nella frase (e la frase senza quelle parole); null se non c'è
// I pasti come si dicono a voce (le stesse regole per tutti i comandi):
// «merenda», «spuntino di/del pomeriggio», «spuntino pomeridiano», «pre-workout» → la merenda · «spuntino di metà mattina», «spuntino mattutino» → lo spuntino della mattina
// «dopo cena», «spuntino serale», «spuntino di sera» → quello dopo cena · «spuntino» da solo → quello che hai (se ne hai uno solo), altrimenti quello del momento
const FINE_P = "(?![a-zà-ù])";
function regolePasti(data) {
  const sera = typeof nomeSera === "function" ? norm(nomeSera()) : "", momenti = typeof momentiGiorno === "function" ? momentiGiorno(data) : ORDINE_TEMPO;
  const pre = (art) => `\\b(?:(?:${art})\\s+)?`;
  const r = [
    ["sera", new RegExp(pre("a|per|il|lo|nel|nello|come") + "(?:dopo\\s*cena|dopocena|spuntino\\s+(?:serale|notturno|(?:di|della|la)\\s+(?:sera|notte)|(?:di\\s+)?dopo\\s*cena))" + FINE_P, "g")],
    ["spuntino", new RegExp(pre("a|per|la|lo|nella|nello|alla|allo|il|nel|al|come") + "(?:merenda|pre[- ]?workout|prima dell'allenamento|spuntino\\s+(?:(?:di|del|nel|al|a|il|nel)\\s+)?(?:pomeriggio|pomeridiano)|spuntino\\s+(?:delle|alle)\\s+(?:1[4-8]|quattro|cinque|sei)|spuntino\\s+pre[- ]?(?:workout|allenamento))" + FINE_P, "g")],
    ["mattina", new RegExp(pre("a|per|lo|nello|allo|come") + "spuntino\\s+(?:(?:di|della|a|del|delle)\\s+)?(?:metà\\s+|meta\\s+)?(?:mattin[ao]|mattutino|mattinata|(?:delle|alle)\\s+(?:9|10|11|dieci|undici))" + FINE_P, "g")],
    ["colazione", new RegExp(pre("a|per|la|nella|alla") + "colazione" + FINE_P, "g")],
    ["pranzo", new RegExp(pre("a|per|il|nel|al") + "pranzo" + FINE_P, "g")],
    ["cena", new RegExp(pre("a|per|la|nella|alla") + "cena" + FINE_P, "g")],
    ["?spuntino", new RegExp(pre("a|per|lo|nello|allo|come|uno") + "spuntino" + FINE_P, "g")],
  ];
  if (sera && sera.length >= 4 && momenti.includes("sera")) r.unshift(["sera", new RegExp(pre("a|per|nel|nella|nello") + sera.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + FINE_P, "g")]);
  return r;
}
// «spuntino» senza dire quale: se ne hai uno solo è quello; altrimenti (oggi) dopo pranzo è la merenda, dopo cena quello serale
function spuntinoGenerico(data) {
  const m = typeof momentiGiorno === "function" ? momentiGiorno(data) : ORDINE_TEMPO, haM = m.includes("mattina"), haP = m.includes("spuntino");
  if (haM && !haP) return "mattina";
  if (haP && !haM) return "spuntino";
  if (data === oggiISO() && typeof orariPasti === "function") {
    const o = orariPasti(), d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    if (m.includes("sera") && typeof o.cena === "number" && h >= o.cena + 0.5) return "sera";
    if (typeof o.pranzo === "number" && h >= o.pranzo) return "spuntino";
  }
  return "mattina";
}
// tutti i pasti nominati nella frase, in ordine: [{ i: posizione, l: lunghezza, p: pasto }]
function trovaPasti(t, data) {
  const out = [], presi = [], momenti = typeof momentiGiorno === "function" ? momentiGiorno(data) : ORDINE_TEMPO;
  regolePasti(data).forEach(([p, re]) => {
    re.lastIndex = 0; let m;
    while ((m = re.exec(t))) {
      const a = m.index, b = a + m[0].length;
      if (presi.some(([x, y]) => a < y && b > x)) continue;
      const pp = p === "?spuntino" ? spuntinoGenerico(data) : p;
      if (pp === "sera" && !momenti.includes("sera")) continue;
      const art = (m[0].match(/^\s*(a|per|il|lo|la|nel|nello|nella|alla|allo|al|come|uno)\s+/) || [])[1] || "";   // l'articolo detto prima del pasto («a pranzo», «il pranzo»)
      presi.push([a, b]); out.push({ i: a, l: m[0].length, p: pp, art });
    }
  });
  return out.sort((x, y) => x.i - y.i);
}
// il pasto detto nella frase (e la frase senza quelle parole); null se non c'è
function pastoDaFrase(testo, data) {
  const t = " " + String(testo || "").toLowerCase().replace(/[’`]/g, "'") + " ";
  const p = trovaPasti(t, data || dataDetta())[0];
  if (!p) return { pasto: null, resto: t.trim() };
  return { pasto: p.p, resto: (t.slice(0, p.i) + " " + t.slice(p.i + p.l)).replace(/\s+/g, " ").trim() };
}
// il giorno su cui si detta: quello aperto in Oggi, altrimenti oggi
// (se il giorno l'ha cambiato un comando a voce, es. «copia il pranzo anche domani», le frasi dopo senza giorno tornano a oggi: il giorno aperto conta solo se ci sei andata tu)
let _dataDaVoce = null;
function dataDetta() {
  if (typeof allineaOggi === "function") allineaOggi();   // passata la mezzanotte: «oggi» è il giorno nuovo
  return document.body.dataset.tab === "oggi" && typeof dataDiario !== "undefined" && dataDiario !== _dataDaVoce ? dataDiario : oggiISO();
}

// ---------- Comandi a voce ----------
// 1) un altro giorno: «domani a pranzo riso basmati e tonno» → il pranzo di domani con gli alimenti da confermare (quantità adatte ai tuoi obiettivi)
// 2) copia un pasto: «rifai il pranzo di ieri anche oggi», «copia la cena di lunedì su giovedì» → il pasto di destinazione con i piatti da confermare
// 3) spesa: «aggiungi albumi alla spesa», «mi manca il pollo», «ho finito lo yogurt» → le voci da confermare, poi vanno nella lista
// Ogni comando mostra prima cosa farà: niente si salva senza il tuo tocco.
const GIORNI_DETTA = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"];
// i giorni nominati nella frase, in ordine: { i: posizione, l: lunghezza, rel: giorni da oggi | wd: giorno della settimana (0 = lunedì), mod: "prossimo" / "scorso" }
function giorniNellaFrase(t) {
  const out = [], preso = [];
  const libero = (i, l) => !preso.some(([a, b]) => i < b && i + l > a);
  const prova = (re, f) => { re.lastIndex = 0; let m; while ((m = re.exec(t))) { if (libero(m.index, m[0].length)) { preso.push([m.index, m.index + m[0].length]); out.push(Object.assign({ i: m.index, l: m[0].length }, f(m))); } } };
  prova(/\b(?:l'\s*altro\s*ieri|l'altroieri|altroieri|altro\s+ieri)\b/g, () => ({ rel: -2 }));
  prova(/\b(?:dopo\s*domani|dopodomani)\b/g, () => ({ rel: 2 }));
  prova(/\bieri\b/g, () => ({ rel: -1 }));
  prova(/\bdomani\b/g, () => ({ rel: 1 }));
  prova(/\b(?:oggi|stamattina|stamani|stasera|stanotte)\b/g, () => ({ rel: 0 }));
  prova(/\b(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)(?:\s+(prossim[oa]|scors[oa]))?(?![a-zà-ù])/g,
    (m) => ({ wd: GIORNI_DETTA.indexOf(norm(m[1])), mod: m[2] ? (/^prossim/.test(m[2]) ? "prossimo" : "scorso") : "" }));
  return out.sort((a, b) => a.i - b.i);
}
// la data di un giorno nominato: un giorno della settimana va avanti (programmi) o indietro (copi da), «prossimo» / «scorso» decidono loro
function dataDelGiorno(g, verso) {
  const oggi = oggiISO();
  if (g.rel !== undefined) return addGiorniISO(oggi, g.rel);
  const dow = (new Date(oggi + "T12:00").getDay() + 6) % 7, v = g.mod === "prossimo" ? 1 : g.mod === "scorso" ? -1 : verso;
  let d = v > 0 ? (g.wd - dow + 7) % 7 : -((dow - g.wd + 7) % 7);
  if (g.mod === "prossimo" && d === 0) d = 7;
  if (g.mod === "scorso" && d === 0) d = -7;
  return addGiorniISO(oggi, d);
}
// i pasti nominati nella frase, in ordine (con le stesse regole di pastoDaFrase: «spuntino di pomeriggio» = merenda)
const pastiNellaFrase = (t, data) => trovaPasti(t, data || dataDetta());
// la frase senza i giorni (e la parola che li introduce: «per domani», «di lunedì prossimo»)
function togliGiorni(t, giorni) {
  let r = t;
  giorni.slice().sort((a, b) => b.i - a.i).forEach(g => { r = r.slice(0, g.i).replace(/(?:\b(?:per|di|del|da|a|il|lo|entro|anche|pure)\s+)+$/, "") + " " + r.slice(g.i + g.l); });
  return r.replace(/^\s*(?:programma(?:mi)?|pianifica|prepara(?:mi)?|prevedi|mangerò|mangero|mangio|voglio mangiare)\b/, " ").replace(/\s+/g, " ").trim();
}
const fraseDetta = (testo) => " " + String(testo || "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim() + " ";

// 3) SPESA
const SPESA_COMANDO = /(?:^|[^a-zà-ù])(?:lista della spesa|nella spesa|alla spesa|in spesa|sulla spesa|per la spesa|nella lista|alla lista|da comprare|devo comprare|dobbiamo comprare|compra|comprami|mi manca|mi mancano|ci manca|ci mancano|manca il|manca la|manca lo|mancano i|mancano le|mancano gli|(?:è|e') finit[oa]|sono finit[ie]|ho finito|abbiamo finito|non c'è più|non ci sono più)(?![a-zà-ù])/;
// ogni voce con la sua quantità, se l'hai detta: «latte scremato Lidl tre confezioni» → { nome: "Latte scremato Lidl", qta: "3 confezioni" }
function vociSpesaDaFrase(testo) {
  // i nomi propri (marche, negozi: «Lidl», «Esselunga») restano con la maiuscola com'erano nel dettato
  const maiusc = {}; String(testo || "").split(/\s+/).slice(1).forEach(w => { const p = w.replace(/[.,!?;:]/g, ""); if (/[A-ZÀ-Ù]/.test(p)) maiusc[p.toLowerCase()] = p; });
  const ripristina = (x) => x.split(" ").map(w => maiusc[w] || w).join(" ");
  let t = fraseDetta(testo)
    .replace(/\b(?:aggiungi|aggiungimi|metti|mettimi|scrivi|segna|segnami|inserisci|ricordami di comprare|ricordati di comprare|devo comprare|dobbiamo comprare|da comprare|comprami|compra|mi mancano|mi manca|ci mancano|ci manca|mancano|manca|ho finito|abbiamo finito|sono finit[ie]|anche|per favore|grazie)\b/g, " ")
    .replace(/(?:non c'è più|non ci sono più|(?:è|e') finit[oaie])(?![a-zà-ù])/g, " ")
    .replace(/\b(?:alla|nella|in|sulla|per la|sulla mia|nella mia)\s+(?:mia\s+)?(?:lista(?:\s+della\s+spesa)?|spesa)\b/g, " ")
    .replace(/\b(?:lista della spesa|spesa)\b/g, " ")
    .replace(/\b(chil[oi]|kg|litr[oi]|l)\s+e\s+mezzo\b/g, "$1 emezzo");   // «un chilo e mezzo» non va diviso in due voci
  return t.replace(/[.!?;]/g, ",").split(/,|\s(?:e|ed|poi|più|piu)\s/)
    .map(x => {
      const sep = typeof separaQtaSpesa === "function" ? separaQtaSpesa(x.trim().replace(/\bemezzo\b/, "e mezzo")) : { nome: x.trim(), qta: "" };
      const nome = sep.nome.replace(/^(?:(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle|qualche|un po' di|un po di|po' di|di)\s+|l'|un'|dell')+/, "").trim();
      return { nome, qta: sep.qta };
    })
    .filter(x => x.nome.length >= 2)
    .map(x => { const noto = vocePerSpesa(x.nome); return { nome: noto || ripristina(typeof nomeVoceSpesa === "function" ? nomeVoceSpesa(x.nome) : x.nome.charAt(0).toUpperCase() + x.nome.slice(1)), qta: x.qta }; })
    .filter((x, i, a) => a.findIndex(y => y.nome.toLowerCase() === x.nome.toLowerCase()) === i);
}
// «l'olio» detto a voce → la voce che c'è già nella lista o nella dispensa («Olio EVO»), così non ne nasce una seconda
function vocePerSpesa(x) {
  let noti = []; try { noti = [...new Set(Object.keys(statSpesa().st).map(nomeSpesa).concat(leggiExtraSpesa()))]; } catch (e) { return null; }
  const n = norm(x).replace(/i$|e$/, ""); if (n.length < 3) return null;
  return noti.find(v => norm(v) === norm(x)) || noti.find(v => new RegExp("^" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-z]?\\b").test(norm(v))) || null;
}
let _vociSpesaDetta = [];
// «aggiungi … alla spesa»: prima di scrivere in lista si controlla qui (nome e quantità, con − e ＋); poi si apre la lista con le voci nuove in evidenza
function apriConfermaSpesa(testo) {
  _vociSpesaDetta = vociSpesaDaFrase(testo);
  if (!_vociSpesaDetta.length) { avviso("Non ho capito cosa aggiungere alla spesa: riprova"); return true; }
  // senza quantità detta: quella suggerita (quanto ne mangi di solito, o una confezione), che puoi cambiare
  _vociSpesaDetta.forEach(v => { if (!v.qta && typeof suggerisciQtaSpesa === "function") { v.sugg = qtaBreve(suggerisciQtaSpesa(v.nome).info.replace(/^~\s*/, "")); v.qta = v.sugg; } });
  editCtx = null; liberoCtx = null;
  const disegna = () => {
    const c = document.getElementById("detta-spesa"); if (!c) return;
    c.innerHTML = _vociSpesaDetta.map((v, i) => `<li class="voce detta-spesa-v">
      <div class="detta-spesa-r"><input class="qta-input detta-spesa-nome" data-detta-spesa-nome="${i}" value="${esc(v.nome)}" aria-label="Nome" autocomplete="off"><button class="lib-del" data-detta-spesa-del="${i}" aria-label="Togli ${esc(v.nome)}">${ICONA_CESTINO}</button></div>
      <div class="spesa-mod-r"><span class="detta-spesa-l">Quantità</span><button class="spesa-step" data-detta-spesa-step="${i}|-1" aria-label="Meno">−</button>
      <input class="qta-input" data-detta-spesa-qta="${i}" value="${esc(v.qta)}" placeholder="es. 2 confezioni" autocomplete="off"><button class="spesa-step" data-detta-spesa-step="${i}|1" aria-label="Più">＋</button></div></li>`).join("") || `<li class="hint">Niente da aggiungere</li>`;
    const b = document.getElementById("detta-spesa-ok"); if (b) b.disabled = !_vociSpesaDetta.length;
  };
  openModal(`<h3 class="modal-title">🛒 Aggiungo alla lista della spesa</h3>
    <p class="detta-frase">«${esc(testo.trim())}»</p>
    <ul id="detta-spesa" class="detta-spesa"></ul>
    <div class="lib-detta"><div class="barra-due"><button class="btn-sec" data-chiudi>Annulla</button><button class="btn" id="detta-spesa-ok">✓ Aggiungi</button></div></div>`);
  disegna();
  const lista = document.getElementById("detta-spesa");
  lista.addEventListener("input", (e) => {
    const n = e.target.dataset.dettaSpesaNome, q = e.target.dataset.dettaSpesaQta;
    if (n !== undefined && _vociSpesaDetta[+n]) _vociSpesaDetta[+n].nome = e.target.value;
    if (q !== undefined && _vociSpesaDetta[+q]) _vociSpesaDetta[+q].qta = e.target.value;
  });
  lista.addEventListener("click", (e) => {
    const b = e.target.closest("[data-detta-spesa-del]"); if (b) { _vociSpesaDetta.splice(+b.dataset.dettaSpesaDel, 1); disegna(); return; }
    const st = e.target.closest("[data-detta-spesa-step]");
    if (st) { const [i, d] = st.dataset.dettaSpesaStep.split("|"), v = _vociSpesaDetta[+i]; if (!v) return; v.qta = cambiaQtaSpesa(v.qta, +d, v.nome); const inp = lista.querySelector(`[data-detta-spesa-qta="${i}"]`); if (inp) inp.value = v.qta; }
  });
  document.getElementById("detta-spesa-ok").addEventListener("click", () => {
    // la quantità suggerita non cambiata non si fissa: in lista resta «suggerita» e segue quanto ne mangi
    const voci = _vociSpesaDetta.map(v => ({ nome: String(v.nome || "").trim(), qta: String(v.qta || "").trim(), sugg: v.sugg })).filter(v => v.nome);
    if (!voci.length) { closeModal(true); return; }
    const extra = leggiExtraSpesa(), presi = leggiPresi();
    voci.forEach(v => { if (!extra.some(x => x.toLowerCase() === v.nome.toLowerCase())) extra.push(v.nome); presi.delete(v.nome); if (v.qta && v.qta !== v.sugg) impostaQtaSpesa(v.nome, v.qta); });
    salvaExtraSpesa(extra); salvaPresi(presi);
    closeModal(true);
    // si apre la lista: vedi dove sono finite (illuminate) e puoi ancora cambiarne la quantità
    _spesaNuove = voci.map(v => v.nome);
    apriSpesa(); segnaTab("altro");
    setTimeout(() => { const el = document.querySelector("#spesa .voce.nuova"); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 120);
    setTimeout(() => { _spesaNuove = []; document.querySelectorAll("#spesa .voce.nuova").forEach(x => x.classList.remove("nuova")); }, 2600);
    avviso(`🛒 In lista: ${voci.map(v => v.nome + (v.qta ? " (" + v.qta + ")" : "")).join(", ")}`);
  });
  return true;
}

// 2) COPIA UN PASTO
const COPIA_COMANDO = /\b(?:copia|copiami|ricopia|duplica|rifai|rifammi|ripeti|ripetimi|riproponi|stess[oaie]|uguale|identic[oa]|quello che ho mangiato|quello che ho fatto|come (?:ieri|l'altro ieri|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica))(?![a-zà-ù])/;
function comandoCopia(testo) {
  const t = fraseDetta(testo);
  if (!COPIA_COMANDO.test(t)) return null;
  const giorni = giorniNellaFrase(t), pasti = pastiNellaFrase(t);
  if (!giorni.length || !pasti.length) return null;
  // chi è la destinazione: il giorno introdotto da «anche», «su», «per», «a»… ; chi è l'origine: «di», «del», «da», «mangiato»
  const prima = (g) => t.slice(Math.max(0, g.i - 18), g.i);
  giorni.forEach(g => { g.ruolo = /(?:anche|pure|su|per|in|a|ad|al|alla)\s*(?:per\s+|a\s+|il\s+|lo\s+|la\s+)?$/.test(prima(g)) ? "dst" : /(?:di|del|dal|da|mangiato|fatto|preso)\s*$/.test(prima(g)) ? "src" : ""; });
  let src, dst;
  if (giorni.length >= 2) {
    src = giorni.find(g => g.ruolo === "src") || giorni.find(g => g.ruolo !== "dst") || giorni[0];
    dst = giorni.find(g => g !== src && g.ruolo === "dst") || giorni.find(g => g !== src);
  } else if (giorni[0].ruolo === "dst") dst = giorni[0];
  else src = giorni[0];
  const dSrc = src ? dataDelGiorno(src, -1) : dataDetta();
  let dDst = dst ? dataDelGiorno(dst, 1) : (dataDetta() !== dSrc ? dataDetta() : oggiISO());
  if (dst && dst.wd !== undefined && !dst.mod && dDst <= dSrc && dSrc >= oggiISO()) dDst = addGiorniISO(dDst, 7);
  // ogni pasto va col giorno più vicino nella frase: «ieri a pranzo … oggi a cena»
  // «il pranzo di ieri», «la cena di lunedì» → origine; «a cena», «per pranzo» → destinazione (ma «ieri a pranzo» è il pranzo di ieri: va col giorno appena prima)
  pasti.forEach(p => {
    const prima = t.slice(0, p.i) + (p.art ? " " + p.art : "");
    if (/(?:il|lo|la|del|della|dello|di|quello|quella|stess[oa])\s*$/.test(prima)) { p.ruolo = "src"; return; }
    const m = prima.match(/(?:a|ad|al|alla|per|come|nel|nella)\s*$/);
    if (m) { const resto = prima.slice(0, prima.length - m[0].length).trimEnd(), g = giorni.find(x => Math.abs(x.i + x.l - resto.length) <= 1); p.ruolo = g ? (g === dst ? "dst" : "src") : "dst"; return; }
    const g = giorni.reduce((b, x) => Math.abs(x.i - p.i) < Math.abs(b.i - p.i) ? x : b, giorni[0]); p.ruolo = g === dst ? "dst" : "src";
  });
  if (pasti.length >= 2 && pasti.every(p => p.ruolo === pasti[0].ruolo)) { pasti[0].ruolo = "src"; pasti[1].ruolo = "dst"; }
  const pSrc = (pasti.find(p => p.ruolo === "src") || pasti[0]).p, pDst = (pasti.find(p => p.ruolo === "dst") || {}).p || pSrc;
  return { dSrc, pSrc, dDst, pDst };
}
const nomeGiornoDetta = (d) => d === oggiISO() ? "oggi" : d === addGiorniISO(oggiISO(), -1) ? "ieri" : d === addGiorniISO(oggiISO(), 1) ? "domani" : fmtGiornoLungo(d).toLowerCase();
function eseguiCopia(cp) {
  if (cp.dSrc === cp.dDst && cp.pSrc === cp.pDst) { avviso("Dimmi su quale giorno copiarlo (es. «anche domani»)"); return; }
  const voci = (giornoDiario(cp.dSrc).pasti || []).filter(p => p.pasto === cp.pSrc && (p.ingredienti || []).length);
  if (!voci.length) { avviso(`${nomeGiornoDetta(cp.dSrc).replace(/^./, c => c.toUpperCase())} a ${nomePasto(cp.pSrc, cp.dSrc)} non c'è niente da copiare`); return; }
  if (!momentiGiorno(cp.dDst).includes(cp.pDst)) { avviso(`${NomePasto(cp.pDst, cp.dDst)} non è tra i tuoi pasti`); return; }
  if (!vaiAlGiornoDetta(cp.dDst)) return;
  apriPastoDiario(cp.dDst, null, cp.pDst);
  if (!liberoCtx || liberoCtx.pasto !== cp.pDst) return;
  piattiDaAggiungere(liberoCtx, voci);   // in «Da aggiungere»: controlli e tocchi ✓ Aggiungi
  rirenderLibero();
  avviso(`Da ${nomePasto(cp.pSrc, cp.dSrc)} di ${nomeGiornoDetta(cp.dSrc)}: controlla e tocca ✓ Aggiungi`);
}
// Oggi mostra il giorno su cui stai per scrivere (domani, giovedì…)
function vaiAlGiornoDetta(data) {
  if (document.body.dataset.tab !== "oggi") { const t = document.getElementById("tab-oggi"); if (t) t.click(); }
  if (typeof dataDiario !== "undefined" && dataDiario !== data) {
    dataDiario = data; if (typeof vistaHome !== "undefined") vistaHome = "oggi";
    _dataDaVoce = data === oggiISO() ? null : data;
    if (typeof renderOggi === "function") renderOggi();
    window.scrollTo(0, 0);
  }
  return true;
}

// 4) PESO: «peso 61,4», «stamattina pesavo 61 e 4», «mi sono pesata: 61 chili e 400», «ieri pesavo 61,8»
const PESO_COMANDO = /\b(?:peso|pesavo|peso di|pesata|pesato|pesa|mi sono pesat[oa]|la bilancia (?:dice|segna))\b/;
function kgDaFrase(t) {
  const n = (x) => parseFloat(String(x).replace(",", "."));
  let m = t.match(/(\d{2,3})\s*(?:kg|chili|chilo|kili)?\s*(?:e|virgola|punto|,|\.)\s*(\d{1,3})\s*(grammi|g\b|etti)?/);
  if (m) { const dec = m[3] && /gramm|^g/.test(m[3]) || m[2].length === 3 ? n(m[2]) / 1000 : m[3] && /etti/.test(m[3]) ? n(m[2]) / 10 : n("0." + m[2]); return Math.round((n(m[1]) + dec) * 10) / 10; }
  m = t.match(/(\d{2,3}(?:[.,]\d+)?)/);
  return m ? Math.round(n(m[1]) * 10) / 10 : NaN;
}
function comandoPeso(testo) {
  const t = fraseDetta(testo);
  if (!PESO_COMANDO.test(t)) return false;
  const kg = kgDaFrase(t.replace(/\b(?:alle|ore)\s+\d+(?:[:.]\d+)?/g, " "));
  if (!(kg >= 30 && kg <= 200)) {
    if (/\b(?:quant[oi]|perso|preso|calat[oa]|sces[oa]|salit[oa]|andamento|grafico|come va|come sta andando|progressi)\b/.test(t)) {   // «quanto peso ho perso questo mese?»: il peso è nell'Andamento
      closeModal(true); const b = document.getElementById("apri-andamento"); if (b) b.click(); avviso("📊 Il tuo peso è qui, nell'Andamento"); return true;
    }
    avviso("Non ho capito il peso: di' per esempio «peso 61,4»"); return true;
  }
  const g = giorniNellaFrase(t), data = g.length ? dataDelGiorno(g[0], -1) : oggiISO();
  if (data > oggiISO()) { avviso("Il peso si registra per oggi o per i giorni passati"); return true; }
  const altre = leggiPesi().filter(p => p.data !== data && p.data < data), ultima = altre[altre.length - 1];
  const diff = ultima ? Math.round((kg - ultima.kg) * 10) / 10 : null, f = (x) => String(x).replace(".", ",");
  const gia = leggiPesi().find(p => p.data === data);
  editCtx = null; liberoCtx = null;
  openModal(`<h3 class="modal-title">⚖️ Peso di ${esc(nomeGiornoDetta(data))}</h3>
    <div class="voce-numero"><b>${fmtKg(kg)}</b><span>kg</span></div>
    ${diff !== null ? `<p class="hint${Math.abs(diff) > 3 ? " voce-attenzione" : ""}">${diff === 0 ? "Uguale" : `${diff > 0 ? "+" : "−"}${f(Math.abs(diff))} kg rispetto`} all'ultima pesata (${esc(fmtData(ultima.data))}: ${fmtKg(ultima.kg)} kg)${Math.abs(diff) > 3 ? ". È tanto: controlla che sia giusto." : ""}</p>` : ""}
    ${gia ? `<p class="hint">Sostituisce la pesata già scritta (${fmtKg(gia.kg)} kg).</p>` : ""}
    <div class="lib-detta"><div class="barra-due"><button class="btn-sec" data-chiudi>Annulla</button><button class="btn" id="voce-peso-ok">Salva</button></div></div>`);
  document.getElementById("voce-peso-ok").addEventListener("click", () => {
    const pesi = leggiPesi().filter(p => p.data !== data); pesi.push({ data, kg }); salvaPesi(pesi);
    if (typeof aggiornaPesoProfilo === "function") aggiornaPesoProfilo();
    closeModal(true); if (typeof renderOggi === "function") renderOggi();
    avviso(`Peso salvato: ${fmtKg(kg)} kg`);
  });
  return true;
}

// 5) DOMANDE: «quanto mi manca?», «quante proteine mi mancano?», «cosa mangio a cena?», «cosa aggiungo?»
const DOMANDA_MANCA = /\b(?:quant[oaie]|cosa|che cosa|come)\b[^?]*\b(?:manca|mancano|resta|restano|rimane|rimangono|posso ancora|sono messa|sono messo|sto messa|sto messo)\b|\ba che punto sono\b|\bcome sto andando oggi\b/;
const DOMANDA_IDEE = /\b(?:cosa|che cosa|che)\s+(?:mangio|posso mangiare|mi consigli|mi suggerisci|aggiungo|posso aggiungere|preparo|cucino|faccio)\b|\b(?:idee|consigli|suggerimenti)\b/;
function comandoDomanda(testo) {
  const t = fraseDetta(testo), idee = DOMANDA_IDEE.test(t), manca = DOMANDA_MANCA.test(t);
  if (!idee && !manca) return false;
  const g = giorniNellaFrase(t), data = g.length ? dataDelGiorno(g[0], 1) : dataDetta(), pasti = pastiNellaFrase(t);
  vaiAlGiornoDetta(data);
  if (idee && !(manca && /\bquant/.test(t))) {   // idee: il pasto nominato (con le sue idee e i consigli furbi), altrimenti «cosa aggiungere» della giornata
    const p = pasti.length && momentiGiorno(data).includes(pasti[0].p) ? pasti[0].p : null;
    if (p) apriPastoDiario(data, null, p); else apriCosaAggiungere();
    return true;
  }
  const m = mancaData(data), T = targetData(data);
  const voci = [["kcal", "Calorie", "kcal"], ["proteine", "Proteine", "g"], ["carboidrati", "Carboidrati", "g"], ["grassi", "Grassi", "g"]];
  const chiesto = /protein/.test(t) ? "proteine" : /carboidrat|carbo\b/.test(t) ? "carboidrati" : /grass/.test(t) ? "grassi" : /calori|kcal/.test(t) ? "kcal" : null;
  const ord = chiesto ? voci.filter(v => v[0] === chiesto).concat(voci.filter(v => v[0] !== chiesto)) : voci;
  const riga = ([k, l, u]) => { const v = Math.round(m[k]); return `<div class="voce-manca${k === chiesto ? " chiesto" : ""}"><span>${l}</span><b class="${v < 0 ? "sopra" : ""}">${v > 0 ? `mancano ${v} ${u}` : v < 0 ? `sopra di ${-v} ${u}` : "ok ✓"}</b><small>obiettivo ${Math.round(T[k])} ${u}</small></div>`; };
  editCtx = null; liberoCtx = null;
  openModal(`<h3 class="modal-title">📊 ${esc(nomeGiornoDetta(data).replace(/^./, c => c.toUpperCase()))}</h3>
    <div class="voce-mancano">${ord.map(riga).join("")}</div>
    <div class="lib-detta"><div class="barra-due"><button class="btn-sec" data-chiudi>Chiudi</button><button class="btn" id="voce-cosa">💡 Cosa aggiungo?</button></div></div>`);
  document.getElementById("voce-cosa").addEventListener("click", () => { closeModal(true); apriCosaAggiungere(); });
  return true;
}

// 6) SOSTITUISCI: «sostituisci il pollo con il tacchino», «cambia il riso con le patate a cena», «metti il tacchino al posto del pollo domani»,
//    «tacchino invece del pollo». Fonte di proteine → stesse proteine; il resto → stesse calorie. Se dici i grammi («con 150 g di tacchino») valgono quelli.
const ARTICOLI_DETTA = /^(?:(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle|di|al|allo|alla|ai|agli|alle)\s+|l'|un'|dell'|all')+/;
function comandoSostituisci(testo) {
  let t = fraseDetta(testo), x = null, y = null, m;
  if (!/\b(?:sostituisci|sostituire|sostituiscimi|cambia|cambiami|cambiare|scambia|rimpiazza|al posto|invece)\b/.test(t)) return false;
  const giorni = giorniNellaFrase(t), pasti = pastiNellaFrase(t);
  const data = giorni.length ? dataDelGiorno(giorni[0], 1) : dataDetta(), pasto = pasti.length ? pasti[0].p : null;
  // via giorni e pasti (con le parole che li introducono), restano solo i due alimenti
  t = togliGiorni(t, giorni);
  pastiNellaFrase(t, data).sort((a, b) => b.i - a.i).forEach(p => { t = t.slice(0, p.i).replace(/\b(?:del|della|dello|di|dal|dalla|in)\s*$/, "") + " " + t.slice(p.i + p.l); });
  t = t.replace(/\s+/g, " ").trim();
  if ((m = t.match(/\b(?:sostituisci|sostituire|sostituiscimi|cambia|cambiami|cambiare|scambia|rimpiazza)\s+(.+?)\s+(?:con|in)\s+(.+)$/))) { x = m[1]; y = m[2]; }
  else if ((m = t.match(/\b(?:metti|mettimi|usa)\s+(.+?)\s+al posto\s+(?:del|della|dello|dei|degli|delle|di|dell')\s*(.+)$/))) { y = m[1]; x = m[2]; }
  else if ((m = t.match(/^(?:metti|mettimi|usa)?\s*(.+?)\s+invece\s+(?:del|della|dello|dei|degli|delle|di|dell')\s*(.+)$/))) { y = m[1]; x = m[2]; }
  if (!x || !y) return false;
  const pulisci = (s) => s.replace(/[.,!?]/g, " ").trim().replace(ARTICOLI_DETTA, "").trim();
  x = pulisci(x); y = pulisci(y);
  const A = window.ALIMENTI || {}, xn = norm(x).replace(/i$|e$/, "");
  // l'alimento da cambiare: tra i pasti di quel giorno (solo quel pasto, se l'hai detto)
  const trovati = [];
  (giornoDiario(data).pasti || []).forEach((p, pi) => { if (pasto && p.pasto !== pasto) return; (p.ingredienti || []).forEach((i, ii) => {
    const g = grammiIng(i); if (!(g > 0) || i.unita === "q.b.") return;
    const nn = norm(i.nome), ok = nn.includes(norm(x)) || nn.includes(xn) || norm(x).split(" ").filter(w => w.length > 2).every(w => nn.includes(w.replace(/i$|e$/, "")));
    if (ok) trovati.push({ pi, ii, nome: i.nome, qta: g, pasto: p.pasto });
  }); });
  if (!trovati.length) { avviso(`Non trovo «${x}» ${dovePastoDetta(pasto, data)}`); return true; }
  // il nuovo alimento (con i grammi, se li hai detti)
  let r = null; try { r = leggiRigaIngrediente(y); } catch (e) {}
  let nuovo = r && r.nome && A[r.nome] ? r.nome : (cercaAlimenti(y) || []).find(n => A[n]);
  if (!nuovo) { avviso(`Non conosco «${y}»: scrivilo in un pasto per cercarlo`); return true; }
  const grammiDetti = /\d/.test(y) && r && r.nome === nuovo && r.qta > 0 ? Math.round(grammiIng(r) || r.qta) : 0;
  const qtaNuova = (v) => {
    if (grammiDetti) return grammiDetti;
    const a0 = A[v.nome], a1 = A[nuovo];
    const prot = a0[1] * 4 / Math.max(1, a0[0]) >= 0.25 && a1[1] >= 8;
    if (!prot && (a0[0] < 45 || a1[0] < 45)) return Math.round(v.qta / 5) * 5 || 5;   // frutta e verdura (banana → zucca): gli stessi grammi, non 400 g di zucca per avere le stesse calorie
    const g = prot ? v.qta * a0[1] / a1[1] : v.qta * a0[0] / Math.max(1, a1[0]);
    return Math.max(5, Math.min(GRAMMI_MAX_FONTI[nuovo] || 400, Math.round(g / 5) * 5));
  };
  const conferma = (v) => {   // solo la domanda: «Sicura di voler sostituire petto di pollo 120 g con fesa di tacchino 115 g?»
    const q = qtaNuova(v);
    chiediConferma(`${sicuraDetta()} di voler sostituire ${cosaDetta(v.nome, v.qta)} con ${cosaDetta(nuovo, q)}?`, "", "Sostituisci", () => {
      const g = giornoDiario(data), p = g.pasti[v.pi], ing = p && (p.ingredienti || [])[v.ii]; if (!ing) { closeModal(true); return; }
      const ingrPrima = clone(p.ingredienti);
      p.ingredienti[v.ii] = { nome: nuovo, qta: q, unita: UNITA_LIQUIDI.test(nuovo) ? "ml" : "g", lock: true, cercato: nuovo };
      delete p.auto; rinominaLibero(p, ingrPrima); aggiornaMacro(p);
      scriviGiorno(data, g);
      closeModal(true); if (typeof renderOggi === "function") renderOggi();
      avviso(`${nuovo} al posto di ${v.nome.toLowerCase()}`);
    }, null, true);   // tasto verde: sostituire è una scelta, non un errore da evitare
  };
  editCtx = null; liberoCtx = null;
  vaiAlGiornoDetta(data);
  if (trovati.length === 1) { conferma(trovati[0]); return true; }
  // in più pasti: scegli quale
  openModal(`<h3 class="modal-title">🔄 Quale ${esc(x)}?</h3><p class="hint">Al suo posto: ${esc(nuovo.toLowerCase())}</p>
    <div class="detta-pasti">${trovati.map((v, k) => `<button class="btn-sec" data-voce-sost="${k}">${ICONA_PASTO[v.pasto] || "🍽️"} ${esc(NomePasto(v.pasto, data))}: ${esc(v.nome.toLowerCase())} ${Math.round(v.qta)} g</button>`).join("")}</div>`);
  document.querySelectorAll("[data-voce-sost]").forEach(b => b.addEventListener("click", () => conferma(trovati[+b.dataset.voceSost])));
  return true;
}

// 7) ALLENAMENTO: «oggi ho fatto un'ora di CrossFit», «domani riposo», «ho corso 6 km», «45 minuti di pesi e mezz'ora di camminata», «mi alleno alle 18»
// Si apre la scheda «Allenamenti» del giorno già compilata: controlli e tocchi ✓ Salva (i pasti si adattano come sempre)
const SPORT_PAROLE = [
  ["crossfit", /\bcross\s*fit\b|\bcrossfit\b|\bwod\b/], ["pesi", /\b(?:sala pesi|pesi|palestra|pesistica|bodybuilding)\b/], ["funzionale", /\b(?:funzionale|allenamento funzionale|circuito|hiit)\b/],
  ["corsa", /\b(?:corsa|corso|correre|corsetta|running|corro|correrò|correro)\b/], ["camminata", /\b(?:camminata|camminato|camminare|cammino|passeggiata|passeggiato|camminerò|camminero)\b/],
  ["bici", /\b(?:bici|bicicletta|pedalato|pedalata|ciclismo|spinning|cyclette)\b/], ["nuoto", /\b(?:nuoto|nuotato|nuotare|piscina)\b/], ["yoga", /\b(?:yoga|pilates)\b/],
  ["padel", /\b(?:padel|tennis)\b/], ["ballo", /\b(?:ballo|ballato|ballare|danza|zumba)\b/], ["equitazione", /\b(?:equitazione|cavallo|cavalcato|cavalcare|maneggio)\b/],
  ["squadra", /\b(?:calcio|calcetto|pallavolo|basket|sport di squadra)\b/],
];
const RIPOSO_COMANDO = /\b(?:riposo|giorno libero|niente (?:allenamento|sport|palestra)|nessun allenamento|non (?:mi alleno|mi sono allenat[oa]|faccio sport|ho fatto sport|vado in palestra|mi allenerò|mi allenero)|salto (?:l'allenamento|la palestra))\b/;
const ALLEN_COMANDO = /\b(?:mi alleno|mi sono allenat[oa]|mi allenerò|mi allenero|allenamento|allenarmi|ho fatto|faccio|farò|faro|vado a|sono andat[oa] a)\b/;
// lo sport del Profilo per una parola detta (anche gli sport aggiunti da te, per nome)
function sportDetti(t, pf) {
  const out = [];
  SPORT_PAROLE.forEach(([k, re]) => {
    const m = t.match(re); if (!m) return;
    const sp = pf.sport.find(s => s.id === k) || pf.sport.find(s => norm(s.nome).includes(k)) || (k === "yoga" && pf.sport.find(s => /yoga|pilates/.test(norm(s.nome)))) || (k === "padel" && pf.sport.find(s => /padel|tennis/.test(norm(s.nome)))) || (k === "squadra" && pf.sport.find(s => /squadra|calc|pallavolo|basket/.test(norm(s.nome))));
    out.push({ i: m.index, l: m[0].length, k, sp: sp || null, parola: m[0] });
  });
  pf.sport.forEach(sp => { const n = norm(sp.nome); if (n.length < 4 || out.some(o => o.sp === sp)) return; const i = norm(t).indexOf(n); if (i >= 0) out.push({ i, l: n.length, k: sp.id, sp, parola: sp.nome }); });
  return out.sort((a, b) => a.i - b.i);
}
// durate dette: minuti o km, con la posizione nella frase
function durateDette(t) {
  const out = [], numero = (w) => numParola(w);
  const re = /(\d+(?:[.,]\d+)?|un'|un|una|mezz'|mezza|due|tre|quattro|cinque)\s*(ora|ore|oretta|h\b|minuti|minuto|min\b|km|chilometri|chilometro|kilometri)(?:\s+e\s+(mezza|mezzo|un quarto|tre quarti|\d+)(?:\s*(?:minuti|min))?)?/g;
  let m;
  while ((m = re.exec(t))) {
    const u = m[2], km = /km|chilom|kilom/.test(u);
    let v = /^mezz/.test(m[1]) ? 0.5 : numero(m[1]);
    if (/^(?:ora|ore|oretta|h)$/.test(u)) { v *= 60; const e = m[3]; if (e) v += e === "mezza" || e === "mezzo" ? 30 : e === "un quarto" ? 15 : e === "tre quarti" ? 45 : +e; }
    else if (km && m[3] && /^\d+$/.test(m[3])) v = parseFloat(m[1] + "." + m[3]);
    if (v > 0) out.push({ i: m.index, l: m[0].length, v: km ? Math.round(v * 10) / 10 : Math.round(v), km });
  }
  return out;
}
// l'ora detta: «alle 18», «alle 18:30», «alle 7 di sera», «alle sei e mezza»
function oraDetta(t) {
  const m = t.match(/\balle\s+(\d{1,2}|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici)(?:[:.](\d{2})|\s+e\s+(mezza|un quarto|tre quarti|\d{1,2}))?(?:\s+(?:di|del|della)?\s*(mattina|pomeriggio|sera|stasera))?/);
  if (!m) return null;
  const P = { una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12 };
  let h = P[m[1]] || +m[1];
  const min = m[2] ? +m[2] : m[3] === "mezza" ? 30 : m[3] === "un quarto" ? 15 : m[3] === "tre quarti" ? 45 : m[3] ? +m[3] : 0;
  if (h < 12 && (/pomeriggio|sera/.test(m[4] || "") || /\bstasera\b/.test(t) || h <= 5)) h += 12;   // «alle 6» da sola si intende di mattina; «alle 3» di pomeriggio
  return h >= 0 && h < 24 ? h + min / 60 : null;
}
function comandoAllenamento(testo) {
  const t = fraseDetta(testo), pf = leggiProfilo();
  if (pastiNellaFrase(t).length && !/\balleno|allenamento\b/.test(t)) return false;   // «a pranzo…»: è un pasto
  const riposo = RIPOSO_COMANDO.test(t), sport = riposo ? [] : sportDetti(t, pf), durate = durateDette(t), ora = oraDetta(t);
  if (!riposo && !sport.length && !(ora !== null && /\balleno|allenamento|allenarmi|palestra\b/.test(t))) return false;
  if (!riposo && sport.length && !ALLEN_COMANDO.test(t) && !durate.length && !giorniNellaFrase(t).length && ora === null) return false;   // una parola sola («pesi»): non basta
  const passato = /\b(?:ho fatto|ho corso|ho camminato|mi sono allenat|ho nuotato|ho pedalato|ho ballato|sono andat[oa])/.test(t);
  let data = (() => { const g = giorniNellaFrase(t); return g.length ? dataDelGiorno(g[0], passato ? -1 : 1) : dataDetta(); })();
  if (passato && data > oggiISO()) data = oggiISO();   // «ho corso 6 km» (al passato) non va su domani anche se Oggi mostra domani
  if (riposo) { vaiAlGiornoDetta(data); apriAllenamentiGiorno(data, "riposo"); return true; }
  const mancanti = sport.filter(s => !s.sp);
  if (mancanti.length && mancanti.length === sport.length) { avviso(`«${mancanti[0].parola}» non è tra i tuoi sport: di' «aggiungi lo sport ${mancanti[0].parola}»`); return true; }
  let ids = sport.filter(s => s.sp).map(s => s.sp.id);
  if (!ids.length) ids = sportDelTipo(giornoDiario(data).tipo);   // solo l'ora («mi alleno alle 18»): gli sport già scelti per quel giorno
  if (!ids.length) { avviso("Dimmi anche che sport fai (es. «alle 18 pesi»)"); return true; }
  // ogni durata va allo sport che la segue («un'ora di CrossFit») o, se no, a quello più vicino («CrossFit per un'ora»)
  const dur = Object.assign({}, durateDelTipo(giornoDiario(data).tipo));
  Object.keys(dur).forEach(k => { if (!ids.includes(k)) delete dur[k]; });
  const conSp = sport.filter(s => s.sp);
  durate.forEach(d => {
    let s = conSp.find(x => x.i >= d.i + d.l && x.i - (d.i + d.l) <= 6 && /^\s*(?:di|de|a|in)?\s*$/.test(t.slice(d.i + d.l, x.i)));
    if (!s) s = conSp.reduce((b, x) => !b || Math.abs(x.i - d.i) < Math.abs(b.i - d.i) ? x : b, null);
    const sp = s ? s.sp : ids.length === 1 ? pf.sport.find(x => x.id === ids[0]) : null; if (!sp) return;
    if (!!sp.perKm === d.km) dur[sp.id] = d.v;
    else if (sp.perKm && !d.km && d.v > 0) dur[sp.id] = Math.round(d.v / 6 * 10) / 10;   // corsa detta in minuti: circa 6 minuti al km
  });
  const ore = ora !== null ? Object.fromEntries(ids.filter(id => id !== "camminata").map(id => [id, ora])) : null;
  vaiAlGiornoDetta(data);
  apriAllenamentiGiorno(data, chiaveTipo(ids, dur), ore);
  if (mancanti.length) avviso(`«${mancanti[0].parola}» non è tra i tuoi sport: aggiungilo nel Profilo`);
  return true;
}

// 8) CALORIE DEI GIORNI: «imposta martedì e mercoledì 1800 calorie, giovedì e venerdì 1200», «sabato 2000 kcal», «1500 calorie domani»
// Come il pannello del giorno in Settimana: anteprima, poi «Compensa negli altri giorni» oppure «Cambia anche il totale».
// I giorni della settimana: in Settimana quella che stai guardando, altrimenti il prossimo (oggi compreso). I giorni passati non si cambiano.
const KCAL_COMANDO = /\b(?:calorie|kcal|chilocalorie)\b/;
function comandoKcalGiorni(testo) {
  const t = fraseDetta(testo);
  if (!KCAL_COMANDO.test(t) && !/\b(?:imposta|metti)\b.*\b\d{3,4}\b/.test(t)) return false;
  const giorni = giorniNellaFrase(t);
  const numeri = []; { const re = /\b(\d{1,2}[.\s]\d{3}|\d{3,4})\b/g; let m; while ((m = re.exec(t))) { const v = parseInt(m[1].replace(/[.\s]/g, ""), 10); if (v >= 800 && v <= 6000) numeri.push({ i: m.index, v }); } }
  if (!giorni.length || !numeri.length) return false;
  // ogni numero va ai giorni detti prima di lui (dopo il numero precedente); se prima non ce n'erano, a quelli che lo seguono
  const ev = giorni.map(g => ({ i: g.i, g })).concat(numeri.map(n => ({ i: n.i, n }))).sort((a, b) => a.i - b.i);
  const scelte = []; let attesa = [], numAttesa = null;
  ev.forEach(e => {
    if (e.g) { if (numAttesa !== null) scelte.push({ g: e.g, v: numAttesa }); else attesa.push(e.g); return; }
    if (attesa.length) { attesa.forEach(g => scelte.push({ g, v: e.n.v })); attesa = []; numAttesa = null; } else numAttesa = e.n.v;
  });
  if (!scelte.length) return false;
  // le date: in Settimana i giorni della settimana che guardi, altrimenti i prossimi
  const inSett = document.body.dataset.tab === "settimana" || (typeof vistaHome !== "undefined" && vistaHome === "settimana");
  const lunVista = inSett ? addGiorniISO(addGiorniISO(oggiISO(), -indiceSettimana(oggiISO())), (typeof offsetSettHome !== "undefined" ? offsetSettHome : 0) * 7) : null;
  const oggi = oggiISO(), righe = [], passati = [];
  scelte.forEach(({ g, v }) => {
    const data = g.wd !== undefined && lunVista && !g.mod ? addGiorniISO(lunVista, g.wd) : dataDelGiorno(g, 1);
    if (data < oggi) { passati.push(data); return; }
    const k = righe.findIndex(r => r.data === data); if (k >= 0) righe.splice(k, 1);   // lo stesso giorno detto due volte: vale l'ultimo
    righe.push({ data, voluto: v });
  });
  if (!righe.length) { avviso("I giorni passati non si cambiano"); return true; }
  righe.sort((a, b) => a.data.localeCompare(b.data));
  righe.forEach(r => { const p = pianoSettimana(r.data), i = p.date.indexOf(r.data); r.prima = p.target[i]; r.lim = limitiGiorno(p.base[i]); r.v = limita10(r.voluto, r.lim); });
  const nomeG = (d) => `${NOMI_GIORNI[indiceSettimana(d)]} ${fmtData(d)}`;
  editCtx = null; liberoCtx = null;
  openModal(`<h3 class="modal-title">🔥 Calorie dei giorni</h3>
    <div class="voce-mancano">${righe.map(r => `<div class="voce-manca"><span>${esc(nomeG(r.data))}</span><b>${kIt(r.v)} kcal</b><small>previste ${kIt(r.prima)} kcal${r.v !== r.voluto ? ` · ${kIt(r.voluto)} ${r.voluto < r.v ? `è sotto il tuo metabolismo basale: metto ${kIt(r.v)}` : `è troppo (al massimo +50%): metto ${kIt(r.v)}`}` : ""}</small></div>`).join("")}</div>
    ${passati.length ? `<p class="hint">${passati.map(nomeG).join(", ")}: già passato, non si cambia.</p>` : ""}
    <p class="hint">Compensando, gli altri giorni della settimana si adattano e il totale resta uguale. Altrimenti cambia anche il totale della settimana.</p>
    <div class="bsp-azioni"><button class="btn-sec" data-voce-kcal="compensa">Compensa negli altri giorni</button><button class="btn" data-voce-kcal="totale">Cambia anche il totale</button></div>`);
  document.querySelectorAll("[data-voce-kcal]").forEach(b => b.addEventListener("click", () => {
    const modo = b.dataset.voceKcal;
    righe.forEach(r => {
      const p = pianoSettimana(r.data), i = p.date.indexOf(r.data), d = r.v - p.target[i];
      if (modo === "totale" && d) { const bs = leggiBudgetSett(); bs.settimane[p.date[0]] = p.budget + d; salvaBudgetSett(bs); }
      const p2 = pianoSettimana(r.data); impostaSpostamento(r.data, r.v - p2.base[p2.date.indexOf(r.data)]);
    });
    giornoSelSett = null; closeModal(true); aggiornaSettimana();
    avviso(`✓ ${righe.map(r => `${NOMI_GIORNI[indiceSettimana(r.data)].toLowerCase()} ${kIt(r.v)}`).join(" · ")}`);
  }));
  return true;
}

// 9) TOGLI o CAMBIA LA QUANTITÀ di un alimento già scritto: «togli il pane dal pranzo», «togli il pollo dalla cena di ieri», «porta il riso a 200 grammi», «metti 150 g di pollo a cena»
// gli alimenti di quel giorno (solo quel pasto, se lo dici) che corrispondono alla parola detta
// «nel pranzo di oggi», «nella cena di ieri», «nello spuntino di domani», «nei pasti di oggi»
function dovePastoDetta(p, data) {
  const g = nomeGiornoDetta(data); if (!p) return `nei pasti di ${g}`;
  const n = nomePasto(p, data), art = /^(?:cena|colazione|merenda)$/.test(n) ? "nella" : /^s[^aeiou]/.test(n) ? "nello" : "nel";
  return `${art} ${n} di ${g}`;
}
// «Sicura» / «Sicuro» dal sesso del Profilo; il nome dell'alimento in minuscolo (le marche restano come sono) con la quantità
const sicuraDetta = () => { const sx = leggiProfilo().sesso; return sx === "uomo" ? "Sicuro" : sx === "donna" ? "Sicura" : "Sicuro/a"; };
const cosaDetta = (nome, g) => `${/.[A-ZÀ-Ý]/.test(nome) ? nome : nome.toLowerCase()} ${Math.round(g)} ${UNITA_LIQUIDI.test(nome) ? "ml" : "g"}`;
function ingredientiDetti(x, data, pasto) {
  const xn = norm(x).replace(/i$|e$/, ""), out = [];
  (giornoDiario(data).pasti || []).forEach((p, pi) => { if (pasto && p.pasto !== pasto) return; (p.ingredienti || []).forEach((i, ii) => {
    const g = grammiIng(i); if (!(g > 0) || i.unita === "q.b.") return;
    const nn = norm(i.nome), ok = nn.includes(norm(x)) || nn.includes(xn) || norm(x).split(" ").filter(w => w.length > 2).every(w => nn.includes(w.replace(/i$|e$/, "")));
    if (ok) out.push({ pi, ii, nome: i.nome, qta: g, pasto: p.pasto });
  }); });
  return out;
}
function comandoTogliPorta(testo) {
  let t = fraseDetta(testo), m, tipo = null, x = null, nuovaQ = 0;
  if ((m = t.match(/^\s*(?:togli|toglimi|rimuovi|elimina|cancella|leva|levami)\s+(.+)$/))) { tipo = "togli"; x = m[1]; }
  else if ((m = t.match(/^\s*(?:porta|porti|metti|aumenta|diminuisci|riduci|cambia)\s+(.+?)\s+(?:a|da\s+\d+\s+a)\s+(\d{1,4}(?:[.,]\d)?)\s*(?:g|grammi|gr|ml|millilitri)\b(.*)$/))) { tipo = "porta"; x = m[1] + " " + m[3]; nuovaQ = Math.round(parseFloat(m[2].replace(",", "."))); }
  if (!tipo) return false;
  const giorni = giorniNellaFrase(t), data = giorni.length ? dataDelGiorno(giorni[0], 1) : dataDetta();
  let s = togliGiorni(" " + x + " ", giorniNellaFrase(" " + x + " "));
  const pasti = pastiNellaFrase(" " + s + " ", data), pasto = pasti.length ? pasti[0].p : null;
  pasti.slice().sort((a, b) => b.i - a.i).forEach(p => { s = (" " + s + " ").slice(0, p.i) + " " + (" " + s + " ").slice(p.i + p.l); });
  s = s.replace(/\b(?:dal|dalla|dallo|dai|dalle|del|della|dello|di|nel|nella|in|a|al|alla)\s*$/, "").replace(/\s+(?:dal|dalla|dallo|dai|dalle|del|della|nel|nella|in)\s*$/, "").replace(/[.,!?]/g, " ").trim().replace(ARTICOLI_DETTA, "").trim();
  if (normCibo(s).length < 3) return false;
  const trovati = ingredientiDetti(s, data, pasto);
  if (!trovati.length) {
    if (tipo === "togli" && !pasto && !giorni.length) return false;   // non è nei pasti: forse è altro (si prova con gli altri comandi)
    avviso(`Non trovo «${s}» ${dovePastoDetta(pasto, data)}`); return true;
  }
  if (tipo === "porta" && !(nuovaQ >= 1 && nuovaQ <= 2000)) return false;
  const applica = (v) => {
    const g = giornoDiario(data), p = g.pasti[v.pi], ing = p && (p.ingredienti || [])[v.ii]; if (!ing) { closeModal(true); return; }
    const ingrPrima = clone(p.ingredienti);
    if (tipo === "togli") p.ingredienti.splice(v.ii, 1);
    else p.ingredienti[v.ii] = { nome: ing.nome, qta: nuovaQ, unita: UNITA_LIQUIDI.test(ing.nome) ? "ml" : "g", lock: true, cercato: ing.cercato || ing.nome };
    if (!p.ingredienti.length) g.pasti.splice(v.pi, 1); else { delete p.auto; rinominaLibero(p, ingrPrima); aggiornaMacro(p); }
    scriviGiorno(data, g);
    closeModal(true); if (typeof renderOggi === "function") renderOggi();
    avviso(tipo === "togli" ? `Tolto: ${v.nome.toLowerCase()}` : `${v.nome}: ${nuovaQ} g`);
  };
  const conferma = (v) => {   // solo la domanda e due pulsanti
    if (tipo === "togli") chiediConferma(`${sicuraDetta()} di voler eliminare ${cosaDetta(v.nome, v.qta)}?`, "", "Togli", () => applica(v));
    else chiediConferma(`${sicuraDetta()} di voler portare ${/.[A-ZÀ-Ý]/.test(v.nome) ? v.nome : v.nome.toLowerCase()} da ${Math.round(v.qta)} a ${nuovaQ} ${UNITA_LIQUIDI.test(v.nome) ? "ml" : "g"}?`, "", "Cambia", () => applica(v));
  };
  editCtx = null; liberoCtx = null; vaiAlGiornoDetta(data);
  if (trovati.length === 1) { conferma(trovati[0]); return true; }
  openModal(`<h3 class="modal-title">Quale ${esc(s)}?</h3>
    <div class="detta-pasti">${trovati.map((v, k) => `<button class="btn-sec" data-voce-tp="${k}">${ICONA_PASTO[v.pasto] || "🍽️"} ${esc(NomePasto(v.pasto, data))}: ${esc(v.nome.toLowerCase())} ${Math.round(v.qta)} g</button>`).join("")}</div>`);
  document.querySelectorAll("[data-voce-tp]").forEach(b => b.addEventListener("click", () => conferma(trovati[+b.dataset.voceTp])));
  return true;
}

function inviaDettato(testo) {
  document.querySelectorAll(".detta-velo").forEach(v => v.remove());   // sicurezza: niente «Ti ascolto…» sopra la scelta del pasto
  testo = String(testo || "").trim();
  if (!testo) { avviso("Non ho sentito niente: riprova"); return; }
  // l'ordine conta: «quanto mi manca?» è una domanda, non la spesa; «peso 61» prima degli sport («pesi»)
  if (comandoDomanda(testo)) return;
  if (comandoPeso(testo)) return;
  if (comandoKcalGiorni(testo)) return;
  if (typeof comandoProfilo === "function" && comandoProfilo(testo)) return;   // Profilo e spostamenti (voce-profilo.js)
  if (SPESA_COMANDO.test(fraseDetta(testo))) { apriConfermaSpesa(testo); return; }
  if (comandoSostituisci(testo)) return;
  if (comandoTogliPorta(testo)) return;
  const cp = comandoCopia(testo); if (cp) { eseguiCopia(cp); return; }
  if (comandoAllenamento(testo)) return;
  // un altro giorno («domani a pranzo…», «giovedì a cena…»): si scrive in quel giorno
  const t0 = fraseDetta(testo), giorni = giorniNellaFrase(t0);
  const data = giorni.length ? dataDelGiorno(giorni[0], 1) : dataDetta();
  if (giorni.length) testo = togliGiorni(t0, giorni) || testo;
  const { pasto, resto } = pastoDaFrase(testo, data);
  if (pasto && resto) { apriPastoConDettato(pasto, resto, data); return; }
  // né un comando né un cibo che conosco («che tempo fa», «accendi la luce»): lo si dice, invece di chiedere in quale pasto scriverlo
  if (!righeDaParlato(resto || testo).some(x => x.r)) { nonCapitoDetta(testo, () => sceltaPastoDettato(testo, resto, data, giorni.length)); return; }
  sceltaPastoDettato(testo, resto, data, giorni.length);
}
// il pasto non l'hai detto: si sceglie con un tocco
function sceltaPastoDettato(testo, resto, data, conGiorno) {
  const momenti = momentiGiorno(data);
  editCtx = null; liberoCtx = null;
  openModal(`<h3 class="modal-title">In quale pasto?</h3>
    ${conGiorno ? `<p class="hint">${esc(fmtGiornoLungo(data))}</p>` : ""}
    <p class="detta-frase">«${esc(testo)}»</p>
    <div class="detta-pasti">${momenti.map(p => `<button class="btn-sec" data-detta-pasto="${p}">${ICONA_PASTO[p] || "🍽️"} ${esc(NomePasto(p, data))}</button>`).join("")}</div>`);
  document.querySelectorAll("[data-detta-pasto]").forEach(b => b.addEventListener("click", () => { closeModal(true); apriPastoConDettato(b.dataset.dettaPasto, resto || testo, data); }));
}
// «Non ho capito»: la frase, la guida dei comandi e, se era un cibo che non conosco, la scelta del pasto (lì si può cercare o crearlo)
function nonCapitoDetta(testo, comePasto) {
  editCtx = null; liberoCtx = null;
  openModal(`<h3 class="modal-title">🤔 Non ho capito</h3>
    <p class="detta-frase">«${esc(testo)}»</p>
    <p class="hint">Non è uno dei comandi che conosco e non ci ho trovato cibi. Riprova con altre parole, oppure guarda cosa puoi dire.</p>
    <div class="lib-detta"><div class="barra-due"><button class="btn-sec" data-chiudi>Chiudi</button><button class="btn" id="detta-nc-guida">🎤 Comandi vocali</button></div></div>
    <button class="btn-link" id="detta-nc-pasto">È un cibo che non conosco? Scegli il pasto ›</button>`);
  document.getElementById("detta-nc-guida").addEventListener("click", () => { closeModal(true); apriComandiVocali(); });
  document.getElementById("detta-nc-pasto").addEventListener("click", () => { closeModal(true); comePasto(); });
}
function apriPastoConDettato(pasto, testo, dataScelta) {
  const data = dataScelta || dataDetta();
  vaiAlGiornoDetta(data);   // si torna in Oggi, sul giorno giusto: è lì che il pasto si vede
  apriPastoDiario(data, null, pasto);
  if (!liberoCtx || liberoCtx.pasto !== pasto) return;
  aggiungiDaParlato(testo);
  rirenderLibero();
}
// ---------- Profilo → «Comandi vocali»: cosa si può dire a 🎤 Detta ----------
const COMANDI_VOCALI = [
  ["🍽️", "Scrivere un pasto", "Di' il pasto e cosa hai mangiato: si apre il pasto con gli alimenti da confermare. Le quantità che non dici sono adatte ai tuoi obiettivi.",
    ["a pranzo 150 g di riso e un'insalata", "a colazione yogurt greco e un cappuccino", "spuntino di pomeriggio una banana", "a cena pollo e zucchine"]],
  ["📅", "Un altro giorno", "Di' anche il giorno: si scrive in quel giorno.",
    ["domani a pranzo riso basmati e tonno", "giovedì a cena 150 g di pollo e zucchine", "dopodomani a colazione yogurt greco", "lunedì prossimo a pranzo pasta al pomodoro"]],
  ["📋", "Copiare un pasto", "I piatti finiscono in «Da aggiungere» del pasto di destinazione: li controlli e tocchi ✓ Aggiungi.",
    ["rifai il pranzo di ieri anche oggi", "ripeti la colazione di ieri", "copia la cena di lunedì su giovedì", "copia il pranzo di oggi anche a cena", "metti domani lo stesso pranzo di oggi", "rifai come ieri a cena"]],
  ["🔄", "Sostituire un alimento", "Carne, pesce, uova e latticini: stesse proteine. Il resto: stesse calorie. Se dici i grammi valgono quelli. Funziona sui pasti già scritti.",
    ["sostituisci il pollo con il tacchino", "cambia il riso con le patate a cena", "metti il merluzzo al posto del pollo domani", "tacchino invece del pollo", "sostituisci il pollo con 150 g di tacchino"]],
  ["✂️", "Togliere o cambiare la quantità", "Su un alimento già scritto: prima vedi cosa cambia, poi confermi.",
    ["togli il pane dal pranzo", "togli il pollo dalla cena di ieri", "porta il riso a 200 grammi", "porta il riso del pranzo a 150 g", "metti l'olio a 5 grammi"]],
  ["🛒", "Lista della spesa", "Vedi le voci capite (con il cestino ne togli una), poi tocchi Aggiungi.",
    ["aggiungi albumi alla spesa", "mi manca il pollo", "devo comprare gli albumi e le zucchine", "ho finito lo yogurt greco", "non c'è più il pane", "scrivi nella spesa detersivo piatti e carta forno"]],
  ["⚖️", "Peso", "Vale per oggi o per i giorni passati. Vedi la differenza dall'ultima pesata, poi Salva.",
    ["peso 61,4", "stamattina pesavo 61 e 4", "mi sono pesata 61 chili e 400", "ieri pesavo 61,8"]],
  ["📊", "Quanto manca", "Calorie, proteine, carboidrati e grassi che restano (in rosso quelli superati).",
    ["quanto mi manca?", "quante proteine mi mancano?", "quanti carboidrati mi restano?", "a che punto sono?"]],
  ["💡", "Idee e consigli", "Con un pasto: quel pasto con le sue idee. Senza: i consigli furbi della giornata.",
    ["cosa mangio a cena?", "cosa preparo a pranzo?", "idee per la merenda", "cosa aggiungo?", "cosa mi consigli?"]],
  ["🔥", "Calorie dei giorni", "Cambia le calorie di uno o più giorni: poi scegli se compensare negli altri giorni o cambiare il totale della settimana. In Settimana valgono i giorni della settimana che stai guardando. Mai sotto il metabolismo basale.",
    ["imposta martedì e mercoledì 1800 calorie, giovedì e venerdì 1200", "sabato 2000 kcal", "domani 1500 calorie", "metti 1600 calorie a lunedì prossimo"]],
  ["🏋️", "Allenamento", "Si apre la scheda Allenamenti del giorno già compilata: controlli e tocchi ✓ Salva. Lo sport deve essere tra i tuoi (Profilo).",
    ["oggi ho fatto un'ora di CrossFit", "ho corso 6 km", "45 minuti di pesi e mezz'ora di camminata", "domani alle 7 di sera CrossFit", "mi alleno alle 18", "domani riposo", "oggi niente allenamento"]],
  ["🗓️", "Settimana tipo", "Gli sport di ogni giorno della settimana tipo (vale per tutte le settimane). «Aggiungi» o «anche» aggiunge allo sport che c'è già.",
    ["di solito il lunedì CrossFit e il giovedì equitazione", "il mercoledì riposo", "il sabato CrossFit e pesi", "dal lunedì al venerdì camminata", "nel weekend riposo", "il sabato CrossFit 90 minuti", "aggiungi pesi al venerdì di solito"]],
  ["⏱️", "Durata e orario di solito degli sport", "La durata normale di uno sport e l'ora in cui ti alleni di solito (decide il pasto prima e quello dopo).",
    ["la sala pesi di solito dura 75 minuti", "la corsa di solito 8 km", "di solito mi alleno alle 18", "il CrossFit di solito alle 7"]],
  ["🏅", "I tuoi sport", "Aggiungere uno sport nuovo (con l'intensità) o toglierne uno.",
    ["aggiungi lo sport arrampicata intensità media", "aggiungi lo sport nuoto intensa", "togli il ballo dai miei sport"]],
  ["⏰", "Orari e pasti che fai", "A che ora mangi e quali pasti fai ogni giorno.",
    ["pranzo alle 13:30", "di solito ceno alle 20", "la merenda alle 17", "colazione alle 7 e cena alle 20:30", "non faccio più lo spuntino", "faccio anche la merenda", "aggiungi il dopo cena ai miei pasti"]],
  ["🥗", "Alimentazione e allergie", "Le ricette e i consigli con questi cibi non ti vengono più proposti.",
    ["non mangio i funghi", "non mi piacciono i kiwi e i finocchi", "sono intollerante al lattosio", "sono allergica alle noci", "sono celiaca", "sono vegetariana", "non sono più vegetariana", "adesso mangio i funghi", "non sono più allergica alle noci"]],
  ["✨", "Obiettivo e numeri", "Obiettivo, deficit, proteine, grassi, calorie scritte a mano, metabolismo basale.",
    ["voglio mettere massa", "passa a mantenimento", "voglio definire", "deficit 15%", "proteine 2 grammi per chilo", "grassi 0,8 per chilo", "proteine 120 grammi al giorno", "obiettivo 1800 calorie al giorno", "calcolo automatico", "basale 1350", "basale automatico", "reintegra il 60% dell'allenamento"]],
  ["🙋", "I tuoi dati", "Il metabolismo basale (se lo calcola l'app) si aggiorna da solo.",
    ["ho 35 anni", "sono alta 1,68", "sono un uomo", "peso 61,4"]],
  ["🔥", "Obiettivo della settimana", "Il totale delle calorie della settimana (i giorni se lo dividono).",
    ["obiettivo della settimana 12000 calorie", "settimana prossima 12500 calorie", "12000 calorie ogni settimana", "togli l'obiettivo della settimana"]],
  ["🎨", "Personalizza", "Colore, tema, nome e icona dell'app, il tuo nome, vibrazione.",
    ["colore azzurro", "tema chiaro", "chiama l'app Fit di Anna", "chiamami Anna", "icona fiore", "togli la vibrazione", "attiva la vibrazione"]],
  ["🧭", "Spostarsi nell'app", "Apre la sezione che dici.",
    ["apri la lista della spesa", "apri il profilo", "vai alle ricette", "apri l'andamento", "vai alla settimana prossima", "apri la cena di domani", "vai a ieri", "apri il backup", "rifai il questionario"]],
];
function apriComandiVocali() {
  editCtx = null; liberoCtx = null;
  openModal(`<button class="btn-link modal-indietro" data-cv-altro>‹ Profilo</button>
    <h3 class="modal-title">🎤 Comandi vocali</h3>
    <p class="hint">Tocca <b>🎤 Detta</b> (in basso): il pulsante diventa bianco e compare l'onda. Parla, poi tocca di nuovo 🎤 per finire. Prima di salvare ti mostro sempre cosa farò: niente cambia senza il tuo tocco. Un comando per volta.</p>
    <div class="cv-lista">${COMANDI_VOCALI.map(([ico, tit, nota, es], k) => `<details class="cv-sez"${k === 0 ? " open" : ""}>
      <summary><span class="cv-ico">${ico}</span><b>${esc(tit)}</b></summary>
      <p class="cv-nota">${esc(nota)}</p>
      <ul class="cv-es">${es.map(x => `<li>«${esc(x)}»</li>`).join("")}</ul></details>`).join("")}</div>
    <h4>Giorni e pasti</h4>
    <p class="cv-nota"><b>Giorni:</b> oggi, ieri, l'altro ieri, domani, dopodomani, stamattina e stasera (= oggi), lunedì…domenica, anche con «prossimo» o «scorso». Se non lo dici vale il giorno aperto in Oggi.</p>
    <p class="cv-nota"><b>Pasti:</b> colazione · spuntino di metà mattina (o «spuntino mattutino») · pranzo · merenda (anche «spuntino di pomeriggio», «spuntino pomeridiano», «pre-workout») · cena · dopo cena (anche «spuntino serale»). «Spuntino» da solo: se ne hai uno solo è quello, altrimenti quello del momento.</p>
    <p class="cv-nota"><b>Sport:</b> CrossFit, pesi/palestra, funzionale, corsa, camminata, bici, nuoto, yoga/pilates, padel/tennis, ballo, equitazione, calcio/pallavolo/basket e quelli che hai aggiunto tu (per nome).</p>
    <p class="cv-nota">Se il microfono dell'app non funziona, Detta apre un campo: lì usa il 🎤 della tastiera, le frasi sono le stesse.</p>`);
  const b = document.querySelector("[data-cv-altro]"); if (b) b.addEventListener("click", () => { closeModal(true); apriMenu(); segnaTab("altro"); });
}
// telefono senza riconoscimento vocale (o microfono non permesso): il campo dove scrivere (o dettare con la tastiera)
function apriDettaTesto(nota) {
  editCtx = null; liberoCtx = null;
  openModal(`<h3 class="modal-title">🎤 Cosa hai mangiato?</h3>
    ${nota ? `<p class="hint">${nota}</p>` : ""}
    <div class="lib-detta"><textarea id="detta-oggi" class="qta-input" rows="3" autocomplete="off" autocapitalize="sentences" placeholder="es. a colazione 150 g di yogurt greco e un cappuccino"></textarea>
    <div class="barra-due"><button class="btn-sec" data-chiudi>Annulla</button><button class="btn" id="detta-oggi-invia">Continua</button></div>
    <p class="campo-nota">Tocca il 🎤 della tastiera e parla, oppure scrivi. Di' anche il pasto («a pranzo…»); poi controlli le quantità e tocchi ✓ Aggiungi.</p>
    <p class="campo-nota">Puoi anche dire: «domani a pranzo riso e tonno» · «rifai il pranzo di ieri» · «aggiungi albumi alla spesa» · «peso 61,4» · «quanto mi manca?» · «sostituisci il pollo con il tacchino» · «oggi un'ora di CrossFit».</p>
    <button class="btn-link" data-detta-guida>🎤 Tutti i comandi vocali ›</button></div>`);
  const gd = document.querySelector("[data-detta-guida]"); if (gd) gd.addEventListener("click", () => { closeModal(true); apriComandiVocali(); });
  const ta = document.getElementById("detta-oggi"); if (ta) ta.focus();
  document.getElementById("detta-oggi-invia").addEventListener("click", () => { const v = document.getElementById("detta-oggi").value; if (!v.trim()) { avviso("Scrivi o detta cosa hai mangiato"); return; } closeModal(true); inviaDettato(v); });
}
// tocca e parla: il tasto «Detta» della barra in basso (come i vocali di WhatsApp: si vede quando ti sente, l'onda e la frase mentre parli).
// Con un pasto aperto quello che dici va in quel pasto; altrimenti nel pasto che nomini («a colazione…») o in quello che scegli
// dove il microfono dell'app non funziona: dalla barra il campo per scrivere, nel pasto la ricerca (lì si detta con il 🎤 della tastiera)
// c'è un pasto aperto (il suo pannello, con il campo di ricerca)? allora si detta in quello
const pastoApertoPerDetta = () => !!(liberoCtx && liberoCtx.vivo && !document.getElementById("modal").hidden && document.getElementById("lib-input"));
function micRipiego(modo, nota) {
  if (pastoApertoPerDetta()) modo = "pasto";
  if (modo === "pasto" && liberoCtx) {
    const i = document.getElementById("lib-input"); if (i) { i.placeholder = "Detta o scrivi…"; i.focus(); }
    if (nota) avviso(nota); return;
  }
  apriDettaTesto(nota);
}
function micTesto(modo, testo) {
  // con la lista della spesa aperta quello che dici va in lista («latte scremato tre confezioni»), anche senza «alla spesa»
  if (document.getElementById("spesa-nuova") && !document.getElementById("modal").hidden) { apriConfermaSpesa(testo); return; }
  if (pastoApertoPerDetta()) modo = "pasto";
  if (modo === "pasto" && liberoCtx && SPESA_COMANDO.test(fraseDetta(testo))) { apriConfermaSpesa(testo); return; }   // «aggiungi albumi alla spesa» anche da dentro un pasto
  if (modo === "pasto" && liberoCtx) {   // dentro un pasto si resta in quel pasto: «a cena…» detto nel pranzo va nel pranzo
    aggiungiDaParlato(pastoDaFrase(testo).resto || testo); rirenderLibero(); return;
  }
  inviaDettato(testo);
}
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // stato: null (spento) · "avvio" (il microfono si sta accendendo: NON ti sente ancora) · "ascolto" (ti sente) · "chiudo" (finito, aspetto le ultime parole)
  let stato = null, rec = null, testoGiri = "", testoGiro = "", errore = null, partito = false, modo = "barra", bottone = null;
  let ultimoTocco = 0, inizioAscolto = 0, giri = 0, timerFine = null, timerOnda = null, timerAvvio = null, timerSente = null;
  // l'onda sonora si muove con la voce che il telefono sta riconoscendo (niente secondo microfono: su iPhone fermava il riconoscimento)
  let livello = 0, storia = [];
  const N_BARRE = 28;
  const testoTutto = () => (testoGiri + " " + testoGiro).replace(/\s+/g, " ").trim();
  const disegnaOnda = () => {
    const box = document.querySelector(".detta-velo .detta-barre"); if (!box) return;
    const vivo = stato === "ascolto";
    livello *= 0.8;
    storia.push(vivo ? livello : 0); if (storia.length > N_BARRE) storia.shift();
    const barre = box.children, t = Date.now();
    for (let i = 0; i < barre.length; i++) {
      const v = storia[i - (N_BARRE - storia.length)] || 0;
      // nel silenzio le barre «respirano» un poco: si vede che il microfono è acceso e aspetta
      const h = vivo ? Math.max(0.14 + 0.08 * Math.sin(t / 240 + i * 0.6), v) : 0.08;
      barre[i].style.transform = `scaleY(${h.toFixed(3)})`;
    }
  };
  const togliTuttiVeli = () => document.querySelectorAll(".detta-velo").forEach(v => v.remove());
  // il riquadro: solo l'onda sonora e la frase che si scrive mentre parli. Nessun pulsante: si finisce ritoccando 🎤
  const aggiornaVelo = () => {
    const velo = document.querySelector(".detta-velo"); if (!velo) return;
    velo.dataset.stato = stato || "";
    const t = testoTutto(), l = velo.querySelector(".detta-live");
    if (l) { l.textContent = t || (stato === "ascolto" ? "Parla… poi tocca 🎤 per finire" : ""); l.classList.toggle("vuoto", !t); l.scrollTop = l.scrollHeight; }
  };
  const mostraVelo = () => {
    togliTuttiVeli();
    const velo = document.createElement("div"); velo.className = "detta-velo";
    velo.innerHTML = `<div class="detta-bolla" role="status" aria-live="polite">
      <div class="detta-barre" aria-hidden="true">${"<i></i>".repeat(N_BARRE)}</div>
      <p class="detta-live"></p></div>`;
    document.body.appendChild(velo);
    storia = []; clearInterval(timerOnda); timerOnda = setInterval(disegnaOnda, 70);
    aggiornaVelo();
  };
  const staccaRec = () => { if (rec) { const r = rec; rec = null; r.onend = null; r.onresult = null; r.onerror = null; r.onstart = null; r.onaudiostart = null; try { r.abort(); } catch (e) {} } };
  const spegni = () => {
    stato = null; clearTimeout(timerFine); clearTimeout(timerAvvio); clearTimeout(timerSente); clearInterval(timerOnda); timerOnda = null;
    if (bottone) bottone.classList.remove("ascolta", "avvio");
    togliTuttiVeli();
  };
  const finisci = () => {
    if (!stato) return;
    const testo = testoTutto(), err = errore, ok = partito;
    staccaRec(); spegni();
    if (testo) { micTesto(modo, testo); return; }
    if (!ok && err === "service-not-allowed") {   // su iPhone: la Dettatura è spenta
      micRipiego(modo, "Il riconoscimento vocale è spento: su iPhone attiva Impostazioni → Generali → Tastiera → Abilita dettatura. Intanto puoi usare il 🎤 della tastiera."); return;
    }
    if (!ok && err === "not-allowed") {
      micRipiego(modo, "Il microfono non è permesso per questa app: permettilo nelle impostazioni del telefono (Safari → Microfono). Intanto puoi usare il 🎤 della tastiera."); return;
    }
    if (!ok) { micRipiego(modo, "Qui il microfono dell'app non funziona: usa il 🎤 della tastiera."); return; }
    avviso("Non ho sentito niente: tocca 🎤 e riprova");
  };
  // di nuovo 🎤: il telefono consegna le ultime parole, poi si va avanti
  const fatto = () => {
    if (!stato || stato === "chiudo") return;
    if (stato === "avvio" && !partito) { annulla(); return; }   // ritoccato prima che si accendesse: si annulla e basta
    stato = "chiudo"; aggiornaVelo();
    if (bottone) bottone.classList.remove("ascolta", "avvio");
    if (typeof vibra === "function") vibra();
    try { rec ? rec.stop() : finisci(); } catch (e) { finisci(); }
    clearTimeout(timerFine); timerFine = setTimeout(finisci, 1200);   // se il telefono non avvisa della fine, si va avanti lo stesso
  };
  const annulla = () => { if (!stato) return; staccaRec(); spegni(); };
  const sente = () => {
    if (stato !== "avvio") return;
    partito = true; stato = "ascolto"; clearTimeout(timerAvvio); clearTimeout(timerSente);
    if (bottone) { bottone.classList.remove("avvio"); bottone.classList.add("ascolta"); }
    if (typeof vibra === "function") vibra();   // un tic: ora ti sente
    aggiornaVelo();
  };
  // un «giro» di ascolto. L'iPhone smette di ascoltare da solo dopo un attimo di silenzio: finché non tocchi Fatto si riparte,
  // e quello già sentito resta (così si può fare una pausa, o cominciare a parlare con calma)
  const ascolta = () => {
    const r = new SR(); rec = r; r.lang = "it-IT"; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    testoGiro = "";
    // «Ti sento» quando il microfono è davvero acceso (audiostart); dove non c'è, poco dopo l'avvio
    r.onaudiostart = () => { if (rec === r) sente(); };
    r.onstart = () => { if (rec === r && stato === "avvio") { clearTimeout(timerSente); timerSente = setTimeout(sente, 300); } };
    r.onspeechstart = r.onsoundstart = () => { if (rec === r) livello = Math.max(livello, 0.4); };
    r.onresult = (e) => {
      if (rec !== r) return;
      sente();
      // il testo del giro si ricostruisce ogni volta da tutti i risultati: su iPhone gli stessi risultati arrivano più volte e il testo si raddoppiava
      const pezzi = [];
      for (let i = 0; i < e.results.length; i++) {
        const x = (e.results[i][0] && e.results[i][0].transcript || "").trim(); if (!x) continue;
        const prima = pezzi[pezzi.length - 1];
        if (prima && (x === prima || x.startsWith(prima))) pezzi[pezzi.length - 1] = x;   // lo stesso pezzo ripetuto (o allungato)
        else if (!(prima && prima.endsWith(x))) pezzi.push(x);
      }
      const nuovo = pezzi.join(" ");
      if (nuovo.length !== testoGiro.length) livello = Math.max(livello, 0.55 + Math.random() * 0.45);
      testoGiro = nuovo;
      aggiornaVelo();
    };
    r.onerror = (e) => { if (rec === r) errore = e.error || "errore"; };
    r.onend = () => {
      if (rec !== r) return;
      if (testoGiro) { testoGiri = (testoGiri + " " + testoGiro).trim(); testoGiro = ""; }
      const bloccato = errore === "not-allowed" || errore === "service-not-allowed" || errore === "audio-capture";
      // si riparte anche se si è fermato prima di sentirti (su iPhone capita un «no-speech» appena acceso): al massimo 5 secondi, poi il campo per scrivere
      if ((stato === "ascolto" || stato === "avvio") && !bloccato && giri < 40 && Date.now() - inizioAscolto < 90000) {
        giri++; errore = null;
        try { ascolta(); } catch (x) { finisci(); }   // se il telefono non lascia ripartire: si tiene quello già detto
        return;
      }
      finisci();
    };
    r.start();
  };
  const avvia = (b) => {
    modo = b.dataset.mic; bottone = b;
    if (!SR) { micRipiego(modo); return; }
    testoGiri = ""; testoGiro = ""; errore = null; partito = false; giri = 0; inizioAscolto = Date.now(); livello = 0;
    staccaRec();   // un ascolto alla volta
    stato = "avvio"; b.classList.add("avvio");
    mostraVelo();
    try { ascolta(); }
    catch (e) { staccaRec(); spegni(); micRipiego(modo, "Su questo telefono il microfono dell'app non è disponibile: usa il 🎤 della tastiera."); return; }
    // il microfono non si accende entro 5 secondi: il campo per scrivere (o dettare con la tastiera)
    timerAvvio = setTimeout(() => { if (stato === "avvio") finisci(); }, 5000);
  };
  // 🎤 Detta: un tocco accende (il tocco intero: su iPhone il microfono parte solo così), un altro tocco finisce
  document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest("[data-mic]")) e.preventDefault(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-mic]"); if (!b) return;
    e.preventDefault();
    if (Date.now() - ultimoTocco < 400) return;   // il doppio tocco dell'iPhone: uno solo
    ultimoTocco = Date.now();
    if (stato) { fatto(); return; }
    if (typeof vibra === "function") vibra();
    avvia(b);
  });
  // l'app va in secondo piano: quello già detto si tiene
  document.addEventListener("visibilitychange", () => { if (document.hidden && stato) fatto(); });
  // mentre ascolta i tocchi sul resto della pagina non fanno niente (niente pasti aperti per sbaglio); il riquadro toccato finisce, come 🎤
  document.addEventListener("click", (e) => {
    if (!stato || !e.target.closest) return;
    if (e.target.closest(".detta-bolla")) { e.preventDefault(); fatto(); return; }
    if (e.target.closest("[data-mic]")) return;
    e.preventDefault(); e.stopPropagation();
  }, true);
})();
