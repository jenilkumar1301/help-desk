import { Router } from "express";
import db from "../database.js";
import { requireAuth, requireTechnician } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const ticketSelect = `
  SELECT tickets.*, requester.name AS requester_name,
         assignee.name AS assignee_name
  FROM tickets
  JOIN users requester ON requester.id = tickets.requester_id
  LEFT JOIN users assignee ON assignee.id = tickets.assignee_id
`;

router.get("/", (req, res) => {
  const { status, priority, search } = req.query;
  const filters = [];
  const values = [];

  if (req.user.role === "employee") {
    filters.push("tickets.requester_id = ?");
    values.push(req.user.id);
  }
  if (status) {
    filters.push("tickets.status = ?");
    values.push(status);
  }
  if (priority) {
    filters.push("tickets.priority = ?");
    values.push(priority);
  }
  if (search) {
    filters.push("(tickets.title LIKE ? OR tickets.description LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
  const tickets = db.prepare(ticketSelect + where + " ORDER BY tickets.created_at DESC")
    .all(...values);

  res.json(tickets);
});

router.post("/", (req, res) => {
  const { title, description, category = "Other", priority = "medium" } = (req.body || {});

  if (typeof title !== "string" || !title.trim() || title.length > 200 || typeof description !== "string" || !description.trim() || description.length > 10000 || !["low", "medium", "high", "urgent"].includes(priority) || !["Hardware", "Software", "Network", "Access", "Other"].includes(category)) {
    return res.status(400).json({ message: "Title and description are required." });
  }

  const result = db.prepare(`
    INSERT INTO tickets (title, description, category, priority, requester_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(title.trim(), description.trim(), category, priority, req.user.id);

  const ticket = db.prepare(ticketSelect + " WHERE tickets.id = ?")
    .get(result.lastInsertRowid);
  res.status(201).json(ticket);
});

router.patch("/:id", requireTechnician, (req, res) => {
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found." });

  const status = req.body.status ?? ticket.status;
  const priority = req.body.priority ?? ticket.priority;
  const assigneeId = req.body.assigneeId === undefined ? ticket.assignee_id : req.body.assigneeId;
  if (!["open", "in_progress", "resolved", "closed"].includes(status) ||
      !["low", "medium", "high", "urgent"].includes(priority)) {
    return res.status(400).json({ message: "Invalid status or priority." });
  }
  if (assigneeId !== null && (!Number.isInteger(assigneeId) ||
      !db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('technician', 'admin')").get(assigneeId))) {
    return res.status(400).json({ message: "Assignee must be a technician." });
  }

  db.prepare(`
    UPDATE tickets
    SET status = ?, priority = ?, assignee_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, priority, assigneeId, req.params.id);

  res.json(db.prepare(ticketSelect + " WHERE tickets.id = ?").get(req.params.id));
});

router.get("/:id/comments", (req, res) => {
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found." });
  if (req.user.role === "employee" && ticket.requester_id !== req.user.id) {
    return res.status(403).json({ message: "You cannot access this ticket." });
  }
  const comments = db.prepare(`
    SELECT comments.*, users.name AS author_name, users.role AS author_role
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE ticket_id = ? ORDER BY comments.created_at
  `).all(req.params.id);
  res.json(comments);
});

router.post("/:id/comments", (req, res) => {
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body || body.length > 5000) return res.status(400).json({ message: "Comment cannot be empty." });

  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found." });
  if (req.user.role === "employee" && ticket.requester_id !== req.user.id) {
    return res.status(403).json({ message: "You cannot access this ticket." });
  }

  const result = db.prepare(
    "INSERT INTO comments (ticket_id, user_id, body) VALUES (?, ?, ?)"
  ).run(req.params.id, req.user.id, body);

  res.status(201).json(db.prepare("SELECT * FROM comments WHERE id = ?")
    .get(result.lastInsertRowid));
});

export default router;
