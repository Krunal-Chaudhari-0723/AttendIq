import { cn } from "@/lib/utils";

export const DEVELOPER = {
  name: "Krunal Chaudhari",
  portfolio: "https://krunalchaudhari.dev/",
  freelance: "https://www.chaudharikrunal.me/",
};

/** "Developed by" credit shown in every footer. tone="dark" for navy surfaces. */
export function DeveloperCredit({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  const link = cn(
    "font-semibold underline-offset-2 hover:underline",
    dark ? "text-white hover:text-accent-300" : "text-brand-800 hover:text-accent-700"
  );
  return (
    <p className={cn("text-[11px]", dark ? "text-brand-100/60" : "text-slate-500", className)}>
      Developed by{" "}
      <a href={DEVELOPER.portfolio} target="_blank" rel="noopener noreferrer" className={link}>
        {DEVELOPER.name}
      </a>
      <span aria-hidden="true"> · </span>
      <a href={DEVELOPER.freelance} target="_blank" rel="noopener noreferrer" className={link}>
        Hire for freelance work
      </a>
    </p>
  );
}
