import { useState, useEffect, useCallback } from "react";
import { LogOut, ExternalLink, Play, Pause, RotateCcw as Restart, Search } from "lucide-react";
import { useCameras } from "../../hooks/useCameras";
import { useSharedConfig } from "../../hooks/useSharedConfig";
import { RaceRecordingScreen } from "../RaceRecordingScreen";
import { MultiCameraTemplateView } from "../MultiCameraTemplateView";
import { PlaybackScreen } from "../PlaybackScreen";
import { LiveCamerasTab } from "../live/LiveCamerasTab";
import { CAMERA_SERVER, DEFAULT_DELAY_S } from "../../constants";

// Generic referee page — shows only the tabs this specific referee has been
// granted access to (set by the admin in ユーザ管理). Replaces the old fixed
// Referee1View/Referee2View split now that referees are add-able and their
// access is admin-controlled per account.
export function RefereeView({ user, onLogout }) {
  const camState = useCameras();
  const { config } = useSharedConfig();

  // The access saved in the login session can go stale if the admin
  // changes it later in the same session (localStorage keeps the access
  // as it was at login time) — refresh it from the backend so admin
  // changes take effect without forcing a fresh login. If the account was
  // deleted entirely, log out rather than leaving a stale session stuck on
  // a confusing "no pages assigned" screen.
  const [access, setAccess] = useState(user.access || {});
  useEffect(() => {
    const load = () => {
      fetch(`${CAMERA_SERVER}/api/users`).then((r) => r.json())
        .then((d) => {
          const fresh = d.users?.find((u) => u.username === user.username);
          if (fresh?.access) setAccess(fresh.access);
          else if (d.users) onLogout(); // account no longer exists — clear the stale session
        }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.username]);

  const availableTabs = [
    access.recording && { key: "recording", label: "録画 Recording" },
    access.template && { key: "template", label: "Live / Template" },
    access.template && { key: "race", label: "Race Playback (all monitors)" },
    access.playback && { key: "playback", label: "Single-camera search" },
    access.liveCameras && { key: "liveCameras", label: "Live Cameras" },
  ].filter(Boolean);

  // state for the raw Live Cameras page (add/remove cameras, per-camera
  // Delay modal) — same shape AdminView uses for the same page
  const [liveDelaySeconds, setLiveDelaySeconds] = useState(DEFAULT_DELAY_S);
  const [cpuLog, setCpuLog] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [openDelayId, setOpenDelayId] = useState(null);
  const handleCpuLog = useCallback((cam, label, ms) => {
    setCpuLog((prev) => [...prev, { key: `${cam.id}-${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), name: cam.name, accent: "#22d3ee", label, ms }]);
  }, []);

  const [tab, setTab] = useState(availableTabs[0]?.key || null);
  const [monitorNum, setMonitorNum] = useState(1);

  // If access loads in (or changes) after the initial render — e.g. a
  // stale session that only just got refreshed with real access — make
  // sure a valid tab gets selected instead of getting stuck on the
  // "no pages assigned" screen from the first render.
  useEffect(() => {
    if (!availableTabs.some((t) => t.key === tab)) {
      setTab(availableTabs[0]?.key || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.recording, access.template, access.playback, access.liveCameras]);

  const [pbDate, setPbDate] = useState("");
  const [pbType, setPbType] = useState("展示");
  const [pbRace, setPbRace] = useState("1R");
  const [pbCount, setPbCount] = useState("01");
  const [raceLoaded, setRaceLoaded] = useState(false);

  const openTemplateInNewTab = (n) => {
    const url = `${window.location.origin}${window.location.pathname}?display=template&monitor=${n}`;
    window.open(url, "_blank");
  };
  const sendCommand = useCallback((cmd) => {
    try { const bc = new BroadcastChannel("ibrvar-control"); bc.postMessage(cmd); bc.close(); } catch {}
  }, []);
  const loadRaceOnAllMonitors = () => {
    sendCommand({ type: "loadRace", monitor: "all", date: pbDate, type_: pbType, race: pbRace, count: pbCount });
    setRaceLoaded(true);
  };
  const backToLiveAll = () => { sendCommand({ type: "live", monitor: "all" }); setRaceLoaded(false); };
  const transport = (action, value) => sendCommand({ type: "playbackControl", monitor: "all", action, value });

  useEffect(() => {
    if (!access.template) return;
    const onKeyDown = (e) => {
      if (["INPUT", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (["1", "2", "3", "4"].includes(e.key)) sendCommand({ type: e.shiftKey ? "intentionalDelay" : "delay", monitor: Number(e.key) });
      else if (e.key.toLowerCase() === "l" || e.key === "0") { sendCommand({ type: "live", monitor: "all" }); setRaceLoaded(false); }
      else if (e.key === " " && raceLoaded) { e.preventDefault(); transport("play"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendCommand, raceLoaded, access.template]);

  if (!tab) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-zinc-400">{user.label} has no pages assigned yet.</p>
        <p className="text-xs text-zinc-600">Ask an admin to grant access in ユーザ管理.</p>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 mt-2"><LogOut className="w-3.5 h-3.5" /> Logout</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-wrap gap-2">
        <span className="text-sm font-semibold">{user.label}</span>
        <div className="flex items-center gap-2 flex-wrap">
          {availableTabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`text-xs px-3 py-1.5 rounded border ${tab === t.key ? "bg-cyan-500 text-zinc-950 border-cyan-500" : "bg-zinc-900 text-zinc-400 border-zinc-800"}`}>{t.label}</button>
          ))}
          {tab === "template" && (
            <select value={monitorNum} onChange={(e) => setMonitorNum(Number(e.target.value))} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">
              {Array.from({ length: config.monitorCount || 4 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Monitor {n}</option>)}
            </select>
          )}
          {tab === "template" && (
            <button onClick={() => openTemplateInNewTab(monitorNum)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"><ExternalLink className="w-3.5 h-3.5" /> Open in new tab</button>
          )}
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 ml-2"><LogOut className="w-3.5 h-3.5" /> Logout</button>
        </div>
      </div>

      <div className="p-4">
        {tab === "recording" && (
          <RaceRecordingScreen cameras={camState.cameras} maxRaces={config.maxRaces} venue={config.venue} delaySeconds={config.delaySeconds} />
        )}

        {tab === "template" && (
          <MultiCameraTemplateView cameras={camState.cameras} lockedTemplate={config.monitorTemplates[monitorNum]} sharedDelaySeconds={config.delaySeconds} monitorNum={monitorNum} slotCameraNames={config.monitorCameraAssignments?.[monitorNum]} />
        )}

        {tab === "race" && (
          <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
            <h2 className="text-sm font-semibold mb-1">Race Playback — all 4 monitors together</h2>
            <p className="text-[11px] text-zinc-500 mb-4">Loads this race on every monitor at once — each shows its own assigned camera's clip. Play/pause/seek/speed here apply to all monitors together.</p>
            <div className="flex flex-wrap items-end gap-2 mb-4">
              <div><label className="text-[11px] text-zinc-500 block">日付</label>
                <input type="date" value={pbDate} onChange={(e) => setPbDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono" /></div>
              <div><label className="text-[11px] text-zinc-500 block">種別</label>
                <select value={pbType} onChange={(e) => setPbType(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs"><option>展示</option><option>本番</option></select></div>
              <div><label className="text-[11px] text-zinc-500 block">レース番号</label>
                <select value={pbRace} onChange={(e) => setPbRace(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">{Array.from({ length: 12 }, (_, i) => `${i + 1}R`).map((n) => <option key={n}>{n}</option>)}</select></div>
              <div><label className="text-[11px] text-zinc-500 block">回数</label>
                <select value={pbCount} onChange={(e) => setPbCount(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">{["01", "02", "03"].map((n) => <option key={n}>{n}</option>)}</select></div>
              <button onClick={loadRaceOnAllMonitors} className="flex items-center gap-1.5 bg-cyan-500 text-zinc-950 text-xs font-medium px-3 py-1.5 rounded"><Search className="w-3.5 h-3.5" /> Load on all monitors</button>
            </div>
            {raceLoaded && (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex-wrap">
                <button onClick={() => transport("play")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-cyan-500 text-zinc-950"><Play className="w-3.5 h-3.5" /> Play all</button>
                <button onClick={() => transport("pause")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300"><Pause className="w-3.5 h-3.5" /> Pause all</button>
                <button onClick={() => transport("seek", -5)} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300">−5s all</button>
                <button onClick={() => transport("seek", 5)} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300">+5s all</button>
                {[0.5, 1, 2].map((s) => <button key={s} onClick={() => transport("speed", s)} className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300">{s}x all</button>)}
                <button onClick={() => transport("restart")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300"><Restart className="w-3.5 h-3.5" /> Restart all</button>
                <button onClick={backToLiveAll} className="text-xs px-3 py-1.5 rounded bg-violet-500 text-zinc-950 font-medium ml-auto">← Back to Live (all)</button>
              </div>
            )}
          </div>
        )}

        {tab === "playback" && <PlaybackScreen liveCam={camState.cameras[0]} delaySeconds={config.delaySeconds} />}

        {tab === "liveCameras" && (
          <LiveCamerasTab
            {...camState}
            delaySeconds={liveDelaySeconds} setDelaySeconds={setLiveDelaySeconds}
            cpuLog={cpuLog} handleCpuLog={handleCpuLog}
            showInfo={showInfo} setShowInfo={setShowInfo}
            openDelayId={openDelayId} setOpenDelayId={setOpenDelayId}
          />
        )}
      </div>
    </div>
  );
}