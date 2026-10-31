"use client";

import {
  DataTable,
  FormField,
  ModalDialog,
  MoneyDisplay,
  PageHeader,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { Building2, Eye, Plus } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

interface CustomerRow {
  id: string;
  customerCode: string;
  contactName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  assignedEmployee?: { user?: { fullName: string } } | null;
  _count?: { subscriptions: number; invoices: number };
}

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [submitting, setSubmitting] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<Record<string, any> | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        search,
      });
      const res = await fetch(`/api/customers?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCustomers(json.data);
        setTotalPages(json.meta?.totalPages || 1);
        setTotalRecords(json.meta?.total || json.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName,
          companyName,
          email,
          phone,
          gstin,
          city,
          state,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Failed to create customer",
          description: json.error?.message,
          variant: "error",
        });
        return;
      }
      toast({
        title: "Customer Created",
        description: `${json.data.customerCode} (${json.data.contactName}) added.`,
        variant: "success",
      });
      setCreateOpen(false);
      setContactName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setGstin("");
      loadCustomers();
    } finally {
      setSubmitting(false);
    }
  };

  const openCustomerDetail = async (id: string) => {
    const res = await fetch(`/api/customers/${id}`);
    const json = await res.json();
    if (json.success) {
      setSelectedDetail(json.data);
    }
  };

  return (
    <div>
      <PageHeader
        category="CUSTOMER DIRECTORY"
        title="Customers & B2B Accounts"
        description="Manage enterprise subscribers, GSTIN tax profiles, and assigned account executives."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Plus className="h-3.5 w-3.5" />
            New Customer
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "code",
            header: "Customer ID",
            mono: true,
            render: (r) => (
              <span className="font-semibold text-brand">{r.customerCode}</span>
            ),
          },
          {
            key: "company",
            header: "Company / Contact",
            render: (r) => (
              <div>
                <div className="font-semibold text-text-primary">
                  {r.companyName || r.contactName}
                </div>
                <div className="text-[11px] text-text-muted">
                  {r.contactName} • {r.email}
                </div>
              </div>
            ),
          },
          {
            key: "gstin",
            header: "GSTIN",
            mono: true,
            render: (r) => (
              <span className="text-text-secondary">{r.gstin || "Unregistered"}</span>
            ),
          },
          {
            key: "location",
            header: "Location",
            render: (r) => (
              <span className="text-text-secondary">
                {r.city ? `${r.city}, ${r.state || ""}` : "India"}
              </span>
            ),
          },
          {
            key: "owner",
            header: "Account Owner",
            render: (r) => (
              <span className="text-text-secondary">
                {r.assignedEmployee?.user?.fullName || "Unassigned"}
              </span>
            ),
          },
          {
            key: "subs",
            header: "Subscriptions",
            align: "right",
            mono: true,
            render: (r) => r._count?.subscriptions ?? 0,
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (r) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openCustomerDetail(r.id);
                }}
                className="inline-flex items-center gap-1 rounded border border-border bg-bg-subtle px-2 py-1 text-xs font-medium text-text-primary hover:border-brand"
              >
                <Eye className="h-3 w-3" />
                Inspect
              </button>
            ),
          },
        ]}
        data={customers}
        rowKey={(r) => r.id}
        loading={loading}
        searchPlaceholder="Search company, name, email, or CUST code..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        onPageChange={setPage}
        onRowClick={(r) => openCustomerDetail(r.id)}
      />

      {/* Create Customer Modal */}
      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Customer Record"
        description="Add a new B2B customer account for quotations, subscriptions, and GST invoicing."
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Contact Full Name" required>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g., Vikram Singhania"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField label="Company Name">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Singhania FinTech Ltd"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField label="Email Address" required>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@company.in"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField label="Phone Number">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98200 00000"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs font-mono"
              />
            </FormField>
            <FormField label="GSTIN (Optional)">
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="29AAACB1001F1Z5"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs font-mono"
              />
            </FormField>
            <FormField label="City & State">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
                />
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="h-9 w-full rounded-md border border-border bg-bg-base px-2.5 text-xs"
                />
              </div>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-xs font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Create Customer"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Customer 360 Detail Modal */}
      <ModalDialog
        open={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        title={
          selectedDetail
            ? `${selectedDetail.companyName || selectedDetail.contactName} (${selectedDetail.customerCode})`
            : "Customer Profile"
        }
        description={selectedDetail?.email}
        maxWidth="2xl"
      >
        {selectedDetail && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-border bg-bg-subtle/50 p-3.5">
              <div>
                <div className="text-text-muted">GSTIN</div>
                <div className="font-mono font-semibold mt-0.5">
                  {selectedDetail.gstin || "Unregistered"}
                </div>
              </div>
              <div>
                <div className="text-text-muted">Phone</div>
                <div className="font-mono font-semibold mt-0.5">
                  {selectedDetail.phone || "N/A"}
                </div>
              </div>
              <div>
                <div className="text-text-muted">City / State</div>
                <div className="font-semibold mt-0.5">
                  {selectedDetail.city || "Bengaluru"}, {selectedDetail.state || "KA"}
                </div>
              </div>
              <div>
                <div className="text-text-muted">Account Manager</div>
                <div className="font-semibold mt-0.5">
                  {selectedDetail.assignedEmployee?.user?.fullName || "Unassigned"}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">
                Recent Subscriptions ({selectedDetail.subscriptions?.length || 0})
              </h3>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-bg-subtle text-[11px] uppercase text-text-muted border-b border-border">
                    <tr>
                      <th className="px-3 py-2">Number</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(selectedDetail.subscriptions || []).slice(0, 5).map((s: any) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 font-mono">
                          <Link
                            href={`/subscriptions/${s.id}`}
                            className="text-brand hover:underline"
                          >
                            {s.subscriptionNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{s.plan?.name}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <MoneyDisplay amount={s.totalAmount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
