import { supabase } from "./supabase";

const API = import.meta.env.VITE_API_URL;

async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}`, ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Real data: reads go straight to Supabase (protected by RLS), actions go through the backend. */
export function liveSource(user) {
  return {
    demo: false,

    listApplications: async () =>
      check(await supabase
        .from("job_applications")
        .select("application_id, company, job_title, stage, substate, latest_date, applied_date, position, email_address")
        .eq("user_id", user.id)),

    // Email bodies are only loaded when an application is opened.
    listEvents: async (applicationId) =>
      check(await supabase
        .from("application_events")
        .select("event_id, event_date, event_summary, email_text")
        .eq("application_id", applicationId)
        .order("event_date")),

    listCalendar: async () =>
      check(await supabase
        .from("calendar")
        .select("event_id, date, time, duration, job_applications!inner(application_id, company, job_title, stage, user_id)")
        .eq("job_applications.user_id", user.id)),

    deleteApplication: (id) => api(`/api/applications/${id}`, { method: "DELETE" }),

    listAccounts: () => api("/api/gmail/accounts"),
    disconnectAccount: (id) => api(`/api/gmail/accounts/${id}`, { method: "DELETE" }),
    connectGmail: async () => {
      const { url } = await api("/api/gmail/connect");
      window.location.href = url;
    },

    startSync: () => api("/api/sync", { method: "POST" }),
    syncStatus: () => api("/api/sync"),
  };
}
