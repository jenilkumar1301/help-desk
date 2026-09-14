import { useEffect, useState } from "react";
import { api, clearSession } from "./api";
import Auth from "./components/Auth";
import TicketForm from "./components/TicketForm";
import TicketDetail from "./components/TicketDetail";
import Assets from "./components/Assets";
import Users from "./components/Users";
import { Badge, ErrorMessage, Options, priorities, statuses, categories, date } from "./components/shared";

function Workspace({ user, onLogout }) {
  const [page, setPage] = useState("tickets"), [selected, setSelected] = useState(null);
  const [tickets, setTickets] = useState([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(""), [status, setStatus] = useState(""), [priority, setPriority] = useState("");
  const [creating, setCreating] = useState(false);
  async function refresh(signal) {
    setLoading(true); setError("");
    try { setTickets(await api("/tickets", { signal })); }
    catch (err) { if (err.name !== "AbortError") setError(err.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController(); refresh(controller.signal);
    return () => controller.abort();
  }, []);
  function navigate(next) { setPage(next); setSelected(null); setCreating(false); }
  const visible = tickets.filter(x => (!status || x.status === status) && (!priority || x.priority === priority) &&
    [x.id, x.title, x.description, x.requester_name, x.assignee_name || ""].join(" ").toLowerCase().includes(query.toLowerCase()));
  const counts = Object.fromEntries(statuses.map(s => [s, tickets.filter(x => x.status === s).length]));
  return <div className="app-shell">
    <aside><div className="brand"><span>HD</span><strong>Help Desk</strong></div>
      <nav aria-label="Main navigation">
        {[["tickets", "Tickets"], ["assets", "Equipment"], ["analytics", "Overview"], ...(user.role === "admin" ? [["users", "People"]] : [])].map(([key, name]) =>
          <button key={key} className={page === key ? "active" : ""} aria-current={page === key ? "page" : undefined} onClick={() => navigate(key)}>{name}</button>)}
      </nav>
      <div className="profile"><div className="avatar">{user.name[0]}</div><div><strong>{user.name}</strong><small>{user.role}</small></div></div>
      <button onClick={onLogout}>Sign out</button>
    </aside>
    <main className="dashboard">
      <header><div><p className="eyebrow">SUPPORT CENTER</p><h1>Hello, {user.name.split(" ")[0]}</h1><p>{user.role === "employee" ? "Track your requests and assigned equipment." : "Manage your support queue and equipment."}</p></div>
        <button className="primary" onClick={() => { navigate("tickets"); setCreating(true); }}>＋ New ticket</button></header>
      {page === "assets" ? <Assets user={user} /> : page === "users" ? <Users user={user} /> : <>
        <section className="stats">
          <article><div><small>Open tickets</small><strong>{loading || error ? "—" : counts.open}</strong></div></article>
          <article><div><small>In progress</small><strong>{loading || error ? "—" : counts.in_progress}</strong></div></article>
          <article><div><small>Resolved / closed</small><strong>{loading || error ? "—" : counts.resolved + counts.closed}</strong></div></article>
        </section>
        <ErrorMessage error={error} />
        {page === "analytics" ? <section className="tickets"><div className="section-heading"><h2>Support overview</h2><button onClick={() => refresh()} disabled={loading}>Refresh</button></div>
          <p>{user.role === "employee" ? "Based on your tickets." : "Based on all tickets."} Counts reflect current status, not historical resolution times.</p>
          {loading ? <p>Loading…</p> : !error && <><p>{tickets.length} total · {tickets.length ? Math.round((counts.resolved + counts.closed) / tickets.length * 100) : 0}% resolved or closed</p>
            <div className="detail-grid"><section><h3>By category</h3>{categories.map(c => <p key={c}>{c}: <strong>{tickets.filter(x => x.category === c).length}</strong></p>)}</section>
            <section><h3>By priority</h3>{priorities.map(p => <p key={p}><Badge value={p} /> <strong>{tickets.filter(x => x.priority === p).length}</strong></p>)}</section></div></>}
        </section> : creating ? <TicketForm onCancel={() => setCreating(false)} onCreated={ticket => { setTickets(current => [ticket, ...current]); setCreating(false); setSelected(ticket.id); }} /> :
        selected ? <TicketDetail key={selected} id={selected} user={user} onBack={() => { setSelected(null); refresh(); }}
          onChanged={ticket => setTickets(current => current.map(x => x.id === ticket.id ? ticket : x))} /> :
        <section className="tickets"><div className="section-heading"><div><h2>{user.role === "employee" ? "My tickets" : "Support queue"}</h2><p>{visible.length} matching requests</p></div><button onClick={() => refresh()} disabled={loading}>Refresh</button></div>
          <div className="form-row"><label>Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Title, ID, or person" /></label>
            <label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><Options values={statuses} /></select></label>
            <label>Priority<select value={priority} onChange={e => setPriority(e.target.value)}><option value="">All priorities</option><Options values={priorities} /></select></label></div>
          {loading ? <p className="empty">Loading tickets…</p> : error ? <p>Use Refresh to try again.</p> : visible.length === 0 ? <p className="empty">No tickets match. Create a request or adjust your filters.</p> :
          visible.map(ticket => <article className="ticket" key={ticket.id}><div><span className="ticket-id">#{ticket.id} · {ticket.category}</span>
            <h3><button className="ticket-title" onClick={() => setSelected(ticket.id)}>{ticket.title}</button></h3>
            <p>{ticket.description.slice(0, 160)}{ticket.description.length > 160 ? "…" : ""}</p><small>{ticket.requester_name} · {date(ticket.created_at)} · {ticket.assignee_name || "Unassigned"}</small></div>
            <div className="badges"><Badge value={ticket.priority} /><Badge value={ticket.status} /></div></article>)}
        </section>}
      </>}
    </main>
  </div>;
}
export default function App() {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  function logout() { clearSession(); setUser(null); setError(""); }
  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener("session-expired", logout);
    if (localStorage.getItem("helpDeskToken")) {
      api("/auth/me", { signal: controller.signal }).then(setUser)
        .catch(err => { if (err.name !== "AbortError") setError(err.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else setLoading(false);
    return () => { controller.abort(); window.removeEventListener("session-expired", logout); };
  }, []);
  if (loading) return <main className="auth-page"><p>Checking session…</p></main>;
  if (error) return <main className="auth-page"><section className="auth-card"><ErrorMessage error={error} /><button onClick={logout}>Return to sign in</button></section></main>;
  return user ? <Workspace user={user} onLogout={logout} /> : <Auth onAuthenticated={setUser} />;
}
