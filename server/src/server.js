import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import "./database.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET must be set before starting the API.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "help-desk-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

app.listen(port, () => {
  console.log(`Help Desk API running at http://localhost:${port}`);
});
