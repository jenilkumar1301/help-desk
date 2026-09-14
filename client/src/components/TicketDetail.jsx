import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, ErrorMessage, Options, priorities, statuses, date } from "./shared";
export default function TicketDetail({ id, user, onBack, onChanged }) {
  const [ticket, setTicket] = useState(null), [comments, setComments] = useState([]), [activity, setActivity] = useState([]);
  const [users, setUsers] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true), [notice, setNotice] = useState("");
  const staff = user.role !== "employee";
  async function reload(signal) {
    const [detail, replies, history, people] = await Promise.all([
      api("/tickets/" + id, { signal }), api("/tickets/" + id + "/comments", { signal }),
      api("/tickets/" + id + "/activity", { signal }), staff ? api("/users", { signal }) : Promise.resolve([])
    ]);
    setTicket(detail); setComments(replies); setActivity(history); setUsers(people);
  }
  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal).catch(err => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, staff]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const input = Object.fromEntries(new FormData(event.currentTarget));
    input.assigneeId = input.assigneeId ? Number(input.assigneeId) : null;
    try {
      const updated = await api("/tickets/" + id, { method: "PATCH", body: JSON.stringify(input) });
      setTicket(updated); onChanged(updated); setNotice("Ticket updated.");
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function comment(event) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/tickets/" + id + "/comments", { method: "POST", body: JSON.stringify({ body: new FormData(form).get("body") }) });
      form.reset(); setNotice("Comment added."); await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="tickets">
    <button onClick={onBack}>← Back to tickets</button>
    <ErrorMessage error={error} />
    {loading ? <p>Loading ticket…</p> : ticket && <>
      <div className="detail-heading"><p className="eyebrow">TICKET #{id}</p><h2>{ticket.title}</h2></div>
      <div className="badges"><Badge value={ticket.priority} /><Badge value={ticket.status} /></div>
      <p className="preserve">{ticket.description}</p>
      <p>{ticket.category} · Requested by {ticket.requester_name} · {date(ticket.created_at)}</p>
      <p>Assigned to: {ticket.assignee_name || "Unassigned"}</p>
      <p role="status">{notice}</p>
      {staff && <form onSubmit={save}>
        <fieldset disabled={busy} className="form-row">
          <label>Status<select name="status" defaultValue={ticket.status} key={"s" + ticket.status}><Options values={statuses} /></select></label>
          <label>Priority<select name="priority" defaultValue={ticket.priority} key={"p" + ticket.priority}><Options values={priorities} /></select></label>
          <label>Technician<select name="assigneeId" defaultValue={ticket.assignee_id || ""} key={"a" + ticket.assignee_id}>
            <option value="">Unassigned</option>{users.filter(x => x.role !== "employee").map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select></label>
        </fieldset>
        <button className="primary" disabled={busy}>Save changes</button>
      </form>}
      <div className="detail-grid">
        <section><h3>Conversation</h3>
          {comments.length === 0 && <p>No comments yet.</p>}
          {comments.map(x => <article className="comment" key={x.id}><strong>{x.author_name}</strong><small> · {date(x.created_at)}</small><p className="preserve">{x.body}</p></article>)}
          <form onSubmit={comment}><label>Add a comment<textarea name="body" rows={3} maxLength={5000} required /></label>
            <button disabled={busy} className="primary">Post comment</button></form>
        </section>
        <section><h3>Activity history</h3>
          {activity.length === 0 && <p>No recorded changes. Older tickets may predate activity tracking.</p>}
          <ol className="timeline">{activity.map(x => <li key={x.id}><strong>{x.message}</strong><small>{x.author_name} · {date(x.created_at)}</small></li>)}</ol>
        </section>
      </div>
    </>}
  </section>;
}
