"use client";

import { FormField } from "@/components/ui/Primitives";
import Link from "next/link";
import { BilloraLogo } from "@/components/brand/Logo";
import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      setSubmitted(true);
      if (json.data?.devResetToken) {
        setDevToken(json.data.devResetToken);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-canvas p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-base p-6 sm:p-8 shadow-sm">
        <div className="mb-5 flex justify-center sm:justify-start">
          <Link href="/login" className="hover:opacity-90 transition-opacity">
            <BilloraLogo variant="auto" size="md" />
          </Link>
        </div>
        <div className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">
          Account Recovery
        </div>
        <h1 className="mt-1 text-xl font-semibold text-text-primary">Reset your password</h1>
        <p className="mt-1 text-xs text-text-muted">
          Enter your registered email address to receive a single-use password reset token (valid for 30 minutes).
        </p>

        {submitted ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-md border border-semantic-success/30 bg-semantic-success-subtle p-3.5 text-xs text-semantic-success">
              If an account exists for <strong>{email}</strong>, a password reset link has been dispatched.
            </div>
            {devToken && (
              <div className="rounded-md border border-border bg-bg-subtle p-3 text-xs">
                <div className="font-mono text-[11px] text-text-muted mb-1">
                  DEV ENVIRONMENT RESET LINK:
                </div>
                <Link
                  href={`/reset-password?token=${devToken}`}
                  className="font-mono text-brand underline break-all"
                >
                  /reset-password?token={devToken}
                </Link>
              </div>
            )}
            <Link
              href="/login"
              className="block text-center text-xs font-medium text-brand hover:underline"
            >
              ← Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <FormField label="Email Address" htmlFor="fp-email" required>
              <input
                id="fp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.in"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </FormField>
            <button
              type="submit"
              disabled={loading}
              className="h-9 w-full rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {loading ? "Sending Reset Instructions..." : "Send Reset Link"}
            </button>
            <div className="text-center text-xs">
              <Link href="/login" className="text-text-secondary hover:text-text-primary">
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
