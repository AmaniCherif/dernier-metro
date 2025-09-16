const express = require("express");
const app = express();

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// GET /health
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Fonction de calcul du prochain métro
function nextArrival(now = new Date(), headwayMin = 3) {
  const tz = "Europe/Paris";
  const toHM = d =>
    String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

  const end = new Date(now);
  end.setHours(1, 15, 0, 0); // 01:15
  const lastWindow = new Date(now);
  lastWindow.setHours(0, 45, 0, 0); // 00:45

  if (now > end || now < new Date(now.setHours(5, 30, 0, 0))) {
    return { service: "closed", tz };
  }

  const next = new Date(now.getTime() + headwayMin * 60 * 1000);
  return { nextArrival: toHM(next), isLast: now >= lastWindow, headwayMin, tz };
}

// GET /next-metro
app.get("/next-metro", (req, res) => {
  const station = req.query.station;
  if (!station) {
    return res.status(400).json({ error: "missing station" });
  }

  const data = nextArrival(new Date(), 3);
  if (data.service === "closed") {
    return res.json({ station, service: "closed", tz: data.tz });
  }

  res.json({
    station,
    line: "M1",
    ...data,
  });
});

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Lancement serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dernier Metro API running on port ${PORT}`);
});
