const express = require("express");
const cors = require("cors");
const db = require("./database");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = 4000;

const allowedOrigins = new Set([
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
]);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.has(origin)) return callback(null, true);
            return callback(null, true);
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        optionsSuccessStatus: 204,
    }),
);
app.options(/.*/, cors());
app.use(express.json());

const AUTH_SECRET = process.env.AUTH_SECRET || "mr-coche-auth-secret";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

function base64UrlEncode(input) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function base64UrlDecode(input) {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad =
        normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
    return Buffer.from(normalized + pad, "base64");
}

function sign(payload) {
    return base64UrlEncode(
        crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest(),
    );
}

function createToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
        sub: "admin",
        iat: now,
        exp: now + 60 * 60 * 24,
        nonce: crypto.randomBytes(16).toString("hex"),
    });
    const payloadPart = base64UrlEncode(payload);
    const signaturePart = sign(payloadPart);
    return `${payloadPart}.${signaturePart}`;
}

function verifyToken(token) {
    if (typeof token !== "string" || !token.includes(".")) return null;
    const [payloadPart, signaturePart] = token.split(".", 2);
    if (!payloadPart || !signaturePart) return null;
    const expected = sign(payloadPart);
    const ok =
        expected.length === signaturePart.length &&
        crypto.timingSafeEqual(
            Buffer.from(expected),
            Buffer.from(signaturePart),
        );
    if (!ok) return null;

    try {
        const payload = JSON.parse(
            base64UrlDecode(payloadPart).toString("utf8"),
        );
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload?.exp !== "number" || payload.exp < now) return null;
        return payload;
    } catch {
        return null;
    }
}

function hashPassword(password, saltHex) {
    const salt = Buffer.from(saltHex, "hex");
    return crypto
        .pbkdf2Sync(String(password), salt, 100000, 32, "sha256")
        .toString("hex");
}

async function getSetting(key) {
    const result = await db.execute({
        sql: "SELECT value FROM settings WHERE key = ?",
        args: [key],
    });
    return result.rows.length > 0 ? result.rows[0].value : null;
}

async function setSetting(key, value) {
    await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [key, value],
    });
}

async function ensureAuthInitialized() {
    const salt = await getSetting("auth_salt");
    const hash = await getSetting("auth_hash");
    if (salt && hash) return;
    const newSalt = crypto.randomBytes(16).toString("hex");
    const newHash = hashPassword(ADMIN_PASSWORD, newSalt);
    await setSetting("auth_salt", newSalt);
    await setSetting("auth_hash", newHash);
}

function getLocalISOString() {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().slice(0, -1);
}

function getLocalDayString() {
    return getLocalISOString().split("T")[0];
}

app.use(async (req, res, next) => {
    if (req.method === "OPTIONS") return next();
    if (req.path === "/auth/login") return next();

    const auth = req.headers.authorization;
    const token =
        typeof auth === "string" && auth.startsWith("Bearer ")
            ? auth.slice("Bearer ".length)
            : null;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });
    next();
});

app.post("/auth/login", async (req, res) => {
    const { password } = req.body || {};
    try {
        await ensureAuthInitialized();
        const salt = await getSetting("auth_salt");
        const hash = await getSetting("auth_hash");
        if (!salt || !hash)
            return res.status(500).json({ error: "Auth not initialized" });

        const computed = hashPassword(String(password || ""), String(salt));
        const ok =
            computed.length === hash.length &&
            crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });

        res.json({ token: createToken() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENDPOINTS VEHÍCULOS (Estacionados) ---

// 1. Obtener vehículos estacionados
app.get("/vehicles", async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM parked_vehicles");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Registrar Entrada (Check-In)
app.post("/vehicles/check-in", async (req, res) => {
    const { plate, type } = req.body;
    if (!type) return res.status(400).json({ error: "Type is required" });

    const id = uuidv4().slice(0, 8).toUpperCase();

    try {
        const normalizedPlate =
            typeof plate === "string" ? plate.trim().toUpperCase() : null;
        let isSub = false;
        if (normalizedPlate) {
            const today = getLocalDayString();
            const subResult = await db.execute({
                sql: "SELECT 1 FROM subscribers WHERE UPPER(plate) = ? AND active = 1 AND end_date >= ? LIMIT 1",
                args: [normalizedPlate, today],
            });
            isSub = subResult.rows.length > 0;
        }

        const localISOTime = getLocalISOString();

        await db.execute({
            sql: "INSERT INTO parked_vehicles (id, plate, type, is_subscriber, entry_time) VALUES (?, ?, ?, ?, ?)",
            args: [id, normalizedPlate, type, isSub, localISOTime],
        });

        const row = await db.execute({
            sql: "SELECT * FROM parked_vehicles WHERE id = ?",
            args: [id],
        });

        res.status(201).json(row.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Registrar Salida (Check-Out / Cobro)
app.post("/vehicles/check-out", async (req, res) => {
    const { id, paymentAmount } = req.body;

    try {
        const vResult = await db.execute({
            sql: "SELECT * FROM parked_vehicles WHERE id = ?",
            args: [id],
        });

        if (vResult.rows.length === 0)
            return res.status(404).json({ error: "Vehicle not found" });
        const vehicle = vResult.rows[0];

        const now = new Date();
        const entryTime = new Date(vehicle.entry_time);
        const durationMinutes = Math.ceil((now - entryTime) / (1000 * 60));

        // Calcular Tarifa
        const rateResult = await db.execute({
            sql: "SELECT * FROM rates WHERE vehicle_type = ?",
            args: [vehicle.type],
        });
        const rate = rateResult.rows[0];

        let totalFee = 0;

        if (!vehicle.is_subscriber) {
            if (durationMinutes <= 60) {
                totalFee = rate.first_hour;
            } else {
                totalFee = rate.first_hour;
                let remainingMinutes = durationMinutes - 60;
                while (remainingMinutes > 0) {
                    if (remainingMinutes > rate.tolerance_minutes) {
                        totalFee += rate.second_hour;
                    }
                    remainingMinutes -= 60;
                }
            }
        } else {
            // Caso Abonado: el totalFee es lo que decida pagar de su deuda (paymentAmount)
            totalFee = Number(paymentAmount) || 0;
            
            // Si pagó algo, descontar de su balance_due
            if (totalFee > 0 && vehicle.plate) {
                await db.execute({
                    sql: "UPDATE subscribers SET balance_due = MAX(0, balance_due - ?) WHERE UPPER(plate) = ? AND active = 1",
                    args: [totalFee, vehicle.plate.toUpperCase()],
                });
            }
        }

        const exitTime = getLocalISOString();

        // Registrar movimiento (el ingreso a caja)
        await db.execute({
            sql: `INSERT INTO movements 
            (vehicle_id, plate, vehicle_type, entry_time, exit_time, duration_minutes, amount_paid, is_subscriber) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                vehicle.id,
                vehicle.plate,
                vehicle.type,
                vehicle.entry_time,
                exitTime,
                durationMinutes,
                totalFee,
                vehicle.is_subscriber,
            ],
        });

        // Eliminar de estacionados
        await db.execute({
            sql: "DELETE FROM parked_vehicles WHERE id = ?",
            args: [id],
        });

        res.json({
            success: true,
            vehicle: vehicle,
            exitInfo: { duration: durationMinutes, fee: totalFee },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENDPOINTS TARIFAS ---

app.get("/rates", async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM rates");
        const ratesObj = {};
        result.rows.forEach((r) => {
            ratesObj[r.vehicle_type] = {
                firstHour: r.first_hour,
                secondHour: r.second_hour,
                toleranceMinutes: r.tolerance_minutes,
            };
        });
        res.json(ratesObj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/rates", async (req, res) => {
    const rates = req.body;
    try {
        for (const type of Object.keys(rates)) {
            const r = rates[type];
            await db.execute({
                sql: "UPDATE rates SET first_hour = ?, second_hour = ?, tolerance_minutes = ? WHERE vehicle_type = ?",
                args: [r.firstHour, r.secondHour, r.toleranceMinutes, type],
            });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENDPOINTS ABONADOS ---

app.get("/subscribers", async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM subscribers");
        // Mapear snake_case a camelCase para el frontend
        const mapped = result.rows.map(r => ({
            id: r.id,
            name: r.name,
            plate: r.plate,
            type: r.vehicle_type,
            startDate: r.start_date,
            endDate: r.end_date,
            monthlyFee: r.monthly_fee || 0,
            balanceDue: r.balance_due || 0,
            active: Boolean(r.active)
        }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/subscribers", async (req, res) => {
    const { name, plate, type, startDate, endDate, monthlyFee, balanceDue } = req.body;
    const id = uuidv4();
    try {
        const normalizedPlate =
            typeof plate === "string" ? plate.trim().toUpperCase() : "";

        await db.execute({
            sql: `INSERT INTO subscribers (id, name, plate, vehicle_type, start_date, end_date, monthly_fee, balance_due, active) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            args: [id, name, normalizedPlate, type, startDate, endDate, monthlyFee || 0, balanceDue || 0],
        });

        const row = await db.execute({
            sql: "SELECT * FROM subscribers WHERE id = ?",
            args: [id],
        });
        const r = row.rows[0];
        res.status(201).json({
            id: r.id,
            name: r.name,
            plate: r.plate,
            type: r.vehicle_type,
            startDate: r.start_date,
            endDate: r.end_date,
            monthlyFee: r.monthly_fee,
            balanceDue: r.balance_due,
            active: Boolean(r.active)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/subscribers/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute({
            sql: "UPDATE subscribers SET active = 0 WHERE id = ?",
            args: [id],
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENDPOINTS GASTOS Y CIERRE ---

app.get("/expenses", async (req, res) => {
    try {
        const today = getLocalDayString();
        const result = await db.execute({
            sql: "SELECT * FROM expenses WHERE date(created_at) = ?",
            args: [today],
        });
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/expenses", async (req, res) => {
    const { description, amount, category_id } = req.body;
    try {
        const desc = typeof description === "string" ? description.trim() : "";
        const amt = Number(amount);
        const categoryId =
            category_id === undefined || category_id === null
                ? null
                : Number(category_id);

        if (!desc) {
            return res.status(400).json({ error: "description is required" });
        }
        if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ error: "amount must be > 0" });
        }
        if (
            categoryId !== null &&
            (!Number.isFinite(categoryId) || categoryId < 0)
        ) {
            return res
                .status(400)
                .json({ error: "category_id must be a non-negative number" });
        }

        const createdAt = getLocalISOString();
        const result = await db.execute({
            sql: "INSERT INTO expenses (description, amount, category_id, created_at) VALUES (?, ?, ?, ?)",
            args: [desc, amt, categoryId, createdAt],
        });
        res.status(201).json({
            id: Number(result.lastInsertRowid),
            description: desc,
            amount: amt,
            category_id: categoryId,
            created_at: createdAt,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/cash/opening", async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : null;
    const day = date || getLocalDayString();

    try {
        const result = await db.execute({
            sql: "SELECT opening_balance FROM cash_openings WHERE date = ?",
            args: [day],
        });
        const openingBalance =
            result.rows.length > 0 ? result.rows[0].opening_balance || 0 : 0;
        res.json({ date: day, opening_balance: openingBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/cash/opening", async (req, res) => {
    const { date, opening_balance } = req.body || {};
    const day =
        typeof date === "string" && date.trim().length > 0
            ? date.trim()
            : getLocalDayString();
    const opening = Number(opening_balance);

    if (!Number.isFinite(opening) || opening < 0) {
        return res
            .status(400)
            .json({ error: "opening_balance must be a non-negative number" });
    }

    try {
        await db.execute({
            sql: `INSERT INTO cash_openings (date, opening_balance, updated_at)
                  VALUES (?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(date) DO UPDATE SET
                    opening_balance = excluded.opening_balance,
                    updated_at = CURRENT_TIMESTAMP`,
            args: [day, opening],
        });
        res.json({ success: true, date: day, opening_balance: opening });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/daily-summary", async (req, res) => {
    const today = getLocalDayString();

    const summary = {
        date: today,
        income: 0,
        expenses: 0,
        balance: 0,
        movements_count: 0,
        opening_balance: 0,
        expected_cash: 0,
    };

    try {
        // 1. Calcular Ingresos
        const incomeResult = await db.execute({
            sql: "SELECT SUM(amount_paid) as total, COUNT(*) as count FROM movements WHERE date(exit_time) = ?",
            args: [today],
        });
        if (incomeResult.rows.length > 0) {
            summary.income = incomeResult.rows[0].total || 0;
            summary.movements_count = incomeResult.rows[0].count || 0;
        }

        // 2. Calcular Gastos
        const expenseResult = await db.execute({
            sql: "SELECT SUM(amount) as total FROM expenses WHERE date(created_at) = ?",
            args: [today],
        });
        if (expenseResult.rows.length > 0) {
            summary.expenses = expenseResult.rows[0].total || 0;
        }

        const openingResult = await db.execute({
            sql: "SELECT opening_balance FROM cash_openings WHERE date = ?",
            args: [today],
        });
        if (openingResult.rows.length > 0) {
            summary.opening_balance =
                openingResult.rows[0].opening_balance || 0;
        }

        summary.balance = summary.income - summary.expenses;
        summary.expected_cash = summary.opening_balance + summary.balance;
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/daily-cash-report", async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : null;
    const day = date || getLocalDayString();

    try {
        const openingResult = await db.execute({
            sql: "SELECT opening_balance FROM cash_openings WHERE date = ?",
            args: [day],
        });
        const openingBalance =
            openingResult.rows.length > 0
                ? openingResult.rows[0].opening_balance || 0
                : 0;

        const movementsResult = await db.execute({
            sql: `SELECT id, vehicle_id, plate, vehicle_type, entry_time, exit_time, duration_minutes, amount_paid, is_subscriber, payment_method
                  FROM movements
                  WHERE date(exit_time) = ?
                  ORDER BY datetime(exit_time) ASC`,
            args: [day],
        });

        const expensesResult = await db.execute({
            sql: `SELECT id, category_id, description, amount, created_at
                  FROM expenses
                  WHERE date(created_at) = ?
                  ORDER BY datetime(created_at) ASC`,
            args: [day],
        });

        const incomeTotal = movementsResult.rows.reduce(
            (sum, r) => sum + (Number(r.amount_paid) || 0),
            0,
        );
        const expensesTotal = expensesResult.rows.reduce(
            (sum, r) => sum + (Number(r.amount) || 0),
            0,
        );
        const balance = incomeTotal - expensesTotal;

        res.json({
            date: day,
            opening_balance: openingBalance,
            income_total: incomeTotal,
            expenses_total: expensesTotal,
            balance,
            expected_cash: openingBalance + balance,
            movements: movementsResult.rows,
            expenses: expensesResult.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
});
