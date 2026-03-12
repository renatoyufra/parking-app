const express = require("express");
const cors = require("cors");
const db = require("./database");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

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
            const subResult = await db.execute({
                sql: "SELECT 1 FROM subscribers WHERE UPPER(plate) = ? AND active = 1 AND end_date >= date('now') LIMIT 1",
                args: [normalizedPlate],
            });
            isSub = subResult.rows.length > 0;
        }

        // Hora local
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const localISOTime = new Date(Date.now() - tzOffset)
            .toISOString()
            .slice(0, -1);

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
    const { id } = req.body;

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
        }

        // Registrar movimiento
        await db.execute({
            sql: `INSERT INTO movements 
            (vehicle_id, plate, vehicle_type, entry_time, duration_minutes, amount_paid, is_subscriber) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
                vehicle.id,
                vehicle.plate,
                vehicle.type,
                vehicle.entry_time,
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
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/subscribers", async (req, res) => {
    const { name, plate, type, startDate, endDate } = req.body;
    const id = uuidv4();
    try {
        const normalizedPlate =
            typeof plate === "string" ? plate.trim().toUpperCase() : null;
        await db.execute({
            sql: "INSERT INTO subscribers (id, name, plate, vehicle_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
            args: [id, name, normalizedPlate, type, startDate, endDate],
        });
        res.status(201).json({ id, ...req.body, active: 1 });
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
        const result = await db.execute(
            "SELECT * FROM expenses WHERE date(created_at) = date('now')"
        );
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

        const result = await db.execute({
            sql: "INSERT INTO expenses (description, amount, category_id) VALUES (?, ?, ?)",
            args: [desc, amt, categoryId],
        });
        res.status(201).json({
            id: Number(result.lastInsertRowid),
            description: desc,
            amount: amt,
            category_id: categoryId,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/cash/opening", async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : null;
    const day = date || new Date().toISOString().split("T")[0];

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
            : new Date().toISOString().split("T")[0];
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
    const today = new Date().toISOString().split("T")[0];

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
        const incomeResult = await db.execute(
            "SELECT SUM(amount_paid) as total, COUNT(*) as count FROM movements WHERE date(exit_time) = date('now')"
        );
        if (incomeResult.rows.length > 0) {
            summary.income = incomeResult.rows[0].total || 0;
            summary.movements_count = incomeResult.rows[0].count || 0;
        }

        // 2. Calcular Gastos
        const expenseResult = await db.execute(
            "SELECT SUM(amount) as total FROM expenses WHERE date(created_at) = date('now')"
        );
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

app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
});
