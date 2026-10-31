"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { Bot, Database, Send, ShieldCheck, Sparkles } from "lucide-react";
import React, { useState } from "react";

interface ChatTurn {
  question: string;
  answer: string;
  periodUsed: string;
  dataSource: string;
  metrics: Record<string, string | number>;
  records?: Record<string, unknown>[];
}

const SUGGESTED_QUESTIONS = [
  "How many subscriptions are active and what is our MRR?",
  "Which invoices are overdue?",
  "Which customers have unpaid invoices?",
  "Which subscriptions expire this week?",
  "Which subscription plan generates the most revenue?",
  "How much revenue was collected this month?",
];

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);

  const askAssistant = async (qText: string) => {
    if (!qText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: qText }),
      });
      const json = await res.json();
      if (json.success) {
        setHistory((prev) => [json.data, ...prev]);
        setQuestion("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        category="READ-ONLY FINANCIAL QUERY ENGINE"
        title="AI Business Assistant"
        description="Ask natural-language questions against live, RBAC-scoped database records. Every response includes the exact calculation period and SQL data source."
      />

      {/* Suggested Prompts */}
      <div className="mb-6 rounded-lg border border-border bg-bg-base p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Verified Financial Prompts (1-Click)
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-semantic-success">
            <ShieldCheck className="h-3.5 w-3.5" /> READ-ONLY DB ACCESS • ZERO HALLUCINATION
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => askAssistant(sq)}
              className="rounded-md border border-border bg-bg-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:border-brand hover:text-brand transition-colors"
            >
              {sq}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            askAssistant(question);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about MRR, ARR, overdue invoices, expiring subscriptions, or top plans..."
            className="h-10 flex-1 rounded-md border border-border bg-bg-base px-3.5 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-10 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? "Querying DB..." : "Ask Assistant"}
          </button>
        </form>
      </div>

      {/* Responses Feed */}
      <div className="space-y-4">
        {history.map((turn, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-border bg-bg-base p-5 shadow-xs space-y-4"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold text-text-primary">{turn.question}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                <span className="rounded bg-bg-subtle px-2 py-0.5 border border-border text-text-secondary">
                  Period: {turn.periodUsed}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-brand-subtle px-2 py-0.5 text-brand">
                  <Database className="h-3 w-3" /> {turn.dataSource}
                </span>
              </div>
            </div>

            <p className="text-sm text-text-primary leading-relaxed">{turn.answer}</p>

            {/* Key Metrics Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {Object.entries(turn.metrics).map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-md border border-border bg-bg-subtle/50 px-3 py-2"
                >
                  <div className="text-[10px] font-mono uppercase text-text-muted truncate">
                    {k}
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-bold text-text-primary">
                    {String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
