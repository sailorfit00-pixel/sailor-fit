// =============================================================
//  Questionario iniziale, una domanda alla volta (come questionario.html)
//  - si apre da solo la prima volta (persona nuova: mp_benvenuto = "da fare")
//  - si può rifare dal Profilo: parte con le risposte di adesso e non tocca il diario
//  Le risposte restano in memoria (e in sessionStorage, se la pagina si ricarica)
//  e si salvano nel profilo solo alla fine, con «Inizia».
// =============================================================

// [etichetta, emoji, valore]
const QZ_SPORT = [["CrossFit", "🏋️", "crossfit"], ["Sala pesi", "💪", "pesi"], ["Allenamento funzionale", "🤸‍♀️", "funzionale"], ["Corsa", "🏃", "corsa"],
  ["Camminata", "🚶", "camminata"], ["Bici", "🚴", "bici"], ["Nuoto", "🏊", "nuoto"], ["Yoga/Pilates", "🧘", "yoga"], ["Padel/Tennis", "🎾", "padel"],
  ["Ballo", "💃", "ballo"], ["Equitazione", "🐴", "equitazione"], ["Sport di squadra", "🏐", "squadra"], ["Nessuno", "🛋️", "nessuno"]];
// sport che l'app non ha di serie: si aggiungono con un'intensità adatta (kcal al minuto per kg)
const QZ_SPORT_NUOVI = { nuoto: ["Nuoto", "🏊‍♀️", 0.09], yoga: ["Yoga/Pilates", "🧘‍♀️", 0.05], padel: ["Padel/Tennis", "🎾", 0.08], squadra: ["Sport di squadra", "🏐", 0.085] };
const QZ_PASTI = [["Colazione", "☕", "colazione"], ["Spuntino", "🍎", "mattina"], ["Pranzo", "🍝", "pranzo"], ["Merenda", "🥪", "spuntino"], ["Cena", "🍲", "cena"]];
const QZ_GIORNI = [["Lunedì", "L", 0], ["Martedì", "M", 1], ["Mercoledì", "M", 2], ["Giovedì", "G", 3], ["Venerdì", "V", 4], ["Sabato", "S", 5], ["Domenica", "D", 6]];
const QZ_OBIETTIVI = [["Dimagrire", "📉", "dimagrire", 15], ["Mantenere il peso", "⚖️", "mantenere", 0], ["Mettere massa", "💪", "massa", -10]];
const QZ_LAVORO = [["Seduta/o quasi tutto il giorno", "🪑", "seduto", 1.2], ["In piedi o in movimento", "🚶", "piedi", 1.35], ["Lavoro fisico", "🧱", "fisico", 1.5]];
const QZ_ORA_ALLEN = [["Mattina", "🌅", "mattina"], ["Pausa pranzo", "🍽️", "pranzo"], ["Pomeriggio", "☀️", "pomeriggio"], ["Sera", "🌙", "sera"]];
const QZ_DIETA = [["Mangio di tutto", "🍽️", "tutto"], ["Vegetariana/o", "🥕", "vegetariana"], ["Vegana/o", "🌱", "vegana"]];
const QZ_NESSUNO = "nessuno";

const senzaSport = (R) => !(R.sport || []).length || (R.sport || []).includes(QZ_NESSUNO);
// tipo: t testo · n numero · u una scelta · m più scelte · orari · colore · nomeApp · riepilogo
const QZ = [
  { k: "nome", t: "t", e: "👋", q: "Come ti chiami?", ph: "Il tuo nome", opz: 1, nota: "Serve solo per salutarti nell'app." },
  { k: "sesso", t: "u", e: "🙋", q: "Sei…", o: [["Donna", "👩", "donna"], ["Uomo", "👨", "uomo"]] },
  { k: "eta", t: "n", e: "🎂", q: "Quanti anni hai?", un: "anni", ph: "34", min: 10, max: 100 },
  { k: "altezza", t: "n", e: "📏", q: "Quanto sei alta/o?", un: "cm", ph: "168", min: 100, max: 230 },
  { k: "peso", t: "n", e: "⚖️", q: "Quanto pesi?", un: "kg", ph: "65", min: 25, max: 300, dec: 1 },
  { k: "obiettivo", t: "u", e: "✨", q: "Qual è il tuo obiettivo?", o: QZ_OBIETTIVI },
  { k: "lavoro", t: "u", e: "💼", q: "Com'è la tua giornata?", o: QZ_LAVORO, nota: "Senza contare lo sport: serve a stimare quanto consumi ogni giorno." },
  { k: "sport", t: "m", e: "🏃‍♀️", q: "Che sport fai?", o: QZ_SPORT, excl: QZ_NESSUNO, req: 1 },
  { k: "giorni", t: "m", e: "📅", q: "In quali giorni ti alleni di solito?", o: QZ_GIORNI.map(([l, , v]) => [l, "", v]), salta: senzaSport, nota: "Poi potrai scegliere lo sport giorno per giorno nel Profilo." },
  { k: "oraAllen", t: "u", e: "🕒", q: "A che ora ti alleni di solito?", o: QZ_ORA_ALLEN, salta: senzaSport },
  { k: "pasti", t: "m", e: "🍽️", q: "Quali pasti fai ogni giorno?", o: QZ_PASTI, req: 1 },
  { k: "orari", t: "orari", e: "⏰", q: "A che ora mangi, più o meno?", nota: "Servono a sapere qual è il prossimo pasto e quando un pasto è passato." },
  { k: "dieta", t: "u", e: "🥗", q: "Come mangi?", o: QZ_DIETA },
  { k: "allergie", t: "m", e: "⚠️", q: "Hai allergie o intolleranze?", o: [["Nessuna", "👍", QZ_NESSUNO]].concat(ALLERGIE.map(([v, l, e]) => [l, e, v])), excl: QZ_NESSUNO,
    nota: "Le ricette con questi alimenti non ti verranno proposte. L'app riconosce gli alimenti dal nome e può sbagliare: controlla sempre gli ingredienti." },
  { k: "nonMangio", t: "m", e: "🚫", q: "C'è qualcosa che non mangi proprio?", o: [["Niente, mangio tutto", "👍", QZ_NESSUNO]].concat(NON_MANGIO.map(([v, l, e]) => [l, e, v])), excl: QZ_NESSUNO },
  { k: "colore", t: "colore", e: "🎨", q: "Scegli il colore della tua app" },
  { k: "nomeApp", t: "nomeApp", e: "✏️", q: "Come vuoi chiamare la tua app?" },
  { k: "fine", t: "riepilogo", e: "🎉", q: "Ecco il tuo punto di partenza" },
];

let qz = null;   // { R: risposte, step, rifai }
const QZ_CHIAVE = "sf_benvenuto_corso";
function qzSalva() { try { sessionStorage.setItem(QZ_CHIAVE, JSON.stringify(qz)); } catch (e) {} }
const qzAttiva = (q) => !(q.salta && q.salta(qz.R));
function qzProssimo(da, dir) { let i = da + dir; while (i >= 0 && i < QZ.length && !qzAttiva(QZ[i])) i += dir; return i; }

// Risposte di partenza: vuote per una persona nuova, quelle di adesso se rifai il questionario
function qzRisposteAttuali() {
  const pf = leggiProfilo(), tipi = leggiTipi(), o = orariPasti();
  const sport = [...new Set(tipi.flatMap(t => sportDelTipo(t)))];
  const daSport = (id) => QZ_SPORT.some(x => x[2] === id) ? id : Object.keys(QZ_SPORT_NUOVI).find(k => slug(QZ_SPORT_NUOVI[k][0]) === id);
  const ob = pf.deficit > 0 ? "dimagrire" : pf.deficit < 0 ? "massa" : "mantenere";
  const lav = (QZ_LAVORO.find(x => x[3] === (pf.fattoreAttivita || 1.2)) || QZ_LAVORO[0])[2];
  const e = pf.esclusioni || {};
  return {
    nome: pf.nome || "", sesso: pf.sesso || "", eta: pf.eta || "", altezza: pf.altezza || "", peso: pf.peso || "", obiettivo: ob, lavoro: lav,
    sport: sport.length ? sport.map(daSport).filter(Boolean) : [QZ_NESSUNO],
    giorni: tipi.map((t, i) => sportDelTipo(t).length ? i : -1).filter(i => i >= 0),
    oraAllen: pf.allenOrario === "mattina" ? "mattina" : pf.allenOrario === "sera" ? "sera" : "",
    pasti: Array.isArray(pf.pasti) && pf.pasti.length ? pf.pasti.slice() : ORDINE_TEMPO.slice(),
    orari: Object.fromEntries(ORDINE_TEMPO.map(p => [p, o[p]])),
    dieta: e.dieta || "tutto", allergie: (e.allergie || []).length ? e.allergie.slice() : [QZ_NESSUNO], nonMangio: (e.nonMangio || []).length ? e.nonMangio.slice() : [QZ_NESSUNO],
    colore: pf.colore || "lilla", iconaApp: pf.iconaApp || "🌙", nomeApp: pf.nomeApp || "Sailor Fit",
  };
}
function apriQuestionario(rifai) {
  let ripreso = null; try { ripreso = JSON.parse(sessionStorage.getItem(QZ_CHIAVE) || "null"); } catch (e) {}
  if (ripreso && !!ripreso.rifai === !!rifai) qz = ripreso;
  else if (rifai) qz = { R: qzRisposteAttuali(), step: 0, rifai: true };
  else qz = { R: { orari: Object.fromEntries(ORDINE_TEMPO.map(p => [p, ORARI_DEFAULT[p]])), colore: "lilla", iconaApp: "🌙", nomeApp: "Sailor Fit" }, step: 0, rifai: false };
  editCtx = null;
  openModal(`<div class="qz" id="qz"></div>`);
  document.getElementById("modal").classList.add("modal-qz");
  qzRender();
}
// la persona nuova: al posto della vecchia schermata unica
function apriBenvenuto() { apriQuestionario(false); }

function qzValido(q) {
  const v = qz.R[q.k];
  if (q.opz) return true;
  if (q.t === "n") { const n = parseFloat(String(v ?? "").replace(",", ".")); return n >= q.min && n <= q.max; }
  if (q.t === "t") return String(v || "").trim() !== "";
  if (q.t === "u") return !!v;
  if (q.t === "m") return !q.req || (v || []).length > 0;
  if (q.t === "orari") { const s = ORDINE_TEMPO.filter(p => (qz.R.pasti || []).includes(p)).map(p => qz.R.orari[p]); return s.every(h => typeof h === "number") && s.every((h, i) => !i || h > s[i - 1]); }
  if (q.t === "nomeApp") return String(qz.R.nomeApp || "").trim() !== "";
  return true;
}
// stima dei primi obiettivi con le risposte (stessa formula di tipoInfo, per un giorno di riposo)
function qzStima() {
  const R = qz.R, kg = parseFloat(String(R.peso).replace(",", "."));
  const bmr = basaleMifflin({ uomo: R.sesso === "uomo", eta: +R.eta, cm: +R.altezza, kg });
  const fatt = (QZ_LAVORO.find(x => x[2] === R.lavoro) || QZ_LAVORO[0])[3], def = (QZ_OBIETTIVI.find(x => x[2] === R.obiettivo) || QZ_OBIETTIVI[0])[3];
  const pf = qz.rifai ? leggiProfilo() : {};
  const protKg = qz.rifai ? pf.protKg : 1.8, grassiKg = qz.rifai ? pf.grassiKg : 0.9;
  const kcal = pf.kcalMan > 0 ? Math.max(bmr, pf.kcalMan) : Math.max(bmr, Math.round(bmr * fatt * (1 - def / 100) / 50) * 50);
  const proteine = pf.protMan > 0 ? Math.round(pf.protMan) : Math.round(kg * protKg / 5) * 5, grassi = pf.grassiMan > 0 ? Math.round(pf.grassiMan) : Math.round(kg * grassiKg);
  return { bmr, kcal, proteine, grassi, carboidrati: Math.max(50, Math.round((kcal - proteine * 4 - grassi * 9) / 20) * 5) };
}

function qzRender() {
  const box = document.getElementById("qz"); if (!box || !qz) return;
  if (qz.step >= QZ.length) qz.step = QZ.length - 1;
  const q = QZ[qz.step], R = qz.R, v = R[q.k];
  const tot = QZ.filter(qzAttiva).length, fatti = QZ.slice(0, qz.step).filter(qzAttiva).length;
  let h = `<div class="qz-top"><button class="qz-ind" data-qz-ind aria-label="Indietro" ${qz.step === 0 ? "hidden" : ""}>←</button>
    <div class="qz-bar"><i style="width:${Math.round(fatti / tot * 100)}%"></i></div></div>
    <h2 class="qz-q"><span>${q.e}</span>${esc(q.q)}</h2>`;
  if (q.t === "t" || q.t === "n") {
    h += `<div class="qz-u"><input class="qz-inp" id="qz-inp" ${q.t === "n" ? (q.dec ? `type="text" inputmode="decimal" autocomplete="off"` : `type="number" inputmode="numeric" step="1"`) : `type="text" autocomplete="given-name"`}
      placeholder="${esc(q.ph || "")}" value="${esc(v ?? "")}">${q.un ? `<b>${q.un}</b>` : ""}</div>`;
  } else if (q.t === "u" || q.t === "m") {
    const sel = q.t === "m" ? (v || []) : (v ? [v] : []);
    h += `<div class="qz-sc ${q.k === "giorni" ? "qz-giorni" : ""}">${q.o.map((o, i) => `<button class="qz-b ${sel.includes(o[2]) ? "on" : ""}" data-qz-o="${i}">${o[1] ? `<span class="qz-e">${o[1]}</span>` : ""}<span>${esc(o[0])}</span></button>`).join("")}</div>`;
    if (q.t === "m") h += `<p class="qz-pic">Puoi sceglierne più di uno</p>`;
  } else if (q.t === "orari") {
    const scelti = QZ_PASTI.filter(p => (R.pasti || []).includes(p[2]));
    h += `<div class="qz-orari">${scelti.map(([l, e, k]) => `<label class="qz-ora"><span>${e} ${l}</span><input type="time" step="900" data-qz-ora="${k}" value="${fmtOra(R.orari[k]).padStart(5, "0")}"></label>`).join("")}</div>`;
    if (!qzValido(q)) h += `<p class="qz-pic qz-err">Gli orari devono essere in ordine, dal primo all'ultimo pasto.</p>`;
  } else if (q.t === "colore") {
    h += `<div class="qz-colori">${(window.COLORI_APP || []).map(([k, l, c]) => `<button class="qz-col ${R.colore === k ? "on" : ""}" data-qz-colore="${k}" style="--c:${c}"><i></i><span>${l}</span></button>`).join("")}</div>`;
  } else if (q.t === "nomeApp") {
    h += `<div class="qz-icone">${ICONE_APP.map(i => `<button class="qz-ico ${R.iconaApp === i ? "on" : ""}" data-qz-icona="${i}">${i}</button>`).join("")}</div>
      <input class="qz-inp" id="qz-nome-app" type="text" maxlength="24" placeholder="Sailor Fit" value="${esc(R.nomeApp || "")}">
      <p class="qz-anteprima">${esc(R.iconaApp || "🌙")} ${esc(R.nomeApp || "Sailor Fit")}</p>
      <p class="qz-pic">Il nome sotto l'icona nella schermata Home lo decide il telefono quando aggiungi l'app.</p>`;
  } else if (q.t === "riepilogo") {
    const s = qzStima(), ob = (QZ_OBIETTIVI.find(x => x[2] === R.obiettivo) || [])[0] || "";
    h += `<div class="qz-riep">
      <p>${R.nome ? `${esc(R.nome)}, il` : "Il"} tuo obiettivo: <b>${esc(ob.toLowerCase())}</b>.</p>
      <div class="qz-num"><b>${s.kcal}</b><span>kcal in un giorno di riposo</span></div>
      <p class="qz-macro">Proteine <b>${s.proteine} g</b> · Carboidrati <b>${s.carboidrati} g</b> · Grassi <b>${s.grassi} g</b></p>
      <p class="qz-pic">${senzaSport(R) ? "" : "Nei giorni di allenamento un po' di più, in base allo sport. "}Sono stime da cui partire: potrai cambiare tutto nel Profilo.</p>
      ${qz.rifai ? `<p class="qz-pic">Il diario non cambia. Si aggiornano profilo, settimana tipo, orari e cibi esclusi.</p>` : ""}</div>`;
  }
  if (q.nota) h += `<p class="qz-pic">${esc(q.nota)}</p>`;
  if (qz.step === 0 && !qz.rifai) h += `<button class="btn-link qz-backup" data-azione="ripristina">Hai già usato l'app? Ripristina un backup ›</button>`;
  const ultimo = q.t === "riepilogo";
  h += `<div class="qz-foot"><button class="btn block" id="qz-avanti" ${qzValido(q) ? "" : "disabled"}>${ultimo ? "✓ Inizia" : q.opz && !v ? "Salta →" : "Avanti →"}</button></div>`;
  box.innerHTML = h;
  const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = 0;
  const inp = document.getElementById("qz-inp"); if (inp && !v) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 150);
}
function qzAggiornaBtn() {
  const q = QZ[qz.step], b = document.getElementById("qz-avanti"); if (!b) return;
  b.disabled = !qzValido(q);
  if (q.t !== "riepilogo") b.textContent = q.opz && !qz.R[q.k] ? "Salta →" : "Avanti →";
}

document.addEventListener("input", (e) => {
  if (!qz || !e.target.closest || !e.target.closest("#qz")) return;
  const q = QZ[qz.step];
  if (e.target.id === "qz-inp") { qz.R[q.k] = e.target.value; qzSalva(); qzAggiornaBtn(); }
  if (e.target.id === "qz-nome-app") { qz.R.nomeApp = e.target.value; const a = document.querySelector(".qz-anteprima"); if (a) a.textContent = `${qz.R.iconaApp} ${qz.R.nomeApp || "Sailor Fit"}`; qzSalva(); qzAggiornaBtn(); }
});
document.addEventListener("change", (e) => {
  if (!qz || !e.target.matches || !e.target.matches("[data-qz-ora]")) return;
  const h = oraDa(e.target.value); if (h !== null) qz.R.orari[e.target.dataset.qzOra] = h;
  qzSalva(); qzRender();
});
document.addEventListener("keydown", (e) => {
  if (qz && e.key === "Enter" && e.target.id === "qz-inp") { e.preventDefault(); qzAvanti(); }
});
document.addEventListener("click", (e) => {
  if (!qz || !e.target.closest || !e.target.closest("#qz")) return;
  const q = QZ[qz.step];
  if (e.target.closest("[data-qz-ind]")) { const i = qzProssimo(qz.step, -1); if (i >= 0) { qz.step = i; qzSalva(); qzRender(); } return; }
  if (e.target.closest("#qz-avanti")) { qzAvanti(); return; }
  const ob = e.target.closest("[data-qz-o]");
  if (ob) {
    const val = q.o[+ob.dataset.qzO][2];
    if (q.t === "u") qz.R[q.k] = val;
    else {
      let cur = (qz.R[q.k] || []).slice(); const p = cur.indexOf(val);
      if (q.excl && val === q.excl) cur = p > -1 ? [] : [val];
      else { cur = cur.filter(x => x !== q.excl); if (p > -1) cur.splice(cur.indexOf(val), 1); else cur.push(val); }
      qz.R[q.k] = cur;
    }
    qzSalva(); qzRender(); return;
  }
  const col = e.target.closest("[data-qz-colore]");
  if (col) { qz.R.colore = col.dataset.qzColore; if (window.applicaColore) window.applicaColore(qz.R.colore); qzSalva(); qzRender(); return; }   // il colore si vede subito
  const ic = e.target.closest("[data-qz-icona]");
  if (ic) { qz.R.iconaApp = ic.dataset.qzIcona; qzSalva(); qzRender(); return; }
});
function qzAvanti() {
  const q = QZ[qz.step]; if (!qzValido(q)) return;
  if (q.t === "riepilogo") { qzFine(); return; }
  qz.step = Math.min(qzProssimo(qz.step, 1), QZ.length - 1);
  qzSalva(); qzRender();
}

// «Inizia»: le risposte diventano profilo, settimana tipo, orari e cibi esclusi
function qzFine() {
  const R = qz.R, pf = leggiProfilo(), nuovo = !qz.rifai;
  const kg = Math.round(parseFloat(String(R.peso).replace(",", ".")) * 10) / 10;
  Object.assign(pf, {
    nome: String(R.nome || "").trim(), sesso: R.sesso, eta: Math.round(+R.eta), altezza: Math.round(+R.altezza), peso: kg, bmrAuto: true,
    deficit: (QZ_OBIETTIVI.find(x => x[2] === R.obiettivo) || QZ_OBIETTIVI[0])[3],
    fattoreAttivita: (QZ_LAVORO.find(x => x[2] === R.lavoro) || QZ_LAVORO[0])[3],
    pasti: ORDINE_TEMPO.filter(p => (R.pasti || []).includes(p)),
    orari: Object.fromEntries(ORDINE_TEMPO.map(p => [p, R.orari[p]])),
    esclusioni: { dieta: R.dieta || "tutto", allergie: (R.allergie || []).filter(x => x !== QZ_NESSUNO), nonMangio: (R.nonMangio || []).filter(x => x !== QZ_NESSUNO) },
    colore: R.colore || "lilla", iconaApp: R.iconaApp || "🌙", nomeApp: String(R.nomeApp || "").trim() || "Sailor Fit",
  });
  if (!senzaSport(R)) pf.allenOrario = R.oraAllen === "pomeriggio" || R.oraAllen === "sera" ? "sera" : "mattina";
  if (!pf.nome) delete pf.nome;
  if (nuovo) Object.assign(pf, { protKg: 1.8, grassiKg: 0.9, recupero: 80 });   // chi rifà il questionario tiene i suoi macro
  // sport: quelli scelti si vedono (anche se erano stati tolti), quelli nuovi si aggiungono; per una persona nuova gli altri si nascondono
  const scelti = senzaSport(R) ? [] : R.sport.filter(x => x !== QZ_NESSUNO);
  const ids = scelti.map(s => {
    if (QZ_SPORT_NUOVI[s]) {
      const [nome, icona, kMin] = QZ_SPORT_NUOVI[s];
      let sp = pf.sport.find(x => x.nome.toLowerCase() === nome.toLowerCase());
      if (!sp) { sp = { id: slug(nome), nome, icona, kMin, min: 60 }; pf.sport.push(sp); }
      delete sp.nascosto; return sp.id;
    }
    const sp = pf.sport.find(x => x.id === s);
    if (sp) { delete sp.nascosto; return sp.id; }
    const def = SPORT_DEFAULT.find(x => x.id === s); if (def) { pf.sport.push(Object.assign({}, def)); return def.id; }
    return null;
  }).filter(Boolean);
  if (nuovo) pf.sport.forEach(sp => { if (!ids.includes(sp.id)) sp.nascosto = true; });
  salvaProfilo(pf);
  // settimana tipo: gli sport scelti a turno nei giorni di allenamento
  const giorni = senzaSport(R) ? [] : (R.giorni || []).slice().sort((a, b) => a - b);
  const tipi = Array(7).fill("riposo"); giorni.forEach((g, j) => { if (ids.length) tipi[g] = ids[j % ids.length]; });
  salvaTipi(tipi);
  // il peso di oggi entra anche tra le pesate (se oggi non ce n'è già una)
  const pesi = leggiPesi(); if (kg > 0 && !pesi.some(p => p.data === oggiISO())) { pesi.push({ data: oggiISO(), kg }); salvaPesi(pesi); }
  localStorage.setItem("mp_benvenuto", "fatto");
  try { sessionStorage.removeItem(QZ_CHIAVE); } catch (e) {}
  qz = null;
  document.getElementById("modal").classList.remove("modal-qz");
  closeModal();
  applicaPersonalizzazione();
  if (typeof renderOggi === "function") renderOggi();
  avviso(nuovo ? "Tutto pronto! 🎉" : "Profilo aggiornato");
}
// chiudendo il questionario a metà: le risposte restano per quando lo riapri; il colore torna quello salvato
{ const m = document.getElementById("modal");
  if (m) new MutationObserver(() => { if (m.hidden && m.classList.contains("modal-qz")) { m.classList.remove("modal-qz"); qz = null; applicaPersonalizzazione(); } })
    .observe(m, { attributes: true, attributeFilter: ["hidden"] }); }
