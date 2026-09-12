export class VacanzeManager {
  constructor() {
    this.vacanze = [];
  }

  // -------------------------------------------------------------
  // CARICAMENTO & SALVATAGGIO (FIREBASE SERIE)
  // -------------------------------------------------------------
  loadData(data) {
    if (Array.isArray(data)) {
      this.vacanze = data;
    } else if (data && typeof data === 'object') {
      // Se Firestore ha salvato i dati come oggetto/mappa, convertili in Array
      this.vacanze = Object.values(data);
    } else {
      this.vacanze = [];
    }
  }

  getData() {
    return this.vacanze;
  }

  setVacanze(data) {
    this.loadData(data);
  }

  getVacanze() {
    return Array.isArray(this.vacanze) ? this.vacanze : [];
  }

  // -------------------------------------------------------------
  // METODI DI RICERCA E GESTIONE
  // -------------------------------------------------------------
  
  /**
   * Cerca se per una determinata data esiste un blocco vacanza attivo
   */
  getVacanzaForDate(date) {
    if (!Array.isArray(this.vacanze) || this.vacanze.length === 0) return null;

    let dateStr = '';
    if (typeof date === 'string') {
      dateStr = date.split('T')[0];
    } else if (date instanceof Date) {
      // Formatta la data YYYY-MM-DD usando la data locale pulita (senza interferenza orario)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    if (!dateStr) return null;

    return this.vacanze.find(v => {
      if (!v.dataInizio || !v.dataFine) return false;
      return dateStr >= v.dataInizio && dateStr <= v.dataFine;
    }) || null;
  }

  addVacanzeBlock(titolo, dataInizio, dataFine, assegnatoA) {
    const valGenitore = (assegnatoA || 'papa').toLowerCase().trim();

    const newBlock = {
      id: Date.now().toString(),
      titolo,
      dataInizio,
      dataFine,
      // Salva tutte e 3 le varianti di chiave per garantire compatibilità ovunque nel codice
      assegnatoA: valGenitore,
      parent: valGenitore,
      genitore: valGenitore
    };
    
    if (!Array.isArray(this.vacanze)) {
      this.vacanze = [];
    }
    
    this.vacanze.push(newBlock);
  }

  deleteVacanzeBlock(id) {
    if (Array.isArray(this.vacanze)) {
      this.vacanze = this.vacanze.filter(v => v.id !== id);
    }
  }

  // Alias per garantire compatibilità se app.js chiama deleteVacanza(id)
  deleteVacanza(id) {
    this.deleteVacanzeBlock(id);
  }
}
