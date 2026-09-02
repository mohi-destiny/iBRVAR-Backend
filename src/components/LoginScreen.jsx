import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { CAMERA_SERVER } from "../constants";

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${CAMERA_SERVER}/api/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid username or password"); return; }
      onLogin(data); // { username, role, label, access }
    } catch {
      setError("Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <h1 className="text-zinc-100 font-semibold">iBRVAR Login</h1>
        </div>
        <label className="text-xs text-zinc-500 block mb-1">User ID</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 mb-3 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
        <label className="text-xs text-zinc-500 block mb-1">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 mb-4 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-cyan-500 text-zinc-950 font-medium text-sm py-2 rounded hover:bg-cyan-400 transition disabled:opacity-50">
          {loading ? "Checking…" : "Login"}
        </button>
      </form>
    </div>
  );
}