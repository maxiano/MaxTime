import { db, docRef } from "./firebase-config.js";
import { onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { TurniManager } from "./modules/TurniManager.js";
import { SpeseManager } from "./modules/SpeseManager.js";
import { LogisticaManager } from "./modules/LogisticaManager.js";
import { SaluteManager } from "./modules/SaluteManager.js";
import { VacanzeManager } from "./modules/VacanzeManager.js";
import { ExportManager } from "./modules/ExportManager.js";
import { FestivitaManager } from './modules/FestivitaManager.js';
import { SpesaTaglieManager } from './modules/SpesaTaglieManager.js';
import { DocumentiManager } from './modules/DocumentiManager.js';


// Inizializzazione Istanze Moduli
const turniMgr = new TurniManager();
const speseMgr = new SpeseManager();
const logisticaMgr = new LogisticaManager();
const saluteMgr = new SaluteManager();
const vacanzeMgr = new VacanzeManager();
const festivitaManager = new FestivitaManager();
const spesaTaglieMgr = new SpesaTaglieManager();
const documentiMgr = new DocumentiManager();

let notes = {};
let activeDateKeyForNote = null;
let activeDateKeyForLogistica = null;
let currentView = 'grid'; 
let currentDate = new Date();
let deferredPrompt = null;

// -------------------------------------------------------------
// HELPER PER DETERMINARE IL GENITORE DEL GIORNO 
// (Priorità: Vacanze -> Festività Alternate -> Turni/Cambi)
// -------------------------------------------------------------
function getParentForDateWithVacanze(date) {
  const dateKey = turniMgr.formatDateKey(date);

  // 1. Priorità Massima: Vacanze
  if (vacanzeMgr && vacanzeMgr.vacanze) {
    const vacanzaMatch = vacanzeMgr.vacanze.find(v => dateKey >= v.dataInizio && dateKey <= v.dataFine);
    if (vacanzaMatch) {
      return { 
        parent: vacanzaMatch.assegnatoA, 
        isOverride: false, 
        isVacanza: true, 
        isFestivita: false,
        titoloVacanza: vacanzaMatch.titolo 
      };
    }
  }

  // 2. Seconda Priorità: Festività Alternate Pluriannuali
  const festivita = festivitaManager.getFestivitaForDate(date);
  if (festivita && festivita.isFestivita) {
    return {
      parent: festivita.parent,
      isOverride: false,
      isVacanza: false,
      isFestivita: true,
      nomeFestivita: festivita.nome
    };
  }

  // 3. Turni e Cambi gestiti direttamente da TurniManager
  const status = turniMgr.getParentForDate(date);
  return {
    parent: status.parent,
    isOverride: status.isOverride,
    isVacanza: false,
    isFestivita: false
  };
}

// Esponi per il debug
window.getParentForDateWithVacanze = getParentForDateWithVacanze;

// -------------------------------------------------------------
// LOGICA INSTALLAZIONE PWA
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('btnInstall');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                    || window.navigator.standalone 
                    || document.referrer.includes('android-app://');

  if (isStandalone && installBtn) {
    installBtn.style.display = 'none';
  }
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('btnInstall');
  if (installBtn) installBtn.style.display = 'inline-flex';
});

window.installPWA = async function() {
  if (!deferredPrompt) {
    alert("⚠️ L'installazione PWA non è al momento disponibile o l'app è già installata.");
    return;
  }
  try {
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
  } catch (err) {
    console.error('Errore durante l\'installazione PWA:', err);
  } finally {
    deferredPrompt = null;
    const installBtn = document.getElementById('btnInstall');
    if (installBtn) installBtn.style.display = 'none';
  }
};

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installBtn = document.getElementById('btnInstall');
  if (installBtn) installBtn.style.display = 'none';
});

// 3. Funzione di rendering per l'interfaccia documenti
function renderDocumenti() {
  const container = document.getElementById('listaDocumentiContainer');
  if (!container) return;

  const docs = documentiMgr.getData();
  container.innerHTML = '';

  if (docs.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; margin:0;">Nessun documento archiviato.</p>`;
    return;
  }

  docs.forEach(doc => {
    const isPdf = doc.fileType === 'application/pdf';
    const isExpired = doc.dataScadenza && new Date(doc.dataScadenza) < new Date();

    const div = document.createElement('div');
    div.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px dashed var(--surface-border); font-size: 0.85rem; gap: 10px;`;

    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <span style="font-size: 1.5rem;">${isPdf ? '📄' : '🖼️'}</span>
        <div>
          <strong>${doc.titolo}</strong> 
          <span style="font-size: 0.75rem; background: var(--surface-border); padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${doc.categoria}</span>
          ${doc.dataScadenza ? `<br><small style="color: ${isExpired ? '#dc2626' : 'var(--text-muted)'}; font-weight: ${isExpired ? 'bold' : 'normal'};">${isExpired ? '⚠️ Scaduto il: ' : '📅 Scadenza: '}${doc.dataScadenza.split('-').reverse().join('/')}</small>` : ''}
        </div>
      </div>
      
      <div style="display: flex; gap: 8px;">
        <a href="${doc.fileData}" download="${doc.fileName}" target="_blank" class="btn" style="padding: 4px 8px; font-size: 0.75rem; text-decoration: none; background: #e2e8f0; color: #1e293b; border-radius: 4px;">👁️ Apri / Scarica</a>
        <button style="background:none; border:none; cursor:pointer;" onclick="deleteDocumentoValerio('${doc.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// 4. Caricamento File (Con compressione per immagini e lettura diretta per PDF)
window.uploadDocumentoValerio = async function() {
  const titoloInput = document.getElementById('docTitolo');
  const catInput = document.getElementById('docCategoria');
  const scadenzaInput = document.getElementById('docScadenza');
  const fileInput = document.getElementById('docFile');

  const titolo = titoloInput?.value.trim();
  const categoria = catInput?.value;
  const dataScadenza = scadenzaInput?.value;
  const file = fileInput?.files[0];

  if (!titolo) {
    alert("Inserisci un titolo per il documento!");
    return;
  }
  if (!file) {
    alert("Seleziona un file da caricare!");
    return;
  }

  let fileBase64 = null;

  try {
    if (file.type.startsWith('image/')) {
      // Usa la funzione compressImage già presente in app.js (o fallback a FileReader)
      if (typeof compressImage === 'function') {
        fileBase64 = await compressImage(file);
      } else {
        fileBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      }
    } else if (file.type === 'application/pdf') {
      fileBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    } else {
      alert("Formato non supportato. Carica un'immagine o un file PDF.");
      return;
    }

    documentiMgr.addDocumento(titolo, categoria, dataScadenza, fileBase64, file.type, file.name);

    // Resetta form
    if (titoloInput) titoloInput.value = '';
    if (scadenzaInput) scadenzaInput.value = '';
    if (fileInput) fileInput.value = '';

    renderDocumenti();
    if (typeof saveDataToFirestore === 'function') saveDataToFirestore();
    alert("Documento caricato con successo!");

  } catch (err) {
    console.error("Errore caricamento documento:", err);
    alert("Si è verificato un errore durante la lettura del file.");
  }
};

window.deleteDocumentoValerio = function(id) {
  if (confirm("Sei sicuro di voler eliminare questo documento?")) {
    documentiMgr.deleteDocumento(id);
    renderDocumenti();
    if (typeof saveDataToFirestore === 'function') saveDataToFirestore();
  }
};

// 3. Funzione di rendering da chiamare quando si aggiornano i dati
function renderSpesaTaglie() {
  const data = spesaTaglieMgr.getData();

  // Popola i campi delle taglie
  const tScarpe = document.getElementById('tagliaScarpe');
  const tMagliette = document.getElementById('tagliaMagliette');
  const tPantaloni = document.getElementById('tagliaPantaloni');
  const tIntimo = document.getElementById('tagliaIntimo');

  if (tScarpe) tScarpe.value = data.taglie.scarpe || '';
  if (tMagliette) tMagliette.value = data.taglie.magliette || '';
  if (tPantaloni) tPantaloni.value = data.taglie.pantaloni || '';
  if (tIntimo) tIntimo.value = data.taglie.intimo || '';

  // Popola la lista della spesa
  const container = document.getElementById('listaSpesaContainer');
  if (!container) return;

  container.innerHTML = '';
  if (!data.listaSpesa || data.listaSpesa.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; margin:0;">Nessun articolo in lista.</p>`;
    return;
  }

  data.listaSpesa.forEach(item => {
    const div = document.createElement('div');
    div.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--surface-border); font-size: 0.85rem; ${item.comprato ? 'opacity: 0.55;' : ''}`;

    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
        <input type="checkbox" ${item.comprato ? 'checked' : ''} onchange="toggleArticoloSpesa('${item.id}')" style="cursor: pointer; width: 16px; height: 16px;">
        <span style="${item.comprato ? 'text-decoration: line-through;' : ''}">
          <strong>${item.testo}</strong> ${item.note ? `<small style="color:var(--text-muted);">(${item.note})</small>` : ''}
        </span>
      </div>
      <button style="background:none; border:none; cursor:pointer;" onclick="deleteArticoloSpesa('${item.id}')">🗑️</button>
    `;
    container.appendChild(div);
  });
}

// 4. Esponi le funzioni su window per l'onclick dell'HTML
window.saveTaglieValerio = function() {
  const scarpe = document.getElementById('tagliaScarpe')?.value || '';
  const magliette = document.getElementById('tagliaMagliette')?.value || '';
  const pantaloni = document.getElementById('tagliaPantaloni')?.value || '';
  const intimo = document.getElementById('tagliaIntimo')?.value || '';

  spesaTaglieMgr.updateTaglie(scarpe, magliette, pantaloni, intimo);
  if (typeof saveDataToFirestore === 'function') saveDataToFirestore();
  alert("Taglie aggiornate con successo!");
};

window.addArticoloSpesa = function() {
  const inputTesto = document.getElementById('nuovoArticoloSpesa');
  const inputNote = document.getElementById('noteArticoloSpesa');
  const testo = inputTesto?.value.trim();
  const note = inputNote?.value.trim();

  if (!testo) {
    alert("Inserisci il nome dell'articolo da comprare!");
    return;
  }

  spesaTaglieMgr.addItemSpesa(testo, note);
  if (inputTesto) inputTesto.value = '';
  if (inputNote) inputNote.value = '';

  renderSpesaTaglie();
  if (typeof saveDataToFirestore === 'function') saveDataToFirestore();
};

window.toggleArticoloSpesa = function(id) {
  spesaTaglieMgr.toggleItemSpesa(id);
  renderSpesaTaglie();
  if (typeof saveDataToFirestore === 'function') saveDataToFirestore();
};

window.deleteArticoloSpesa = function(id) {
  spesaTaglieMgr.deleteItemSpesa(id);
  renderSpesaTaglie();
  if (typeof saveDataToFirestore === 'function') saveDataToFirestore();
};

// -------------------------------------------------------------
// CONTROLLI TEMA & VISTA
// -------------------------------------------------------------
window.toggleDarkMode = function() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const themeBtn = document.getElementById('themeToggleBtn');
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    if (themeBtn) themeBtn.textContent = '🌙 Scuro';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    if (themeBtn) themeBtn.textContent = '☀️ Chiaro';
  }
};

window.switchView = function(view) {
  currentView = view;
  const btnGrid = document.getElementById('btnViewGrid');
  const btnList = document.getElementById('btnViewList');
  if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
  if (btnList) btnList.classList.toggle('active', view === 'list');
  
  const gridEl = document.getElementById('calendarGrid');
  const listEl = document.getElementById('calendarList');
  if (gridEl) gridEl.style.display = view === 'grid' ? 'grid' : 'none';
  if (listEl) listEl.style.display = view === 'list' ? 'flex' : 'none';
  render();
};

window.onDateSelectChange = function() {
  const m = parseInt(document.getElementById('monthSelect').value);
  const y = parseInt(document.getElementById('yearSelect').value);
  currentDate = new Date(y, m, 1);
  updateFilterDatesForCurrentMonth();
  render();
};

window.changeMonth = function(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  updateFilterDatesForCurrentMonth();
  render();
};

window.resetOverrides = async function() {
  if (confirm("Vuoi cancellare tutti i dati salvati (cambi, spese, vacanze, note, salute, festività)?")) {
    turniMgr.setData({}, {});
    notes = {};
    speseMgr.setSpese([]);
    logisticaMgr.setPassaggi({});
    saluteMgr.setSchede({});
    vacanzeMgr.setVacanze([]);
    festivitaManager.setCustomRules({});
    await saveDataToFirestore();
    render();
    alert("Tutti i dati sono stati ripristinati!");
  }
};

// -------------------------------------------------------------
// SINCRONIZZAZIONE FIRESTORE & CACHE LOCALE (OFFLINE RESILIENCE)
// -------------------------------------------------------------
function applyLoadedData(data) {
  if (!data) return;
  turniMgr.setData(data.data || {}, data.manualCambi || {});
  notes = data.notes || {};
  speseMgr.setSpese(data.spese || []);
  logisticaMgr.setPassaggi(data.passaggi || {});
  saluteMgr.setSchede(data.salute || {});
  vacanzeMgr.setVacanze(data.vacanze || []);
  if (data.festivitaRules) {
    festivitaManager.setCustomRules(data.festivitaRules);
  }
  spesaTaglieMgr.loadData(data.spesaTaglie || {});
  documentiMgr.loadData(data.documenti || []);
}

// Carica subito da cache locale per avvio immediato
try {
  const cached = localStorage.getItem('valerio_data_cache');
  if (cached) {
    applyLoadedData(JSON.parse(cached));
  }
} catch (e) {
  console.warn("Errore lettura cache locale:", e);
}

try {
  onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      applyLoadedData(data);
      try {
        localStorage.setItem('valerio_data_cache', JSON.stringify(data));
      } catch (e) {
        console.warn("Errore salvataggio cache locale:", e);
      }
    } else {
      turniMgr.setData({}, {});
      notes = {};
      speseMgr.setSpese([]);
      logisticaMgr.setPassaggi({});
      saluteMgr.setSchede({});
      vacanzeMgr.setVacanze([]);
      festivitaManager.setCustomRules({});
      spesaTaglieMgr.loadData({});
      documentiMgr.loadData([]);
    }

    // Aggiorna l'interfaccia (inclusi renderSpesaTaglie e renderDocumenti via render())
    render();
  }, (err) => {
    console.warn("Avviso Firestore (connessione offline o permessi non attivi, utilizzo dati locali):", err);
  });
} catch (err) {
  console.warn("Inizializzazione listener Firestore non riuscita, modalità offline attiva:", err);
}

async function saveDataToFirestore() {
  const currentData = { 
    data: turniMgr.overrides, 
    notes: notes, 
    manualCambi: turniMgr.manualCambi,
    spese: speseMgr.spese,
    passaggi: logisticaMgr.passaggi,
    salute: saluteMgr.schede,
    vacanze: vacanzeMgr.vacanze,
    festivitaRules: festivitaManager.toJSON(),
    spesaTaglie: spesaTaglieMgr.getData(),
    documenti: documentiMgr.getData() 
  };

  try {
    localStorage.setItem('valerio_data_cache', JSON.stringify(currentData));
  } catch (e) {
    console.warn("Errore cache locale:", e);
  }

  try {
    await setDoc(docRef, currentData);
  } catch (error) {
    console.error("Errore salvataggio Firestore:", error);
  }
}

// -------------------------------------------------------------
// GESTIONE FESTIVITÀ ALTERNATE
// -------------------------------------------------------------
function renderFestivitaSettings() {
  const container = document.getElementById('festivitaRulesContainer');
  if (!container) return;

  container.innerHTML = '';
  const rulesKeys = ['natale', 'capodanno', 'epifania', 'pasqua', 'compleanno_valerio', 'ferragosto'];

  rulesKeys.forEach(key => {
    const rule = festivitaManager.getRule(key);
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label style="font-weight:600; font-size:0.85rem;">${rule.nome}</label>
      <select id="festivita_${key}" style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--surface-border); background:var(--surface-bg); color:var(--text-color);">
        <option value="papa" ${rule.pari === 'papa' ? 'selected' : ''}>Anni Pari: Papà | Anni Dispari: Mamma</option>
        <option value="mamma" ${rule.pari === 'mamma' ? 'selected' : ''}>Anni Pari: Mamma | Anni Dispari: Papà</option>
      </select>
    `;
    container.appendChild(div);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btnSaveFestivita = document.getElementById('btnSaveFestivita');
  if (btnSaveFestivita) {
    btnSaveFestivita.addEventListener('click', async () => {
      const rulesKeys = ['natale', 'capodanno', 'epifania', 'pasqua', 'compleanno_valerio', 'ferragosto'];
      
      rulesKeys.forEach(key => {
        const select = document.getElementById(`festivita_${key}`);
        if (select) {
          festivitaManager.updateRule(key, select.value);
        }
      });

      await saveDataToFirestore();
      render();
      alert('🎉 Regole festività salvate con successo!');
    });
  }
});

// -------------------------------------------------------------
// GESTIONE LOGISTICA & PASSAGGI
// -------------------------------------------------------------
window.openLogisticaModal = function(dateKey, event) {
  if (event) event.stopPropagation();
  activeDateKeyForLogistica = dateKey;

  const data = logisticaMgr.getPassaggio(dateKey);
  document.getElementById('logisticaModalTitle').textContent = `🚗 Passaggio del ${dateKey.split('-').reverse().join('/')}`;
  document.getElementById('logisticaLuogo').value = data.luogo || '';
  document.getElementById('logisticaOra').value = data.ora || '';
  document.getElementById('logisticaNote').value = data.note || '';

  const chk = data.checklist || {};
  document.getElementById('checkVestiti').checked = !!chk.vestiti;
  document.getElementById('checkCartella').checked = !!chk.cartella;
  document.getElementById('checkLibretto').checked = !!chk.libretto;
  document.getElementById('checkGiochi').checked = !!chk.giochi;

  document.getElementById('logisticaModal').classList.add('active');
};

window.closeLogisticaModal = function() {
  document.getElementById('logisticaModal').classList.remove('active');
  activeDateKeyForLogistica = null;
};

window.saveLogistica = function() {
  if (!activeDateKeyForLogistica) return;

  const luogo = document.getElementById('logisticaLuogo').value;
  const ora = document.getElementById('logisticaOra').value;
  const note = document.getElementById('logisticaNote').value;

  const checklist = {
    vestiti: document.getElementById('checkVestiti').checked,
    cartella: document.getElementById('checkCartella').checked,
    libretto: document.getElementById('checkLibretto').checked,
    giochi: document.getElementById('checkGiochi').checked
  };

  logisticaMgr.savePassaggio(activeDateKeyForLogistica, luogo, ora, note, checklist);
  saveDataToFirestore();
  window.closeLogisticaModal();
};

// -------------------------------------------------------------
// GESTIONE VACANZE
// -------------------------------------------------------------
window.openVacanzeModal = function() {
  document.getElementById('vacanzaTitolo').value = '';
  document.getElementById('vacanzaInizio').value = '';
  document.getElementById('vacanzaFine').value = '';
  document.getElementById('vacanzeModal').classList.add('active');
};

window.closeVacanzeModal = function() {
  document.getElementById('vacanzeModal').classList.remove('active');
};

window.saveVacanzaBlock = function() {
  const titolo = document.getElementById('vacanzaTitolo').value.trim();
  const inizio = document.getElementById('vacanzaInizio').value;
  const fine = document.getElementById('vacanzaFine').value;
  const assegnato = document.getElementById('vacanzaAssegnato').value;

  if (!titolo || !inizio || !fine) {
    alert("Compila tutti i campi obbligatori per la vacanza!");
    return;
  }

  if (inizio > fine) {
    alert("La data di inizio non può essere successiva alla data di fine!");
    return;
  }

  vacanzeMgr.addVacanzeBlock(titolo, inizio, fine, assegnato);
  saveDataToFirestore();
  window.closeVacanzeModal();
};

window.deleteVacanzaBlock = function(id) {
  if (confirm("Eliminare questo blocco vacanza?")) {
    vacanzeMgr.deleteVacanzeBlock(id);
    saveDataToFirestore();
  }
};

function renderVacanze() {
  const container = document.getElementById('vacanzeListContainer');
  if (!container) return;
  container.innerHTML = '';

  if (vacanzeMgr.vacanze.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Nessuna vacanza o festività programmata.</p>`;
    return;
  }

  vacanzeMgr.vacanze.forEach(v => {
    const card = document.createElement('div');
    const color = v.assegnatoA === 'papa' ? 'var(--papa-color, #2563eb)' : 'var(--mamma-color, #ec4899)';
    card.style.cssText = `background: var(--surface-bg, #f8fafc); border-left: 4px solid ${color}; padding: 10px; border-radius: 6px; border: 1px solid var(--surface-border); display: flex; justify-content: space-between; align-items: center;`;

    const dInizio = v.dataInizio.split('-').reverse().join('/');
    const dFine = v.dataFine.split('-').reverse().join('/');

    card.innerHTML = `
      <div>
        <strong style="display:block; font-size:0.95rem;">🏖️ ${v.titolo}</strong>
        <span style="font-size:0.8rem; color:var(--text-muted);">${dInizio} - ${dFine}</span>
        <span style="font-size:0.75rem; font-weight:700; color:${color}; display:block; margin-top:2px;">Con ${v.assegnatoA === 'papa' ? 'Papà' : 'Mamma'}</span>
      </div>
      <button style="background:none; border:none; cursor:pointer; font-size:1.1rem;" onclick="deleteVacanzaBlock('${v.id}')">🗑️</button>
    `;
    container.appendChild(card);
  });
}

// -------------------------------------------------------------
// GESTIONE SALUTE & TERAPIE
// -------------------------------------------------------------
window.addFarmaco = function() {
  const nomeInput = document.getElementById('farmacoNome');
  const orarioInput = document.getElementById('farmacoOrario');
  const noteInput = document.getElementById('farmacoNote');

  const nome = nomeInput ? nomeInput.value.trim() : '';
  const orario = orarioInput ? orarioInput.value : '';
  const note = noteInput ? noteInput.value.trim() : '';

  if (!nome) {
    alert("Inserisci il nome del farmaco!");
    return;
  }

  saluteMgr.addFarmaco(nome, orario, note);
  saveDataToFirestore();

  if (nomeInput) nomeInput.value = '';
  if (orarioInput) orarioInput.value = '';
  if (noteInput) noteInput.value = '';
};

window.toggleFarmacoAssunto = function(id) {
  saluteMgr.toggleFarmaco(id);
  saveDataToFirestore();
};

window.deleteFarmaco = function(id) {
  saluteMgr.deleteFarmaco(id);
  saveDataToFirestore();
};

window.addContattoUtile = function() {
  const nomeInput = document.getElementById('contattoNome');
  const ruoloInput = document.getElementById('contattoRuolo');
  const telInput = document.getElementById('contattoTel');

  const nome = nomeInput ? nomeInput.value.trim() : '';
  const ruolo = ruoloInput ? ruoloInput.value.trim() : '';
  const tel = telInput ? telInput.value.trim() : '';

  if (!nome || !tel) {
    alert("Inserisci almeno il nome ed il numero di telefono!");
    return;
  }

  saluteMgr.addContatto(nome, ruolo, tel);
  saveDataToFirestore();

  if (nomeInput) nomeInput.value = '';
  if (ruoloInput) ruoloInput.value = '';
  if (telInput) telInput.value = '';
};

window.deleteContattoUtile = function(id) {
  saluteMgr.deleteContatto(id);
  saveDataToFirestore();
};

window.saveSaluteInfo = function() {
  const nome = document.getElementById('salutePediatraNome')?.value || '';
  const tel = document.getElementById('salutePediatraTel')?.value || '';
  const via = document.getElementById('salutePediatraVia')?.value || '';
  const orari = document.getElementById('salutePediatraOrari')?.value || '';
  const allergie = document.getElementById('saluteAllergie')?.value || '';

  saluteMgr.updatePediatra(nome, tel, via, orari);
  saluteMgr.updateInfoGenerali('', allergie, '');

  saveDataToFirestore();
  alert("Scheda medica aggiornata!");
};

window.addVisitaMedica = function() {
  const data = document.getElementById('visitaData')?.value;
  const desc = document.getElementById('visitaDesc')?.value.trim();

  if (!data || !desc) {
    alert("Inserisci data e descrizione della visita!");
    return;
  }

  saluteMgr.addVisita(data, desc, '');
  saveDataToFirestore();
  if (document.getElementById('visitaDesc')) document.getElementById('visitaDesc').value = '';
};

window.deleteVisitaMedica = function(id) {
  saluteMgr.deleteVisita(id);
  saveDataToFirestore();
};

function renderSalute() {
  const farmaciList = document.getElementById('saluteFarmaciList');
  if (farmaciList) {
    farmaciList.innerHTML = '';
    const farmaci = saluteMgr.schede.farmaci || [];
    if (farmaci.length === 0) {
      farmaciList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; margin: 5px 0 0 0;">Nessun farmaco in programma per oggi.</p>`;
    } else {
      farmaci.forEach(f => {
        const div = document.createElement('div');
        div.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--surface-border); font-size: 0.85rem; ${f.assunto ? 'opacity: 0.6;' : ''}`;
        
        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" ${f.assunto ? 'checked' : ''} onchange="toggleFarmacoAssunto('${f.id}')" style="cursor: pointer;">
            <span style="${f.assunto ? 'text-decoration: line-through;' : ''}">
              <strong>${f.orario ? f.orario + ' - ' : ''}${f.nome}</strong> ${f.note ? `(${f.note})` : ''}
            </span>
          </div>
          <button style="background:none; border:none; cursor:pointer;" onclick="deleteFarmaco('${f.id}')">🗑️</button>
        `;
        farmaciList.appendChild(div);
      });
    }
  }

  const contattiList = document.getElementById('saluteContattiList');
  if (contattiList) {
    contattiList.innerHTML = '';
    const contatti = saluteMgr.schede.contatti || [];
    if (contatti.length === 0) {
      contattiList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; margin: 5px 0 0 0;">Nessun contatto registrato.</p>`;
    } else {
      contatti.forEach(c => {
        const div = document.createElement('div');
        div.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--surface-border); font-size: 0.85rem;`;
        
        div.innerHTML = `
          <div>
            <strong>${c.nome}</strong> ${c.ruolo ? `(${c.ruolo})` : ''}: 
            <a href="tel:${c.telefono}" style="color: var(--primary-color, #2563eb); font-weight: 600; text-decoration: none;">📞 ${c.telefono}</a>
          </div>
          <button style="background:none; border:none; cursor:pointer;" onclick="deleteContattoUtile('${c.id}')">🗑️</button>
        `;
        contattiList.appendChild(div);
      });
    }
  }

  const p = saluteMgr.schede.pediatra || {};
  const g = saluteMgr.schede.infoGenerali || {};

  const pNome = document.getElementById('salutePediatraNome');
  const pTel = document.getElementById('salutePediatraTel');
  const pVia = document.getElementById('salutePediatraVia');
  const pOrari = document.getElementById('salutePediatraOrari');
  const gAllergie = document.getElementById('saluteAllergie');

  if (pNome) pNome.value = p.nome || '';
  if (pTel) pTel.value = p.telefono || '';
  if (pVia) pVia.value = p.via || '';
  if (pOrari) pOrari.value = p.orari || '';
  if (gAllergie) gAllergie.value = g.allergie || '';

  const list = document.getElementById('saluteVisiteList');
  if (list) {
    list.innerHTML = '';
    const visite = saluteMgr.schede.visite || [];
    if (visite.length === 0) {
      list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; margin: 5px 0 0 0;">Nessuna visita programmata.</p>`;
    } else {
      visite.forEach(v => {
        const li = document.createElement('li');
        li.style.cssText = "display: flex; justify-content: space-between; align-items:center; padding: 5px 0; border-bottom: 1px dashed var(--surface-border); font-size: 0.85rem;";
        li.innerHTML = `
          <span><strong>${v.data.split('-').reverse().join('/')}:</strong> ${v.descrizione}</span>
          <button style="background:none; border:none; cursor:pointer;" onclick="deleteVisitaMedica('${v.id}')">🗑️</button>
        `;
        list.appendChild(li);
      });
    }
  }
}

// -------------------------------------------------------------
// GESTIONE NOTE & MODALI
// -------------------------------------------------------------
window.toggleDayOverride = function(dateKey) {
  turniMgr.toggleDay(dateKey);
  saveDataToFirestore();
  render();
};

window.openNoteModal = function(dateKey, event) {
  if (event) event.stopPropagation();
  activeDateKeyForNote = dateKey;
  
  const modal = document.getElementById('noteModal');
  const modalTitle = document.getElementById('modalDateTitle');
  const input = document.getElementById('noteTextInput');
  const categorySelect = document.getElementById('noteCategory');
  const btnDelete = document.getElementById('btnDeleteNote');
  const checkIsCambio = document.getElementById('checkIsCambio');

  const [y, m, d] = dateKey.split('-');
  if (modalTitle) modalTitle.textContent = `Nota / Evento del ${d}/${m}/${y}`;
  if (checkIsCambio) checkIsCambio.checked = !!turniMgr.manualCambi[dateKey];

  if (notes[dateKey]) {
    if (input) input.value = notes[dateKey].text || '';
    if (categorySelect) categorySelect.value = notes[dateKey].category || 'generico';
    if (btnDelete) btnDelete.style.display = 'inline-flex';
  } else {
    if (input) input.value = ''; 
    if (categorySelect) categorySelect.value = 'generico'; 
    if (btnDelete) btnDelete.style.display = 'none';
  }

  if (modal) modal.classList.add('active');
};

window.saveCurrentNote = function() {
  if (!activeDateKeyForNote) return;
  const input = document.getElementById('noteTextInput');
  const categorySelect = document.getElementById('noteCategory');
  const checkIsCambio = document.getElementById('checkIsCambio');

  const text = input ? input.value.trim() : '';
  const category = categorySelect ? categorySelect.value : 'generico';

  if (text) {
    notes[activeDateKeyForNote] = { text, category };
  } else {
    delete notes[activeDateKeyForNote];
  }

  if (checkIsCambio) {
    if (checkIsCambio.checked) {
      turniMgr.manualCambi[activeDateKeyForNote] = true;
    } else {
      delete turniMgr.manualCambi[activeDateKeyForNote];
    }
  }

  saveDataToFirestore();
  closeNoteModal();
};

window.deleteCurrentNote = function() {
  if (activeDateKeyForNote && notes[activeDateKeyForNote]) {
    delete notes[activeDateKeyForNote];
    saveDataToFirestore();
  }
  closeNoteModal();
};

window.closeNoteModal = function() {
  const modal = document.getElementById('noteModal');
  if (modal) modal.classList.remove('active');
  activeDateKeyForNote = null;
};

// -------------------------------------------------------------
// SPESE
// -------------------------------------------------------------

window.openSpesaModal = function() {
  const modal = document.getElementById('spesaModal');
  if (!modal) return;

  // Reset dei campi di input
  document.getElementById('spesaDesc').value = '';
  document.getElementById('spesaImporto').value = '';
  document.getElementById('spesaData').value = new Date().toISOString().split('T')[0];
  document.getElementById('spesaRicevutaInput').value = '';
  
  // Reset selettori di opzione
  const modalitaSelect = document.getElementById('spesaModalita');
  if (modalitaSelect) modalitaSelect.value = 'intero';

  modal.classList.add('active');
};

window.closeSpesaModal = function() {
  const modal = document.getElementById('spesaModal');
  if (modal) modal.classList.remove('active');
};

function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
}

window.saveSpesa = async function() {
  const desc = document.getElementById('spesaDesc').value.trim();
  const importo = document.getElementById('spesaImporto').value;
  const pagatoDa = document.getElementById('spesaPagatoDa').value;
  const categoria = document.getElementById('spesaCategoria').value;
  const data = document.getElementById('spesaData').value;
  const fileInput = document.getElementById('spesaRicevutaInput');
  const modalita = document.getElementById('spesaModalita')?.value || 'intero';

  if (!desc || !importo || isNaN(importo) || parseFloat(importo) <= 0) {
    alert("Inserisci una descrizione e un importo valido!");
    return;
  }

  let ricevutaBase64 = null;
  const file = fileInput.files[0];
  if (file) {
    try {
      ricevutaBase64 = await compressImage(file);
    } catch (err) {
      console.error("Errore durante la compressione dell'immagine:", err);
    }
  }

  speseMgr.addSpesa(desc, importo, pagatoDa, categoria, ricevutaBase64, data, modalita);
  await saveDataToFirestore();
  
  // Aggiorna subito l'interfaccia prima di chiudere la modale
  renderSpeseSummary(); 
  window.closeSpesaModal();
};

window.deleteSpesa = async function(id) {
  if (confirm("Sei sicuro di voler eliminare questa spesa?")) {
    speseMgr.deleteSpesa(id);
    await saveDataToFirestore();
    renderSpeseSummary(); // <-- AGGIUNTO: Aggiorna la tabella e il saldo dopo l'eliminazione
  }
};

window.viewRicevuta = function(id) {
  const spesa = speseMgr.spese.find(s => s.id === id);
  if (spesa && spesa.ricevuta) {
    const modal = document.getElementById('ricevutaModal');
    const img = document.getElementById('ricevutaModalImg');
    const title = document.getElementById('ricevutaModalTitle');
    if (modal && img) {
      img.src = spesa.ricevuta;
      if (title) title.textContent = `🧾 Ricevuta: ${spesa.descrizione}`;
      modal.classList.add('active');
      return;
    }
  }
};

window.closeRicevutaModal = function() {
  const modal = document.getElementById('ricevutaModal');
  if (modal) modal.classList.remove('active');
};

function renderSpeseSummary() {
  const saldoBox = document.getElementById('speseSaldoInfo');
  const tbody = document.getElementById('speseTableBody');
  if (!saldoBox || !tbody) return;

  const saldo = speseMgr.calculateSaldo();
  if (!saldo.debitore) {
    saldoBox.innerHTML = "<strong>Conti in pari</strong> (nessun conguaglio pendente)";
  } else {
    const debitoreStr = saldo.debitore === 'mamma' ? 'Mamma' : 'Papà';
    const creditoreStr = saldo.creditore === 'papa' ? 'Papà' : 'Mamma';
    saldoBox.innerHTML = `<strong>${debitoreStr}</strong> deve a <strong>${creditoreStr}</strong>: <span style="color:var(--spesa-color, #ef4444); font-weight:800;">€ ${saldo.importo.toFixed(2)}</span>`;
  }

  tbody.innerHTML = '';
  if (speseMgr.spese.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 12px; color: var(--text-muted);">Nessuna spesa registrata.</td></tr>`;
    return;
  }

  const speseOrdinate = [...speseMgr.spese].sort((a, b) => new Date(b.data) - new Date(a.data));

  speseOrdinate.forEach(spesa => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--surface-border)';

    const formattedDate = spesa.data.split('-').reverse().join('/');
    const pagatoStr = spesa.pagatoDa === 'papa' ? 'Papà' : 'Mamma';
    const badgeColor = spesa.pagatoDa === 'papa' ? 'var(--papa-color, #2563eb)' : 'var(--mamma-color, #ec4899)';

    const modalitaStr = spesa.modalita === 'quota_propria'
      ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">50% Quota</span>`
      : `<span style="background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">100% Intero</span>`;

    const ricevutaBtn = spesa.ricevuta 
      ? `<button class="btn" style="padding: 2px 8px; font-size: 0.75rem;" onclick="viewRicevuta('${spesa.id}')">📎 Vedi</button>` 
      : `<span style="color:var(--text-muted); font-size: 0.75rem;">-</span>`;

    tr.innerHTML = `
      <td style="padding: 8px;">${formattedDate}</td>
      <td style="padding: 8px; font-weight:600;">${spesa.descrizione}</td>
      <td style="padding: 8px;"><span class="event-badge ${spesa.categoria}">${spesa.categoria.toUpperCase()}</span></td>
      <td style="padding: 8px; font-weight:700; color: ${badgeColor};">${pagatoStr}</td>
      <td style="padding: 8px;">${modalitaStr}</td>
      <td style="padding: 8px; font-weight:800;">€ ${parseFloat(spesa.importo).toFixed(2)}</td>
      <td style="padding: 8px;">${ricevutaBtn}</td>
      <td style="padding: 8px; text-align: center;">
        <button style="background:none; border:none; cursor:pointer;" onclick="deleteSpesa('${spesa.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// ESPORTAZIONE & STATISTICHE
// -------------------------------------------------------------
window.exportToExcel = function() {
  ExportManager.exportToExcel(currentDate, (d) => getParentForDateWithVacanze(d), notes);
};

window.exportToICal = function() {
  ExportManager.generateICalendar(currentDate, (d) => getParentForDateWithVacanze(d), notes);
};

window.calculateStats = function() {
  const startInput = document.getElementById('filterStartDate');
  const endInput = document.getElementById('filterEndDate');
  if (!startInput || !endInput || !startInput.value || !endInput.value) return;

  const startDate = new Date(startInput.value + 'T00:00:00');
  const endDate = new Date(endInput.value + 'T00:00:00');
  if (startDate > endDate) return;

  let countPapa = 0, countMamma = 0, countUndefined = 0;
  let curr = new Date(startDate);

  while (curr <= endDate) {
    const status = getParentForDateWithVacanze(curr);
    if (status?.parent === 'papa') countPapa++;
    else if (status?.parent === 'mamma') countMamma++;
    else countUndefined++;
    curr.setDate(curr.getDate() + 1);
  }

  const elPapa = document.getElementById('countPapa');
  const elMamma = document.getElementById('countMamma');
  const elUndef = document.getElementById('countUndefined');

  if (elPapa) elPapa.textContent = `${countPapa} giorni`;
  if (elMamma) elMamma.textContent = `${countMamma} giorni`;
  if (elUndef) elUndef.textContent = `${countUndefined} giorni`;
};

function updateFilterDatesForCurrentMonth() {
  const startInput = document.getElementById('filterStartDate');
  const endInput = document.getElementById('filterEndDate');
  if (!startInput || !endInput) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDayObj = new Date(year, month + 1, 0);
  const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

  startInput.value = firstDay;
  endInput.value = lastDay;
}

function setupDateSelectors() {
  const monthSelect = document.getElementById('monthSelect');
  const yearSelect = document.getElementById('yearSelect');
  if (!monthSelect || !yearSelect) return;

  monthSelect.innerHTML = '';
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  monthNames.forEach((m, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = m;
    if (idx === currentDate.getMonth()) opt.selected = true;
    monthSelect.appendChild(opt);
  });

  yearSelect.innerHTML = '';
  const currentYear = currentDate.getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 3; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    yearSelect.appendChild(opt);
  }
}

// -------------------------------------------------------------
// RENDERING UI
// -------------------------------------------------------------
function render() {
  setupDateSelectors();
  const startInput = document.getElementById('filterStartDate');
  if (startInput && !startInput.value) updateFilterDatesForCurrentMonth();

  if (currentView === 'grid') renderGrid();
  else renderList();

  renderSpeseSummary();
  renderVacanze();
  renderSalute();
  renderFestivitaSettings();
  renderSpesaTaglie(); 
  renderDocumenti();
  window.calculateStats();
}

function renderGrid() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const headers = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  headers.forEach(h => {
    const div = document.createElement('div');
    div.className = 'day-header';
    div.textContent = h;
    grid.appendChild(div);
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startingDay = firstDay.getDay() - 1;
  if (startingDay === -1) startingDay = 6;

  for (let i = 0; i < startingDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell other-month';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateKey = turniMgr.formatDateKey(date);
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    
    const cellTop = document.createElement('div');
    cellTop.className = 'cell-top';

    const dayNumber = document.createElement('span');
    dayNumber.textContent = day;
    cellTop.appendChild(dayNumber);

    const actionBtns = document.createElement('div');
    actionBtns.style.display = 'flex';
    actionBtns.style.gap = '2px';

    const passaggioData = logisticaMgr.getPassaggio(dateKey);
    const hasLogistica = passaggioData.luogo || passaggioData.ora;
    const logisticaBtn = document.createElement('button');
    logisticaBtn.className = `btn-note-trigger ${hasLogistica ? 'has-note' : ''}`;
    logisticaBtn.innerHTML = '🚗';
    logisticaBtn.onclick = (e) => window.openLogisticaModal(dateKey, e);
    actionBtns.appendChild(logisticaBtn);

    const noteBtn = document.createElement('button');
    const hasNote = !!notes[dateKey];
    noteBtn.className = `btn-note-trigger ${hasNote ? 'has-note' : ''}`;
    noteBtn.innerHTML = hasNote ? '📝' : '➕';
    noteBtn.onclick = (e) => window.openNoteModal(dateKey, e);
    actionBtns.appendChild(noteBtn);

    cellTop.appendChild(actionBtns);
    cell.appendChild(cellTop);

    if (notes[dateKey]) {
      const eventBadge = document.createElement('div');
      const categoryClass = notes[dateKey].category || 'generico';
      eventBadge.className = `event-badge ${categoryClass}`;
      eventBadge.textContent = notes[dateKey].text;
      cell.appendChild(eventBadge);
    }

    const status = getParentForDateWithVacanze(date);
    if (status && status.parent) {
      const badge = document.createElement('div');
      badge.className = `badge ${status.parent}`;
      let label = status.parent === 'papa' ? 'Papà' : 'Mamma';
      
      if (status.isVacanza) {
        badge.innerHTML = `<span>${label} 🏖️</span>`;
      } else if (status.isFestivita) {
        badge.classList.add('festivita');
        badge.innerHTML = `<span>${label} 🎄</span><span class="badge-changed" style="font-size:0.65rem;">${status.nomeFestivita}</span>`;
      } else if (status.isOverride) {
        badge.innerHTML = `<span>${label}</span><span class="badge-changed">Cambio</span>`;
      } else {
        badge.innerHTML = `<span>${label}</span>`;
      }
      
      cell.appendChild(badge);
    }

    cell.onclick = () => window.toggleDayOverride(dateKey);
    grid.appendChild(cell);
  }
}

function renderList() {
  const list = document.getElementById('calendarList');
  if (!list) return;
  list.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    const dateKey = turniMgr.formatDateKey(date);
    const item = document.createElement('div');
    item.className = 'list-item';

    const left = document.createElement('div');
    left.className = 'list-item-left';

    const dateTitle = document.createElement('div');
    dateTitle.className = 'list-item-date';
    dateTitle.textContent = `${daysOfWeek[date.getDay()]} ${day}`;
    left.appendChild(dateTitle);

    if (notes[dateKey]) {
      const eventBadge = document.createElement('div');
      const categoryClass = notes[dateKey].category || 'generico';
      eventBadge.className = `event-badge ${categoryClass}`;
      eventBadge.textContent = notes[dateKey].text;
      left.appendChild(eventBadge);
    }

    const right = document.createElement('div');
    right.className = 'list-item-right';

    const status = getParentForDateWithVacanze(date);
    if (status && status.parent) {
      const badge = document.createElement('div');
      badge.className = `badge ${status.parent}`;
      let label = status.parent === 'papa' ? 'Papà' : 'Mamma';
      
      if (status.isVacanza) {
        badge.innerHTML = `<span>${label} 🏖️</span>`;
      } else if (status.isFestivita) {
        badge.classList.add('festivita');
        badge.innerHTML = `<span>${label} 🎄</span><span class="badge-changed" style="font-size:0.65rem;">${status.nomeFestivita}</span>`;
      } else if (status.isOverride) {
        badge.innerHTML = `<span>${label}</span><span class="badge-changed">Cambio</span>`;
      } else {
        badge.innerHTML = `<span>${label}</span>`;
      }
      right.appendChild(badge);
    }

    const logisticaBtn = document.createElement('button');
    logisticaBtn.className = 'btn-note-trigger';
    logisticaBtn.innerHTML = '🚗';
    logisticaBtn.onclick = (e) => window.openLogisticaModal(dateKey, e);
    right.appendChild(logisticaBtn);

    const noteBtn = document.createElement('button');
    const hasNote = !!notes[dateKey];
    noteBtn.className = `btn-note-trigger ${hasNote ? 'has-note' : ''}`;
    noteBtn.innerHTML = hasNote ? '📝' : '➕';
    noteBtn.onclick = (e) => window.openNoteModal(dateKey, e);
    right.appendChild(noteBtn);

    item.appendChild(left);
    item.appendChild(right);
    item.onclick = () => window.toggleDayOverride(dateKey);

    list.appendChild(item);
  }
}

// -------------------------------------------------------------
// GESTIONE IMPORTAZIONE CSV
// -------------------------------------------------------------
window.importFromCSV = async function(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  try {
    const parsed = await ExportManager.importFromCSV(file);
    const dateCount = Object.keys(parsed.overrides).length;

    if (dateCount === 0 && Object.keys(parsed.notes).length === 0) {
      alert("Nessun dato valido trovato nel file CSV selezionato.");
      return;
    }

    Object.assign(turniMgr.overrides, parsed.overrides);
    Object.assign(turniMgr.manualCambi, parsed.manualCambi);
    Object.assign(notes, parsed.notes);

    await saveDataToFirestore();
    render();
    alert(`File CSV importato con successo! Aggiornati ${dateCount} turni.`);
  } catch (err) {
    console.error("Errore durante l'importazione CSV:", err);
    alert("Si è verificato un errore durante la lettura del file CSV.");
  } finally {
    if (event.target) event.target.value = '';
  }
};

// Chiusura comoda delle modali con tasto ESC o clic all'esterno
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Avvio applicazione
render();
