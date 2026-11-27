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
  const kj = num("energy-kj_100g") ?? num("energy_100g");
  const kcal = num("energy-kcal_100g") ?? (kj !== null ? Math.round(kj / 4.184) : null);
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
  // Una schermata semplice: in ogni momento un solo tasto grande, il resto sono piccoli link
  const s = c.scansione, st = s.stato;
  const link = (azione, testo) => `<button class="btn-link scan-link" data-lib="${azione}">${testo}</button>`;
  const campo = (titolo) => `<label class="wiz-l">${titolo}</label>
    <input id="scan-manuale" class="qta-input wiz-full" inputmode="numeric" autocomplete="off" placeholder="es. 8001234567890" value="${esc(s.codice || "")}">
    <button class="btn block scan-principale" data-lib="scan-cerca">🔎 Cerca il prodotto</button>`;
  let corpo = "";
  if (st === "fotocamera") corpo = `<div class="scan-video"><video id="scan-video" playsinline muted></video><span class="scan-mirino"></span></div>
      <p class="hint scan-aiuto">Inquadra il codice a barre</p>
      <button class="btn block scan-principale" data-lib="scan-scatta">📸 Scatta</button>
      <div class="scan-links">${link("scan-scrivi", "Scrivi il numero")}${link("scan-nuovo", "Non ha il codice")}</div>`;
  else if (st === "leggo") corpo = `<p class="scan-stato">Leggo il codice…</p>`;
  else if (st === "cerco") corpo = `<p class="scan-stato">Cerco il prodotto ${esc(s.codice)}…</p>`;
  else if (st === "letto") corpo = `<p class="scan-ok">✓ Codice letto: controlla il numero</p>${campo("Codice a barre")}
      <div class="scan-links">${link("scan", "📸 Rifai la foto")}</div>`;
  else if (st === "nontrovato") corpo = `<div class="scan-trovato scan-nontrovato"><p class="st-ko">✕ Prodotto non identificato</p>
      <p class="st-valori">${s.nomeArch ? `<b>${esc(s.nomeArch)}</b>: mancano i valori nutrizionali.` : `Il codice ${esc(s.codice)} non è nell'archivio.`} Aggiungilo tu fotografando la tabella nutrizionale.</p></div>
      <label class="btn block scan-principale scan-tabella">📸 Fotografa la tabella nutrizionale<input type="file" accept="image/*" capture="environment" hidden data-scan-tabella></label>
      <div class="scan-links">${link("scan-amano", "Scrivo io i valori")}${link("scan", "📸 Un altro codice")}</div>`;
  else if (st === "trovato" && s.prod) corpo = `<div class="scan-trovato"><p class="st-ok">✓ Prodotto trovato</p><p class="st-nome">${esc(s.prod.nome)}</p>
      <p class="st-valori"><b>${Math.round(s.prod.base4[0])} kcal</b> · P ${s.prod.base4[1]} · C ${s.prod.base4[2]} · G ${s.prod.base4[3]} <span>per 100 g</span></p>
      ${s.prod.porzione ? `<p class="st-porz">Porzione indicata: ${Math.round(s.prod.porzione)} g</p>` : ""}</div>
      <button class="btn block scan-principale" data-lib="scan-aggiungi">✓ Aggiungi al pasto</button>
      <div class="scan-links">${link("scan", "📸 Un altro codice")}</div>`;
  else corpo = `${s.messaggio ? `<p class="nota scan-msg">${s.messaggio}</p>` : ""}${campo("Numero sotto il codice a barre")}
      <div class="scan-links">${link("scan", "📸 Usa la fotocamera")}${link("scan-nuovo", "Non ha il codice")}</div>`;
  return `<button class="btn-link modal-indietro" data-lib="scan-annulla">‹ Torna al pasto</button>
    <h3 class="modal-title">Codice a barre</h3>${corpo}`;
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
// codice trovato nella foto: si scrive nel campo e si aspetta che tu lo confermi
function codiceLetto(cod) {
  if (!liberoCtx) return;
  liberoCtx.scansione = { stato: "letto", codice: String(cod || "").replace(/\D/g, "") };
  rirenderLibero();
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
  if (cod) codiceLetto(cod); else nonLetto();
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
    const trovato = (res) => { if (res && liberoCtx && liberoCtx.scansione && liberoCtx.scansione.stato === "fotocamera") { fermaFotocamera(); codiceLetto(res.getText()); } };
    try {   // fotocamera posteriore ad alta risoluzione: i codici piccoli si leggono meglio
      _controlli = await l.decodeFromConstraints({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } }, video, trovato);
    } catch (e) { _controlli = await l.decodeFromVideoDevice(undefined, video, trovato); }
  } catch (e) {
    if (!liberoCtx || !liberoCtx.scansione) return;
    liberoCtx.scansione = { stato: "manuale", messaggio: "Non riesco ad aprire la fotocamera. Controlla il permesso (Impostazioni → Safari → Fotocamera) oppure scrivi il numero qui sotto." };
    rirenderLibero();
  }
}
// dal «non identificato» al modulo del nuovo alimento: il codice resta legato, così la prossima volta lo trova subito
function apriNuovoDaCodice(c) {
  const s = c.scansione || {};
  c.scansione = null;
  if (s.stato === "nontrovato" && s.codice) { c.ignoto = "Prodotto " + s.codice; c.ignotoCodice = s.codice; c.nomeArchivio = s.nomeArch || ""; c.ignotoNuovo = false; }
  else { c.ignoto = null; c.ignotoCodice = null; c.ignotoNuovo = true; }
}
// prodotto trovato: prima lo vedi (nome e valori), poi lo aggiungi tu
function mostraTrovato(prod, codice) {
  if (!liberoCtx) return;
  liberoCtx.scansione = { stato: "trovato", prod, codice };
  rirenderLibero();
}
async function cercaCodice(codice) {
  const c = liberoCtx; if (!c) return;
  codice = String(codice || "").replace(/\D/g, "");
  if (codice.length < 6) { c.scansione = { stato: "manuale", codice, messaggio: "Il numero sembra incompleto." }; rirenderLibero(); return; }
  // già scansionato in passato: funziona anche offline
  const noto = leggiCodici()[codice] || CODICI_NOTI[codice];
  if (noto && (window.ALIMENTI || {})[noto]) {
    const v = window.ALIMENTI[noto];
    mostraTrovato({ nome: noto, base4: v, extra4: (window.NUTRIENTI_EXTRA || {})[noto] || null }, codice); return;
  }
  c.scansione = { stato: "cerco", codice }; rirenderLibero();
  try {
    const r = await fetch(`${OFF_PRODOTTO}${codice}.json?fields=${OFF_CAMPI}`);
    const d = await r.json();
    const prod = d && d.status === 1 ? daOpenFoodFacts(d.product || {}) : null;
    if (!liberoCtx) return;
    if (prod) { mostraTrovato(prod, codice); return; }
    const pr = d && d.status === 1 ? (d.product || {}) : null, nomeArch = pr ? String(pr.product_name_it || pr.product_name || "").trim() : "";
    // non c'è: riquadro rosso, poi foto della tabella (o valori a mano)
    liberoCtx.scansione = { stato: "nontrovato", codice, nomeArch };
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
    // il servizio di ricerca per nome esiste solo dove l'app è pubblicata su Netlify (su GitHub Pages non c'è): lì il messaggio dice cosa fare
    const senzaServizio = navigator.onLine && !/netlify\.app$/.test(location.hostname) && location.hostname !== "localhost";
    liberoCtx.ricercaOFF = { q, stato: "errore", messaggio: senzaServizio
      ? "La ricerca per nome dei prodotti confezionati non è disponibile in questa versione dell'app: usa il pulsante del codice a barre (accanto alla ricerca) o fotografa la tabella nutrizionale."
      : "Ricerca non disponibile in questo momento (serve internet)." };
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
    if (a === "scan-amano") { apriNuovoDaCodice(c); rirenderLibero(); return; }
    if (a === "scan-scrivi") { fermaFotocamera(); c.scansione = { stato: "manuale" }; rirenderLibero(); const i2 = document.getElementById("scan-manuale"); if (i2) i2.focus(); return; }
    if (a === "scan-aggiungi" && c.scansione && c.scansione.prod) { usaProdotto(c.scansione.prod, c.scansione.codice); return; }
    if (a === "scan-cerca") { fermaFotocamera(); cercaCodice((document.getElementById("scan-manuale") || {}).value); return; }
    if (a === "off-cerca") { cercaProdottiOFF(c.ignoto || ""); return; }
    const sc = e.target.closest("[data-off-scegli]");
    if (sc && c.ricercaOFF) { const p = c.ricercaOFF.risultati[+sc.dataset.offScegli]; if (p) usaProdotto(p, null); }
  });
  mc.addEventListener("change", (e) => {
    if (liberoCtx && e.target.matches("[data-scan-tabella]")) {   // nuovo alimento dalla foto della tabella: si apre il modulo e i valori si riempiono da soli
      const files = [...(e.target.files || [])]; e.target.value = ""; if (!files.length) return;
      const c = liberoCtx; fermaFotocamera(); apriNuovoDaCodice(c); rirenderLibero();
      if (typeof leggiEtichettaDaFile === "function") leggiEtichettaDaFile("etic-libero", files);
    }
  });
  mc.addEventListener("keydown", (e) => {
    if (liberoCtx && e.key === "Enter" && e.target.id === "scan-manuale") { e.preventDefault(); fermaFotocamera(); cercaCodice(e.target.value); }
  });
  // chiudendo il pannello si spegne la fotocamera
  document.getElementById("modal").addEventListener("click", (e) => { if (e.target.closest("[data-chiudi]")) fermaFotocamera(); });
});
