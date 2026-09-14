import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../database.js";

const router = Router();
const publicUser = "id, name, email, role, created_at";

function issueToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

router.post("/register", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;

  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      message: "Name, email, and a password of at least 8 characters are required."
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
    ).run(name, email, passwordHash);

    const user = db.prepare(`SELECT ${publicUser} FROM users WHERE id = ?`)
      .get(result.lastInsertRowid);

    return res.status(201).json({ token: issueToken(user), user });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "An account with that email already exists." });
    }
    throw error;
  }
});

router.post("/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || typeof req.body?.password !== "string") {
    return res.status(400).json({ message: "Email and password are required." });
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user || !(await bcrypt.compare(req.body.password || "", user.password_hash))) {
    return res.status(401).json({ message: "Incorrect email or password." });
  }

  const { password_hash, ...safeUser } = user;
  return res.json({ token: issueToken(safeUser), user: safeUser });
});

export default router;
