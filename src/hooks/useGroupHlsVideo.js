import { useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";

// Same robust manifest-waiting/retry/visibility-change behavior as
// useHlsVideo, but exposes imperative goLive/goDelay/goLoop functions
// instead of a fixed autoSeekBack mode — needed so a parent (the template
// view) can drive many tiles' delay/loop state together as a group.
export function useGroupHlsVideo(videoRef, url, { onStatus } = {}) {
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
      if (!document.hidden && hlsRef.current) hlsRef.current.startLoad();
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
