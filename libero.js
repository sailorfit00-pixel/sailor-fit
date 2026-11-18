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
  tonno: "Tonno in scatola al naturale", riso: "Riso basmati cotto", pasta: "Pasta di semola", pane: "Pane integrale",
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
    const opz = JOLLY[k].filter(n => window.ALIMENTI[n] && !esclusi.includes(n)).slice(0, 3).map(n => {
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
function apriEditorPasto(ctx, items, nome, ricalcola = true) {
  editCtx = null;
  liberoCtx = Object.assign({ items: items || [], nome: nome || "", ignoto: null }, ctx);
  if (ricalcola && liberoCtx.items.length) ricalcolaLibero();
  openModal(liberoHTML());
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
  }).map(quota).sort((a, b) => (b.q - a.q) || (a.k - b.k)).slice(0, n);
}
function ricetteTestoHTML(q, attr) {
  const lista = cercaRicetteTesto(q);
  if (!lista.length) return "";
  return `<div class="autoc-titolo">📖 Ricette</div>` + lista.map(({ r, ps }) =>
    `<button class="autoc-voce autoc-ricetta" ${attr}="${esc(r.nome)}"><b>${esc(r.nome)}</b>${macroStileHTML(ps.tot)}</button>`).join("");
}
// Piatti composti da più alimenti diversi: non sono ingredienti. (Il modo di cuocere o preparare un alimento — lesso, al forno, arrosto, carpaccio — resta un ingrediente.) Nel pasto si trovano insieme alle ricette; nelle ricette non si propongono.
const PIATTI_PRONTI = new Set(["Hamburger di manzo", "Pizza margherita", "Pizza marinara", "Pizza diavola", "Pizza capricciosa", "Pizza quattro formaggi", "Pizza al taglio", "Pizza bianca mozzarella funghi e speck", "Sushi", "Panino hamburger", "Panino con prosciutto", "Aperitivo condiviso (tagliere)", "Crostata alla marmellata", "Torta (ciambellone)", "Tiramisù",
  "Polpette di manzo", "Polpette di pollo o tacchino", "Hamburger di pollo", "Cotoletta di pollo impanata", "Cotoletta alla milanese", "Spezzatino di manzo", "Bastoncini di pesce",
  "Frittata", "Frittata di albumi", "Gyoza", "Involtini primavera", "Tempura di gamberi", "Pollo al curry", "Nigiri", "Maki", "Uramaki", "Poke bowl", "Zuppa di miso", "Ramen (noodles in brodo)", "Purè di patate", "Crocchette di patate",
  "Pasta al pomodoro", "Pasta al ragù", "Pasta alla carbonara", "Pasta cacio e pepe", "Pasta al pesto", "Pasta all'amatriciana", "Lasagne", "Tortellini", "Ravioli ricotta e spinaci", "Risotto ai funghi", "Risotto alla milanese", "Riso alla cantonese", "Insalata di riso", "Minestrone", "Zuppa di legumi", "Vellutata di zucca", "Crema di verdure",
  "Caponata", "Bruschetta al pomodoro", "Tramezzino", "Toast prosciutto e formaggio", "Burger vegetale", "Falafel", "Porridge (avena col latte)", "Brownie", "Muffin", "Pancake", "Cheesecake",
  "Nachos con formaggio", "Quesadilla", "Paella", "Pad thai", "Hot dog", "Club sandwich", "Nuggets di pollo", "Waffle", "Crepes dolci", "Supplì", "Crostini", "Caprese", "Ossobuco", "Saltimbocca alla romana", "Brasato", "Stufato di manzo", "Ribollita", "Panzanella", "Smoothie di frutta", "Frullato proteico", "Poke bowl"]);
function mostraAutocompleta(testo) {
  const box = document.getElementById("lib-autoc");
  if (!box) return;
  const ultima = String(testo || "").split(/[,;+]/).pop();
  const q = ultima.replace(AUTOC_LEAD, "").trim();
  if (!q) { box.innerHTML = ""; return; }
  const gia = new Set((liberoCtx.items || []).map(x => x.nome));
  const nq = norm(q);
  const trovati = cercaAlimenti(q).filter(n => !gia.has(n));
  // prima quelli che iniziano per quello che hai scritto
  trovati.sort((a, b) => (norm(b).startsWith(nq) - norm(a).startsWith(nq)));
  const ricetteHTML = String(testo || "").includes(",") ? "" : ricetteTestoHTML(q, "data-autoc-ricetta");
  const voce = (n) => `<button class="autoc-voce" data-autoc="${esc(n)}">${esc(n)}</button>`;
  const ingr = trovati.filter(n => !PIATTI_PRONTI.has(n)).slice(0, 6).map(voce).join("");       // alimenti singoli
  const piatti = trovati.filter(n => PIATTI_PRONTI.has(n)).slice(0, 4).map(voce).join("");      // già composti
  // sopra i singoli ingredienti, sotto le ricette (i piatti già composti stanno con le ricette)
  const sotto = ricetteHTML + piatti;
  box.innerHTML = (ingr && sotto ? `<div class="autoc-titolo">🥕 Ingredienti</div>` : "") + ingr
    + (sotto && !ricetteHTML ? `<div class="autoc-titolo">📖 Ricette</div>` : "") + sotto;
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
  const trovati = cercaAlimenti(q).filter(n => n !== c.items[k].nome).slice(0, 6);
  if (!box) { box = document.createElement("div"); box.id = "lib-sost"; box.className = "lib-sost-lista"; cont.appendChild(box); }
  const riga = inp.closest(".sw") || inp.closest(".lib-riga");
  box.style.top = (riga.offsetTop + riga.offsetHeight + 2) + "px";
  box.innerHTML = trovati.length ? trovati.map(n => `<button class="autoc-voce" data-sost-scegli="${k}" data-nome="${esc(n)}">${esc(n)}</button>`).join("") : `<p class="hint">Nessun alimento trovato</p>`;
}
function sostituisciIngrediente(k, nome, grammi) {
  const c = liberoCtx, vecchio = c && c.items[k];
  if (!vecchio || !window.ALIMENTI[nome]) return;
  if (c.items.some((x, i) => i !== k && x.nome === nome)) { avviso("C'è già " + nome.toLowerCase() + " nel pasto."); return rirenderLibero(); }
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
  if (cb && cb.vivo) {   // primo inserimento in un pasto vuoto: prima la bozza (righe modificabili + "Aggiungi"), solo dopo la conferma va nel diario
    const nelDiario = giornoDiario(cb.data).pasti.some(p => p.pasto === cb.pasto);
    cb.bozza = !!cb.items.length && !nelDiario && !cb._conferma;
  }
  if (cb && cb.vivo && !cb.bozza && typeof cb.commit === "function") cb.commit(cb);   // dopo la conferma ogni modifica è già nel diario
  const sheet = document.querySelector(".modal-sheet");
  const sc = sheet ? sheet.scrollTop : 0;
  const pagina = !!(cb && (cb.ignoto || cb.ignotoNuovo || cb.scansione)), cambiata = !!cb && cb._pagina !== pagina;   // entrando o uscendo dal nuovo alimento si riparte dall'alto
  if (cb) cb._pagina = pagina;
  document.getElementById("modal-content").innerHTML = liberoHTML();
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
  "Pane bianco": ["Pane integrale"], "Pancarrè": ["Pane integrale"], "Pasta di semola": ["Pasta integrale"], "Pasta di semola cotta": ["Pasta integrale"],
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
  ["polvere", ["Proteine in polvere"]],
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
  ["Riso basmati cotto", "Riso integrale cotto", "Quinoa cotta", "Couscous cotto", "Patate lesse", "Patata dolce", "Pasta di semola cotta", "Riso bianco cotto", "Noodles di riso cotti"],
  ["Petto di pollo", "Fesa di tacchino", "Merluzzo", "Nasello", "Branzino", "Orata", "Gamberi", "Platessa", "Tofu"],
  ["Yogurt greco 0%", "Yogurt greco intero", "Yogurt bianco intero", "Fiocchi di latte", "Quark magro", "Ricotta", "Formaggio spalmabile light"],
  ["Pane integrale", "Pane bianco", "Pane di segale", "Pancarrè", "Gallette di riso", "Gallette di mais", "Gallette di quinoa", "Gallette di grano saraceno", "Fette biscottate integrali", "Crackers integrali"],
  ["Latte intero", "Latte parzialmente scremato", "Latte scremato", "Bevanda di soia", "Bevanda di avena", "Bevanda di mandorla"],
];
const VERDURE_CONSIGLI = ["Zucchine", "Spinaci", "Broccoli", "Insalata", "Pomodoro", "Carote", "Finocchi", "Cetriolo", "Rucola", "Asparagi", "Fagiolini"];
const GRAMMI_MAX_FONTI = { "Proteine in polvere": 30, "Albume": 200, "Yogurt greco 0%": 250, "Yogurt greco intero": 200, "Fiocchi di latte": 200, "Quark magro": 250, "Ricotta": 150, "Petto di pollo": 220, "Fesa di tacchino": 200, "Merluzzo": 250, "Nasello": 250, "Branzino": 200, "Orata": 200, "Tofu": 200, "Ceci cotti": 200, "Lenticchie cotte": 200, "Uova": 220, "Salmone fresco": 180 };
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
  const pre = typeof preSera === "function" && ((c.pasto === "spuntino" && preSera(c.data)) || (c.pasto === "mattina" && conSport(c.data) && orarioAllen(c.data) === "mattina"));
  const post = typeof pastoPost === "function" && pastoPost(c.data) === c.pasto;
  return { pre: !!pre, post: !!post };
}
const grassiAlimento = (nome, qta) => { const a = (window.ALIMENTI || {})[nome]; return a ? a[3] * (+qta || 0) / 100 : 0; };
const troppiGrassiPre = (nome, qta) => grassiAlimento(nome, qta) >= PRE_GRASSI_MAX;
// Sostituti pronti per un alimento (per chi non sa con cosa cambiarlo): dello stesso tipo, adatti al momento (pre-workout: niente grassi; post: tengono le proteine), con la quantità a parità di calorie.
// Ordinati dal più simile; ritorna tutti i candidati, chi li mostra ne prende tre per volta.
function alternativeSostituzione(c, nome, qta, k) {
  const A = window.ALIMENTI || {}, a0 = A[nome]; if (!a0) return [];
  const { pre, post } = contestoAllenamento(c);
  const dentro = new Set(c.items.map(x => x.nome));
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
    carbo: !righe.some(r => A[r.nome] && A[r.nome][2] >= 12 && g100(r, 2) >= 15),
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
      if (f > 1) nuova = Math.min(nuova, r.qta + 100, GRAMMI_MAX_FONTI[r.nome] || 300);
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
      const nuova = Math.min(Math.floor((r.qta + extra) / 5) * 5, r.qta + 100, GRAMMI_MAX_FONTI[r.nome] || 400);
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
    grammi.filter(g => g <= (GRAMMI_MAX_FONTI[n] || 300)).forEach(g => {
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
  if (gap.proteine > 10 && !famDentro.size && proteinePasto < 12) aggiungi(["Proteine in polvere"], [20, 25, 30], undefined, "prot");
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
  "Pasta di semola": ["Pasta integrale"], "Pasta di semola cotta": ["Pasta integrale"], "Farina 00": ["Farina integrale"], "Pancarrè": ["Pane integrale"], "Pane bianco": ["Pane integrale"],
  "Riso bianco cotto": ["Riso integrale cotto"], "Prosciutto cotto": ["Fesa di tacchino"], "Cioccolato al latte": ["Cioccolato fondente"], "Latte di cocco": ["Latte di cocco light"],
  "Granola": ["Fiocchi d'avena"], "Sciroppo d'acero": ["Sciroppo senza zucchero", "Eritritolo"], "Uova": ["Albume"], "Olio di semi": ["Olio EVO"], "Burro": ["Olio EVO"], "Panna da cucina": ["Yogurt greco 0%"], "Formaggio spalmabile (tipo Philadelphia)": ["Formaggio spalmabile light"],
};
const SEMPRE_MEGLIO = new Set(["Pasta di semola>Pasta integrale", "Pasta di semola cotta>Pasta integrale", "Farina 00>Farina integrale", "Pancarrè>Pane integrale", "Pane bianco>Pane integrale", "Riso bianco cotto>Riso integrale cotto", "Olio di semi>Olio EVO", "Cioccolato al latte>Cioccolato fondente"]);   // stesse calorie, più sani
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
    if (giaFit && ((a.tipo === "cambia" && giaFit.has(`cambia|${a.r.nome}|${a.a}`)) || (a.tipo === "porta" && giaFit.has(`porta|${a.r.nome}|${a.nuova}`)))) return null;   // già proposto in «Più fit»
    return { testa, html: `<button class="var-furbo lib-furbo" data-furbo-k="${esc(testa)}" ${attr}>${testa}</button>` };   // solo la mossa: il box si tocca per applicarla
  };
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
      <input id="lib-input" class="qta-input wiz-full" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="${c.items.length ? "Aggiungi altro: mirtilli, yogurt…" : "Scrivi cosa mangi: pollo, zucca…"}">
      <button class="btn-sec lib-scan" data-lib="scan" aria-label="Leggi il codice a barre">📷</button>
      <button class="btn lib-piu" data-lib="aggiungi" aria-label="Aggiungi ingrediente">＋</button>
    </div>
    <div id="lib-autoc" class="lib-autoc"></div>`;
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
    else g.pasti.push(clone(prima));
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
    const q = (it.unita || "g") === "q.b." && !(it.qta > 0) ? "q.b." : gu ? `${fmtQta(it.qta / gu)} ${NOMI[u] || u} <small>≈ ${Math.round(it.qta)} ${ug}</small>` : `${Math.round(it.qta)} ${ug}`;
    return `<li><span>${esc(it.nome)}</span><b>${q}</b></li>`;
  }).join("")}</ul>`;
}
const pastoPassatoC = (c) => !!(c && c.vivo && typeof pastoPassato === "function" && pastoPassato(c.data, c.pasto));
// Pasto già salvato e modificato in questa apertura: le modifiche sono già nel diario, il tasto «✓ Salva modifiche» lo conferma e chiude
const firmaPasto = (c) => JSON.stringify((c.items || []).map(it => [it.nome, Math.round((+it.qta || 0) * 10) / 10, it.unita || ""]));
function pastoModificato(c) {
  if (!c || !c.vivo || c.bozza) return false;
  if (c._firma0 === undefined || c._firma0 === "[]") { c._firma0 = firmaPasto(c); c._giorno0 = JSON.stringify(leggiDiario()[c.data] || null); return false; }   // com'era quando l'hai aperto (un pasto vuoto appena riempito non conta come modifica); il giorno serve per «Annulla»
  return firmaPasto(c) !== c._firma0;
}
// «Altre idee» per un pasto già scritto (es. compilato dall'app): fino a 3 ricette simili che stanno nelle calorie e nei macro
// che restano nella giornata (contando gli altri pasti, non questo). ↻ ne mostra altre 3; toccandone una sostituisce il pasto.
function altreIdeeHTML(c) {
  if (!c || !c.vivo || c.bozza || !c.items.length || typeof ricetteConsigliate !== "function") return "";
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
    <div class="sugg-ricette">${tutte.slice(pg * 3, pg * 3 + 3).map(x => `<button class="riga-ricetta con-piu" data-oggi-ricetta="${esc(x.r.nome)}"><span class="rr-nome">${esc(x.nome || x.r.nome)}</span>${macroStileHTML(x.tot)}<span class="rr-piu" role="button" aria-label="Aggiungi subito">＋</span></button>`).join("")}</div></div>`;
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
  const r = ricette.find(x => x.nome === nomeRicetta && x.pasto === (c.pasto === "mattina" ? "spuntino" : c.pasto)) || ricette.find(x => x.nome === nomeRicetta);
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
  return `<div class="lib-riga"><div class="lib-nome-txt${classeNome(it.nome)}"><span class="lib-nome-t">${esc(it.nome)}</span></div>
      <div class="qstep"><button class="qstep-b" data-${p}-step="${k}|-1" aria-label="Meno">−</button>${input}<button class="qstep-b" data-${p}-step="${k}|1" aria-label="Più">＋</button></div>
      <div class="unita-box"><span class="unita-et ${(ABBR[u] || u).length > 3 ? "lunga" : ""}">${ABBR[u] || u}</span><select class="lib-unita-sel" data-${p}-unita="${k}" aria-label="Unità di misura">${opzioniUnita(it.nome).map(([v, l]) => `<option value="${v}" ${u === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <button class="lib-del" data-${p}-del="${k}" aria-label="Rimuovi">${ICONA_CESTINO}</button></div>`;
}
// nuova quantità (in grammi) dopo un tocco su − / ＋, con lo stesso passo del pannello
function qtaDopoStep(nome, qta, u, d) {
  const { gu, passo } = passoQuantita({ nome, qta, unita: u });
  const att = gu ? qta / gu : qta;
  const nuovo = gu ? prossimoMultiplo(att, d, passo)
    : Math.max(0, d > 0 ? (att < 10 ? Math.floor(att) + 1 : Math.floor(att / 10) * 10 + 10) : (att <= 10 ? Math.ceil(att) - 1 : Math.ceil(att / 10) * 10 - 10));
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
    <div class="barra-salva"><button class="btn block" data-ant-aggiungi>✓ Aggiungi</button></div>`;
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
  const a = anteprimaRicetta(c, c.anteprima), stato = c.fitApplicato, mosse = c.fitMosse;
  const finali = a ? anteprimaItemsModificati(c, a).filter(x => +x.qta > 0) : [], kFinale = a ? a.ps.k : null, nomeFinale = a ? a.ps.nome : null, mod = c.antQta || {}, cambiato = Object.keys(mod).length || Object.keys(c.antUni || {}).length || (a && a.ps.kMisura != null && a.ps.k !== a.ps.kMisura) || finali.some((x, i) => a && a.items[i] && Math.abs(x.qta - a.items[i].qta) > 0.5);   // anche se i pezzi interi hanno cambiato un po' i grammi
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
      p.ingredienti = finali.map(x => Object.assign({ nome: x.nome, qta: +x.qta, unita: "g", lock: true, cercato: x.nome }, x.u && x.u !== "g" ? { vis: x.u } : {}));   // vis = l'unità con cui l'hai scelta (pz, cucchiai…)
      if (kFinale) { p.nPezzi = kFinale; if (nomeFinale) p.nome = nomeFinale; }
      aggiornaMacro(p); scriviGiorno(c.data, g);
    }
  }
  if (typeof renderOggi === "function") renderOggi();
  c._firma0 = undefined;   // appena aggiunto: non è una modifica da salvare
  ricaricaViva(c);
  const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = 0;
  avviso(stato ? "✓ Aggiunta, più fit" : "✓ Aggiunta");
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
    const sel = `<div class="lib-nome-txt${classeNome(it.nome)}" role="button" tabindex="0" data-lib-nome-edit="${k}" aria-label="${esc(it.nome)} (tocca per cambiarlo)"><span class="lib-nome-t">${esc(it.nome)}</span></div>`; // testo che va a capo; al tocco diventa un campo
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
    return `<div class="lib-riga">
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
    const r0 = typeof ricettaDaNome === "function" ? ricettaDaNome(gr.ricetta) : null, o = r0 ? (r0._orig || r0) : null, passi = o && Array.isArray(o.passaggi) ? o.passaggi : [];
    return `<div class="pm-blocco pm-card pm-piatto pm-ricetta${aperta ? " aperto" : ""}" data-grp-box="${n}">
      <div class="pasto-riga pm-testa${bloccato ? " sola-lettura" : ""}" data-grp-t="${n}" data-grp-toggle="${n}" role="button" tabindex="0" aria-expanded="${aperta}">
        <span class="pr-testo"><b><i class="pr-check pm-ck">✓</i>${esc(gr.nome)}</b>${piuPiatti ? macroStileHTML(m, { senzaKcal: true }) : ""}</span>
        <span class="pr-kcal">${Math.round(m.kcal)}<small> kcal</small></span>${frecciaHTML(aperta)}
        <button class="lib-grp-del" data-grp-del="${n}" hidden tabindex="-1" aria-hidden="true"></button>
      </div>
      ${aperta ? `<div class="pm-dett">${bloccato ? righeSolaLetturaHTML(c.items.filter(x => x.grp === n)) : cont + htmlRighe}${passi.length ? `<ol class="pm-passi">${passi.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}</div>` : ""}
    </div>`;
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
    const riepilogo = !gu ? `${Math.round(it.qta)} ${ug} di ${nm}`
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
    const aperta = !!(c.vociAperte && c.vociAperte.has(it.nome));
    return `<div class="pm-blocco pm-card pm-piatto lib-voce${aperta ? " aperta" : ""}" data-voce="${esc(it.nome)}">
      <div class="pasto-riga pm-testa pm-ing lib-voce-testa${bloccato ? " sola-lettura" : ""}" data-voce-toggle="${esc(it.nome)}" role="button" tabindex="0" aria-expanded="${aperta}">
        <span class="pr-testo"><b><i class="pr-check pm-ck">✓</i>${esc(riepilogo)}${gu ? `<span class="pm-eq-riep"> ≈ ${Math.round(it.qta)} ${ug}</span>` : ""}</b>${piuPiatti ? macroStileHTML(m, { senzaKcal: true }) : ""}</span>
        <span class="pr-kcal">${Math.round(m.kcal)}<small> kcal</small></span>${avv && !aperta && !bloccato ? `<button class="lib-avv" data-lib-avv="${k}" aria-label="Prima dell'allenamento meglio senza grassi">⚠</button>` : ""}${avvT && !aperta && !bloccato ? `<button class="lib-avv" data-lib-avvt="${k}" aria-label="Tonno in scatola oltre il consigliato">⚠</button>` : ""}${frecciaHTML()}
        <button class="lib-voce-del" data-lib-del="${k}" hidden tabindex="-1" aria-hidden="true"></button>
      </div>${aperta && bloccato ? `<div class="pm-dett">${righeSolaLetturaHTML([it])}</div>` : aperta ? `<div class="pm-dett pm-riga-sola">${righeK[k].replace(/<button class="lib-del"[^>]*>[\s\S]*?<\/button>/, "").replace(/<div class="lib-nome-txt[^"]*"[^>]*>[\s\S]*?<\/div>/, "")}</div>` : ""}${avvT && !aperta && !bloccato && c.tonnoAperto === k ? `<div class="lib-avv-lista"><span class="avv-tonno">${esc(avvT)}</span>${alternativeTonno(it, k).map(x => `<button class="var-furbo lib-furbo" data-sost-scegli="${k}" data-nome="${esc(x.nome)}" data-g="${x.g}">${esc(x.nome.toLowerCase())} <b>${x.g} g</b></button>`).join("")}</div>` : ""}${avv && !aperta && !bloccato && c.avvAperto === k ? `<div class="lib-avv-lista">${alt2.map(x => `<button class="var-furbo lib-furbo" data-sost-scegli="${k}" data-nome="${esc(x.nome)}" data-g="${x.g}">${esc(x.nome.toLowerCase())} <b>${x.g} g</b></button>`).join("")}</div>` : ""}
    </div>`;
  };
  const parti = [];
  ordine.forEach(k => { const gp = c.items[k].grp == null ? null : c.items[k].grp; const ult = parti[parti.length - 1]; if (!ult || ult.grp !== gp) parti.push({ grp: gp, html: "", ks: [] }); const u = parti[parti.length - 1]; u.html += righeK[k]; u.ks.push(k); });
  const gruppiPresenti = [...new Set(c.items.filter(x => x.grp != null).map(x => x.grp))];
  const mPasto = gruppiPresenti.reduce((t, n) => { const g = macroGruppo(n); return { kcal: t.kcal + g.kcal, proteine: t.proteine + g.proteine, carboidrati: t.carboidrati + g.carboidrati, grassi: t.grassi + g.grassi }; }, macroDa(c.items.filter(x => x.qta > 0 && x.grp == null)));
  const kcalTot = Math.round(macroDa(c.items.filter(x => x.qta > 0 && x.grp == null)).kcal + [...new Set(c.items.filter(x => x.grp != null).map(x => x.grp))].reduce((s, n) => s + macroGruppo(n).kcal, 0));
  // un riquadro per ogni cosa mangiata, dall'ultima aggiunta alla prima (la riga appena aggiunta non ha ancora l'ora: è la più nuova)
  const quando = (k) => c.items[k].t == null ? Infinity : c.items[k].t;
  const schede = [];
  parti.forEach(x => x.grp === null
    ? x.ks.forEach(k => schede.push({ t: quando(k), k, html: voceHTML(k) }))
    : schede.push({ t: Math.min(...x.ks.map(quando)), k: Math.min(...x.ks), html: ricettaHTML(x.grp, x.html) }));
  schede.sort((p, q) => (q.t === p.t ? 0 : q.t > p.t ? 1 : -1) || (q.k - p.k));
  const righe = `<div class="pm-sezione${bloccato ? " bloccato" : ""}"><p class="pm-tot"><span>Già mangiato${bloccato ? ` <button class="pm-lucchetto" data-lib-sblocca aria-label="Pasto passato: tocca per sbloccare">🔒</button>` : pastoPassatoC(c) && c.items.length && !c.bozza && !c._creatoOra ? ` <button class="pm-lucchetto aperto" data-lib-riblocca aria-label="Pasto sbloccato: tocca per bloccarlo di nuovo">🔓</button>` : ""}</span><span class="pm-kcal"><b>${kcalTot} kcal</b>${T.kcal > 0 ? `<em> / ${Math.round(T.kcal)} kcal</em>` : ""}</span></p>${schede.map(x => x.html).join("")}</div>`;   // le kcal del pasto rispetto a quelle previste

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
  const righeBozza = ordine.map(k => righeK[k]).join("");
  const ingrLive = `<div class="lib-righe">${c.bozza ? righeBozza : righe}</div>
      ${avvPre.length ? `<div class="lib-legenda-avv" role="note">${avvPre.map(it => `<p><span aria-hidden="true">⚠</span> <b>${esc(it.nome)}</b>: ${fmtG(grassiAlimento(it.nome, it.qta))} g di grassi. Prima di allenarti meglio senza grassi: rallentano la digestione.</p>`).join("")}</div>` : ""}`;
  // inserendo un alimento nuovo si vede solo quello: niente idee né consigli; salvato o annullato, si torna al pasto
  if (c.anteprima) { const h = anteprimaHTML(c); if (h) return h; }
  if (ignoto) return `<button class="btn-link modal-indietro" data-lib="ignoto-annulla">‹ Torna al pasto</button>
    <h3 class="modal-title">${c.modificaAl ? "Modifica alimento" : "Nuovo alimento"}</h3>${ignoto}`;
  return `
    <h3 class="modal-title"><span class="mt-testo">${c.titolo()}</span></h3>
    ${bloccato ? "" : `<div class="lib-box">
    ${c.intestazione()}
    ${campoAggiungiHTML(c)}
    </div>`}
    ${ignoto}
    ${c.items.length ? `
      ${sopraGiornoHTML(c.data, c.bozza ? m.kcal : 0)}
      ${ingrLive}
      <div class="lib-risultato">
        <div class="r-macro">${macroHaObiettivoHTML(mPasto, T, true)}${post && avvisoPost(c, m) ? `<span class="avv-post" aria-label="Dopo l'allenamento servono proteine e carboidrati">⚠ ${avvisoPost(c, m)}</span>` : ""}</div>
      </div>
      ${pastoPassatoC(c) ? "" : furboBlocco}
      ${bloccato ? "" : altreIdeeHTML(c)}
    ` : c.idee()}
    ${c.bozza ? "" : bloccato ? "" : `<button class="btn-link link-ricette" data-azione="ricette-da-pasto">📖 Ricette ›</button>`}
    ${c.bozza ? `<div class="barra-salva"><button class="btn block lib-conferma" data-lib="conferma-bozza">✓ Salva pasto</button></div>` : !bloccato && pastoModificato(c) ? `<div class="barra-salva due"><button class="btn-sec danger" data-lib="annulla-modifiche">Annulla</button><button class="btn lib-conferma" data-lib="salva-modifiche">✓ Salva</button></div>` : ""}
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
  const pasto = c.pasto === "mattina" ? "spuntino" : (c.pasto || "spuntino");
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
function nomeAutomatico(items) {
  const n = items.map(x => { // tutti gli ingredienti, uno per uno; quelli a pezzi con la quantità davanti ("1 mela")
    const nome = (x.cercato || x.nome).toLowerCase();
    const u = x.qta ? unitaDi({ nome: x.nome, unita: x.unita }) : "g", gu = u === "pz" ? grammiPerUnita(x.nome, u) : 0;
    return gu ? nomeConNumero(x.nome, x.qta / gu) : nome; // 1 → "uovo"; più di uno → "2 uova"
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
    let qta = 0, lock = false;
    if (r.unita !== "q.b.") { qta = Math.round(grammiIng(r)); lock = qta > 0; }
    else if ((window.PORZIONE_INTERA || /$^/).test(r.nome) && (window.PESO_PZ || {})[r.nome]) { qta = window.PESO_PZ[r.nome]; lock = true; }
    if (!qta && r.unita === "q.b.") { const u = quantitaUsuale(r.nome); if (u > 0) { qta = u; lock = true; } }   // niente quantità scritta: quella che usi di solito, poi la cambi tu
    const gia = c.items.find(x => x.grp == null && x.nome === r.nome);
    if (gia) {   // c'è già nel pasto: le quantità si sommano (come nel diario) e te lo diciamo, invece di ignorarlo in silenzio
      if (!qta) qta = (window.PESO_PZ || {})[r.nome] || 0;   // senza quantità: un pezzo in più, se si conta a pezzi
      if (!qta) { avviso(`${r.nome} c'è già: cambia la quantità nella sua riga`); continue; }
      const prima = +gia.qta || 0;
      gia.qta = Math.round((prima + qta) * 10) / 10; gia.lock = true;
      const u = unitaDi(gia), gu = grammiPerUnita(gia.nome, u), ug = UNITA_LIQUIDI.test(gia.nome) ? "ml" : "g";
      const f = (q) => gu ? fmtQta(q / gu) : Math.round(q);
      avviso(`${gia.nome}: ${f(prima)} → ${f(gia.qta)} ${gu ? (u === "cucchiaio" ? "cucc." : u === "cucchiaino" ? "c.ino" : u) : ug}`);
      continue;
    }
    const unita = ["g", "ml"].includes(r.unita) ? "g" : ["pz", "cucchiaio", "cucchiaino"].includes(r.unita) ? r.unita : undefined; // l'unità che hai scritto
    c.items.push({ nome: r.nome, cercato: r.cercato, qta, lock, unita });
  }
  ricalcolaLibero();
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
      if (a === "aggiungi") { const inp = document.getElementById("lib-input"); aggiungiDaTesto(inp.value); c.addAperto = false; rirenderLibero(); }
      else if (a === "mostra-add") { c.addAperto = true; rirenderLibero(); const i2 = document.getElementById("lib-input"); if (i2) i2.focus(); }
      else if (a === "annulla-modifiche") {   // il pasto torna com'era quando l'hai aperto
        if (c._giorno0 !== undefined) { const d = leggiDiario(); if (c._giorno0 === "null") delete d[c.data]; else d[c.data] = JSON.parse(c._giorno0); salvaDiario(d); }
        closeModal(); if (typeof renderOggi === "function") renderOggi(); avviso("Modifiche annullate");
      }
      else if (a === "salva-modifiche") { closeModal(); avviso("✓ Modifiche salvate"); }   // erano già nel diario: si conferma e si torna a Oggi
      else if (a === "conferma-bozza") { c._conferma = true; c.bozza = false; try { rirenderLibero(); } finally { c._conferma = false; } if (liberoCtx === c) rirenderLibero(); avviso("✓ Pasto salvato"); document.getElementById("toast")?.classList.add("ok"); }   // ora il pasto è nel diario: si vede il riepilogo
      else if (a === "al-modifica") { c.modificaAl = b.dataset.nome; c.ignotoNuovo = true; c.ignoto = null; c.ignotoCodice = null; rirenderLibero(); }
      else if (a === "ignoto-annulla") { c.modificaAl = null; c.ignotoNuovo = false; c.ignoto = null; c.ignotoCodice = null; c.ricercaOFF = null; rirenderLibero(); }
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
      const att = gu ? it.qta / gu : it.qta;
      const nuovo = gu ? prossimoMultiplo(att, d, passo)
        : Math.max(1, d > 0 ? (att < 10 ? Math.floor(att) + 1 : Math.floor(att / 10) * 10 + 10)    // grammi: di 10 in 10, sotto i 10 di 1 in 1
                            : (att <= 10 ? Math.ceil(att) - 1 : Math.ceil(att / 10) * 10 - 10));
      it.qta = gu ? Math.round(nuovo * gu * 10) / 10 : nuovo; it.lock = true; // un decimale: 11 mandorle restano 11, non 10,8
      ricalcolaLibero(); rirenderLibero(); return;
    }
    if (e.target.closest("[data-lib-indietro]")) { vaiStoria("indietro"); return; }
    if (e.target.closest("[data-lib-avanti]")) { vaiStoria("avanti"); return; }
    const del = e.target.closest("[data-lib-del]");
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
    const sq = e.target.closest("[data-lib-setq]");
    if (sq) { const [k, g] = sq.dataset.libSetq.split("|").map(Number); if (c.items[k]) { c.items[k].qta = g; c.items[k].lock = true; ricalcolaLibero(); rirenderLibero(); } return; }   // consiglio furbo: porta la quantità a quella proposta
    const add = e.target.closest("[data-lib-add]");
    if (add) { c.items.push({ nome: add.dataset.libAdd, qta: +add.dataset.libG, lock: add.dataset.libFisso === "1" }); ricalcolaLibero(); rirenderLibero(); return; }   // il consiglio furbo mette proprio la quantità proposta
  });
  mc.addEventListener("change", (e) => {
    if (!liberoCtx) return;
    const c = liberoCtx;
    const au = e.target.closest && e.target.closest("[data-ant-unita]");   // unità dell'anteprima: g ⇄ pz…, la quantità resta la stessa
    if (au && c.anteprima) { const k = +au.dataset.antUnita, a = anteprimaRicetta(c, c.anteprima), cur = a && anteprimaItemsModificati(c, a)[k]; if (cur) { (c.antUni = c.antUni || {})[k] = au.value; salvaUnitaPreferita(cur.nome, au.value); (c.antQta = c.antQta || {})[k] = qtaPezziInteri(cur.nome, au.value, +cur.qta); rirenderLibero(); } return; }
    const q = e.target.closest("[data-lib-qta]");
    if (q) {
      const it = c.items[+q.dataset.libQta];
      const v = leggiNumero(q.value);
      const pz = +q.dataset.pz || 0;
      if (!isNaN(v) && v === 0) { const cestino = document.querySelector(`[data-lib-del="${+q.dataset.libQta}"]`); if (cestino) { cestino.click(); return; } }   // 0 = lo tolgo: come il cestino, con Annulla
      if (!isNaN(v) && v >= 0) { it.qta = Math.round(pz ? v * pz : v); it.lock = true; }
      ricalcolaLibero(); rirenderLibero(); return;
    }
    const us = e.target.closest("[data-lib-unita-sel]");
    if (us) { const it = c.items[+us.dataset.libUnitaSel]; it.unita = us.value; salvaUnitaPreferita(it.nome, us.value); rirenderLibero(); return; }
    const alt = e.target.closest("[data-lib-alt]");
    if (alt) { const it = c.items[+alt.dataset.libAlt]; it.nome = alt.value; if (!it.lock) it.qta = 0; ricalcolaLibero(); rirenderLibero(); }
  });
  mc.addEventListener("focusin", (e) => { if (liberoCtx && e.target.dataset && e.target.dataset.libNome !== undefined) { const t = e.target; setTimeout(() => t.select(), 0); } });
  mc.addEventListener("focusout", (e) => { // se esci dal campo senza scegliere, torna il nome di prima
    const t = e.target;
    if (!liberoCtx || !t.dataset || t.dataset.libNome === undefined) return;
    setTimeout(() => {
      const it = liberoCtx && liberoCtx.items[+t.dataset.libNome];
      if (it && t.isConnected && document.activeElement !== t) { nomeComeTesto(t, it); const b = document.getElementById("lib-sost"); if (b) b.remove(); }
    }, 350);
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
      const cc = liberoCtx, prima = (sc.querySelector(".tag-fit") || sc.closest(".lib-avv-lista")) && cc.vivo ? JSON.parse(JSON.stringify(cc.items)) : null;   // «più fit» e sostituti sono scambi dichiarati: si annullano con un tocco
      sostituisciIngrediente(+sc.dataset.sostScegli, sc.dataset.nome, +sc.dataset.g || 0);
      if (prima && typeof mostraToast === "function") mostraToast("Cambiato", "Annulla", () => { if (liberoCtx !== cc) return; cc.items = prima; ricalcolaLibero(); rirenderLibero(); });
      return;
    }
    const ar = e.target.closest("[data-autoc-ricetta], [data-ignoto-ricetta]");
    if (ar && liberoCtx && typeof usaRicettaNellEditor === "function") { usaRicettaNellEditor(ar.dataset.autocRicetta || ar.dataset.ignotoRicetta); return; }
    const av = e.target.closest("[data-autoc]");
    if (av && liberoCtx) {
      const inp = document.getElementById("lib-input");
      const parti = String(inp ? inp.value : "").split(/[,;+]/);
      const ultima = parti.pop();
      const lead = (ultima.match(AUTOC_LEAD) || [""])[0];
      aggiungiDaTesto([...parti, lead + av.dataset.autoc].join(", ")); rirenderLibero();
    }
  });
  mc.addEventListener("keydown", (e) => {
    if (liberoCtx && e.key === "Enter" && e.target.dataset && e.target.dataset.libNome !== undefined) { // Invio = il primo suggerimento
      e.preventDefault(); const p = document.querySelector("#lib-sost [data-sost-scegli]"); if (p) sostituisciIngrediente(+p.dataset.sostScegli, p.dataset.nome); else e.target.blur(); return;
    }
    if (liberoCtx && e.key === "Enter" && e.target.id === "lib-input") {
      e.preventDefault();
      aggiungiDaTesto(e.target.value); liberoCtx.addAperto = false; rirenderLibero(); // la tastiera si chiude: si vede il risultato
    }
  });
  // chiudendo il modale si esce dal pasto libero
  document.getElementById("modal").addEventListener("click", (e) => { if (e.target.closest("[data-chiudi]") && !e.__tornaIdee) { salvaBozzaAperta(); liberoCtx = null; } });   // (di solito closeModal l'ha già fatto)
});
