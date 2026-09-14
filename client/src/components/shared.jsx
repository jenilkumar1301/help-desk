export const categories = ["Hardware", "Software", "Network", "Access", "Other"];
export const priorities = ["low", "medium", "high", "urgent"];
export const statuses = ["open", "in_progress", "resolved", "closed"];
export const label = value => value.replaceAll("_", " ");
export const date = value => new Date(value.replace(" ", "T") + "Z").toLocaleString();
export function ErrorMessage({ error }) {
  return error ? <div className="error" role="alert">{error}</div> : null;
}
export function Options({ values }) {
  return values.map(value => <option key={value} value={value}>{label(value)}</option>);
}
export function Badge({ value }) {
  return <span className={"badge " + value}>{label(value)}</span>;
}
