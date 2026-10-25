import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarDays, KanbanSquare, LogOut, PartyPopper, Search, Settings, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import SyncButton from "./SyncButton";
import { CompanyAvatar, Logo } from "./ui";

const NAV = [
  { to: "/dashboard", label: "Applications", icon: KanbanSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/offers", label: "Offers", icon: PartyPopper },
  { to: "/settings", label: "Settings", icon: Settings },
];

function navClass({ isActive }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

export default function Layout() {
  const { demo, user, signOut } = useApp();
  const navigate = useNavigate();

  return (
    <div className="flex h-dvh">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5">
        <div className="px-3 mb-8"><Logo /></div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}><Icon size={18} /> {label}</NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4 px-3">
          <div className="text-xs text-slate-500 truncate">{demo ? "Demo account" : user?.email}</div>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="mt-2 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <LogOut size={15} /> {demo ? "Exit demo" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {demo && (
          <div className="flex items-center justify-center gap-2 bg-brand-700 px-4 py-1.5 text-xs text-white">
            <Sparkles size={13} /> You're viewing a demo with sample data. Try syncing, opening an application or the calendar.
          </div>
        )}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden"><Logo /></div>
          <SearchBox />
          <div className="ml-auto"><SyncButton /></div>
        </header>
        <nav className="md:hidden flex justify-around border-b border-slate-200 bg-white py-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} aria-label={label}
              className={({ isActive }) => `p-2.5 rounded-lg ${isActive ? "text-brand-700 bg-brand-50" : "text-slate-500"}`}>
              <Icon size={20} />
            </NavLink>
          ))}
        </nav>
        <main className="thin-scroll flex-1 overflow-auto px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Searches the applications already in memory, so typing doesn't hit the database. */
function SearchBox() {
  const { applications } = useApp();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return applications
      .filter((a) => `${a.company} ${a.job_title}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [q, applications]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search companies or roles…"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
      {focused && results.length > 0 && (
        <ul className="animate-fade-in absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((a) => (
            <li key={a.application_id}>
              <button
                onMouseDown={() => { setQ(""); navigate(`/applications/${a.application_id}`); }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <CompanyAvatar name={a.company} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{a.company}</div>
                  <div className="truncate text-xs text-slate-500">{a.job_title}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
