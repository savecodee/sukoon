import { createFileRoute } from "@tanstack/react-router";
import { DeskView } from "@/components/desk-view";
import { PomodoroApp } from "@/components/pomodoro-app";

type HomeSearch = { view?: "desk" };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch =>
    search.view === "desk" ? { view: "desk" } : {},
  component: Home,
});

function Home() {
  const { view } = Route.useSearch();
  if (view === "desk") return <DeskView />;
  return <PomodoroApp />;
}

