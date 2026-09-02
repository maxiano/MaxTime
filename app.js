// Importa Firebase dai CDN ufficiali
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurazione Firebase (la tua)
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

// Mostra la data odierna formattata in italiano (se l'elemento esiste nell'HTML)
const dateEl = document.getElementById('current-date');
if (dateEl) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    dateEl.innerText = new Date().toLocaleDateString('it-IT', options);
}

const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskTime = document.getElementById('task-time');
const scheduleContainer = document.getElementById('schedule-container');

// Blocchi orari standard della giornata
const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "Inbox"];

// 1. Aggiungere un Task a Firestore con l'orario selezionato
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    const time = taskTime ? taskTime.value : "Inbox";
    if (!text) return;

    try {
        await addDoc(collection(db, "tasks"), {
            text: text,
            time: time,
            completed: false,
            createdAt: new Date()
        });
        taskInput.value = '';
        if (taskTime) taskTime.value = '';
    } catch (error) {
        console.error("Errore nell'aggiunta del task: ", error);
    }
});

// 2. Leggere i Task in tempo reale e raggrupparli per blocco orario
const q = query(collection(db, "tasks"), orderBy("time", "asc"));
onSnapshot(q, (snapshot) => {
    if (!scheduleContainer) return;

    const groupedTasks = {};
    timeSlots.forEach(slot => groupedTasks[slot] = []);

    snapshot.forEach((docSnap) => {
        const task = docSnap.data();
        const id = docSnap.id;
        const slot = task.time || "Inbox";
        if (!groupedTasks[slot]) groupedTasks[slot] = [];
        groupedTasks[slot].push({ id, ...task });
    });

    // Render dei blocchi orari
    scheduleContainer.innerHTML = '';
    timeSlots.forEach(slot => {
        const tasksInSlot = groupedTasks[slot];
        const blockDiv = document.createElement('div');
        blockDiv.className = 'time-block';
        
        let tasksHtml = '';
        if (tasksInSlot.length === 0) {
            tasksHtml = `<div class="empty-slot">Nessun impegno pianificato</div>`;
        } else {
            tasksHtml = `<ul>` + tasksInSlot.map(t => `
                <li class="${t.completed ? 'completed' : ''}">
                    <span class="task-text" onclick="toggleTask('${t.id}', ${t.completed})">${t.text}</span>
                    <button class="delete-btn" onclick="deleteTask('${t.id}')">✕</button>
                </li>
            `).join('') + `</ul>`;
        }

        blockDiv.innerHTML = `
            <div class="time-header">${slot === "Inbox" ? "📥 Coda / Senza Orario" : "⏰ " + slot}</div>
            ${tasksHtml}
        `;
        
        scheduleContainer.appendChild(blockDiv);
    });
});

// 3. Funzioni globali per gestire completamento ed eliminazione
window.deleteTask = async function(id) {
    try {
        await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
        console.error("Errore durante l'eliminazione: ", error);
    }
};

window.toggleTask = async function(id, currentStatus) {
    try {
        await updateDoc(doc(db, "tasks", id), {
            completed: !currentStatus
        });
    } catch (error) {
        console.error("Errore durante l'aggiornamento: ", error);
    }
};

// Registrazione Service Worker per la PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log("Service Worker registrato con successo!"))
            .catch((err) => console.log("Registrazione Service Worker fallita: ", err));
    });
}
