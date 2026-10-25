import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Trash2, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { STAGE_BY_KEY } from "../lib/stages";
import { longDate, senderName, timeOf } from "../lib/format";
import { Button, CompanyAvatar, Spinner, StatusBadge } from "../components/ui";

export default function ApplicationDetail() {
  const { id } = useParams();
  const { applications, loading, source, removeApplication } = useApp();
  const [events, setEvents] = useState(null);
  const [openEmail, setOpenEmail] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const app = applications.find((a) => a.application_id === id);

  useEffect(() => {
    if (!source) return;
    setEvents(null);
    source.listEvents(id).then(setEvents).catch(() => setEvents([]));
  }, [id, source]);

  if (loading) return <div className="grid place-items-center py-20 text-slate-400"><Spinner /></div>;
  if (!app) return <p className="text-slate-500">Application not found. <Link to="/dashboard" className="text-brand-700 underline">Back to board</Link></p>;

  const stage = STAGE_BY_KEY[app.stage];

  async function handleDelete() {
    if (!window.confirm(`Delete ${app.company} – ${app.job_title}? Its emails and calendar entries are removed too.`)) return;
    setDeleting(true);
    try {
      await removeApplication(id);
      navigate("/dashboard");
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-5">
        <ArrowLeft size={15} /> All applications
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <CompanyAvatar name={app.company} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-slate-900">{app.company}</h1>
            <p className="text-slate-500">{app.job_title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {stage && (
                <span className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium ring-1 ${stage.ring} ${stage.text}`}>
                  <span className={`size-1.5 rounded-full ${stage.dot}`} /> {stage.label}
                </span>
              )}
              <StatusBadge substate={app.substate} />
            </div>
          </div>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Spinner /> : <Trash2 size={15} />} Delete
          </Button>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-4">
          <Field label="First contact" value={app.applied_date && longDate(app.applied_date)} />
          <Field label="Last update" value={app.latest_date && longDate(app.latest_date)} />
          <Field label="Type" value={app.position?.replace("_", " ").toLowerCase()} />
          <Field label="Contact" value={senderName(app.email_address)} />
        </dl>
      </div>

      <h2 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h2>
      {events === null ? (
        <div className="py-10 text-center text-slate-400"><Spinner /></div>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-500">No emails stored for this application.</p>
      ) : (
        <ol className="relative ml-3 border-l-2 border-slate-200">
          {events.map((ev) => {
            const d = new Date(ev.event_date);
            return (
              <li key={ev.event_id} className="relative mb-4 pl-6">
                <span className="absolute -left-[7px] top-4 size-3 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" />
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-400">{longDate(d)} · {timeOf(d)}</div>
                  <div className="mt-1 font-medium text-slate-900">{ev.event_summary || "Email"}</div>
                  {ev.email_text && (
                    <button onClick={() => setOpenEmail(ev)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                      <Mail size={14} /> Read email
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {openEmail && <EmailDrawer email={openEmail} onClose={() => setOpenEmail(null)} />}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium first-letter:uppercase text-slate-700 truncate">{value || "–"}</dd>
    </div>
  );
}

function EmailDrawer({ email, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="animate-fade-in thin-scroll h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400">{longDate(email.event_date)}</div>
            <h3 className="mt-1 font-semibold text-slate-900">{email.event_summary}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>
        {/* Rendered as text: the old app injected email HTML into the page, which could run scripts. */}
        <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{email.email_text}</div>
      </aside>
    </div>
  );
}
