// =============================================================
//  Swipe a sinistra per eliminare, come su iPhone
//  Trascini una riga verso sinistra: compare il cestino rosso, lo tocchi e l'elemento sparisce.
//  Vale per ingredienti, piatti mangiati, voci della spesa, ricette, pesate, sport e passaggi.
// =============================================================
const SWIPE_LARG = 84; // larghezza del cestino
const via = (sel) => (r) => { const b = r.querySelector(sel); return b ? () => b.click() : null; };
const SWIPE_RIGHE = [
  [".sport-riga:not(.nuovo)", via(".lib-del")],
  [".avviso-tocca", via(".avviso-ok")],   // l'avviso delle proteine: tocco = idee, swipe a sinistra = lo chiudi
  ["#spesa li", via("[data-spesa-del]")],
  [".wiz-ing", via(".lib-del")],
  [".wiz-step", via(".lib-del")],
  [".lista-pesi li", via("[data-peso-del]")],
  [".pm-sezione:not(.bloccato) .pm-ricetta:not(.aperto)", via("[data-grp-del]")],   // la scheda di una ricetta nel pasto, da chiusa (tutto il riquadro): swipe a sinistra = toglie tutto il piatto (con Annulla). Aperta ha già i cestini degli ingredienti
  [".pm-sezione:not(.bloccato) .lib-voce:not(.aperta)", via("[data-lib-del]")],   // la scheda di un ingrediente scritto a mano, da chiusa (tutto il riquadro): swipe a sinistra = lo toglie (con Annulla). Aperta ha il suo cestino
  [".pasto-gruppo:not(.passato) .pasto-riga.fatto", (r) => () => eliminaPastoMomento(r.dataset.oggiMomento)],   // il riquadro del pasto in Oggi: solo il cestino (un pasto passato non si toglie da qui)
  [".lib-furbo[data-furbo-k]", (r) => () => scartaSuggerimento(r.dataset.furboK)],   // un suggerimento che non ti va: swipe a sinistra e ne arriva un altro
  ["#lista-ricette .riga-ricetta", (r) => r.dataset.nome ? () => eliminaRicetta(r.dataset.nome) : null],
];

// Elimina un intero pasto (tutti i piatti di quel momento) dalla schermata Oggi, con Annulla
function eliminaPastoMomento(momento) {
  if (!momento) return;
  const data = dataDiario, g = giornoDiario(data), tolti = g.pasti.filter(p => p.pasto === momento).map(p => clone(p));
  if (!tolti.length) return;
  g.pasti = g.pasti.filter(p => p.pasto !== momento);
  scriviGiorno(data, g);
  renderOggi();
  mostraToast(`Tolto: ${nomePasto(momento, data)}`, "Annulla", () => { const g2 = giornoDiario(data); g2.pasti = g2.pasti.concat(tolti); scriviGiorno(data, g2); renderOggi(); });
}

function preparaSwipe() {
  SWIPE_RIGHE.forEach(([sel, azione]) => {
    document.querySelectorAll(sel).forEach((r) => {
      if (r.parentNode && r.parentNode.classList.contains("sw")) return;
      const az = azione(r);
      if (!az) return;
      const fn = typeof az === "function" ? az : az.elimina;
      const cs = getComputedStyle(r);
      const w = document.createElement("div");
      w.className = "sw";
      w.style.margin = cs.margin;
      r.style.margin = "0";
      const f = document.createElement("button");
      f.type = "button"; f.className = "sw-fondo"; f.setAttribute("aria-label", "Elimina");
      f.innerHTML = typeof ICONA_CESTINO === "string" ? ICONA_CESTINO : "🗑";
      const az2 = document.createElement("div");   // i tasti stanno in un contenitore largo quanto lo spazio che il gesto libera: sotto la riga non c'è mai niente
      az2.className = "sw-azioni";
      r.parentNode.insertBefore(w, r);
      w.appendChild(az2); w.appendChild(r);
      r.classList.add("sw-corpo");
      w._elimina = fn; w._larg = SWIPE_LARG; w._azioni = az2;
      if (az.cambia) {   // secondo tasto, accanto al cestino
        const c2 = document.createElement("button");
        c2.type = "button"; c2.className = "sw-fondo sw-cambia"; c2.setAttribute("aria-label", "Cambia");
        c2.textContent = "↻";
        az2.appendChild(c2);
        w._cambia = az.cambia; w._larg = SWIPE_LARG * 2;
      }
      az2.appendChild(f);
    });
  });
}
const swLarghezza = (w, px, anim) => { if (w._azioni) { w._azioni.style.transition = anim ? "" : "none"; w._azioni.style.width = px + "px"; } };
function chiudiSwipe(w) {
  const c = w.querySelector(".sw-corpo");
  w.classList.remove("aperto", "sw-mov");
  swLarghezza(w, 0, true);
  if (c) { c.style.transition = ""; c.style.transform = ""; }
}

document.addEventListener("DOMContentLoaded", () => {
  let attesa = false;
  new MutationObserver(() => {
    if (attesa) return;
    attesa = true;
    setTimeout(() => { attesa = false; preparaSwipe(); }, 30);
  }).observe(document.body, { childList: true, subtree: true });
  preparaSwipe();

  let sw = null, bloccaClick = 0, eseguendo = false;
  // Inizio del gesto (dito o mouse): chiude le altre righe aperte e memorizza da dove parti
  function inizio(x, y, target) {
    // il dito sul cestino rosso non deve richiudere la riga: altrimenti il cestino sparisce prima del tocco
    if (target.closest && target.closest(".sw-fondo")) { sw = null; return; }
    const c = target.closest && target.closest(".sw-corpo");
    document.querySelectorAll(".sw.aperto").forEach((w) => { if (!c || w !== c.parentNode) chiudiSwipe(w); });
    if (!c || target.closest(".sw-fondo")) { sw = null; return; }
    const w = c.parentNode;
    sw = { w, c, x0: x, y0: y, base: w.classList.contains("aperto") ? -w._larg : 0, mosso: false, x: 0 };
  }
  // Movimento: se è orizzontale la riga segue il dito, se è verticale lasci scorrere la pagina
  function muovi(x, y, e) {
    if (!sw) return;
    const dx = x - sw.x0, dy = y - sw.y0;
    if (!sw.mosso) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      sw.mosso = true;
      sw.w.classList.add("sw-mov");
    }
    if (e && e.cancelable) e.preventDefault(); // il gesto orizzontale è nostro: niente scorrimento né selezione
    sw.x = Math.max(-sw.w._larg * 1.15, Math.min(0, sw.base + dx));
    sw.c.style.transition = "none";
    sw.c.style.transform = `translateX(${sw.x}px)`;
    swLarghezza(sw.w, -sw.x, false);
  }
  const fine = () => {
    if (!sw) return;
    if (sw.mosso) {
      const aperto = sw.x < -sw.w._larg * 0.4;
      sw.c.style.transition = "";
      sw.c.style.transform = aperto ? `translateX(${-sw.w._larg}px)` : "";
      sw.w.classList.toggle("aperto", aperto);
      swLarghezza(sw.w, aperto ? sw.w._larg : 0, true);
      if (!aperto) sw.w.classList.remove("sw-mov");
      bloccaClick = Date.now();
    }
    sw = null;
  };
  // Telefono: eventi touch (i più affidabili su iPhone)
  document.addEventListener("touchstart", (e) => { if (e.touches.length === 1) inizio(e.touches[0].clientX, e.touches[0].clientY, e.target); else sw = null; }, { passive: true });
  document.addEventListener("touchmove", (e) => { if (e.touches.length === 1) muovi(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
  document.addEventListener("touchend", fine, { passive: true });
  document.addEventListener("touchcancel", fine, { passive: true });
  // Computer: mouse
  let mouseGiu = false;
  document.addEventListener("mousedown", (e) => { if (e.button === 0 && !("ontouchstart" in window)) { mouseGiu = true; inizio(e.clientX, e.clientY, e.target); } });
  document.addEventListener("mousemove", (e) => { if (mouseGiu) muovi(e.clientX, e.clientY, e); });
  document.addEventListener("mouseup", () => { if (mouseGiu) { mouseGiu = false; fine(); } });
  // dopo uno swipe il "click" che segue non deve aprire la riga; con la riga aperta, un tocco la richiude
  document.addEventListener("click", (e) => {
    const f = e.target.closest(".sw-fondo");
    if (f) { e.preventDefault(); e.stopPropagation(); const w = f.closest(".sw"); const fn = f.classList.contains("sw-cambia") ? w._cambia : w._elimina; chiudiSwipe(w); eseguendo = true; try { if (fn) fn(); } finally { eseguendo = false; } return; }
    if (eseguendo) return;
    const c = e.target.closest(".sw-corpo");
    if (c && (Date.now() - bloccaClick < 350 || c.parentNode.classList.contains("aperto"))) {
      e.preventDefault(); e.stopPropagation();
      if (c.parentNode.classList.contains("aperto")) chiudiSwipe(c.parentNode);
    }
  }, true);
});
