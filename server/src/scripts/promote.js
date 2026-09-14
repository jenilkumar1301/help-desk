import "dotenv/config";
import db from "../database.js";
const email = process.argv[2]?.trim().toLowerCase();
const role = process.argv[3] || "admin";
try {
  if (!email || !["employee", "technician", "admin"].includes(role)) {
    throw new Error("Usage: npm run promote -- user@example.com [admin|technician|employee]");
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) throw new Error("Register the account in the app first.");
  if (user.role === "admin" && role !== "admin" &&
      db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n <= 1) {
    throw new Error("Cannot demote the last administrator.");
  }
  db.transaction(() => {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, user.id);
    if (role === "employee") {
      for (const ticket of db.prepare("SELECT id FROM tickets WHERE assignee_id = ?").all(user.id)) {
        db.prepare("INSERT INTO activity (ticket_id, user_id, message) VALUES (?, ?, ?)")
          .run(ticket.id, user.id, "Assignment cleared by local role administration");
      }
      db.prepare("UPDATE tickets SET assignee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assignee_id = ?").run(user.id);
    }
  })();
  console.log("Account role updated. Refresh the app to see the change.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }
