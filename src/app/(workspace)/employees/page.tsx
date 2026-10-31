"use client";

import {
  DataTable,
  FormField,
  ModalDialog,
  PageHeader,
  StatusBadge,
  useToast,
} from "@/components/ui/Primitives";
import { Plus, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";

interface EmployeeRow {
  id: string;
  employeeCode: string;
  department: string;
  designation: string;
  phone: string | null;
  user: {
    id: string;
    email: string;
    fullName: string;
    status: string;
    createdAt: string;
  };
  _count: {
    assignedCustomers: number;
  };
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Emp@Billora2026!");
  const [department, setDepartment] = useState("Revenue Operations");
  const [designation, setDesignation] = useState("Billing Specialist");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      const json = await res.json();
      if (json.success) {
        setEmployees(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          department,
          designation,
          phone,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Cannot Create Employee",
          description: json.error?.message,
          variant: "error",
        });
        return;
      }
      toast({
        title: "Employee Provisioned",
        description: `${json.data.employeeCode} (${json.data.user.fullName}) created and logged to Audit Trail.`,
        variant: "success",
      });
      setCreateOpen(false);
      setFullName("");
      setEmail("");
      loadEmployees();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        category="ADMINISTRATOR GOVERNANCE"
        title="Employee Directory & Operations Access"
        description="Only Administrators can provision Employee accounts. Employees manage quotations, subscriptions, invoices, and payments."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            Provision Employee
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "code",
            header: "Employee Code",
            mono: true,
            render: (r) => <span className="font-semibold text-brand">{r.employeeCode}</span>,
          },
          {
            key: "name",
            header: "Employee Name & Email",
            render: (r) => (
              <div>
                <div className="font-semibold text-text-primary">{r.user.fullName}</div>
                <div className="font-mono text-[11px] text-text-muted">{r.user.email}</div>
              </div>
            ),
          },
          {
            key: "dept",
            header: "Department",
            render: (r) => r.department,
          },
          {
            key: "title",
            header: "Designation",
            render: (r) => r.designation,
          },
          {
            key: "customers",
            header: "Assigned Customers",
            align: "right",
            mono: true,
            render: (r) => r._count.assignedCustomers,
          },
          {
            key: "status",
            header: "Account Status",
            render: (r) => <StatusBadge status={r.user.status} />,
          },
        ]}
        data={employees}
        rowKey={(r) => r.id}
        loading={loading}
      />

      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Provision Employee Account"
        description="Restricted to Administrators. Creates a verified EMPLOYEE role user."
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Full Name" required>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Siddharth Verma"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField label="Work Email" required>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siddharth@billora.io"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField label="Department" required>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField label="Designation" required>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 text-xs"
              />
            </FormField>
            <FormField
              label="Initial Password"
              required
              hint="Must exceed 8 chars with uppercase, lowercase, and special char"
            >
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
            </FormField>
            <FormField label="Phone">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98201 00000"
                className="h-9 w-full rounded-md border border-border bg-bg-base px-3 font-mono text-xs"
              />
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
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {submitting ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
