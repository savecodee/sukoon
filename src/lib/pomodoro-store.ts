import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { playChime } from "@/lib/chime";
import { startAmbience, stopAmbience, type Ambience } from "@/lib/ambience";

export type Phase = "work" | "short" | "long";
export type RunStatus = "idle" | "running" | "paused";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  pomodoros: number;
};

export type Project = {
  id: string;
  name: string;
  focusMinutes: number;
  score: number;
};

export type Settings = {
  workMin: number;
  shortMin: number;
  longMin: number;
  cycleLength: number;
  sound: boolean;
  ambience: Ambience;
};

type Notice = { id: number; text: string } | null;

type Snapshot = {
  settings: Settings;
  phase: Phase;
  status: RunStatus;
  remainingMs: number;
  phaseTotalMs: number;
  endsAt: number | null;
  cycleSessions: number;
  todayKey: string;
  todaySessions: number;
  focusMinutes: number;
  score: number;
  weekLog: Record<string, number>;
  projects: Project[];
  activeProjectId: string | null;
  customPhrases: string[];
  intention: string;
  keptIntention: string;
  tasks: Task[];
  activeTaskId: string | null;
};

type Store = Snapshot & {
  notice: Notice;
  start: () => void;
  pause: () => void;
  resetPhase: () => void;
  skip: () => void;
  tick: (now: number) => void;
  completePhase: (opts?: { silent?: boolean }) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  setActiveTask: (id: string) => void;
  newCycle: () => void;
  toggleSound: () => void;
  setIntention: (text: string) => void;
  addProject: (name: string) => void;
  selectProject: (id: string | null) => void;
  removeProject: (id: string) => void;
  addPhrase: (text: string) => void;
  removePhrase: (text: string) => void;
  afterHydrate: () => void;
};

export const DEFAULT_SETTINGS: Settings = {
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  cycleLength: 4,
  sound: true,
  ambience: "off",
};

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function durationMs(settings: Settings, phase: Phase) {
  const min =
    phase === "work" ? settings.workMin : phase === "short" ? settings.shortMin : settings.longMin;
  return min * 60_000;
}

function todayStamp(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeSettings(input: Partial<Settings> | undefined, base: Settings): Settings {
  return {
    workMin: clamp(input?.workMin ?? base.workMin, 1, 90),
    shortMin: clamp(input?.shortMin ?? base.shortMin, 1, 45),
    longMin: clamp(input?.longMin ?? base.longMin, 1, 60),
    cycleLength: clamp(input?.cycleLength ?? base.cycleLength, 2, 8),
    sound: input?.sound ?? base.sound,
    ambience: input?.ambience === "rain" || input?.ambience === "room" || input?.ambience === "off" ? input.ambience : base.ambience,
  };
}

function phaseCopy(from: Phase, to: Phase): string {
  if (from === "work" && to === "long") return "اكتملت الدورة. خذ استراحة طويلة.";
  if (from === "work") return "انتهى التركيز. استراحة قصيرة.";
  if (from === "long") return "بدأت دورة جديدة. المهام المنجزة أُزيلت.";
  return "انتهت الاستراحة. عودة إلى التركيز.";
}

function advance(
  s: Snapshot,
  opts: { creditWork: boolean; clearDone: boolean; forceShort: boolean },
): Pick<
  Snapshot,
  | "phase"
  | "remainingMs"
  | "phaseTotalMs"
  | "cycleSessions"
  | "todaySessions"
  | "todayKey"
  | "focusMinutes"
  | "score"
  | "weekLog"
  | "projects"
  | "tasks"
  | "activeTaskId"
> {
  const key = todayStamp();
  let todaySessions = s.todayKey === key ? s.todaySessions : 0;
  let cycleSessions = s.cycleSessions;
  let focusMinutes = s.focusMinutes;
  let score = s.score;
  let weekLog = s.weekLog ?? {};
  let projects = Array.isArray(s.projects) ? s.projects : [];
  let tasks = s.tasks;
  let activeTaskId = s.activeTaskId;
  let phase: Phase;

  if (s.phase === "work") {
    if (opts.creditWork) {
      const minutes = s.settings.workMin;
      todaySessions += 1;
      cycleSessions += 1;
      focusMinutes += minutes;
      let points = minutes;
      if (cycleSessions >= s.settings.cycleLength) points += 20;
      score += points;
      weekLog = { ...weekLog, [key]: (weekLog[key] ?? 0) + minutes };
      if (s.activeProjectId) {
        projects = projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, focusMinutes: project.focusMinutes + minutes, score: project.score + points }
            : project,
        );
      }
      if (activeTaskId) {
        tasks = tasks.map((task) =>
          task.id === activeTaskId && !task.done ? { ...task, pomodoros: task.pomodoros + 1 } : task,
        );
      }
      phase = cycleSessions >= s.settings.cycleLength ? "long" : "short";
    } else {
      phase = "short";
    }
    if (opts.forceShort) phase = "short";
  } else if (s.phase === "long") {
    phase = "work";
    cycleSessions = 0;
    if (opts.clearDone) {
      tasks = tasks.filter((task) => !task.done);
      if (activeTaskId && !tasks.some((task) => task.id === activeTaskId)) {
        activeTaskId = tasks[0]?.id ?? null;
      }
    }
  } else {
    phase = "work";
  }

  const total = durationMs(s.settings, phase);
  return {
    phase,
    remainingMs: total,
    phaseTotalMs: total,
    cycleSessions,
    todaySessions,
    todayKey: key,
    focusMinutes,
    score,
    weekLog,
    projects,
    tasks,
    activeTaskId,
  };
}

let noticeSeq = 1;
let completing = false;

const initialTotal = durationMs(DEFAULT_SETTINGS, "work");

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function asPhase(value: unknown): Phase {
  return value === "short" || value === "long" || value === "work" ? value : "work";
}

function asStatus(value: unknown): RunStatus {
  return value === "running" || value === "paused" || value === "idle" ? value : "idle";
}

function cleanWeek(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 70);
  const minKey = todayStamp(cutoff);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key < minKey) continue;
    const minutes = Number(value);
    if (Number.isFinite(minutes) && minutes > 0) out[key] = clamp(minutes, 0, 2000);
  }
  return out;
}

function cleanProjects(input: unknown): Project[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => !!item && typeof item.id === "string" && typeof item.name === "string" && item.name.trim())
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      name: item.name.trim().slice(0, 32),
      focusMinutes: clamp(Number(item.focusMinutes) || 0, 0, 100000),
      score: clamp(Number(item.score) || 0, 0, 100000),
    }));
}

function cleanPhrases(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const clean = item.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 12) break;
  }
  return out;
}

function syncAmbience(get: () => { status: RunStatus; phase: Phase; settings: Settings }) {
  const s = get();
  if (s.status === "running" && s.phase === "work" && s.settings.ambience !== "off") startAmbience(s.settings.ambience);
  else stopAmbience();
}

export const usePomodoro = create<Store>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      phase: "work",
      status: "idle",
      remainingMs: initialTotal,
      phaseTotalMs: initialTotal,
      endsAt: null,
      cycleSessions: 0,
      todayKey: todayStamp(),
      todaySessions: 0,
      focusMinutes: 0,
      score: 0,
      weekLog: {},
      projects: [],
      activeProjectId: null,
      customPhrases: [],
      intention: "",
      keptIntention: "",
      tasks: [],
      activeTaskId: null,
      notice: null,

      start: () => {
        const s = get();
        if (s.status === "running") return;
        if (s.remainingMs <= 0) {
          get().completePhase();
          return;
        }
        set({ status: "running", endsAt: Date.now() + s.remainingMs, notice: null });
        syncAmbience(get);
      },

      pause: () => {
        const s = get();
        if (s.status !== "running" || s.endsAt == null) return;
        set({
          status: "paused",
          remainingMs: Math.max(0, s.endsAt - Date.now()),
          endsAt: null,
        });
        stopAmbience();
      },

      resetPhase: () => {
        const s = get();
        const total = durationMs(s.settings, s.phase);
        set({ status: "idle", remainingMs: total, phaseTotalMs: total, endsAt: null, notice: null });
        stopAmbience();
      },

      skip: () => {
        if (completing) return;
        completing = true;
        const s = get();
        const next = advance(s, {
          creditWork: false,
          clearDone: false,
          forceShort: s.phase === "work",
        });
        set({ ...next, status: "idle", endsAt: null, notice: null });
        completing = false;
        stopAmbience();
      },

      tick: (now) => {
        const s = get();
        if (s.status !== "running" || s.endsAt == null) return;
        const left = s.endsAt - now;
        if (left <= 0) {
          get().completePhase();
          return;
        }
        set({ remainingMs: left });
      },

      completePhase: (opts) => {
        if (completing) return;
        completing = true;
        const s = get();
        const from = s.phase;
        const next = advance(s, {
          creditWork: from === "work",
          clearDone: from === "long",
          forceShort: false,
        });
        const gained = next.score - s.score;
        const base = phaseCopy(from, next.phase);
        const trimmed = s.intention.trim().slice(0, 80);
        set({
          ...next,
          status: "idle",
          endsAt: null,
          keptIntention: from === "work" && trimmed ? trimmed : s.keptIntention,
          notice: { id: noticeSeq++, text: gained > 0 ? `${base} +${gained} درجة.` : base },
        });
        completing = false;
        stopAmbience();
        if (!opts?.silent && get().settings.sound) playChime();
      },

      updateSettings: (partial) => {
        set((s) => {
          const settings = normalizeSettings({ ...s.settings, ...partial }, s.settings);
          const oldFull = durationMs(s.settings, s.phase);
          const newFull = durationMs(settings, s.phase);
          let remainingMs = s.remainingMs;
          let phaseTotalMs = s.phaseTotalMs;
          if (s.status !== "running") {
            if (s.remainingMs === oldFull || remainingMs > newFull) {
              remainingMs = newFull;
              phaseTotalMs = newFull;
            }
          }
          let cycleSessions = s.cycleSessions;
          if (s.phase !== "long" && cycleSessions > settings.cycleLength) {
            cycleSessions = settings.cycleLength;
          }
          return { settings, remainingMs, phaseTotalMs, cycleSessions };
        });
        syncAmbience(get);
      },

      addTask: (title) => {
        const clean = title.trim().replace(/\s+/g, " ").slice(0, 120);
        if (!clean) return;
        const id = crypto.randomUUID();
        set((s) => ({
          tasks: [...s.tasks, { id, title: clean, done: false, pomodoros: 0 }],
          activeTaskId: s.activeTaskId ?? id,
        }));
      },

      toggleTask: (id) => {
        set((s) => {
          const tasks = s.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
          const toggled = tasks.find((task) => task.id === id);
          let activeTaskId = s.activeTaskId;
          if (toggled?.done && activeTaskId === id) {
            activeTaskId = tasks.find((task) => !task.done)?.id ?? null;
          }
          return { tasks, activeTaskId };
        });
      },

      removeTask: (id) => {
        set((s) => {
          const tasks = s.tasks.filter((task) => task.id !== id);
          const activeTaskId =
            s.activeTaskId === id ? (tasks.find((task) => !task.done)?.id ?? tasks[0]?.id ?? null) : s.activeTaskId;
          return { tasks, activeTaskId };
        });
      },

      setActiveTask: (id) => {
        set((s) => (s.tasks.some((task) => task.id === id) ? { activeTaskId: id } : {}));
      },

      newCycle: () => {
        set((s) => {
          const tasks = s.tasks.filter((task) => !task.done);
          const activeTaskId = tasks.some((task) => task.id === s.activeTaskId)
            ? s.activeTaskId
            : (tasks[0]?.id ?? null);
          return {
            tasks,
            activeTaskId,
            cycleSessions: 0,
            notice: { id: noticeSeq++, text: "دورة جديدة. بقيت المهام غير المنجزة." },
          };
        });
      },

      toggleSound: () => {
        set((s) => ({ settings: { ...s.settings, sound: !s.settings.sound } }));
      },

      setIntention: (text) => {
        set({ intention: text.replace(/\s+/g, " ").slice(0, 80) });
      },

      addProject: (name) => {
        const clean = name.trim().replace(/\s+/g, " ").slice(0, 32);
        if (!clean) return;
        const id = crypto.randomUUID();
        set((s) => {
          if (s.projects.length >= 8) return {};
          return {
            projects: [...s.projects, { id, name: clean, focusMinutes: 0, score: 0 }],
            activeProjectId: id,
          };
        });
      },

      selectProject: (id) => {
        set((s) => ({ activeProjectId: id && s.projects.some((project) => project.id === id) ? id : null }));
      },

      removeProject: (id) => {
        set((s) => ({
          projects: s.projects.filter((project) => project.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        }));
      },

      addPhrase: (text) => {
        const clean = text.trim().replace(/\s+/g, " ").slice(0, 80);
        if (!clean) return;
        set((s) => {
          if (s.customPhrases.includes(clean) || s.customPhrases.length >= 12) return {};
          return { customPhrases: [...s.customPhrases, clean] };
        });
      },

      removePhrase: (text) => {
        set((s) => ({ customPhrases: s.customPhrases.filter((line) => line !== text) }));
      },

      afterHydrate: () => {
        const key = todayStamp();
        set((s) => {
          const phase = asPhase(s.phase);
          const status = asStatus(s.status);
          const settings = normalizeSettings(s.settings, DEFAULT_SETTINGS);
          const tasks = Array.isArray(s.tasks)
            ? s.tasks
                .filter(
                  (task) =>
                    !!task &&
                    typeof task.id === "string" &&
                    typeof task.title === "string" &&
                    task.title.length > 0,
                )
                .map((task) => ({
                  id: task.id,
                  title: task.title.slice(0, 120),
                  done: Boolean(task.done),
                  pomodoros: clamp(Number(task.pomodoros) || 0, 0, 999),
                }))
            : [];
          const activeTaskId = tasks.some((task) => task.id === s.activeTaskId) ? s.activeTaskId : null;
          const total = durationMs(settings, phase);
          const phaseTotalMs = Number.isFinite(s.phaseTotalMs) && s.phaseTotalMs > 0 ? s.phaseTotalMs : total;
          const remainingMs = Number.isFinite(s.remainingMs)
            ? Math.min(Math.max(0, s.remainingMs), phaseTotalMs)
            : total;
          const projects = cleanProjects(s.projects);
          const activeProjectId = projects.some((project) => project.id === s.activeProjectId) ? s.activeProjectId : null;
          return {
            phase,
            status,
            settings,
            tasks,
            activeTaskId,
            phaseTotalMs,
            remainingMs,
            cycleSessions: clamp(s.cycleSessions, 0, settings.cycleLength),
            todayKey: key,
            todaySessions: s.todayKey === key ? clamp(s.todaySessions, 0, 999) : 0,
            focusMinutes: clamp(Number(s.focusMinutes) || 0, 0, 100000),
            score: clamp(Number(s.score) || 0, 0, 100000),
            weekLog: cleanWeek(s.weekLog),
            projects,
            activeProjectId,
            customPhrases: cleanPhrases(s.customPhrases),
            intention: typeof s.intention === "string" ? s.intention.slice(0, 80) : "",
            keptIntention: typeof s.keptIntention === "string" ? s.keptIntention.slice(0, 80) : "",
            endsAt: typeof s.endsAt === "number" ? s.endsAt : null,
          };
        });
        const s = get();
        if (s.status === "running") {
          if (s.endsAt == null) set({ status: "paused" });
          else if (s.endsAt <= Date.now()) get().completePhase({ silent: true });
          else set({ remainingMs: Math.max(0, s.endsAt - Date.now()) });
        }
        syncAmbience(get);
      },
    }),
    {
      name: "sukoon-pomodoro-v1",
      skipHydration: true,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage() : localStorage,
      ),
      partialize: (s) => ({
        settings: s.settings,
        phase: s.phase,
        status: s.status,
        remainingMs: s.remainingMs,
        phaseTotalMs: s.phaseTotalMs,
        endsAt: s.endsAt,
        cycleSessions: s.cycleSessions,
        todayKey: s.todayKey,
        todaySessions: s.todaySessions,
        focusMinutes: s.focusMinutes,
        score: s.score,
        weekLog: s.weekLog,
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        customPhrases: s.customPhrases,
        intention: s.intention,
        keptIntention: s.keptIntention,
        tasks: s.tasks,
        activeTaskId: s.activeTaskId,
      }),
    },
  ),
);
