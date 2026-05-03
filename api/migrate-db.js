const { createClient } = require("@libsql/client");
require("dotenv").config();

const dbUrl = process.env.LOCAL_DB_URL || "file:parking.db";
const client = createClient({ url: dbUrl });

async function migrate() {
    console.log("🚀 Iniciando migración de base de datos...");
    console.log(`📂 Base de datos: ${dbUrl}`);

    try {
        // 1. Asegurar tabla subscribers y sus nuevas columnas
        console.log("--- Verificando tabla: subscribers ---");
        await client.execute(`CREATE TABLE IF NOT EXISTS subscribers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            plate TEXT NOT NULL,
            vehicle_type TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        const subCols = ["monthly_fee REAL DEFAULT 0", "balance_due REAL DEFAULT 0"];
        for (const colDef of subCols) {
            const colName = colDef.split(" ")[0];
            try {
                await client.execute(`ALTER TABLE subscribers ADD COLUMN ${colDef}`);
                console.log(`✅ Columna agregada a subscribers: ${colName}`);
            } catch (e) {
                if (e.message.includes("duplicate column name")) {
                    console.log(`ℹ️ La columna ${colName} ya existe en subscribers.`);
                } else {
                    console.error(`❌ Error al agregar ${colName}:`, e.message);
                }
            }
        }

        // 2. Asegurar tabla parked_vehicles
        console.log("\n--- Verificando tabla: parked_vehicles ---");
        await client.execute(`CREATE TABLE IF NOT EXISTS parked_vehicles (
            id TEXT PRIMARY KEY,
            plate TEXT,
            type TEXT NOT NULL,
            entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_subscriber BOOLEAN DEFAULT 0
        )`);
        
        try {
            await client.execute("ALTER TABLE parked_vehicles ADD COLUMN is_subscriber BOOLEAN DEFAULT 0");
            console.log("✅ Columna agregada a parked_vehicles: is_subscriber");
        } catch (e) {
            console.log("ℹ️ La columna is_subscriber ya existe o no se pudo agregar.");
        }

        // 3. Asegurar tabla movements (historial)
        console.log("\n--- Verificando tabla: movements ---");
        await client.execute(`CREATE TABLE IF NOT EXISTS movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id TEXT,
            plate TEXT,
            vehicle_type TEXT,
            entry_time DATETIME,
            exit_time DATETIME,
            duration_minutes INTEGER,
            amount_paid REAL,
            is_subscriber BOOLEAN DEFAULT 0,
            payment_method TEXT DEFAULT 'cash'
        )`);

        // 4. Asegurar tabla expenses
        console.log("\n--- Verificando tabla: expenses ---");
        await client.execute(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 5. Asegurar tabla cash_openings
        console.log("\n--- Verificando tabla: cash_openings ---");
        await client.execute(`CREATE TABLE IF NOT EXISTS cash_openings (
            date DATE PRIMARY KEY,
            opening_balance REAL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log("\n✨ Migración completada con éxito.");
        console.log("Recuerda reiniciar tu servidor API para aplicar los cambios.");

    } catch (error) {
        console.error("\n💥 Error crítico durante la migración:");
        console.error(error);
    } finally {
        // No es estrictamente necesario cerrar en este script corto de node, pero es buena práctica
    }
}

migrate();
