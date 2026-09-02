// Importa Firebase dai CDN ufficiali
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, getDoc,
    onSnapshot, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurazione Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBBFyH5mZDWnsxPsmR3aNpK8beA085b6rc",
    authDomain: "maxtime-db5d0.firebaseapp.com",
    projectId: "maxtime-db5d0",
    storageBucket: "maxtime-db5d0.firebasestorage.app",
    messagingSenderId: "718138907341",
    appId: "1:718138907341:web:472b4ad69688bc3ffbe784",
    measurementId: "G-QK36FKB2X9"
};

// Inizializzazione Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper per formattare la data in stringa "YYYY-MM-DD"
function formatDateToISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let currentDate = new Date();
let selectedDateStr = formatDateToISO(currentDate);

const datePicker = document.getElementById('date-picker');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const carryOverBtn = document.getElementById('carry-over-btn');

const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskTime = document.getElementById('task-time');
const taskCategory = document.getElementById('task-category');
const scheduleContainer = document.getElementById('schedule-container');

// Elementi Taccuino
const dailyNote = document.getElementById('daily-note');
const noteStatus = document.getElementById('note-status');

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "Inbox"];

let unsubscribeTasks = null;
let unsubscribeNote = null;
let isSavingNote = false;
let saveTimeout = null;

function updateDateUI() {
    datePicker.value = selectedDateStr;
    loadDayData(selectedDateStr);
}

function loadDayData(dateStr) {
    listenToTasksForDate(dateStr);
    listenToNoteForDate(dateStr);
}

// Sincronizzazione Task
function listenToTasksForDate(dateStr) {
    if (unsubscribeTasks) unsubscribeTasks();

    const q = query(collection(db, "tasks"), where("date", "==", dateStr));

    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const groupedTasks = {};
        timeSlots.forEach(slot => groupedTasks[slot] = []);

        snapshot.forEach((docSnap) => {
            const task = docSnap.data();
            const id = docSnap.id;
            const slot = task.time || "Inbox";
            if (!groupedTasks[slot]) groupedTasks[slot] = [];
            groupedTasks[slot].push({ id, ...task });
        });

        renderSchedule(groupedTasks);
    });
}

// Sincronizzazione Nota del giorno (usiamo la data come ID documento nella collection "notes")
function listenToNoteForDate(dateStr) {
    if (unsubscribeNote) unsubscribeNote();

    isSavingNote = true; // Evita loop mentre carica
    const noteRef = doc(db, "notes", dateStr);

    unsubscribeNote = onSnapshot(noteRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (dailyNote.value !== data.content) {
                dailyNote.value = data.content || "";
            }
        } else {
            dailyNote.value = "";
        }
        isSavingNote = false;
        noteStatus.textContent = "Salvato";
    });
}

// Salvataggio automatico ritardato (Debounce) mentre si digita nella nota
dailyNote.addEventListener('input', () => {
    if (isSavingNote) return;
    
    noteStatus.textContent = "Modifiche...";
    clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        const content = dailyNote.value;
        const noteRef = doc(db, "notes", selectedDateStr);
        try {
            await setDoc(noteRef, { 
                date: selectedDateStr, 
                content: content,
                updatedAt: new Date()
            }, { merge: true });
            noteStatus.textContent = "Salvato";
        } catch (error) {
            console.error("Errore salvataggio nota:", error);
            noteStatus.textContent = "Errore salvataggio";
        }
    }, 800); // Salva 800ms dopo che l'utente ha smesso di scrivere
});

function renderSchedule(groupedTasks) {
    scheduleContainer.innerHTML = '';
    timeSlots.forEach(slot => {
        const tasksInSlot = groupedTasks[slot] || [];
        const blockDiv = document.createElement('div');
        blockDiv.className = 'time-block';
        
        let tasksHtml = '';
        if (tasksInSlot.length === 0) {
            tasksHtml = `<div class="empty-slot">Nessun impegno pianificato</div>`;
        } else {
            tasksHtml = `<ul>` + tasksInSlot.map(t => {
                const category = t.category || 'lavoro';
                return `
                <li class="${t.completed ? 'completed' : ''}">
                    <div class="task-content" onclick="toggleTask('${t.id}', ${t.completed})">
                        <span class="badge badge-${category}">${category}</span>
                        <span class="task-text">${t.text}</span>
                    </div>
                    <button class="delete-btn" onclick="deleteTask('${t.id}')">✕</button>
                </li>`;
            }).join('') + `</ul>`;
        }

        blockDiv.innerHTML = `
            <div class="time-header">${slot === "Inbox" ? "📥 Coda / Senza Orario" : "⏰ " + slot}</div>
            ${tasksHtml}
        `;
        
        scheduleContainer.appendChild(blockDiv);
    });
}

// Aggiungere un Task con Categoria
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    const time = taskTime ? taskTime.value : "Inbox";
    const category = taskCategory ? taskCategory.value : "lavoro";
    if (!text) return;

    try {
        await addDoc(collection(db, "tasks"), {
            text: text,
            time: time,
            category: category,
            date: selectedDateStr,
            completed: false,
            createdAt: new Date()
        });
        taskInput.value = '';
        if (taskTime) taskTime.value = '';
        if (taskCategory) taskCategory.value = 'lavoro';
    } catch (error) {
        console.error("Errore aggiunta task:", error);
    }
});

// Sposta task non completati al giorno successivo
carryOverBtn.addEventListener('click', async () => {
    try {
        const q = query(collection(db, "tasks"), where("date", "==", selectedDateStr), where("completed", "==", false));
        const querySnapshot = getDocs(q); // await gestito sotto

        // Correzione per compatibilità query getDocs
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            alert("Nessun task in sospeso da spostare!");
            return;
        }

        const tomorrow = new Date(currentDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatDateToISO(tomorrow);

        const promises = snapshot.docs.map(docSnap => 
            updateDoc(doc(db, "tasks", docSnap.id), { date: tomorrowStr })
        );

        await Promise.all(promises);
        alert(`Spostati ${snapshot.size} task a domani (${tomorrowStr})!`);
    } catch (error) {
        console.error("Errore durante lo spostamento task:", error);
    }
});

datePicker.addEventListener('change', (e) => {
    selectedDateStr = e.target.value;
    currentDate = new Date(selectedDateStr + "T00:00:00");
    loadDayData(selectedDateStr);
});

prevDayBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    selectedDateStr = formatDateToISO(currentDate);
    updateDateUI();
});

nextDayBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    selectedDateStr = formatDateToISO(currentDate);
    updateDateUI();
});

todayBtn.addEventListener('click', () => {
    currentDate = new Date();
    selectedDateStr = formatDateToISO(currentDate);
    updateDateUI();
});

window.deleteTask = async function(id) {
    try {
        await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
        console.error("Errore eliminazione:", error);
    }
};

window.toggleTask = async function(id, currentStatus) {
    try {
        await updateDoc(doc(db, "tasks", id), { completed: !currentStatus });
    } catch (error) {
        console.error("Errore aggiornamento:", error);
    }
};

updateDateUI();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log("SW fallito", err));
    });
}
