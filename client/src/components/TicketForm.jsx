import { useState } from "react";
import { api } from "../api";
import { categories, priorities, Options, ErrorMessage } from "./shared";
export default function TicketForm({ onCreated, onCancel }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { onCreated(await api("/tickets", { method: "POST", body: JSON.stringify(data) })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <form className="ticket-form" onSubmit={submit}>
    <h2>New support request</h2><p>Tell IT what happened and what you have tried.</p>
    <label>Title<input name="title" maxLength={200} required /></label>
    <label>Description<textarea name="description" rows={5} maxLength={10000} required /></label>
    <div className="form-row">
      <label>Category<select name="category"><Options values={categories} /></select></label>
      <label>Priority<select name="priority" defaultValue="medium"><Options values={priorities} /></select></label>
    </div>
    <ErrorMessage error={error} />
    <div className="actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Submitting…" : "Submit ticket"}</button></div>
  </form>;
}
