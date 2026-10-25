import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import { STAGE_BY_KEY } from "../lib/stages";
import { calendarStart, longDate, timeOf } from "../lib/format";
import { Button, CompanyAvatar, EmptyState, PageHeader } from "../components/ui";

const HOUR_PX = 56;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

export default function Calendar() {
  const { source, applications } = useApp();
  const [rows, setRows] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const scroller = useRef();

  // All events are loaded once (there are only a handful); changing week doesn't refetch.
  // Re-run when applications change so a sync or delete is reflected.
  useEffect(() => {
    source?.listCalendar().then(setRows).catch(() => setRows([]));
  }, [source, applications]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 8 * HOUR_PX;
  }, []);

  const events = useMemo(() => rows
    .map((r) => ({ ...r, start: calendarStart(r), app: r.job_applications }))
    .filter((e) => !isNaN(e.start))
    .sort((a, b) => a.start - b.start), [rows]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date();
  const upcoming = events.filter((e) => e.start >= new Date(today.toDateString()));

  const shiftWeek = (n) => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7 * n); return d; });
  const monthLabel = days[0].toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Calendar" subtitle="Interviews and assessment deadlines found in your emails.">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
          <Button variant="secondary" className="px-2" onClick={() => shiftWeek(-1)} aria-label="Previous week"><ChevronLeft size={16} /></Button>
          <Button variant="secondary" className="px-2" onClick={() => shiftWeek(1)} aria-label="Next week"><ChevronRight size={16} /></Button>
          <span className="ml-2 w-36 text-sm font-medium text-slate-700">{monthLabel}</span>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-200">
            <div />
            {days.map((d, i) => {
              const isToday = sameDay(d, today);
              return (
                <div key={i} className="border-l border-slate-100 py-2.5 text-center">
                  <div className="text-xs font-medium text-slate-400">{DAYS[i]}</div>
                  <div className={`mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-sm font-semibold ${isToday ? "bg-brand-700 text-white" : "text-slate-800"}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          <div ref={scroller} className="thin-scroll relative h-[600px] overflow-y-auto">
            <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: 24 * HOUR_PX }}>
              <div className="relative">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-slate-400" style={{ top: h * HOUR_PX }}>
                    {h ? `${String(h).padStart(2, "0")}:00` : ""}
                  </div>
                ))}
              </div>
              {days.map((d, i) => (
                <div key={i} className="relative border-l border-slate-100"
                  style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, #f1f5f9 ${HOUR_PX - 1}px ${HOUR_PX}px)` }}>
                  {events.filter((e) => sameDay(e.start, d)).map((e) => <WeekEvent key={e.event_id} e={e} />)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Coming up</h2>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing scheduled">Interview invites will appear here after a sync.</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((e) => (
                <li key={e.event_id}>
                  <Link to={`/applications/${e.app.application_id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300">
                    <CompanyAvatar name={e.app.company} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{e.app.company}</div>
                      <div className="text-xs text-slate-500">
                        {STAGE_BY_KEY[e.app.stage]?.label ?? "Event"} · {longDate(e.start)} · {timeOf(e.start)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function WeekEvent({ e }) {
  const minutes = e.start.getHours() * 60 + e.start.getMinutes();
  const height = Math.max(((e.duration || 60) / 60) * HOUR_PX, 28);
  const stage = STAGE_BY_KEY[e.app.stage];
  return (
    <Link
      to={`/applications/${e.app.application_id}`}
      className="absolute inset-x-1 overflow-hidden rounded-lg border-l-4 border-brand-600 bg-brand-50 px-2 py-1 text-xs hover:bg-brand-100"
      style={{ top: (minutes / 60) * HOUR_PX, height }}
    >
      <div className="truncate font-semibold text-brand-900">{e.app.company}</div>
      <div className="truncate text-brand-700">{timeOf(e.start)} · {stage?.label ?? "Event"}</div>
    </Link>
  );
}
