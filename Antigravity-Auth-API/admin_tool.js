const axios = require('axios');

const API_URL = "http://localhost:3000/api/admin";
const ADMIN_TOKEN = "antigravity_admin_secret_2026";

async function createKey(days, usages, note) {
    try {
        const res = await axios.post(`${API_URL}/create`, {
            token: ADMIN_TOKEN,
            days,
            max_usages: usages,
            note
        });
        if (res.data.success) {
            console.log(`\n[+] KEY GENERATED: ${res.data.key.key}`);
            console.log(`    Expires: ${days ? days + ' days' : 'LIFETIME'}`);
            console.log(`    Max Users: ${usages}`);
            console.log(`    Note: ${note}\n`);
        }
    } catch (e) { console.log("Error creating key: " + e.message); }
}

async function banHWID(hwid) {
    try {
        const res = await axios.post(`${API_URL}/ban`, {
            token: ADMIN_TOKEN,
            hwid
        });
        if (res.data.success) console.log(`\n[!] HWID BANNED: ${hwid}\n`);
    } catch (e) { console.log("Error banning: " + e.message); }
}

// EJEMPLOS DE USO:
// Descomenta para usar:
createKey(30, 1, "Venta VIP - Cliente 1"); // Crea llave de 30 dias para 1 persona
// createKey(0, 1, "Lifetime Pass");        // Crea llave permanente
// banHWID("AF90AFD6-A628-114D-90DA-DF46027B5707"); // Banea el HWID que me pasaste antes
