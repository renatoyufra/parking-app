const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_DB_URL || 'file:parking.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
    url,
    authToken,
});

async function initDb() {
    try {
        // 1. Tabla de Vehículos Activos (Estacionados actualmente)
        await db.execute(`CREATE TABLE IF NOT EXISTS parked_vehicles (
            id TEXT PRIMARY KEY,
            plate TEXT,
            type TEXT NOT NULL,
            entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_subscriber BOOLEAN DEFAULT 0
        )`);

        // 2. Tabla de Tarifas
        await db.execute(`CREATE TABLE IF NOT EXISTS rates (
            vehicle_type TEXT PRIMARY KEY,
            first_hour REAL NOT NULL,
            second_hour REAL NOT NULL,
            tolerance_minutes INTEGER NOT NULL
        )`);

        // Insertar tarifas por defecto si no existen
        const defaultRates = [
            { type: 'auto', args: [1000, 800, 10] },
            { type: 'camioneta', args: [1500, 1200, 10] },
            { type: 'camion', args: [2500, 2000, 10] }
        ];
        
        for (const rate of defaultRates) {
            await db.execute({
                sql: "INSERT OR IGNORE INTO rates (vehicle_type, first_hour, second_hour, tolerance_minutes) VALUES (?, ?, ?, ?)",
                args: [rate.type, ...rate.args]
            });
        }

        // 3. Tabla de Abonados
        await db.execute(`CREATE TABLE IF NOT EXISTS subscribers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            plate TEXT NOT NULL,
            vehicle_type TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 4. Registro de Movimientos
        await db.execute(`CREATE TABLE IF NOT EXISTS movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id TEXT NOT NULL,
            plate TEXT,
            vehicle_type TEXT NOT NULL,
            entry_time DATETIME NOT NULL,
            exit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            duration_minutes INTEGER,
            amount_paid REAL,
            is_subscriber BOOLEAN DEFAULT 0,
            payment_method TEXT DEFAULT 'cash'
        )`);

        // 5. Categorías de Gastos
        await db.execute(`CREATE TABLE IF NOT EXISTS expense_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`);

        // 6. Gastos
        await db.execute(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            description TEXT,
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(category_id) REFERENCES expense_categories(id)
        )`);
        
        // 7. Configuración General
        await db.execute(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);
        
        console.log('Database initialized successfully with Turso/LibSQL');
    } catch (e) {
        console.error('Error initializing database:', e);
    }
}

// Inicializar al importar
initDb();

module.exports = db;
