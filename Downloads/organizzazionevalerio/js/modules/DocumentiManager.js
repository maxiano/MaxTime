export class DocumentiManager {
  constructor() {
    this.documenti = [];
  }

  loadData(data) {
    if (Array.isArray(data)) {
      this.documenti = data;
    } else {
      this.documenti = [];
    }
  }

  getData() {
    return Array.isArray(this.documenti) ? this.documenti : [];
  }

  addDocumento(titolo, categoria, dataScadenza, fileData, fileType, fileName) {
    const newDoc = {
      id: Date.now().toString(),
      titolo: titolo || 'Documento senza titolo',
      categoria: categoria || 'Altro',
      dataScadenza: dataScadenza || '',
      fileData, // Stringa Base64
      fileType, // 'image/jpeg', 'application/pdf', ecc.
      fileName: fileName || 'documento',
      createdAt: new Date().toISOString()
    };

    if (!Array.isArray(this.documenti)) {
      this.documenti = [];
    }
    this.documenti.push(newDoc);
  }

  deleteDocumento(id) {
    if (Array.isArray(this.documenti)) {
      this.documenti = this.documenti.filter(d => d.id !== id);
    }
  }
}
