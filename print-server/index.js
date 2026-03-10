const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");
const usb = require("usb");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
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
        printer.println("ESTACIONAMIENTO MR COCHE");
        printer.println("JERONIMO SALGUERO 2922 - TACNA");
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

            // QR más grande ( cellSize: 10 )
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
                printer.setTextNormal();
            }
            printer.println(`TIPO: ${vehicle.type.toUpperCase()}`);

            printer.newLine();
            printer.println("LA PRIMERA HORA SE ABONA COMPLETA");
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
            printer.println(`TIEMPO: ${exitInfo.duration} min`);
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

const PORT = 3000;
app.listen(PORT, () =>
    console.log(`Servidor de impresión corriendo en http://localhost:${PORT}`)
);
