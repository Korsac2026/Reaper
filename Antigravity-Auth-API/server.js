const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// --- CONFIGURACION ---
const MONGO_URI = "mongodb+srv://tyr01072013_db_user:r18wgj0rdk6JEoRx@cluster0.o9ipnnn.mongodb.net/?appName=Cluster0";
const ADMIN_TOKEN = "antigravity_admin_secret_2026";

// --- MODELOS ---
const keySchema = new mongoose.Schema({
    key: { type: String, unique: true },
    days: Number,
    max_usages: Number,
    current_usages: { type: Number, default: 0 },
    note: String,
    hwids: [String],
    created_at: { type: Number, default: Date.now },
    expires_at: Number,
    status: { type: String, default: 'active' }
});

const banSchema = new mongoose.Schema({
    target: String, // IP o HWID
    type: String,   // 'ip' o 'hwid'
    reason: String,
    date: { type: Number, default: Date.now }
});

const logSchema = new mongoose.Schema({
    event: String,
    details: String,
    ip: String,
    date: { type: Number, default: Date.now }
});

const Key = mongoose.model('Key', keySchema);
const Ban = mongoose.model('Ban', banSchema);
const Log = mongoose.model('Log', logSchema);

// --- FUNCIONES ---
const generateSecureKey = () => {
    // Genera una llave de 24 caracteres en grupos de 4
    let key = "";
    for(let i=0; i<6; i++) {
        key += crypto.randomBytes(2).toString('hex').toUpperCase();
        if(i < 5) key += "-";
    }
    return key; // Ejemplo: A1B2-C3D4-E5F6-G7H8-I9J0-K1L2
};

const addLog = async (event, details, ip) => {
    await new Log({ event, details, ip }).save();
};

// --- API ADMINISTRATIVA ---

// Get All Data
app.get('/api/admin/data', async (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) return res.status(401).send();
    const keys = await Key.find({});
    const bans = await Ban.find({});
    const logs = await Log.find({}).sort({ date: -1 }).limit(50);
    res.json({ keys, bans, logs });
});

// Bulk Create Keys
app.post('/api/admin/keys/bulk', async (req, res) => {
    const { token, days, max_usages, note, amount } = req.body;
    if (token !== ADMIN_TOKEN) return res.status(401).send();

    const newKeys = [];
    for(let i=0; i < (amount || 1); i++) {
        newKeys.push({
            key: generateSecureKey(),
            days: parseInt(days),
            max_usages: parseInt(max_usages),
            note: note || "Bulk Generated",
            expires_at: days > 0 ? Date.now() + (days * 24 * 60 * 60 * 1000) : null
        });
    }
    await Key.insertMany(newKeys);
    await addLog("BULK_CREATE", `Generated ${amount} keys`, req.ip);
    res.json({ success: true });
});

// Reset HWID
app.post('/api/admin/keys/:key/reset', async (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) return res.status(401).send();
    await Key.findOneAndUpdate({ key: req.params.key }, { hwids: [], current_usages: 0 });
    await addLog("HWID_RESET", `Reset HWID for key ${req.params.key}`, req.ip);
    res.json({ success: true });
});

// Ban Target
app.post('/api/admin/bans', async (req, res) => {
    const { token, target, type, reason } = req.body;
    if (token !== ADMIN_TOKEN) return res.status(401).send();
    await new Ban({ target, type, reason }).save();
    await addLog("BAN_ADDED", `Banned ${type}: ${target}`, req.ip);
    res.json({ success: true });
});

app.delete('/api/admin/keys/:key', async (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) return res.status(401).send();
    await Key.findOneAndDelete({ key: req.params.key });
    res.json({ success: true });
});

// --- API CLIENTE ---
app.post('/api/client/validate', async (req, res) => {
    const { key, hwid } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Check Bans
    const isBanned = await Ban.findOne({ $or: [{ target: hwid }, { target: ip }] });
    if (isBanned) return res.status(403).json({ success: false, message: "Device/IP Banned" });

    const keyData = await Key.findOne({ key });
    if (!keyData) {
        await addLog("AUTH_FAILED", `Invalid key: ${key}`, ip);
        return res.status(404).json({ success: false, message: "Invalid Key" });
    }

    if (keyData.expires_at && Date.now() > keyData.expires_at) {
        return res.status(403).json({ success: false, message: "Expired" });
    }

    if (keyData.hwids.length > 0 && !keyData.hwids.includes(hwid)) {
        if (keyData.current_usages >= keyData.max_usages) {
            return res.status(403).json({ success: false, message: "Usage Limit" });
        }
    }

    if (!keyData.hwids.includes(hwid)) {
        keyData.hwids.push(hwid);
        keyData.current_usages++;
        await keyData.save();
    }

    await addLog("AUTH_SUCCESS", `Authorized key: ${key}`, ip);
    res.json({ success: true, message: "Access Granted", expiry: keyData.expires_at });
});

mongoose.connect(MONGO_URI).then(() => {
    app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log("Infinity Auth v3.0 Powered Up"));
});
