import { useState } from "react";
import { IDE_OPTIONS, IdeId } from "@/hooks/use-ide-selection";

interface IdeSelectorProps {
  onSelect: (ide: IdeId) => void;
}

export function IdeSelector({ onSelect }: IdeSelectorProps) {
  const [hovered, setHovered] = useState<IdeId | null>(null);
  const [pressed, setPressed] = useState<IdeId | null>(null);

  const handleSelect = (id: IdeId) => {
    setPressed(id);
    setTimeout(() => onSelect(id), 180);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#060D1A] px-6 py-10 relative overflow-hidden">

      {/* Ambient glow rings behind the icon */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="w-[420px] h-[420px] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute w-[220px] h-[220px] rounded-full bg-cyan-400/8 blur-2xl" />
      </div>

      {/* Central bracket icon */}
      <div className="relative mb-8">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center
                     bg-slate-900 border border-cyan-500/20
                     shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_40px_rgba(34,211,238,0.15)]"
        >
          <span
            className="font-mono font-bold text-2xl select-none"
            style={{
              background: "linear-gradient(135deg, #67e8f9 0%, #22d3ee 50%, #0e7490 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {"< />"}
          </span>
        </div>
        {/* Soft pulse ring */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl border border-cyan-400/20 animate-ping"
          style={{ animationDuration: "3s" }}
        />
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-white tracking-tight mb-3 text-center">
        Select an IDE Agent
      </h1>

      {/* Subtitle */}
      <p className="text-sm text-slate-400 max-w-sm text-center leading-relaxed mb-10">
        Each agent is a specialized AI persona for your IDE workflow. Leaders plan and
        coordinate. Workers implement, review, and ship.
      </p>

      {/* IDE buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-md sm:max-w-2xl">
        {IDE_OPTIONS.map(({ id, label }) => {
          const isHovered = hovered === id;
          const isPressed = pressed === id;

          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              className={[
                "relative flex flex-col items-center justify-center gap-2 py-5 px-3",
                "rounded-xl border transition-all duration-200 select-none",
                "backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
                isPressed
                  ? "scale-95 bg-cyan-500/15 border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                  : isHovered
                  ? "bg-slate-800/70 border-cyan-500/30 shadow-[0_0_16px_rgba(34,211,238,0.15)] scale-[1.03]"
                  : "bg-slate-900/60 border-slate-700/50 hover:border-slate-600",
              ].join(" ")}
            >
              {/* Glow dot */}
              <div
                className={[
                  "w-2 h-2 rounded-full transition-all duration-200",
                  isHovered || isPressed
                    ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                    : "bg-slate-700",
                ].join(" ")}
              />

              <span
                className={[
                  "text-sm font-semibold tracking-wide transition-colors duration-200",
                  isHovered || isPressed ? "text-cyan-300" : "text-slate-300",
                ].join(" ")}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <p className="mt-10 text-[11px] text-slate-600 font-mono text-center tracking-wide">
        Compatible with any IDE that supports AI agents
      </p>
    </div>
  );
}
