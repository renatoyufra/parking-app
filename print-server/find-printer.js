const usb = require("usb");

console.log("Buscando dispositivos USB...");
const devices = usb.getDeviceList();

if (devices.length === 0) {
    console.log("No se encontraron dispositivos USB.");
} else {
    console.log("Dispositivos encontrados:");
    devices.forEach((device, i) => {
        try {
            console.log(`
--- Dispositivo #${i + 1} ---`);
            console.log(
                `  ID de Vendedor (vendorId): ${device.deviceDescriptor.idVendor.toString(
                    16
                )}`
            );
            console.log(
                `  ID de Producto (productId): ${device.deviceDescriptor.idProduct.toString(
                    16
                )}`
            );

            // Intentamos obtener el nombre del fabricante y producto
            device.open();
            device.getStringDescriptor(
                device.deviceDescriptor.iManufacturer,
                (err, manufacturer) => {
                    if (!err && manufacturer)
                        console.log(`  Fabricante: ${manufacturer}`);
                    device.getStringDescriptor(
                        device.deviceDescriptor.iProduct,
                        (err, product) => {
                            if (!err && product)
                                console.log(`  Producto: ${product}`);
                            device.close();
                        }
                    );
                }
            );
        } catch (e) {
            console.log(`  No se pudo acceder al dispositivo: ${e.message}`);
        }
    });
}
