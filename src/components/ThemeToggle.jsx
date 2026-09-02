import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-lg hover:bg-zinc-700 transition"
    >
      {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}