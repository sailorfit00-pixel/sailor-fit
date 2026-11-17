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
      ` : ""}
    ${s.stato === "cerco" ? `<p class="scan-stato">Cerco il prodotto ${esc(s.codice)}…</p>` : ""}
    ${s.messaggio ? `<p class="nota">${s.messaggio}</p>` : ""}
    <label class="wiz-l">Oppure scrivi il numero sotto il codice a barre</label>
    <div class="lib-add">
      <input id="scan-manuale" class="qta-input wiz-full" inputmode="numeric" autocomplete="off" placeholder="es. 8001234567890" value="${esc(s.codice || "")}">
      <button class="btn lib-piu" data-lib="scan-cerca" aria-label="Cerca il codice">→</button>
    </div>
    <div class="wiz-nav"><button class="btn-sec" data-lib="scan-annulla">Annulla</button><button class="btn-sec" data-lib="scan-nuovo">🥫 Nuovo alimento</button></div>`;
}
function caricaZXing() {
  if (window.ZXingBrowser) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "zxing-browser.min.js"; s.onload = ok; s.onerror = () => ko(new Error("libreria"));
    document.head.appendChild(s);
  });
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
    _lettore = _lettore || new ZXingBrowser.BrowserMultiFormatReader();
    _controlli = await _lettore.decodeFromVideoDevice(undefined, document.getElementById("scan-video"), (res) => {
      if (res && liberoCtx && liberoCtx.scansione && liberoCtx.scansione.stato === "fotocamera") { fermaFotocamera(); cercaCodice(res.getText()); }
    });
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
    avviso("Prodotto non trovato: inserisci i valori dall'etichetta");
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
    if (a === "scan-cerca") { fermaFotocamera(); cercaCodice((document.getElementById("scan-manuale") || {}).value); return; }
    if (a === "off-cerca") { cercaProdottiOFF(c.ignoto || ""); return; }
    const sc = e.target.closest("[data-off-scegli]");
    if (sc && c.ricercaOFF) { const p = c.ricercaOFF.risultati[+sc.dataset.offScegli]; if (p) usaProdotto(p, null); }
  });
  mc.addEventListener("keydown", (e) => {
    if (liberoCtx && e.key === "Enter" && e.target.id === "scan-manuale") { e.preventDefault(); fermaFotocamera(); cercaCodice(e.target.value); }
  });
  // chiudendo il pannello si spegne la fotocamera
  document.getElementById("modal").addEventListener("click", (e) => { if (e.target.closest("[data-chiudi]")) fermaFotocamera(); });
});
