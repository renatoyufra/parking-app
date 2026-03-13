## Autoarranque en Windows (API + Dashboard + Print Server)

### Opción A (recomendada): Programador de tareas (Task Scheduler)

1. Abrir **Programador de tareas**.
2. Crear tarea (no “tarea básica”).
3. Pestaña **General**:
   - Nombre: `MR COCHE - Servidores`
   - Marcar: **Ejecutar con los privilegios más altos**
   - Configurar para: tu Windows
4. Pestaña **Desencadenadores**:
   - Nuevo…
   - Iniciar la tarea: **Al iniciar sesión** (del usuario que usa el sistema)
   - Opcional: “Retrasar la tarea” 10–30 segundos
5. Pestaña **Acciones**:
   - Nueva…
   - Acción: **Iniciar un programa**
   - Programa: `D:\6-TRABAJO\PROYECTO MR COCHE\app\scripts\start-all.cmd`
6. Guardar.

Esto levanta:
- API: `http://localhost:4000`
- Print Server: `http://localhost:3000`
- Dashboard:
  - Si existe `dist\parking-dashboard\server\server.mjs` levanta SSR.
  - Si no existe, levanta `ng serve` (modo dev).

### Opción B: carpeta “Inicio” (Startup folder)

1. `Win + R` → escribir: `shell:startup`
2. Crear un acceso directo a:
   - `D:\6-TRABAJO\PROYECTO MR COCHE\app\scripts\start-all.cmd`

Nota: esta opción suele requerir que el usuario inicie sesión.

### Recomendación para producción (más estable)

1. En `parking-dashboard`, ejecutar una vez:
   - `npm run build`
2. En los siguientes reinicios, el script detectará el build y usará SSR.

