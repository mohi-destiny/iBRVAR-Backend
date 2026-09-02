import { useRef, useEffect } from "react";
import Hls from "hls.js";

// Waits for the manifest to actually exist, retries on failure, and (for
// delay mode) seeks before ever calling play() so live is never briefly
// visible before snapping back. Also protects against background-tab
// throttling causing a false "network error" reconnect.
export function useHlsVideo(videoRef, url, { autoSeekBack, delaySeconds, onSeekTiming, onStatus } = {}) {
  const hlsRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    onStatus?.("loading manifest…");

    function doSeek(retriesLeft = 15, onDone) {
      if (!video.seekable.length) {
        if (retriesLeft > 0) setTimeout(() => doSeek(retriesLeft - 1, onDone), 200);
        return;
      }
      const startT = performance.now();
      const offset = autoSeekBack ? delaySeconds : 0;
      const target = Math.max(0, video.seekable.end(0) - offset);
      const onSeeked = () => {
        onSeekTiming?.(performance.now() - startT);
        video.removeEventListener("seeked", onSeeked);
        onDone?.();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = target;
    }

    let onLoadedNative;
    let cancelled = false;

    function setupHls() {
      if (cancelled) return;
      const hls = new Hls({ liveSyncDurationCount: 2 });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        onStatus?.(`error: ${data.details}${data.fatal ? " (fatal)" : ""}`);
        if (!data.fatal) return;
        if (document.hidden) return; // backgrounded-tab throttling looks like a network error but isn't a real disconnect
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.destroy();
          onStatus?.("retrying…");
          setTimeout(setupHls, 1000);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          hls.destroy();
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoSeekBack) {
          // seek first so the delayed position is what the viewer sees —
          // never briefly show live before snapping back
          onStatus?.("seeking to delay position…");
          doSeek(15, () => video.play().catch((e) => onStatus?.(`play() rejected: ${e.message}`)));
        } else {
          onStatus?.("manifest parsed…");
          video.play().catch((e) => onStatus?.(`play() rejected: ${e.message}`));
        }
      });
      hls.on(Hls.Events.FRAG_LOADED, () => onStatus?.("receiving video"));

      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;
    }

    async function waitForManifestThenSetup() {
      for (let attempt = 1; attempt <= 30 && !cancelled; attempt++) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) { setupHls(); return; }
        } catch {
          // network hiccup — keep trying
        }
        onStatus?.(`waiting for stream to start… (${attempt})`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) onStatus?.("stream never became available after 30s");
    }

    if (Hls.isSupported()) {
      video.addEventListener("waiting", () => onStatus?.("waiting for data…"));
      video.addEventListener("stalled", () => onStatus?.("stalled"));
      video.addEventListener("playing", () => onStatus?.("playing"));
      video.addEventListener("pause", () => onStatus?.("paused"));
      waitForManifestThenSetup();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      onLoadedNative = () => { video.play().catch(() => {}); doSeek(); onStatus?.("playing (native)"); };
      video.addEventListener("loadedmetadata", onLoadedNative);
    }

    const onVisible = () => {
      if (!document.hidden && hlsRef.current) hlsRef.current.startLoad();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (onLoadedNative) video.removeEventListener("loadedmetadata", onLoadedNative);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}
