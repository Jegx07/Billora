"use client";

import { FormField, useToast } from "@/components/ui/Primitives";
import Link from "next/link";
import { BilloraLogo } from "@/components/brand/Logo";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error?.message || "Failed to reset password");
        return;
      }
      toast({
        title: "Password Updated",
        description: "Your password has been reset. Please sign in with your new credentials.",
        variant: "success",
      });
      router.push("/login");
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
          Security Token Verification
        </div>
        <h1 className="mt-1 text-xl font-semibold text-text-primary">Set New Password</h1>

        {errorMsg && (
          <div className="mt-4 rounded-md border border-semantic-danger/30 bg-semantic-danger-subtle p-3 text-xs text-semantic-danger">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <FormField label="Reset Token" htmlFor="rp-token" required>
            <input
              id="rp-token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs text-text-primary"
            />
          </FormField>

          <FormField
            label="New Password"
            htmlFor="rp-pass"
            required
            hint="9+ characters, uppercase, lowercase, and special character"
          >
            <input
              id="rp-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary"
            />
          </FormField>

          <FormField label="Confirm New Password" htmlFor="rp-confirm" required>
            <input
              id="rp-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary"
            />
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="h-9 w-full rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {loading ? "Updating Password..." : "Reset Password"}
          </button>

          <div className="text-center text-xs">
            <Link href="/login" className="text-text-secondary hover:text-text-primary">
              ← Return to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-mono">Loading reset form...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
