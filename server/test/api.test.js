import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";

// Tests never touch the app's on-disk database or use reusable credentials.
process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
const { default: app } = await import("../src/app.js");
const { default: db } = await import("../src/database.js");
let server, base, employee, other, technician, admin, ticket, asset;
const password = randomBytes(24).toString("hex");
async function request(path, method = "GET", body, token) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, data: await response.json() };
}
async function register(name, role = "employee") {
  const result = await request("/auth/register", "POST", { name, email: name + "@example.test", password, role: "admin" });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.role, "employee", "Registration must ignore privileged role input");
  if (role !== "employee") db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, result.data.user.id);
  return result.data;
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port + "/api";
  employee = await register("employee");
  other = await register("other");
  technician = await register("technician", "technician");
  admin = await register("admin", "admin");
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });

test("authentication and validation", async () => {
  assert.equal((await request("/health")).status, 200);
  assert.equal((await request("/tickets")).status, 401);
  assert.equal((await request("/tickets", "GET", undefined, "invalid")).status, 401);
  assert.equal((await request("/auth/register", "POST", { name: 4, email: {}, password: [] })).status, 400);
  assert.equal((await request("/auth/login", "POST", { email: "employee@example.test", password: randomBytes(12).toString("hex") })).status, 401);
  assert.equal((await request("/auth/login", "POST", { email: "employee@example.test", password })).status, 200);
  assert.equal((await request("/auth/register", "POST", { name: "duplicate", email: "employee@example.test", password })).status, 409);
  assert.equal((await request("/auth/me", "GET", undefined, technician.token)).data.role, "technician");
});

test("ticket lifecycle, ownership, comments, and activity", async () => {
  let result = await request("/tickets", "POST", { title: "VPN connection", description: "Cannot reach internal tools", category: "Network", priority: "high" }, employee.token);
  assert.equal(result.status, 201); ticket = result.data;
  assert.equal(ticket.requester_id, employee.user.id);
  assert.equal((await request("/tickets", "POST", { title: 5 }, employee.token)).status, 400);
  assert.equal((await request("/tickets?status=open&status=closed", "GET", undefined, employee.token)).status, 400);
  assert.equal((await request("/tickets?search=VPN&priority=high", "GET", undefined, employee.token)).data.length, 1);
  assert.equal((await request("/tickets", "GET", undefined, other.token)).data.length, 0);
  for (const suffix of ["", "/comments", "/activity"]) {
    assert.equal((await request("/tickets/" + ticket.id + suffix, "GET", undefined, other.token)).status, 403);
  }
  assert.equal((await request("/tickets/" + ticket.id + "/comments", "POST", { body: "Forbidden" }, other.token)).status, 403);
  assert.equal((await request("/tickets/" + ticket.id, "PATCH", { status: "closed" }, employee.token)).status, 403);
  assert.equal((await request("/tickets/" + ticket.id, "PATCH", { status: "bad" }, technician.token)).status, 400);
  assert.equal((await request("/tickets/" + ticket.id, "PATCH", { assigneeId: employee.user.id }, technician.token)).status, 400);
  result = await request("/tickets/" + ticket.id, "PATCH", { status: "in_progress", assigneeId: technician.user.id }, technician.token);
  assert.equal(result.status, 200); assert.equal(result.data.assignee_id, technician.user.id);
  result = await request("/tickets/" + ticket.id + "/comments", "POST", { body: "Checking the VPN profile." }, technician.token);
  assert.equal(result.status, 201); assert.equal(result.data.author_name, "technician");
  assert.equal((await request("/tickets/" + ticket.id + "/comments", "GET", undefined, employee.token)).data.length, 1);
  result = await request("/tickets/" + ticket.id + "/activity", "GET", undefined, employee.token);
  assert.equal(result.data.length, 4);
  result = await request("/tickets/" + ticket.id, "PATCH", { status: "resolved", assigneeId: null }, technician.token);
  assert.equal(result.data.status, "resolved"); assert.equal(result.data.assignee_id, null);
  assert.equal((await request("/tickets/999999", "GET", undefined, employee.token)).status, 404);
});

test("asset inventory enforces staff writes and employee visibility", async () => {
  const input = { tag: "IT-001", name: "Work laptop", type: "Laptop", status: "assigned", assigned_to: employee.user.id, notes: "Test equipment" };
  assert.equal((await request("/assets", "POST", input, employee.token)).status, 403);
  let result = await request("/assets", "POST", input, technician.token);
  assert.equal(result.status, 201); asset = result.data;
  assert.equal((await request("/assets", "POST", input, technician.token)).status, 409);
  assert.equal((await request("/assets", "GET", undefined, employee.token)).data.length, 1);
  assert.equal((await request("/assets", "GET", undefined, other.token)).data.length, 0);
  assert.equal((await request("/assets/" + asset.id, "PUT", { ...input, assigned_to: 999999 }, technician.token)).status, 400);
  assert.equal((await request("/assets/" + asset.id, "PUT", { ...input, status: "retired" }, technician.token)).status, 400);
  result = await request("/assets/" + asset.id, "PUT", { ...input, status: "retired", assigned_to: null }, technician.token);
  assert.equal(result.status, 200); assert.equal(result.data.status, "retired");
  assert.equal((await request("/assets", "GET", undefined, employee.token)).data.length, 0);
});

test("role management rejects escalation and immediately applies demotion", async () => {
  assert.equal((await request("/users", "GET", undefined, employee.token)).status, 403);
  assert.equal((await request("/users/" + other.user.id + "/role", "PATCH", { role: "admin" }, technician.token)).status, 403);
  assert.equal((await request("/users/" + admin.user.id + "/role", "PATCH", { role: "employee" }, admin.token)).status, 400);
  assert.equal((await request("/users/" + technician.user.id + "/role", "PATCH", { role: "employee" }, admin.token)).status, 200);
  assert.equal((await request("/auth/me", "GET", undefined, technician.token)).data.role, "employee");
  assert.equal((await request("/users", "GET", undefined, technician.token)).status, 403);
});

test("JSON errors and unknown endpoints return useful status codes", async () => {
  assert.equal((await request("/tickets", "POST", [], employee.token)).status, 400);
  const response = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(response.status, 400);
  assert.equal((await request("/missing")).status, 404);
});
