import { Loader2 } from "lucide-react";
import { SUBSTATES } from "../lib/stages";
import { avatarColour } from "../lib/format";

export function Spinner({ className = "" }) {
  return <Loader2 className={`animate-spin ${className}`} size={16} />;
}

export function StatusBadge({ substate }) {
  const s = SUBSTATES[substate];
  if (!s) return null;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <Icon size={12} /> {s.label}
    </span>
  );
}

export function CompanyAvatar({ name, size = "md" }) {
  const dims = size === "lg" ? "size-12 text-lg" : "size-9 text-sm";
  return (
    <div className={`${dims} ${avatarColour(name)} shrink-0 rounded-lg grid place-items-center font-semibold`}>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function Button({ variant = "secondary", className = "", ...props }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-900 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {Icon && <Icon className="mx-auto text-slate-300" size={36} />}
      <h3 className="mt-3 font-medium text-slate-800">{title}</h3>
      <div className="mt-1 text-sm text-slate-500">{children}</div>
    </div>
  );
}

export function GoogleIcon({ className = "size-4" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span className="text-lg font-semibold tracking-tight text-slate-900">Vestigo</span>
    </div>
  );
}
