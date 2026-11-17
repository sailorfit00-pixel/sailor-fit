// =============================================================
//  Prodotti confezionati: codice a barre e ricerca per nome
//  I valori arrivano da Open Food Facts (archivio libero di prodotti).
//  Ogni prodotto trovato resta salvato nel telefono: la volta dopo si
//  ritrova scrivendone il nome, anche senza internet.
// =============================================================

const OFF_PRODOTTO = "https://world.openfoodfacts.org/api/v2/product/";
const OFF_CAMPI = "product_name,product_name_it,brands,nutriments,ingredients_text_it,ingredients_text,serving_quantity";
const CERCA_URL = "/.netlify/functions/cerca?q=";
let _lettore = null, _controlli = null; // fotocamera attiva

// Prodotti già noti all'app (valgono anche senza internet): codice a barre → alimento
const CODICI_NOTI = { "4335619243125": "Latte proteico Lidl" };
function leggiCodici() { try { return JSON.parse(localStorage.getItem("mp_codici")) || {}; } catch (e) { return {}; } }
function salvaCodice(codice, nome) { const c = leggiCodici(); c[codice] = nome; localStorage.setItem("mp_codici", JSON.stringify(c)); }

// Da un prodotto di Open Food Facts ai valori dell'app (per 100 g); null se mancano le calorie
function daOpenFoodFacts(p) {
  const n = p.nutriments || {};
  const num = (k) => { const v = parseFloat(n[k]); return isNaN(v) ? null : Math.round(v * 10) / 10; };
  const kcal = num("energy-kcal_100g") ?? (num("energy_100g") !== null ? Math.round(num("energy_100g") / 4.184) : null);
  if (kcal === null) return null;
  const marca = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0]).trim();
  let nome = String(p.product_name_it || p.product_name || "Prodotto").trim();
  if (marca && !nome.toLowerCase().includes(marca.toLowerCase())) nome += ` ${marca}`;
  nome = nome.charAt(0).toUpperCase() + nome.slice(1);
  if (nome.length > 48) nome = nome.slice(0, 46) + "…";
  const zuccheri = num("sugars_100g") || 0;
  // zuccheri aggiunti: stima dagli ingredienti (se c'è zucchero, sciroppo, miele… li consideriamo aggiunti)
  const ingr = String(p.ingredients_text_it || p.ingredients_text || "");
  const conZucchero = /zucchero|sciroppo|destrosio|glucosio|fruttosio|saccarosio|miele|maltodestrin|sugar|syrup|honey/i.test(ingr);
  return {
    nome,
    base4: [kcal, num("proteins_100g") || 0, num("carbohydrates_100g") || 0, num("fat_100g") || 0],
    extra4: [zuccheri, conZucchero ? zuccheri : 0, num("fiber_100g") || 0, num("salt_100g") || 0],
    porzione: parseFloat(p.serving_quantity) || null,
  };
}
// Aggiunge il prodotto all'app e al pasto che stai scrivendo
function usaProdotto(prod, codice) {
  const c = liberoCtx;
  salvaAlimentoPersonale(prod.nome, prod.base4, prod.extra4);
  if (codice) salvaCodice(codice, prod.nome);
  if (!c) return;
  c.scansione = null; c.ricercaOFF = null; c.ignoto = null;
  if (!c.items.some(x => x.nome === prod.nome)) {
    const porz = prod.porzione && prod.porzione < 600 ? Math.round(prod.porzione) : 0;
    c.items.push({ nome: prod.nome, cercato: prod.nome, qta: porz, lock: !!porz });
  }
  ricalcolaLibero(); rirenderLibero();
}

// -------- Codice a barre --------
function scansioneHTML(c) {
  const s = c.scansione;
  return `<h3 class="modal-title">📷 Codice a barre</h3>
    ${s.stato === "fotocamera" ? `<div class="scan-video"><video id="scan-video" playsinline muted></video><span class="scan-mirino"></span></div>
      <p class="hint scan-aiuto">Inquadra il codice nel riquadro: si legge da solo. Se non parte, tocca «Scatta».</p>
      <button class="btn block scan-scatta" data-lib="scan-scatta">📸 Scatta e leggi</button>` : ""}
    ${s.stato === "leggo" ? `<p class="scan-stato">Leggo il codice…</p>` : ""}
    <label class="btn-sec block scan-foto">🥫 Niente codice? Fotografa la tabella nutrizionale<input type="file" accept="image/*" capture="environment" hidden data-scan-tabella></label>
    ${s.stato === "cerco" ? `<p class="scan-stato">Cerco il prodotto ${esc(s.codice)}…</p>` : ""}
    ${s.messaggio ? `<p class="nota">${s.messaggio}</p>` : ""}
    <label class="wiz-l">Oppure scrivi il numero sotto il codice a barre</label>
    <div class="lib-add">
      <input id="scan-manuale" class="qta-input wiz-full" inputmode="numeric" autocomplete="off" placeholder="es. 8001234567890" value="${esc(s.codice || "")}">
      <button class="btn lib-piu" data-lib="scan-cerca" aria-label="Cerca il codice">→</button>
    </div>
    <div class="wiz-nav"><button class="btn-sec" data-lib="scan-annulla">Annulla</button><button class="btn-sec" data-lib="scan-nuovo">✍️ Scrivo io i valori</button></div>`;
}
function caricaZXing() {
  if (window.ZXingBrowser) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "zxing-browser.min.js"; s.onload = ok; s.onerror = () => ko(new Error("libreria"));
    document.head.appendChild(s);
  });
}
// La lettura: prima il lettore del telefono (se c'è), poi ZXing; prova anche l'immagine girata, per i codici in verticale
const TRY_HARDER = 3;
function lettoreCodici() { return _lettore = _lettore || new ZXingBrowser.BrowserMultiFormatReader(new Map([[TRY_HARDER, true]])); }
function ruotaCanvas(src, gradi) {
  const c = document.createElement("canvas"), dritto = gradi % 180 === 0;
  c.width = dritto ? src.width : src.height; c.height = dritto ? src.height : src.width;
  const x = c.getContext("2d"); x.translate(c.width / 2, c.height / 2); x.rotate(gradi * Math.PI / 180); x.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}
function canvasDa(img, w, h, max = 1600) {   // foto molto grandi: si rimpiccioliscono (più veloce, e ZXing legge meglio)
  const k = Math.min(1, max / Math.max(w, h)), c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}
async function leggiCodiceDaCanvas(canvas) {
  if ("BarcodeDetector" in window) {
    try { const r = await new BarcodeDetector().detect(canvas); if (r && r[0] && r[0].rawValue) return r[0].rawValue; } catch (e) { /* non supportato: si passa a ZXing */ }
  }
  await caricaZXing();
  const l = lettoreCodici();
  const prove = [canvas, ruotaCanvas(canvas, 90)];
  if (Math.max(canvas.width, canvas.height) > 900) prove.push(canvasDa(canvas, canvas.width, canvas.height, 800));   // a volte rimpicciolita si legge meglio
  for (const c of prove) { try { const r = l.decodeFromCanvas(c); if (r) return r.getText(); } catch (e) { /* niente codice in questa prova */ } }
  return null;
}
function nonLetto(codice) {
  if (!liberoCtx) return;
  liberoCtx.scansione = { stato: "manuale", codice, messaggio: "Non riesco a leggere il codice. Riprova con il codice ben a fuoco e illuminato, oppure scrivi il numero qui sotto." };
  rirenderLibero();
}
async function scattaELeggi() {
  const v = document.getElementById("scan-video");
  if (!v || !v.videoWidth) return;
  const canvas = canvasDa(v, v.videoWidth, v.videoHeight, 1920);
  fermaFotocamera();
  liberoCtx.scansione = { stato: "leggo" }; rirenderLibero();
  const cod = await leggiCodiceDaCanvas(canvas);
  if (cod) cercaCodice(cod); else nonLetto();
}
function fermaFotocamera() {
  try { if (_controlli) _controlli.stop(); } catch (e) {}
  _controlli = null;
  const v = document.getElementById("scan-video");
  if (v && v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; }
}
async function avviaScansione() {
  const c = liberoCtx; if (!c) return;
  c.scansione = { stato: "fotocamera" };
  rirenderLibero();
  try {
    await caricaZXing();
    if (!liberoCtx || !liberoCtx.scansione) return;
    const l = lettoreCodici(), video = document.getElementById("scan-video");
    const trovato = (res) => { if (res && liberoCtx && liberoCtx.scansione && liberoCtx.scansione.stato === "fotocamera") { fermaFotocamera(); cercaCodice(res.getText()); } };
    try {   // fotocamera posteriore ad alta risoluzione: i codici piccoli si leggono meglio
      _controlli = await l.decodeFromConstraints({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } }, video, trovato);
    } catch (e) { _controlli = await l.decodeFromVideoDevice(undefined, video, trovato); }
  } catch (e) {
    if (!liberoCtx || !liberoCtx.scansione) return;
    liberoCtx.scansione = { stato: "manuale", messaggio: "Non riesco ad aprire la fotocamera. Controlla il permesso (Impostazioni → Safari → Fotocamera) oppure scrivi il numero qui sotto." };
    rirenderLibero();
  }
}
async function cercaCodice(codice) {
  const c = liberoCtx; if (!c) return;
  codice = String(codice || "").replace(/\D/g, "");
  if (codice.length < 6) { c.scansione = { stato: "manuale", codice, messaggio: "Il numero sembra incompleto." }; rirenderLibero(); return; }
  // già scansionato in passato: funziona anche offline
  const noto = leggiCodici()[codice] || CODICI_NOTI[codice];
  if (noto && (window.ALIMENTI || {})[noto]) {
    const v = window.ALIMENTI[noto];
    usaProdotto({ nome: noto, base4: v, extra4: (window.NUTRIENTI_EXTRA || {})[noto] || null }, codice); return;
  }
  c.scansione = { stato: "cerco", codice }; rirenderLibero();
  try {
    const r = await fetch(`${OFF_PRODOTTO}${codice}.json?fields=${OFF_CAMPI}`);
    const d = await r.json();
    const prod = d && d.status === 1 ? daOpenFoodFacts(d.product || {}) : null;
    if (!liberoCtx) return;
    if (prod) { usaProdotto(prod, codice); return; }
    // non c'è: si inseriscono i valori dall'etichetta
    liberoCtx.scansione = null;
    liberoCtx.ignoto = "Prodotto " + codice; liberoCtx.ignotoCodice = codice;
    rirenderLibero();
  } catch (e) {
    if (!liberoCtx) return;
    liberoCtx.scansione = { stato: "manuale", codice, messaggio: "Serve la connessione a internet per cercare un prodotto nuovo." };
    rirenderLibero();
  }
}

// -------- Ricerca per nome tra i prodotti confezionati --------
function ricercaOFFHTML(c) {
  const r = c.ricercaOFF;
  if (!r) return "";
  if (r.stato === "cerco") return `<p class="scan-stato">Cerco “${esc(r.q)}” tra i prodotti confezionati…</p>`;
  if (r.stato === "errore") return `<p class="nota">${r.messaggio}</p>`;
  if (!r.risultati.length) return `<p class="nota">Nessun prodotto trovato per “${esc(r.q)}”.</p>`;
  return `<h4>Prodotti confezionati</h4><div class="sugg-ricette">${r.risultati.map((p, i) => `<button class="riga-ricetta" data-off-scegli="${i}">
      <span class="rr-nome">${esc(p.nome)}</span>
      <span class="rr-meta">${p.base4[0]} kcal · P ${p.base4[1]} · C ${p.base4[2]} · G ${p.base4[3]} per 100 g</span></button>`).join("")}</div>`;
}
async function cercaProdottiOFF(q) {
  const c = liberoCtx; if (!c) return;
  c.ricercaOFF = { q, stato: "cerco", risultati: [] }; rirenderLibero();
  try {
    const r = await fetch(CERCA_URL + encodeURIComponent(q));
    const d = await r.json();
    const ita = (p) => (p.countries_tags || []).some(x => /italy|italia/.test(x));
    const risultati = (d.hits || []).sort((a, b) => ita(b) - ita(a)).map(daOpenFoodFacts).filter(Boolean)
      .filter((p, i, arr) => arr.findIndex(x => x.nome === p.nome) === i).slice(0, 8);
    if (!liberoCtx) return;
    liberoCtx.ricercaOFF = { q, stato: "fatto", risultati };
  } catch (e) {
    if (!liberoCtx) return;
    liberoCtx.ricercaOFF = { q, stato: "errore", messaggio: "Ricerca non disponibile in questo momento (serve internet)." };
  }
  rirenderLibero();
}

document.addEventListener("DOMContentLoaded", () => {
  const mc = document.getElementById("modal-content");
  mc.addEventListener("click", (e) => {
    const c = liberoCtx; if (!c) return;
    const b = e.target.closest("[data-lib]");
    const a = b && b.dataset.lib;
    if (a === "scan") { avviaScansione(); return; }   // 📷: si apre subito la fotocamera (da lì si può anche passare a "Nuovo alimento")
    if (a === "scan-nuovo") { fermaFotocamera(); c.scansione = null; c.ignoto = null; c.ignotoCodice = null; c.ignotoNuovo = true; rirenderLibero(); return; }
    if (a === "scan-annulla") { fermaFotocamera(); c.scansione = null; rirenderLibero(); return; }
    if (a === "scan-scatta") { scattaELeggi(); return; }
    if (a === "scan-cerca") { fermaFotocamera(); cercaCodice((document.getElementById("scan-manuale") || {}).value); return; }
    if (a === "off-cerca") { cercaProdottiOFF(c.ignoto || ""); return; }
    const sc = e.target.closest("[data-off-scegli]");
    if (sc && c.ricercaOFF) { const p = c.ricercaOFF.risultati[+sc.dataset.offScegli]; if (p) usaProdotto(p, null); }
  });
  mc.addEventListener("change", (e) => {
    if (liberoCtx && e.target.matches("[data-scan-tabella]")) {   // nuovo alimento dalla foto della tabella: si apre il modulo e i valori si riempiono da soli
      const files = [...(e.target.files || [])]; e.target.value = ""; if (!files.length) return;
      const c = liberoCtx; fermaFotocamera(); c.scansione = null; c.ignoto = null; c.ignotoCodice = null; c.ignotoNuovo = true; rirenderLibero();
      if (typeof leggiEtichettaDaFile === "function") leggiEtichettaDaFile("etic-libero", files);
    }
  });
  mc.addEventListener("keydown", (e) => {
    if (liberoCtx && e.key === "Enter" && e.target.id === "scan-manuale") { e.preventDefault(); fermaFotocamera(); cercaCodice(e.target.value); }
  });
  // chiudendo il pannello si spegne la fotocamera
  document.getElementById("modal").addEventListener("click", (e) => { if (e.target.closest("[data-chiudi]")) fermaFotocamera(); });
});
