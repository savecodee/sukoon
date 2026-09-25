import { useEffect } from "react";
import { unlockAudio } from "@/lib/chime";
import { startAmbience, stopAmbience } from "@/lib/ambience";
import { usePomodoro, type Phase } from "@/lib/pomodoro-store";

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function phaseLabel(phase: Phase) {
  if (phase === "work") return "تركيز";
  if (phase === "long") return "استراحة طويلة";
  return "استراحة";
}

export function useTimerEngine() {
  const status = usePomodoro((s) => s.status);
  const phase = usePomodoro((s) => s.phase);
  const remainingMs = usePomodoro((s) => s.remainingMs);
  const notice = usePomodoro((s) => s.notice);
  const ambience = usePomodoro((s) => s.settings.ambience);

  useEffect(() => {
    if (status === "running" && phase === "work" && ambience !== "off") startAmbience(ambience);
    else stopAmbience();
    return () => stopAmbience();
  }, [status, phase, ambience]);

  useEffect(() => {
    const finish = usePomodoro.persist.onFinishHydration(() => {
      usePomodoro.getState().afterHydrate();
    });
    void usePomodoro.persist.rehydrate();
    return finish;
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "sukoon-pomodoro-v1") void usePomodoro.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      usePomodoro.getState().tick(Date.now());
    }, 200);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    const label = phaseLabel(phase);
    if (status === "idle" && !notice) {
      document.title = "سكون";
      return;
    }
    document.title = `${formatTime(remainingMs)} · ${label}`;
  }, [phase, remainingMs, status, notice]);

  useEffect(() => {
    if (status !== "running" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () => {
      void navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) {
            void sentinel.release();
            return;
          }
          lock = sentinel;
        })
        .catch(() => {});
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [status]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "KeyR") return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        unlockAudio();
        const { status: run, start, pause } = usePomodoro.getState();
        if (run === "running") pause();
        else start();
      }
      if (event.code === "KeyR" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        usePomodoro.getState().resetPhase();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}
