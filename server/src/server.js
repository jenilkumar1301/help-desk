import app from "./app.js";
import db from "./database.js";
const server = app.listen(process.env.PORT || 4000, () => console.log("Help Desk API is ready."));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
