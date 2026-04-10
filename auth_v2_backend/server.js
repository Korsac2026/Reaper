const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database initialization
if (!fs.existsSync(DATABASE_FILE)) {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify({ keys: [], sessions: [] }, null, 4));
}

const getDB = () => JSON.parse(fs.readFileSync(DATABASE_FILE));
const saveDB = (data) => fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 4));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- API Endpoints ---
app.post('/api/init', (req, res) => res.json({ success: true, message: "Initialized" }));

app.post('/api/login', (req, res) => {
    const { key, hwid } = req.body;
    console.log(`Login attempt: Key=${key}, HWID=${hwid}`);
    
    const db = getDB();
    const keyData = db.keys.find(k => k.key === key);

    if (!keyData) return res.json({ success: false, message: "License key does not exist" });
    if (keyData.status === 'banned') return res.json({ success: false, message: "This license is banned" });

    // HWID LINKING LOGIC
    if (!keyData.hwid || keyData.hwid === "NOT LINKED" || keyData.hwid === "") {
        keyData.hwid = hwid || "UNKNOWN_DEVICE";
        saveDB(db);
        console.log(`Linked new HWID: ${keyData.hwid}`);
    } else if (keyData.hwid !== hwid) {
        return res.json({ success: false, message: "HWID Mismatch. This key is locked to another PC." });
    }

    if (new Date(keyData.expiry) < new Date()) 
        return res.json({ success: false, message: "License has expired" });

    const token = uuidv4();
    db.sessions.push({ token, key, expiry: new Date(Date.now() + 3600000) });
    saveDB(db);
    res.json({ success: true, token, expiry: keyData.expiry });
});

// --- Admin Dashboard ---
app.post('/admin/generate', (req, res) => {
    const { days } = req.body;
    const db = getDB();
    const newKey = "REAPER-" + uuidv4().substring(0, 8).toUpperCase();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + parseInt(days));
    db.keys.push({ key: newKey, expiry: expiry.toISOString(), status: 'active', hwid: "NOT LINKED" });
    saveDB(db);
    res.json({ success: true, key: newKey });
});

app.get('/admin/keys', (req, res) => res.json(getDB().keys));

app.post('/admin/status', (req, res) => {
    const { key, status } = req.body;
    const db = getDB();
    const k = db.keys.find(x => x.key === key);
    if(k) { k.status = status; saveDB(db); }
    res.json({ success: true });
});

app.post('/admin/reset', (req, res) => {
    const { key } = req.body;
    const db = getDB();
    const k = db.keys.find(x => x.key === key);
    if(k) { k.hwid = "NOT LINKED"; saveDB(db); }
    res.json({ success: true });
});

app.post('/admin/delete', (req, res) => {
    const { key } = req.body;
    const db = getDB();
    db.keys = db.keys.filter(k => k.key !== key);
    saveDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
