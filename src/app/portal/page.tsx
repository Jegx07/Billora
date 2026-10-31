'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  FileText,
  Layers,
  Bell,
  UserCheck,
  Download,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  Sparkles,
  LogOut,
  Shield,
  ArrowUpRight,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusBadge,
  Modal,
  Select,
  EmptyState,
  useToast,
} from '@/components/ui/Primitives';
import { formatINR, formatDate } from '@/lib/utils';

type TabKey =
  | 'OVERVIEW'
  | 'SUBSCRIPTIONS'
  | 'PLANS'
  | 'INVOICES'
  | 'PAYMENTS'
  | 'NOTIFICATIONS'
  | 'ACCOUNT';

export default function CustomerPortalPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('OVERVIEW');
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);

  // Checkout Modal State
  const [payModalInvoice, setPayModalInvoice] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [razorpayOrder, setRazorpayOrder] = useState<any | null>(null);

  // Subscribe New Plan Modal State
  const [subscribeModalPlan, setSubscribeModalPlan] = useState<any | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedTaxId, setSelectedTaxId] = useState('');
  const [discountCode, setDiscountCode] = useState('');

  async function loadPortal() {
    setLoading(true);
    try {
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
      const plansJson = await plansRes.json();
      const prodJson = await prodRes.json();
      const taxJson = await taxRes.json();

      if (overviewJson.success || overviewJson.ok) {
        setData(overviewJson.data);
      }
      if (plansJson.success || plansJson.ok) {
        setPlans(plansJson.data || []);
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
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortal();
  }, []);

  async function handleSubscriptionAction(subId: string, action: 'PAUSE' | 'RESUME' | 'CANCEL') {
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success || res.ok) {
        toast({
          title: `Subscription ${action.toLowerCase()}d`,
          variant: 'success',
        });
        await loadPortal();
      } else {
        toast({
          title: 'Action not allowed',
          description: json.error?.message || 'Could not update subscription',
          variant: 'error',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function initiateRazorpayPayment(invoice: any) {
    setBusy(true);
    try {
      const res = await fetch('/api/payments/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, paymentMethod }),
      });
      const json = await res.json();
      if (json.success || json.ok) {
        setRazorpayOrder(json.data);
        setPayModalInvoice(invoice);
      } else {
        toast({
          title: 'Unable to initiate payment',
          description: json.error?.message || 'Error creating Razorpay order',
          variant: 'error',
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
        });
        setPayModalInvoice(null);
        setRazorpayOrder(null);
        await loadPortal();
      } else {
        toast({
          title: 'Payment verification failed',
          description: json.error?.message || 'Signature verification error',
          variant: 'error',
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
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: data.customer.id,
          planId: subscribeModalPlan.id,
          startDate: new Date().toISOString(),
          discountCode: discountCode.trim() || undefined,
          activateImmediately: true,
          lines: [
            {
              productId: selectedProductId,
              quantity: Math.max(1, Number(subscribeModalPlan.minQuantity || 1)),
              taxRuleId: selectedTaxId || undefined,
            },
          ],
        }),
      });
      const json = await res.json();
      if (json.success || json.ok) {
        // Trigger billing run so customer immediately sees their initial invoice
        await fetch('/api/billing/run', { method: 'POST', body: JSON.stringify({}) });
        toast({
          title: 'Subscription Activated!',
          description: `Subscribed to ${subscribeModalPlan.name}.`,
          variant: 'success',
        });
        setSubscribeModalPlan(null);
        setDiscountCode('');
        await loadPortal();
        setActiveTab('SUBSCRIPTIONS');
      } else {
        toast({
          title: 'Subscription failed',
          description: json.error?.message || 'Could not create subscription',
          variant: 'error',
        });
      }
    } finally {
      setBusy(false);
    }
  }

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
    }
  }

  const customer = data?.customer;
  const subscriptions = data?.subscriptions || [];
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];
  const notifications = data?.notifications || [];

  const activeSubs = subscriptions.filter((s: any) => s.status === 'ACTIVE');
  const openInvoices = invoices.filter(
    (i: any) =>
      ['CONFIRMED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status) &&
      Number(i.outstandingAmount ?? i.amountDue ?? 0) > 0
  );
  const totalOutstanding = openInvoices.reduce(
    (acc: number, inv: any) => acc + Number(inv.outstandingAmount ?? inv.amountDue ?? 0),
    0
  );

  return (
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
                </span>
              </div>
            </Link>
          </div>

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
              >
                Admin
              </button>
              <button
                type="button"
                disabled={switchingRole !== null}
                onClick={() => switchDemoRole('EMPLOYEE')}
                className="px-2 py-1 rounded hover:bg-white/[0.08] text-[#D1D5DB] hover:text-white transition-colors disabled:opacity-60"
              >
                Employee
              </button>
              <button
                type="button"
                disabled={switchingRole !== null}
                onClick={() => switchDemoRole('CUSTOMER')}
                className="px-2 py-1 rounded bg-[#10B981] text-[#090A0F] font-semibold transition-colors disabled:opacity-60"
              >
                <span className="hidden sm:inline">Customer Portal</span>
                <span className="sm:hidden">Customer</span>
              </button>
            </div>

            {customer && (
              <div className="text-right hidden md:block">
                <div className="text-xs font-medium text-white">
                  {customer.companyName || customer.contactName || customer.user?.name}
                </div>
                <div className="text-[11px] text-[#6B7280] font-mono">
                  {customer.email || customer.user?.email}
                </div>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/login');
              }}
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

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
        {loading ? (
          <div className="p-12 text-center text-sm text-[#9CA3AF]">
            Loading customer billing ledger...
          </div>
        ) : (
          <>
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardBody>
                      <div className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                        Active Subscriptions
                      </div>
                      <div className="text-2xl font-bold font-mono mt-2 text-white">
                        {activeSubs.length}
                      </div>
                      <div className="text-xs text-[#10B981] mt-1">
                        Auto-renewing recurring contracts
                      </div>
                    </CardBody>
                  </Card>

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

                  <Card>
                    <CardBody>
                      <div className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                        Outstanding Balance
                      </div>
                      <div
                        className={`text-2xl font-bold font-mono mt-2 ${
                          totalOutstanding > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'
                        }`}
                      >
                        {formatINR(totalOutstanding)}
                      </div>
                      <div className="text-xs text-[#9CA3AF] mt-1">
                        Across {openInvoices.length} open invoice(s)
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <div className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                        Next Renewal Date
                      </div>
                      <div className="text-2xl font-bold font-mono mt-2 text-white">
                        {activeSubs[0]?.nextBillingDate
                          ? formatDate(activeSubs[0].nextBillingDate)
                          : '—'}
                      </div>
                      <div className="text-xs text-[#9CA3AF] mt-1">
                        {activeSubs[0]?.plan?.name || 'No active plan'}
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Actionable Open Invoices Banner */}
                {openInvoices.length > 0 && (
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
                )}

                {/* Active Subscriptions Preview */}
                <Card>
                  <CardHeader
                    title="Your Subscriptions"
                    subtitle="Manage plan lifecycle, pause/resume or inspect immutable price snapshots"
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveTab('PLANS')}
                      >
                        Browse Plans
                      </Button>
                    }
                  />
                  <CardBody>
                    {subscriptions.length === 0 ? (
                      <EmptyState
                        title="No subscriptions yet"
                        description="Subscribe to a plan in the Available Plans tab to get started."
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-[#9CA3AF]">
                              <th className="py-2.5 px-3">Subscription #</th>
                              <th className="py-2.5 px-3">Plan</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Next Renewal</th>
                              <th className="py-2.5 px-3 text-right">Recurring Total</th>
                              <th className="py-2.5 px-3 text-right">Self-Service Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.05] text-sm">
                            {subscriptions.map((sub: any) => (
                              <tr key={sub.id} className="hover:bg-white/[0.02]">
                                <td className="py-3 px-3 font-mono text-xs text-white">
                                  {sub.subscriptionNumber}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-medium text-white">{sub.plan?.name}</div>
                                  <div className="text-xs text-[#6B7280]">
                                    {sub.plan?.billingFrequency || sub.billingFrequency}
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <StatusBadge status={sub.status} />
                                </td>
                                <td className="py-3 px-3 font-mono text-xs text-[#9CA3AF]">
                                  {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : '—'}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                                  {formatINR(sub.totalAmount)}
                                </td>
                                <td className="py-3 px-3 text-right space-x-2">
                                  {sub.status === 'ACTIVE' && (
                                    <>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => handleSubscriptionAction(sub.id, 'PAUSE')}
                                      >
                                        <PauseCircle className="w-3.5 h-3.5 mr-1" />
                                        Pause
                                      </Button>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => handleSubscriptionAction(sub.id, 'CANCEL')}
                                      >
                                        <XCircle className="w-3.5 h-3.5 mr-1" />
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                  {sub.status === 'PAUSED' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => handleSubscriptionAction(sub.id, 'RESUME')}
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

            {activeTab === 'SUBSCRIPTIONS' && (
              <Card>
                <CardHeader
                  title="My Subscriptions & Line Snapshots"
                  subtitle="Full contract details with snapshotted unit prices, GST rates, and billing cycles"
                />
                <CardBody className="space-y-4">
                  {subscriptions.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-lg border border-white/[0.08] bg-[#161922] space-y-3"
                    >
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

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-[#9CA3AF]">Cycle Total</div>
                            <div className="text-lg font-mono font-bold text-[#10B981]">
                              {formatINR(sub.totalAmount)}
                            </div>
                          </div>
                          {sub.status === 'ACTIVE' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleSubscriptionAction(sub.id, 'PAUSE')}
                            >
                              Pause
                            </Button>
                          )}
                          {sub.status === 'PAUSED' && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleSubscriptionAction(sub.id, 'RESUME')}
                            >
                              Resume
                            </Button>
                          )}
                        </div>
                      </div>

                      {sub.lines?.length > 0 && (
                        <div className="pt-2 border-t border-white/[0.06] text-xs space-y-1">
                          {sub.lines.map((line: any) => (
                            <div
                              key={line.id}
                              className="flex items-center justify-between text-[#9CA3AF]"
                            >
                              <span>
                                {line.productNameSnapshot} × {line.quantity} (Tax:{' '}
                                {Number(line.taxRateSnapshot)}%)
                              </span>
                              <span className="font-mono text-white">
                                {formatINR(line.lineTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

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
                      >
                        Subscribe to {plan.name}
                      </Button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === 'INVOICES' && (
              <Card>
                <CardHeader
                  title="My Tax Invoices"
                  subtitle="Download compliant GST PDF invoices or settle open balances"
                />
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

            {activeTab === 'NOTIFICATIONS' && (
              <Card>
                <CardHeader
                  title="Billing & Renewal Notifications"
                  subtitle="Automated alerts for invoice generation, payment receipts, and renewals"
                />
                <CardBody className="divide-y divide-white/[0.06]">
                  {notifications.length === 0 ? (
                    <EmptyState
                      title="All caught up"
                      description="No recent notifications for your account."
                    />
                  ) : (
                    notifications.map((n: any) => (
                      <div key={n.id} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-white">{n.title}</div>
                          <div className="text-xs text-[#9CA3AF] mt-0.5">{n.message}</div>
                        </div>
                        <div className="text-[11px] font-mono text-[#6B7280]">
                          {formatDate(n.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            )}

            {activeTab === 'ACCOUNT' && customer && (
              <Card>
                <CardHeader
                  title="Organization & Tax Profile"
                  subtitle="Customer record scoped to your authenticated session"
                />
                <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3.5 rounded-lg bg-[#161922] border border-white/[0.06]">
                    <div className="text-xs text-[#9CA3AF]">Company / Legal Entity</div>
                    <div className="font-medium text-white mt-1">
                      {customer.companyName || customer.contactName || customer.user?.name}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#161922] border border-white/[0.06]">
                    <div className="text-xs text-[#9CA3AF]">Customer Code</div>
                    <div className="font-mono text-white mt-1">{customer.customerCode}</div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#161922] border border-white/[0.06]">
                    <div className="text-xs text-[#9CA3AF]">GSTIN / Tax Registration</div>
                    <div className="font-mono text-white mt-1">
                      {customer.gstin || '29AABCU9603R1ZM'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#161922] border border-white/[0.06]">
                    <div className="text-xs text-[#9CA3AF]">Billing Location</div>
                    <div className="text-white mt-1">
                      {[customer.city, customer.state, customer.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Razorpay Checkout Modal */}
      <Modal
        open={!!payModalInvoice}
        onClose={() => setPayModalInvoice(null)}
        title="Razorpay Secure Checkout"
      >
        {payModalInvoice && razorpayOrder && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-[#161922] border border-white/[0.08] space-y-1">
              <div className="flex justify-between text-xs text-[#9CA3AF]">
                <span>Invoice Number</span>
                <span className="font-mono text-white">{payModalInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-xs text-[#9CA3AF]">
                <span>Razorpay Order ID</span>
                <span className="font-mono text-[#10B981]">
                  {razorpayOrder.orderId || razorpayOrder.razorpayOrderId}
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/[0.06]">
                <span>Payable Amount</span>
                <span className="font-mono text-white">
                  {formatINR(payModalInvoice.outstandingAmount ?? payModalInvoice.amountDue)}
                </span>
              </div>
            </div>

            <Select
              label="Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="UPI">UPI (GPay / PhonePe / Corporate VPA)</option>
              <option value="CARD">Corporate Credit / Debit Card</option>
              <option value="NETBANKING">NetBanking (HDFC / ICICI / Axis)</option>
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPayModalInvoice(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy} onClick={completeRazorpayPayment}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Authorize & Verify HMAC Signature
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Subscribe to Plan Modal */}
      <Modal
        open={!!subscribeModalPlan}
        onClose={() => setSubscribeModalPlan(null)}
        title={`Subscribe to ${subscribeModalPlan?.name || ''}`}
      >
        {subscribeModalPlan && (
          <form onSubmit={handleSubscribeToPlan} className="space-y-4">
            <Select
              label="Select Product / Service Package"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatINR(p.salesPrice ?? p.basePrice)})
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
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1">
                Promo / Discount Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. ENTERPRISE20"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="w-full h-9 px-3 rounded-md bg-[#090A0F] border border-white/[0.1] text-sm text-white font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSubscribeModalPlan(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                Activate Subscription & Generate Invoice
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
