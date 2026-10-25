import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ApplicationDetail from "./pages/ApplicationDetail";
import Calendar from "./pages/Calendar";
import Offers from "./pages/Offers";
import Settings from "./pages/Settings";

function RequireAuth() {
  const { ready, signedIn } = useApp();
  if (!ready) return <div className="grid h-dvh place-items-center text-slate-400"><Spinner /></div>;
  return signedIn ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/applications/:id" element={<ApplicationDetail />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/offers" element={<Offers />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
