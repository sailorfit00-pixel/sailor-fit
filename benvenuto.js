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
// sport scritti a mano («Arrampicata»): l'app non sa quanto si consuma, lo dice chi risponde. [chiave, etichetta, emoji, kcal al minuto per kg, come…]
const QZ_FATICA = [["leggero", "Leggero", "🙂", 0.05, "come yoga o una passeggiata"], ["medio", "Medio", "😅", 0.075, "come la bici"], ["intenso", "Intenso", "🥵", 0.1, "come CrossFit"]];
const qzFaticaDi = (kMin) => kMin < 0.0625 ? "leggero" : kMin < 0.0875 ? "medio" : "intenso";
// etichetta di uno sport del questionario (anche di uno scritto a mano): [nome, emoji, chiave]
const qzSportInfo = (x) => QZ_SPORT.find(y => y[2] === x) || (() => { const a = (qz && qz.R.sportAltri || []).find(s => s.x === x); return a ? [a.nome, "🏅", x] : [x, "", x]; })();
const QZ_PASTI = [["Colazione", "☕", "colazione"], ["Spuntino", "🍎", "mattina"], ["Pranzo", "🍝", "pranzo"], ["Merenda", "🥪", "spuntino"], ["Cena", "🍲", "cena"]];
const QZ_GIORNI = [["Lunedì", "L", 0], ["Martedì", "M", 1], ["Mercoledì", "M", 2], ["Giovedì", "G", 3], ["Venerdì", "V", 4], ["Sabato", "S", 5], ["Domenica", "D", 6]];
// [etichetta, emoji, valore, deficit %]; «definire»: taglio più morbido e più proteine, per perdere grasso tenendo i muscoli
const QZ_OBIETTIVI = [["Dimagrire", "📉", "dimagrire", 15], ["Definire (meno grasso, più tono)", "🔥", "definire", 10], ["Mantenere il peso", "⚖️", "mantenere", 0], ["Mettere massa", "💪", "massa", -10]];
const QZ_LAVORO = [["Seduta/o quasi tutto il giorno", "🪑", "seduto", 1.2], ["In piedi o in movimento", "🚶", "piedi", 1.35], ["Lavoro fisico", "🧱", "fisico", 1.5]];
// la fascia scelta diventa un orario (modificabile poi nel Profilo): prima delle 14 conta come mattina
// quando ti alleni, più o meno: una fascia della giornata (l'ora esatta cambia, il momento no). [etichetta, emoji, quando, ora indicativa]
const QZ_ORA_ALLEN = [["Presto", "🌅", "prima delle 8", 7], ["Mattina", "☀️", "dalle 8 a mezzogiorno", 11], ["Pausa pranzo", "🍽️", "tra le 12 e le 14", 13], ["Pomeriggio", "🌤️", "dalle 14 alle 18", 17], ["Sera", "🌙", "dopo le 18", 19]];
// la fascia di un'ora già salvata (rifacendo il questionario): la più vicina
const qzFasciaDi = (h) => typeof h === "number" ? QZ_ORA_ALLEN.reduce((b, f) => Math.abs(f[3] - h) < Math.abs(b[3] - h) ? f : b)[3] : null;
const QZ_DIETA = [["Vegetariana", "🥕", "vegetariana"], ["Vegana", "🌱", "vegana"]];
const QZ_NESSUNO = "nessuno";
// nomi di diete (non di cibi): scritti in «Altro» non escludono niente
const QZ_DIETE_NOTE = /cheto|keto|paleo|zona|dukan|digiuno|low ?carb|fodmap|mediterran|flexitar|pescetar|crudist|fruttar|alcalin|sirt|ipocalor|iperprotei|chetogen/;

const senzaSport = (R) => !(R.sport || []).length || (R.sport || []).includes(QZ_NESSUNO);
// tipo: t testo · n numero · u una scelta · m più scelte · orari · colore · nomeApp · riepilogo
const QZ = [
  // la prima schermata per chi apre l'app per la prima volta: benvenuto, «Iniziamo» e il ripristino del backup (rifacendo il questionario dal Profilo non c'è)
  { k: "intro", t: "intro", e: "🌙", q: "Benvenuta/o!", salta: () => !!(qz && qz.rifai) },
  { k: "nome", t: "t", e: "👋", q: "Come ti chiami?", ph: "Il tuo nome", opz: 1, nota: "Serve solo per salutarti nell'app." },
  { k: "sesso", t: "u", e: "🙋", q: "Sei…", o: [["Donna", "👩", "donna"], ["Uomo", "👨", "uomo"]] },
  { k: "eta", t: "n", e: "🎂", q: "Quanti anni hai?", un: "anni", ph: "34", min: 10, max: 100 },
  { k: "altezza", t: "n", e: "📏", q: "Quanto sei alta/o?", un: "cm", ph: "168", min: 100, max: 230 },
  { k: "peso", t: "n", e: "⚖️", q: "Quanto pesi?", un: "kg", ph: "65", min: 25, max: 300, dec: 1 },
  { k: "obiettivo", t: "u", e: "✨", q: "Qual è il tuo obiettivo?", o: QZ_OBIETTIVI },
  { k: "lavoro", t: "u", e: "💼", q: "Com'è la tua giornata?", o: QZ_LAVORO, nota: "Senza contare lo sport: serve a stimare quanto consumi ogni giorno." },
  { k: "sport", t: "m", e: "🏃‍♀️", q: "Che sport fai?", o: QZ_SPORT, excl: QZ_NESSUNO, req: 1 },
  { k: "giorni", t: "m", e: "📅", q: "In quali giorni ti alleni di solito?", o: QZ_GIORNI.map(([l, , v]) => [l, "", v]), salta: senzaSport, nota: "Quale sport fare ogni giorno lo scegli dopo, nella Settimana." },
  // per ora non si chiede: gli allenamenti si distribuiscono poi nella settimana (Settimana / I miei dati). Il codice resta per quando tornerà
  { k: "settimana", t: "settimana", e: "🗓️", q: "Cosa fai ogni giorno?", salta: () => true,
    nota: "Se in un giorno fai due allenamenti (es. equitazione e sala pesi), tocca tutti e due." },
  { k: "durate", t: "durate", e: "⏱️", q: "Quanto dura di solito ogni allenamento?", salta: senzaSport,
    nota: "Più o meno: serve a calcolare quanto consumi. Se un giorno è diverso (es. un'uscita lunga), lo cambi in Oggi toccando lo sport del giorno." },
  { k: "oraAllen", t: "ora", e: "🕒", q: "Quando ti alleni, di solito?", salta: (R) => senzaSport(R) || !qzSportConOra(R).length,   // solo camminate: non cambiano i pasti, l'ora non serve
    nota: "Basta il momento della giornata: serve ad adattare i pasti prima e dopo l'allenamento." },
  { k: "pasti", t: "m", e: "🍽️", q: "Quali pasti fai ogni giorno?", o: QZ_PASTI, req: 1, altro: "pastoAltro", altroPh: "Altro, dopo cena (es. spuntino serale)",
    nota: "Se dopo cena mangi qualcosa (uno yogurt, una tisana con biscotti…), scrivilo sopra: diventa un pasto in più, con il suo orario." },
  { k: "orari", t: "orari", e: "⏰", q: "A che ora mangi, più o meno?", nota: "Servono a sapere qual è il prossimo pasto e quando un pasto è passato." },
  { k: "dieta", t: "u", e: "🥗", q: "Segui un'alimentazione particolare?", o: QZ_DIETA, opz: 1, altro: "dietaAltri", altroPh: "Altro (es. senza zucchero)",
    nota: "Se no, vai avanti. Se scrivi «senza zucchero», i piatti con lo zucchero non ti vengono proposti. Diete come la chetogenica l'app non le segue: scrivi i cibi che eviti." },
  { k: "piattiVeg", t: "u", e: "🌱", q: "Ti proponiamo anche piatti vegani?", o: [["Sì, volentieri", "👍", "si"], ["No, non fanno per me", "🙅", "no"]], salta: (R) => !!R.dieta,
    nota: "Piatti con tofu, tempeh, seitan, yogurt di soia o proteine vegetali. Frittate, legumi e yogurt restano comunque." },
  { k: "allergie", t: "m", e: "⚠️", q: "Hai allergie o intolleranze?", o: [["Nessuna", "👍", QZ_NESSUNO]].concat(ALLERGIE.map(([v, l, e]) => [l, e, v])), excl: QZ_NESSUNO,
    altro: "allergieAltri", altroPh: "Altra allergia (es. sedano)",
    nota: "Le ricette con questi alimenti non ti verranno proposte. L'app riconosce gli alimenti dal nome e può sbagliare: controlla sempre gli ingredienti." },
  { k: "nonMangio", t: "m", e: "🚫", q: "C'è qualcosa che non mangi proprio?", o: [["Niente, mangio tutto", "👍", QZ_NESSUNO]].concat(NON_MANGIO.map(([v, l, e]) => [l, e, v])), excl: QZ_NESSUNO,
    altro: "nonMangioAltri", altroPh: "Altro cibo (es. kiwi)" },
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
  const obS = QZ_OBIETTIVI.find(x => x[2] === pf.obiettivo && x[3] === pf.deficit);   // l'obiettivo scelto, se il deficit è ancora quello
  const ob = obS ? obS[2] : pf.deficit > 0 ? "dimagrire" : pf.deficit < 0 ? "massa" : "mantenere";
  const lav = (QZ_LAVORO.find(x => x[3] === (pf.fattoreAttivita || 1.2)) || QZ_LAVORO[0])[2];
  const e = pf.esclusioni || {};
  return {
    nome: pf.nome || "", sesso: pf.sesso || "", eta: pf.eta || "", altezza: pf.altezza || "", peso: pf.peso || "", obiettivo: ob, lavoro: lav,
    sport: sport.length ? sport.map(s => daSport(s) || (pf.sport.some(x => x.id === s) ? "a:" + s : null)).filter(Boolean) : [QZ_NESSUNO],
    sportAltri: sport.filter(s => !daSport(s)).map(s => pf.sport.find(x => x.id === s)).filter(Boolean).map(sp => ({ x: "a:" + sp.id, nome: sp.nome, f: qzFaticaDi(sp.kMin || 0.075) })),
    giorni: tipi.map((t, i) => sportDelTipo(t).length ? i : -1).filter(i => i >= 0),
    settimana: Object.fromEntries(tipi.map((t, i) => [i, sportDelTipo(t).map(s => daSport(s) || "a:" + s).filter(Boolean)]).filter(([, l]) => l.length)),
    durate: Object.fromEntries(pf.sport.filter(sp => !sp.nascosto).map(sp => [daSport(sp.id) || "a:" + sp.id, sp.perKm ? (sp.km || 5) : (sp.min || 60)]).filter(([x]) => x)),
    oreSport: Object.fromEntries(pf.sport.filter(sp => typeof sp.ora === "number").map(sp => [daSport(sp.id) || "a:" + sp.id, sp.ora]).filter(([x]) => x)),
    oraAllen: typeof pf.allenOra === "number" ? pf.allenOra : pf.allenOrario === "mattina" ? 7.5 : pf.allenOrario === "sera" ? 19 : "",   // l'ora esatta: rifacendo il questionario non cambia
    pasti: Array.isArray(pf.pasti) && pf.pasti.length ? pf.pasti.slice() : ORDINE_BASE.slice(),
    pastoAltro: (pf.pasti || []).includes("sera") ? String(pf.nomeSera || "Spuntino serale") : "",
    orari: Object.fromEntries(ORDINE_TEMPO.map(p => [p, o[p]])),
    dieta: e.dieta || "", piattiVeg: e.senzaVeg ? "no" : "si", nonMangioAltri: (e.altri || []).join(", "), allergieAltri: (e.allergieAltre || []).join(", "), allergie: (e.allergie || []).length ? e.allergie.slice() : [QZ_NESSUNO], nonMangio: (e.nonMangio || []).length ? e.nonMangio.slice() : [QZ_NESSUNO],
    colore: pf.colore || "lilla", iconaApp: pf.iconaApp || "🌙", nomeApp: pf.nomeApp || "Sailor Fit",
  };
}
function apriQuestionario(rifai) {
  let ripreso = null; try { ripreso = JSON.parse(sessionStorage.getItem(QZ_CHIAVE) || "null"); } catch (e) {}
  if (ripreso && !!ripreso.rifai === !!rifai) qz = ripreso;
  else if (rifai) qz = { R: qzRisposteAttuali(), step: 0, rifai: true };
  else qz = { R: { orari: Object.fromEntries(ORDINE_TEMPO.map(p => [p, ORARI_DEFAULT[p]])), colore: "lilla", iconaApp: "🌙", nomeApp: "Sailor Fit" }, step: 0, rifai: false };
  editCtx = null;
  if (!qzAttiva(QZ[qz.step])) qz.step = qzProssimo(qz.step, 1);
  openModal(`<div class="qz" id="qz"></div>`);
  document.getElementById("modal").classList.add("modal-qz");
  // prima volta: il questionario occupa tutto lo schermo e non si chiude (né ✕, né tocco fuori, né la barra in basso) finché non lo finisci o ripristini un backup
  document.getElementById("modal").classList.toggle("qz-primo", !qz.rifai);
  document.body.classList.toggle("qz-primo", !qz.rifai);
  // anche rifacendolo dal Profilo: niente barra in basso finché è aperto (toccandola si usciva a metà)
  document.body.classList.add("qz-aperto");
  qzRender();
}
// la persona nuova: al posto della vecchia schermata unica
function apriBenvenuto() { apriQuestionario(false); }

// quanto dura di solito ogni sport: minuti (la corsa in km); di partenza la durata standard dello sport
const qzDurataBase = (x) => x === "corsa" ? 5 : ((SPORT_DEFAULT.find(d => d.id === x) || {}).min || 60);
function qzDuratePronte() {
  const R = qz.R, sp = (R.sport || []).filter(x => x !== QZ_NESSUNO);
  if (!R.durate || typeof R.durate !== "object") R.durate = {};
  if (R.kmCorsa && !R.durate.corsa) R.durate.corsa = parseFloat(String(R.kmCorsa).replace(",", ".")) || 5;   // risposte salvate con la domanda di prima
  sp.forEach(x => { if (!(R.durate[x] > 0)) R.durate[x] = qzDurataBase(x); });
  Object.keys(R.durate).forEach(x => { if (!sp.includes(x)) delete R.durate[x]; });
}
// la settimana del questionario: per ogni giorno scelto gli sport che fai; di partenza uno a turno (come prima), poi li cambi tu
function qzSettimanaPronta() {
  const R = qz.R, sp = (R.sport || []).filter(x => x !== QZ_NESSUNO), giorni = (R.giorni || []).slice().sort((a, b) => a - b);
  if (!R.settimana || typeof R.settimana !== "object") R.settimana = {};
  giorni.forEach((g, j) => { const l = (R.settimana[g] || []).filter(x => sp.includes(x)); R.settimana[g] = l.length || R.settimana[g] ? l : (sp.length ? [sp[j % sp.length]] : []); });
}
// gli sport a cui chiedere l'ora (la camminata no: non cambia i pasti)
const qzSportConOra = (R) => senzaSport(R) ? [] : (R.sport || []).filter(x => x !== QZ_NESSUNO && x !== "camminata");
function qzValido(q) {
  const v = qz.R[q.k];
  if (q.opz) return true;
  if (q.t === "n") { const n = parseFloat(String(v ?? "").replace(",", ".")); return n >= q.min && n <= q.max; }
  if (q.t === "t") return String(v || "").trim() !== "";
  if (q.t === "u") return !!v;
  if (q.k === "sport" && (qz.R.sportAltri || []).some(a => !a.f)) return false;   // uno sport scritto a mano senza la fatica: non si sa quanto consuma
  if (q.t === "m") return !q.req || (v || []).length > 0;
  if (q.t === "ora") return typeof v === "number";
  if (q.t === "durate") { qzDuratePronte(); return Object.values(qz.R.durate).every(v => v > 0); }
  if (q.t === "settimana") { qzSettimanaPronta(); return (qz.R.giorni || []).every(g => (qz.R.settimana[g] || []).length > 0); }
  if (q.t === "orari") { const s = ORDINE_TEMPO.filter(p => (qz.R.pasti || []).includes(p)).map(p => qz.R.orari[p]); return s.every(h => typeof h === "number") && s.every((h, i) => !i || h > s[i - 1]); }
  if (q.t === "nomeApp") return String(qz.R.nomeApp || "").trim() !== "";
  return true;
}
// proteine e grassi di partenza in base a quanto ti alleni: senza sport non servono le quantità da palestra
// camminata e yoga/pilates sono attività leggere: non servono le proteine di chi fa pesi o CrossFit
const QZ_SPORT_LEGGERI = ["camminata", "yoga"];
const qzLeggero = (R, s) => QZ_SPORT_LEGGERI.includes(s) || (R.sportAltri || []).some(a => a.x === s && a.f === "leggero");
function qzMacroKg(R) {
  const leggeri = !senzaSport(R) && R.sport.every(s => qzLeggero(R, s));
  // contano i giorni con un allenamento vero: una camminata breve non chiede più proteine
  const giorni = senzaSport(R) ? 0 : leggeri ? (R.giorni || []).length : (R.giorni || []).filter(g => { const l = R.settimana && R.settimana[g]; return !l || !l.length || l.some(s => !qzLeggero(R, s)); }).length;
  const protKg = giorni === 0 ? 1.3 : leggeri ? 1.4 : giorni <= 3 ? 1.6 : 1.8;   // tre allenamenti a settimana (o meno) non chiedono le proteine di chi si allena tutti i giorni
  const pk = R.obiettivo === "definire" && giorni > 0 ? Math.max(protKg, 2) : protKg;   // per definire servono più proteine, a tenere i muscoli
  // vegani: al massimo 1,6 g/kg. Con legumi e cereali di più non si arriva senza proteine in polvere a ogni pasto (e le ricette non ci starebbero)
  return { protKg: R.dieta === "vegana" ? Math.min(pk, 1.6) : pk, grassiKg: 0.8 };
}
// stima dei primi obiettivi con le risposte (stessa formula di tipoInfo, per un giorno di riposo)
function qzStima() {
  const R = qz.R, kg = parseFloat(String(R.peso).replace(",", "."));
  const bmr = basaleMifflin({ uomo: R.sesso === "uomo", eta: +R.eta, cm: +R.altezza, kg });
  const fatt = (QZ_LAVORO.find(x => x[2] === R.lavoro) || QZ_LAVORO[0])[3], def = (QZ_OBIETTIVI.find(x => x[2] === R.obiettivo) || QZ_OBIETTIVI[0])[3];
  const pf = qz.rifai ? leggiProfilo() : {};
  const mk = qzMacroKg(R), protKg = qz.rifai ? pf.protKg : mk.protKg, grassiKg = qz.rifai ? pf.grassiKg : mk.grassiKg, kgM = pesoRiferimento({ peso: kg, altezza: +R.altezza });
  const kcal = pf.kcalMan > 0 ? Math.max(bmr, pf.kcalMan) : Math.max(bmr, Math.round(bmr * fatt * (1 - def / 100) / 50) * 50);
  const proteine = pf.protMan > 0 ? Math.round(pf.protMan) : Math.round(kgM * protKg / 5) * 5, grassi = pf.grassiMan > 0 ? Math.round(pf.grassiMan) : Math.round(kgM * grassiKg);
  return { bmr, kcal, proteine, grassi, carboidrati: Math.max(50, Math.round((kcal - proteine * 4 - grassi * 9) / 20) * 5) };
}

function qzRender() {
  const box = document.getElementById("qz"); if (!box || !qz) return;
  if (qz.step >= QZ.length) qz.step = QZ.length - 1;
  const q = QZ[qz.step], R = qz.R, v = R[q.k];
  const conta = (x) => qzAttiva(x) && x.t !== "intro";   // la schermata di benvenuto non è una domanda
  const tot = QZ.filter(conta).length, fatti = QZ.slice(0, qz.step).filter(conta).length;
  const primo = qzProssimo(-1, 1);   // la prima schermata attiva: niente «indietro»
  let h = q.t === "intro" ? "" : `<div class="qz-top"><button class="qz-ind" data-qz-ind aria-label="Indietro" ${qz.step <= primo ? "hidden" : ""}>←</button>
    <div class="qz-bar"><i style="width:${Math.round(fatti / tot * 100)}%"></i></div></div>
    <h2 class="qz-q"><span>${q.e}</span>${esc(q.q)}</h2>`;
  if (q.t === "intro") {
    const nome = esc((R.nomeApp || "Sailor Fit").trim() || "Sailor Fit");
    h += `<div class="qz-intro">
      <img class="qz-intro-ico" src="apple-touch-icon.png" alt="">
      <h2 class="qz-intro-t">Ti diamo il benvenuto in ${nome}</h2>
      <p class="qz-intro-p">Qualche domanda veloce (circa 2 minuti) e calcoliamo calorie, proteine, carboidrati e grassi su misura per te.</p>
      <p class="qz-pic">Potrai cambiare tutto quando vuoi dal Profilo.</p>
    </div>`;
  } else if (q.t === "t" || q.t === "n") {
    h += `<div class="qz-u"><input class="qz-inp" id="qz-inp" ${q.t === "n" ? (q.dec ? `type="text" inputmode="decimal" autocomplete="off"` : `type="number" inputmode="numeric" step="1"`) : `type="text" autocomplete="given-name"`}
      placeholder="${esc(q.ph || "")}" value="${esc(v ?? "")}">${q.un ? `<b>${q.un}</b>` : ""}</div>`;
  } else if (q.t === "u" || q.t === "m") {
    const sel = q.t === "m" ? (v || []) : (v ? [v] : []);
    h += `<div class="qz-sc ${q.k === "giorni" ? "qz-giorni" : ""}">${q.o.map((o, i) => `<button class="qz-b ${sel.includes(o[2]) ? "on" : ""}" data-qz-o="${i}">${o[1] ? `<span class="qz-e">${o[1]}</span>` : ""}<span>${esc(o[0])}</span></button>`).join("")}</div>`;
    if (q.k === "sport") {   // sport scritti a mano: ognuno con quanto è faticoso
      h += (R.sportAltri || []).map(a => `<div class="qz-altro-sp"><div class="qz-altro-t"><b>🏅 ${esc(a.nome)}</b><button class="qz-togli" data-qz-sp-togli="${esc(a.x)}" aria-label="Togli ${esc(a.nome)}">✕</button></div>
        <p class="qz-pic">Quanto è faticoso?</p><div class="qz-fatica">${QZ_FATICA.map(([k, l, e]) => `<button class="qz-b qz-mini ${a.f === k ? "on" : ""}" data-qz-fatica="${esc(a.x)}|${k}"><span class="qz-e">${e}</span><span>${l}</span></button>`).join("")}</div>
        <p class="qz-pic">${QZ_FATICA.map(([, l, , , come]) => `${l} ${come}`).join(" · ")}</p></div>`).join("");
      h += `<div class="qz-altro-riga"><input class="qz-inp" id="qz-sp-nuovo" type="text" maxlength="30" autocomplete="off" placeholder="Altro sport (es. arrampicata)"><button class="btn lib-piu" data-qz-sp-aggiungi aria-label="Aggiungi lo sport">＋</button></div>`;
      if ((R.sportAltri || []).some(a => !a.f)) h += `<p class="qz-pic qz-err">Scegli quanto è faticoso ogni sport che hai scritto.</p>`;
    }
    if (q.altro) h += `<input class="qz-inp qz-altro" id="qz-altro" type="text" placeholder="${esc(q.altroPh || "Altro")}" value="${esc(R[q.altro] || "")}">`;
    if (q.t === "m") h += `<p class="qz-pic">Puoi sceglierne più di uno</p>`;
  } else if (q.t === "ora") {   // una sola scelta per tutti gli sport (prima, con più sport, una riga per sport: pagina troppo piena); quella di ogni sport si cambia in I miei dati → Sport
    const f = qzFasciaDi(v);
    h += `<p class="qz-perche">${esc(q.nota)}</p><div class="qz-sc">${QZ_ORA_ALLEN.map(([l, e, q, h0]) => `<button class="qz-b ${f === h0 ? "on" : ""}" data-qz-fascia="${h0}"><span class="qz-e">${e}</span><span>${l}<small class="qz-sub">${q}</small></span></button>`).join("")}</div>`;
  } else if (q.t === "durate") {
    qzDuratePronte();
    h += `<div class="qz-orari">${(R.sport || []).filter(x => x !== QZ_NESSUNO).map(x => { const o = qzSportInfo(x), km = x === "corsa";
      return `<label class="qz-ora"><span>${o[1]} ${esc(o[0])}</span><span class="qz-dur"><input type="text" inputmode="decimal" autocomplete="off" data-qz-durata="${x}" value="${String(R.durate[x]).replace(".", ",")}"><b>${km ? "km" : "min"}</b></span></label>`; }).join("")}</div>`;
  } else if (q.t === "settimana") {
    qzSettimanaPronta();
    const sp = (R.sport || []).filter(x => x !== QZ_NESSUNO).map(qzSportInfo);
    h += `<div class="qz-sett">${(R.giorni || []).slice().sort((a, b) => a - b).map(g => `<div class="qz-sett-r"><b>${QZ_GIORNI[g][0]}</b><div class="qz-sett-s">${sp.map(([l, e, x]) => `<button class="qz-b qz-mini ${(R.settimana[g] || []).includes(x) ? "on" : ""}" data-qz-sett="${g}|${x}"><span class="qz-e">${e}</span><span>${esc(l)}</span></button>`).join("")}</div></div>`).join("")}</div>`;
    if (!qzValido(q)) h += `<p class="qz-pic qz-err">Scegli almeno uno sport per ogni giorno.</p>`;
  } else if (q.t === "orari") {
    const scelti = QZ_PASTI.concat([[String(R.pastoAltro || "").trim() || "Dopo cena", "🌛", "sera"]]).filter(p => (R.pasti || []).includes(p[2]));
    h += `<div class="qz-orari">${scelti.map(([l, e, k]) => `<label class="qz-ora"><span>${e} ${l}</span><input type="time" step="900" data-qz-ora="${k}" value="${fmtOra(R.orari[k]).padStart(5, "0")}"></label>`).join("")}</div>`;
    if (!qzValido(q)) h += `<p class="qz-pic qz-err">Gli orari devono essere in ordine, dal primo all'ultimo pasto.</p>`;
  } else if (q.t === "colore") {
    h += `<div class="qz-colori">${(window.COLORI_APP || []).map(([k, l, c, , , cc]) => `<button class="qz-col ${R.colore === k ? "on" : ""}" data-qz-colore="${k}" style="--c:${document.documentElement.getAttribute("data-tema") === "chiaro" ? cc : c}"><i></i><span>${l}</span></button>`).join("")}</div>`;
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
  if (q.nota && q.t !== "ora") h += `<p class="qz-pic">${esc(q.nota)}</p>`;
  if (q.t === "intro") h += `<button class="btn-link qz-backup" data-azione="ripristina">Hai già usato l'app? Ripristina un backup ›</button>`;
  const ultimo = q.t === "riepilogo";
  h += `<div class="qz-foot"><button class="btn block" id="qz-avanti" ${qzValido(q) ? "" : "disabled"}>${ultimo ? "✓ Inizia" : q.t === "intro" ? "Iniziamo →" : q.opz && !v && !(q.altro && String(R[q.altro] || "").trim()) ? "Salta →" : "Avanti →"}</button></div>`;
  box.innerHTML = h;
  const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = 0;
  if (sh) sh.classList.toggle("qz-sheet-intro", q.t === "intro");
  const inp = document.getElementById("qz-inp"); if (inp && !v) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 150);
}
function qzAggiornaBtn() {
  const q = QZ[qz.step], b = document.getElementById("qz-avanti"); if (!b) return;
  b.disabled = !qzValido(q);
  if (q.t !== "riepilogo" && q.t !== "intro") b.textContent = q.opz && !qz.R[q.k] && !(q.altro && String(qz.R[q.altro] || "").trim()) ? "Salta →" : "Avanti →";
}

document.addEventListener("input", (e) => {
  if (!qz || !e.target.closest || !e.target.closest("#qz")) return;
  const q = QZ[qz.step];
  if (e.target.id === "qz-inp") { qz.R[q.k] = e.target.value; qzSalva(); qzAggiornaBtn(); }
  if (e.target.id === "qz-altro") {
    qz.R[q.altro] = e.target.value;
    if (q.k === "pasti") {   // il pasto dopo cena c'è finché ha un nome
      const p = (qz.R.pasti || []).filter(x => x !== "sera"); if (e.target.value.trim()) p.push("sera"); qz.R.pasti = p;
      if (typeof qz.R.orari.sera !== "number") qz.R.orari.sera = ORARI_DEFAULT.sera;
    }
    // scrivendo un'allergia o un cibo, «Nessuna» / «Niente» non ha più senso: si toglie (senza ridisegnare, così la tastiera resta aperta)
    if (q.excl && e.target.value.trim() && (qz.R[q.k] || []).includes(q.excl)) {
      qz.R[q.k] = qz.R[q.k].filter(x => x !== q.excl);
      const i = q.o.findIndex(o => o[2] === q.excl), b = document.querySelector(`[data-qz-o="${i}"]`); if (b) b.classList.remove("on");
    }
    qzSalva(); qzAggiornaBtn(); return;
  }
  if (e.target.id === "qz-nome-app") { qz.R.nomeApp = e.target.value; const a = document.querySelector(".qz-anteprima"); if (a) a.textContent = `${qz.R.iconaApp} ${qz.R.nomeApp || "Sailor Fit"}`; qzSalva(); qzAggiornaBtn(); }
});
document.addEventListener("input", (e) => {   // quanto dura di solito uno sport
  if (!qz || !e.target.matches || !e.target.matches("[data-qz-durata]")) return;
  const v = parseFloat(String(e.target.value).replace(",", "."));
  qz.R.durate = qz.R.durate || {}; qz.R.durate[e.target.dataset.qzDurata] = v > 0 ? v : 0;
  qzSalva(); qzAggiornaBtn();
});
document.addEventListener("change", (e) => {   // l'ora di uno sport (questionario con più sport)
  if (!qz || !e.target.matches || !e.target.matches("[data-qz-orasport]")) return;
  const h = oraDa(e.target.value), os = qz.R.oreSport = qz.R.oreSport || {};
  if (h === null) delete os[e.target.dataset.qzOrasport]; else os[e.target.dataset.qzOrasport] = h;
  const tutte = Object.values(os); if (tutte.length) qz.R.oraAllen = Math.min(...tutte);   // l'orario «abituale» di riserva: il primo della giornata
  qzSalva(); qzAggiornaBtn();
});
document.addEventListener("change", (e) => {   // orario di allenamento scritto a mano
  if (!qz || !e.target.matches || !e.target.matches("[data-qz-oraallen]")) return;
  const h = oraDa(e.target.value); if (h === null) delete qz.R.oraAllen; else qz.R.oraAllen = h;
  qzSalva(); qzRender();
});
document.addEventListener("change", (e) => {
  if (!qz || !e.target.matches || !e.target.matches("[data-qz-ora]")) return;
  const h = oraDa(e.target.value); if (h !== null) qz.R.orari[e.target.dataset.qzOra] = h;
  qzSalva(); qzRender();
});
// iPhone: quando si apre la tastiera la pagina scorre verso l'alto e la domanda spariva. Nelle domande con un solo campo (nome, età, altezza, peso)
// il pannello torna in cima: domanda e campo restano visibili sopra la tastiera, con «Avanti» subito sotto
document.addEventListener("focusin", (e) => {
  if (!qz || e.target.id !== "qz-inp") return;
  [80, 320, 650].forEach(t => setTimeout(() => { const sh = document.querySelector("#modal .modal-sheet"); if (sh && document.activeElement === e.target) sh.scrollTop = 0; }, t));
});
document.addEventListener("keydown", (e) => {
  if (qz && e.key === "Enter" && e.target.id === "qz-inp") { e.preventDefault(); qzAvanti(); }
  if (qz && e.key === "Enter" && e.target.id === "qz-sp-nuovo") { e.preventDefault(); qzAggiungiSport(); }
});
document.addEventListener("click", (e) => {
  if (!qz || !e.target.closest || !e.target.closest("#qz")) return;
  const q = QZ[qz.step];
  if (e.target.closest("[data-qz-ind]")) { const i = qzProssimo(qz.step, -1); if (i >= 0 && QZ[i].t !== "intro") { qz.step = i; qzSalva(); qzRender(); } return; }
  if (e.target.closest("#qz-avanti")) { qzAvanti(); return; }
  const ob = e.target.closest("[data-qz-o]");
  if (ob) {
    const val = q.o[+ob.dataset.qzO][2];
    if (q.t === "u") { if (qz.R[q.k] === val) delete qz.R[q.k]; else qz.R[q.k] = val; }   // un secondo tocco toglie la scelta
    else {
      let cur = (qz.R[q.k] || []).slice(); const p = cur.indexOf(val);
      if (q.excl && val === q.excl) cur = p > -1 ? [] : [val];
      else { cur = cur.filter(x => x !== q.excl); if (p > -1) cur.splice(cur.indexOf(val), 1); else cur.push(val); }
      qz.R[q.k] = cur;
    }
    qzSalva(); qzRender(); return;
  }
  if (e.target.closest("[data-qz-sp-aggiungi]")) { qzAggiungiSport(); return; }
  const spT = e.target.closest("[data-qz-sp-togli]");
  if (spT) { const x = spT.dataset.qzSpTogli; qz.R.sportAltri = (qz.R.sportAltri || []).filter(a => a.x !== x); qz.R.sport = (qz.R.sport || []).filter(s => s !== x); qzSalva(); qzRender(); return; }
  const fat = e.target.closest("[data-qz-fatica]");
  if (fat) { const [x, k] = fat.dataset.qzFatica.split("|"), a = (qz.R.sportAltri || []).find(s => s.x === x); if (a) a.f = k; qzSalva(); qzRender(); return; }
  const st = e.target.closest("[data-qz-sett]");   // un giorno della settimana: tocca gli sport che fai (anche due)
  if (st) { const [g, x] = st.dataset.qzSett.split("|"), l = qz.R.settimana[g] || [], i = l.indexOf(x); if (i > -1) l.splice(i, 1); else l.push(x); qz.R.settimana[g] = l; qzSalva(); qzRender(); return; }
  const fs = e.target.closest("[data-qz-fasciasport]");   // il momento di uno sport (più sport)
  if (fs) { const [x, h0] = fs.dataset.qzFasciasport.split("|"), os = qz.R.oreSport = qz.R.oreSport || {}; os[x] = +h0; qz.R.oraAllen = Math.min(...Object.values(os)); qzSalva(); qzRender(); return; }
  const fa = e.target.closest("[data-qz-fascia]");   // fascia oraria: compila l'ora con un tocco
  if (fa) { qz.R.oraAllen = +fa.dataset.qzFascia; qzSalva(); qzRender(); return; }
  const col = e.target.closest("[data-qz-colore]");
  if (col) { qz.R.colore = col.dataset.qzColore; if (window.applicaColore) window.applicaColore(qz.R.colore); qzSalva(); qzRender(); return; }   // il colore si vede subito
  const ic = e.target.closest("[data-qz-icona]");
  if (ic) { qz.R.iconaApp = ic.dataset.qzIcona; qzSalva(); qzRender(); return; }
});
// «Altro sport»: diventa uno sport scelto (se è già nella lista, si sceglie quello)
function qzAggiungiSport() {
  const inp = document.getElementById("qz-sp-nuovo"), nome = String((inp && inp.value) || "").trim().replace(/^./, c => c.toUpperCase());
  if (normCibo(nome).length < 3) { avviso("Scrivi il nome dello sport"); return; }
  const R = qz.R, gia = QZ_SPORT.find(o => normCibo(o[0]) === normCibo(nome)) || (R.sportAltri || []).find(a => normCibo(a.nome) === normCibo(nome));
  const x = gia ? (gia.x || gia[2]) : "a:" + slug(nome);
  if (!gia) (R.sportAltri = R.sportAltri || []).push({ x, nome, f: "" });
  R.sport = (R.sport || []).filter(s => s !== QZ_NESSUNO); if (!R.sport.includes(x)) R.sport.push(x);
  qzSalva(); qzRender();
  const sh = document.querySelector(".modal-sheet"); if (sh) sh.scrollTop = sh.scrollHeight;   // si vede subito la domanda sulla fatica
}
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
    pasti: ORDINE_TEMPO.filter(p => (R.pasti || []).includes(p) && (p !== "sera" || String(R.pastoAltro || "").trim())),
    nomeSera: String(R.pastoAltro || "").trim(),
    orari: Object.fromEntries(ORDINE_TEMPO.map(p => [p, typeof R.orari[p] === "number" ? R.orari[p] : ORARI_DEFAULT[p]])),
    esclusioni: { allergie: (R.allergie || []).filter(x => x !== QZ_NESSUNO), nonMangio: (R.nonMangio || []).filter(x => x !== QZ_NESSUNO),
      altri: String(R.nonMangioAltri || "").split(/[,;\n]/).map(x => x.trim()).filter(x => normCibo(x).length >= 3),
      allergieAltre: String(R.allergieAltri || "").split(/[,;\n]/).map(x => x.trim()).filter(x => normCibo(x).length >= 3) },
    colore: R.colore || "lilla", iconaApp: R.iconaApp || "🌙", nomeApp: String(R.nomeApp || "").trim() || "Sailor Fit",
    obiettivo: R.obiettivo || "dimagrire",
  });
  if (R.dieta) pf.esclusioni.dieta = R.dieta;
  else if (R.piattiVeg === "no") pf.esclusioni.senzaVeg = true;   // niente tofu, seitan, bevande vegetali… (chi è vegetariano o vegano li vuole)
  // alimentazione scritta a mano («senza zucchero», «niente pane»): il cibo va tra quelli che non mangi; i nomi di diete (chetogenica…) no, non sono cibi
  String(R.dietaAltri || "").split(/[,;\n]|\be\b/).map(x => x.trim().replace(/^(senza|niente|no|zero|poco|poca|pochi|poche)\s+/i, "").trim())
    .filter(x => normCibo(x).length >= 3 && !QZ_DIETE_NOTE.test(normCibo(x)))
    .forEach(x => { if (!pf.esclusioni.altri.some(w => normCibo(w) === normCibo(x))) pf.esclusioni.altri.push(x); });
  if (/pescetar/.test(normCibo(R.dietaAltri))) ["carneRossa", "pollame", "maiale"].forEach(c => { if (!pf.esclusioni.nonMangio.includes(c)) pf.esclusioni.nonMangio.push(c); });   // pescetariana: niente carne, il pesce sì
  ["altri", "allergieAltre", "allergie", "nonMangio"].forEach(k => { if (!pf.esclusioni[k].length) delete pf.esclusioni[k]; });
  if (!senzaSport(R) && typeof R.oraAllen === "number") { pf.allenOra = R.oraAllen; delete pf.allenOrario; }
  if (!pf.nome) delete pf.nome;
  if (!pf.nomeSera) delete pf.nomeSera;
  if (nuovo) Object.assign(pf, qzMacroKg(R), { recupero: 80 });   // chi rifà il questionario tiene i suoi macro
  // sport: quelli scelti si vedono (anche se erano stati tolti), quelli nuovi si aggiungono; per una persona nuova gli altri si nascondono
  const scelti = senzaSport(R) ? [] : R.sport.filter(x => x !== QZ_NESSUNO);
  const idDi = {};
  const ids = scelti.map(s => {
    const id = (() => {
    if (QZ_SPORT_NUOVI[s]) {
      const [nome, icona, kMin] = QZ_SPORT_NUOVI[s];
      let sp = pf.sport.find(x => x.nome.toLowerCase() === nome.toLowerCase());
      if (!sp) { sp = { id: slug(nome), nome, icona, kMin, min: 60 }; pf.sport.push(sp); }
      delete sp.nascosto; return sp.id;
    }
    const altro = (R.sportAltri || []).find(a => a.x === s);
    if (altro) {   // scritto a mano: quello del Profilo con lo stesso nome, o uno nuovo con la fatica scelta
      const kMin = (QZ_FATICA.find(f => f[0] === altro.f) || QZ_FATICA[1])[3];
      let sp = pf.sport.find(x => x.id === s.slice(2)) || pf.sport.find(x => x.nome.toLowerCase() === altro.nome.toLowerCase());
      if (!sp) { let id = slug(altro.nome) || "sport"; while (pf.sport.some(x => x.id === id)) id += "2"; sp = { id, nome: altro.nome, icona: "🏅", kMin, min: 60 }; pf.sport.push(sp); }
      else if (qzFaticaDi(sp.kMin || 0.075) !== altro.f) sp.kMin = kMin;   // cambiata la fatica: si aggiorna (altrimenti resta il valore preciso di prima)
      delete sp.nascosto; return sp.id;
    }
    const sp = pf.sport.find(x => x.id === s);
    if (sp) { delete sp.nascosto; return sp.id; }
    const def = SPORT_DEFAULT.find(x => x.id === s); if (def) { pf.sport.push(Object.assign({}, def)); return def.id; }
    return null;
    })();
    if (id) idDi[s] = id;   // sport del questionario → sport dell'app
    return id;
  }).filter(Boolean);
  if (nuovo) pf.sport.forEach(sp => { if (!ids.includes(sp.id)) sp.nascosto = true; });
  // quanto dura di solito ogni sport (la corsa in km)
  const dur = Object.assign({}, R.durate || {}); if (R.kmCorsa && !dur.corsa) dur.corsa = parseFloat(String(R.kmCorsa).replace(",", "."));
  Object.entries(dur).forEach(([x, v]) => { const sp = pf.sport.find(y => y.id === idDi[x]); if (!sp || !(v > 0)) return;
    if (sp.perKm) { sp.km = Math.round(v * 10) / 10; sp.ultimo = sp.km; } else { sp.min = Math.round(v); sp.ultimo = sp.min; } });
  // l'ora di ogni sport non si chiede più nel questionario (si cambia in I miei dati → Sport): quelle già scelte restano
  salvaProfilo(pf);
  // settimana tipo: gli sport scelti a turno nei giorni di allenamento
  const giorni = senzaSport(R) ? [] : (R.giorni || []).slice().sort((a, b) => a - b);
  const tipi = Array(7).fill("riposo"); giorni.forEach((g, j) => { if (ids.length) tipi[g] = ids[j % ids.length]; });
  if (R.settimana && ids.length > 1) giorni.forEach(g => { const l = (R.settimana[g] || []).map(s => idDi[s]).filter(Boolean); if (l.length) tipi[g] = chiaveTipo(l); });   // anche due sport nello stesso giorno
  salvaTipi(tipi);
  // il peso di oggi entra anche tra le pesate (se oggi non ce n'è già una)
  const pesi = leggiPesi(); if (kg > 0 && !pesi.some(p => p.data === oggiISO())) { pesi.push({ data: oggiISO(), kg }); salvaPesi(pesi); }
  localStorage.setItem("mp_benvenuto", "fatto");
  try { sessionStorage.removeItem(QZ_CHIAVE); } catch (e) {}
  qz = null;
  // anche «qz-primo» (questionario a schermo intero): prima restava sul body e la barra in basso spariva finché non riaprivi l'app
  document.getElementById("modal").classList.remove("modal-qz", "qz-primo"); document.body.classList.remove("qz-primo", "qz-aperto");
  closeModal();
  applicaPersonalizzazione();
  if (typeof renderOggi === "function") renderOggi();
  avviso(nuovo ? "Tutto pronto! 🎉" : "Profilo aggiornato");
}
// chiudendo il questionario a metà: le risposte restano per quando lo riapri; il colore torna quello salvato
{ const m = document.getElementById("modal");
  if (m) new MutationObserver(() => {
    if (!m.hidden) return;
    if (m.classList.contains("modal-qz")) { m.classList.remove("modal-qz", "qz-primo"); document.body.classList.remove("qz-primo", "qz-aperto"); qz = null; applicaPersonalizzazione(); }
    // persona nuova che non ha ancora finito (es. ha annullato il ripristino del backup): il questionario torna, dal punto in cui era
    if (localStorage.getItem("mp_benvenuto") === "da fare") setTimeout(() => { if (m.hidden && localStorage.getItem("mp_benvenuto") === "da fare") apriBenvenuto(); }, 60);
  }).observe(m, { attributes: true, attributeFilter: ["hidden"] }); }
