"use client";

import { PageHeader } from "@/components/ui/Primitives";
import {
  AlertCircle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Database,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface ChatTurn {
  question: string;
  answer: string;
  periodUsed: string;
  dataSource: string;
  metrics: Record<string, string | number>;
  records?: Record<string, unknown>[];
  aiPowered?: boolean;
  modelUsed?: string;
}

interface AssistantStatus {
  provider: string;
  isConfigured: boolean;
  model: string;
  capabilities: string[];
}

const SUGGESTED_QUESTIONS = [
  "How many subscriptions are active and what is our MRR?",
  "Which invoices are overdue and what is the total outstanding amount?",
  "Which subscriptions expire or renew this week?",
  "Which subscription plan generates the most revenue?",
  "How much revenue was collected this month?",
  "Provide an executive health summary of Billora's current financial position.",
];

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<AssistantStatus | null>(null);

  useEffect(() => {
    fetch("/api/assistant/status")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setStatus(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const askAssistant = async (qText: string) => {
    if (!qText.trim() || loading) return;
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          category="EXECUTIVE INTELLIGENCE • ZERO HALLUCINATION"
          title="AI Business Assistant"
          description="Ask natural-language questions grounded exclusively on live, RBAC-scoped PostgreSQL & Prisma aggregations."
        />

        {/* Gemini Engine Status Pill */}
        <div className="flex items-center gap-2">
          {status?.isConfigured ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-semibold text-brand shadow-xs">
              <Sparkles className="h-4 w-4 animate-pulse text-brand" />
              <span>Google Gemini Active</span>
              <span className="font-mono text-[11px] rounded bg-brand/20 px-2 py-0.5 text-brand">
                {status.model}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-subtle px-3.5 py-1.5 text-xs font-semibold text-text-secondary shadow-xs">
              <Database className="h-4 w-4 text-text-muted" />
              <span>SQL Aggregation Engine</span>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Prompts & Input Card */}
      <div className="rounded-xl border border-border bg-bg-base p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-text-muted">
            <Zap className="h-3.5 w-3.5 text-brand" /> 1-Click Executive Financial Queries
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-semantic-success">
            <ShieldCheck className="h-3.5 w-3.5" /> LIVE DB GROUNDING • ZERO HALLUCINATION
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((sq) => (
            <button
              key={sq}
              type="button"
              disabled={loading}
              onClick={() => askAssistant(sq)}
              className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:border-brand hover:text-brand hover:bg-brand-subtle transition-all disabled:opacity-50 text-left"
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
          <div className="relative flex-1">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about MRR, ARR, overdue invoices, expiring subscriptions, plan performance..."
              className="h-11 w-full rounded-lg border border-border bg-bg-base px-4 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-2 h-11 rounded-lg bg-brand px-5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50 shadow-sm transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Analyzing Live DB...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Ask Gemini</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Responses Feed */}
      <div className="space-y-4">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg-base/50 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand mb-3">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Ready to Answer Financial Queries</h3>
            <p className="mt-1 max-w-md text-xs text-text-muted">
              Select one of the verified prompts above or type your own question to receive instant,
              computationally exact insights from your database.
            </p>
          </div>
        )}

        {history.map((turn, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-border bg-bg-base p-6 shadow-xs space-y-4 transition-all"
          >
            {/* Header: Question + Badges */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  {turn.aiPowered ? (
                    <Sparkles className="h-4 w-4 text-brand" />
                  ) : (
                    <Bot className="h-4 w-4 text-brand" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">{turn.question}</h4>
                  {turn.modelUsed && (
                    <span className="font-mono text-[10px] text-brand">
                      Powered by {turn.modelUsed}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-subtle px-2.5 py-1 border border-border text-text-secondary">
                  <Calendar className="h-3 w-3" /> {turn.periodUsed}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-brand-subtle px-2.5 py-1 text-brand font-medium">
                  <Database className="h-3 w-3" /> {turn.dataSource}
                </span>
              </div>
            </div>

            {/* Natural Language Answer */}
            <div className="rounded-lg bg-bg-subtle/40 p-4 border border-border/50">
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line font-normal">
                {turn.answer}
              </p>
            </div>

            {/* Key Metrics Grid */}
            {turn.metrics && Object.keys(turn.metrics).length > 0 && (
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-2">
                  Verified Data Points
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {Object.entries(turn.metrics).map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg border border-border bg-bg-subtle/70 px-3 py-2.5"
                    >
                      <div className="text-[10px] font-mono uppercase text-text-muted truncate">
                        {k.replace(/([A-Z])/g, " $1")}
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-text-primary">
                        {String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Records Table */}
            {turn.records && turn.records.length > 0 && (
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <div className="bg-bg-subtle px-4 py-2 text-[11px] font-mono uppercase font-semibold text-text-muted border-b border-border">
                  Detailed Live Database Records ({turn.records.length})
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bg-subtle/50 text-[10px] font-mono uppercase text-text-muted border-b border-border">
                      <tr>
                        {Object.keys(turn.records[0]).map((col) => (
                          <th key={col} className="px-4 py-2 font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-[11px]">
                      {turn.records.map((rec, rIdx) => (
                        <tr key={rIdx} className="hover:bg-bg-subtle/40 transition-colors">
                          {Object.values(rec).map((val, cIdx) => (
                            <td key={cIdx} className="px-4 py-2 text-text-primary truncate max-w-[200px]">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
