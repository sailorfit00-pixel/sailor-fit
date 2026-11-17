// Ricetta da foto o screenshot: il testo si legge nel telefono (OCR Tesseract), senza servizi a pagamento.
// La libreria si scarica solo quando serve, la prima volta (poi resta in memoria del browser).
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let _tessCaricamento = null;

function caricaTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!_tessCaricamento) {
    _tessCaricamento = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = TESSERACT_URL;
      s.onload = () => ok(window.Tesseract);
      s.onerror = () => { _tessCaricamento = null; ko(new Error("libreria")); };
      document.head.appendChild(s);
    });
  }
  return _tessCaricamento;
}

// Ridimensiona e schiarisce l'immagine: lo screenshot piccolo si ingrandisce, la foto enorme si riduce
async function immaginePerOcr(file) {
  const bmp = await createImageBitmap(file);
  const lato = Math.max(bmp.width, bmp.height);
  const k = lato > 2200 ? 2200 / lato : lato < 1200 ? 1200 / lato : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d");
  g.filter = "grayscale(1) contrast(1.25)";
  g.drawImage(bmp, 0, 0, c.width, c.height);
  // screenshot con tema scuro (testo chiaro su sfondo scuro): si inverte, così il lettore lo capisce meglio
  const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
  let somma = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { somma += d[i]; n++; }
  if (somma / n < 118) { for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 255 - d[i]; } g.putImageData(px, 0, 0); }
  return c;
}

const STATO_OCR = { "loading tesseract core": "Preparo il lettore", "loading language traineddata": "Scarico la lingua italiana (solo la prima volta)", "initializing api": "Preparo il lettore", "recognizing text": "Leggo il testo" };

// Titoli grandi e chiari (es. oro su bianco) sfuggono alla lettura normale: si rilegge la parte alta con più contrasto
async function titoloDaImmagine(worker, file) {
  try {
    const bmp = await createImageBitmap(file);
    const h = Math.round(bmp.height * 0.17), k = 1600 / bmp.width;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext("2d");
    g.filter = "grayscale(1) brightness(0.5) contrast(4)";
    g.drawImage(bmp, 0, 0, bmp.width, h, 0, 0, c.width, c.height);
    const { data } = await worker.recognize(c);
    const righe = data.text.split("\n").map(r => r.replace(/[^\p{L}\p{N}\s'’-]/gu, " ").replace(/\s+/g, " ").replace(/(\s+\S)+$/, m => m.trim().length === 1 ? "" : m).trim()).filter(r => r.length >= 3);
    const maiuscole = righe.filter(r => { const l = r.replace(/[^A-Za-zÀ-ù]/g, ""); return l.length >= 4 && l.replace(/[^A-ZÀ-Ù]/g, "").length / l.length >= 0.8; });
    return maiuscole.slice(0, 2).join(" ");
  } catch (e) { return ""; }
}

// Le parole del titolo lette male ("GIOGGOLATO") si correggono con quelle che l'app conosce ("cioccolato")
function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function correggiParoleTitolo(titolo) {
  const voc = new Set();
  Object.keys(window.ALIMENTI || {}).concat((window.ricette || []).map(r => r.nome)).forEach(n => n.toLowerCase().split(/[^a-zà-ù]+/).forEach(w => { if (w.length >= 4) voc.add(w); }));
  ["torta", "banana", "bread", "apple", "porridge", "plumcake", "pancake", "brownie", "cookies", "muffin", "cheesecake", "crostata", "biscotti", "bevanda", "carote", "arancia"].forEach(w => voc.add(w));
  return titolo.split(" ").map(w => {
    const l = w.toLowerCase();
    if (l.length < 6 || voc.has(l)) return w;
    let migliore = null, dist = 4;
    for (const v of voc) { if (Math.abs(v.length - l.length) > 2) continue; const x = levenshtein(l, v); if (x < dist) { dist = x; migliore = v; } }
    return migliore && dist <= (l.length >= 8 ? 3 : 2) ? (w === w.toUpperCase() ? migliore.toUpperCase() : migliore) : w;
  }).join(" ");
}

// Legge una o più immagini e restituisce il testo (nell'ordine in cui sono state scelte)
async function leggiTestoDaImmagini(files, mostra, senzaTitolo) {
  const T = await caricaTesseract();
  const worker = await T.createWorker("ita", 1, {
    logger: m => mostra(`${STATO_OCR[m.status] || "Lavoro"}… ${m.progress ? Math.round(m.progress * 100) + "%" : ""}`.trim())
  });
  let testo = "";
  try {
    for (const f of files) {
      const { data } = await worker.recognize(await immaginePerOcr(f));
      if (!testo) { const tit = senzaTitolo === "nome" ? await titoloDaImmagine(worker, f) : (!senzaTitolo ? await titoloDaImmagine(worker, f) : ""); window._ultimoTitolo = tit || ""; if (tit && senzaTitolo !== "nome") testo += correggiParoleTitolo(tit) + "\n"; }   // il titolo, se c'è, va in cima
      testo += data.text + "\n";
    }
  } finally { await worker.terminate(); }
  return testo;
}

// Il testo di una schermata si divide in: titolo, ingredienti e procedimento (anche tutto nella stessa immagine)
const INTEST_PROC = /^\W*(procedimento|preparazione|come si prepara|istruzioni|metodo)\b\s*:?\s*/i;
const VERBI_PROC = /^(mescola|mescolate|aggiungi|aggiungete|unisci|unite|versa|versate|cuoci|cuocete|taglia|tagliate|sbatti|sbattete|frulla|frullate|impasta|impastate|preleva|disponi|disponete|metti|mettete|lascia|lasciate|scalda|scaldate|forma|formate|inforna|infornate|prepara|preparate|trita|tritate|lava|lavate|sbuccia|monta|montate|amalgama|cospargi|togli|porta|portare|fai|fate|stendi|stendete|spolvera|servi|servite|preriscalda|in una|in un|poi|dopo)\b/i;
// "Ingredienti" come intestazione: da solo, con i due punti o "Ingredienti per 4…" (non una frase che comincia con la parola)
const INTEST_ING = /^\W*ingredienti\s*(?::|per\b|\(|$)/i;
const INTEST_ING_M = /^\W*ingredienti\s*(?::|per\b|\(|$)/im;
const NORM = x => x.toLowerCase().replace(/[^a-zà-ù0-9]/g, "");

function frasePassaggio(r) {
  r = r.replace(/\([^)]*\)?/g, " ").replace(/\s+/g, " ").trim();      // i suggerimenti tra parentesi non contano: "180 gr farina 00 (o riso per renderlo senza glutine)"
  const parole = r.split(" ").length;
  return /^\d+\s*[.)]\s+\S/.test(r) || VERBI_PROC.test(r) || r.length > 70 || (/[.!?]$/.test(r) && parole > 5);
}

// ---- Quali righe sono davvero ingredienti ----
// Una riga entra solo se ha una quantità oppure è fatta di alimenti che l'app conosce; il resto (commenti, hashtag, calorie, tempi, frasi) resta fuori.
let _vocCibo = null;
function vocabolarioCibo() {
  if (_vocCibo) return _vocCibo;
  const st = new Set(), lista = [];
  const agg = (w) => { if (w.length < 3) return; const x = stem(w); if (!st.has(x)) { st.add(x); lista.push(x); } };
  Object.keys(window.ALIMENTI || {}).forEach(n => norm(n).split(/[^a-z0-9]+/).forEach(agg));
  ["sale", "pepe", "olio", "acqua", "lievito", "vaniglia", "cannella", "zucchero", "farina", "uova", "uovo", "burro", "latte", "miele", "aglio", "cipolla", "prezzemolo", "basilico", "rosmarino", "origano", "limone", "aceto", "senape", "ghiaccio", "caffe", "cacao", "brodo", "dado", "panna", "yogurt", "pizzico", "spicchio", "mazzetto"].forEach(agg);
  return _vocCibo = { st, lista };
}
// parola di un alimento (anche con una lettera sbagliata dalla lettura: "zucchlna")
function parolaCibo(w) {
  w = norm(w).replace(/[^a-z0-9]/g, "");
  if (w.length < 3 || /\d/.test(w)) return false;
  const { st, lista } = vocabolarioCibo(), x = stem(w);
  if (st.has(x)) return true;
  if (x.length >= 5) for (const v of lista) if (Math.abs(v.length - x.length) <= 1 && levenshtein(x, v) <= 1) return true;
  return false;
}
function parolaCibaria(w) {   // la parola dell'alimento com'è nell'app, per correggere l'errore di lettura
  w = norm(w).replace(/[^a-z0-9]/g, "");
  const { st, lista } = vocabolarioCibo(), x = stem(w);
  if (st.has(x) || x.length < 5) return null;
  for (const v of lista) if (Math.abs(v.length - x.length) <= 1 && levenshtein(x, v) <= 1) return v;
  return null;
}
const RUMORE_SOCIAL = /#\w|@\w|https?:|www\.|\b(segui|seguimi|seguite|followers?|follower|like|piace|piacciono|commenta|commenti|condividi|condivisioni|salva|salvalo|iscriviti|link in bio|reel|post|video|instagram|tiktok|pdf|ti mando|ti invio|ti scrivo|scrivimi|messaggio|profilo|visualizza|visualizzazioni|ore fa|giorni fa|settimane fa|mesi fa|ricette|ricetta completa)\b/i;
const RUMORE_NUTRIZIONE = /\b(kcal|calorie|calorico|macro|macros)\b|\bp\s*[:.]?\s*\d+\s*[|·,/ -]+\s*c\s*[:.]?\s*\d+|^\W*(proteine|carboidrati|grassi|fibre|zuccheri|porzioni?|tempo|difficolt\w*|cottura|preparazione|dosi|per\s+\d+\s+persone)\b/i;
const RUMORE_TEMPO = /\d+\s*(°|gradi\b|minuti\b|min\b|ore\b|ora\b|secondi\b|sec\b|cm\b)/i;
const UNITA_QTA = /\b\d+(?:[.,]\d+)?\s*(g|gr|grammi|kg|ml|l|cl|dl|cucchiai\w*|cucch\w*|pz|pezzi|fett\w*|spicchi\w*|bicchier\w*|tazz\w*)\b/i;
const INIZIA_QTA = /^\s*(?:\d|[½¼¾]|un[oa]?\b|mezz[oa]\b|due\b|tre\b|quattro\b|q\.?\s?b\.?\b|quanto basta|un pizzico|una presa|un filo|un goccio|un cucchiaio|un cucchiaino)/i;
function rigaIngrediente(r) {
  const t = r.replace(/\([^)]*\)?/g, " ").replace(/\s+/g, " ").trim();
  if (!t || !/\p{L}{2}/u.test(t)) return false;                    // niente lettere: rumore ("{ ' 1 .")
  if (RUMORE_SOCIAL.test(t) || RUMORE_NUTRIZIONE.test(t)) return false;
  const conQta = INIZIA_QTA.test(t) || UNITA_QTA.test(t) || /\bq\.?\s?b\.?\b/i.test(t);
  if (RUMORE_TEMPO.test(t) && !/^\s*\d+(?:[.,]\d+)?\s*(g|gr|kg|ml|l)\b/i.test(t)) return false;   // "180°", "20 minuti", "5 min"
  const parole = t.split(/[^\p{L}]+/u).filter(w => w.length >= 3);
  const cibo = parole.filter(parolaCibo).length;
  if (conQta) return cibo >= 1 || /^\s*\d+(?:[.,]\d+)?\s*(g|gr|kg|ml|l)\b/i.test(t);   // "4 persone": no; "100 g quinoa soffiata": sì
  // senza quantità ("sale", "olio evo", "lattuga"): corta, di alimenti conosciuti, e non una frase
  return cibo >= 1 && t.split(" ").length <= 6 && !/[.!?]$/.test(t) && !VERBI_PROC.test(t) && cibo >= Math.ceil(parole.length / 2);
}
// "2OO g", "1OO", "lngredienti": errori tipici di lettura
function correggiLettura(r) {
  return r.replace(/(^|[^\p{L}\d])([\dOolI]{2,4})(?=\s*(?:g|gr|ml|kg|l)\b)/gu, (m, a, n) => a + n.replace(/[Oo]/g, "0").replace(/[lI]/g, "1"))
    .replace(/^(\W*)[lI1]ngredienti/i, "$1Ingredienti")
    .replace(/\b([\p{L}]{2,4}) ([\p{L}]{3,6})\b/gu, (m, a, b) => (!parolaCibo(a) || a.length <= 3) && !parolaCibo(b) && parolaCibo(a + b) ? a + b : m)   // "ba nane" -> "banane"
    .split(" ").map(w => { const c = /^[\p{L}'’]{5,}$/u.test(w) ? parolaCibaria(w) : null; return c ? c : w; }).join(" ");
}
const SOLO_QTA = /^\s*(\d+(?:[.,]\d+)?|[½¼¾])\s*(g|gr|kg|ml|l|pz|pezzi|cucchiai\w*|cucchiaini?)?\s*$/i;
// "Farina 00" a capo "200 g" (nome e quantità su righe diverse): si uniscono
function uniscinomiQuantita(righe) {
  for (let j = 0; j < righe.length; j++) {
    if (!SOLO_QTA.test(righe[j] || "")) continue;
    const prec = righe[j - 1], succ = righe[j + 1];
    const nomeSolo = (x) => x && !/\d/.test(x.replace(/\b(?:00|0)\b/, "")) && rigaIngrediente(x) && !INIZIA_QTA.test(x);
    if (j > 0 && nomeSolo(prec) && !SOLO_QTA.test(prec)) { righe[j - 1] = righe[j].trim() + " " + prec.trim(); righe[j] = ""; }
    else if (succ !== undefined && nomeSolo(succ) && !SOLO_QTA.test(succ)) { righe[j + 1] = righe[j].trim() + " " + succ.trim(); righe[j] = ""; }
  }
}

function analizzaTesto(testo) {
  const righe = [];                                           // le righe vuote restano: separano i paragrafi del procedimento
  for (const r0 of testo.split("\n")) {
    const r = r0.trim(), prec = righe[righe.length - 1];
    if (prec && (prec.match(/\(/g) || []).length > (prec.match(/\)/g) || []).length && r) righe[righe.length - 1] = prec + " " + r;   // "(o dolcificante: sciroppo\ndi dattero)" va a capo dentro la parentesi
    else righe.push(r);
  }
  const out = { ingredienti: [], procedimento: "" };
  righe.forEach((r, i) => { righe[i] = r.replace(/^(\W*)[lI1]ngredienti/i, "$1Ingredienti"); });
  const iIng0 = righe.findIndex(r => INTEST_ING.test(r)), iProc0 = righe.findIndex(r => INTEST_PROC.test(r));
  if (iIng0 >= 0) { const fine = iProc0 > iIng0 ? iProc0 : righe.length; const parte = righe.slice(iIng0 + 1, fine); uniscinomiQuantita(parte); righe.splice(iIng0 + 1, parte.length, ...parte); }
  const iIng = righe.findIndex(r => INTEST_ING.test(r));
  const iProc = righe.findIndex(r => INTEST_PROC.test(r));
  const titolo = NORM(metadatiDaTesto(testo).nome || "~");
  let k = iIng >= 0 ? iIng : 0, fineIng = righe.length;
  let primaRiga = true;
  for (; k < righe.length; k++) {
    let r = righe[k];
    if (!r) continue;
    if (/^\d+\s*\/\s*\d+$/.test(r) || /^(ricetta|dosi)\b/i.test(r) || /^per\s+(uno|una|un|il|la|lo|decorare|guarnire|servire)\b/i.test(r)) { primaRiga = false; continue; }   // "9/11", "Ricetta per uno stampo da 25 cm", "Per decorare: …"
    if (iIng >= 0 && k > iIng && (iProc < 0 || k < iProc)) r = r.replace(/^\d{1,2}\s*[.)]\s+(?=(?:\d|[½¼¾]|un[oa]?\b|mezz[oa]\b|q\.?b\b))/i, "");   // "1) 200 g farina": è un ingrediente numerato, non un passaggio
    if (k === iIng) r = r.replace(/^\W*ingredienti\s*(per [^:]*|\([^)]*\))?:?\s*/i, "");        // "Ingredienti per 4 pancake:"
    else if (k === iProc || frasePassaggio(r)) { fineIng = k; break; }                    // qui inizia il procedimento
    r = r.replace(/^[\s•·*\-–—✓✔✅▪■●○◦>]+/, "").replace(/\s+/g, " ").trim();
    r = r.replace(/^(qb|q\.b\.?|quanto basta)\s+(.+)$/i, "$2 q.b.");
    r = r.replace(/^(sale|pepe)\s*(?:e|,|&)\s*(?:sale|pepe)\b.*$/i, "sale q.b.");
    r = r.replace(/^(\d+(?:[.,]\d+)?)\s*(m|mi|mil|rnl|m1|nl|ni)(?=\s)/i, "$1 ml").replace(/^(\d+(?:[.,]\d+)?)\s*(q|9r)\b/i, "$1 g");   // errori tipici di lettura: "50mi" -> "50 ml"                      // "Qb sale" -> "sale q.b."
    if (!r || !/[a-zà-ù0-9]/i.test(r) || /^\W*(tempo|porzioni|dosi|difficolt|kcal|calorie|cottura)\b/i.test(r) || NORM(r) === titolo) continue;
    if (iIng < 0 && primaRiga && !/\d|q\.b\./i.test(r)) { primaRiga = false; continue; }   // senza intestazione: la prima riga è il titolo
    primaRiga = false;
    // "200 g farina, 100 g ricotta" su una riga sola: un ingrediente per volta
    r.split(/\s*;\s*|,\s*(?=\d)/).map(x => correggiLettura(x.trim())).filter(Boolean).forEach(x => { if (rigaIngrediente(x)) out.ingredienti.push(x); });
  }
  const resto = iProc >= 0 && iProc < fineIng ? righe.slice(iProc) : righe.slice(fineIng);
  out.procedimento = resto.join("\n").replace(INTEST_PROC, "").trim();
  return out;
}

function righeIngredientiDaTesto(testo) { return analizzaTesto(testo).ingredienti; }

// Procedimento: passaggi numerati se ci sono, altrimenti paragrafi, altrimenti una frase per passaggio
function passaggiDaTesto(testo) {
  const t = analizzaTesto(testo);
  testo = (t.ingredienti.length || INTEST_ING_M.test(testo) ? t.procedimento : testo.replace(/^[\s\S]*?(?=\b(procedimento|preparazione|come si prepara)\b)/i, "").replace(INTEST_PROC, "")).trim();
  let passi;
  if ((testo.match(/(^|\n)\s*\d+\s*[.)]\s+\S/g) || []).length >= 2) {
    passi = testo.split(/(?:^|\n)\s*\d+\s*[.)]\s+/).slice(1);
  } else {
    // prima i paragrafi (righe vuote), poi una frase per passaggio
    passi = testo.split(/\n\s*\n/).flatMap(par => par.replace(/\n/g, " ").split(/(?<=[.!?])\s+(?=[A-ZÀ-Ù0-9])/));
  }
  return passi.map(p => p.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").replace(/([.!?])\s+\S$/, "$1").trim()).filter(p => p.length > 2).slice(0, 25);
}

// Nome, porzioni e tempo si ricavano dal testo dell'immagine (titolo in alto, "per 4 pancake", "porzioni: 2", "20 minuti")
function singolareIt(p) {
  p = p.toLowerCase();
  if (/[a-z]{3}s$/.test(p) && !/ss$/.test(p)) return p.slice(0, -1); // brownies, cookies, muffins, tacos
  if (/(ini|ette|elle|ine|otti|icci|etti)$/.test(p)) return p.replace(/ini$/, "ino").replace(/ette$/, "etta").replace(/elle$/, "ella").replace(/ine$/, "ina").replace(/otti$/, "otto").replace(/icci$/, "iccio").replace(/etti$/, "etto");
  if (/(cake|ke|in|ni|s)$/.test(p) && !/ni$/.test(p)) return p;
  if (/e$/.test(p)) return p.slice(0, -1) + "a";
  if (/i$/.test(p)) return p.slice(0, -1) + "o";
  return p;
}
function metadatiDaTesto(testo) {
  const out = {};
  const righe = testo.split("\n").map(r => r.replace(/[^\p{L}\p{N}\s.,'’:;()\/%-]/gu, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  // titolo: prima riga che non è un'intestazione né un ingrediente con quantità
  const intest = /^(ingredienti|procedimento|preparazione|ricetta|per\b|dosi|porzioni|tempo|difficolt|kcal|calorie)/i;
  const conQta = /^\d|\b\d+\s?(g|gr|ml|kg|cucchiai\w*|pz)\b/i;
  // il titolo è breve, comincia con la maiuscola e non è l'inizio di una frase lunga (didascalie tipo "Se fai fatica a mangiare…")
  const iInt = righe.findIndex(r => INTEST_ING.test(r));
  const tit = righe.slice(0, iInt >= 0 ? Math.min(iInt, 4) : 4).find((r, i) => r.length >= 3 && r.length <= 45 && r.split(" ").length <= 7 && /^[A-ZÀ-Ù]/.test(r) && !intest.test(r) && !conQta.test(r) && /\p{L}{3}/u.test(r) && !/[:;,.!?]$/.test(r) && !VERBI_PROC.test(r) && !/^(se|se tu|quando|ecco|prova|ti|vi|per un|ho)\b/i.test(r) && !/^[a-zà-ù]/.test(righe[i + 1] || "A"));
  if (tit) {
    const t = tit.replace(/[.,;:!]+$/, "").trim();
    out.nome = (t === t.toUpperCase() ? t.toLowerCase() : t).replace(/^./, c => c.toUpperCase());
  }
  // porzioni: "per 4 pancake", "dosi per 2 persone", "fa 6 muffin", "porzioni: 4", "4 porzioni"
  let m = testo.match(/\b(?:per|dosi per|fa|ottieni|ricava|x)\s+(?:circa\s+)?(\d{1,2})\s+([a-zà-ù]{3,})/i)
    || testo.match(/\b(\d{1,2})\s+(porzion[ei]|person[ei]|persone)\b/i);
  if (m) {
    const n = +m[1], parola = m[2].toLowerCase();
    if (n >= 1 && n <= 60 && !/^(g|gr|ml|min|ore|ora|grammi|litr|grad|cm|giorn|volt)/.test(parola)) {
      out.porzioni = n;
      out.pezzo = /^(porzion|person|commensal)/.test(parola) ? "" : singolareIt(parola);
    }
  }
  if (!out.porzioni && (m = testo.match(/porzioni\s*:?\s*(\d{1,2})\b/i))) { out.porzioni = +m[1]; out.pezzo = ""; }
  // torte e simili: dal formato dello stampo si stima il numero di fette (da controllare)
  if (!out.porzioni) {
    let q;
    if (/plumcake/i.test(testo)) { out.porzioni = 10; out.pezzo = "fetta"; out.stima = true; }
    else if ((q = testo.match(/teglia\s*(\d{2})\s*[x×]\s*(\d{2})/i))) { out.porzioni = Math.max(4, Math.min(16, Math.round(q[1] * q[2] / 45))); out.pezzo = "quadrato"; out.stima = true; }
    else if ((q = testo.match(/(?:tortiera|stampo|teglia)[^\n]{0,30}?(\d{2})\s*cm/i))) { const d = +q[1]; out.porzioni = d >= 26 ? 12 : d >= 22 ? 8 : d >= 18 ? 6 : 4; out.pezzo = "fetta"; out.stima = true; }
  }
  // tempo: "20 minuti", "tempo: 15 min"
  if ((m = testo.match(/\b(\d{1,3})\s*(?:min\b|minuti)/i))) out.tempo = +m[1];
  return out;
}

// Compila solo i campi ancora vuoti: quello che hai già scritto non si tocca
function applicaMetadati(d, soloTempo) {
  const r = nuovaRic, fatti = [];
  if (!soloTempo && d.nome && !r.nome.trim()) { r.nome = d.nome; fatti.push(`il nome "${d.nome}"`); }
  if (!soloTempo && d.porzioni && !(r.porzioni > 1) && !r.pezzo) { r.porzioni = d.porzioni; r.pezzo = d.pezzo || ""; fatti.push(`${d.porzioni} ${d.pezzo ? (d.porzioni === 1 ? d.pezzo : plurale(d.pezzo)) : "porzioni"}${d.stima ? " (stima: controlla)" : ""}`); }
  if (d.tempo && (!r.tempo || r.tempo === 15) && !r.tempoImpostato) { r.tempo = d.tempo; r.tempoImpostato = true; fatti.push(`${d.tempo} min`); }
  return fatti.join(", ");
}

// Gestione della scelta dell'immagine nel wizard "Nuova ricetta"
document.addEventListener("change", async e => {
  const inp = e.target.closest && e.target.closest("[data-foto]");
  if (!inp || !nuovaRic) return;
  const files = [...inp.files];
  inp.value = "";
  if (!files.length) return;
  const tipo = inp.dataset.foto;
  const stato = document.getElementById("foto-stato-" + tipo);
  const mostra = t => { if (stato) stato.textContent = t; };
  mostra("Apro l'immagine…");
  try {
    const testo = await leggiTestoDaImmagini(files, mostra);
    if (!nuovaRic) return;
    // Una sola foto può contenere tutto: titolo, ingredienti e procedimento. Da qualunque pulsante si parta, si prende ciò che c'è.
    const conIngredienti = INTEST_ING_M.test(testo);
    const ingVuoti = !nuovaRic.ingredienti.some(i => i.nome || i.cercato);
    const passiVuoti = !nuovaRic.passaggi.some(p => p.trim());
    const nuove = (tipo !== "proc" || (conIngredienti && ingVuoti)) ? righeIngredientiDaTesto(testo).map(leggiRigaIngrediente).filter(Boolean) : [];
    const passi = (tipo === "proc" || passiVuoti) ? passaggiDaTesto(testo) : [];
    if (!nuove.length && !passi.length) { mostra("Non ho trovato né ingredienti né procedimento nell'immagine: prova uno screenshot più nitido."); return; }
    const cosa = [];
    if (nuove.length) {
      nuovaRic.ingredienti = nuovaRic.ingredienti.filter(i => i.nome || i.cercato).concat(nuove);
      cosa.push(`${nuove.length} ingredienti`);
      const nAlt = nuove.reduce((x, i) => x + (i.alt ? i.alt.length : 0), 0);
      if (nAlt) cosa.push(`${nAlt} varianti`);
    }
    if (passi.length) { nuovaRic.passaggi = nuovaRic.passaggi.filter(p => p.trim()).concat(passi); cosa.push(`${passi.length} passaggi`); }
    const dati = applicaMetadati(metadatiDaTesto(testo), tipo === "proc" && !nuove.length);
    if (dati) cosa.push(dati);
    renderWizard();
    avviso(`📷 Letti ${cosa.join(", ")}: controlla tutto`);
  } catch (err) {
    mostra(navigator.onLine === false || String(err.message) === "libreria"
      ? "Serve internet la prima volta per scaricare il lettore. Riprova quando sei connessa."
      : "Non riesco a leggere questa immagine: prova con uno screenshot più nitido.");
  }
});

// ---- Tabella nutrizionale da foto: i valori per 100 g finiscono nei campi dell'etichetta (poi li controlli tu) ----
// Con due colonne (per 100 g e per porzione) si prende la prima, che di solito è quella per 100 g.
function valoriDaEtichetta(testo) {
  const t = String(testo).toLowerCase().replace(/,/g, ".").replace(/[|]/g, " ").replace(/\bgr?\b/g, "g").replace(/[ \t]+/g, " ");
  const num = (re, max) => {
    const m = t.match(re); if (!m) return null;
    let x = m[1]; const dopo = t.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (/^\d+\.\d9$/.test(x) && !/^\s*g/.test(dopo) && max === 100) x = x.slice(0, -1);   // il lettore scambia spesso la «g» per un 9: «6,0 g» diventa «6,09»
    const v = parseFloat(x); return isFinite(v) && v >= 0 && v <= max ? v : null; };
  let kcal = num(/(\d+(?:\.\d+)?)\s*kcal/, 900);
  if (kcal === null) { const kj = num(/(\d+(?:\.\d+)?)\s*kj/, 3800); if (kj !== null) kcal = Math.round(kj / 4.184); }
  return [kcal,
    num(/prote[a-z]*\s*[:.]?\s*(\d+(?:\.\d+)?)/, 100),
    num(/carboidrati\s*[:.]?\s*(\d+(?:\.\d+)?)/, 100),
    num(/(?:^|[^a-z])grassi\s*[:.]?\s*(\d+(?:\.\d+)?)/m, 100),
    num(/zuccheri\s*[:.]?\s*(\d+(?:\.\d+)?)/, 100),
    num(/fibr[ae]\s*(?:alimentar[ei])?\s*[:.]?\s*(\d+(?:\.\d+)?)/, 100),
    num(/sale\s*[:.]?\s*(\d+(?:\.\d+)?)/, 100)];
}
document.addEventListener("change", async e => {
  const inp = e.target.closest && e.target.closest("[data-foto-etic]");
  if (!inp) return;
  const id = inp.dataset.fotoEtic, files = [...inp.files];
  inp.value = "";
  if (!files.length) return;
  const stato = document.getElementById("foto-stato-" + id);
  const mostra = t => { if (stato) stato.textContent = t; };
  mostra("Apro l'immagine…");
  try {
    const testo = await leggiTestoDaImmagini(files, mostra, "nome");
    const v = valoriDaEtichetta(testo), box = document.getElementById(id);
    if (!box || v.slice(0, 4).every(x => x === null)) { mostra("Non trovo la tabella: riprova con una foto più nitida e dritta."); return; }
    v.forEach((x, k) => { const el = box.querySelector(`[data-etic="${k}"]`); if (el && x !== null) el.value = String(x); });
    // il nome del prodotto, se la foto lo mostra e il campo è ancora vuoto (o è solo un codice a barre)
    const nomeEl = document.getElementById("ignoto-nome"), tit = String(window._ultimoTitolo || "").replace(/\s+/g, " ").trim();
    if (nomeEl && (!nomeEl.value.trim() || /^\d+$/.test(nomeEl.value.trim())) && /[A-Za-zÀ-ù]{4}/.test(tit) && !/valori|nutriz|energia|dichiarazione|per 100/i.test(tit)) {
      const t = tit.toLowerCase(); nomeEl.value = t.charAt(0).toUpperCase() + t.slice(1);
    }
    mostra("");
    avviso("📷 Valori letti: controlla che siano giusti");
  } catch (err) {
    mostra(navigator.onLine === false || String(err.message) === "libreria"
      ? "Serve internet la prima volta per scaricare il lettore. Riprova quando sei connessa."
      : "Non riesco a leggere questa immagine: prova con una foto più nitida.");
  }
});
