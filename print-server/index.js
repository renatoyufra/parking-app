const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");
const usb = require("usb");
const fs = require("fs");
const path = require("path");

const app = express();
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
    })
);
app.options(/.*/, cors());
app.use(bodyParser.json());

// --- Persistencia del Correlativo ---
const SEQUENCE_FILE = path.join(__dirname, "ticket-sequence.json");

function getNextSequence() {
    let sequence = 1;
    try {
        if (fs.existsSync(SEQUENCE_FILE)) {
            const data = fs.readFileSync(SEQUENCE_FILE, "utf8");
            sequence = JSON.parse(data).last + 1;
        }
    } catch (e) {
        console.error("Error leyendo secuencia:", e);
    }

    try {
        fs.writeFileSync(SEQUENCE_FILE, JSON.stringify({ last: sequence }));
    } catch (e) {
        console.error("Error guardando secuencia:", e);
    }

    return String(sequence).padStart(6, "0");
}

// --- IDs de la impresora POS-D ---
// (Estos valores son hexadecimales)
const VENDOR_ID = 0x2aaf;
const PRODUCT_ID = 0x6015;

function formatDurationMinutes(durationMinutes) {
    const total = Number(durationMinutes);
    if (!Number.isFinite(total) || total < 0) return "0 min";
    if (total < 60) return `${Math.round(total)} min`;
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

async function printDirectToUsb(printer) {
    return new Promise((resolve, reject) => {
        const buffer = printer.getBuffer();
        const device = usb.findByIds(VENDOR_ID, PRODUCT_ID);

        if (!device) {
            return reject(
                new Error(
                    "Impresora POS-D no encontrada. Verifique la conexión."
                )
            );
        }

        try {
            device.open();
            const anInterface = device.interfaces[0];

            // En Windows, no se admite detachKernelDriver y arroja LIBUSB_ERROR_NOT_SUPPORTED.
            // Si has usado Zadig para instalar WinUSB, solo necesitas reclamar la interfaz.
            try {
                if (
                    process.platform !== "win32" &&
                    anInterface.isKernelDriverActive()
                ) {
                    anInterface.detachKernelDriver();
                }
            } catch (e) {
                console.log(
                    "Aviso: No se pudo liberar el driver del kernel (normal en Windows):",
                    e.message
                );
            }

            anInterface.claim();
            const outEndpoint = anInterface.endpoints.find(
                (e) => e.direction === "out"
            );

            if (!outEndpoint) {
                throw new Error(
                    "No se encontró un endpoint de salida en la impresora."
                );
            }

            outEndpoint.transfer(buffer, (err) => {
                if (err) {
                    return reject(
                        new Error(`Error de transferencia USB: ${err.message}`)
                    );
                }
                console.log("Datos enviados a la impresora correctamente.");

                // Liberamos la interfaz para que otros procesos puedan usarla
                anInterface.release(true, () => {
                    device.close();
                    resolve(true);
                });
            });
        } catch (e) {
            device.close();
            reject(
                new Error(`Error al comunicarse con la impresora: ${e.message}`)
            );
        }
    });
}

app.post("/print-ticket", async (req, res) => {
    const { vehicle, type, exitInfo } = req.body;

    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: "tcp://localhost", // Interface genérica para generar el buffer
        characterSet: "SLOVENIA",
        removeSpecialCharacters: false,
        lineCharacter: "-",
    });

    try {
        printer.alignCenter();
        printer.println("ESTACIONAMIENTO");
        printer.println("PJE KENNEDY - TACNA");
        printer.println("--------------------------------");

        if (type === "entry") {
            const sequence = getNextSequence();
            const date = new Date(vehicle.checkedInAt);

            // Fecha y Hora en grande
            printer.setTextSize(1, 1);
            printer.println("INGRESO");
            printer.setTextSize(0, 0);
            printer.println(`TICKET #${sequence}`);
            // Fecha y Hora
            printer.setTextSize(1, 0); // Reset tamaño
            printer.tableCustom([
                {
                    text: date.toLocaleDateString(),
                    align: "CENTER",
                    width: 0.5,
                    bold: true,
                },
                {
                    text: date.toLocaleTimeString(),
                    align: "CENTER",
                    width: 0.5,
                    bold: true,
                },
            ]);
            printer.newLine();

            printer.alignCenter();
            try {
                await printer.printQR(vehicle.id, {
                    cellSize: 8,
                    errorCorrectLevel: "M",
                });
            } catch (qrError) {
                console.error("Error generando QR:", qrError);
                printer.println(`ID: ${vehicle.id}`); // Fallback si falla el QR
            }
            printer.newLine();

            // ID y Correlativo
            printer.println(`ID: ${vehicle.id}`);
            printer.newLine();

            // Placa y Tipo
            if (vehicle.plate) {
                printer.setTextSize(1, 1);
                printer.println(`PLACA: ${vehicle.plate}`);
            }
            printer.setTextNormal();
            printer.println(`TIPO: ${vehicle.type.toUpperCase()}`);

            printer.newLine();
            printer.println("Conserve este ticket para la salida");
        } else {
            printer.println("TICKET DE SALIDA");
            printer.drawLine();
            printer.alignLeft();
            printer.println(`PLACA: ${vehicle.plate || "SIN PLACA"}`);
            printer.println(`TIPO: ${vehicle.type.toUpperCase()}`);
            printer.println(
                `ENTRADA: ${new Date(vehicle.checkedInAt).toLocaleString()}`
            );
            printer.println(`SALIDA: ${new Date().toLocaleString()}`);
            printer.println(
                `TIEMPO: ${formatDurationMinutes(exitInfo.duration)}`
            );
            printer.drawLine();
            printer.alignCenter();
            printer.setTextSize(1, 1);
            printer.println(`TOTAL: S/ ${exitInfo.fee}`);
            printer.setTextNormal();
            printer.newLine();
            printer.println("Gracias por su visita");
        }

        printer.cut();

        await printDirectToUsb(printer);

        res.send({ success: true });
    } catch (error) {
        console.error("Error en endpoint /print-ticket:", error);
        res.status(500).send({ error: error.message });
    }
});

app.post("/print-cash-report", async (req, res) => {
    const report = req.body?.report || req.body;

    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: "tcp://localhost",
        characterSet: "SLOVENIA",
        removeSpecialCharacters: false,
        lineCharacter: "-",
    });

    try {
        const day =
            typeof report?.date === "string"
                ? report.date
                : new Date().toISOString().split("T")[0];

        const opening = Number(report?.opening_balance) || 0;
        const incomeTotal = Number(report?.income_total) || 0;
        const expensesTotal = Number(report?.expenses_total) || 0;
        const balance = Number(report?.balance) || 0;
        const expectedCash = Number(report?.expected_cash) || opening + balance;

        const movements = Array.isArray(report?.movements)
            ? report.movements
            : [];
        const expenses = Array.isArray(report?.expenses) ? report.expenses : [];

        const formatMoney = (value) => {
            const n = Number(value) || 0;
            return `S/ ${n.toFixed(2)}`;
        };

        const formatTime = (value) => {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return "--:--";
            return d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        };

        printer.alignCenter();
        printer.println("ESTACIONAMIENTO");
        printer.println("PJE KENNEDY - TACNA");
        printer.drawLine();
        printer.setTextSize(1, 1);
        printer.println("CUADRE DIARIO");
        printer.setTextNormal();
        printer.println(day);
        printer.drawLine();

        printer.alignLeft();
        printer.println(`SALDO INICIAL: ${formatMoney(opening)}`);
        printer.println(`INGRESOS:      ${formatMoney(incomeTotal)}`);
        printer.println(`GASTOS:        ${formatMoney(expensesTotal)}`);
        printer.println(`BALANCE:       ${formatMoney(balance)}`);
        printer.drawLine();
        printer.setTextSize(1, 1);
        printer.println(`SALDO ESPERADO: ${formatMoney(expectedCash)}`);
        printer.setTextNormal();
        printer.drawLine();

        printer.alignLeft();
        printer.println("ENTRADAS (TICKETS)");
        printer.drawLine();
        if (movements.length === 0) {
            printer.println("Sin movimientos");
        } else {
            for (const m of movements) {
                const amount = Number(m.amount_paid) || 0;
                const plate = m.plate ? String(m.plate) : "SIN PLACA";
                const time = formatTime(m.exit_time);
                printer.println(`${time} ${plate} ${formatMoney(amount)}`);
            }
        }
        printer.drawLine();

        printer.alignLeft();
        printer.println("SALIDAS (GASTOS)");
        printer.drawLine();
        if (expenses.length === 0) {
            printer.println("Sin gastos");
        } else {
            for (const e of expenses) {
                const amount = Number(e.amount) || 0;
                const desc = e.description ? String(e.description) : "";
                const time = formatTime(e.created_at);
                const line = `${time} ${desc}`.trim();
                printer.println(line);
                printer.println(`${formatMoney(amount)}`);
            }
        }
        printer.drawLine();

        printer.alignCenter();
        printer.println("Fin del reporte");
        printer.cut();

        await printDirectToUsb(printer);

        res.send({ success: true });
    } catch (error) {
        console.error("Error en endpoint /print-cash-report:", error);
        res.status(500).send({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () =>
    console.log(`Servidor de impresión corriendo en http://localhost:${PORT}`)
);
