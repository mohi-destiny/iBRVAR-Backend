import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCw, History } from "lucide-react";
import { useHlsVideo } from "../../hooks/useHlsVideo";
import { accentFor } from "../../constants";

export function DelayModal({ cam, delaySeconds, onClose, onCpuLog }) {
  const videoRef = useRef(null);
  const accent = accentFor(cam.id);
  const [status, setStatus] = useState("starting…");
  const [looping, setLooping] = useState(false);
  const stallTimerRef = useRef(null);
  const loopModeRef = useRef(false);
  const loopEndRef = useRef(0);

  useHlsVideo(videoRef, cam.url, {
    autoSeekBack: true,
    delaySeconds,
    onSeekTiming: (ms) => onCpuLog(cam, "delay click → seek", ms),
    onStatus: setStatus,
  });

  // If no new data arrives for a while (source disconnected / race ended),
  // stop waiting forever — instead loop the last `delaySeconds` of video
  // that's already buffered, repeatedly.
  useEffect(() => {
    if (status === "playing") {
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
      if (loopModeRef.current) { loopModeRef.current = false; setLooping(false); }
      return;
    }
    if (!stallTimerRef.current && !loopModeRef.current) {
      stallTimerRef.current = setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        loopEndRef.current = video.currentTime;
        loopModeRef.current = true;
        setLooping(true);
      }, 5000);
    }
    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [status]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (!loopModeRef.current) return;
      if (video.currentTime >= loopEndRef.current - 0.3) {
        video.currentTime = Math.max(0, loopEndRef.current - delaySeconds);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [delaySeconds]);

  const resync = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.seekable.length) return;
    loopModeRef.current = false;
    setLooping(false);
    const startT = performance.now();
    video.currentTime = Math.max(0, video.seekable.end(0) - delaySeconds);
    const onSeeked = () => {
      onCpuLog(cam, "resync → seek", performance.now() - startT);
      video.removeEventListener("seeked", onSeeked);
    };
    video.addEventListener("seeked", onSeeked);
  }, [cam, delaySeconds, onCpuLog]);

  // Deliberate "Loop" mode: the operator explicitly asks to repeat the last
  // `delaySeconds` window forever, instead of "Continuous" mode where the
  // view keeps following live, always staying delaySeconds behind.
  const startLoopMode = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.seekable.length) return;
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    loopEndRef.current = video.seekable.end(0);
    loopModeRef.current = true;
    setLooping(true);
    video.currentTime = Math.max(0, loopEndRef.current - delaySeconds);
  }, [delaySeconds]);

  const isPlaying = status === "playing" || looping;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: accent.solid }} />
            <p className="text-sm text-zinc-100 font-medium">{cam.name}</p>
            <span className="text-xs text-zinc-500">{looping ? `looping last ${delaySeconds}s` : `delayed −${delaySeconds}s, continues forward`}</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2 px-4 pt-3">
          <button
            onClick={resync}
            className={`text-xs px-3 py-1.5 rounded font-medium transition ${!looping ? "bg-cyan-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            Continuous — follows live, −{delaySeconds}s behind
          </button>
          <button
            onClick={startLoopMode}
            className={`text-xs px-3 py-1.5 rounded font-medium transition ${looping ? "bg-violet-500 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            Loop last {delaySeconds}s
          </button>
        </div>

        <div className="relative bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-contain" muted playsInline controls={false} />
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center text-center px-4">
              <p className="text-xs font-mono text-amber-300">{status}</p>
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
            <History className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-mono tabular-nums text-violet-300">
              {looping ? `looping last ${delaySeconds}s` : `−${delaySeconds}s · following live`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={resync} className="flex items-center gap-1 flex-1 justify-center text-xs py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
            <RotateCw className="w-3.5 h-3.5" /> Resync
          </button>
          <button onClick={onClose} className="flex-1 text-xs py-1.5 rounded bg-cyan-500 text-zinc-950 font-medium hover:bg-cyan-400">
            Back to live
          </button>
        </div>
      </div>
    </div>
  );
}
