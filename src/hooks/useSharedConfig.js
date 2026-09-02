import { useState, useEffect, useCallback } from "react";
import { CAMERA_SERVER } from "../constants";

const DEFAULT_CONFIG = {
  delaySeconds: 10,
  maxRaces: 12,
  venue: "XXX",
  monitorTemplates: { 1: "quad", 2: "single", 3: "single", 4: "single" },
  monitorCameraAssignments: { 1: [], 2: [], 3: [], 4: [] },
};

// Shared config (delay time, max races, per-monitor template/camera
// assignment) — reads from and writes to the backend, so Admin's changes
// reach every other open tab (Referee 1, Referee 2, display tabs) within
// a few seconds via polling.
export function useSharedConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    const load = () => fetch(`${CAMERA_SERVER}/api/config`).then((r) => r.json()).then(setConfig).catch(() => {});
    load();
    const iv = setInterval(load, 5000); // poll so other tabs' changes show up without a manual refresh
    return () => clearInterval(iv);
  }, []);

  const updateConfig = useCallback(async (partial) => {
    setConfig((prev) => ({ ...prev, ...partial })); // optimistic
    try {
      const res = await fetch(`${CAMERA_SERVER}/api/config`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partial),
      });
      const data = await res.json();
      setConfig(data);
    } catch {
      // keep the optimistic value; next poll will reconcile
    }
  }, []);

  return { config, updateConfig };
}
