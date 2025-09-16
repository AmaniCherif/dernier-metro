const express = require("express");
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const app = express();

// ---- ENV ----
const HEADWAY_MIN = parseInt(process.env.HEADWAY_MIN) || 3;
const LAST_WINDOW_START = process.env.LAST_WINDOW_START || "00:45";
const SERVICE_END = process.env.SERVICE_END || "01:15";

// ---- Swagger ----
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Dernier Metro API",
      version: "1.0.0",
      description: "API pour savoir si on peut attraper le dernier métro à Paris"
    },
    servers: [{ url: "http://localhost:3000" }]
  },
  apis: ["./server.js"]
};
const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ---- Logger ----
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ---- Helpers ----
function parseHHMM(str, defaultTime = "00:00") {
  if (!str) str = defaultTime;
  const [h, m] = str.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function nextArrival(now = new Date(), headwayMin = HEADWAY_MIN) {
  const tz = "Europe/Paris";
  const end = parseHHMM(SERVICE_END);
  const lastWindow = parseHHMM(LAST_WINDOW_START);
  const start = parseHHMM("05:30");

  if (now < start || now > end) return { service: "closed", tz };

  const next = new Date(now.getTime() + headwayMin * 60 * 1000);
  return {
    nextArrival: `${String(next.getHours()).padStart(2,'0')}:${String(next.getMinutes()).padStart(2,'0')}`,
    isLast: now >= lastWindow,
    headwayMin,
    tz
  };
}

// ---- Routes ----
app.get("/health", (req, res) => res.json({ status: "ok" }));

/**
 * @swagger
 * /next-metro:
 *   get:
 *     summary: Retourne le ou les prochains passages d'une station
 *     parameters:
 *       - in: query
 *         name: station
 *         schema:
 *           type: string
 *         required: true
 *         description: Nom de la station
 *       - in: query
 *         name: n
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         required: false
 *         description: Nombre de prochains passages
 *     responses:
 *       200:
 *         description: Succès
 *       400:
 *         description: Paramètre station manquant
 *       404:
 *         description: Station inconnue
 */
app.get("/next-metro", (req, res) => {
  const station = req.query.station;
  let n = parseInt(req.query.n) || 1;
  n = Math.min(Math.max(n, 1), 5);

  if (!station) return res.status(400).json({ error: "missing station" });

  const passages = [];
  let now = new Date();
  for (let i = 0; i < n; i++) {
    const next = nextArrival(now);
    passages.push(next);
    now = parseHHMM(next.nextArrival);
  }

  res.json({ station, line: "M1", passages });
});

// ---- 404 ----
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// ---- Lancer serveur ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dernier Metro API running on port ${PORT}`));
