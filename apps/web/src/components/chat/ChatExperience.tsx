"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bolt, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { RayBackground } from "@/components/RayBackground";
import { Composer } from "./Composer";
import { Interpretation } from "./Interpretation";
import { StrategyCard } from "./StrategyCard";
import { ExecutionCard } from "./ExecutionCard";
import type { ChatMessage, DiscoveryResult, ExecutionReport, Strategy } from "@/lib/types";

const SUGGESTIONS = [
  "I think Bitcoin will have a huge year.",
  "The Fed will cut rates soon.",
  "Republicans are going to win in 2028.",
  "Trump won't finish his term.",
];

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data as T;
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2)}`;
}

export function ChatExperience() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discoveryRef = useRef<DiscoveryResult | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const add = (msg: Omit<ChatMessage, "id" | "createdAt">) =>
    setMessages((m) => [...m, { ...msg, id: uid(), createdAt: Date.now() }]);

  // Core: run discovery for a fresh thesis and propose a strategy. Resets any
  // prior strategy so the new belief is not constrained by stale markets.
  async function discoverAndPropose(thesis: string) {
    setStrategy(null);
    discoveryRef.current = null;
    const discovery = await postJSON<DiscoveryResult>("/api/discover", { thesis });
    discoveryRef.current = discovery;
    add({
      role: "assistant",
      kind: "interpretation",
      content: `I read your thesis and found ${discovery.markets.length} relevant market${
        discovery.markets.length === 1 ? "" : "s"
      }.`,
      discovery,
    });

    if (discovery.markets.length === 0) {
      add({
        role: "assistant",
        kind: "text",
        content:
          "I couldn't find any liquid markets that match that belief. Try a different thesis.",
      });
      return;
    }

    const next = await postJSON<Strategy>("/api/strategy", {
      thesis,
      markets: discovery.markets,
    });
    setStrategy(next);
    add({
      role: "assistant",
      kind: "strategy",
      content: "Here's a strategy to express that belief:",
      strategy: next,
    });
  }

  // Core: refine the current strategy against its existing markets.
  async function proposeRefine(instruction: string) {
    const discovery = discoveryRef.current;
    if (!discovery || !strategy) return discoverAndPropose(instruction);
    const next = await postJSON<Strategy>("/api/strategy", {
      thesis: strategy.thesis,
      markets: discovery.markets,
      instructions: instruction,
      prior: strategy,
    });
    setStrategy(next);
    add({
      role: "assistant",
      kind: "strategy",
      content: "Updated the strategy based on your instruction:",
      strategy: next,
    });
  }

  async function runThesis(thesis: string, displayContent?: string) {
    setError(null);
    setBusy(true);
    add({ role: "user", kind: "thesis", content: displayContent ?? thesis });
    try {
      await discoverAndPropose(thesis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    const discovery = discoveryRef.current;
    if (!discovery || !strategy) return;
    setError(null);
    setBusy(true);
    try {
      const next = await postJSON<Strategy>("/api/strategy", {
        thesis: strategy.thesis,
        markets: discovery.markets,
      });
      setStrategy(next);
      add({
        role: "assistant",
        kind: "strategy",
        content: "Regenerated a fresh strategy:",
        strategy: next,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function approve(toExecute: Strategy) {
    setError(null);
    setBusy(true);
    try {
      const report = await postJSON<ExecutionReport>("/api/execute", { strategy: toExecute });
      setExecutedIds((s) => new Set(s).add(toExecute.id));
      add({
        role: "assistant",
        kind: "execution",
        content: report.allFilled
          ? "All trades executed."
          : "Execution finished. See the report below.",
        execution: report,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execution failed.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    setStrategy(null);
    discoveryRef.current = null;
    setExecutedIds(new Set());
    setError(null);
    setInput("");
  }

  async function handleFollowUp(text: string) {
    setError(null);
    setBusy(true);
    add({ role: "user", kind: "text", content: text });
    try {
      const { intent, thesis } = await postJSON<{ intent: "refine" | "new_thesis"; thesis: string }>(
        "/api/classify",
        { message: text, priorThesis: strategy?.thesis ?? "" },
      );
      if (intent === "new_thesis") {
        await discoverAndPropose(thesis || text);
      } else {
        await proposeRefine(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (strategy && !executedIds.has(strategy.id)) {
      void handleFollowUp(text);
    } else {
      void runThesis(text);
    }
  }

  // --- Landing hero --------------------------------------------------------
  if (messages.length === 0) {
    return (
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden px-4">
        <RayBackground />
        <div className="absolute top-8 z-20">
          <div
            className="relative inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm text-white"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
              backdropFilter: "blur(20px) saturate(140%)",
              boxShadow:
                "inset 0 1px rgba(255,255,255,0.2), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <Bolt className="size-4" />
            <span className="font-medium">Natural-language trading on Alpha Arcade</span>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[680px] flex flex-col items-center">
          <div className="text-center mb-6">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">
              What do you{" "}
              <span className="bg-gradient-to-b from-[#4da5fc] via-[#4da5fc] to-white bg-clip-text text-transparent italic">
                believe
              </span>{" "}
              will happen?
            </h1>
            <p className="text-base sm:text-lg text-[#8a8a8f] font-medium">
              Describe a belief. VibeQuant finds the markets and builds the trade.
            </p>
          </div>

          <div className="w-full">
            <Composer value={input} onChange={setInput} onSubmit={submit} busy={busy} autoFocus />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput("");
                  void runThesis(s);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 bg-[#0f0f0f]/60 hover:bg-[#1a1a1e] text-[#8a8a8f] hover:text-white transition-all active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Conversation --------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-4 py-6 space-y-5">
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              busy={busy}
              executed={m.strategy ? executedIds.has(m.strategy.id) : false}
              isLatestStrategy={m.strategy?.id === strategy?.id}
              onApprove={() => m.strategy && approve(m.strategy)}
              onRegenerate={regenerate}
              onCancel={reset}
            />
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-[#8a8a8f] vq-pulse">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
              <AlertTriangle className="size-4" /> {error}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/5 bg-[#0f0f0f]/80 backdrop-blur-xl">
        <div className="max-w-[760px] mx-auto px-4 py-4">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={submit}
            busy={busy}
            placeholder={
              strategy && !executedIds.has(strategy.id)
                ? "Refine the strategy (e.g. use only 10 USDC, less risk)…"
                : "Describe another belief…"
            }
            submitLabel={strategy && !executedIds.has(strategy.id) ? "Refine" : "Build strategy"}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-[#6a6a6f]">
            <button onClick={reset} className="hover:text-white transition-colors">
              New thesis
            </button>
            <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-white transition-colors">
              View dashboard <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  busy,
  executed,
  isLatestStrategy,
  onApprove,
  onRegenerate,
  onCancel,
}: {
  message: ChatMessage;
  busy: boolean;
  executed: boolean;
  isLatestStrategy: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end vq-fade-in">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#1488fc] text-white px-4 py-2.5 text-sm leading-relaxed shadow-[0_0_20px_rgba(20,136,252,0.25)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="vq-fade-in space-y-3">
      {message.content && <p className="text-sm text-[#c8c8cd] leading-relaxed">{message.content}</p>}
      {message.discovery && <Interpretation discovery={message.discovery} />}
      {message.strategy && (
        <StrategyCard
          strategy={message.strategy}
          busy={busy}
          executed={executed || !isLatestStrategy}
          onApprove={onApprove}
          onRegenerate={onRegenerate}
          onCancel={onCancel}
        />
      )}
      {message.execution && <ExecutionCard report={message.execution} />}
    </div>
  );
}
