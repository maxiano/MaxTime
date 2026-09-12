export class LogisticaManager {
  constructor() {
    this.passaggi = {};
  }

  setPassaggi(data) {
    this.passaggi = data || {};
  }

  getPassaggio(dateKey) {
    return this.passaggi[dateKey] || {
      luogo: '',
      ora: '',
      note: '',
      checklist: {
        vestiti: false,
        cartella: false,
        libretto: false,
        giochi: false
      }
    };
  }

  savePassaggio(dateKey, luogo, ora, note, checklist) {
    this.passaggi[dateKey] = {
      luogo: luogo || '',
      ora: ora || '',
      note: note || '',
      checklist: checklist || { vestiti: false, cartella: false, libretto: false, giochi: false }
    };
  }
}
