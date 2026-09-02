// Importa Firebase dai CDN ufficiali
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurazione Firebase (inserisci i tuoi dati)
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

const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');

// 1. Aggiungere un Task a Firestore
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;

    try {
        await addDoc(collection(db, "tasks"), {
            text: text,
            completed: false,
            createdAt: new Date()
        });
        taskInput.value = '';
    } catch (error) {
        console.error("Errore nell'aggiunta del task: ", error);
    }
});

// 2. Leggere i Task in tempo reale (Realtime listener di Firestore)
const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
onSnapshot(q, (snapshot) => {
    taskList.innerHTML = '';
    snapshot.forEach((docSnap) => {
        const task = docSnap.data();
        const id = docSnap.id;

        const li = document.createElement('li');
        if (task.completed) li.classList.add('completed');

        li.innerHTML = `
            <span style="cursor:pointer; flex:1;" onclick="toggleTask('${id}', ${task.completed})">${task.text}</span>
            <button class="delete-btn" onclick="deleteTask('${id}')">Elimina</button>
        `;
        taskList.appendChild(li);
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
