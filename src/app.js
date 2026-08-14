const express = require("express");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const betRoutes = require("./routes/betRoutes");
const teamRoutes = require("./routes/teamRoutes");
const superRoutes = require("./routes/superRoutes");
const { globalLimiter } = require("./middleware/rateLimit");

const app = express();
const publicDir = path.join(__dirname, "..", "public");

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(globalLimiter);
app.use(express.static(publicDir, { redirect: false }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/api", betRoutes);
app.use("/team", teamRoutes);
app.use("/super", superRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

module.exports = app;