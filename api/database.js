const { createClient } = require("@libsql/client");
require("dotenv").config();

const authToken = process.env.TURSO_AUTH_TOKEN;
const localDbUrl = process.env.LOCAL_DB_URL || "file:parking.db";
const remoteDbUrl = process.env.TURSO_DB_URL;
const localFirstEnabled =
    String(process.env.TURSO_LOCAL_FIRST || "").toLowerCase() === "true" ||
    process.env.TURSO_LOCAL_FIRST === "1";
const offlineEnabled =
    String(process.env.TURSO_OFFLINE || "").toLowerCase() === "true" ||
    process.env.TURSO_OFFLINE === "1";

let dbConfig;
if (offlineEnabled) {
    dbConfig = { url: localDbUrl };
} else if (localFirstEnabled && remoteDbUrl) {
    dbConfig = {
        url: localDbUrl,
        authToken,
        syncUrl: remoteDbUrl,
        syncInterval: Number(process.env.TURSO_SYNC_INTERVAL_MS || 5000),
    };
} else {
    dbConfig = {
        url: remoteDbUrl || localDbUrl,
        authToken,
    };
}

let client = createClient(dbConfig);
const db = {
    execute: (...args) => client.execute(...args),
};
let didFallbackToLocal = false;

async function initDb() {
    try {
        if (offlineEnabled) {
            console.log(`DB modo offline: url=${localDbUrl}`);
        } else if (localFirstEnabled && remoteDbUrl) {
            console.log(
                `DB local-first habilitado: local=${localDbUrl} sync=${remoteDbUrl}`
            );
        } else {
            console.log(`DB modo directo: url=${dbConfig.url}`);
        }

        // 1. Tabla de Vehículos Activos (Estacionados actualmente)
        await db.execute(`CREATE TABLE IF NOT EXISTS parked_vehicles (
            id TEXT PRIMARY KEY,
            plate TEXT,
            type TEXT NOT NULL,
            entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_subscriber BOOLEAN DEFAULT 0,
            ticket_number TEXT
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
            { type: "auto", args: [1000, 800, 10] },
            { type: "camioneta", args: [1500, 1200, 10] },
            { type: "camion", args: [2500, 2000, 10] },
        ];

        for (const rate of defaultRates) {
            await db.execute({
                sql: "INSERT OR IGNORE INTO rates (vehicle_type, first_hour, second_hour, tolerance_minutes) VALUES (?, ?, ?, ?)",
                args: [rate.type, ...rate.args],
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
            monthly_fee REAL DEFAULT 0,
            balance_due REAL DEFAULT 0,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_billed_date DATE
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
            payment_method TEXT DEFAULT 'cash',
            ticket_number TEXT
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

        await db.execute(`CREATE TABLE IF NOT EXISTS cash_openings (
            date TEXT PRIMARY KEY,
            opening_balance REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await db.execute(
            "UPDATE subscribers SET plate = UPPER(plate) WHERE plate IS NOT NULL"
        );
        await db.execute(
            "UPDATE parked_vehicles SET plate = UPPER(plate) WHERE plate IS NOT NULL"
        );
        await db.execute(
            "UPDATE movements SET plate = UPPER(plate) WHERE plate IS NOT NULL"
        );

        // Migración: Agregar ticket_number si no existe
        try {
            await db.execute("ALTER TABLE parked_vehicles ADD COLUMN ticket_number TEXT");
        } catch (e) {
            // Ignorar si la columna ya existe
        }
        try {
            await db.execute("ALTER TABLE movements ADD COLUMN ticket_number TEXT");
        } catch (e) {
            // Ignorar si la columna ya existe
        }

        // Migración: Agregar last_billed_date a subscribers si no existe
        try {
            await db.execute("ALTER TABLE subscribers ADD COLUMN last_billed_date DATE");
        } catch (e) {
            // Ignorar si la columna ya existe
        }

        console.log("Database initialized successfully with Turso/LibSQL");
    } catch (e) {
        const msg = String(e?.message || "");
        const isTlsIssuer =
            msg.toLowerCase().includes("invalid peer certificate") ||
            msg.toLowerCase().includes("unknownissuer");
        if (
            !offlineEnabled &&
            !didFallbackToLocal &&
            (remoteDbUrl || dbConfig.syncUrl) &&
            isTlsIssuer
        ) {
            didFallbackToLocal = true;
            dbConfig = { url: localDbUrl };
            client = createClient(dbConfig);
            await initDb();
            return;
        }
        console.error("Error initializing database:", e);
    }
}

// Inicializar al importar
initDb();

module.exports = db;
