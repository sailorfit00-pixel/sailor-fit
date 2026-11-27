// =============================================================
//  Comandi a voce per il Profilo (e per spostarsi nell'app)
//  Ogni comando mostra prima cosa cambia («prima → dopo»): si salva solo con «Salva».
//  Le frasi arrivano da inviaDettato (libero.js), dopo domande, peso e calorie dei giorni.
// =============================================================

// abitudini: «di solito», «ogni», «sempre»… (per distinguere la settimana tipo da un giorno preciso)
const VP_ABITUALE = /\b(?:di solito|solitamente|abitualmente|normalmente|in genere|generalmente|sempre|ogni settimana|settimana tipo|tutti i|tutte le|ogni|d'ora in poi|da ora in poi|da adesso)\b/;
const vpNum = (x) => parseFloat(String(x).replace(",", "."));
const vpMaiusc = (s) => String(s || "").trim().replace(/^./, c => c.toUpperCase());
const vpFmtOra = (h) => typeof fmtOra === "function" ? fmtOra(h) : `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const vpPulisci = (s) => String(s || "").replace(/[.,!?;]+$/g, "").trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle|di|al|allo|alla|ai|agli|alle|ad|a)\s+|l'|un'|dell'|all')+/, "").trim();
const vpVoci = (s) => String(s || "").split(/,|\s(?:e|ed|o|oppure|né|ne)\s/).map(vpPulisci).filter(x => x.length >= 2);

// La scheda di conferma: titolo, righe [etichetta, prima, dopo], poi «Salva». Dopo il salvataggio si aggiornano obiettivi, colori, Oggi
// (e il Profilo, se era aperto quando hai parlato)
function vpConferma(titolo, righe, applica, opz = {}) {
  if (righe.length && righe.every(([, a, b]) => a !== undefined && a !== null && a !== "" && String(a) === String(b))) { avviso("È già così"); return true; }
  const eraProfilo = !!document.getElementById("form-profilo");
  editCtx = null; liberoCtx = null;
  const v = (x) => x === undefined || x === null || x === "" ? "" : String(x);
  openModal(`<h3 class="modal-title">${titolo}</h3>
    <div class="voce-cambi">${righe.map(([l, a, b]) => `<div class="voce-cambio"><span>${esc(l)}</span><b>${v(a) && v(a) !== v(b) ? `<s>${esc(v(a))}</s> → ` : ""}${esc(v(b))}</b></div>`).join("")}</div>
    ${opz.nota ? `<p class="hint">${opz.nota}</p>` : ""}
    <div class="lib-detta"><div class="barra-due"><button class="btn-sec" data-chiudi>Annulla</button><button class="btn" id="voce-pf-ok">${esc(opz.ok || "Salva")}</button></div></div>`);
  document.getElementById("voce-pf-ok").addEventListener("click", () => {
    applica();
    if (typeof calcolaTarget === "function") calcolaTarget();
    try { _profiloPrima = null; } catch (e) {}   // il Profilo aperto prima riparte da qui (niente «modifiche non salvate» finte)
    if (typeof applicaPersonalizzazione === "function") applicaPersonalizzazione();
    closeModal(true);
    if (eraProfilo && typeof apriProfilo === "function") apriProfilo();
    if (typeof renderOggi === "function") renderOggi();
    if (opz.riadatta !== false && typeof riadattaDopo === "function") riadattaDopo(typeof dataDiario !== "undefined" ? dataDiario : oggiISO());
    avviso(opz.fatto || "✓ Profilo aggiornato");
  });
  return true;
}
// modifica del profilo in una funzione: si legge, si cambia, si salva
const vpSalvaProfilo = (f) => () => { const pf = leggiProfilo(); f(pf); salvaProfilo(pf); };

// ---------- 1) Rifare il questionario ----------
function vpQuestionario(t) {
  if (!/\b(?:rifai|rifare|ripeti|ricomincia|rifacciamo|rifammi)\b.*\bquestionario\b|\bquestionario\b.*\bdi nuovo\b/.test(t)) return false;
  closeModal(true); setTimeout(() => apriQuestionario(true), 0); return true;
}

// ---------- 2) Spostarsi nell'app: «apri la lista della spesa», «vai al profilo», «apri il pranzo» ----------
function vpNaviga(t) {
  const m = t.match(/^\s*(?:apri|aprimi|mostra|mostrami|fammi vedere|vai|andiamo|portami|torna)\s+(?:(?:a|al|alla|alle|allo|agli|ai|in|nel|nella|nelle|sul|sulla|su)\s+)?(?:(?:il|la|lo|le|i|gli|l'|mio|mia|miei|mie)\s+)*(.+?)\s*$/);
  if (!m) return false;
  const x = m[1].replace(/[.!?]/g, "").trim(), tab = (id) => { closeModal(true); const b = document.getElementById(id); if (b) b.click(); };
  const dest = [
    [/^(?:profilo|impostazioni|dati|miei dati)$/, () => { closeModal(true); apriProfilo("io"); }],
    [/^(?:lista(?: della spesa)?|spesa)$/, () => { closeModal(true); apriSpesa(); }],
    [/^(?:ricette|ricettario|tutte le ricette)$/, () => { closeModal(true); apriListaRicette(); }],
    [/^(?:andamento|statistiche|grafici|progressi|pesate|peso)$/, () => tab("apri-andamento")],
    [/^(?:settimana|questa settimana|piano)$/, () => tab("tab-settimana")],
    [/^(?:oggi|home|diario|inizio)$/, () => { if (typeof vaiA === "function") { closeModal(true); vaiA("oggi"); segnaTab("oggi"); } else tab("tab-oggi"); }],
    [/^(?:backup|salvataggio|copia di sicurezza)$/, () => { closeModal(true); apriBackup(); }],
    [/^(?:alimenti|i miei alimenti|miei alimenti)$/, () => { closeModal(true); apriMieiAlimenti(); }],
    [/^(?:comandi(?: vocali)?|aiuto|guida)$/, () => { closeModal(true); apriComandiVocali(); }],
    [/^(?:altro|menu|menù)$/, () => { closeModal(true); apriMenu(); segnaTab("altro"); }],
    [/^(?:settimana prossima|la settimana prossima|prossima settimana)$/, () => { closeModal(true); vaiA("settimana-prossima"); segnaTab("settimana"); }],
  ];
  for (const [re, f] of dest) if (re.test(x)) { f(); return true; }
  // un giorno («vai a domani», «apri ieri») o un pasto («apri il pranzo», «apri la cena di domani»)
  const g = giorniNellaFrase(" " + x + " "), data = g.length ? dataDelGiorno(g[0], 1) : dataDetta(), p = pastiNellaFrase(" " + x + " ", data);
  if (p.length) { closeModal(true); vaiAlGiornoDetta(data); apriPastoDiario(data, null, p[0].p); return true; }
  if (g.length && x.replace(/\b(?:di|del|giorno)\b/g, "").trim().split(/\s+/).length <= 2) { closeModal(true); vaiAlGiornoDetta(data); return true; }
  return false;
}

// ---------- 3) Obiettivo della settimana: «obiettivo della settimana 12000 calorie», «… sempre» ----------
function vpBudgetSettimana(t) {
  if (!/\bsettiman/.test(t) || !/\b(?:calorie|kcal|obiettivo|budget)\b/.test(t)) return false;
  const lunOggi = addGiorniISO(oggiISO(), -indiceSettimana(oggiISO()));
  const lun = /\bprossima\b/.test(t) ? addGiorniISO(lunOggi, 7) : (document.body.dataset.tab === "settimana" && typeof offsetSettHome !== "undefined" ? addGiorniISO(lunOggi, offsetSettHome * 7) : lunOggi);
  const prima = pianoSettimana(lun).budget;
  if (/\b(?:togli|azzera|cancella|elimina|automatico|come prima)\b/.test(t)) {
    return vpConferma("🔥 Obiettivo della settimana", [["Settimana", `${kIt(prima)} kcal`, "calcolato dall'app"]], () => { const b = leggiBudgetSett(); delete b.settimane[lun]; delete b.aggiunte[lun]; if (b.sempre && b.sempre.da <= lun) b.sempre = null; salvaBudgetSett(b); }, { fatto: "✓ Obiettivo della settimana automatico" });
  }
  const m = t.match(/\b(\d{1,2}[.\s]?\d{3})\b/); if (!m) return false;
  const v = parseInt(m[1].replace(/[.\s]/g, ""), 10); if (!(v >= 5000 && v <= 40000)) return false;
  const sempre = /\b(?:sempre|tutte le settimane|ogni settimana|d'ora in poi|da ora|da adesso)\b/.test(t);
  return vpConferma("🔥 Obiettivo della settimana", [[sempre ? "Ogni settimana, da questa" : `Settimana dal ${fmtData(lun)}`, `${kIt(prima)} kcal`, `${kIt(v)} kcal`], ["In media al giorno", "", `≈ ${kIt(v / 7)} kcal`]],
    () => { const b = leggiBudgetSett(); if (sempre) b.sempre = { kcal: v, da: lun }; else b.settimane[lun] = v; delete b.aggiunte[lun]; salvaBudgetSett(b); },
    { nota: "I giorni si dividono il totale in proporzione (allenamento più di riposo), mai sotto il metabolismo basale.", fatto: `✓ Settimana a ${kIt(v)} kcal` });
}

// ---------- 4) Personalizza: colore, tema, nome dell'app, il tuo nome, icona, vibrazione ----------
const VP_COLORI = { lilla: "lilla", viola: "lilla", rosa: "rosa", pesca: "pesca", arancione: "pesca", arancio: "pesca", corallo: "corallo", rosso: "corallo", giallo: "giallo", menta: "menta", verde: "menta", turchese: "turchese", azzurro: "azzurro", blu: "azzurro", celeste: "azzurro" };
const VP_ICONE = { luna: "🌙", barca: "⛵", veliero: "⛵", vela: "⛵", fiore: "🌸", fuoco: "🔥", fiamma: "🔥", stella: "⭐", foglia: "🌿", fragola: "🍓", muscoli: "💪", bicipite: "💪", farfalla: "🦋", onda: "🌊", mare: "🌊", sole: "☀️", quadrifoglio: "🍀" };
function vpPersonalizza(t) {
  const pf = leggiProfilo(); let m;
  if ((m = t.match(/\b(?:colore|colora|tinta|colori)\b.*?\b(lilla|viola|rosa|pesca|arancione|arancio|corallo|rosso|giallo|menta|verde|turchese|azzurro|blu|celeste)\b/))) {
    const k = VP_COLORI[m[1]], nome = (window.COLORI_APP.find(c => c[0] === k) || [])[1] || k, primaN = (window.COLORI_APP.find(c => c[0] === (pf.colore || "lilla")) || [])[1];
    return vpConferma("🎨 Colore dell'app", [["Colore", primaN, nome]], vpSalvaProfilo(p => { p.colore = k; }), { riadatta: false, fatto: `✓ Colore ${nome.toLowerCase()}` });
  }
  if ((m = t.match(/\b(?:tema|modalità|sfondo|aspetto)\s+(chiar[oa]|scur[oa]|bianc[oa]|ner[oa]|light|dark)\b/))) {
    const chiaro = /^(?:chiar|bianc|light)/.test(m[1]);
    return vpConferma("🌗 Tema", [["Tema", pf.tema === "chiaro" ? "Chiaro" : "Scuro", chiaro ? "Chiaro" : "Scuro"]], vpSalvaProfilo(p => { if (chiaro) p.tema = "chiaro"; else delete p.tema; }), { riadatta: false });
  }
  if ((m = t.match(/\b(?:chiama|rinomina|chiamare)\s+(?:l'app|l'applicazione|la app|l'app in)\s+(.+?)\s*$|\bnome dell'app(?:licazione)?\s+(?:in\s+|è\s+)?(.+?)\s*$/))) {
    const mo = vpOrig.match(/\b(?:chiama|rinomina|chiamare)\s+(?:l['’]app|l['’]applicazione|la app|l['’]app in)\s+(.+?)\s*$|\bnome dell['’]app(?:licazione)?\s+(?:in\s+|è\s+)?(.+?)\s*$/i) || m;   // con le maiuscole come le hai dette
    const n = vpMaiusc((mo[1] || mo[2]).replace(/[.!?]/g, "")).slice(0, 24); if (n.length < 2) return false;
    return vpConferma("✏️ Nome dell'app", [["Nome", pf.nomeApp || "Sailor Fit", n]], vpSalvaProfilo(p => { p.nomeApp = n; }), { riadatta: false, nota: "Il nome sotto l'icona nella schermata Home lo decide il telefono quando aggiungi l'app." });
  }
  if ((m = t.match(/\b(?:chiamami|mi chiamo|il mio nome è|chiamatemi)\s+([a-zà-ù' ]{2,24}?)\s*$/))) {
    const n = m[1].trim().split(/\s+/).map(vpMaiusc).join(" ");
    return vpConferma("👋 Il tuo nome", [["Nome", pf.nome || "—", n]], vpSalvaProfilo(p => { p.nome = n; }), { riadatta: false, fatto: `✓ Ciao ${n}!` });
  }
  if ((m = t.match(/\bicona\s+(?:dell'app\s+|dell'applicazione\s+)?(?:a forma di\s+|con (?:la|il|lo|una|un)\s+)?(luna|barca|veliero|vela|fiore|fuoco|fiamma|stella|foglia|fragola|muscoli|bicipite|farfalla|onda|mare|sole|quadrifoglio)\b/))) {
    const ic = VP_ICONE[m[1]];
    return vpConferma("✨ Icona dell'app", [["Icona", pf.iconaApp || "🌙", ic]], vpSalvaProfilo(p => { p.iconaApp = ic; }), { riadatta: false });
  }
  if (/\b(?:togli|disattiva|spegni|niente|senza|elimina|blocca)\s+(?:la\s+)?vibrazion|\bvibrazione\s+(?:off|no|spenta)\b|\bnon (?:vibrare|voglio la vibrazione)\b/.test(t))
    return vpConferma("🔕 Vibrazione", [["Vibrazione", pf.vibrazione === false ? "No" : "Sì", "No"]], vpSalvaProfilo(p => { p.vibrazione = false; }), { riadatta: false });
  if (/\b(?:attiva|accendi|rimetti|metti|riattiva)\s+(?:la\s+)?vibrazion|\bvibrazione\s+(?:on|sì|si|accesa)\b/.test(t))
    return vpConferma("📳 Vibrazione", [["Vibrazione", pf.vibrazione === false ? "No" : "Sì", "Sì"]], vpSalvaProfilo(p => { delete p.vibrazione; }), { riadatta: false });
  return false;
}

// ---------- 5) I tuoi dati: età, altezza, sesso ----------
function vpDati(t) {
  const pf = leggiProfilo(); let m;
  if ((m = t.match(/\bho\s+(\d{2})\s+anni\b|\bla mia età è\s+(\d{2})\b/))) {
    const v = +(m[1] || m[2]); if (v < 10 || v > 100) return false;
    return vpConferma("🎂 Età", [["Età", pf.eta ? `${pf.eta} anni` : "", `${v} anni`]], vpSalvaProfilo(p => { p.eta = v; }), { nota: pf.bmrAuto ? "Il metabolismo basale si ricalcola da solo." : "" });
  }
  if ((m = t.match(/\bsono alt[oa]\s+(?:(1)[.,](\d{2})|(\d{3})|un metro e\s+(\d{1,2}))|\bla mia altezza è\s+(?:(1)[.,](\d{2})|(\d{3}))|\baltezza\s+(\d{3})\b/))) {
    const v = m[1] ? 100 + +m[2] : m[3] ? +m[3] : m[4] ? 100 + +m[4] : m[5] ? 100 + +m[6] : m[7] ? +m[7] : +m[8]; if (v < 100 || v > 230) return false;
    return vpConferma("📏 Altezza", [["Altezza", pf.altezza ? `${pf.altezza} cm` : "", `${v} cm`]], vpSalvaProfilo(p => { p.altezza = v; }), { nota: pf.bmrAuto ? "Il metabolismo basale si ricalcola da solo." : "" });
  }
  if ((m = t.match(/\bsono (?:un |una )?(uomo|donna|maschio|femmina|ragazzo|ragazza)\b/))) {
    const s = /uomo|maschio|ragazzo/.test(m[1]) ? "uomo" : "donna";
    return vpConferma("🙋 Sesso", [["Sesso", pf.sesso ? vpMaiusc(pf.sesso) : "", vpMaiusc(s)]], vpSalvaProfilo(p => { p.sesso = s; }));
  }
  return false;
}

// ---------- 6) Obiettivo e deficit: «voglio mettere massa», «passa a mantenimento», «deficit 15%» ----------
function vpObiettivo(t) {
  const pf = leggiProfilo(), OB = typeof QZ_OBIETTIVI !== "undefined" ? QZ_OBIETTIVI : [["Dimagrire", "", "dimagrire", 15], ["Definire", "", "definire", 10], ["Mantenere il peso", "", "mantenere", 0], ["Mettere massa", "", "massa", -10]];
  const obPrima = (OB.find(o => o[2] === pf.obiettivo && o[3] === pf.deficit) || OB.find(o => o[3] === pf.deficit) || [`deficit ${pf.deficit}%`])[0];
  let m = t.match(/\b(?:deficit|taglio)\s+(?:calorico\s+)?(?:del|di|al|a)?\s*(\d{1,2})\s*(?:%|per cento|percento)?/), k = null, d = null;
  if (m) d = +m[1];
  else if ((m = t.match(/\bsurplus\s+(?:calorico\s+)?(?:del|di|al|a)?\s*(\d{1,2})/))) d = -m[1];
  else if (/\b(?:voglio|vorrei|obiettivo|passa(?:re)?(?:\s+a)?|imposta|adesso|ora|torno a|devo|punto a|mi serve)\b/.test(t)) {
    if (/\b(?:dimagrire|perdere peso|perdere qualche chilo|calare|scendere di peso)\b/.test(t)) k = "dimagrire";
    else if (/\b(?:definire|definizione|tonificare|tonificarmi|asciugarmi|asciugare)\b/.test(t)) k = "definire";
    else if (/\b(?:mantenere|mantenimento|mantenermi|stare stabile|restare così)\b/.test(t)) k = "mantenere";
    else if (/\b(?:massa|bulk|mettere peso|aumentare di peso|ingrassare|prendere peso|crescere)\b/.test(t)) k = "massa";
    if (!k) return false;
    d = (OB.find(o => o[2] === k) || [])[3];
  } else return false;
  if (!(d >= -25 && d <= 30)) { avviso("Il deficit va da −20% (massa) a 30%"); return true; }
  const ob = k ? (OB.find(o => o[2] === k) || [])[0] : null;
  return vpConferma("✨ Obiettivo", [["Obiettivo", obPrima, ob || (d > 0 ? "Deficit" : d < 0 ? "Surplus" : "Mantenere")], ["Deficit", `${pf.deficit}%`, `${d}%`]],
    vpSalvaProfilo(p => { p.deficit = d; if (k) p.obiettivo = k; }),
    { nota: pf.kcalMan > 0 ? "Hai le calorie scritte a mano nel Profilo: finché ci sono, il deficit non si usa (di' «calcolo automatico» per toglierle)." : "Le calorie di ogni giorno si ricalcolano; proteine e grassi restano quelli di adesso." });
}

// ---------- 7) Macro e numeri del Profilo ----------
function vpMacro(t) {
  const pf = leggiProfilo(); let m;
  const perKg = "\\s*(?:g|grammi|gr)?\\s*(?:per|al|a|x)\\s*(?:chilo|kg|chilogrammo|kilo)";
  if ((m = t.match(new RegExp("\\bproteine\\s+(?:a\\s+|da\\s+)?(\\d(?:[.,]\\d)?)" + perKg)))) {
    const v = vpNum(m[1]); if (v < 0.8 || v > 3.5) { avviso("Le proteine vanno da 0,8 a 3,5 g per kg"); return true; }
    return vpConferma("💪 Proteine", [["Proteine", `${String(pf.protKg).replace(".", ",")} g/kg`, `${String(v).replace(".", ",")} g/kg`]], vpSalvaProfilo(p => { p.protKg = v; }), { nota: pf.protMan > 0 ? "Hai le proteine scritte a mano: finché ci sono valgono quelle." : "" });
  }
  if ((m = t.match(new RegExp("\\bgrassi\\s+(?:a\\s+|da\\s+)?(\\d(?:[.,]\\d)?)" + perKg)))) {
    const v = vpNum(m[1]); if (v < 0.3 || v > 2) { avviso("I grassi vanno da 0,3 a 2 g per kg"); return true; }
    return vpConferma("🥑 Grassi", [["Grassi", `${String(pf.grassiKg).replace(".", ",")} g/kg`, `${String(v).replace(".", ",")} g/kg`]], vpSalvaProfilo(p => { p.grassiKg = v; }));
  }
  if (/\b(?:calcolo automatico|obiettivi automatici|calcola(?:li)? tu|togli (?:gli )?obiettivi (?:manuali|impostati|scritti)|torna(?:re)? (?:al calcolo )?automatic[oa])\b/.test(t) && !/\bbasale\b/.test(t)) {
    if (!(pf.kcalMan > 0 || pf.protMan > 0 || pf.grassiMan > 0)) { avviso("Gli obiettivi sono già calcolati dall'app"); return true; }
    return vpConferma("🧮 Obiettivi", [["Calorie", pf.kcalMan > 0 ? `${pf.kcalMan} kcal` : "", "automatico"], ["Proteine", pf.protMan > 0 ? `${pf.protMan} g` : "", "automatico"], ["Grassi", pf.grassiMan > 0 ? `${pf.grassiMan} g` : "", "automatico"]],
      vpSalvaProfilo(p => { delete p.kcalMan; delete p.protMan; delete p.grassiMan; }));
  }
  if ((m = t.match(/\bproteine\s+(?:a\s+)?(\d{2,3})\s*(?:g|grammi|gr)?\b(?!\s*(?:per|al|a|x)\s*(?:chilo|kg|kilo))/)) && /\b(?:grammi|g|gr|al giorno|obiettivo|imposta|metti)\b/.test(t)) {
    const v = +m[1]; if (v < 30 || v > 300) return false;
    return vpConferma("💪 Proteine al giorno", [["Proteine", pf.protMan > 0 ? `${pf.protMan} g` : "automatico", `${v} g`]], vpSalvaProfilo(p => { p.protMan = v; }), { nota: "Scritte a mano: valgono al posto del calcolo per chilo. Di' «calcolo automatico» per tornare indietro." });
  }
  if ((m = t.match(/\bgrassi\s+(?:a\s+)?(\d{2,3})\s*(?:g|grammi|gr)?\b(?!\s*(?:per|al|a|x)\s*(?:chilo|kg|kilo))/)) && /\b(?:grammi|g|gr|al giorno|obiettivo|imposta|metti)\b/.test(t)) {
    const v = +m[1]; if (v < 20 || v > 200) return false;
    return vpConferma("🥑 Grassi al giorno", [["Grassi", pf.grassiMan > 0 ? `${pf.grassiMan} g` : "automatico", `${v} g`]], vpSalvaProfilo(p => { p.grassiMan = v; }));
  }
  if ((m = t.match(/\b(?:basale|metabolismo basale|metabolismo)\s+(?:a\s+|di\s+|è\s+)?(\d{3,4})\b/))) {
    const v = +m[1]; if (v < 800 || v > 3500) return false;
    return vpConferma("🔥 Metabolismo basale", [["Basale", `${Math.round(pf.bmr)} kcal`, `${v} kcal`]], vpSalvaProfilo(p => { p.bmr = v; p.bmrAuto = false; }), { nota: "Scritto da te: non segue più il peso. Di' «basale automatico» per farlo calcolare all'app." });
  }
  if (/\b(?:basale|metabolismo)\s+automatic|\bcalcola (?:tu |l'app )?il (?:basale|metabolismo)\b/.test(t)) {
    if (!(pf.eta && pf.altezza && pf.sesso)) { avviso("Per calcolarlo servono età, altezza e sesso: dimmeli (es. «ho 34 anni»)"); return true; }
    const b = basaleDelProfilo(pf);
    return vpConferma("🔥 Metabolismo basale", [["Basale", `${Math.round(pf.bmr)} kcal`, `${b} kcal (automatico)`]], vpSalvaProfilo(p => { p.bmrAuto = true; }));
  }
  if ((m = t.match(/\b(?:reintegr\w*|recuper\w*|mangiare)\b[^\d]*(\d{1,3})\s*(?:%|per cento|percento)/)) && /\ballenament|\bsport|\breintegr/.test(t)) {
    const v = +m[1]; if (v > 100) return false;
    return vpConferma("🏃 Allenamento reintegrato", [["Calorie dell'allenamento che mangi", `${pf.recupero}%`, `${v}%`]], vpSalvaProfilo(p => { p.recupero = v; p.recupero80 = true; }));
  }
  if ((m = t.match(/\b(?:obiettivo|imposta|metti)\b[^\d]*(\d{1,2}[.\s]?\d{3})\s*(?:calorie|kcal)|\b(\d{1,2}[.\s]?\d{3})\s*(?:calorie|kcal)\s*(?:al giorno|giornaliere|ogni giorno|a riposo)\b|\bcalorie\s+(?:giornaliere\s+|al giorno\s+)?(?:a\s+)?(\d{1,2}[.\s]?\d{3})\b/))) {
    const v = parseInt((m[1] || m[2] || m[3]).replace(/[.\s]/g, ""), 10); if (v < 1000 || v > 5000) return false;
    return vpConferma("🔥 Calorie di un giorno di riposo", [["Calorie", pf.kcalMan > 0 ? `${pf.kcalMan} kcal` : "automatico", `${v} kcal`]], vpSalvaProfilo(p => { p.kcalMan = v; }),
      { nota: `Scritte a mano: il deficit non si usa e lo sport aggiunge la quota «Allenamento reintegrato» (${pf.recupero}%). Mai sotto il basale (${Math.round(pf.bmr)}). Di' «calcolo automatico» per tornare indietro.` });
  }
  return false;
}

// ---------- 8) Alimentazione: dieta, allergie, cose che non mangi (e toglierle) ----------
// le parole generiche diventano la categoria del Profilo; un cibo preciso («kiwi», «pollo») va tra gli «altri»: si escludono i cibi con quel nome
const VP_CATEGORIE_NM = [[/^(?:carne|carni)$/, ["carneRossa", "pollame", "maiale"]], [/^carne rossa|^carni rosse/, ["carneRossa"]], [/^carne bianca|^carni bianche|^pollame|^pollo e tacchino/, ["pollame"]],
  [/^maiale|^salumi|^affettati|^insaccati/, ["maiale"]], [/^pesce$|^il pesce$|^pesci$|^frutti di mare|^crostacei|^molluschi/, ["pesce"]], [/^uova$|^uovo$/, ["uova"]],
  [/^latticini|^formaggi$|^derivati del latte/, ["latticini"]], [/^legumi/, ["legumi"]], [/^funghi/, ["funghi"]], [/^piccante|^cibi piccanti|^peperoncino/, ["piccante"]], [/^alcol|^alcool|^alcolici/, ["alcol"]]];
const vpCatNM = (w) => { const n = normCibo(w); const c = VP_CATEGORIE_NM.find(([re]) => re.test(n)); return c ? c[1] : null; };
const vpCatAll = (w) => { const n = normCibo(w); if (/^celiac/.test(n)) return "glutine"; const a = ALLERGIE.find(([k, l]) => normCibo(l) === n || normCibo(k) === n); return a ? a[0] : categoriaDiParola(w); };
const vpEtNM = (k) => (NON_MANGIO.find(x => x[0] === k) || [k, k])[1];
const vpEtAll = (k) => (ALLERGIE.find(x => x[0] === k) || [k, k])[1];
function vpAlimentazione(t) {
  const pf = leggiProfilo(), e0 = pf.esclusioni || {}; let m;
  const E = () => { const p = leggiProfilo(); p.esclusioni = Object.assign({ allergie: [], nonMangio: [], altri: [], allergieAltre: [] }, p.esclusioni || {}); ["allergie", "nonMangio", "altri", "allergieAltre"].forEach(k => { p.esclusioni[k] = (p.esclusioni[k] || []).slice(); }); return p; };
  const pulisciE = (p) => { const x = p.esclusioni; ["allergie", "nonMangio", "altri", "allergieAltre"].forEach(k => { if (!x[k].length) delete x[k]; }); if (!Object.keys(x).length) delete p.esclusioni; salvaProfilo(p); };
  const elenco = (e) => [...(e.allergie || []).map(vpEtAll), ...(e.allergieAltre || []), ...(e.nonMangio || []).map(vpEtNM), ...(e.altri || [])].join(", ") || "niente";
  // dieta
  if ((m = t.match(/\b(?:sono|divento|diventata|diventato|seguo una dieta|seguo un'alimentazione|mangio)\s+(vegetarian[oa]|vegan[oa])\b/)) && !/\bnon\b/.test(t)) {
    const d = /^vegan/.test(m[1]) ? "vegana" : "vegetariana";
    return vpConferma("🥗 Alimentazione", [["Dieta", e0.dieta ? vpMaiusc(e0.dieta) : "Nessuna", vpMaiusc(d)]], () => { const p = E(); p.esclusioni.dieta = d; delete p.esclusioni.senzaVeg; pulisciE(p); }, { nota: "Le ricette e i consigli non ti proporranno più cibi che non rientrano nella dieta." });
  }
  if (/\bnon sono più (?:vegetarian|vegan)|\bmangio di tutto\b|\btorno a mangiare (?:la )?carne\b|\bnessuna dieta\b/.test(t)) {
    if (!e0.dieta) { avviso("Non hai nessuna dieta impostata"); return true; }
    return vpConferma("🥗 Alimentazione", [["Dieta", vpMaiusc(e0.dieta), "Nessuna"]], () => { const p = E(); delete p.esclusioni.dieta; pulisciE(p); });
  }
  // togliere un'allergia o un cibo escluso
  if ((m = t.match(/\bnon sono più (?:allergic[oa]|intollerante)\s+(?:(?:allo|alla|alle|agli|al|ai|ad|a)\s+|all')?(.+)$/)) || (m = t.match(/\b(?:adesso|ora|di nuovo|ormai)\s+mangio\s+(?:anche\s+)?(.+)$|\bmangio di nuovo\s+(.+)$|\btorno a mangiare\s+(.+)$|\b(?:togli|rimuovi|cancella)\s+(.+?)\s+dai cibi (?:che non mangio|esclusi|che evito)|\b(?:togli|rimuovi)\s+(?:l'allergia|l'intolleranza)\s+(?:(?:allo|alla|alle|agli|al|ai|ad|a)\s+|all')?(.+)$/))) {
    const voci = vpVoci(m[1] || m[2] || m[3] || m[4] || m[5]); if (!voci.length) return false;
    const p0 = E(), x = p0.esclusioni, tolti = [];
    voci.forEach(w => {
      const nm = vpCatNM(w) || [], al = vpCatAll(w);
      nm.forEach(k => { if (x.nonMangio.includes(k)) { x.nonMangio = x.nonMangio.filter(y => y !== k); tolti.push(vpEtNM(k)); } });
      if (al && x.allergie.includes(al)) { x.allergie = x.allergie.filter(y => y !== al); tolti.push(vpEtAll(al)); }
      ["altri", "allergieAltre"].forEach(k => { const prima = x[k].length; x[k] = x[k].filter(y => normCibo(y) !== normCibo(w)); if (x[k].length < prima) tolti.push(w); });
    });
    if (!tolti.length) { avviso(`«${voci.join(", ")}» non è tra le cose escluse`); return true; }
    const dopo = Object.assign({}, x);
    return vpConferma("🥗 Alimentazione", [["Esclusi", elenco(e0), elenco(dopo)]], () => pulisciE(p0), { nota: `Di nuovo nelle proposte: ${tolti.join(", ").toLowerCase()}.` });
  }
  // allergie e intolleranze
  if ((m = t.match(/\b(?:sono\s+|ho un'?\s*)?(?:allergic[oa]|intollerante|allergia|intolleranza)\s+(?:(?:per il|per la|per lo|per i|per le|allo|alla|alle|agli|al|ai|ad|a)\s+|all')?(.+)$/)) || (m = t.match(/\bsono (celiac[oa])\b/))) {
    const voci = /^celiac/.test(m[1]) ? ["celiaca"] : vpVoci(m[1]); if (!voci.length) return false;
    const p0 = E(), x = p0.esclusioni, nuovi = [];
    voci.forEach(w => { const k = vpCatAll(w); if (k && ALLERGIE.some(a => a[0] === k)) { if (!x.allergie.includes(k)) { x.allergie.push(k); nuovi.push(vpEtAll(k)); } } else if (k === "alcol") { if (!x.nonMangio.includes("alcol")) { x.nonMangio.push("alcol"); nuovi.push("Alcol"); } } else if (!x.allergieAltre.some(y => normCibo(y) === normCibo(w))) { x.allergieAltre.push(vpMaiusc(w)); nuovi.push(vpMaiusc(w)); } });
    if (!nuovi.length) { avviso("È già tra le tue allergie"); return true; }
    return vpConferma("⚠️ Allergie e intolleranze", [["Esclusi", elenco(e0), elenco(x)]], () => pulisciE(p0), { nota: "Le ricette con questi alimenti non ti verranno proposte. L'app li riconosce dal nome e può sbagliare: controlla sempre gli ingredienti." });
  }
  // cose che non mangi
  if ((m = t.match(/\b(?:non mangio(?: più| mai)?|non mi piace|non mi piacciono|non sopporto|evito|escludi|odio|toglimi|non voglio(?: più)?(?: mangiare)?)\s+(?:mai\s+|più\s+)?(.+)$/))) {
    const voci = vpVoci(m[1]).filter(w => !/^(?:colazione|pranzo|cena|merenda|spuntino|dopocena|niente)$/.test(normCibo(w))); if (!voci.length) return false;
    const p0 = E(), x = p0.esclusioni, nuovi = [];
    voci.forEach(w => { const c = vpCatNM(w); if (c) c.forEach(k => { if (!x.nonMangio.includes(k)) { x.nonMangio.push(k); nuovi.push(vpEtNM(k)); } }); else if (!x.altri.some(y => normCibo(y) === normCibo(w))) { x.altri.push(vpMaiusc(w)); nuovi.push(vpMaiusc(w)); } });
    if (!nuovi.length) { avviso("È già tra le cose che non mangi"); return true; }
    return vpConferma("🚫 Cose che non mangi", [["Esclusi", elenco(e0), elenco(x)]], () => pulisciE(p0), { nota: "Le ricette e i consigli con questi cibi non ti verranno proposti." });
  }
  return false;
}

// ---------- 9) I pasti che fai: «non faccio più lo spuntino», «faccio anche la merenda» ----------
// le sole parole che possono esserci in questo comando (tutto il resto è un cibo: allora non è questo comando)
const PAROLE_PASTI_SCELTI = new Set(("il lo la l i gli le un una uno a ad al alla allo ai agli alle di del della dello dei degli delle da dal dalla dallo dai dagli dalle e ed anche più piu sempre ora " +
  "miei mie mio mia tra fra nei nel nella negli nelle per favore grazie ogni giorno giorni tutti tutte voglio vorrei faccio fare fai comincio cominciare inizio rimetti rimettimi metti mettimi aggiungi aggiungimi " +
  "togli toglimi elimina eliminami salto saltare niente non no pasto pasti mattina mattutino pomeriggio pomeridiano pomeridiana sera serale dopo cena dopocena spuntino spuntini merenda colazione pranzo cena " +
  "quello quella lista miei").split(/\s+/));
function vpPastiScelti(t) {
  const togli = /\b(?:non faccio(?: più)?|salto(?: sempre)?|niente più|togli(?:mi)?|elimina|non voglio più)\b/.test(t), metti = /\b(?:faccio anche|aggiungi(?:mi)?|da ora faccio|comincio a fare|voglio anche|rimetti)\b/.test(t);
  if (!(togli || metti) || !/\b(?:pasti|pasto|faccio|salto|spuntino|merenda|colazione|dopo\s*cena|dopocena)\b/.test(t)) return false;
  if (togli && !/\b(?:non faccio|salto|niente più|non voglio più|dai (?:miei )?pasti|pasto)\b/.test(t)) return false;
  // c'è un cibo nella frase («aggiungi brownie a colazione», «togli il pane dal pranzo»): è un alimento del pasto, non i pasti che fai
  const resto = t.replace(/[.,!?;:']/g, " ").split(/\s+/).filter(w => w && !PAROLE_PASTI_SCELTI.has(w));
  if (resto.length) return false;
  const pf = leggiProfilo(), prima = Array.isArray(pf.pasti) && pf.pasti.length ? pf.pasti.slice() : ORDINE_BASE.slice();
  const p = vpTrovaPasti(t.replace(/\bpasti\b/g, " ")).map(x => x.p).filter((x, i, a) => a.indexOf(x) === i);
  // trovaPasti sceglie lo spuntino «del momento»: qui «spuntino» da solo è quello della mattina
  const lista = p.map(x => /\bspuntino\b/.test(t) && !/pomerig|pomerid|sera|seral|dopo\s*cena/.test(t) && (x === "spuntino" || x === "sera") && !/merenda/.test(t) ? "mattina" : x);
  if (!lista.length) return false;
  let dopo = prima.slice();
  if (togli) dopo = dopo.filter(x => !lista.includes(x)); else lista.forEach(x => { if (!dopo.includes(x)) dopo.push(x); });
  dopo = ORDINE_TEMPO.filter(x => dopo.includes(x));
  if (!dopo.length) { avviso("Serve almeno un pasto"); return true; }
  if (dopo.join() === prima.join()) { avviso(togli ? "Quel pasto non c'è già" : "Lo fai già"); return true; }
  const nome = (x) => x === "sera" ? vpMaiusc(nomeSera()) : x === "spuntino" ? "Merenda" : NomePasto(x);
  return vpConferma("🍽️ I tuoi pasti", [["Pasti", prima.map(nome).join(", "), dopo.map(nome).join(", ")]], vpSalvaProfilo(p2 => { p2.pasti = dopo; if (dopo.includes("sera") && !String(p2.nomeSera || "").trim()) p2.nomeSera = "Spuntino serale"; }),
    { nota: "Le calorie del giorno si dividono tra i pasti che fai. Gli orari li cambi a voce (es. «la merenda alle 17») o nel Profilo." });
}

// ---------- 10) Sport: aggiungere o togliere ----------
const VP_INTENSITA = { leggera: 0.05, leggero: 0.05, bassa: 0.05, media: 0.075, medio: 0.075, normale: 0.075, alta: 0.1, intensa: 0.1, intenso: 0.1, forte: 0.1 };
function vpSport(t) {
  const pf = leggiProfilo(); let m;
  if ((m = t.match(/\b(?:aggiungi|aggiungere|aggiungimi|nuovo|crea)\s+(?:lo |uno |il |un |come )?sport\s+(?:che si chiama\s+)?(.+?)\s*$/))) {
    let nome = m[1], k = 0.075;
    const mi = nome.match(/[,\s]+(?:intensità|fatica|livello|impegno|che è|abbastanza)?\s*(leggera|leggero|bassa|media|medio|normale|alta|intensa|intenso|forte)\s*$/);
    if (mi) { k = VP_INTENSITA[mi[1]]; nome = nome.slice(0, mi.index); }
    nome = vpMaiusc(vpPulisci(nome.replace(/\b(?:ai miei sport|tra i miei sport|nel profilo)\b/g, ""))); if (nome.length < 3) return false;
    const uguale = pf.sport.find(x => normCibo(x.nome) === normCibo(nome));
    if (uguale && !uguale.nascosto) { avviso(`${uguale.nome} è già tra i tuoi sport`); return true; }
    const lab = k <= 0.05 ? "leggera" : k >= 0.1 ? "intensa" : "media";
    return vpConferma("🏅 Nuovo sport", [["Sport", "", uguale ? `${uguale.nome} (di nuovo)` : nome], ["Intensità", "", `${lab} · ~${Math.round(k * pf.peso * 10) / 10} kcal al minuto`], ["Durata di solito", "", "60 min"]],
      vpSalvaProfilo(p => { const u = p.sport.find(x => normCibo(x.nome) === normCibo(nome)); if (u) { delete u.nascosto; return; } let id = slug(nome) || "sport"; while (p.sport.some(x => x.id === id)) id += "2"; p.sport.push({ id, nome, icona: "🏅", kMin: k, min: 60 }); }),
      { nota: "La durata la cambi a voce (es. «l'arrampicata di solito dura 90 minuti») o nel Profilo.", fatto: `✓ ${uguale ? uguale.nome : nome} tra i tuoi sport` });
  }
  if ((m = t.match(/\b(?:togli|rimuovi|elimina|cancella|nascondi)\s+(?:lo sport\s+|il |la |lo |l')?(.+?)\s*(?:dai (?:miei )?sport|dagli sport|dalla lista degli sport|dal profilo)?\s*$/))) {
    const nome = vpPulisci(m[1].replace(/\b(?:dai (?:miei )?sport|dagli sport|sport)\b/g, ""));
    const trovati = sportDetti(" " + nome + " ", pf).filter(s => s.sp && !s.sp.nascosto);
    const sp = (trovati[0] || {}).sp || pf.sport.find(x => !x.nascosto && normCibo(x.nome) === normCibo(nome));
    if (!sp) { if (/\bsport\b/.test(t)) { avviso(`Non trovo «${nome}» tra i tuoi sport`); return true; } return false; }
    if (!/\bsport\b/.test(t) && normCibo(sp.nome) !== normCibo(nome)) return false;   // «togli il pollo»: non è uno sport
    const tipi = leggiTipi(), senza = (tk) => { const parti = String(VECCHI_TIPI[tk] || tk).split("+").filter(x => x && x.split(":")[0] !== sp.id); return parti.length ? parti.join("+") : "riposo"; };
    const giorniUsa = tipi.map((tk, i) => sportDelTipo(tk).includes(sp.id) ? i : -1).filter(i => i >= 0);
    return vpConferma(`🗑️ Togliere ${esc(sp.nome)}?`, giorniUsa.map(i => [GIORNI[i], TIPI_GIORNATA[tipi[i]].label, TIPI_GIORNATA[senza(tipi[i])].label]).concat(giorniUsa.length ? [] : [["Settimana tipo", "", "non cambia"]]),
      () => {
        const p = leggiProfilo(), s = p.sport.find(x => x.id === sp.id); if (s) s.nascosto = true;
        if (giorniUsa.length) {
          const oggi = oggiISO(), d = leggiDiario(); let cambiato = false;   // i giorni passati che seguivano la settimana tipo restano com'erano
          Object.keys(d).forEach(data => { if (data < oggi && d[data] && !d[data].tipo && giorniUsa.includes(indiceSettimana(data))) { d[data].tipo = tipi[indiceSettimana(data)]; cambiato = true; } });
          if (cambiato) salvaDiario(d);
          salvaTipi(tipi.map((tk, i) => giorniUsa.includes(i) ? senza(tk) : tk));
        }
        salvaProfilo(p);
      }, { ok: "Togli", nota: "I giorni passati non cambiano. Puoi rimetterlo dicendo «aggiungi lo sport " + esc(sp.nome.toLowerCase()) + "».", fatto: `✓ ${sp.nome} tolto` });
  }
  return false;
}

// ---------- 11) Settimana tipo: «di solito il lunedì CrossFit e il giovedì equitazione», «il mercoledì riposo», «dal lunedì al venerdì camminata» ----------
function vpGiorniAbituali(t) {
  const out = [], WD = ["luned", "marted", "mercoled", "gioved", "venerd", "sabat", "domenic"];
  const idx = (w) => WD.findIndex(p => norm(w).startsWith(p));
  let m; const reR = /\bdal\s+(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato)\s+al\s+(marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)(?![a-zà-ù])/g;
  const presi = [];
  while ((m = reR.exec(t))) { const a = idx(m[1]), b = idx(m[2]); const g = []; for (let i = a; i <= b; i++) g.push(i); out.push({ i: m.index, giorni: g }); presi.push([m.index, m.index + m[0].length]); }
  const reT = /\b(?:tutti i giorni|ogni giorno|tutta la settimana|sempre)\b/g; while ((m = reT.exec(t))) { out.push({ i: m.index, giorni: [0, 1, 2, 3, 4, 5, 6] }); presi.push([m.index, m.index + m[0].length]); }
  const reW = /\b(?:nel|il|a)\s+(?:weekend|week end|fine settimana)\b/g; while ((m = reW.exec(t))) { out.push({ i: m.index, giorni: [5, 6] }); presi.push([m.index, m.index + m[0].length]); }
  const reS = /\b(?:in settimana|nei giorni feriali|i giorni feriali)\b/g; while ((m = reS.exec(t))) { out.push({ i: m.index, giorni: [0, 1, 2, 3, 4] }); presi.push([m.index, m.index + m[0].length]); }
  const reG = /\b(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|sabati|domenica|domeniche)(?![a-zà-ù])/g;
  while ((m = reG.exec(t))) { if (presi.some(([a, b]) => m.index >= a && m.index < b)) continue; out.push({ i: m.index, giorni: [idx(m[1])] }); }
  return out.sort((a, b) => a.i - b.i);
}
function vpSettimanaTipo(t) {
  if (/\b(?:prossim[oa]|scors[oa]|oggi|domani|ieri|dopodomani|stasera|stamattina)\b/.test(t)) return false;
  const conArticolo = /\b(?:il|la|ogni|i|le)\s+(?:luned|marted|mercoled|gioved|venerd|sabat|domenic)/.test(t) || /\bdal\s+[a-zà-ù]+\s+al\b|\btutti i giorni|\bogni giorno|\bweekend|\bfine settimana/.test(t);
  if (!VP_ABITUALE.test(t) && !conArticolo) return false;
  const pf = leggiProfilo(), giorni = vpGiorniAbituali(t); if (!giorni.length) return false;
  const sport = sportDetti(t, pf), riposi = []; { const re = /\b(?:riposo|niente sport|niente allenamento|non mi alleno|libero|nessuno sport|stop)\b/g; let m; while ((m = re.exec(t))) riposi.push({ i: m.index }); }
  if (!sport.length && !riposi.length) return false;
  const mancante = sport.find(s => !s.sp); if (mancante && !sport.some(s => s.sp)) { avviso(`«${mancante.parola}» non è tra i tuoi sport: di' «aggiungi lo sport ${mancante.parola}»`); return true; }
  // a gruppi: i giorni detti di fila prendono gli sport che seguono («il lunedì e il mercoledì CrossFit»); se lo sport viene prima, va ai giorni dopo
  const ev = giorni.map(g => ({ i: g.i, g })).concat(sport.filter(s => s.sp).map(s => ({ i: s.i, s })), riposi.map(r => ({ i: r.i, r: true }))).sort((a, b) => a.i - b.i);
  const gruppi = []; let cur = null;
  ev.forEach(e => {
    if (e.g) { if (cur && !cur.giorni.length) cur.giorni.push(...e.g.giorni); else if (cur && !cur.sport.length && !cur.riposo) cur.giorni.push(...e.g.giorni); else { cur = { giorni: e.g.giorni.slice(), sport: [], riposo: false }; gruppi.push(cur); } return; }
    if (!cur) { cur = { giorni: [], sport: [], riposo: false }; gruppi.push(cur); }
    if (e.r) cur.riposo = true; else cur.sport.push(e.s);
  });
  gruppi.forEach((g, k) => { if (!g.sport.length && !g.riposo && k > 0) { g.sport = gruppi[k - 1].sport.slice(); g.riposo = gruppi[k - 1].riposo; } });
  // durate dette («il sabato CrossFit 90 minuti»): allo sport più vicino
  const durate = durateDette(t), durDi = {};
  durate.forEach(d => { const s = sport.filter(x => x.sp).reduce((b, x) => !b || Math.abs(x.i - d.i) < Math.abs(b.i - d.i) ? x : b, null); if (s && !!s.sp.perKm === d.km) durDi[s.i] = d.v; });
  const aggiungi = /\b(?:aggiungi|anche|in più)\b/.test(t);
  const prima = leggiTipi(), dopo = prima.slice();
  gruppi.forEach(g => g.giorni.forEach(i => {
    if (g.riposo && !g.sport.length) { dopo[i] = "riposo"; return; }
    const ids = (aggiungi ? sportDelTipo(dopo[i]) : []).concat(g.sport.map(s => s.sp.id)), dur = aggiungi ? durateDelTipo(dopo[i]) : {};
    g.sport.forEach(s => { if (durDi[s.i]) dur[s.sp.id] = durDi[s.i]; });
    dopo[i] = chiaveTipo(ids, dur);
  }));
  const cambiati = dopo.map((k, i) => k !== prima[i] ? i : -1).filter(i => i >= 0);
  if (!cambiati.length) { avviso("La settimana tipo è già così"); return true; }
  return vpConferma("🗓️ Settimana tipo", cambiati.map(i => [GIORNI[i], TIPI_GIORNATA[prima[i]].label, TIPI_GIORNATA[dopo[i]].label]),
    () => { salvaTipi(dopo); }, { nota: "Vale per le settimane da qui in avanti (i giorni già passati non cambiano). Un giorno diverso dal solito lo cambi in Oggi." + (mancante ? ` «${esc(mancante.parola)}» non è tra i tuoi sport: l'ho lasciato fuori.` : ""), fatto: "✓ Settimana tipo aggiornata" });
}

// ---------- 12) Durata di solito di uno sport: «la sala pesi di solito dura 75 minuti», «la corsa di solito 8 km» ----------
function vpDurataSport(t) {
  if (!/\b(?:dura|durano|durata|di solito|solitamente|normalmente|in genere|generalmente|standard|sessione|ogni volta|sempre)\b/.test(t)) return false;
  if (giorniNellaFrase(t).length || vpGiorniAbituali(t).length) return false;
  const pf = leggiProfilo(), sport = sportDetti(t, pf).filter(s => s.sp), durate = durateDette(t);
  if (!sport.length || !durate.length) return false;
  const righe = [], nuovi = {};
  durate.forEach(d => {
    const s = sport.find(x => x.i >= d.i + d.l && x.i - (d.i + d.l) <= 6) || sport.reduce((b, x) => !b || Math.abs(x.i - d.i) < Math.abs(b.i - d.i) ? x : b, null); if (!s) return;
    const sp = s.sp; let v = d.v;
    if (sp.perKm && !d.km) v = Math.round(d.v / 6 * 10) / 10;   // corsa detta in minuti: circa 6 minuti al km
    if (!sp.perKm && d.km) return;
    nuovi[sp.id] = v;
    const prima = sp.perKm ? `${fmtKm(sp.km || 5)} km` : fmtMin(sp.min || 60), dopoT = sp.perKm ? `${fmtKm(v)} km` : fmtMin(v);
    const k = kcalSport(Object.assign({}, sp, sp.perKm ? { km: v } : { min: v }), 0, pf);
    righe.push([`${sp.icona} ${sp.nome}`, prima, `${dopoT} · ≈ ${k} kcal`]);
  });
  if (!righe.length) return false;
  return vpConferma("⏱️ Durata di solito", righe, vpSalvaProfilo(p => { Object.entries(nuovi).forEach(([id, v]) => { const sp = p.sport.find(x => x.id === id); if (!sp) return; if (sp.perKm) sp.km = v; else sp.min = v; }); }),
    { nota: "Vale per i giorni in cui non scrivi una durata diversa (quella la cambi in Oggi toccando lo sport del giorno)." });
}

// ---------- 13) Orario abituale degli allenamenti: «di solito mi alleno alle 18», «il CrossFit di solito alle 7» ----------
function vpOrarioAllen(t) {
  if (!VP_ABITUALE.test(t) || /\b(?:oggi|domani|ieri|dopodomani|stasera|stamattina|prossim[oa])\b/.test(t)) return false;
  const pf = leggiProfilo(), sport = sportDetti(t, pf).filter(s => s.sp && s.sp.id !== "camminata"), h = oraDetta(t);
  if (h === null || (!sport.length && !/\b(?:alleno|allenamento|allenamenti|allenarmi|palestra|sport)\b/.test(t))) return false;
  if (vpGiorniAbituali(t).some(g => g.giorni.length < 7)) return false;   // «il lunedì alle 18»: è la settimana tipo (non l'orario di tutti i giorni)
  const oraDi = (sp) => typeof sp.ora === "number" ? sp.ora : typeof pf.allenOra === "number" ? pf.allenOra : null;
  if (sport.length) {
    return vpConferma("🕒 Orario di solito", sport.map(s => [`${s.sp.icona} ${s.sp.nome}`, oraDi(s.sp) !== null ? vpFmtOra(oraDi(s.sp)) : "—", vpFmtOra(h)]),
      vpSalvaProfilo(p => { sport.forEach(s => { const sp = p.sport.find(x => x.id === s.sp.id); if (sp) sp.ora = h; }); }),
      { nota: "Serve a capire quale pasto viene prima (più leggero) e quale dopo (per recuperare). Se un giorno cambia, lo dici («oggi mi alleno alle 7»)." });
  }
  const usati = [...new Set(leggiTipi().flatMap(k => sportDelTipo(k)))].map(id => pf.sport.find(x => x.id === id)).filter(sp => sp && sp.id !== "camminata");
  const righe = usati.length ? usati.map(sp => [`${sp.icona} ${sp.nome}`, oraDi(sp) !== null ? vpFmtOra(oraDi(sp)) : "—", vpFmtOra(h)]) : [["Allenamenti", typeof pf.allenOra === "number" ? vpFmtOra(pf.allenOra) : "—", vpFmtOra(h)]];
  return vpConferma("🕒 Orario degli allenamenti", righe, vpSalvaProfilo(p => { p.allenOra = h; delete p.allenOrario; p.sport.forEach(sp => { delete sp.ora; }); }),
    { nota: "Tutti gli sport alla stessa ora. Per uno sport solo di' per esempio «il CrossFit di solito alle 7»." });
}

// ---------- 14) Orari dei pasti: «pranzo alle 13:30», «di solito ceno alle 20», «la merenda alle 17», «colazione alle 7 e cena alle 20:30» ----------
function vpOrariPasti(t) {
  if (!/\b(?:alle|verso le|per le|all')\s*\d|\balle\s+(?:una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici)\b/.test(t)) return false;
  let s = t.replace(/\b(?:ceno|ceniamo|cenare|ceneremo)\b/g, " cena ").replace(/\b(?:pranzare|pranziamo)\b/g, " pranzo ").replace(/\bfaccio (?:la )?colazione\b/g, " colazione ");
  const pasti = vpTrovaPasti(s);
  if (!pasti.length) return false;
  // nella frase ci sono solo pasti, orari e parole di contorno (niente cibi: «a pranzo riso alle 13» è un pasto da scrivere)
  let resto = s; pasti.slice().sort((a, b) => b.i - a.i).forEach(p => { resto = resto.slice(0, p.i) + " " + resto.slice(p.i + p.l); });
  resto = resto.replace(/\b(?:alle|verso le|per le|all')\s*(?:\d{1,2}(?:[:.]\d{2})?|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici)(?:\s+e\s+(?:mezza|un quarto|tre quarti|\d{1,2}))?(?:\s+(?:di|del|della)?\s*(?:mattina|pomeriggio|sera))?/g, " ")
    .replace(/\b(?:di solito|solitamente|normalmente|in genere|sempre|ogni giorno|tutti i giorni|d'ora in poi|da ora|da adesso|adesso|ora|sposta(?:re)?|metti|imposta|cambia|l'orario|orario|orari|del|della|dello|dei|di|il|la|lo|le|faccio|mangio|e|è|sono|io|in poi|a|ad|ore|invece|si|alla|al)\b/g, " ").replace(/[.,!?]/g, " ").trim();
  if (resto.split(/\s+/).filter(w => w && !/^(?:ogni|giorno|tutti|giorni|verso|circa|più|meno|anche)$/.test(w)).length > 0) return false;   // è rimasto un cibo o altro: non è un orario
  const re = /\b(?:alle|verso le|per le|all')\s*(\d{1,2}|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici)(?:[:.](\d{2})|\s+e\s+(mezza|un quarto|tre quarti|\d{1,2}))?/g;
  const P = { una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12 };
  const ore = []; let m; while ((m = re.exec(s))) { let h = P[m[1]] || +m[1]; const mi = m[2] ? +m[2] : m[3] === "mezza" ? 30 : m[3] === "un quarto" ? 15 : m[3] === "tre quarti" ? 45 : m[3] ? +m[3] : 0; ore.push({ i: m.index, h, mi }); }
  if (!ore.length) return false;
  const pf = leggiProfilo(), o = orariPasti(), nuovi = {};
  pasti.forEach((p, k) => {
    const prossimo = pasti[k + 1] ? pasti[k + 1].i : Infinity;
    const x = ore.find(z => z.i > p.i && z.i < prossimo) || ore.slice().reverse().find(z => z.i < p.i) || null; if (!x) return;
    let h = x.h; if (h < 12 && (p.p === "cena" || p.p === "sera" || p.p === "spuntino" || (p.p === "pranzo" && h <= 4))) h += 12;   // «ceno alle 8» = alle 20
    nuovi[p.p] = h + x.mi / 60;
  });
  if (!Object.keys(nuovi).length) return false;
  const scelti = Array.isArray(pf.pasti) && pf.pasti.length ? pf.pasti : ORDINE_BASE, dopo = Object.assign({}, o, nuovi);
  const ord = ORDINE_TEMPO.filter(x => scelti.includes(x) || nuovi[x] !== undefined);
  const nome = (x) => x === "sera" ? vpMaiusc(nomeSera()) : x === "spuntino" ? "Merenda" : NomePasto(x);
  for (let i = 1; i < ord.length; i++) if (!(dopo[ord[i]] > dopo[ord[i - 1]])) { avviso(`${nome(ord[i])} alle ${vpFmtOra(dopo[ord[i]])} verrebbe prima di ${nome(ord[i - 1]).toLowerCase()} (${vpFmtOra(dopo[ord[i - 1]])}): cambia anche quello`); return true; }
  const fuori = Object.keys(nuovi).filter(x => !scelti.includes(x));
  return vpConferma("⏰ Orari dei pasti", Object.keys(nuovi).map(x => [nome(x), vpFmtOra(o[x]), vpFmtOra(nuovi[x])]),
    vpSalvaProfilo(p => { p.orari = Object.assign({}, orariPasti(), nuovi); }),
    { nota: "Servono a sapere qual è il prossimo pasto, quando un pasto è passato e quale viene prima o dopo l'allenamento." + (fuori.length ? ` ${fuori.map(nome).join(", ")} non è tra i tuoi pasti: aggiungilo dicendo «faccio anche ${nome(fuori[0]).toLowerCase()}».` : "") });
}

// i pasti detti, anche il «dopo cena» quando non è (ancora) tra i tuoi pasti: serve per aggiungerlo o dargli un orario
function vpTrovaPasti(t) {
  const re = /\b(?:(?:a|per|il|lo|nel|nello|come)\s+)?(?:dopo\s*cena|dopocena|spuntino\s+(?:serale|notturno|(?:di|della|la)\s+(?:sera|notte)))(?![a-zà-ù])/g, sere = []; let m;
  while ((m = re.exec(t))) sere.push({ i: m.index, l: m[0].length, p: "sera", art: "" });
  let s = t; sere.forEach(x => { s = s.slice(0, x.i) + " ".repeat(x.l) + s.slice(x.i + x.l); });
  return trovaPasti(s, oggiISO()).concat(sere).sort((a, b) => a.i - b.i);
}
// Tutti i comandi del Profilo, nell'ordine in cui si provano (vero se la frase è stata capita)
let vpOrig = "";
function comandoProfilo(testo) {
  const t = fraseDetta(testo); vpOrig = String(testo || "").trim();
  return vpQuestionario(t) || vpNaviga(t) || vpBudgetSettimana(t) || vpPersonalizza(t) || vpDati(t) || vpObiettivo(t) || vpMacro(t)
    || vpAlimentazione(t) || vpPastiScelti(t) || vpSport(t) || vpSettimanaTipo(t) || vpDurataSport(t) || vpOrarioAllen(t) || vpOrariPasti(t);
}
