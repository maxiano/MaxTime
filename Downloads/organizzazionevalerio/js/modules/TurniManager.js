export class TurniManager {
  constructor(startDateA = null) {
    // SE NON VIENE PASSATA UNA DATA, usiamo una data base fissa (es. 1 Gennaio 2024)
    const baseDate = startDateA ? new Date(startDateA) : new Date('2024-01-01T00:00:00');
    baseDate.setHours(0, 0, 0, 0);
    this.startDateA = baseDate;

    this.overrides = {};
    this.manualCambi = {};
  }

  /**
   * Popola il manager con i dati scaricati da Firebase
   */
  setData(overrides = {}, manualCambi = {}) {
    this.overrides = overrides || {};
    this.manualCambi = manualCambi || {};
  }

  formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getStandardParent(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const msPerDay = 86400000;
    const daysDiff = Math.floor((d - this.startDateA) / msPerDay);

    const cycleDay = ((daysDiff % 14) + 14) % 14; 

    // Schema rotazione (Giorni Papà: 0, 3, 5, 6, 8, 10)
    if (cycleDay === 0 || cycleDay === 3 || cycleDay === 5 || cycleDay === 6 || cycleDay === 8 || cycleDay === 10) {
      return 'papa';
    }

    return 'mamma';
  }

  getParentForDate(date) {
    const dateKey = this.formatDateKey(date);
    const standardParent = this.getStandardParent(date);

    // Controlla se la data è presente in overrides
    if (Object.prototype.hasOwnProperty.call(this.overrides, dateKey)) {
      const p = this.overrides[dateKey];
      const actualParent = p === 'none' ? null : p;

      // Mostra "CAMBIO" SOLO SE il flag manualCambi per questo giorno è impostato su true
      const isOverride = Boolean(this.manualCambi && this.manualCambi[dateKey] === true);

      return { parent: actualParent, isOverride: isOverride };
    }

    // Rotazione standard senza modifiche
    return { parent: standardParent, isOverride: false };
  }

  toggleDay(dateKey) {
    const parts = dateKey.split('-');
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    
    const currentStatus = this.getParentForDate(date);

    // Ciclo di selezione manuale: Papà -> Mamma -> Nessuno -> Papà
    if (currentStatus.parent === 'papa') {
      this.overrides[dateKey] = 'mamma';
    } else if (currentStatus.parent === 'mamma') {
      this.overrides[dateKey] = 'none';
    } else {
      this.overrides[dateKey] = 'papa';
    }

    // Impostiamo il cambio manuale
    this.manualCambi[dateKey] = true;

    return this.toJSON();
  }

  /**
   * Helper per salvare facilmente l'oggetto completo su Firebase
   */
  toJSON() {
    return {
      overrides: this.overrides,
      manualCambi: this.manualCambi
    };
  }
}
