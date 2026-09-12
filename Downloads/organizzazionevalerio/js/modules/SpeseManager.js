export class SpeseManager {
  constructor() {
    this.spese = []; 
  }

  /**
   * Inizializza o aggiorna l'elenco delle spese
   * @param {Array} speseData 
   */
  setSpese(speseData = []) {
    this.spese = Array.isArray(speseData) ? speseData : [];
  }

  /**
   * Aggiunge una nuova spesa alla lista
   * @param {string} descrizione 
   * @param {number|string} importo 
   * @param {string} pagatoDa - 'papa' | 'mamma'
   * @param {string} categoria - 'scuola' | 'salute' | 'sport' | 'altro'
   * @param {string|null} ricevutaBase64 
   * @param {Date|string} data 
   * @param {string} modalita - 'intero' (100% anticipato) | 'quota_propria' (50% saldato alla fonte)
   * @returns {Array} elenco spese aggiornato
   */
  addSpesa(
    descrizione, 
    importo, 
    pagatoDa, 
    categoria = 'scuola', 
    ricevutaBase64 = null, 
    data = new Date(), 
    modalita = 'intero'
  ) {
    const nuovaSpesa = {
      id: 'spesa_' + Date.now().toString(),
      data: typeof data === 'string' ? data : data.toISOString().split('T')[0],
      descrizione,
      importo: parseFloat(importo) || 0,
      pagatoDa,
      categoria,
      modalita,
      ricevuta: ricevutaBase64,
      approvato: true
    };

    this.spese.push(nuovaSpesa);
    return this.spese;
  }

  /**
   * Rimuove una spesa tramite il suo ID
   * @param {string} id 
   * @returns {Array} elenco spese aggiornato
   */
  deleteSpesa(id) {
    this.spese = this.spese.filter(s => s.id !== id);
    return this.spese;
  }

  /**
   * Calcola i totali delle spese sostenute e il conguaglio/saldo finale tra le parti
   * @returns {Object} { debitore, creditore, importo, totalePapa, totaleMamma, totaleGenerale }
   */
  calculateSaldo() {
    let totalePapa = 0;
    let totaleMamma = 0;
    let creditoPapa = 0;
    let creditoMamma = 0;

    this.spese.forEach(spesa => {
      const modalita = spesa.modalita || 'intero';
      const importo = parseFloat(spesa.importo) || 0;

      if (spesa.pagatoDa === 'papa') {
        totalePapa += importo;
        if (modalita === 'intero') {
          creditoPapa += importo / 2; // Papà ha anticipato l'intero importo (vanta il 50%)
        }
      } else if (spesa.pagatoDa === 'mamma') {
        totaleMamma += importo;
        if (modalita === 'intero') {
          creditoMamma += importo / 2; // Mamma ha anticipato l'intero importo (vanta il 50%)
        }
      }
    });

    const differenza = creditoPapa - creditoMamma;
    const totaleGenerale = totalePapa + totaleMamma;

    if (differenza > 0) {
      return { 
        debitore: 'mamma', 
        creditore: 'papa', 
        importo: differenza, 
        totalePapa, 
        totaleMamma,
        totaleGenerale 
      };
    } else if (differenza < 0) {
      return { 
        debitore: 'papa', 
        creditore: 'mamma', 
        importo: Math.abs(differenza), 
        totalePapa, 
        totaleMamma,
        totaleGenerale 
      };
    }

    return { 
      debitore: null, 
      creditore: null, 
      importo: 0, 
      totalePapa, 
      totaleMamma,
      totaleGenerale 
    };
  }
}
