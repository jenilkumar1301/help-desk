import { Router } from "express";
import db from "../database.js";
import { requireAuth, requireTechnician } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);
const select = `SELECT assets.*, users.name AS assigned_name FROM assets LEFT JOIN users ON users.id = assets.assigned_to`;
router.get("/", (req, res) => {
  res.json(db.prepare(select + (req.user.role === "employee" ? " WHERE assigned_to = ?" : "") +
    " ORDER BY assets.id DESC").all(...(req.user.role === "employee" ? [req.user.id] : [])));
});
function validate(input) {
  if (!input || typeof input.tag !== "string" || !input.tag.trim() || input.tag.length > 60 ||
      typeof input.name !== "string" || !input.name.trim() || input.name.length > 150 ||
      !["Laptop", "Desktop", "Monitor", "Phone", "Network", "Other"].includes(input.type) ||
      !["available", "assigned", "maintenance", "retired"].includes(input.status) ||
      typeof input.notes !== "string" || input.notes.length > 2000) return "Check the asset fields and text lengths.";
  if (input.status === "assigned") {
    if (!Number.isSafeInteger(input.assigned_to) || !db.prepare("SELECT id FROM users WHERE id = ?").get(input.assigned_to)) {
      return "Assigned assets need a valid owner.";
    }
  } else if (input.assigned_to !== null) return "Only assigned assets may have an owner.";
}
router.post("/", requireTechnician, (req, res) => {
  const input = req.body;
  const error = validate(input);
  if (error) return res.status(400).json({ message: error });
  const result = db.prepare("INSERT INTO assets (tag, name, type, status, assigned_to, notes) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.tag.trim(), input.name.trim(), input.type, input.status, input.assigned_to, input.notes.trim());
  res.status(201).json(db.prepare(select + " WHERE assets.id = ?").get(result.lastInsertRowid));
});
router.put("/:id", requireTechnician, (req, res) => {
  if (!db.prepare("SELECT id FROM assets WHERE id = ?").get(req.params.id)) return res.status(404).json({ message: "Asset not found." });
  const input = req.body;
  const error = validate(input);
  if (error) return res.status(400).json({ message: error });
  db.prepare("UPDATE assets SET tag = ?, name = ?, type = ?, status = ?, assigned_to = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(input.tag.trim(), input.name.trim(), input.type, input.status, input.assigned_to, input.notes.trim(), req.params.id);
  res.json(db.prepare(select + " WHERE assets.id = ?").get(req.params.id));
});
export default router;
