"use client";

import { FormField, useToast } from "@/components/ui/Primitives";
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BilloraLogo } from "@/components/brand/Logo";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("admin@billora.io");
  const [password, setPassword] = useState("Admin@Billora2026!");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error?.message || "Invalid credentials");
        return;
      }

      toast({
        title: "Authenticated",
        description: `Welcome back, ${json.data.user.fullName}`,
        variant: "success",
      });

      if (json.data.user.role === "CUSTOMER") {
        router.push("/portal");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setErrorMsg("Network error occurred while signing in");
    } finally {
      setLoading(false);
    }
  };

  const fillRoleCredentials = (role: "ADMIN" | "EMPLOYEE" | "CUSTOMER") => {
    setErrorMsg(null);
    if (role === "ADMIN") {
      setEmail("admin@billora.io");
      setPassword("Admin@Billora2026!");
    } else if (role === "EMPLOYEE") {
      setEmail("arjun.mehta@billora.io");
      setPassword("Emp@Billora2026!");
    } else {
      setEmail("priya.sharma@acmeindia.in");
      setPassword("Cust@Billora2026!");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-bg-canvas">
      {/* Left Brand & Architecture Column (#0B1220) */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-bg-sidebar text-white p-10 border-r border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <BilloraLogo variant="dark" size="lg" priority />
            <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-300">
              v1.0 ENTERPRISE
            </span>
          </div>

          <h1 className="mt-12 text-3xl font-semibold tracking-tight leading-tight">
            Every Subscription.
            <br />
            One Intelligent Platform.
          </h1>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-md">
            Unified subscription lifecycle governance, idempotent recurring invoice generation,
            automated GST & discount rules, and real-time revenue intelligence.
          </p>

          <div className="mt-10 space-y-4 border-t border-white/10 pt-8 text-xs text-slate-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Exact Decimal Financial Ledger</div>
                <div className="text-slate-400 mt-0.5">
                  Zero floating-point drift across multi-variant products, discounts, and GST.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Idempotent Recurring Billing Engine</div>
                <div className="text-slate-400 mt-0.5">
                  Composite unique constraints and row-level locking prevent duplicate invoices.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">3 Role-Isolated Experiences</div>
                <div className="text-slate-400 mt-0.5">
                  Administrator Dashboard, Employee Operations Workspace, and Customer Self-Service Portal.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-6 text-xs font-mono text-slate-400">
          <span>BILLORA FINTECH CORE</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> RBAC + HMAC VERIFIED
          </span>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-border bg-bg-base p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <div className="lg:hidden mb-4 flex justify-center">
                <BilloraLogo variant="auto" size="md" />
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">
                Authentication
              </div>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">
                Sign in to Billora
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Enter your account credentials or select a pre-seeded role below.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-semantic-danger/30 bg-semantic-danger-subtle px-3.5 py-2.5 text-xs font-medium text-semantic-danger"
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Email Address" htmlFor="login-email" required>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-bg-base pl-9 pr-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </div>
              </FormField>

              <FormField label="Password" htmlFor="login-password" required>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-bg-base pl-9 pr-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </div>
              </FormField>

              <div className="flex items-center justify-between text-xs">
                <Link
                  href="/forgot-password"
                  className="font-medium text-brand hover:underline"
                >
                  Forgot password?
                </Link>
                <Link
                  href="/register"
                  className="font-medium text-text-secondary hover:text-text-primary"
                >
                  Create customer account →
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover active:bg-brand-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* Quick Credentials Fill for Seeded Roles */}
            <div className="mt-6 border-t border-border pt-5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-2.5">
                Fill Verified Demo Role Credentials
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillRoleCredentials("ADMIN")}
                  className="rounded-md border border-border bg-bg-subtle px-2.5 py-2 text-left hover:border-brand transition-colors"
                >
                  <div className="text-xs font-semibold text-text-primary">Admin</div>
                  <div className="text-[10px] font-mono text-text-muted truncate">
                    admin@billora.io
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fillRoleCredentials("EMPLOYEE")}
                  className="rounded-md border border-border bg-bg-subtle px-2.5 py-2 text-left hover:border-brand transition-colors"
                >
                  <div className="text-xs font-semibold text-text-primary">Employee</div>
                  <div className="text-[10px] font-mono text-text-muted truncate">
                    arjun.mehta@...
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fillRoleCredentials("CUSTOMER")}
                  className="rounded-md border border-border bg-bg-subtle px-2.5 py-2 text-left hover:border-brand transition-colors"
                >
                  <div className="text-xs font-semibold text-text-primary">Customer</div>
                  <div className="text-[10px] font-mono text-text-muted truncate">
                    priya.sharma@...
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
