// Importa Firebase dai CDN ufficiali
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, 
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function formatDateToISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let currentDate = new Date();
let selectedDateStr = formatDateToISO(currentDate);
let currentFilter = 'all'; // Filtro categoria attivo

const datePicker = document.getElementById('date-picker');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const carryOverBtn = document.getElementById('carry-over-btn');

const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskTime = document.getElementById('task-time');
const taskCategory = document.getElementById('task-category');
const taskProject = document.getElementById('task-project');
const taskPriority = document.getElementById('task-priority');
const taskResolution = document.getElementById('task-resolution'); // Nuovo campo Esito/Risoluzione

const scheduleContainer = document.getElementById('schedule-container');
const filterChips = document.querySelectorAll('.filter-chip');

const dailyNote = document.getElementById('daily-note');
const noteStatus = document.getElementById('note-status');

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "Inbox"];

let unsubscribeTasks = null;
let unsubscribeNote = null;
let isSavingNote = false;
let saveTimeout = null;
let latestGroupedTasks = {}; 

function updateDateUI() {
    datePicker.value = selectedDateStr;
    loadDayData(selectedDateStr);
}

function loadDayData(dateStr) {
    listenToTasksForDate(dateStr);
    listenToNoteForDate(dateStr);
}

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

        Object.keys(groupedTasks).forEach(slot => {
            groupedTasks[slot].sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : 0;
                const orderB = b.order !== undefined ? b.order : 0;
                return orderA - orderB;
            });
        });

        latestGroupedTasks = groupedTasks;
        renderSchedule();
    });
}

function listenToNoteForDate(dateStr) {
    if (unsubscribeNote) unsubscribeNote();

    isSavingNote = true;
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
        noteStatus.innerHTML = '<span class="status-dot synced"></span> Salvato';
    });
}

dailyNote.addEventListener('input', () => {
    if (isSavingNote) return;
     
    noteStatus.innerHTML = '<span class="status-dot saving"></span> Salvataggio...';
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
            noteStatus.innerHTML = '<span class="status-dot synced"></span> Salvato';
        } catch (error) {
            console.error("Errore salvataggio nota:", error);
            noteStatus.innerHTML = '<span class="status-dot error"></span> Errore';
        }
    }, 800);
});

// Rendering dei blocchi con grafica migliorata, icone, priorità ed esito/risoluzione pratica
function renderSchedule() {
    scheduleContainer.innerHTML = '';
     
    timeSlots.forEach(slot => {
        const tasksInSlot = latestGroupedTasks[slot] || [];
         
        const filteredTasks = tasksInSlot.filter(t => {
            if (currentFilter === 'all') return true;
            return (t.category || 'lavoro') === currentFilter;
        });

        if (currentFilter !== 'all' && filteredTasks.length === 0) {
            return; 
        }

        const blockDiv = document.createElement('div');
        blockDiv.className = 'time-block';
         
        let tasksHtml = '';
        if (filteredTasks.length === 0) {
            tasksHtml = `<div class="empty-slot">Nessun impegno pianificato</div>`;
        } else {
            tasksHtml = `<ul class="task-list">` + filteredTasks.map((t) => {
                const category = t.category || 'lavoro';
                const priority = t.priority || 'media';
                const project = t.project ? `<span class="badge badge-project">📁 ${t.project}</span>` : '';
                const resolution = t.resolution ? `<span class="resolution
