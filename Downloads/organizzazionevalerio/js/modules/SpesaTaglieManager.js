export class SpesaTaglieManager {
  constructor() {
    this.data = {
      taglie: {
        scarpe: '',
        magliette: '',
        pantaloni: '',
        intimo: ''
      },
      listaSpesa: []
    };
  }

  loadData(data) {
    if (data) {
      this.data = {
        taglie: {
          scarpe: data.taglie?.scarpe || '',
          magliette: data.taglie?.magliette || '',
          pantaloni: data.taglie?.pantaloni || '',
          intimo: data.taglie?.intimo || ''
        },
        listaSpesa: Array.isArray(data.listaSpesa) ? data.listaSpesa : []
      };
    }
  }

  getData() {
    return this.data;
  }

  updateTaglie(scarpe, magliette, pantaloni, intimo) {
    this.data.taglie = {
      scarpe: scarpe || '',
      magliette: magliette || '',
      pantaloni: pantaloni || '',
      intimo: intimo || ''
    };
  }

  addItemSpesa(testo, note = '') {
    if (!testo) return;
    this.data.listaSpesa.push({
      id: Date.now().toString(),
      testo,
      note,
      comprato: false
    });
  }

  toggleItemSpesa(id) {
    const item = this.data.listaSpesa.find(i => i.id === id);
    if (item) {
      item.comprato = !item.comprato;
    }
  }

  deleteItemSpesa(id) {
    this.data.listaSpesa = this.data.listaSpesa.filter(i => i.id !== id);
  }
}
