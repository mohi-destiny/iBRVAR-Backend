import { useState, useRef, useEffect } from "react";
import { useGroupHlsVideo } from "../../hooks/useGroupHlsVideo";
import { CAMERA_SERVER } from "../../constants";

// Live mode — the existing behavior: plays this camera's live HLS stream,
// driven by the group's live/delay/loop mode.
function LiveVideoTile({ cam, groupMode, delaySeconds, label }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("starting…");
  const [stale, setStale] = useState(false);
  const hasPlayedRef = useRef(false);
  const lastProgressRef = useRef(Date.now());
  const { goLive, goDelay, goLoop } = useGroupHlsVideo(videoRef, cam?.url, { onStatus: setStatus });

  const groupModeKey = groupMode ? `${groupMode.type}-${groupMode.nonce}` : null;
  useEffect(() => {
    if (!groupMode) return;
    if (groupMode.type === "live") goLive();
    else if (groupMode.type === "continuous") goDelay(groupMode.offset ?? delaySeconds);
    else if (groupMode.type === "loop") goLoop(groupMode.offset ?? delaySeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupModeKey]);

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

  return (
    <>
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {(!hasPlayedRef.current || stale) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <p className="text-[10px] font-mono text-amber-300 px-2 text-center">{stale ? "no live signal" : status}</p>
        </div>
      )}
    </>
  );
}

// Playback mode — this specific camera's recorded clip for the searched
// race, synced to play/pause/seek/speed commands broadcast from Referee 2's
// transport controls (see Referee2View / playbackCommand).
function RecordedVideoTile({ cam, playbackSource, playbackCommand }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("looking up recording…");
  const [clip, setClip] = useState(null);

  useEffect(() => {
    setClip(null);
    setStatus("looking up recording…");
    const params = new URLSearchParams({ camera: cam.name, date: playbackSource.date, type: playbackSource.type, race: playbackSource.race, count: playbackSource.count });
    fetch(`${CAMERA_SERVER}/api/recordings?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.results?.[0];
        if (!found) { setStatus("no recording for this camera"); return; }
        setClip(found);
        setStatus("ready");
      })
      .catch(() => setStatus("couldn't reach the server"));
  }, [cam.name, playbackSource.date, playbackSource.type, playbackSource.race, playbackSource.count]);

  // apply synced transport commands (play/pause/seek/speed)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackCommand) return;
    if (playbackCommand.action === "play") video.play().catch(() => {});
    else if (playbackCommand.action === "pause") video.pause();
    else if (playbackCommand.action === "seek") video.currentTime = Math.max(0, (video.currentTime || 0) + playbackCommand.value);
    else if (playbackCommand.action === "speed") video.playbackRate = playbackCommand.value;
    else if (playbackCommand.action === "restart") { video.currentTime = 0; video.pause(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackCommand?.nonce]);

  return (
    <>
      {clip ? (
        <video
          ref={videoRef}
          src={`${CAMERA_SERVER}${clip.url}`}
          className="w-full h-full object-cover"
          muted
          playsInline
          onPlay={() => setStatus("playing")}
          onPause={() => setStatus("paused")}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <p className="text-[10px] font-mono text-amber-300 px-2 text-center">{status}</p>
        </div>
      )}
    </>
  );
}

export function VideoTile({ cam, groupMode, delaySeconds, label, playbackSource, playbackCommand }) {
  if (!cam) {
    return (
      <div className="relative bg-zinc-900 rounded overflow-hidden w-full h-full flex items-center justify-center text-zinc-700 text-xs border border-zinc-800">
        no camera assigned
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded overflow-hidden w-full h-full">
      {playbackSource ? (
        <RecordedVideoTile cam={cam} playbackSource={playbackSource} playbackCommand={playbackCommand} />
      ) : (
        <LiveVideoTile cam={cam} groupMode={groupMode} delaySeconds={delaySeconds} label={label} />
      )}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono text-zinc-200">
        {label || cam.name}
      </div>
    </div>
  );
}