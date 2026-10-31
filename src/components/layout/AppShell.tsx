"use client";

import { useToast } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";
import {
  BadgePercent,
  Bell,
  Bot,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  Command,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Repeat,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "EMPLOYEE" | "CUSTOMER";
  customerId: string | null;
  employeeId: string | null;
}

interface NavGroup {
  label: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: ("ADMIN" | "EMPLOYEE")[];
  }[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN", "EMPLOYEE"],
      },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      {
        name: "Customers",
        href: "/customers",
        icon: Building2,
        roles: ["ADMIN", "EMPLOYEE"],
      },
      {
        name: "Employees",
        href: "/employees",
        icon: Users,
        roles: ["ADMIN"],
      },
      {
        name: "Products & Variants",
        href: "/products",
        icon: Boxes,
        roles: ["ADMIN"],
      },
      {
        name: "Subscription Plans",
        href: "/plans",
        icon: Layers,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    label: "SALES",
    items: [
      {
        name: "Quotations",
        href: "/quotations",
        icon: FileSpreadsheet,
        roles: ["ADMIN", "EMPLOYEE"],
      },
      {
        name: "Subscriptions",
        href: "/subscriptions",
        icon: Repeat,
        roles: ["ADMIN", "EMPLOYEE"],
      },
    ],
  },
  {
    label: "FINANCE",
    items: [
      {
        name: "Invoices",
        href: "/invoices",
        icon: Receipt,
        roles: ["ADMIN", "EMPLOYEE"],
      },
      {
        name: "Payments",
        href: "/payments",
        icon: CreditCard,
        roles: ["ADMIN", "EMPLOYEE"],
      },
      {
        name: "Discounts",
        href: "/discounts",
        icon: BadgePercent,
        roles: ["ADMIN"],
      },
      {
        name: "Tax Rules",
        href: "/taxes",
        icon: Landmark,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      {
        name: "Revenue Forecasting",
        href: "/forecasting",
        icon: TrendingUp,
        roles: ["ADMIN", "EMPLOYEE"],
      },
      {
        name: "AI Assistant",
        href: "/assistant",
        icon: Bot,
        roles: ["ADMIN", "EMPLOYEE"],
      },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      {
        name: "Notifications",
        href: "/notifications",
        icon: Bell,
        roles: ["ADMIN", "EMPLOYEE"],
      },
      {
        name: "Audit Logs",
        href: "/audit-logs",
        icon: ShieldAlert,
        roles: ["ADMIN"],
      },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["ADMIN"],
      },
    ],
  },
];

function isPathAllowedForRole(pathname: string, role: "ADMIN" | "EMPLOYEE"): boolean {
  if (role === "ADMIN") return true;
  const adminOnlyPrefixes = [
    "/employees",
    "/products",
    "/plans",
    "/discounts",
    "/taxes",
    "/audit-logs",
    "/settings",
  ];
  return !adminOnlyPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const loadNotificationCount = async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setUnreadNotifs(json.data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  const loadSession = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data?.authenticated) {
        const u = json.data.user as SessionUser;
        setUser(u);
        if (u.role === "CUSTOMER") {
          router.replace("/portal");
          return;
        }
      } else {
        router.replace("/login");
        return;
      }
    } catch {
      router.replace("/login");
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    loadSession();
    loadNotificationCount();
  }, []);

  // Redirect EMPLOYEE away from ADMIN-only routes if navigated directly
  useEffect(() => {
    if (!loadingAuth && user?.role === "EMPLOYEE" && !isPathAllowedForRole(pathname, "EMPLOYEE")) {
      router.replace("/dashboard");
    }
  }, [loadingAuth, user, pathname, router]);

  // Global Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.replace("/login");
      router.refresh();
    }
  };

  if (loadingAuth || !user || user.role === "CUSTOMER") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="font-mono text-xs text-text-muted">Authenticating workspace session...</span>
        </div>
      </div>
    );
  }

  const activeRole: "ADMIN" | "EMPLOYEE" =
    user.role === "EMPLOYEE" ? "EMPLOYEE" : "ADMIN";

  const filteredGroups = NAVIGATION_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.roles.includes(activeRole)),
  })).filter((g) => g.items.length > 0);

  const allAllowedItems = filteredGroups.flatMap((g) => g.items);
  const matchingCmdItems = allAllowedItems.filter((item) =>
    item.name.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-bg-canvas text-text-primary">
      {/* Desktop Collapsible Sidebar (#0B1220) */}
      <aside
        className={cn(
          "no-print hidden lg:flex flex-col bg-bg-sidebar text-slate-200 border-r border-white/10 transition-all duration-150 shrink-0",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white font-mono font-bold text-sm shadow-sm">
              B
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-white leading-none">
                  Billora
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                  REVENUE INTELLIGENCE
                </div>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Role-Scoped Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-2.5 mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                        isActive
                          ? "bg-brand text-white shadow-xs"
                          : "text-slate-300 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer with Profile & Role Switcher */}
        <div className="border-t border-white/10 p-3 space-y-2.5">
          {!collapsed && user && (
            <div className="px-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white truncate">
                  {user.fullName}
                </span>
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-300 border border-indigo-400/30 shrink-0">
                  {user.role}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                {user.email}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-bg-base/90 backdrop-blur-md px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-md p-1.5 text-text-secondary hover:bg-bg-subtle"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Cmd+K Search Trigger */}
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 h-8 rounded-md border border-border bg-bg-subtle/60 px-2.5 sm:px-3 text-xs text-text-muted hover:border-border-strong hover:text-text-primary transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Jump to module or action...</span>
              <span className="md:hidden">Search</span>
              <kbd className="ml-1 hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-bg-base px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>
          </div>

          {/* Right Controls: Authenticated Role Indicator + Notifications + Theme */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg-subtle px-2.5 py-1 text-xs">
              <span className="text-text-muted">Role:</span>
              <span
                className={cn(
                  "font-mono font-semibold text-[11px] px-1.5 py-0.5 rounded",
                  user.role === "ADMIN"
                    ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                )}
              >
                {user.role}
              </span>
            </div>

            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative rounded-md p-2 text-text-secondary hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifs > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-semantic-danger" />
              )}
            </Link>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle color theme"
              className="rounded-md p-2 text-text-secondary hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Workspace Page Body (keyed by active user & role so switching roles immediately remounts and refreshes data) */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {loadingAuth ? (
            <div className="space-y-4">
              <div className="h-8 w-64 animate-pulse rounded bg-bg-raised/60" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-lg border border-border bg-bg-base"
                  />
                ))}
              </div>
            </div>
          ) : (
            <React.Fragment key={`${user?.id ?? "guest"}-${user?.role ?? "none"}`}>
              {children}
            </React.Fragment>
          )}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64 bg-bg-sidebar text-slate-200 flex flex-col h-full p-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <span className="text-base font-bold text-white">Billora</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {filteredGroups.map((g) => (
                <div key={g.label}>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                    {g.label}
                  </div>
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-slate-200 hover:bg-white/10"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {user && (
              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white truncate">{user.fullName}</span>
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[10px] text-indigo-300">
                    {user.role}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  {user.email}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cmd+K Global Command Palette */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs pt-20 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-bg-base shadow-xl overflow-hidden">
            <div className="flex items-center border-b border-border px-3.5">
              <Search className="h-4 w-4 text-text-muted mr-2.5" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Type a module name or command (e.g., Subscriptions, Invoices, AI Assistant)..."
                className="h-11 w-full bg-transparent text-xs text-text-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="text-xs font-mono text-text-muted hover:text-text-primary"
              >
                ESC
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {matchingCmdItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      setCmdOpen(false);
                      setCmdQuery("");
                      router.push(item.href);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs text-text-primary hover:bg-bg-subtle"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-brand" />
                      <span className="font-medium">{item.name}</span>
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">{item.href}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
