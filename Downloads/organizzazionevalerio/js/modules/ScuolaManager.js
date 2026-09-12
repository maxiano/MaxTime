export class ScuolaManager {
  constructor() {
    // Orario settimanale: { Lunedi: ['Italiano', 'Matematica', ...], Martedi: [...] }
    this.orario = {
      Lunedi: [],
      Martedi: [],
      Mercoledi: [],
      Giovedi: [],
      Venerdi: []
    };
    
    // Lista compiti: [{ id, dataConsegna, materia, descrizione, completato }]
    this.compiti = [];
    
    // Lista voti: [{ id, data, materia, voto, note }]
    this.voti = [];
  }

  // --- GESTIONE ORARIO ---
  setOrarioGiorno(giorno, materieArray) {
    if (this.orario.hasOwnProperty(giorno)) {
      this.orario[giorno] = materieArray;
    }
  }

  // --- GESTIONE COMPITI ---
  addCompito(materia, descrizione, dataConsegna) {
    const compito = {
      id: Date.now().toString(),
      materia,
      descrizione,
      dataConsegna,
      completato: false
    };
    this.compiti.push(compito);
    return compito;
  }

  toggleCompito(id) {
    const compito = this.compiti.find(c => c.id === id);
    if (compito) {
      compito.completato = !compito.completato;
    }
  }

  deleteCompito(id) {
    this.compiti = this.compiti.filter(c => c.id !== id);
  }

  // --- GESTIONE VOTI ---
  addVoto(materia, voto, data, note = '') {
    const votoObj = {
      id: Date.now().toString(),
      materia,
      voto: parseFloat(voto),
      data,
      note
    };
    this.voti.push(votoObj);
    return votoObj;
  }

  deleteVoto(id) {
    this.voti = this.voti.filter(v => v.id !== id);
  }

  getMediaMateria(materia) {
    const votiMateria = this.voti.filter(v => v.materia.toLowerCase() === materia.toLowerCase());
    if (votiMateria.length === 0) return 0;
    const somma = votiMateria.reduce((acc, v) => acc + v.voto, 0);
    return (somma / votiMateria.length).toFixed(2);
  }

  getMediaGenerale() {
    if (this.voti.length === 0) return 0;
    const somma = this.voti.reduce((acc, v) => acc + v.voto, 0);
    return (somma / this.voti.length).toFixed(2);
  }

  // --- SINCRO FIRESTORE ---
  toJSON() {
    return {
      orario: this.orario,
      compiti: this.compiti,
      voti: this.voti
    };
  }

  fromJSON(data) {
    if (!data) return;
    this.orario = data.orario || { Lunedi: [], Martedi: [], Mercoledi: [], Giovedi: [], Venerdi: [] };
    this.compiti = data.compiti || [];
    this.voti = data.voti || [];
  }
}
