import jwt from "jsonwebtoken";
import db from "../database.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required." });
  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ message: "Invalid or expired session. Please sign in again." });
  }
  // Read the current role so a demotion takes effect without waiting for token expiry.
  req.user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(payload.id);
  if (!req.user) return res.status(401).json({ message: "Account not found." });
  next();
}

export function requireTechnician(req, res, next) {
  if (!["technician", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Technician access required." });
  }
  next();
}
export function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Administrator access required." });
  next();
}
