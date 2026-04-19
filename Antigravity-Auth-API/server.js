const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public')); // Sirve el Dashboard

const DB_PATH = path.join(__dirname, 'database', 'keys.json');
const ADMIN_TOKEN = "antigravity_admin_secret_2026";

// Asegurar base de datos
if (!fs.existsSync(DB_PATH)) {
    if (!fs.existsSync(path.join(__dirname, 'database'))) fs.mkdirSync(path.join(__dirname, 'database'));
    fs.writeFileSync(DB_PATH, JSON.stringify({ keys: [] }, null, 4));
}

const loadDB = () => JSON.parse(fs.readFileSync(DB_PATH));
const saveDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4));

// --- API ADMINISTRATIVA ---

// Listar todas las llaves (Para el Dashboard)
app.get('/api/admin/keys', (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) return res.status(401).send();
    const db = loadDB();
    res.json({ keys: db.keys });
});

// Crear llaves (Advanced)
app.post('/api/admin/create', (req, res) => {
    const { token, days, max_usages, note } = req.body;
    if (token !== ADMIN_TOKEN) return res.status(401).json({ success: false });

    const db = loadDB();
    const newKey = {
        key: `AG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        days: parseInt(days),
        max_usages: parseInt(max_usages),
        current_usages: 0,
        note: note || "Customer",
        hwids: [],
        created_at: Date.now(),
        expires_at: days > 0 ? Date.now() + (days * 24 * 60 * 60 * 1000) : null,
        status: "active"
    };

    db.keys.push(newKey);
    saveDB(db);
    res.json({ success: true, key: newKey });
});

// Borrar llaves
app.delete('/api/admin/keys/:key', (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) return res.status(401).send();
    const db = loadDB();
    db.keys = db.keys.filter(k => k.key !== req.params.key);
    saveDB(db);
    res.json({ success: true });
});

// --- API CLIENTE ---

app.post('/api/client/validate', (req, res) => {
    const { key, hwid } = req.body;
    const db = loadDB();
    const keyData = db.keys.find(k => k.key === key);

    if (!keyData) return res.status(404).json({ success: false, message: "Key not found" });
    if (keyData.expires_at && Date.now() > keyData.expires_at) return res.status(403).json({ success: false, message: "Expired" });

    // Lógica de HWID Binding
    if (keyData.hwids.length > 0 && !keyData.hwids.includes(hwid)) {
        if (keyData.current_usages >= keyData.max_usages) {
            return res.status(403).json({ success: false, message: "Usage limit reached" });
        }
    }

    if (!keyData.hwids.includes(hwid)) {
        keyData.hwids.push(hwid);
        keyData.current_usages++;
        saveDB(db);
    }

    res.json({ success: true, message: "Access Granted", expiry: keyData.expires_at });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\x1b[36m%s\x1b[0m`, `
    __________________________________________
    ANTIGRAVITY INFINITY AUTH SYSTEM
    SERVER: ONLINE ON PORT ${PORT}
    DASHBOARD: http://localhost:${PORT}
    __________________________________________
    `);
});
