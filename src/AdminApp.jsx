import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { AdminView } from "./components/admin/AdminView";
import { RefereeView } from "./components/referee/RefereeView";
import { DisplayOnlyTemplate } from "./components/DisplayOnlyTemplate";
import { ThemeToggle } from "./components/ThemeToggle";
import { SESSION_KEY, SESSION_LIFETIME_MS, CAMERA_SERVER } from "./constants";

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) { localStorage.removeItem(SESSION_KEY); return null; }
    return parsed.user;
  } catch {
    return null;
  }
}
function saveSession(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user, expiresAt: Date.now() + SESSION_LIFETIME_MS })); } catch {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// Top-level app: session persistence (1 day) + role-based routing. Login is
// now checked against the backend (src/users.js), so any referee the admin
// adds in ユーザ管理 can log in immediately — no hardcoded accounts needed
// beyond the fixed admin login.
export default function AdminApp() {
  const [user, setUser] = useState(() => loadSession());
  const [monitorCount, setMonitorCount] = useState(4); // cached at mount so login's auto-open stays synchronous (popup blockers require it)
  const isDisplayMode = new URLSearchParams(window.location.search).get("display") === "template";

  useEffect(() => {
    fetch(`${CAMERA_SERVER}/api/config`).then((r) => r.json()).then((c) => setMonitorCount(c.monitorCount || 4)).catch(() => {});
  }, []);

  const handleLogin = (loggedInUser) => {
    saveSession(loggedInUser);
    setUser(loggedInUser);
    // Auto-open the monitor display tabs (however many the admin has
    // configured) for any referee with template access — done
    // synchronously in the login click handler so the browser treats these
    // as a direct response to the click rather than blocking them as
    // unwanted popups.
    if (loggedInUser.role === "referee" && loggedInUser.access?.template) {
      for (let n = 1; n <= monitorCount; n++) {
        window.open(`${window.location.origin}${window.location.pathname}?display=template&monitor=${n}`, `ibrvar_monitor_${n}`);
      }
    }
  };
  const handleLogout = () => { clearSession(); setUser(null); };

  if (isDisplayMode) return <DisplayOnlyTemplate />;
  if (!user) return (<><LoginScreen onLogin={handleLogin} /><ThemeToggle /></>);

  if (user.role === "admin") return (<><AdminView user={user} onLogout={handleLogout} /><ThemeToggle /></>);
  return (<><RefereeView user={user} onLogout={handleLogout} /><ThemeToggle /></>);
}