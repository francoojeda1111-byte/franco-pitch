# Pitch Marketing

Sitio y herramientas de **Pitch Marketing Chile**.

## Contenido del repositorio

| Carpeta / archivo | Qué es |
|---|---|
| `index.html` | Landing page pública de Pitch Marketing Chile |
| `app/` | **Pitch Ventas** — App para el Ejecutivo en Ventas (teléfono y PC) |

## Pitch Ventas (`app/`)

App web instalable (PWA) que funciona en teléfono y PC, sin servidor ni base de datos: todos los datos se guardan en el propio dispositivo (localStorage) y funciona offline una vez cargada.

### Secciones

- **Inicio** — Login sin fricción: nombre + RUT (opcionales) o simplemente "Ingresar". Resumen del día: ventas, comisiones, jornada y frase motivacional.
- **Ventas** — Registro de cada venta (plan 40 → $39.990 / plan 50 → $49.990), comuna donde se hizo (Traiguén, Puerto Montt, Lanco, Galvarino, Villarrica, Pitrufquén, Victoria, Lautaro, Temuco, Valdivia y 45 más), medio de pago y ranking de ventas por comuna.
- **Metas** — Meta semanal progresiva (mínimo 10 por semana, 2 al día; sube cada semana), plan día a día, jornada laboral 9:00–21:00 con línea de tiempo en vivo, contador de comisiones (50% por venta: $20.000 / $25.000) y proyecciones (10 ventas en 4 días, 25 en 2 semanas, etc.).
- **Descuentos** — Anclaje de precio $350.000 → $39.990 (-89%), desglose en ~$1.500 por servicio / $110 al día, los 26 servicios incluidos y calculadora de descuentos.
- **Objeciones** — Chat automático: escribes la objeción del cliente ("no tengo plata", "lo hablo con mi pareja", "voy a hacer algo y vuelvo"…) y responde al instante con el quiebre exacto + cierre con doble alternativa. Incluye manual con 12 objeciones y técnicas.
- **Feedback** — Regla de oro, 12 mandamientos del vendedor y diario de aprendizaje / ventas perdidas.

### Cómo usarla

- **En línea:** publica el repo con GitHub Pages (Settings → Pages → rama principal, carpeta `/root`) y entra a `https://<usuario>.github.io/<repo>/app/`.
- **Instalar en el teléfono:** abre la URL en Chrome/Safari → menú → "Agregar a pantalla de inicio". Queda como app con ícono propio y funciona offline.
- **Local:** `npx http-server` en la raíz del repo y abre `http://localhost:8080/app/`.
