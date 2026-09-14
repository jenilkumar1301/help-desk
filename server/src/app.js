import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import assetRoutes from "./routes/assets.js";
import userRoutes from "./routes/users.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Set JWT_SECRET to a random value of at least 32 characters.");
}
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "no-store");
  if (["POST", "PUT", "PATCH"].includes(req.method) &&
      (!req.body || Array.isArray(req.body) || typeof req.body !== "object")) {
    return res.status(400).json({ message: "Send a JSON object." });
  }
  next();
});

// A single-process demo limiter. Use a shared store when running multiple instances.
const attempts = new Map();
const cleanup = setInterval(() => {
  for (const [key, value] of attempts) if (value.until <= Date.now()) attempts.delete(key);
}, 60000);
cleanup.unref();
app.use("/api/auth", (req, res, next) => {
  if (req.method !== "POST") return next();
  const key = req.ip;
  let record = attempts.get(key);
  if (!record || record.until <= Date.now()) {
    record = { count: 0, until: Date.now() + 15 * 60000 };
    attempts.set(key, record);
  }
  if (++record.count > 30) {
    res.set("Retry-After", String(Math.ceil((record.until - Date.now()) / 1000)));
    return res.status(429).json({ message: "Too many sign-in attempts. Try again in 15 minutes." });
  }
  next();
});
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/users", userRoutes);
app.use((_req, res) => res.status(404).json({ message: "Endpoint not found." }));
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON." });
  if (error.type === "entity.too.large") return res.status(413).json({ message: "Request too large." });
  if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ message: "That value already exists. Use a unique email or asset tag." });
  console.error(error.message);
  res.status(500).json({ message: "Unexpected server error." });
});
export default app;
