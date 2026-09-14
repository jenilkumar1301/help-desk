import { useEffect, useState } from "react";
import { api } from "../api";
import { Options, ErrorMessage } from "./shared";
export default function Users({ user }) {
  const [people, setPeople] = useState([]), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("/users", { signal: controller.signal }).then(setPeople)
      .catch(err => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function save(event, id) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const role = new FormData(event.currentTarget).get("role");
    try {
      const updated = await api("/users/" + id + "/role", { method: "PATCH", body: JSON.stringify({ role }) });
      setPeople(current => current.map(x => x.id === id ? updated : x)); setNotice("Role saved.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="tickets"><h2>People and roles</h2><p>Employees register themselves. Only administrators can grant staff access.</p>
    <ErrorMessage error={error} /><p role="status">{notice}</p>
    {loading ? <p>Loading people…</p> : people.map(person => <article className="ticket" key={person.id}>
      <div><h3>{person.name}</h3><p>{person.email}</p></div>
      {person.id === user.id ? <p>Administrator (you)</p> :
      <form className="role-form" onSubmit={e => save(e, person.id)}><label>Role for {person.name}<select name="role" defaultValue={person.role}><Options values={["employee", "technician", "admin"]} /></select></label><button disabled={busy}>Save role</button></form>}
    </article>)}
  </section>;
}
