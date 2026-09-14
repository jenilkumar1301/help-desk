import { useState } from "react";
import { api } from "../api";
import { ErrorMessage } from "./shared";
export default function Auth({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api("/auth/" + (register ? "register" : "login"), { method: "POST", body: JSON.stringify(data) });
      localStorage.setItem("helpDeskToken", result.token);
      onAuthenticated(result.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card">
    <div className="brand-mark">HD</div>
    <h1>{register ? "Create your account" : "Welcome back"}</h1>
    <p>One place for your IT requests and equipment.</p>
    <form onSubmit={submit}>
      {register && <label>Full name<input name="name" autoComplete="name" maxLength={100} required /></label>}
      <label>Email<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
      <label>Password<input type="password" name="password" minLength={8} autoComplete={register ? "new-password" : "current-password"} required /></label>
      {register && <p className="hint">Use at least 8 characters and no more than 72 UTF-8 bytes.</p>}
      <ErrorMessage error={error} />
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
    </form>
    <button className="link" disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>
      {register ? "Already registered? Sign in" : "New here? Create an account"}
    </button>
  </section></main>;
}
