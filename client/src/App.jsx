import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const categories = ["Hardware", "Software", "Network", "Access", "Other"];
const priorities = ["low", "medium", "high", "urgent"];

function Auth({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(values)
      });
      localStorage.setItem("helpDeskToken", result.token);
      localStorage.setItem("helpDeskUser", JSON.stringify(result.user));
      onAuthenticated(result.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="brand-mark">HD</div>
      <h1>{register ? "Create your account" : "Welcome back"}</h1>
      <p>{register ? "Start submitting and tracking IT requests." : "Sign in to your support workspace."}</p>
      <form onSubmit={submit}>
        {register && <label>Full name<input name="name" required /></label>}
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" minLength="8" required /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary">{register ? "Create account" : "Sign in"}</button>
      </form>
      <button className="link" onClick={() => { setRegister(!register); setError(""); }}>
        {register ? "Already registered? Sign in" : "New here? Create an account"}
      </button>
    </section>
  </main>;
}

function TicketForm({ onCreated, onCancel }) {
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      onCreated(await api("/tickets", { method: "POST", body: JSON.stringify(values) }));
    } catch (err) { setError(err.message); }
  }

  return <form className="ticket-form" onSubmit={submit}>
    <div className="form-heading"><div><h2>New support request</h2><p>Describe the issue and its impact.</p></div><button type="button" className="icon-button" onClick={onCancel}>×</button></div>
    <label>Title<input name="title" placeholder="Example: Cannot connect to office Wi-Fi" required /></label>
    <label>Description<textarea name="description" rows="5" placeholder="What happened, and what have you tried?" required /></label>
    <div className="form-row">
      <label>Category<select name="category">{categories.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Priority<select name="priority">{priorities.map(x => <option key={x}>{x}</option>)}</select></label>
    </div>
    {error && <div className="error">{error}</div>}
    <div className="actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary">Submit ticket</button></div>
  </form>;
}

function Dashboard({ user, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    api("/tickets").then(setTickets).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => tickets.filter(ticket =>
    (status === "all" || ticket.status === status) &&
    (ticket.title + ticket.description).toLowerCase().includes(query.toLowerCase())
  ), [tickets, query, status]);

  const stats = {
    open: tickets.filter(x => x.status === "open").length,
    progress: tickets.filter(x => x.status === "in_progress").length,
    resolved: tickets.filter(x => x.status === "resolved").length
  };

  return <div className="app-shell">
    <aside>
      <div className="brand"><span>HD</span><strong>Help Desk</strong></div>
      <nav><button className="active">▦ Dashboard</button><button>◎ My tickets</button><button>▣ Assets</button></nav>
      <div className="profile"><div className="avatar">{user.name[0]}</div><div><strong>{user.name}</strong><small>{user.role}</small></div><button onClick={onLogout}>↪</button></div>
    </aside>
    <main className="dashboard">
      <header><div><p className="eyebrow">SUPPORT CENTER</p><h1>Good day, {user.name.split(" ")[0]}</h1><p>Track requests and keep your work moving.</p></div><button className="primary" onClick={() => setCreating(true)}>＋ New ticket</button></header>
      <section className="stats">
        <article><span className="stat-icon blue">●</span><div><small>Open tickets</small><strong>{stats.open}</strong></div></article>
        <article><span className="stat-icon amber">●</span><div><small>In progress</small><strong>{stats.progress}</strong></div></article>
        <article><span className="stat-icon green">●</span><div><small>Resolved</small><strong>{stats.resolved}</strong></div></article>
      </section>
      {creating ? <TicketForm onCancel={() => setCreating(false)} onCreated={ticket => { setTickets([ticket, ...tickets]); setCreating(false); }} /> :
      <section className="tickets">
        <div className="section-heading"><div><h2>Recent tickets</h2><p>Your latest support activity</p></div><div className="filters"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tickets…" /><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div></div>
        {loading ? <p className="empty">Loading tickets…</p> : visible.length === 0 ? <div className="empty"><strong>No tickets found</strong><p>Create a ticket when you need help from IT.</p></div> :
        <div className="ticket-list">{visible.map(ticket => <article className="ticket" key={ticket.id}><div><span className="ticket-id">#{String(ticket.id).padStart(4, "0")}</span><h3>{ticket.title}</h3><p>{ticket.description}</p><small>{ticket.category} · {new Date(ticket.created_at).toLocaleDateString()}</small></div><div className="badges"><span className={`badge ${ticket.priority}`}>{ticket.priority}</span><span className="badge status">{ticket.status.replace("_", " ")}</span></div></article>)}</div>}
      </section>}
    </main>
  </div>;
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("helpDeskUser") || "null"));
  function logout() { localStorage.clear(); setUser(null); }
  return user ? <Dashboard user={user} onLogout={logout} /> : <Auth onAuthenticated={setUser} />;
}
