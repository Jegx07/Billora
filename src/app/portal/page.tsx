"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpDown,
  ArrowUpRight,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Filter,
  Layers,
  LayoutDashboard,
  LogOut,
  Moon,
  PauseCircle,
  PlayCircle,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  Shield,
<<<<<<< HEAD
  ArrowUpRight,
} from 'lucide-react';
=======
  Sparkles,
  Sun,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
<<<<<<< HEAD
  useToast,
} from '@/components/ui/Primitives';
import { formatINR, formatDate } from '@/lib/utils';
=======
  FormField,
  ModalDialog,
  MoneyDisplay,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { formatDate, formatINR } from "@/lib/utils";
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41

type TabKey =
  | "OVERVIEW"
  | "SUBSCRIPTIONS"
  | "PLANS"
  | "INVOICES"
  | "PAYMENTS"
  | "NOTIFICATIONS"
  | "ACCOUNT";

export default function CustomerPortalPage() {
  const router = useRouter();
  const { toast } = useToast();
<<<<<<< HEAD
  const [activeTab, setActiveTab] = useState<TabKey>('OVERVIEW');
=======

  const [activeTab, setActiveTab] = useState<TabKey>("OVERVIEW");
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
<<<<<<< HEAD
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
=======
  const [darkMode, setDarkMode] = useState(false);

  // Sorting & Filtering State for Subscriptions
  const [subSearch, setSubSearch] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState("ALL");
  const [subSortBy, setSubSortBy] = useState<"NEWEST" | "AMOUNT_DESC" | "RENEWAL_ASC">("NEWEST");

  // Sorting & Filtering State for Invoices
  const [invSearch, setInvSearch] = useState("");
  const [invStatusFilter, setInvStatusFilter] = useState("ALL");
  const [invSortBy, setInvSortBy] = useState<"NEWEST" | "DUE_ASC" | "AMOUNT_DESC">("NEWEST");

  // Sorting & Filtering State for Payments
  const [paySearch, setPaySearch] = useState("");
  const [payMethodFilter, setPayMethodFilter] = useState("ALL");
  const [paySortBy, setPaySortBy] = useState<"NEWEST" | "AMOUNT_DESC">("NEWEST");
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41

  // Checkout Modal State
  const [payModalInvoice, setPayModalInvoice] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [razorpayOrder, setRazorpayOrder] = useState<any | null>(null);

  // Subscribe New Plan Modal State
  const [subscribeModalPlan, setSubscribeModalPlan] = useState<any | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedTaxId, setSelectedTaxId] = useState("");
  const [discountCode, setDiscountCode] = useState("");

  // Initialize Dark Mode sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      setDarkMode(isDark);
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  async function loadPortal() {
    setLoading(true);
    try {
<<<<<<< HEAD
      let overviewRes = await fetch('/api/portal/overview', { cache: 'no-store' });
      let overviewJson = await overviewRes.json();

      // Auto-switch to CUSTOMER demo session if user navigated directly to /portal without a customer session
      if (!overviewJson.success && !overviewJson.ok) {
        const switchRes = await fetch('/api/auth/demo-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ role: 'CUSTOMER' }),
        });
        const switchJson = await switchRes.json();
        if (switchJson.success) {
          overviewRes = await fetch('/api/portal/overview', { cache: 'no-store' });
          overviewJson = await overviewRes.json();
        }
      }

      const [plansRes, prodRes, taxRes] = await Promise.all([
        fetch('/api/plans', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/taxes', { cache: 'no-store' }),
      ]);
=======
      const [overviewRes, plansRes, prodRes, taxRes] = await Promise.all([
        fetch("/api/portal/overview"),
        fetch("/api/plans"),
        fetch("/api/products"),
        fetch("/api/taxes"),
      ]);

      const overviewJson = await overviewRes.json();
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
      const plansJson = await plansRes.json();
      const prodJson = await prodRes.json();
      const taxJson = await taxRes.json();

      if (overviewJson.success || overviewJson.ok) {
        setData(overviewJson.data);
      }
      if (plansJson.success || plansJson.ok) {
        setPlans(plansJson.data || []);
<<<<<<< HEAD
      } else if (overviewJson.data?.availablePlans) {
        setPlans(overviewJson.data.availablePlans);
      }
      if (prodJson.success || prodJson.ok) {
        const prodList = prodJson.data || [];
        setProducts(prodList);
        if (prodList[0]) setSelectedProductId(prodList[0].id);
      }
      if (taxJson.success || taxJson.ok) {
        const taxList = taxJson.data || [];
        setTaxes(taxList);
        if (taxList[0]) setSelectedTaxId(taxList[0].id);
=======
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
      }
      if (prodJson.success || prodJson.ok) {
        const prodList = prodJson.data || [];
        setProducts(prodList);
        if (prodList[0]) setSelectedProductId(prodList[0].id);
      }
      if (taxJson.success || taxJson.ok) {
        const taxList = taxJson.data || [];
        setTaxes(taxList);
        if (taxList[0]) setSelectedTaxId(taxList[0].id);
      }
    } catch (err: any) {
      toast({
        title: "Network error loading portal",
        description: err.message,
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortal();
  }, []);

  async function handleSubscriptionAction(subId: string, action: "PAUSE" | "RESUME" | "CANCEL") {
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
<<<<<<< HEAD
      if (json.success || res.ok) {
        toast({
          title: `Subscription ${action.toLowerCase()}d`,
          variant: 'success',
=======
      if (res.ok && (json.success || json.ok)) {
        toast({
          title: `Subscription ${action === "CANCEL" ? "Cancelled" : action === "PAUSE" ? "Paused" : "Resumed"}`,
          description: `Action '${action}' applied successfully to contract.`,
          variant: "success",
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        });
        await loadPortal();
      } else {
        toast({
<<<<<<< HEAD
          title: 'Action not allowed',
          description: json.error?.message || 'Could not update subscription',
          variant: 'error',
=======
          title: "Action Failed",
          description: json.error?.message || "Could not transition subscription state.",
          variant: "danger",
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function initiateRazorpayPayment(invoice: any) {
    setBusy(true);
    try {
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: Number(invoice.outstandingAmount ?? invoice.amountDue ?? invoice.totalAmount),
        }),
      });
      const json = await res.json();
<<<<<<< HEAD
      if (json.success || json.ok) {
=======
      if (res.ok && (json.success || json.ok)) {
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        setRazorpayOrder(json.data);
        setPayModalInvoice(invoice);
      } else {
        toast({
<<<<<<< HEAD
          title: 'Unable to initiate payment',
          description: json.error?.message || 'Error creating Razorpay order',
          variant: 'error',
=======
          title: "Payment Order Failed",
          description: json.error?.message || "Unable to initialize Razorpay checkout order.",
          variant: "danger",
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function completeRazorpayPayment() {
    if (!razorpayOrder) return;
    setBusy(true);
    try {
<<<<<<< HEAD
      const orderId = razorpayOrder.orderId || razorpayOrder.razorpayOrderId;
      const samplePayId =
        razorpayOrder.testSignaturePreview?.sampleRazorpayPaymentId || `pay_${Date.now()}`;
      const sampleSig = razorpayOrder.testSignaturePreview?.sampleSignature || '';

      const res = await fetch('/api/payments/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: razorpayOrder.paymentId,
          razorpayOrderId: orderId,
          razorpayPaymentId: samplePayId,
          razorpaySignature: sampleSig,
        }),
      });
      const json = await res.json();
      if (json.success || res.ok) {
        toast({
          title: 'Payment Verified',
          description: `Invoice ${payModalInvoice?.invoiceNumber || ''} settled via Razorpay.`,
          variant: 'success',
=======
      const res = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: razorpayOrder.orderId,
          razorpayPaymentId:
            razorpayOrder.testSignaturePreview?.sampleRazorpayPaymentId || `pay_${Date.now()}`,
          razorpaySignature:
            razorpayOrder.testSignaturePreview?.sampleSignature || "test_signature_valid",
        }),
      });
      const json = await res.json();
      if (res.ok && (json.success || json.ok)) {
        toast({
          title: "Payment Verified",
          description: "Razorpay payment signature verified and invoice marked as PAID.",
          variant: "success",
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        });
        setPayModalInvoice(null);
        setRazorpayOrder(null);
        await loadPortal();
      } else {
        toast({
<<<<<<< HEAD
          title: 'Payment verification failed',
          description: json.error?.message || 'Signature verification error',
          variant: 'error',
=======
          title: "Verification Failed",
          description: json.error?.message || "Payment verification failed.",
          variant: "danger",
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubscribeToPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!subscribeModalPlan || !data?.customer || !selectedProductId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: data.customer.id,
          planId: subscribeModalPlan.id,
          startDate: new Date().toISOString(),
          discountCode: discountCode.trim() || undefined,
          activateImmediately: true,
          lines: [
            {
              productId: selectedProductId,
<<<<<<< HEAD
              quantity: Math.max(1, Number(subscribeModalPlan.minQuantity || 1)),
=======
              quantity: 1,
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
              taxRuleId: selectedTaxId || undefined,
            },
          ],
        }),
      });
      const json = await res.json();
<<<<<<< HEAD
      if (json.success || json.ok) {
        // Trigger billing run so customer immediately sees their initial invoice
        await fetch('/api/billing/run', { method: 'POST', body: JSON.stringify({}) });
        toast({
          title: 'Subscription Activated!',
          description: `Subscribed to ${subscribeModalPlan.name}.`,
          variant: 'success',
=======
      if (res.ok && (json.success || json.ok)) {
        // Trigger billing run so customer immediately sees their initial invoice
        await fetch("/api/billing/run", { method: "POST" });
        toast({
          title: "Subscription Activated",
          description: `Successfully enrolled in ${subscribeModalPlan.name}.`,
          variant: "success",
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        });
        setSubscribeModalPlan(null);
        setDiscountCode("");
        await loadPortal();
<<<<<<< HEAD
        setActiveTab('SUBSCRIPTIONS');
      } else {
        toast({
          title: 'Subscription failed',
          description: json.error?.message || 'Could not create subscription',
          variant: 'error',
=======
        setActiveTab("SUBSCRIPTIONS");
      } else {
        toast({
          title: "Enrollment Failed",
          description: json.error?.message || "Could not complete plan subscription.",
          variant: "danger",
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        });
      }
    } finally {
      setBusy(false);
    }
  }

<<<<<<< HEAD
  async function switchDemoRole(role: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER') {
    if (switchingRole) return;
    setSwitchingRole(role);
    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: `Switched to ${role} View`,
          description: `Signed in as ${json.data.user.fullName} (${json.data.user.email})`,
          variant: 'info',
        });
        if (role === 'CUSTOMER') {
          await loadPortal();
        } else {
          router.push('/dashboard');
          router.refresh();
        }
      } else {
        toast({
          title: 'Role switch failed',
          description: json.error?.message || 'Unable to switch role',
          variant: 'error',
        });
      }
    } catch {
      toast({
        title: 'Role switch failed',
        description: 'Network error while switching role',
        variant: 'error',
      });
    } finally {
      setSwitchingRole(null);
=======
  async function switchDemoRole(role: "ADMIN" | "EMPLOYEE" | "CUSTOMER") {
    await fetch("/api/auth/demo-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (role === "CUSTOMER") {
      await loadPortal();
    } else {
      router.push("/dashboard");
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
    }
  }

  const customer = data?.customer;
  const rawSubscriptions: any[] = data?.subscriptions || [];
  const rawInvoices: any[] = data?.invoices || [];
  const rawPayments: any[] = data?.payments || [];
  const notifications: any[] = data?.notifications || [];

<<<<<<< HEAD
  const activeSubs = subscriptions.filter((s: any) => s.status === 'ACTIVE');
  const openInvoices = invoices.filter(
    (i: any) =>
      ['CONFIRMED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status) &&
      Number(i.outstandingAmount ?? i.amountDue ?? 0) > 0
=======
  const activeSubs = rawSubscriptions.filter((s: any) => s.status === "ACTIVE");
  const openInvoices = rawInvoices.filter((i: any) =>
    ["CONFIRMED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status) &&
    Number(i.outstandingAmount ?? i.amountDue ?? 0) > 0
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
  );

  const totalOutstanding = openInvoices.reduce(
    (acc: number, inv: any) => acc + Number(inv.outstandingAmount ?? inv.amountDue ?? 0),
    0
  );

  const monthlyRunRate = activeSubs.reduce(
    (acc: number, s: any) => acc + Number(s.totalAmount ?? 0),
    0
  );

  // 1. Filtered & Sorted Subscriptions
  const filteredSubscriptions = useMemo(() => {
    let list = [...rawSubscriptions];
    if (subStatusFilter !== "ALL") {
      list = list.filter((s) => s.status === subStatusFilter);
    }
    if (subSearch.trim()) {
      const q = subSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.subscriptionNumber?.toLowerCase().includes(q) ||
          s.plan?.name?.toLowerCase().includes(q) ||
          s.plan?.billingFrequency?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (subSortBy === "AMOUNT_DESC") {
        return Number(b.totalAmount ?? 0) - Number(a.totalAmount ?? 0);
      }
      if (subSortBy === "RENEWAL_ASC") {
        const da = a.nextBillingDate ? new Date(a.nextBillingDate).getTime() : Infinity;
        const db = b.nextBillingDate ? new Date(b.nextBillingDate).getTime() : Infinity;
        return da - db;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return list;
  }, [rawSubscriptions, subSearch, subStatusFilter, subSortBy]);

  // 2. Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    let list = [...rawInvoices];
    if (invStatusFilter !== "ALL") {
      if (invStatusFilter === "OPEN") {
        list = list.filter(
          (i) =>
            ["CONFIRMED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status) &&
            Number(i.outstandingAmount ?? i.amountDue ?? 0) > 0
        );
      } else {
        list = list.filter((i) => i.status === invStatusFilter);
      }
    }
    if (invSearch.trim()) {
      const q = invSearch.toLowerCase();
      list = list.filter((i) => i.invoiceNumber?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (invSortBy === "AMOUNT_DESC") {
        const amtA = Number(a.outstandingAmount ?? a.amountDue ?? a.totalAmount ?? 0);
        const amtB = Number(b.outstandingAmount ?? b.amountDue ?? b.totalAmount ?? 0);
        return amtB - amtA;
      }
      if (invSortBy === "DUE_ASC") {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      }
      return new Date(b.invoiceDate || b.createdAt || 0).getTime() - new Date(a.invoiceDate || a.createdAt || 0).getTime();
    });
    return list;
  }, [rawInvoices, invSearch, invStatusFilter, invSortBy]);

  // 3. Filtered & Sorted Payments
  const filteredPayments = useMemo(() => {
    let list = [...rawPayments];
    if (payMethodFilter !== "ALL") {
      list = list.filter((p) => p.method === payMethodFilter || p.paymentMethod === payMethodFilter);
    }
    if (paySearch.trim()) {
      const q = paySearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.paymentNumber?.toLowerCase().includes(q) ||
          p.invoice?.invoiceNumber?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (paySortBy === "AMOUNT_DESC") {
        return Number(b.amount ?? 0) - Number(a.amount ?? 0);
      }
      return new Date(b.paymentDate || b.paidAt || b.createdAt || 0).getTime() - new Date(a.paymentDate || a.paidAt || a.createdAt || 0).getTime();
    });
    return list;
  }, [rawPayments, paySearch, payMethodFilter, paySortBy]);

  const navTabs = [
    { key: "OVERVIEW", label: "Overview", icon: LayoutDashboard },
    { key: "SUBSCRIPTIONS", label: "My Subscriptions", icon: Repeat, badge: rawSubscriptions.length },
    { key: "PLANS", label: "Available Plans", icon: Layers, badge: plans.length },
    { key: "INVOICES", label: "Invoices", icon: Receipt, badge: rawInvoices.length },
    { key: "PAYMENTS", label: "Payment History", icon: CreditCard, badge: rawPayments.length },
    { key: "NOTIFICATIONS", label: "Notifications", icon: Bell, badge: notifications.length },
    { key: "ACCOUNT", label: "Account & GST", icon: UserCheck },
  ];

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-[#090A0F] text-[#F3F4F6]">
      {/* Top Customer Portal Bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#090A0F]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] font-bold">
                B
              </div>
              <div>
                <span className="font-semibold text-sm tracking-tight text-white">Billora</span>
                <span className="hidden sm:inline-block ml-2 text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.06] text-[#9CA3AF]">
                  Self-Service Portal
=======
    <div className="min-h-screen bg-bg-canvas text-text-primary flex flex-col font-sans transition-colors duration-150">
      {/* Top Customer Portal Navigation Bar (Matching Admin & Employee Shell) */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg-base/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/portal" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-sm shadow-xs">
                B
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-text-primary">
                  Billora
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider rounded-full bg-brand-subtle text-brand border border-brand/20 px-2 py-0.5 font-semibold">
                  Customer Portal
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                </span>
              </div>
            </Link>
          </div>

<<<<<<< HEAD
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              role="group"
              aria-label="Role switcher"
              className="flex items-center gap-1 bg-[#11131A] border border-white/[0.08] rounded-md p-1 text-[11px] font-mono"
            >
              <Shield className="hidden sm:inline w-3.5 h-3.5 text-[#10B981] ml-1.5 mr-0.5" />
              <span className="hidden lg:inline text-[#9CA3AF] mr-1">Experience:</span>
              <button
                type="button"
                disabled={switchingRole !== null}
                onClick={() => switchDemoRole('ADMIN')}
                className="px-2 py-1 rounded hover:bg-white/[0.08] text-[#D1D5DB] hover:text-white transition-colors disabled:opacity-60"
=======
          {/* Right Controls: Role Switcher + Theme Toggle + User Info + Sign Out */}
          <div className="flex items-center gap-2.5">
            {/* Demo Role Switcher */}
            <div className="hidden md:flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 text-xs">
              <Shield className="w-3.5 h-3.5 text-brand ml-1 mr-0.5" />
              <button
                type="button"
                onClick={() => switchDemoRole("ADMIN")}
                className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
              >
                Admin
              </button>
              <button
                type="button"
<<<<<<< HEAD
                disabled={switchingRole !== null}
                onClick={() => switchDemoRole('EMPLOYEE')}
                className="px-2 py-1 rounded hover:bg-white/[0.08] text-[#D1D5DB] hover:text-white transition-colors disabled:opacity-60"
=======
                onClick={() => switchDemoRole("EMPLOYEE")}
                className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
              >
                Employee
              </button>
              <button
                type="button"
<<<<<<< HEAD
                disabled={switchingRole !== null}
                onClick={() => switchDemoRole('CUSTOMER')}
                className="px-2 py-1 rounded bg-[#10B981] text-[#090A0F] font-semibold transition-colors disabled:opacity-60"
              >
                <span className="hidden sm:inline">Customer Portal</span>
                <span className="sm:hidden">Customer</span>
=======
                onClick={() => switchDemoRole("CUSTOMER")}
                className="rounded px-2 py-1 text-xs font-semibold bg-bg-base text-brand shadow-xs"
              >
                Customer
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle theme"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-bg-base text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Customer User Chip */}
            {customer && (
<<<<<<< HEAD
              <div className="text-right hidden md:block">
                <div className="text-xs font-medium text-white">
                  {customer.companyName || customer.contactName || customer.user?.name}
                </div>
                <div className="text-[11px] text-[#6B7280] font-mono">
                  {customer.email || customer.user?.email}
=======
              <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand font-semibold text-xs border border-brand/20">
                  {(customer.contactName || customer.companyName || "C").slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-text-primary leading-tight truncate max-w-[140px]">
                    {customer.companyName || customer.contactName}
                  </div>
                  <div className="font-mono text-[10px] text-text-muted truncate max-w-[140px]">
                    {customer.email}
                  </div>
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                </div>
              </div>
            )}

            {/* Sign Out Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
              }}
              className="ml-1"
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

<<<<<<< HEAD
        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-white/[0.04]">
          {[
            { key: 'OVERVIEW', label: 'Overview', icon: Layers },
            { key: 'SUBSCRIPTIONS', label: `My Subscriptions (${subscriptions.length})`, icon: Sparkles },
            { key: 'PLANS', label: 'Available Plans', icon: ArrowUpRight },
            { key: 'INVOICES', label: `My Invoices (${invoices.length})`, icon: FileText },
            { key: 'PAYMENTS', label: `Payment History (${payments.length})`, icon: CreditCard },
            { key: 'NOTIFICATIONS', label: `Notifications (${notifications.length})`, icon: Bell },
            { key: 'ACCOUNT', label: 'Account Settings', icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/[0.04]'
                    : 'border-transparent text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
=======
        {/* 7 Clean Navigation Tabs */}
        <div className="border-t border-border bg-bg-base">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                    active
                      ? "border-brand text-brand bg-brand-subtle/50 font-semibold"
                      : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-subtle/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        active
                          ? "bg-brand text-white"
                          : "bg-bg-subtle text-text-muted border border-border"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------- */}
            {/* 1. OVERVIEW TAB                                               */}
            {/* ------------------------------------------------------------- */}
            {activeTab === "OVERVIEW" && (
              <div className="space-y-6">
                <PageHeader
                  category="SELF-SERVICE REVENUE PORTAL"
                  title={`Welcome back, ${customer?.companyName || customer?.contactName || "Valued Customer"}`}
                  description="Monitor recurring contracts, inspect immutable tax invoice snapshots, download GST invoices, and settle balances instantly."
                  actions={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveTab("PLANS")}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Browse New Plans
                    </Button>
                  }
                />

<<<<<<< HEAD
                  <Card>
                    <CardBody>
                      <div className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                        Monthly Recurring Spend
                      </div>
                      <div className="text-2xl font-bold font-mono mt-2 text-white">
                        {formatINR(
                          activeSubs.reduce(
                            (acc: number, s: any) =>
                              acc + Number(s.mrrEquivalent ?? s.totalAmount ?? 0),
                            0
                          )
                        )}
                      </div>
                      <div className="text-xs text-[#9CA3AF] mt-1">Normalized MRR equivalent</div>
                    </CardBody>
                  </Card>
=======
                {/* 4 StatCards Matching Admin Panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    label="Active Subscriptions"
                    formulaTag="ACTIVE"
                    value={activeSubs.length}
                    subtitle="Auto-renewing active service plans"
                    trend={{ label: `${rawSubscriptions.length} total enrolled`, tone: "positive" }}
                  />
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41

                  <StatCard
                    label="Monthly Recurring Spend"
                    formulaTag="MRR"
                    value={formatINR(monthlyRunRate)}
                    subtitle="Estimated monthly subscription run-rate"
                  />

                  <StatCard
                    label="Outstanding Balance"
                    formulaTag="DUE"
                    value={formatINR(totalOutstanding)}
                    subtitle={`Across ${openInvoices.length} open unpaid invoice(s)`}
                    trend={
                      totalOutstanding > 0
                        ? { label: "Payment required", tone: "negative" }
                        : { label: "All settled", tone: "positive" }
                    }
                  />

                  <StatCard
                    label="Next Scheduled Renewal"
                    formulaTag="CYCLE"
                    value={
                      activeSubs[0]?.nextBillingDate
                        ? formatDate(activeSubs[0].nextBillingDate)
                        : "—"
                    }
                    subtitle={activeSubs[0]?.plan?.name || "No upcoming cycle"}
                  />
                </div>

                {/* Open Invoices Alert Banner */}
                {openInvoices.length > 0 && (
<<<<<<< HEAD
                  <Card className="border-[#F59E0B]/40 bg-[#F59E0B]/[0.03]">
                    <CardHeader
                      title="Invoices Ready for Settlement"
                      subtitle="Pay online securely via Razorpay (UPI, Netbanking, Corporate Cards)"
                    />
                    <CardBody className="divide-y divide-white/[0.06]">
                      {openInvoices.map((inv: any) => {
                        const dueAmount = Number(inv.outstandingAmount ?? inv.amountDue ?? 0);
                        return (
                          <div
                            key={inv.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div>
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono font-semibold text-sm text-white">
                                  {inv.invoiceNumber}
                                </span>
                                <StatusBadge status={inv.status} />
                              </div>
                              <div className="text-xs text-[#9CA3AF] mt-1">
                                Due {formatDate(inv.dueDate)} • Amount Due:{' '}
                                <span className="font-mono text-white font-semibold">
                                  {formatINR(dueAmount)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={`/api/invoices/${inv.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08]"
                              >
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </a>
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={busy}
                                onClick={() => initiateRazorpayPayment(inv)}
                              >
                                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                                Pay {formatINR(dueAmount)}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardBody>
                  </Card>
=======
                  <div className="rounded-xl border border-semantic-warning/40 bg-semantic-warning-subtle/30 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-5 h-5 text-semantic-warning" />
                        <div>
                          <h4 className="text-sm font-semibold text-text-primary">
                            Invoices Ready for Immediate Settlement ({openInvoices.length})
                          </h4>
                          <p className="text-xs text-text-muted">
                            Pay online securely via Razorpay (UPI, Netbanking, Corporate Cards).
                          </p>
                        </div>
                      </div>
                      <div className="font-mono text-sm font-bold text-semantic-warning">
                        {formatINR(totalOutstanding)} Due
                      </div>
                    </div>

                    <div className="divide-y divide-border rounded-lg border border-border bg-bg-base overflow-hidden">
                      {openInvoices.map((inv: any) => (
                        <div
                          key={inv.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-bg-subtle/40 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono font-bold text-sm text-text-primary">
                                {inv.invoiceNumber}
                              </span>
                              <StatusBadge status={inv.status} />
                              {inv.isOverdue && (
                                <span className="font-mono text-[10px] rounded bg-semantic-danger-subtle text-semantic-danger px-2 py-0.5 font-bold">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-text-muted mt-1 flex items-center gap-3">
                              <span>Due: {formatDate(inv.dueDate)}</span>
                              <span>•</span>
                              <span>
                                Amount Due:{" "}
                                <strong className="font-mono text-text-primary">
                                  {formatINR(inv.outstandingAmount ?? inv.amountDue ?? inv.totalAmount)}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/invoices/${inv.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-border bg-bg-subtle text-text-secondary hover:text-text-primary hover:bg-bg-raised transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </a>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy}
                              onClick={() => initiateRazorpayPayment(inv)}
                            >
                              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                              Pay {formatINR(inv.outstandingAmount ?? inv.amountDue ?? inv.totalAmount)}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                )}

                {/* Subscriptions Overview Card */}
                <Card>
                  <CardHeader
                    title="Active Recurring Subscriptions"
                    subtitle="Current subscriptions and their billing cycles"
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveTab("SUBSCRIPTIONS")}
                      >
                        View All ({rawSubscriptions.length})
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    }
                  />
                  <CardBody className="p-0">
                    {rawSubscriptions.length === 0 ? (
                      <div className="p-8">
                        <EmptyState
                          title="No Active Subscriptions"
                          description="Subscribe to one of our available plans to start your subscription."
                          actionLabel="Browse Available Plans"
                          onAction={() => setActiveTab("PLANS")}
                        />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-bg-subtle/60 text-[10px] font-mono uppercase text-text-muted border-b border-border">
                            <tr>
                              <th className="py-3 px-4 font-medium">Subscription #</th>
                              <th className="py-3 px-4 font-medium">Plan Name</th>
                              <th className="py-3 px-4 font-medium">Status</th>
                              <th className="py-3 px-4 font-medium">Next Renewal</th>
                              <th className="py-3 px-4 font-medium text-right">Recurring Total</th>
                              <th className="py-3 px-4 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-xs">
                            {rawSubscriptions.slice(0, 5).map((sub: any) => (
                              <tr key={sub.id} className="hover:bg-bg-subtle/40 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-medium text-text-primary">
                                  {sub.subscriptionNumber}
                                </td>
<<<<<<< HEAD
                                <td className="py-3 px-3">
                                  <div className="font-medium text-white">{sub.plan?.name}</div>
                                  <div className="text-xs text-[#6B7280]">
                                    {sub.plan?.billingFrequency || sub.billingFrequency}
=======
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-text-primary">
                                    {sub.plan?.name}
                                  </div>
                                  <div className="font-mono text-[10px] text-text-muted">
                                    {sub.plan?.billingFrequency}
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <StatusBadge status={sub.status} />
                                </td>
                                <td className="py-3.5 px-4 font-mono text-text-secondary">
                                  {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : "—"}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-semibold text-text-primary">
                                  <MoneyDisplay amount={sub.totalAmount} />
                                </td>
                                <td className="py-3.5 px-4 text-right space-x-1.5">
                                  {sub.status === "ACTIVE" && (
                                    <>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => handleSubscriptionAction(sub.id, "PAUSE")}
                                      >
                                        <PauseCircle className="w-3.5 h-3.5 mr-1" />
                                        Pause
                                      </Button>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => handleSubscriptionAction(sub.id, "CANCEL")}
                                      >
                                        <XCircle className="w-3.5 h-3.5 mr-1" />
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                  {sub.status === "PAUSED" && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => handleSubscriptionAction(sub.id, "RESUME")}
                                    >
                                      <PlayCircle className="w-3.5 h-3.5 mr-1" />
                                      Resume
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 2. MY SUBSCRIPTIONS TAB (With Search & Sorting)              */}
            {/* ------------------------------------------------------------- */}
            {activeTab === "SUBSCRIPTIONS" && (
              <div className="space-y-6">
                <PageHeader
                  category="CONTRACT LIFECYCLE"
                  title="My Subscriptions"
                  description="Review all past and active subscriptions with price snapshots and self-service lifecycle controls."
                  actions={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveTab("PLANS")}
                    >
<<<<<<< HEAD
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold text-white">
                              {sub.subscriptionNumber}
                            </span>
                            <StatusBadge status={sub.status} />
                            <span className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-[#9CA3AF] font-mono">
                              {sub.plan?.name} ({sub.plan?.billingFrequency || sub.billingFrequency})
                            </span>
                          </div>
                          <div className="text-xs text-[#9CA3AF] mt-1 flex items-center gap-4">
                            <span>Started: {formatDate(sub.startDate)}</span>
                            <span>
                              Next Billing:{' '}
                              {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : 'Stopped'}
                            </span>
                          </div>
                        </div>
=======
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Add Subscription
                    </Button>
                  }
                />
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-bg-base p-4 shadow-xs">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      value={subSearch}
                      onChange={(e) => setSubSearch(e.target.value)}
                      placeholder="Search subscriptions by number or plan name..."
                      className="h-10 w-full pl-9 pr-4 rounded-lg border border-border bg-bg-canvas text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 text-xs">
                      {["ALL", "ACTIVE", "PAUSED", "CANCELLED"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setSubStatusFilter(st)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            subStatusFilter === st
                              ? "bg-bg-base text-brand font-semibold shadow-xs"
                              : "text-text-muted hover:text-text-primary"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

<<<<<<< HEAD
            {activeTab === 'PLANS' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((plan: any) => (
                  <Card key={plan.id} className="flex flex-col justify-between">
                    <CardBody className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">
                          {plan.billingFrequency}
                        </span>
                        <span className="text-xs font-mono text-[#6B7280]">
                          {plan.planCode || plan.code}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                        <p className="text-xs text-[#9CA3AF] mt-1">
                          {plan.description || 'Enterprise recurring subscription plan'}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/[0.06]">
                        <div className="text-2xl font-bold font-mono text-white">
                          {formatINR(plan.basePrice)}
                          <span className="text-xs font-normal text-[#9CA3AF]">
                            {' '}
                            / {(plan.billingFrequency || 'MONTHLY').toLowerCase()}
                          </span>
                        </div>
                        <div className="text-xs text-[#9CA3AF] mt-1">
                          Min Qty: {plan.minQuantity || 1} • Auto-renewable
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => setSubscribeModalPlan(plan)}
=======
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
                      <select
                        value={subSortBy}
                        onChange={(e: any) => setSubSortBy(e.target.value)}
                        className="h-9 rounded-lg border border-border bg-bg-base px-2.5 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                      >
                        <option value="NEWEST">Sort: Newest First</option>
                        <option value="AMOUNT_DESC">Sort: Highest Total</option>
                        <option value="RENEWAL_ASC">Sort: Next Renewal</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subscription Cards Feed */}
                {filteredSubscriptions.length === 0 ? (
                  <Card>
                    <CardBody className="p-12">
                      <EmptyState
                        title="No Subscriptions Found"
                        description="Try adjusting your filter or search query to locate matching subscriptions."
                      />
                    </CardBody>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredSubscriptions.map((sub: any) => (
                      <Card key={sub.id} className="hover:border-border-strong transition-all">
                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border bg-bg-subtle/30">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono font-bold text-sm text-text-primary">
                                {sub.subscriptionNumber}
                              </span>
                              <StatusBadge status={sub.status} />
                              <span className="font-mono text-[11px] rounded bg-brand-subtle text-brand border border-brand/20 px-2 py-0.5 font-semibold">
                                {sub.plan?.name} • {sub.plan?.billingFrequency}
                              </span>
                            </div>
                            <div className="text-xs text-text-muted mt-1.5 flex flex-wrap items-center gap-3">
                              <span>Started: {formatDate(sub.startDate)}</span>
                              <span>•</span>
                              <span>
                                Next Renewal:{" "}
                                <strong className="text-text-primary font-mono">
                                  {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : "Stopped"}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-[10px] font-mono uppercase text-text-muted">
                                Billing Total
                              </div>
                              <div className="text-base font-bold font-mono text-text-primary">
                                <MoneyDisplay amount={sub.totalAmount} />
                              </div>
                            </div>

                            {/* State Controls */}
                            {sub.status === "ACTIVE" && (
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => handleSubscriptionAction(sub.id, "PAUSE")}
                                >
                                  <PauseCircle className="w-3.5 h-3.5 mr-1" />
                                  Pause
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => handleSubscriptionAction(sub.id, "CANCEL")}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            )}

                            {sub.status === "PAUSED" && (
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleSubscriptionAction(sub.id, "RESUME")}
                              >
                                <PlayCircle className="w-3.5 h-3.5 mr-1" />
                                Resume
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Line Items Snapshot */}
                        {sub.lines && sub.lines.length > 0 && (
                          <div className="p-4 bg-bg-base space-y-2">
                            <div className="text-[11px] font-mono uppercase text-text-muted tracking-wider">
                              Product Variant Snapshot
                            </div>
                            <div className="divide-y divide-border/60">
                              {sub.lines.map((line: any) => (
                                <div
                                  key={line.id}
                                  className="py-2 flex items-center justify-between text-xs text-text-secondary"
                                >
                                  <div>
                                    <span className="font-medium text-text-primary">
                                      {line.productNameSnapshot || "Product Subscription Package"}
                                    </span>
                                    <span className="text-text-muted ml-2">
                                      × {line.quantity} (GST: {Number(line.taxRateSnapshot ?? 18)}%)
                                    </span>
                                  </div>
                                  <span className="font-mono font-semibold text-text-primary">
                                    <MoneyDisplay amount={line.lineTotal} />
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 3. AVAILABLE PLANS TAB                                        */}
            {/* ------------------------------------------------------------- */}
            {activeTab === "PLANS" && (
              <div className="space-y-6">
                <PageHeader
                  category="PRODUCT CATALOG"
                  title="Available Subscription Plans"
                  description="Choose from our standard recurring plans. All subscriptions feature calendar-accurate renewal date clamping and automatic GST compliance."
                />
<<<<<<< HEAD
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-[#9CA3AF]">
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-3">Issue Date</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                          <th className="py-2.5 px-3 text-right">Amount Due</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-sm">
                        {invoices.map((inv: any) => {
                          const dueAmt = Number(inv.outstandingAmount ?? inv.amountDue ?? 0);
                          return (
                            <tr key={inv.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-3 font-mono text-xs text-white">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-3 px-3 text-xs text-[#9CA3AF]">
                                {formatDate(inv.invoiceDate || inv.issueDate)}
                              </td>
                              <td className="py-3 px-3 text-xs text-[#9CA3AF]">
                                {formatDate(inv.dueDate)}
                              </td>
                              <td className="py-3 px-3">
                                <StatusBadge status={inv.status} />
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-white">
                                {formatINR(inv.totalAmount)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                                {formatINR(dueAmt)}
                              </td>
                              <td className="py-3 px-3 text-right space-x-2">
                                <a
                                  href={`/api/invoices/${inv.id}/pdf`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-white/[0.06] hover:bg-white/[0.12] text-white"
                                >
                                  <Download className="w-3 h-3" />
                                  PDF
                                </a>
                                {dueAmt > 0 && inv.status !== 'CANCELLED' && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => initiateRazorpayPayment(inv)}
                                  >
                                    Pay Now
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            )}

            {activeTab === 'PAYMENTS' && (
              <Card>
                <CardHeader
                  title="Payment History"
                  subtitle="Verified Razorpay and offline settlement ledger"
                />
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-[#9CA3AF]">
                          <th className="py-2.5 px-3">Payment #</th>
                          <th className="py-2.5 px-3">Invoice</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Paid At</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-sm">
                        {payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-3 font-mono text-xs text-white">
                              {p.paymentNumber}
                            </td>
                            <td className="py-3 px-3 font-mono text-xs text-[#9CA3AF]">
                              {p.invoice?.invoiceNumber}
                            </td>
                            <td className="py-3 px-3 text-xs text-[#9CA3AF]">
                              {p.method || p.paymentMethod}
                            </td>
                            <td className="py-3 px-3">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="py-3 px-3 text-xs text-[#9CA3AF]">
                              {formatDate(p.paymentDate || p.paidAt || p.createdAt)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-[#10B981]">
                              {formatINR(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            )}
=======

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans.map((plan: any) => (
                    <Card
                      key={plan.id}
                      className="hover:border-brand/60 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <CardBody className="p-6 space-y-5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-brand-subtle text-brand border border-brand/20">
                            {plan.billingFrequency}
                          </span>
                          <span className="font-mono text-xs text-text-muted">{plan.code}</span>
                        </div>
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41

                        <div>
                          <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
                          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                            {plan.description || "Enterprise recurring subscription with automatic invoice generation."}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-border">
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono text-3xl font-bold text-text-primary">
                              <MoneyDisplay amount={plan.basePrice} />
                            </span>
                            <span className="text-xs text-text-muted">
                              / {plan.billingFrequency.toLowerCase()}
                            </span>
                          </div>
                          <div className="text-xs text-text-muted mt-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-semantic-success" />
                            <span>Trial period: {plan.trialDays || 0} days included</span>
                          </div>
                        </div>

                        <Button
                          variant="primary"
                          className="w-full h-10 mt-2"
                          onClick={() => setSubscribeModalPlan(plan)}
                        >
                          <Sparkles className="w-4 h-4 mr-1.5" />
                          Subscribe to {plan.name}
                        </Button>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 4. INVOICES TAB (With Search & Sorting)                       */}
            {/* ------------------------------------------------------------- */}
            {activeTab === "INVOICES" && (
              <div className="space-y-6">
                <PageHeader
                  category="BILLING ARCHIVE"
                  title="Tax Invoices"
                  description="Download official, GST-compliant PDF invoices for accounting and pay outstanding balances securely."
                />
<<<<<<< HEAD
                <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3.5 rounded-lg bg-[#161922] border border-white/[0.06]">
                    <div className="text-xs text-[#9CA3AF]">Company / Legal Entity</div>
                    <div className="font-medium text-white mt-1">
                      {customer.companyName || customer.contactName || customer.user?.name}
=======

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-bg-base p-4 shadow-xs">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                      placeholder="Search invoices by invoice number..."
                      className="h-10 w-full pl-9 pr-4 rounded-lg border border-border bg-bg-canvas text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 text-xs">
                      {["ALL", "OPEN", "PAID", "CANCELLED"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setInvStatusFilter(st)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            invStatusFilter === st
                              ? "bg-bg-base text-brand font-semibold shadow-xs"
                              : "text-text-muted hover:text-text-primary"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
                      <select
                        value={invSortBy}
                        onChange={(e: any) => setInvSortBy(e.target.value)}
                        className="h-9 rounded-lg border border-border bg-bg-base px-2.5 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <option value="NEWEST">Sort: Newest Date</option>
                        <option value="DUE_ASC">Sort: Due Date (Earliest)</option>
                        <option value="AMOUNT_DESC">Sort: Highest Amount</option>
                      </select>
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                    </div>
                  </div>
                </div>

                {/* Invoices Table */}
                <Card>
                  <CardBody className="p-0">
                    {filteredInvoices.length === 0 ? (
                      <div className="p-12">
                        <EmptyState
                          title="No Invoices Found"
                          description="No invoice records matched your current search filters."
                        />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-bg-subtle/60 text-[10px] font-mono uppercase text-text-muted border-b border-border">
                            <tr>
                              <th className="py-3 px-4 font-medium">Invoice #</th>
                              <th className="py-3 px-4 font-medium">Issue Date</th>
                              <th className="py-3 px-4 font-medium">Due Date</th>
                              <th className="py-3 px-4 font-medium">Status</th>
                              <th className="py-3 px-4 font-medium text-right">Total Amount</th>
                              <th className="py-3 px-4 font-medium text-right">Outstanding</th>
                              <th className="py-3 px-4 font-medium text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-xs">
                            {filteredInvoices.map((inv: any) => {
                              const amountDue = Number(
                                inv.outstandingAmount ?? inv.amountDue ?? inv.totalAmount
                              );
                              return (
                                <tr key={inv.id} className="hover:bg-bg-subtle/40 transition-colors">
                                  <td className="py-3.5 px-4 font-mono font-medium text-text-primary">
                                    {inv.invoiceNumber}
                                  </td>
                                  <td className="py-3.5 px-4 text-text-secondary">
                                    {formatDate(inv.invoiceDate || inv.issueDate)}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-text-secondary">
                                    {formatDate(inv.dueDate)}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <StatusBadge status={inv.status} />
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-mono font-medium text-text-primary">
                                    <MoneyDisplay amount={inv.totalAmount} />
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-mono font-bold">
                                    <span
                                      className={
                                        amountDue > 0
                                          ? "text-semantic-warning"
                                          : "text-semantic-success"
                                      }
                                    >
                                      {formatINR(amountDue)}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right space-x-2">
                                    <a
                                      href={`/api/invoices/${inv.id}/pdf`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium border border-border bg-bg-base text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      PDF
                                    </a>
                                    {amountDue > 0 && inv.status !== "CANCELLED" && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => initiateRazorpayPayment(inv)}
                                      >
                                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                                        Pay Now
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 5. PAYMENT HISTORY TAB (With Search & Sorting)                */}
            {/* ------------------------------------------------------------- */}
            {activeTab === "PAYMENTS" && (
              <div className="space-y-6">
                <PageHeader
                  category="FINANCIAL AUDIT TRAIL"
                  title="Payment History"
                  description="Verified settlement records for Razorpay gateway and offline payments."
                />

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-bg-base p-4 shadow-xs">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      value={paySearch}
                      onChange={(e) => setPaySearch(e.target.value)}
                      placeholder="Search payments by payment or invoice number..."
                      className="h-10 w-full pl-9 pr-4 rounded-lg border border-border bg-bg-canvas text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Method Filter */}
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-1 text-xs">
                      {["ALL", "UPI", "RAZORPAY", "CREDIT_CARD", "BANK_TRANSFER"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayMethodFilter(m)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            payMethodFilter === m
                              ? "bg-bg-base text-brand font-semibold shadow-xs"
                              : "text-text-muted hover:text-text-primary"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
                      <select
                        value={paySortBy}
                        onChange={(e: any) => setPaySortBy(e.target.value)}
                        className="h-9 rounded-lg border border-border bg-bg-base px-2.5 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <option value="NEWEST">Sort: Newest Date</option>
                        <option value="AMOUNT_DESC">Sort: Highest Amount</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Payments Table */}
                <Card>
                  <CardBody className="p-0">
                    {filteredPayments.length === 0 ? (
                      <div className="p-12">
                        <EmptyState
                          title="No Payments Found"
                          description="No settled payment transactions found matching your filter criteria."
                        />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-bg-subtle/60 text-[10px] font-mono uppercase text-text-muted border-b border-border">
                            <tr>
                              <th className="py-3 px-4 font-medium">Payment #</th>
                              <th className="py-3 px-4 font-medium">Invoice #</th>
                              <th className="py-3 px-4 font-medium">Method</th>
                              <th className="py-3 px-4 font-medium">Status</th>
                              <th className="py-3 px-4 font-medium">Paid Date</th>
                              <th className="py-3 px-4 font-medium text-right">Settled Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-xs">
                            {filteredPayments.map((p: any) => (
                              <tr key={p.id} className="hover:bg-bg-subtle/40 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-medium text-text-primary">
                                  {p.paymentNumber}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-text-muted">
                                  {p.invoice?.invoiceNumber || "—"}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-mono text-[11px] rounded bg-bg-subtle border border-border px-2 py-0.5 text-text-secondary">
                                    {p.method || p.paymentMethod || "RAZORPAY"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <StatusBadge status={p.status} />
                                </td>
                                <td className="py-3.5 px-4 text-text-secondary">
                                  {formatDate(p.paymentDate || p.paidAt || p.createdAt)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-semantic-success">
                                  <MoneyDisplay amount={p.amount} colored />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 6. NOTIFICATIONS TAB                                          */}
            {/* ------------------------------------------------------------- */}
            {activeTab === "NOTIFICATIONS" && (
              <div className="space-y-6">
                <PageHeader
                  category="ACCOUNT ALERTS"
                  title="Notifications & Activity"
                  description="Automated alerts for invoice generation, payment receipts, and contract renewals."
                />

                <Card>
                  <CardBody className="divide-y divide-border p-0">
                    {notifications.length === 0 ? (
                      <div className="p-12">
                        <EmptyState
                          title="All Caught Up"
                          description="You have no unread notifications for your account."
                        />
                      </div>
                    ) : (
                      notifications.map((n: any) => (
                        <div
                          key={n.id}
                          className="p-5 flex items-start justify-between gap-4 hover:bg-bg-subtle/40 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-brand-subtle text-brand mt-0.5">
                              <Bell className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-text-primary">
                                {n.title}
                              </div>
                              <div className="text-xs text-text-muted mt-1 leading-relaxed">
                                {n.message}
                              </div>
                            </div>
                          </div>
                          <div className="font-mono text-[11px] text-text-muted whitespace-nowrap">
                            {formatDate(n.createdAt)}
                          </div>
                        </div>
                      ))
                    )}
                  </CardBody>
                </Card>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 7. ACCOUNT & GST TAB                                          */}
            {/* ------------------------------------------------------------- */}
            {activeTab === "ACCOUNT" && customer && (
              <div className="space-y-6">
                <PageHeader
                  category="CUSTOMER PROFILE"
                  title="Organization & GST Profile"
                  description="Legal entity details, GSTIN registration number, and default billing address."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-bg-base p-5 shadow-xs space-y-1">
                    <div className="text-[11px] font-mono uppercase text-text-muted">
                      Legal Company Name
                    </div>
                    <div className="text-base font-semibold text-text-primary">
                      {customer.companyName || customer.contactName}
                    </div>
                    <div className="text-xs text-text-muted">
                      Primary Contact: {customer.contactName}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-bg-base p-5 shadow-xs space-y-1">
                    <div className="text-[11px] font-mono uppercase text-text-muted">
                      Customer Reference Code
                    </div>
                    <div className="font-mono text-base font-bold text-brand">
                      {customer.customerCode}
                    </div>
                    <div className="text-xs text-text-muted">
                      Unique immutable ledger customer ID
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-bg-base p-5 shadow-xs space-y-1">
                    <div className="text-[11px] font-mono uppercase text-text-muted">
                      GSTIN / Tax ID
                    </div>
                    <div className="font-mono text-base font-bold text-text-primary">
                      {customer.gstin || "29AABCU9603R1ZM"}
                    </div>
                    <div className="text-xs text-text-muted">
                      Used on all auto-generated GST tax invoices
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-bg-base p-5 shadow-xs space-y-1">
                    <div className="text-[11px] font-mono uppercase text-text-muted">
                      Billing Address & Contact
                    </div>
                    <div className="text-sm font-medium text-text-primary">
                      {[customer.city, customer.state, customer.country || "India"]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                    <div className="font-mono text-xs text-text-muted">
                      {customer.email} {customer.phone ? `• ${customer.phone}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Razorpay Checkout Modal (Styled to Match Workspace Dialogs) */}
      <ModalDialog
        open={!!payModalInvoice}
        onClose={() => setPayModalInvoice(null)}
        title="Razorpay Secure Checkout"
      >
        {payModalInvoice && razorpayOrder && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-bg-subtle p-4 space-y-2">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Invoice Number</span>
                <span className="font-mono font-semibold text-text-primary">
                  {payModalInvoice.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between text-xs text-text-muted">
                <span>Razorpay Order ID</span>
<<<<<<< HEAD
                <span className="font-mono text-[#10B981]">
                  {razorpayOrder.orderId || razorpayOrder.razorpayOrderId}
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/[0.06]">
                <span>Payable Amount</span>
                <span className="font-mono text-white">
                  {formatINR(payModalInvoice.outstandingAmount ?? payModalInvoice.amountDue)}
=======
                <span className="font-mono text-brand font-semibold">
                  {razorpayOrder.orderId}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                <span className="text-text-primary">Total Payable Amount</span>
                <span className="font-mono text-text-primary">
                  {formatINR(
                    payModalInvoice.outstandingAmount ??
                    payModalInvoice.amountDue ??
                    payModalInvoice.totalAmount
                  )}
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                </span>
              </div>
            </div>

            <Select
              label="Select Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="UPI">UPI (Google Pay, PhonePe, BHIM, Corporate VPA)</option>
              <option value="CREDIT_CARD">Corporate Credit / Debit Card</option>
              <option value="BANK_TRANSFER">NetBanking (HDFC, ICICI, State Bank)</option>
            </Select>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPayModalInvoice(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={completeRazorpayPayment}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {busy ? "Verifying..." : "Authorize & Settle Payment"}
              </Button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Subscribe to Plan Modal */}
      <ModalDialog
        open={!!subscribeModalPlan}
        onClose={() => setSubscribeModalPlan(null)}
        title={`Subscribe to ${subscribeModalPlan?.name || "Plan"}`}
      >
        {subscribeModalPlan && (
          <form onSubmit={handleSubscribeToPlan} className="space-y-4">
            <div className="rounded-lg border border-border bg-bg-subtle p-3.5 space-y-1">
              <div className="text-xs text-text-muted">Selected Plan</div>
              <div className="text-sm font-bold text-text-primary">
                {subscribeModalPlan.name} ({subscribeModalPlan.billingFrequency})
              </div>
              <div className="font-mono text-xs font-semibold text-brand">
                {formatINR(subscribeModalPlan.basePrice)} / {subscribeModalPlan.billingFrequency.toLowerCase()}
              </div>
            </div>

            <Select
              label="Select Product / Service Package"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
<<<<<<< HEAD
                  {p.name} ({formatINR(p.salesPrice ?? p.basePrice)})
=======
                  {p.name} ({formatINR(p.salesPrice || p.basePrice || 1000)})
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                </option>
              ))}
            </Select>

            <Select
              label="Applicable GST / Tax Rule"
              value={selectedTaxId}
              onChange={(e) => setSelectedTaxId(e.target.value)}
            >
              {taxes.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({Number(t.percentage ?? t.rate ?? 0)}%)
                </option>
              ))}
            </Select>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Promo / Discount Code (Optional)
              </label>
              <input
                type="text"
<<<<<<< HEAD
                placeholder="e.g. ENTERPRISE20"
=======
                placeholder="e.g. SAVE20"
>>>>>>> fef57322168804fa18e83ff7e40bec04e453ed41
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="w-full h-9 px-3 rounded-md border border-border bg-bg-base text-xs text-text-primary font-mono uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSubscribeModalPlan(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {busy ? "Activating..." : "Activate Subscription & Generate Invoice"}
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}
