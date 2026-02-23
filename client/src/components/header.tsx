import { BookOpen } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" data-testid="link-home">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-tight tracking-tight">Hebrew to English Translator</span>
          </div>
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
