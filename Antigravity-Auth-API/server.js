const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// --- TU CONFIGURACION DE MONGODB ---
const MONGO_URI = "mongodb+srv://tyr01072013_db_user:r18wgj0rdk6JEoRx@cluster0.o9ipnnn.mongodb.net/?appName=Cluster0";
const ADMIN_TOKEN = "antigravity_admin_secret_2026";

// Esquema de base de datos
const keySchema = new mongoose.Schema({
    key: { type: String, unique: true },
    days: Number,
    max_usages: Number,
    current_usages: { type: Number, default: 0 },
    note: String,
    hwids: [String],
    created_at: { type: Number, default: () => Date.now() },
    expires_at: Number,
    status: { type: String, default: 'active' }
});
const KeyModel = mongoose.model('Key', keySchema);

// --- RUTAS ADMINISTRATIVAS ---
app.get('/api/admin/keys', async (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) return res.status(401).send("Unauthorized");
    const keys = await KeyModel.find({});
    res.json({ keys });
});

app.post('/api/admin/create', async (req, res) => {
    const { token, days, max_usages, note } = req.body;
    if (token !== ADMIN_TOKEN) return res.status(401).json({ success: false });

    const newKey = {
        key: `AG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        days: parseInt(days),
        max_usages: parseInt(max_usages),
        note: note || "Custom User",
        expires_at: days > 0 ? Date.now() + (days * 24 * 60 * 60 * 1000) : null
    };

    const saved = await new KeyModel(newKey).save();
    res.json({ success: true, key: saved });
});

app.delete('/api/admin/keys/:key', async (req, res) => {
    if (req.query.token !== ADMIN_TOKEN) return res.status(401).send();
    await KeyModel.findOneAndDelete({ key: req.params.key });
    res.json({ success: true });
});

// --- RUTA DE VALIDACION PARA EL SPOOFER ---
app.post('/api/client/validate', async (req, res) => {
    const { key, hwid } = req.body;
    const keyData = await KeyModel.findOne({ key: key });

    if (!keyData) return res.status(404).json({ success: false, message: "Key No Exist" });
    if (keyData.expires_at && Date.now() > keyData.expires_at) return res.status(403).json({ success: false, message: "Key Expired" });

    if (keyData.hwids.length > 0 && !keyData.hwids.includes(hwid)) {
        if (keyData.current_usages >= keyData.max_usages) {
            return res.status(403).json({ success: false, message: "Limit Reached" });
        }
    }

    if (!keyData.hwids.includes(hwid)) {
        keyData.hwids.push(hwid);
        keyData.current_usages++;
        await keyData.save();
    }

    res.json({ success: true, message: "Welcome Back", expiry: keyData.expires_at });
});

// --- INICIO ---
mongoose.connect(MONGO_URI)
    .then(() => {
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server Online with MongoDB!`);
        });
    })
    .catch(err => console.log("Error connecting to Atlas: ", err));
