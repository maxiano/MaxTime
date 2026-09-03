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

const scheduleContainer = document.getElementById('schedule-container');
const filterChips = document.querySelectorAll('.filter-chip');

const dailyNote = document.getElementById('daily-note');
const noteStatus = document.getElementById('note-status');

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "Inbox"];

let unsubscribeTasks = null;
let unsubscribeNote = null;
let isSavingNote = false;
let saveTimeout = null;
let latestGroupedTasks = {}; // Memorizza i dati grezzi per poterli ri-filtrare istantaneamente

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

        // Ordinamento per 'order'
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
        noteStatus.textContent = "Salvato";
    });
}

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
    }, 800);
});

// Rendering dei blocchi applicando il filtro attivo e mostrando progetti/priorità
function renderSchedule() {
    scheduleContainer.innerHTML = '';
    
    timeSlots.forEach(slot => {
        const tasksInSlot = latestGroupedTasks[slot] || [];
        
        // Filtra i task in base alla categoria selezionata
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
            tasksHtml = `<ul>` + filteredTasks.map((t) => {
                const category = t.category || 'lavoro';
                const priority = t.priority || 'media';
                const project = t.project ? `<span class="badge badge-project">${t.project}</span>` : '';
                
                return `
                <li class="${t.completed ? 'completed' : ''}" data-priority="${priority}">
                    <div style="display:flex; flex-direction:column; margin-right: 6px;">
                        <button style="background:none; border:none; cursor:pointer; font-size:0.6rem; color:#9ca3af; padding:0;" onclick="moveTask('${t.id}', 'up', '${slot}')">▲</button>
                        <button style="background:none; border:none; cursor:pointer; font-size:0.6rem; color:#9ca3af; padding:0;" onclick="moveTask('${t.id}', 'down', '${slot}')">▼</button>
                    </div>
                    <div class="task-content" onclick="toggleTask('${t.id}', ${t.completed})">
                        <span class="badge badge-${category}">${category}</span>
                        ${project}
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

    if (scheduleContainer.innerHTML === '') {
        scheduleContainer.innerHTML = `<div class="card" style="text-align:center; color:#9ca3af; font-style:italic;">Nessun impegno trovato per la categoria "${currentFilter}" in questa giornata.</div>`;
    }
}

// Gestione click sui chip di filtro
filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        renderSchedule();
    });
});

// Aggiungere un Task salvando anche Progetto e Priorità
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    const time = taskTime ? taskTime.value : "Inbox";
    const category = taskCategory ? taskCategory.value : "lavoro";
    const project = taskProject ? taskProject.value : "";
    const priority = taskPriority ? taskPriority.value : "media";
    if (!text) return;

    try {
        const q = query(collection(db, "tasks"), where("date", "==", selectedDateStr), where("time", "==", time));
        const snapshot = await getDocs(q);
        const nextOrder = snapshot.size;

        await addDoc(collection(db, "tasks"), {
            text: text,
            time: time,
            category: category,
            project: project,
            priority: priority,
            date: selectedDateStr,
            order: nextOrder,
            completed: false,
            createdAt: new Date()
        });
        
        // Reset dei campi di input testuali e opzioni
        taskInput.value = '';
        if (taskTime) taskTime.value = '';
        if (taskCategory) taskCategory.value = 'lavoro';
        if (taskProject) taskProject.value = '';
        if (taskPriority) taskPriority.value = 'media';
    } catch (error) {
        console.error("Errore aggiunta task:", error);
    }
});

// Gestione aggiunta nuovo progetto tramite prompt rapido
const addProjectBtn = document.getElementById('add-project-btn');
const taskProjectSelect = document.getElementById('task-project');

if (addProjectBtn && taskProjectSelect) {
    addProjectBtn.addEventListener('click', () => {
        const newProjectName = prompt("Inserisci il nome del nuovo progetto:");
        if (newProjectName && newProjectName.trim() !== "") {
            const projectName = newProjectName.trim();
            
            // Verifica se il progetto esiste già per evitare duplicati
            let exists = false;
            for (let i = 0; i < taskProjectSelect.options.length; i++) {
                if (taskProjectSelect.options[i].value.toLowerCase() === projectName.toLowerCase()) {
                    exists = true;
                    break;
                }
            }

            if (exists) {
                alert("Questo progetto esiste già!");
            } else {
                // Crea la nuova option e la seleziona
                const opt = document.createElement('option');
                opt.value = projectName;
                opt.textContent = projectName;
                taskProjectSelect.appendChild(opt);
                taskProjectSelect.value = projectName;
            }
        }
    });
}

window.moveTask = async function(id, direction, slot) {
    try {
        const q = query(collection(db, "tasks"), where("date", "==", selectedDateStr), where("time", "==", slot));
        const snapshot = await getDocs(q);
        
        let tasks = [];
        snapshot.forEach(docSnap => tasks.push({ id: docSnap.id, ...docSnap.data() }));
        
        tasks.sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIndex = tasks.findIndex(t => t.id === id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= tasks.length) return;

        const tempOrder = tasks[currentIndex].order;
        tasks[currentIndex].order = tasks[targetIndex].order;
        tasks[targetIndex].order = tempOrder;

        if (tasks[currentIndex].order === tasks[targetIndex].order) {
            tasks[currentIndex].order = targetIndex;
            tasks[targetIndex].order = currentIndex;
        }

        await updateDoc(doc(db, "tasks", tasks[currentIndex].id), { order: tasks[currentIndex].order });
        await updateDoc(doc(db, "tasks", tasks[targetIndex].id), { order: tasks[targetIndex].order });

    } catch (error) {
        console.error("Errore nello spostamento task:", error);
    }
};

carryOverBtn.addEventListener('click', async () => {
    try {
        const q = query(collection(db, "tasks"), where("date", "==", selectedDateStr), where("completed", "==", false));
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
