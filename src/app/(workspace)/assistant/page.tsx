"use client";

import { PageHeader } from "@/components/ui/Primitives";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  Database,
  ExternalLink,
  Info,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
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
  isConnected?: boolean;
  model: string;
  error?: string;
  capabilities: string[];
}

const SUGGESTED_QUESTIONS = [
  "hello",
  "How many active subscriptions do we have?",
  "What is our current MRR?",
  "Show overdue invoices and outstanding amounts.",
  "Which subscriptions are renewing in the next 7 days?",
  "How much revenue was collected this month?",
  "Which subscription plan generates the most revenue?",
];

const MAX_QUESTION_LENGTH = 1000;

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);

  const fetchStatus = () => {
    setStatusLoading(true);
    fetch("/api/assistant/status")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setStatus(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        setStatusLoading(false);
      });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const askAssistant = async (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > MAX_QUESTION_LENGTH) {
      setErrorMessage(
        `Question exceeds the maximum allowed length of ${MAX_QUESTION_LENGTH} characters (current length: ${trimmed.length}).`
      );
      setErrorStatus(400);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setErrorStatus(null);
    setLastFailedQuestion(null);

    try {
      const res = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        throw new Error(
          `Server returned non-JSON response (HTTP ${res.status} ${res.statusText})`
        );
      }

      if (!res.ok || !json?.success) {
        const errorText =
          json?.error?.message ||
          `Request failed with status code ${res.status} (${res.statusText})`;
        setErrorMessage(errorText);
        setErrorStatus(res.status);
        setLastFailedQuestion(trimmed);
        return;
      }

      // Success: add to history and clear input
      setHistory((prev) => [json.data, ...prev]);
      setQuestion("");
    } catch (err: unknown) {
      const errorText =
        err instanceof Error
          ? err.message
          : "Network error: Unable to communicate with the Billora intelligence server.";
      setErrorMessage(errorText);
      setErrorStatus(0);
      setLastFailedQuestion(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedQuestion) {
      askAssistant(lastFailedQuestion);
    } else if (question.trim()) {
      askAssistant(question);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header + Status Indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          category="EXECUTIVE INTELLIGENCE • ZERO HALLUCINATION"
          title="AI Business Assistant"
          description="Ask natural-language questions grounded strictly on live, RBAC-scoped billing and financial records."
        />

        {/* Engine Status Pill */}
        <div className="flex items-center gap-2">
          {statusLoading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-subtle px-3.5 py-1.5 text-xs text-text-muted">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-text-muted" />
              <span>Verifying Engine...</span>
            </div>
          ) : status?.isConnected ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-semibold text-brand shadow-xs">
              <Sparkles className="h-4 w-4 animate-pulse text-brand" />
              <span>Google Gemini Active</span>
              <span className="font-mono text-[11px] rounded bg-brand/20 px-2 py-0.5 text-brand">
                {status.model}
              </span>
            </div>
          ) : status?.isConfigured ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-400 shadow-xs">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>SQL Aggregation Engine (AI Key Offline)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-subtle px-3.5 py-1.5 text-xs font-semibold text-text-secondary shadow-xs">
              <Database className="h-4 w-4 text-text-muted" />
              <span>Deterministic SQL Aggregation Engine</span>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Prompts & Input Card */}
      <div className="rounded-xl border border-border bg-bg-base p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-text-muted">
            <Zap className="h-3.5 w-3.5 text-brand" /> Verified Executive Questions
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" /> LIVE DB GROUNDING • ZERO HALLUCINATION
          </span>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((sq) => (
            <button
              key={sq}
              type="button"
              disabled={loading}
              onClick={() => {
                setQuestion(sq);
                askAssistant(sq);
              }}
              className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:border-brand hover:text-brand hover:bg-brand/5 transition-all disabled:opacity-50 text-left"
            >
              {sq === "hello" ? "👋 Say Hello" : sq}
            </button>
          ))}
        </div>

        {/* Error Banner with Retry */}
        {errorMessage && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              {errorStatus === 401 || errorStatus === 403 ? (
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-red-200">
                  {errorStatus === 401
                    ? "Authentication Required"
                    : errorStatus === 403
                    ? "Access Restricted"
                    : "Query Execution Notice"}
                </p>
                <p className="text-[11px] text-red-300/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {errorStatus === 401 && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition-all"
                >
                  <span>Log In</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 hover:bg-red-500/30 transition-all"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Query Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askAssistant(question);
          }}
          className="mt-4 flex flex-col gap-2"
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={question}
                disabled={loading}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                maxLength={MAX_QUESTION_LENGTH}
                placeholder="Ask about active subscriptions, MRR, ARR, overdue invoices, renewals in 7 days, plan revenue..."
                className="h-11 w-full rounded-lg border border-border bg-bg-base px-4 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="inline-flex items-center gap-2 h-11 rounded-lg bg-brand px-5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50 shadow-sm transition-all shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Analyzing Live DB...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{status?.isConnected ? "Ask Gemini" : "Query Intelligence"}</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-text-muted">
            <span>Enterprise read-only access. Calculations never alter database state.</span>
            <span
              className={
                question.length > 900
                  ? "text-amber-400 font-mono"
                  : "text-text-muted font-mono"
              }
            >
              {question.length}/{MAX_QUESTION_LENGTH}
            </span>
          </div>
        </form>
      </div>

      {/* Answers Feed */}
      <div className="space-y-4">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg-base/50 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand mb-3">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">
              Ready to Answer Financial Queries
            </h3>
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
            {/* Header: Question + Metadata Badges */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    turn.aiPowered
                      ? "bg-brand/10 text-brand"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {turn.aiPowered ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">{turn.question}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {turn.aiPowered ? (
                      <span className="font-mono text-[10px] text-brand">
                        AI-Grounded • {turn.modelUsed || "Gemini"}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-emerald-400">
                        Deterministic SQL Engine
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-subtle px-2.5 py-1 border border-border text-text-secondary">
                  <Calendar className="h-3 w-3" /> {turn.periodUsed}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2.5 py-1 text-brand font-medium">
                  <Database className="h-3 w-3" /> {turn.dataSource}
                </span>
              </div>
            </div>

            {/* Natural Language Answer */}
            <div className="rounded-lg bg-bg-subtle/50 p-4 border border-border/50">
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
                      <div className="mt-1 font-mono text-xs font-bold text-text-primary truncate">
                        {String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Records Table */}
            {turn.records && turn.records.length > 0 && (
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <div className="bg-bg-subtle px-4 py-2 text-[11px] font-mono uppercase font-semibold text-text-muted border-b border-border">
                  Detailed Live Database Records ({turn.records.length})
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bg-subtle/60 text-[10px] font-mono uppercase text-text-muted border-b border-border">
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
                        <tr
                          key={rIdx}
                          className="hover:bg-bg-subtle/40 transition-colors"
                        >
                          {Object.values(rec).map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-4 py-2 text-text-primary truncate max-w-[200px]"
                            >
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
