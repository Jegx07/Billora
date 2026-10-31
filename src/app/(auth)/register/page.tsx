"use client";

import { FormField, useToast } from "@/components/ui/Primitives";
import { Check, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live password complexity checks per Section 5 of SPEC.md
  const rules = [
    { label: "More than 8 characters (9+ chars)", valid: password.length >= 9 },
    { label: "At least one uppercase letter (A-Z)", valid: /[A-Z]/.test(password) },
    { label: "At least one lowercase letter (a-z)", valid: /[a-z]/.test(password) },
    { label: "At least one special character (!@#$...)", valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          companyName,
          email,
          password,
          confirmPassword,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error?.message || "Registration failed");
        return;
      }

      toast({
        title: "Customer Account Created",
        description: "Welcome to the Billora Customer Self-Service Portal.",
        variant: "success",
      });
      router.push("/portal");
    } catch {
      setErrorMsg("Network error during registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-canvas p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-base p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">
              Customer Self-Service Registration
            </span>
            <span className="rounded bg-bg-subtle px-2 py-0.5 font-mono text-[10px] text-text-secondary border border-border">
              ROLE: CUSTOMER
            </span>
          </div>
          <h1 className="mt-1.5 text-xl font-semibold text-text-primary">
            Create your Billora account
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Public registration creates a Customer Self-Service account. Employee accounts can only be provisioned by an Administrator.
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
          <FormField label="Full Name" htmlFor="reg-name" required>
            <input
              id="reg-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Priya Sharma"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          <FormField label="Company Name (Optional)" htmlFor="reg-company">
            <input
              id="reg-company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Cloud Technologies Pvt Ltd"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          <FormField label="Work Email Address" htmlFor="reg-email" required>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.in"
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          <FormField label="Password" htmlFor="reg-pass" required>
            <input
              id="reg-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          {/* Live Password Complexity Checklist */}
          <div className="rounded-md border border-border bg-bg-subtle/60 p-3 space-y-1.5">
            <div className="text-[11px] font-mono uppercase text-text-muted">
              Password Security Requirements
            </div>
            {rules.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                {r.valid ? (
                  <Check className="h-3.5 w-3.5 text-semantic-success shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 text-text-muted shrink-0" />
                )}
                <span className={r.valid ? "text-text-primary font-medium" : "text-text-muted"}>
                  {r.label}
                </span>
              </div>
            ))}
          </div>

          <FormField label="Confirm Password" htmlFor="reg-confirm" required>
            <input
              id="reg-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            {loading ? "Creating Account..." : "Register Customer Account"}
          </button>
        </form>

        <div className="mt-5 border-t border-border pt-4 text-center text-xs text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
