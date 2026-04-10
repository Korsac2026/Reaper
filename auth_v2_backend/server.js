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
app.use(express.static('public'));

// Database initialization
if (!fs.existsSync(DATABASE_FILE)) {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify({
        keys: [], // { key: string, expiry: date, status: active/used/banned }
        sessions: [] // { token: string, key: string, expiry: date }
    }, null, 4));
}

const getDB = () => JSON.parse(fs.readFileSync(DATABASE_FILE));
const saveDB = (data) => fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 4));

// --- API Endpoints for the Cheat ---

// 1. Initialize session
app.post('/api/init', (req, res) => {
    res.json({ success: true, message: "Initialized successfully", version: "2.0" });
});

// 2. Authenticate Key
app.post('/api/login', (req, res) => {
    const { key, hwid } = req.body;
    const db = getDB();
    
    const keyData = db.keys.find(k => k.key === key);
    
    if (!keyData) {
        return res.json({ success: false, message: "Invalid license key" });
    }
    
    if (keyData.status === 'banned') {
        return res.json({ success: false, message: "This key is banned" });
    }
    
    // Check expiry
    const now = new Date();
    if (new Date(keyData.expiry) < now) {
        return res.json({ success: false, message: "Key has expired" });
    }

    const sessionToken = uuidv4();
    db.sessions.push({
        token: sessionToken,
        key: key,
        expiry: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour session
    });
    saveDB(db);

    res.json({ 
        success: true, 
        message: "Successfully logged in",
        token: sessionToken,
        user_data: {
            username: "Reaper User",
            expiry: keyData.expiry
        }
    });
});

// 3. Keep-alive check
app.post('/api/check', (req, res) => {
    const { token } = req.body;
    const db = getDB();
    const session = db.sessions.find(s => s.token === token);
    
    if (!session || new Date(session.expiry) < new Date()) {
        return res.json({ success: false, message: "Session expired or invalid" });
    }
    
    res.json({ success: true });
});

// --- Dashboard Endpoints (Admin) ---

// Generate new key
app.post('/admin/generate', (req, res) => {
    const { days } = req.body;
    const db = getDB();
    
    const newKey = "REAPER-" + uuidv4().substring(0, 8).toUpperCase() + "-" + uuidv4().substring(0, 4).toUpperCase();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + parseInt(days));
    
    const keyEntry = {
        key: newKey,
        expiry: expiry.toISOString(),
        status: 'active'
    };
    
    db.keys.push(keyEntry);
    saveDB(db);
    
    res.json({ success: true, key: newKey });
});

// Get all keys
app.get('/admin/keys', (req, res) => {
    res.json(getDB().keys);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
