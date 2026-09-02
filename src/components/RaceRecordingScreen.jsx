import { useState, useEffect, useCallback } from "react";
import { RotateCw, Circle, Square } from "lucide-react";
import { LiveDelayPanel } from "./shared/LiveDelayPanel";
import { CAMERA_SERVER, DEFAULT_DELAY_S, RACE_TABS } from "../constants";

function RaceRow({ label, row, onUpdate, selected }) {
  if (!row) return null;
  return (
    <div className={`grid grid-cols-6 gap-2 items-center text-xs py-1.5 border-b border-zinc-800/60 rounded px-1.5 -mx-1.5 ${selected ? "bg-cyan-500/10 ring-1 ring-cyan-500/60" : ""}`}>
      <span className={`font-mono ${selected ? "text-cyan-300 font-semibold" : "text-zinc-300"}`}>{label}{selected && " ●"}</span>
      <input
        type="number" min={1} value={row.exhibitionCount}
        onChange={(e) => onUpdate({ ...row, exhibitionCount: Number(e.target.value) || 1 })}
        className="w-14 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 font-mono"
      />
      <span className={row.exhibitionStatus === "完了" ? "text-cyan-400" : "text-zinc-500"}>{row.exhibitionStatus}</span>
      <input
        type="number" min={1} value={row.mainCount}
        onChange={(e) => onUpdate({ ...row, mainCount: Number(e.target.value) || 1 })}
        className="w-14 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 font-mono"
      />
      <button
        onClick={() => onUpdate({ ...row, lap: !row.lap })}
        className={`w-9 h-5 rounded-full relative transition ${row.lap ? "bg-cyan-500" : "bg-zinc-700"}`}
        aria-label="lap toggle"
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${row.lap ? "left-4" : "left-0.5"}`} />
      </button>
      <span className={row.mainStatus === "録画中" ? "text-red-400 animate-pulse" : row.mainStatus === "待機中" ? "text-amber-300" : "text-zinc-600"}>
        {row.mainStatus}
      </span>
    </div>
  );
}

// Screen 1 — Race Recording (レース録画). Referee 1's screen.
// Record now applies to EVERY currently-added camera simultaneously — it
// just marks a timestamp against each camera's already-running continuous
// background recording (see race-sessions.js), so there's no connection
// startup delay and no camera is left out.
export function RaceRecordingScreen({ cameras = [], maxRaces = 12, venue = "XXX", delaySeconds = DEFAULT_DELAY_S }) {
  const cam = cameras[0]; // used only for the on-screen preview
  const [tab, setTab] = useState(RACE_TABS[0]);
  const [raceType, setRaceType] = useState("展示"); // this is the searchable 種別 — matches Screen 2 exactly
  const [masterClockSync, setMasterClockSync] = useState(false); // TODO: wire to real 大時計 signal when available
  const [recording, setRecording] = useState(false);
  const [activeRace, setActiveRace] = useState("1R");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordCount, setRecordCount] = useState("01");
  const [recordError, setRecordError] = useState(null);
  const [savedCameras, setSavedCameras] = useState(null);
  const [pending, setPending] = useState(false); // true while a start/stop request is in flight — prevents double-click issues

  const raceLabels = Array.from({ length: Math.max(1, maxRaces) }, (_, i) => `${i + 1}R`);
  const half = Math.ceil(raceLabels.length / 2);
  const raceRowsLeft = raceLabels.slice(0, half);
  const raceRowsRight = raceLabels.slice(half);

  const [rows, setRows] = useState(() => {
    const initial = {};
    raceLabels.forEach((label, i) => {
      initial[label] = { label, exhibitionCount: 1, exhibitionStatus: i === 0 ? "完了" : "開始前", mainCount: 1, mainStatus: "開始前", lap: true };
    });
    return initial;
  });
  useEffect(() => {
    setRows((prev) => {
      const next = {};
      raceLabels.forEach((label, i) => {
        next[label] = prev[label] || {
          label, exhibitionCount: 1, exhibitionStatus: i === 0 ? "完了" : "開始前",
          mainCount: 1, mainStatus: "開始前", lap: true,
        };
      });
      return next;
    });
    if (!raceLabels.includes(activeRace)) setActiveRace(raceLabels[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxRaces]);

  const toggleRecording = useCallback(async () => {
    if (pending) return; // ignore a second click while the first is still in flight
    setPending(true);
    setRecordError(null);
    if (!recording) {
      try {
        const res = await fetch(`${CAMERA_SERVER}/api/race-sessions/start`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, type: raceType, race: activeRace, count: recordCount }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "failed to start");
        setRecording(true);
        setSavedCameras(null);
        setRows((r) => ({ ...r, [activeRace]: { ...r[activeRace], mainStatus: "録画中" } }));
      } catch (e) {
        setRecordError(e.message);
      }
    } else {
      try {
        const res = await fetch(`${CAMERA_SERVER}/api/race-sessions/stop`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        setSavedCameras(data.results || null); // set only once the backend confirms every camera's clip is finalized
      } catch {
        setRecordError("couldn't confirm the recording stopped — check the server");
      }
      setRecording(false);
      setRows((r) => ({ ...r, [activeRace]: { ...r[activeRace], mainStatus: "待機中" } }));
    }
    setPending(false);
  }, [pending, recording, date, raceType, activeRace, recordCount]);

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold">Race recording — レース場: {venue}</h2>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <label className="text-zinc-500">日付</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={recording}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono disabled:opacity-50" />
          <label className="text-zinc-500 ml-2">種別</label>
          <select value={raceType} onChange={(e) => setRaceType(e.target.value)} disabled={recording}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 disabled:opacity-50">
            <option>展示</option><option>本番</option>
          </select>
          <label className="text-zinc-500 ml-2">回数</label>
          <select value={recordCount} onChange={(e) => setRecordCount(e.target.value)} disabled={recording}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 disabled:opacity-50">
            {["01", "02", "03"].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <LiveDelayPanel
        cam={cam}
        delaySeconds={delaySeconds}
        disabled={recording}
        disabledReason="Delay and Intentional Delay are unavailable while recording — only usable during live streaming."
        videoClassName={recording ? "border-2 border-red-500" : ""}
        extraOverlay={recording && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-red-500/90 text-[11px] font-semibold text-white">
            <Circle className="w-2 h-2 fill-white" /> REC (all {cameras.length} cameras) · {date} · {raceType} · {activeRace} · #{recordCount}
          </div>
        )}
      />
      {recordError && <p className="text-xs text-red-400 mb-3">{recordError}</p>}
      {recording && (
        <p className="text-[11px] text-zinc-500 mb-3 font-mono">
          Recording started at the moment you clicked — every currently-added camera ({cameras.map((c) => c.name).join(", ") || "none"}) is being marked for this race.
        </p>
      )}
      {!recording && savedCameras && (
        <div className="text-[11px] text-teal-400 mb-3 font-mono space-y-0.5">
          <p>Saved — searchable on Screen 2 for each camera:</p>
          {savedCameras.map((r) => (
            <p key={r.camera} className="pl-2">• {r.camera}: {r.error ? `error — ${r.error}` : r.file}</p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1.5">
          {RACE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded border transition ${tab === t ? "bg-cyan-500 text-zinc-950 border-cyan-500" : "bg-zinc-900 text-zinc-400 border-zinc-800"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMasterClockSync((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition ${masterClockSync ? "bg-cyan-500/20 border-cyan-500 text-cyan-300" : "bg-zinc-900 border-zinc-800 text-zinc-500"}`}
            title="大時計連動 — not yet wired to a real master-clock signal; this is a placeholder toggle"
          >
            <span className={`w-2 h-2 rounded-full ${masterClockSync ? "bg-cyan-400" : "bg-zinc-600"}`} />
            大時計連動 (placeholder)
          </button>
          <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
            <RotateCw className="w-3.5 h-3.5" /> 瞬間再生
          </button>
          <button
            onClick={toggleRecording}
            disabled={pending}
            className={`flex items-center gap-1.5 text-xs px-4 py-1.5 rounded font-medium transition disabled:opacity-50 disabled:cursor-wait ${recording ? "bg-red-500 text-white" : "bg-cyan-500 text-zinc-950"}`}
          >
            {pending ? "…" : recording ? <><Square className="w-3.5 h-3.5" /> 停止</> : <><Circle className="w-3.5 h-3.5" /> 録画</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-[11px] text-zinc-500 mb-1 px-0">
        <div className="grid grid-cols-6 gap-2 font-medium text-zinc-400">
          <span>レース</span><span>展示回数</span><span>展示ステータス</span><span>本番回数</span><span>周回</span><span>本番ステータス</span>
        </div>
        <div className="grid grid-cols-6 gap-2 font-medium text-zinc-400">
          <span>レース</span><span>展示回数</span><span>展示ステータス</span><span>本番回数</span><span>周回</span><span>本番ステータス</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          {raceRowsLeft.map((label) => {
            const disabled = recording && activeRace !== label;
            return (
              <div
                key={label}
                role="button" tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && setActiveRace(label)}
                onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) setActiveRace(label); }}
                className={`w-full text-left cursor-pointer ${disabled ? "opacity-40 pointer-events-none" : ""}`}
              >
                <RaceRow label={label} row={rows[label]} selected={activeRace === label} onUpdate={(r) => setRows((prev) => ({ ...prev, [label]: r }))} />
              </div>
            );
          })}
        </div>
        <div>
          {raceRowsRight.map((label) => {
            const disabled = recording && activeRace !== label;
            return (
              <div
                key={label}
                role="button" tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && setActiveRace(label)}
                onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) setActiveRace(label); }}
                className={`w-full text-left cursor-pointer ${disabled ? "opacity-40 pointer-events-none" : ""}`}
              >
                <RaceRow label={label} row={rows[label]} selected={activeRace === label} onUpdate={(r) => setRows((prev) => ({ ...prev, [label]: r }))} />
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 mt-3">
        Click a race row to select it (highlighted, marked ●) — Record acts on whichever race is selected, across every added camera at once. Race selection locks while recording.
      </p>
    </div>
  );
}