import { Router } from "express";
import db from "../database.js";
import { requireAuth, requireTechnician } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
const priorities = ["low", "medium", "high", "urgent"];
const statuses = ["open", "in_progress", "resolved", "closed"];
const categories = ["Hardware", "Software", "Network", "Access", "Other"];
const select = `SELECT tickets.*, requester.name AS requester_name, assignee.name AS assignee_name
  FROM tickets JOIN users requester ON requester.id = tickets.requester_id
  LEFT JOIN users assignee ON assignee.id = tickets.assignee_id`;
const getTicket = id => db.prepare(select + " WHERE tickets.id = ?").get(id);
const log = (id, user, message) => db.prepare(
  "INSERT INTO activity (ticket_id, user_id, message) VALUES (?, ?, ?)"
).run(id, user, message);

router.get("/", (req, res) => {
  const filters = [], values = [];
  for (const key of ["status", "priority", "search"]) {
    if (req.query[key] !== undefined && typeof req.query[key] !== "string") {
      return res.status(400).json({ message: "Filters must be text." });
    }
  }
  if (req.user.role === "employee") { filters.push("tickets.requester_id = ?"); values.push(req.user.id); }
  for (const key of ["status", "priority"]) {
    if (req.query[key]) { filters.push("tickets." + key + " = ?"); values.push(req.query[key]); }
  }
  if (req.query.search) {
    filters.push("(tickets.title LIKE ? OR tickets.description LIKE ?)");
    values.push("%" + req.query.search + "%", "%" + req.query.search + "%");
  }
  res.json(db.prepare(select + (filters.length ? " WHERE " + filters.join(" AND ") : "") +
    " ORDER BY tickets.id DESC").all(...values));
});

router.post("/", (req, res) => {
  const { title, description, category = "Other", priority = "medium" } = req.body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 200 ||
      typeof description !== "string" || !description.trim() || description.length > 10000 ||
      !categories.includes(category) || !priorities.includes(priority)) {
    return res.status(400).json({ message: "Enter a title (1–200 characters), description (1–10000), and valid category and priority." });
  }
  const id = db.transaction(() => {
    const result = db.prepare("INSERT INTO tickets (title, description, category, priority, requester_id) VALUES (?, ?, ?, ?, ?)")
      .run(title.trim(), description.trim(), category, priority, req.user.id);
    log(result.lastInsertRowid, req.user.id, "Ticket created");
    return result.lastInsertRowid;
  })();
  res.status(201).json(getTicket(id));
});

// Apply the same ownership check to details, comments, activity, and updates.
router.use("/:id", (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid ticket ID." });
  req.ticket = getTicket(id);
  if (!req.ticket) return res.status(404).json({ message: "Ticket not found." });
  if (req.user.role === "employee" && req.ticket.requester_id !== req.user.id) {
    return res.status(403).json({ message: "You cannot access this ticket." });
  }
  next();
});

router.get("/:id", (req, res) => res.json(req.ticket));
router.patch("/:id", requireTechnician, (req, res) => {
  const input = req.body || {};
  const status = input.status === undefined ? req.ticket.status : input.status;
  const priority = input.priority === undefined ? req.ticket.priority : input.priority;
  const assignee = input.assigneeId === undefined ? req.ticket.assignee_id : input.assigneeId;
  if (!statuses.includes(status) || !priorities.includes(priority)) {
    return res.status(400).json({ message: "Invalid status or priority." });
  }
  const staff = assignee === null ? null : Number.isSafeInteger(assignee) &&
    db.prepare("SELECT id, name FROM users WHERE id = ? AND role IN ('technician','admin')").get(assignee);
  if (assignee !== null && !staff) return res.status(400).json({ message: "Choose a technician or leave unassigned." });
  db.transaction(() => {
    db.prepare("UPDATE tickets SET status = ?, priority = ?, assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(status, priority, assignee, req.ticket.id);
    if (status !== req.ticket.status) log(req.ticket.id, req.user.id, "Status: " + req.ticket.status + " → " + status);
    if (priority !== req.ticket.priority) log(req.ticket.id, req.user.id, "Priority: " + req.ticket.priority + " → " + priority);
    if (assignee !== req.ticket.assignee_id) log(req.ticket.id, req.user.id, "Assigned to " + (staff?.name || "nobody"));
  })();
  res.json(getTicket(req.ticket.id));
});
router.get("/:id/comments", (req, res) => {
  res.json(db.prepare(`SELECT comments.*, users.name AS author_name FROM comments
    JOIN users ON users.id = comments.user_id WHERE ticket_id = ? ORDER BY comments.id`).all(req.ticket.id));
});
router.post("/:id/comments", (req, res) => {
  const body = req.body?.body;
  if (typeof body !== "string" || !body.trim() || body.length > 5000) {
    return res.status(400).json({ message: "Comment must contain 1–5000 characters." });
  }
  const id = db.transaction(() => {
    const result = db.prepare("INSERT INTO comments (ticket_id, user_id, body) VALUES (?, ?, ?)").run(req.ticket.id, req.user.id, body.trim());
    db.prepare("UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.ticket.id);
    log(req.ticket.id, req.user.id, "Comment added");
    return result.lastInsertRowid;
  })();
  res.status(201).json(db.prepare(`SELECT comments.*, users.name AS author_name FROM comments
    JOIN users ON users.id = comments.user_id WHERE comments.id = ?`).get(id));
});
router.get("/:id/activity", (req, res) => {
  res.json(db.prepare(`SELECT activity.*, users.name AS author_name FROM activity
    JOIN users ON users.id = activity.user_id WHERE ticket_id = ? ORDER BY activity.id DESC`).all(req.ticket.id));
});
export default router;
