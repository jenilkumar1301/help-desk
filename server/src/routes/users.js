import { Router } from "express";
import db from "../database.js";
import { requireAuth, requireTechnician, requireAdmin } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth, requireTechnician);
router.get("/", (_req, res) => {
  res.json(db.prepare("SELECT id, name, email, role FROM users ORDER BY name").all());
});
router.patch("/:id/role", requireAdmin, (req, res) => {
  const role = req.body?.role;
  const id = Number(req.params.id);
  if (!["employee", "technician", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role." });
  if (id === req.user.id) return res.status(400).json({ message: "You cannot change your own role." });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ message: "User not found." });
  db.transaction(() => {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
    if (role === "employee") {
      const tickets = db.prepare("SELECT id FROM tickets WHERE assignee_id = ?").all(id);
      for (const ticket of tickets) db.prepare("INSERT INTO activity (ticket_id, user_id, message) VALUES (?, ?, ?)")
        .run(ticket.id, req.user.id, "Assignment cleared after staff role change");
      db.prepare("UPDATE tickets SET assignee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assignee_id = ?").run(id);
    }
  })();
  res.json(db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(id));
});
export default router;
