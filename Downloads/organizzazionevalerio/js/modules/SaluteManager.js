export class SaluteManager {
  constructor() {
    this.schede = {
      pediatra: { nome: '', telefono: '', via: '', orari: '' },
      infoGenerali: { gruppoSanguigno: '', allergie: '', terapie: '' },
      visite: []
    };
  }

  setSchede(data) {
    if (data) {
      this.schede = {
        pediatra: {
          nome: data.pediatra?.nome || '',
          telefono: data.pediatra?.telefono || '',
          via: data.pediatra?.via || '',
          orari: data.pediatra?.orari || ''
        },
        infoGenerali: data.infoGenerali || { gruppoSanguigno: '', allergie: '', terapie: '' },
        visite: data.visite || []
      };
    }
  }

  updatePediatra(nome, telefono, via, orari) {
    this.schede.pediatra = { nome, telefono, via, orari };
  }

  updateInfoGenerali(gruppoSanguigno, allergie, terapie) {
    this.schede.infoGenerali = { gruppoSanguigno, allergie, terapie };
  }

  addVisita(data, descrizione, esito) {
    this.schede.visite.push({
      id: Date.now().toString(),
      data,
      descrizione,
      esito
    });
  }

  deleteVisita(id) {
    this.schede.visite = this.schede.visite.filter(v => v.id !== id);
  }
}
