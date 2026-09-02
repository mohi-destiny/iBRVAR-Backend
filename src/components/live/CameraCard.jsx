import { useState, useRef, useEffect } from "react";
import { X, History, Radio, HardDrive } from "lucide-react";
import { useHlsVideo } from "../../hooks/useHlsVideo";
import { accentFor, fmtClock } from "../../constants";

export function CameraCard({ cam, now, onRemove, onOpenDelay, delaySeconds }) {
  const videoRef = useRef(null);
  const accent = accentFor(cam.id);
  const startRef = useRef(null);
  const [status, setStatus] = useState("starting…");

  useHlsVideo(videoRef, cam.url, { onStatus: setStatus });

  const isPlaying = status === "playing";
  if (isPlaying && startRef.current === null) startRef.current = now;

  const [stale, setStale] = useState(false);
  const lastProgressRef = useRef(Date.now());
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => { lastProgressRef.current = Date.now(); if (stale) setStale(false); };
    video.addEventListener("timeupdate", onTimeUpdate);
    const iv = setInterval(() => {
      if (startRef.current !== null && Date.now() - lastProgressRef.current > 6000) setStale(true);
    }, 1000);
    return () => { video.removeEventListener("timeupdate", onTimeUpdate); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.url]);

  const secondsPlaying = startRef.current !== null ? (now - startRef.current) / 1000 : 0;
  const delayReady = secondsPlaying >= delaySeconds;
  const secondsUntilReady = Math.max(0, Math.ceil(delaySeconds - secondsPlaying));

  const elapsed = startRef.current !== null ? fmtClock(now - startRef.current) : "00:00.0";
  const pulseOn = Math.floor((now + cam.id * 137) / 450) % 2 === 0;

  return (
    <div className="bg-zinc-900 border rounded-lg overflow-hidden flex flex-col" style={{ borderColor: "rgb(39 39 42)", borderTopColor: accent.solid, borderTopWidth: "2px" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0 transition-opacity" style={{ background: accent.solid, opacity: pulseOn ? 1 : 0.25 }} />
          <div className="min-w-0">
            <p className="text-sm text-zinc-100 truncate">{cam.name}</p>
            <p className="text-xs text-zinc-500 font-mono truncate">{cam.url}</p>
          </div>
        </div>
        <button onClick={() => onRemove(cam.id, cam)} className="text-zinc-600 hover:text-zinc-300 shrink-0 ml-2" aria-label="Remove camera">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative bg-black aspect-video" style={{ minHeight: "180px" }}>
        <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
        {(startRef.current === null || stale) && (
          <div className="absolute inset-0 bg-black flex items-center justify-center text-center px-4 z-10">
            <p className="text-xs font-mono text-amber-300">{stale ? "no live signal" : status}</p>
          </div>
        )}
        {startRef.current !== null && !stale && (
          <>
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/65 backdrop-blur-sm border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[13px] font-mono tabular-nums leading-none text-zinc-100">{elapsed}</span>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/65 backdrop-blur-sm border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-xs font-mono text-cyan-300">LIVE</span>
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => onOpenDelay(cam.id)}
        disabled={!delayReady}
        className="flex items-center justify-center gap-1.5 mx-3 mt-2 text-xs py-1.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: accent.soft, border: `1px solid ${accent.border}`, color: accent.solid }}
      >
        <History className="w-3.5 h-3.5" /> {delayReady ? "Delay" : `Delay (ready in ${secondsUntilReady}s)`}
      </button>

      <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-zinc-500">
        <Radio className="w-3 h-3 text-cyan-400 shrink-0" />
        <span>broadcast</span>
        <span className="text-zinc-700">·</span>
        <HardDrive className="w-3 h-3 text-teal-400 shrink-0" />
        <span className="text-teal-400">recording on server</span>
      </div>
    </div>
  );
}
