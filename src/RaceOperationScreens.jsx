import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
  Camera, Plus, X, RotateCcw, Layers, History, RotateCw, Info,
  Play, Pause, SkipBack, SkipForward, Repeat, ExternalLink, Search,
  Circle, Square, Radio,
} from "lucide-react";

const CAMERA_SERVER = "http://localhost:4000";
const DEFAULT_DELAY_S = 10;

/* ------------------------------------------------------------------ */
/* Shared: the same robust HLS hook used elsewhere in this project.   */
/* Waits for the manifest to actually exist, retries on failure, and  */
/* (for delay mode) seeks before ever calling play() so live is never */
/* briefly visible before snapping back.                              */
/* ------------------------------------------------------------------ */
function useHlsVideo(videoRef, url, { onStatus } = {}) {
  const hlsRef = useRef(null);
  const modeRef = useRef({ type: "live", offset: 0, loopEnd: 0 });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    onStatus?.("loading…");
    let cancelled = false;

    function setupHls() {
      if (cancelled) return;
      const hls = new Hls({ liveSyncDurationCount: 2 });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        onStatus?.(`error: ${data.details}`);
        if (!data.fatal) return;
        // A backgrounded tab gets its timers throttled by the browser, which
        // can look like a network error to hls.js even though nothing is
        // actually wrong — don't tear down and reconnect from scratch while
        // hidden, just quietly retry loading once we're visible again.
        if (document.hidden) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.destroy();
          setTimeout(setupHls, 1000);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;
      video.addEventListener("playing", () => onStatus?.("playing"));
      video.addEventListener("waiting", () => onStatus?.("buffering…"));
    }

    async function waitThenSetup() {
      for (let i = 0; i < 30 && !cancelled; i++) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) { setupHls(); return; }
        } catch {}
        onStatus?.(`waiting for stream… (${i + 1})`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    waitThenSetup();

    const onVisible = () => {
      if (!document.hidden && hlsRef.current) hlsRef.current.startLoad(); // gently resume, no teardown
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Loop-mode playback: repeat [loopEnd - offset, loopEnd] forever.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      const m = modeRef.current;
      if (m.type === "loop" && video.currentTime >= m.loopEnd - 0.3) {
        video.currentTime = Math.max(0, m.loopEnd - m.offset);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [videoRef]);

  const goLive = useCallback(() => {
    const video = videoRef.current;
    if (!video?.seekable.length) return;
    modeRef.current = { type: "live", offset: 0, loopEnd: 0 };
    video.currentTime = video.seekable.end(0);
  }, [videoRef]);

  const goDelay = useCallback((offset) => {
    const video = videoRef.current;
    if (!video?.seekable.length) return;
    modeRef.current = { type: "continuous", offset, loopEnd: 0 };
    video.currentTime = Math.max(0, video.seekable.end(0) - offset);
  }, [videoRef]);

  const goLoop = useCallback((offset) => {
    const video = videoRef.current;
    if (!video?.seekable.length) return;
    const loopEnd = video.currentTime;
    modeRef.current = { type: "loop", offset, loopEnd };
    video.currentTime = Math.max(0, loopEnd - offset);
  }, [videoRef]);

  return { goLive, goDelay, goLoop };
}

/* ------------------------------------------------------------------ */
/* One video tile — used inside the multi-camera template grid.       */
/* ------------------------------------------------------------------ */
function VideoTile({ cam, groupMode, delaySeconds, label }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("starting…");
  const [stale, setStale] = useState(false);
  const hasPlayedRef = useRef(false);
  const lastProgressRef = useRef(Date.now());
  const { goLive, goDelay, goLoop } = useHlsVideo(videoRef, cam?.url, { onStatus: setStatus });

  // re-apply the group's current live/delay/loop state whenever it changes
  const groupModeKey = groupMode ? `${groupMode.type}-${groupMode.nonce}` : null;
  useEffect(() => {
    if (!groupMode) return;
    if (groupMode.type === "live") goLive();
    else if (groupMode.type === "continuous") goDelay(groupMode.offset ?? delaySeconds);
    else if (groupMode.type === "loop") goLoop(groupMode.offset ?? delaySeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupModeKey]);

  // Judge "stale" by whether the video is actually advancing, not by the
  // noisier status text — brief HLS buffering blips are normal and
  // shouldn't flash a false "no signal" cover.
  useEffect(() => {
    if (status === "playing") hasPlayedRef.current = true;
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => { lastProgressRef.current = Date.now(); setStale(false); };
    video.addEventListener("timeupdate", onTimeUpdate);
    const iv = setInterval(() => {
      if (hasPlayedRef.current && Date.now() - lastProgressRef.current > 6000) setStale(true);
    }, 1000);
    return () => { video.removeEventListener("timeupdate", onTimeUpdate); clearInterval(iv); };
  }, [status, cam?.url]);

  if (!cam) {
    return (
      <div className="relative bg-zinc-900 rounded overflow-hidden w-full h-full flex items-center justify-center text-zinc-700 text-xs border border-zinc-800">
        no camera assigned
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded overflow-hidden w-full h-full">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {(!hasPlayedRef.current || stale) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <p className="text-[10px] font-mono text-amber-300 px-2 text-center">{stale ? "no live signal" : status}</p>
        </div>
      )}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono text-zinc-200">
        {label || cam.name}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable live/Delay/Intentional-Delay control — embeddable directly */
/* on a page (not a modal). Used by both the Playback screen (Referee 2)*/
/* and the Recording screen (Referee 1, disabled while recording).      */
/*   - Delay: continuous — seeks to (live - delaySeconds), keeps        */
/*     playing forward, always staying that far behind live.           */
/*   - Intentional Delay: captures wherever playback currently is at   */
/*     the moment of the click, then loops [that point - delaySeconds, */
/*     that point] forever until Back to Live is pressed.              */
/* ------------------------------------------------------------------ */
function LiveDelayPanel({ cam, delaySeconds, disabled, disabledReason, extraOverlay, videoClassName }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState("starting…");
  const [mode, setMode] = useState("live"); // "live" | "continuous" | "loop"
  const loopEndRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cam?.url) return;
    let cancelled = false;

    function setupHls() {
      if (cancelled) return;
      const hls = new Hls({ liveSyncDurationCount: 2 });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        setStatus(`error: ${data.details}`);
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { hls.destroy(); setTimeout(setupHls, 1000); }
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.loadSource(cam.url);
      hls.attachMedia(video);
      hlsRef.current = hls;
      video.addEventListener("playing", () => setStatus("playing"));
      video.addEventListener("waiting", () => setStatus("buffering…"));
    }
    async function waitThenSetup() {
      for (let i = 0; i < 30 && !cancelled; i++) {
        try { const res = await fetch(cam.url, { cache: "no-store" }); if (res.ok) { setupHls(); return; } } catch {}
        setStatus(`waiting for stream… (${i + 1})`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    waitThenSetup();
    return () => { cancelled = true; hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [cam?.url]);

  // Loop-mode playback: repeat [loopEnd - delaySeconds, loopEnd] forever
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (mode === "loop" && video.currentTime >= loopEndRef.current - 0.3) {
        video.currentTime = Math.max(0, loopEndRef.current - delaySeconds);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [mode, delaySeconds]);

  const goLive = () => {
    const video = videoRef.current;
    if (!video?.seekable.length) return;
    setMode("live");
    video.currentTime = video.seekable.end(0);
  };
  const goDelay = () => {
    const video = videoRef.current;
    if (!video?.seekable.length) return;
    setMode("continuous");
    video.currentTime = Math.max(0, video.seekable.end(0) - delaySeconds);
  };
  const goIntentionalDelay = () => {
    const video = videoRef.current;
    if (!video?.seekable.length) return;
    loopEndRef.current = video.currentTime; // exactly where playback is AT THE MOMENT of the click
    setMode("loop");
    video.currentTime = Math.max(0, loopEndRef.current - delaySeconds);
  };

  const isPlaying = status === "playing";

  return (
    <div>
      <div className={`relative bg-black rounded overflow-hidden aspect-video mb-3 ${videoClassName || ""}`}>
        {cam ? <video ref={videoRef} className="w-full h-full object-contain" muted playsInline /> : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">no camera set</div>
        )}
        {cam && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <p className="text-xs font-mono text-amber-300">{status}</p>
          </div>
        )}
        {cam && isPlaying && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/65 text-[11px] font-mono">
            {mode === "live" && <span className="text-cyan-300">● LIVE</span>}
            {mode === "continuous" && <span className="text-violet-300">−{delaySeconds}s · following live</span>}
            {mode === "loop" && <span className="text-amber-300">looping last {delaySeconds}s (intentional delay)</span>}
          </div>
        )}
        {extraOverlay}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={goDelay} disabled={disabled || !cam} className="text-xs px-3 py-1.5 rounded font-medium transition bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">
          <History className="w-3.5 h-3.5 inline mr-1" /> Delay (−{delaySeconds}s)
        </button>
        <button onClick={goIntentionalDelay} disabled={disabled || !cam} className="text-xs px-3 py-1.5 rounded font-medium transition bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">
          <Repeat className="w-3.5 h-3.5 inline mr-1" /> Intentional Delay
        </button>
        <button onClick={goLive} disabled={disabled || !cam || mode === "live"} className="text-xs px-3 py-1.5 rounded font-medium transition bg-cyan-500 text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed">
          Back to Live
        </button>
      </div>
      {disabled && <p className="text-[11px] text-zinc-600 mt-1.5">{disabledReason || "Delay controls are unavailable right now."}</p>}
    </div>
  );
}

export const TEMPLATES = {
  single: { label: "Single", slots: 1, grid: "grid-cols-1 grid-rows-1" },
  quad: { label: "2×2", slots: 4, grid: "grid-cols-2 grid-rows-2" },
  nine: { label: "3×3", slots: 9, grid: "grid-cols-3 grid-rows-3" },
  sixteen: { label: "4×4", slots: 16, grid: "grid-cols-4 grid-rows-4" },
  splitH: { label: "Top / Bottom", slots: 2, grid: "grid-cols-1 grid-rows-2" },
  topSplit: { label: "Top split + Bottom", slots: 3, grid: "grid-cols-2 grid-rows-2", spans: { 2: "col-span-2" } },
};

/* ------------------------------------------------------------------ */
/* 1) Multi-camera template view — pick a layout, assign a set of     */
/*    cameras to it, and control Live/Delay for the WHOLE set at once.*/
/* ------------------------------------------------------------------ */
export function MultiCameraTemplateView({ cameras, lockedTemplate, sharedDelaySeconds, monitorNum, slotCameraNames }) {
  const [templateKey, setTemplateKey] = useState(lockedTemplate || "quad");
  const [delaySeconds, setDelaySeconds] = useState(sharedDelaySeconds || DEFAULT_DELAY_S);
  const [groupMode, setGroupMode] = useState({ type: "live", offset: 0, nonce: 0 });

  useEffect(() => { if (lockedTemplate) setTemplateKey(lockedTemplate); }, [lockedTemplate]);
  useEffect(() => { if (sharedDelaySeconds) setDelaySeconds(sharedDelaySeconds); }, [sharedDelaySeconds]);

  const template = TEMPLATES[templateKey];
  const slots = Array.from({ length: template.slots }, (_, i) => {
    const assignedName = slotCameraNames?.[i];
    if (assignedName) return cameras.find((c) => c.name === assignedName) || null;
    return slotCameraNames ? null : (cameras[i] || null); // if an assignment array exists but this slot is empty, leave it empty rather than guessing
  });

  const setGroupLive = useCallback(() => setGroupMode((m) => ({ type: "live", offset: 0, nonce: m.nonce + 1 })), []);
  const setGroupDelay = useCallback(() => setGroupMode((m) => ({ type: "continuous", offset: delaySeconds, nonce: m.nonce + 1 })), [delaySeconds]);
  const setGroupLoop = useCallback(() => setGroupMode((m) => ({ type: "loop", offset: delaySeconds, nonce: m.nonce + 1 })), [delaySeconds]);

  // Listen for keyboard/device commands broadcast from anywhere (e.g. the
  // Referee 2 control panel, or the physical X-keys device via keyboard
  // shortcuts) targeted at this specific monitor number.
  useEffect(() => {
    if (!monitorNum) return;
    let bc;
    try { bc = new BroadcastChannel("ibrvar-control"); } catch { return; }
    bc.onmessage = (e) => {
      const cmd = e.data;
      if (cmd.monitor !== monitorNum && cmd.monitor !== "all") return;
      if (cmd.type === "live") setGroupLive();
      else if (cmd.type === "delay") setGroupDelay();
      else if (cmd.type === "intentionalDelay") setGroupLoop();
    };
    return () => bc.close();
  }, [monitorNum, setGroupLive, setGroupDelay, setGroupLoop]);

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold">Camera set — template view{monitorNum ? ` (Monitor ${monitorNum})` : ""}</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={60} value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value) || DEFAULT_DELAY_S)}
            className="w-16 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono"
          />
          <button
            onClick={setGroupDelay}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition ${groupMode.type === "continuous" ? "bg-violet-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            <History className="w-3.5 h-3.5" /> Delay all (−{delaySeconds}s)
          </button>
          <button
            onClick={setGroupLoop}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition ${groupMode.type === "loop" ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            <Repeat className="w-3.5 h-3.5" /> Intentional delay
          </button>
          <button
            onClick={setGroupLive}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition ${groupMode.type === "live" ? "bg-cyan-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Live all
          </button>
        </div>
      </div>

      {!lockedTemplate && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setTemplateKey(key)}
              className={`text-xs px-2.5 py-1 rounded border transition ${templateKey === key ? "bg-cyan-500 text-zinc-950 border-cyan-500" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className={`grid ${template.grid} gap-1.5`} style={{ aspectRatio: "16/9" }}>
        {slots.map((cam, i) => (
          <div key={cam?.id ?? `empty-${i}`} className={template.spans?.[i] || ""}>
            <VideoTile cam={cam} groupMode={groupMode} delaySeconds={delaySeconds} />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-600 mt-2">
        "Delay all" / "Live all" moves every tile in this template together, in one click — matching the 遅延ライブ切替 requirement.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2) Screen A — Race Recording (レース録画)                          */
/* ------------------------------------------------------------------ */
const RACE_TABS = ["レース", "模擬レース", "前日検査", "スタート練習"];

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

export function RaceRecordingScreen({ cam, maxRaces = 12, venue = "XXX", delaySeconds = DEFAULT_DELAY_S }) {
  const [tab, setTab] = useState(RACE_TABS[0]);
  const [raceType, setRaceType] = useState("展示"); // this is the searchable 種別 — matches Screen 2 exactly
  const [masterClockSync, setMasterClockSync] = useState(false); // TODO: wire to real 大時計 signal when available
  const [recording, setRecording] = useState(false);
  const [activeRace, setActiveRace] = useState("1R");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordCount, setRecordCount] = useState("01");
  const [recordError, setRecordError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

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
    if (!cam?.name) { setRecordError("no camera set"); return; }
    setRecordError(null);
    if (!recording) {
      try {
        const res = await fetch(`${CAMERA_SERVER}/api/cameras/${cam.name}/race-record/start`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, type: raceType, race: activeRace, count: recordCount }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "failed to start");
        setRecording(true);
        setSavedAt(null);
        setRows((r) => ({ ...r, [activeRace]: { ...r[activeRace], mainStatus: "録画中" } }));
      } catch (e) {
        setRecordError(e.message);
      }
    } else {
      try {
        const res = await fetch(`${CAMERA_SERVER}/api/cameras/${cam.name}/race-record/stop`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        setSavedAt(data.url || null); // set only once the backend confirms the file is finalized
      } catch {
        setRecordError("couldn't confirm the recording stopped — check the server");
      }
      setRecording(false);
      setRows((r) => ({ ...r, [activeRace]: { ...r[activeRace], mainStatus: "待機中" } }));
    }
  }, [cam, recording, date, raceType, activeRace, recordCount]);

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
            <Circle className="w-2 h-2 fill-white" /> REC · {date} · {raceType} · {activeRace} · #{recordCount}
          </div>
        )}
      />
      {recordError && <p className="text-xs text-red-400 mb-3">{recordError}</p>}
      {recording && (
        <p className="text-[11px] text-zinc-500 mb-3 font-mono">
          saving to: streams/{cam?.name}/recordings/{`${date}_${raceType}_${activeRace}_${recordCount}.mp4`}
        </p>
      )}
      {!recording && savedAt && (
        <p className="text-[11px] text-teal-400 mb-3 font-mono">
          saved: {savedAt} — this exact date/種別/race/回数 combination is now searchable on Screen 2.
        </p>
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
            className={`flex items-center gap-1.5 text-xs px-4 py-1.5 rounded font-medium transition ${recording ? "bg-red-500 text-white" : "bg-cyan-500 text-zinc-950"}`}
          >
            {recording ? <><Square className="w-3.5 h-3.5" /> 停止</> : <><Circle className="w-3.5 h-3.5" /> 録画</>}
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
          {raceRowsLeft.map((label) => (
            <button key={label} onClick={() => !recording && setActiveRace(label)} disabled={recording && activeRace !== label} className="w-full text-left disabled:opacity-40">
              <RaceRow label={label} row={rows[label]} selected={activeRace === label} onUpdate={(r) => setRows((prev) => ({ ...prev, [label]: r }))} />
            </button>
          ))}
        </div>
        <div>
          {raceRowsRight.map((label) => (
            <button key={label} onClick={() => !recording && setActiveRace(label)} disabled={recording && activeRace !== label} className="w-full text-left disabled:opacity-40">
              <RaceRow label={label} row={rows[label]} selected={activeRace === label} onUpdate={(r) => setRows((prev) => ({ ...prev, [label]: r }))} />
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 mt-3">
        Click a race row to select it (highlighted, marked ●) — Record acts on whichever race is selected. Race selection locks while recording.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3) Screen B — Playback (再生アプリ)                                 */
/* ------------------------------------------------------------------ */
const TIMELINE_MARKERS = ["発走", "待機", "スタート", "1-1M", "1-BS", "1-2M", "2-1M", "2-BS", "2-2M", "3-1M", "3-BS", "3-2M", "ゴール"];
const HIGHLIGHT_MARKERS = new Set(["発走", "1-BS", "2-BS", "3-BS"]);

function SearchResultsModal({ results, onCancel, onConfirm }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white text-zinc-900 rounded-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-5 gap-2 text-sm font-medium text-zinc-500 pb-2 border-b border-zinc-200">
          <span>選択</span><span>日付</span><span>種別</span><span>レース番号</span><span>回数</span>
        </div>
        {results.map((r, i) => (
          <label key={i} className="grid grid-cols-5 gap-2 text-sm py-3 border-b border-zinc-100 cursor-pointer items-center">
            <input type="radio" checked={selected === i} onChange={() => setSelected(i)} className="w-4 h-4" />
            <span>{r.date}</span><span>{r.type}</span><span>{r.race}</span><span>{r.count}</span>
          </label>
        ))}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded border border-cyan-500 text-cyan-600 text-sm">キャンセル</button>
          <button onClick={() => onConfirm(results[selected])} className="px-4 py-2 rounded bg-cyan-500 text-white text-sm">確定</button>
        </div>
      </div>
    </div>
  );
}

export function PlaybackScreen({ liveCam, delaySeconds = DEFAULT_DELAY_S }) {
  const videoRef = useRef(null);
  const [date, setDate] = useState("");
  const [type, setType] = useState("展示");
  const [raceNumber, setRaceNumber] = useState("1R");
  const [count, setCount] = useState("01");
  const [results, setResults] = useState(null);
  const [loaded, setLoaded] = useState(null); // the recording currently in the player
  const [lineMarker, setLineMarker] = useState(false);
  const [repeatSeconds, setRepeatSeconds] = useState(7);
  const [speed, setSpeed] = useState(1.0);
  const [repeatOn, setRepeatOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [markerIndex, setMarkerIndex] = useState(0);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, loaded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !repeatOn) return;
    const onTimeUpdate = () => {
      if (video.currentTime >= video.duration - 0.15) video.currentTime = Math.max(0, video.duration - repeatSeconds);
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [repeatOn, repeatSeconds]);

  const search = useCallback(async () => {
    setSearchError(null);
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (type) params.set("type", type);
    if (raceNumber) params.set("race", raceNumber);
    if (count) params.set("count", count);
    try {
      const res = await fetch(`${CAMERA_SERVER}/api/recordings?${params.toString()}`);
      const data = await res.json();
      const found = data.results || [];
      if (found.length === 0) { setSearchError("no matching recording found"); return; }
      // exact match on every field the search form can specify → skip the
      // popup and load it directly; otherwise let the operator pick
      if (date && type && raceNumber && count && found.length === 1) {
        setLoaded(found[0]);
      } else {
        setResults(found);
      }
    } catch {
      setSearchError("couldn't reach the server");
    }
  }, [date, type, raceNumber, count]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setIsPlaying(true); } else { video.pause(); setIsPlaying(false); }
  };

  // Keyboard controls for the loaded recording: Space = play/pause,
  // ArrowLeft/Right = seek 5s back/forward, S = stop.
  useEffect(() => {
    if (!loaded) return;
    const onKeyDown = (e) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      const video = videoRef.current;
      if (!video) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowLeft") { video.currentTime = Math.max(0, video.currentTime - 5); }
      else if (e.key === "ArrowRight") { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); }
      else if (e.key.toLowerCase() === "s") { video.pause(); video.currentTime = 0; setIsPlaying(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loaded]);

  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg border border-zinc-800">
      <h2 className="text-sm font-semibold mb-3">Playback — 再生アプリによるレース映像の再生</h2>

      {!loaded && liveCam && (
        <div className="mb-4">
          <LiveDelayPanel cam={liveCam} delaySeconds={delaySeconds} />
        </div>
      )}

      {(loaded || !liveCam) && (
      <div className="relative bg-black rounded overflow-hidden aspect-video mb-3">
        {loaded ? (
          <video
            ref={videoRef}
            src={`${CAMERA_SERVER}${loaded.url}`}
            className="w-full h-full object-contain"
            controls={false}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">no recording loaded — search below</div>
        )}
        {lineMarker && loaded && <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-cyan-400/60 pointer-events-none" />}
        {loaded && (
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-black/60 text-[11px] font-mono text-zinc-200">
              {loaded.date} · {loaded.type} · {loaded.race} · #{loaded.count}
            </span>
            <button onClick={() => { setLoaded(null); setIsPlaying(false); }} className="px-2 py-1 rounded bg-cyan-500 text-zinc-950 text-[11px] font-semibold">
              ← Back to Live
            </button>
          </div>
        )}
      </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">検索条件</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[11px] text-zinc-500 block">日付</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block">種別</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">
                <option>展示</option><option>本番</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block">レース番号</label>
              <select value={raceNumber} onChange={(e) => setRaceNumber(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">
                {Array.from({ length: 12 }, (_, i) => `${i + 1}R`).map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block">回数</label>
              <select value={count} onChange={(e) => setCount(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs">
                {["01", "02", "03"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={search} className="flex items-center gap-1.5 bg-cyan-500 text-zinc-950 text-xs font-medium px-3 py-1.5 rounded">
              <Search className="w-3.5 h-3.5" /> 検索
            </button>
          </div>
          {searchError && <p className="text-xs text-red-400 mt-1.5">{searchError}</p>}
          <p className="text-[11px] text-zinc-600 mt-1.5">Leave 日付 blank to see every matching race across all dates.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">ラインマーカ</span>
            <button onClick={() => setLineMarker((v) => !v)} className={`w-9 h-5 rounded-full relative transition ${lineMarker ? "bg-cyan-500" : "bg-zinc-700"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${lineMarker ? "left-4" : "left-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">リピート再生</span>
            <input type="number" value={repeatSeconds} onChange={(e) => setRepeatSeconds(Number(e.target.value) || 7)} className="w-14 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 font-mono" />
            <span className="text-zinc-500">秒</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">再生速度</span>
            {[0.5, 1.0, 2.0].map((s) => (
              <label key={s} className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={speed === s} onChange={() => setSpeed(s)} /> {s}x
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mb-4 px-2">
        <div className="h-0.5 bg-zinc-700 relative">
          {TIMELINE_MARKERS.map((m, i) => (
            <button
              key={m}
              onClick={() => {
                setMarkerIndex(i);
                const video = videoRef.current;
                if (video?.duration) video.currentTime = (i / (TIMELINE_MARKERS.length - 1)) * video.duration;
              }}
              className="absolute -top-1.5 flex flex-col items-center"
              style={{ left: `${(i / (TIMELINE_MARKERS.length - 1)) * 100}%`, transform: "translateX(-50%)" }}
              title="Marker position is proportional until real per-marker timestamps are available"
            >
              <span className={`w-3 h-3 rounded-full border-2 border-zinc-950 ${i === markerIndex ? "bg-cyan-400" : "bg-blue-500"}`} />
              <span className={`text-[10px] mt-3 whitespace-nowrap ${HIGHLIGHT_MARKERS.has(m) ? "text-red-400" : "text-zinc-400"}`}>{m}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 -mt-2 mb-4">
        Timeline markers are placed proportionally along the clip for now — wire them to real race-event timestamps once that data source exists.
      </p>

      <div className="flex items-center justify-between mt-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setMarkerIndex((i) => Math.max(0, i - 1))} className="p-2 rounded bg-zinc-800 hover:bg-zinc-700"><SkipBack className="w-4 h-4" /></button>
          <button onClick={togglePlay} className="p-2 rounded bg-cyan-500 text-zinc-950">{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
          <button onClick={() => setMarkerIndex((i) => Math.min(TIMELINE_MARKERS.length - 1, i + 1))} className="p-2 rounded bg-zinc-800 hover:bg-zinc-700"><SkipForward className="w-4 h-4" /></button>
          <button onClick={() => setRepeatOn((v) => !v)} className={`p-2 rounded ${repeatOn ? "bg-violet-500 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`} title="リピート再生">
            <Repeat className="w-4 h-4" />
          </button>
        </div>
        <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
          <ExternalLink className="w-3.5 h-3.5" /> 外部出力
        </button>
      </div>

      {results && (
        <SearchResultsModal
          results={results}
          onCancel={() => setResults(null)}
          onConfirm={(r) => { setLoaded(r); setResults(null); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo shell — just for wiring this into your existing project so you */
/* can see all three; replace with your own navigation/routing later. */
/* ------------------------------------------------------------------ */
export default function RaceOperationDemo() {
  const [cameras, setCameras] = useState([]);
  const [view, setView] = useState("template");
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    fetch(`${CAMERA_SERVER}/api/cameras`).then((r) => r.json()).then((data) => {
      const names = data?.running || [];
      setCameras(names.map((name, i) => ({ id: i + 1, name, url: `${CAMERA_SERVER}/streams/${name}/live.m3u8` })));
    }).catch(() => {});
  }, []);

  const addCamera = async () => {
    if (!urlInput.trim()) return;
    const name = nameInput.trim() || `cam${Date.now()}`;
    const res = await fetch(`${CAMERA_SERVER}/api/cameras`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url: urlInput.trim() }),
    });
    const data = await res.json();
    setCameras((prev) => [...prev, { id: prev.length + 1, name: data.name, url: `${CAMERA_SERVER}${data.hlsUrl}` }]);
    setUrlInput(""); setNameInput("");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[["template", "Template view"], ["recording", "Screen 1 · Recording"], ["playback", "Screen 2 · Playback"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`text-xs px-3 py-1.5 rounded border ${view === k ? "bg-cyan-500 text-zinc-950 border-cyan-500" : "bg-zinc-900 text-zinc-400 border-zinc-800"}`}>{l}</button>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="camera URL" className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs w-56" />
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="name" className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs w-28" />
            <button onClick={addCamera} className="flex items-center gap-1 bg-cyan-500 text-zinc-950 text-xs px-2.5 py-1.5 rounded"><Plus className="w-3.5 h-3.5" /> add</button>
          </div>
        </div>

        {view === "template" && <MultiCameraTemplateView cameras={cameras} />}
        {view === "recording" && <RaceRecordingScreen cam={cameras[0]} />}
        {view === "playback" && <PlaybackScreen />}
      </div>
    </div>
  );
}