export class FestivitaManager {
  constructor() {
    // Regole predefinite: 'pari' specifica chi ha il bambino negli anni pari.
    // 'pari': 'papa' -> Anni Pari: Papà, Anni Dispari: Mamma
    // 'pari': 'mamma' -> Anni Pari: Mamma, Anni Dispari: Papà
    this.defaultRules = {
      natale: { nome: 'Natale (25 Dic)', pari: 'papa', inizio: '12-24', fine: '12-25' },
      capodanno: { nome: 'Capodanno (31 Dic - 1 Gen)', pari: 'mamma', inizio: '12-31', fine: '01-01' },
      epifania: { nome: 'Epifania (6 Gen)', pari: 'papa', inizio: '01-06', fine: '01-06' },
      pasqua: { nome: 'Pasqua & Pasquetta', pari: 'mamma', mobile: true },
      compleanno_valerio: { nome: 'Compleanno Valerio (2 Ago)', pari: 'papa', inizio: '08-02', fine: '08-02' },
      ferragosto: { nome: 'Ferragosto (15 Ago)', pari: 'mamma', inizio: '08-15', fine: '08-15' }
    };

    this.customRules = {};
  }

  setCustomRules(rules) {
    this.customRules = rules || {};
  }

  getRule(key) {
    return this.customRules[key] || this.defaultRules[key];
  }

  updateRule(key, newPariParent) {
    if (!this.customRules[key]) {
      this.customRules[key] = { ...(this.defaultRules[key] || {}) };
    }
    this.customRules[key].pari = newPariParent;
  }

  /**
   * Calcola la data di Pasqua per un dato anno (Algoritmo di Butcher/Gauss)
   */
  getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  /**
   * Verifica se la data ricade in una festività e restituisce il genitore spettante
   */
  getFestivitaForDate(date) {
    const year = date.getFullYear();
    const isEvenYear = year % 2 === 0;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const monthDay = `${month}-${day}`;

    // 1. Controlla Pasqua e Pasquetta (Festività Mobili)
    const easter = this.getEasterDate(year);
    const pasquetta = new Date(easter);
    pasquetta.setDate(easter.getDate() + 1);

    const isEaster = date.toDateString() === easter.toDateString();
    const isPasquetta = date.toDateString() === pasquetta.toDateString();

    if (isEaster || isPasquetta) {
      const rule = this.getRule('pasqua');
      const assignedParent = isEvenYear ? rule.pari : (rule.pari === 'papa' ? 'mamma' : 'papa');
      return {
        isFestivita: true,
        nome: isEaster ? 'Pasqua 🐣' : 'Pasquetta 🧺',
        parent: assignedParent
      };
    }

    // 2. Controlla Festività Fisse
    for (const [key, defaultRule] of Object.entries(this.defaultRules)) {
      if (defaultRule.mobile) continue;
      const rule = this.getRule(key);

      if (monthDay === rule.inizio || monthDay === rule.fine) {
        const assignedParent = isEvenYear ? rule.pari : (rule.pari === 'papa' ? 'mamma' : 'papa');
        return {
          isFestivita: true,
          nome: rule.nome,
          parent: assignedParent
        };
      }
    }

    return null;
  }

  toJSON() {
    return this.customRules;
  }
}
