import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { liveSource } from "../lib/liveSource";
import { demoSource } from "../lib/demoSource";

const AppContext = createContext(null);
const DEMO_KEY = "vestigo-demo";

function readDemoFlag() {
  try { return sessionStorage.getItem(DEMO_KEY) === "1"; } catch { return false; }
}

/**
 * Holds the session and the user's applications. Pages share one copy of the
 * data instead of each refetching it (the old app reloaded the whole page after a sync).
 */
export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [demo, setDemo] = useState(readDemoFlag);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id;
  const source = useMemo(() => {
    if (demo) return demoSource();
    if (userId) return liveSource({ id: userId });
    return null;
  }, [demo, userId]);

  const refresh = useCallback(async () => {
    if (!source) return;
    try {
      setApplications(await source.listApplications());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    setLoading(true);
    setApplications([]);
    refresh();
  }, [refresh]);

  const removeApplication = useCallback(async (id) => {
    await source.deleteApplication(id);
    setApplications((prev) => prev.filter((a) => a.application_id !== id));
  }, [source]);

  const enterDemo = () => {
    try { sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* storage unavailable */ }
    setDemo(true);
  };

  // Leaving the demo returns a signed-in user to their own account rather than signing them out.
  const signOut = async () => {
    if (demo) {
      try { sessionStorage.removeItem(DEMO_KEY); } catch { /* storage unavailable */ }
      setDemo(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const value = {
    ready: session !== undefined,
    signedIn: demo || !!user,
    demo, user, source, applications, loading, error,
    refresh, removeApplication, enterDemo, signOut,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
