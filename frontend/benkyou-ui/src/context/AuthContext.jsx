import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  buildDashboardPath,
  clearSession,
  getSession,
  saveSession,
} from "../utils/session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(() => getSession());

  useEffect(() => {
    const syncSession = () => setSession(getSession());

    window.addEventListener("storage", syncSession);
    window.addEventListener("benkyou:session-changed", syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("benkyou:session-changed", syncSession);
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null);

      if (!location.pathname.startsWith("/login")) {
        navigate("/login", { replace: true, state: { sessionExpired: true } });
      }
    };

    window.addEventListener("benkyou:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("benkyou:unauthorized", handleUnauthorized);
  }, [location.pathname, navigate]);

  const value = useMemo(() => {
    function signIn(authResponse) {
      const nextSession = saveSession(authResponse);
      setSession(nextSession);
      return nextSession;
    }

    function signOut() {
      clearSession();
      setSession(null);
      navigate("/login", { replace: true });
    }

    function updateUserSession(updatedFields) {
      if (!session || !session.user) return;
      const updatedUser = { ...session.user, ...updatedFields };
      if (updatedFields.name) {
        updatedUser.name = updatedFields.name;
      } else if (updatedFields.firstName || updatedFields.lastName) {
        const first = updatedFields.firstName !== undefined ? updatedFields.firstName : (session.user.firstName || "");
        const last = updatedFields.lastName !== undefined ? updatedFields.lastName : (session.user.lastName || "");
        updatedUser.name = `${first} ${last}`.trim();
      }
      const nextSession = { ...session, user: updatedUser };
      localStorage.setItem("benkyou:session", JSON.stringify(nextSession));
      setSession(nextSession);
      window.dispatchEvent(new Event("benkyou:session-changed"));
    }

    return {
      session,
      token: session?.token || null,
      user: session?.user || null,
      role: session?.role || null,
      tenantCode: session?.tenantCode || null,
      isAuthenticated: !!session,
      signIn,
      signOut,
      updateUserSession,
      dashboardPath: buildDashboardPath(session?.role, session?.tenantCode),
    };
  }, [navigate, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
