import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Endpoint per esporre in modo sicuro le configurazioni d'ambiente al client web
app.get('/api/env.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.__ENV__ = ${JSON.stringify({
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || "AIzaSyAGEPZjO0DnXAR9wJpOqfui5hYgJAYcE-k"
  })};`);
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html for SPA / client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
