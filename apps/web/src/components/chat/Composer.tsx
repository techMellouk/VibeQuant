"use client";

import React, { useEffect, useRef } from "react";
import { SendHorizontal, Sparkles, Loader2 } from "lucide-react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  busy?: boolean;
  autoFocus?: boolean;
  submitLabel?: string;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = "What do you believe will happen?",
  busy = false,
  autoFocus = false,
  submitLabel = "Build strategy",
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy) onSubmit();
    }
  };

  return (
    <div className="relative w-full">
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
      <div className="relative rounded-2xl bg-[#1e1e22] ring-1 ring-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_20px_rgba(0,0,0,0.4)]">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={1}
          className="w-full resize-none bg-transparent text-[15px] text-white placeholder-[#5a5a5f] px-5 pt-5 pb-3 focus:outline-none min-h-[64px] max-h-[200px]"
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-[#8a8a8f]">
            <Sparkles className="size-4 text-[#4da5fc]" />
            <span>AI strategist</span>
          </div>

          <button
            onClick={() => !busy && onSubmit()}
            disabled={busy || !value.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#1488fc] hover:bg-[#1a94ff] text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_20px_rgba(20,136,252,0.3)]"
          >
            <span className="hidden sm:inline">{busy ? "Working…" : submitLabel}</span>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
