import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CalendarClock, Inbox, KanbanSquare, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { Button, GoogleIcon, Logo, Spinner } from "../components/ui";

const FEATURES = [
  { icon: Inbox, text: "Reads your Gmail and spots application updates automatically" },
  { icon: KanbanSquare, text: "Every application on one board, from applied to offer" },
  { icon: CalendarClock, text: "Interview times and assessment deadlines on a calendar" },
];

export default function Login() {
  const { signedIn, enterDemo } = useApp();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  if (signedIn) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      : await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.name } } });
    setBusy(false);
    if (error) setMessage({ error: true, text: error.message });
    else if (mode === "signup") setMessage({ text: "Check your inbox to confirm your email, then sign in." });
    else navigate("/dashboard");
  }

  const google = () => supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 p-12 text-white">
        <div className="[&_span]:text-white"><Logo /></div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Your job search,<br />organised for you.</h1>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-brand-50">
                <span className="grid size-9 place-items-center rounded-lg bg-white/10"><Icon size={18} /></span> {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-brand-100/80">Built with React, FastAPI, Supabase and OpenAI.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "signin" ? "Sign in to see your applications." : "Start tracking applications in minutes."}
          </p>

          <button onClick={() => { enterDemo(); navigate("/dashboard"); }}
            className="mt-6 flex w-full items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-left transition hover:bg-brand-100">
            <Sparkles className="text-brand-700 shrink-0" size={20} />
            <span>
              <span className="block text-sm font-semibold text-brand-900">Explore the live demo</span>
              <span className="block text-xs text-brand-700">No sign-up needed: sample data, every feature.</span>
            </span>
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><hr className="flex-1 border-slate-200" /> or <hr className="flex-1 border-slate-200" /></div>

          <Button className="w-full" onClick={google}><GoogleIcon /> Continue with Google</Button>

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "signup" && <Input label="Name" value={form.name} onChange={set("name")} autoComplete="name" />}
            <Input label="Email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
            <Input label="Password" type="password" required minLength={8} value={form.password} onChange={set("password")}
              autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            <Button variant="primary" className="w-full" disabled={busy}>
              {busy && <Spinner />} {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {message && <p className={`mt-4 text-sm ${message.error ? "text-rose-600" : "text-emerald-700"}`}>{message.text}</p>}

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button className="font-medium text-brand-700 hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input {...props} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
    </label>
  );
}
