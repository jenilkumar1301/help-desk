import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorMessage, Options, Badge } from "./shared";
const types = ["Laptop", "Desktop", "Monitor", "Phone", "Network", "Other"];
const states = ["available", "assigned", "maintenance", "retired"];
function AssetForm({ asset, people, onSaved, onCancel }) {
  const [status, setStatus] = useState(asset?.status || "available");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const input = Object.fromEntries(new FormData(event.currentTarget));
    input.assigned_to = status === "assigned" ? Number(input.assigned_to) : null;
    try {
      const result = await api("/assets" + (asset ? "/" + asset.id : ""), { method: asset ? "PUT" : "POST", body: JSON.stringify(input) });
      onSaved(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <form className="ticket-form" onSubmit={submit}><h2>{asset ? "Edit asset" : "Add equipment"}</h2><p>Retire equipment to keep its record without deleting it.</p>
    <fieldset disabled={busy}>
      <div className="form-row">
        <label>Asset tag<input name="tag" defaultValue={asset?.tag} maxLength={60} required /></label>
        <label>Name / model<input name="name" defaultValue={asset?.name} maxLength={150} required /></label>
      </div>
      <div className="form-row">
        <label>Type<select name="type" defaultValue={asset?.type || "Laptop"}><Options values={types} /></select></label>
        <label>Status<select name="status" value={status} onChange={e => setStatus(e.target.value)}><Options values={states} /></select></label>
        {status === "assigned" && <label>Assigned employee<select name="assigned_to" defaultValue={asset?.assigned_to || ""} required><option value="">Choose a person</option>{people.map(x => <option key={x.id} value={x.id}>{x.name} ({x.email})</option>)}</select></label>}
      </div>
      <label>Notes<textarea name="notes" maxLength={2000} defaultValue={asset?.notes || ""} /></label>
      <ErrorMessage error={error} />
      <div className="actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary">Save asset</button></div>
    </fieldset>
  </form>;
}
export default function Assets({ user }) {
  const [assets, setAssets] = useState([]), [people, setPeople] = useState([]);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(undefined), [query, setQuery] = useState("");
  const staff = user.role !== "employee";
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api("/assets", { signal: controller.signal }), staff ? api("/users", { signal: controller.signal }) : Promise.resolve([])])
      .then(([items, users]) => { setAssets(items); setPeople(users); })
      .catch(err => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [staff]);
  if (editing !== undefined) return <AssetForm asset={editing} people={people} onCancel={() => setEditing(undefined)}
    onSaved={item => { setAssets(current => [item, ...current.filter(x => x.id !== item.id)]); setEditing(undefined); }} />;
  const visible = assets.filter(x => [x.tag, x.name, x.status, x.assigned_name || ""].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <section className="tickets"><div className="section-heading"><div><h2>{staff ? "Asset inventory" : "My equipment"}</h2><p>{assets.length} equipment records</p></div>
    {staff && <button className="primary" disabled={loading || !!error} onClick={() => setEditing(null)}>Add asset</button>}</div>
    <ErrorMessage error={error} />
    <label>Search equipment<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tag, model, status, or owner" /></label>
    {loading ? <p>Loading assets…</p> : !visible.length ? <p className="empty">No equipment found.</p> :
      <div className="table-scroll"><table><thead><tr><th>Tag / model</th><th>Type</th><th>Status</th><th>Owner</th><th>Notes</th>{staff && <th>Action</th>}</tr></thead>
        <tbody>{visible.map(x => <tr key={x.id}><td><strong>{x.tag}</strong><br />{x.name}</td><td>{x.type}</td><td><Badge value={x.status} /></td><td>{x.assigned_name || "—"}</td><td className="preserve">{x.notes || "—"}</td>{staff && <td><button onClick={() => setEditing(x)} aria-label={"Edit " + x.tag}>Edit</button></td>}</tr>)}</tbody></table></div>}
  </section>;
}
