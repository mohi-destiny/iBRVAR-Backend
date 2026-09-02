import { useState, useRef, useEffect, useCallback } from "react";
import { CAMERA_SERVER } from "../constants";

// Shared camera state — used by every screen that needs to show a video
// feed. Also handles "reconnect on load": if the backend already has
// cameras running (e.g. after a page refresh), they're restored without
// needing to be re-added.
export function useCameras() {
  const [cameras, setCameras] = useState([]);
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [addStatus, setAddStatus] = useState(null);
  const nextId = useRef(1);
  const addingRef = useRef(false);

  useEffect(() => {
    fetch(`${CAMERA_SERVER}/api/cameras`).then((r) => r.json()).then((data) => {
      const names = data?.running || [];
      setCameras((prev) => {
        const existing = new Set(prev.map((c) => c.name));
        const restored = names.filter((n) => !existing.has(n)).map((name) => ({
          id: nextId.current++, name, url: `${CAMERA_SERVER}/streams/${name}/live.m3u8`,
        }));
        return [...prev, ...restored];
      });
    }).catch(() => {});
  }, []);

  const addCamera = useCallback(async () => {
    if (!urlInput.trim() || addingRef.current) return;
    addingRef.current = true;
    const id = nextId.current++;
    const name = nameInput.trim() || `Camera ${id}`;
    setAddStatus("adding");
    try {
      const res = await fetch(`${CAMERA_SERVER}/api/cameras`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url: urlInput.trim() }),
      });
      if (!res.ok) throw new Error("rejected");
      const data = await res.json();
      setCameras((prev) => [...prev, { id, name: data.name, url: `${CAMERA_SERVER}${data.hlsUrl}` }]);
      setUrlInput(""); setNameInput(""); setAddStatus(null);
    } catch {
      setAddStatus("error");
    } finally {
      addingRef.current = false;
    }
  }, [urlInput, nameInput]);

  const removeCamera = useCallback((id, cam) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    if (cam?.name) fetch(`${CAMERA_SERVER}/api/cameras/${cam.name}`, { method: "DELETE" }).catch(() => {});
  }, []);

  return { cameras, urlInput, setUrlInput, nameInput, setNameInput, addStatus, addCamera, removeCamera };
}
