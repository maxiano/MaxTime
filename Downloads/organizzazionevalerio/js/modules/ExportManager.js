export class ExportManager {
  static importFromCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result || '';
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length < 2) {
            resolve({ overrides: {}, notes: {}, manualCambi: {} });
            return;
          }

          const header = lines[0];
          const delimiter = header.includes(';') ? ';' : ',';

          const overrides = {};
          const notes = {};
          const manualCambi = {};

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
            if (cols.length < 3) continue;

            const dateStr = cols[0];
            let dateKey = null;

            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
              const [d, m, y] = dateStr.split('/');
              dateKey = `${y}-${m}-${d}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              dateKey = dateStr;
            }

            if (!dateKey) continue;

            const genitoreRaw = cols[2].toLowerCase();
            if (genitoreRaw.includes('papà') || genitoreRaw.includes('papa')) {
              overrides[dateKey] = 'papa';
            } else if (genitoreRaw.includes('mamma')) {
              overrides[dateKey] = 'mamma';
            }

            const cambioRaw = (cols[3] || '').toLowerCase();
            if (cambioRaw.includes('sì') || cambioRaw.includes('si') || cambioRaw.includes('true') || cambioRaw.includes('cambio')) {
              manualCambi[dateKey] = true;
            }

            const notaRaw = cols[4] || '';
            if (notaRaw) {
              let category = 'generico';
              let textClean = notaRaw;
              const catMatch = notaRaw.match(/^\[([A-Za-z0-9_\s]+)\]\s*(.*)$/);
              if (catMatch) {
                category = catMatch[1].toLowerCase();
                textClean = catMatch[2];
              }
              notes[dateKey] = { text: textClean, category };
            }
          }

          resolve({ overrides, notes, manualCambi });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }

  static exportToExcel(currentDate, getParentForDateFn, notes) {
    if (typeof XLSX === 'undefined') {
      alert("Libreria Excel in caricamento. Riprova tra qualche istante.");
      return;
    }
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(currentDate);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const data = [["Data", "Giorno", "Genitore con Valerio", "Cambio Turno", "Evento / Nota"]];
    const daysOfWeek = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
      
      let genitore = "Non definito";
      let cambio = "No";
      let notaText = "";

      const status = getParentForDateFn(date);
      if (status && status.parent) {
        genitore = status.parent === 'papa' ? 'Papà' : 'Mamma';
        if (status.isOverride) cambio = "Sì (Cambio)";
      }

      if (notes[dateKey]) {
        notaText = `[${notes[dateKey].category.toUpperCase()}] ${notes[dateKey].text}`;
      }

      data.push([dateStr, daysOfWeek[date.getDay()], genitore, cambio, notaText]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`);
    XLSX.writeFile(wb, `Turni_Valerio_${monthName}_${year}.xlsx`);
  }

  static generateICalendar(currentDate, getParentForDateFn, notes) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Gestione Valerio//IT\n";

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dtStr = `${year}${String(month + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`;
      
      const status = getParentForDateFn(date);
      const parentLabel = status.parent === 'papa' ? 'Papà' : status.parent === 'mamma' ? 'Mamma' : 'Non assegnato';
      const noteStr = notes[dateKey] ? ` - Nota: ${notes[dateKey].text}` : '';

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `DTSTART;VALUE=DATE:${dtStr}\n`;
      icsContent += `SUMMARY:Valerio con ${parentLabel}${noteStr}\n`;
      icsContent += "END:VEVENT\n";
    }

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `Calendario_Valerio_${month + 1}_${year}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
