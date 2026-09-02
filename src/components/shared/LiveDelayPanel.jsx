import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { History, Repeat } from "lucide-react";

// Reusable live/Delay/Intentional-Delay control — embeddable directly on a
// page (not a modal). Used by both the Playback screen (Referee 2) and the
// Recording screen (Referee 1, disabled while recording).
//   - Delay: continuous — seeks to (live - delaySeconds), keeps playing
//     forward, always staying that far behind live.
//   - Intentional Delay: captures wherever playback currently is at the
//     moment of the click, then loops [that point - delaySeconds, that
//     point] forever until Back to Live is pressed.
export function LiveDelayPanel({ cam, delaySeconds, disabled, disabledReason, extraOverlay, videoClassName }) {
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
