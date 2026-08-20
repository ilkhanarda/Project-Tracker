import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import AuthPage from "./AuthPage";
import { useAuth } from "./auth/useAuth";
import Dashboard from "./Dashboard";

const THEME_STORAGE_KEY = "project-tracking-theme";

function applySavedTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const theme =
    savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

applySavedTheme();

function AuthLoadingScreen() {
  return <p>Checking your session...</p>;
}

function ProtectedRoute() {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

function GuestRoute() {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) return <AuthLoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

function RootRedirect() {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) return <AuthLoadingScreen />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
