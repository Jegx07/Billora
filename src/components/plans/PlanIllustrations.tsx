"use client";

import { cn } from "@/lib/utils";
import React, { useState } from "react";

export interface PlanIllustrationProps {
  frequency: string;
  className?: string;
}

/**
 * 1. Daily Billing Cadence Illustration
 * Visualizes 24-hour day-cycle, sun horizon, clock dial, and daily recurring clamp.
 */
export function DailyBillingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full select-none", className)}
      aria-label="Daily Billing Illustration"
    >
      <defs>
        <linearGradient id="daily-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.14" />
          <stop offset="50%" stopColor="#4F46E5" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#0B1220" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="daily-sun" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="daily-card" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3730A3" stopOpacity="0.95" />
        </linearGradient>
        <pattern id="daily-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#4F46E5" fillOpacity="0.1" />
        </pattern>
      </defs>

      {/* Background with pattern */}
      <rect width="360" height="160" fill="url(#daily-bg)" />
      <rect width="360" height="160" fill="url(#daily-grid)" />

      {/* Orbit track for 24h cycle */}
      <circle
        cx="180"
        cy="92"
        r="68"
        stroke="#4F46E5"
        strokeOpacity="0.18"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <circle
        cx="180"
        cy="92"
        r="54"
        stroke="#F59E0B"
        strokeOpacity="0.22"
        strokeWidth="1"
      />

      {/* Sun / Day Horizon Element */}
      <g transform="translate(180, 52)">
        <circle cx="0" cy="0" r="22" fill="url(#daily-sun)" filter="drop-shadow(0 4px 12px rgba(245, 158, 11, 0.35))" />
        <circle cx="0" cy="0" r="16" fill="#FDE68A" fillOpacity="0.4" />
        {/* Sun rays */}
        <line x1="0" y1="-28" x2="0" y2="-34" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="20" y1="-20" x2="25" y2="-25" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="28" y1="0" x2="34" y2="0" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="-20" y1="-20" x2="-25" y2="-25" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="-28" y1="0" x2="-34" y2="0" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Modern 24h Calendar Card */}
      <g transform="translate(130, 78)">
        <rect
          x="0"
          y="0"
          width="100"
          height="66"
          rx="8"
          fill="url(#daily-card)"
          stroke="#818CF8"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          filter="drop-shadow(0 8px 16px rgba(15, 23, 42, 0.16))"
        />
        {/* Calendar top header */}
        <rect x="0" y="0" width="100" height="20" rx="8" fill="#312E81" />
        <rect x="0" y="14" width="100" height="6" fill="#312E81" />
        <circle cx="14" cy="10" r="2.5" fill="#EF4444" />
        <circle cx="24" cy="10" r="2.5" fill="#F59E0B" />
        <circle cx="34" cy="10" r="2.5" fill="#10B981" />
        <text
          x="72"
          y="13"
          fill="#E0E7FF"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="600"
          textAnchor="middle"
        >
          24H CADENCE
        </text>

        {/* Calendar body */}
        <text
          x="50"
          y="42"
          fill="#FFFFFF"
          fontSize="18"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="700"
          textAnchor="middle"
        >
          DAILY
        </text>
        <text
          x="50"
          y="56"
          fill="#C7D2FE"
          fontSize="8"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
          letterSpacing="0.05em"
          textAnchor="middle"
        >
          MIDNIGHT CLAMP
        </text>
      </g>

      {/* Floating 24H recurrence badge left */}
      <g transform="translate(36, 68)">
        <rect x="0" y="0" width="76" height="34" rx="6" fill="#FFFFFF" fillOpacity="0.85" stroke="#E2E8F0" strokeWidth="1" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.06))" />
        <text x="38" y="16" fill="#64748B" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600" textAnchor="middle">
          CYCLE
        </text>
        <text x="38" y="28" fill="#4F46E5" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          1 DAY / 24H
        </text>
      </g>

      {/* Floating status tag right */}
      <g transform="translate(254, 72)">
        <rect x="0" y="0" width="72" height="32" rx="6" fill="#FFFFFF" fillOpacity="0.85" stroke="#E2E8F0" strokeWidth="1" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.06))" />
        <circle cx="16" cy="16" r="3.5" fill="#10B981" />
        <text x="42" y="19" fill="#0F172A" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">
          ACTIVE
        </text>
      </g>
    </svg>
  );
}

/**
 * 2. Weekly Billing Cadence Illustration
 * Visualizes 7-day sprint calendar, day blocks (Mon-Sun), sprint milestones, and weekly loops.
 */
export function WeeklyBillingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full select-none", className)}
      aria-label="Weekly Billing Illustration"
    >
      <defs>
        <linearGradient id="weekly-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.14" />
          <stop offset="50%" stopColor="#4F46E5" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="weekly-card" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>

      <rect width="360" height="160" fill="url(#weekly-bg)" />

      {/* Curved Sprint Arrow Loop */}
      <path
        d="M 50 120 C 50 40, 310 40, 310 120"
        stroke="#0EA5E9"
        strokeWidth="2"
        strokeDasharray="6 4"
        strokeOpacity="0.35"
        fill="none"
      />

      {/* Main 7-day Sprint Sheet */}
      <g transform="translate(60, 32)">
        <rect
          x="0"
          y="0"
          width="240"
          height="102"
          rx="10"
          fill="#FFFFFF"
          fillOpacity="0.9"
          stroke="#BAE6FD"
          strokeWidth="1.5"
          filter="drop-shadow(0 10px 20px rgba(14, 165, 233, 0.12))"
        />

        {/* Sprint Header */}
        <rect x="0" y="0" width="240" height="30" rx="10" fill="url(#weekly-card)" />
        <rect x="0" y="20" width="240" height="10" fill="#0284C7" />

        <text x="20" y="19" fill="#FFFFFF" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700">
          WEEKLY SPRINT CADENCE
        </text>
        <rect x="175" y="7" width="52" height="16" rx="4" fill="#FFFFFF" fillOpacity="0.2" />
        <text x="201" y="18" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">
          7 DAYS
        </text>

        {/* 7 Day Blocks: MON TUE WED THU FRI SAT SUN */}
        {[
          { day: "M", num: "01", active: true },
          { day: "T", num: "02", active: true },
          { day: "W", num: "03", active: true },
          { day: "T", num: "04", active: true },
          { day: "F", num: "05", active: true },
          { day: "S", num: "06", active: false },
          { day: "S", num: "07", active: false, renew: true },
        ].map((item, idx) => {
          const x = 16 + idx * 30;
          return (
            <g key={idx} transform={`translate(${x}, 42)`}>
              <rect
                x="0"
                y="0"
                width="24"
                height="46"
                rx="5"
                fill={item.renew ? "#4F46E5" : item.active ? "#F0F9FF" : "#F8FAFC"}
                stroke={item.renew ? "#4338CA" : item.active ? "#0EA5E9" : "#E2E8F0"}
                strokeWidth={item.renew || item.active ? 1.5 : 1}
              />
              <text
                x="12"
                y="14"
                fill={item.renew ? "#E0E7FF" : "#64748B"}
                fontSize="9"
                fontFamily="Inter, sans-serif"
                fontWeight="600"
                textAnchor="middle"
              >
                {item.day}
              </text>
              <text
                x="12"
                y="30"
                fill={item.renew ? "#FFFFFF" : item.active ? "#0284C7" : "#94A3B8"}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                textAnchor="middle"
              >
                {item.num}
              </text>
              {item.renew && (
                <circle cx="12" cy="40" r="2.5" fill="#38BDF8" />
              )}
            </g>
          );
        })}
      </g>

      {/* Milestone Completion Badge */}
      <g transform="translate(262, 106)">
        <rect x="0" y="0" width="78" height="26" rx="13" fill="#10B981" filter="drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3))" />
        <path d="M 12 13 L 16 17 L 24 9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="48" y="16.5" fill="#FFFFFF" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="700" textAnchor="middle">
          SPRINT
        </text>
      </g>
    </svg>
  );
}

/**
 * 3. Monthly Billing Cadence Illustration
 * Visualizes 30-day month-end clamping, billing cycle arrows, recurring invoice schedule, and leap-year safety.
 */
export function MonthlyBillingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full select-none", className)}
      aria-label="Monthly Billing Illustration"
    >
      <defs>
        <linearGradient id="monthly-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.16" />
          <stop offset="60%" stopColor="#818CF8" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#0B1220" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="monthly-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#3730A3" />
        </linearGradient>
      </defs>

      <rect width="360" height="160" fill="url(#monthly-bg)" />

      {/* Concentric Cadence Rings */}
      <circle cx="180" cy="80" r="72" stroke="#4F46E5" strokeOpacity="0.14" strokeWidth="1.5" strokeDasharray="6 4" />
      <circle cx="180" cy="80" r="56" stroke="#818CF8" strokeOpacity="0.2" strokeWidth="1" />

      {/* Central Monthly Calendar Card */}
      <g transform="translate(100, 24)">
        <rect
          x="0"
          y="0"
          width="160"
          height="116"
          rx="10"
          fill="#FFFFFF"
          fillOpacity="0.95"
          stroke="#C7D2FE"
          strokeWidth="1.5"
          filter="drop-shadow(0 12px 24px rgba(79, 70, 229, 0.16))"
        />

        {/* Calendar Header with Binder Rings */}
        <rect x="0" y="0" width="160" height="34" rx="10" fill="url(#monthly-primary)" />
        <rect x="0" y="24" width="160" height="10" fill="#3730A3" />
        <circle cx="36" cy="4" r="3" fill="#E0E7FF" stroke="#4F46E5" strokeWidth="1.5" />
        <circle cx="124" cy="4" r="3" fill="#E0E7FF" stroke="#4F46E5" strokeWidth="1.5" />

        <text x="80" y="22" fill="#FFFFFF" fontSize="12" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          MONTHLY BILLING
        </text>

        {/* Calendar Grid Representation */}
        <g transform="translate(16, 42)">
          {/* Row of miniature day cells */}
          {[0, 1, 2, 3, 4].map((col) => (
            <rect key={col} x={col * 26} y={0} width="22" height="16" rx="3" fill="#EEF2FF" />
          ))}
          {[0, 1, 2, 3, 4].map((col) => (
            <rect key={col} x={col * 26} y={20} width="22" height="16" rx="3" fill="#EEF2FF" />
          ))}
          {/* Highlighted Clamping Cell (Day 30/31) */}
          <rect x="78" y="40" width="48" height="20" rx="4" fill="#4F46E5" />
          <text x="102" y="54" fill="#FFFFFF" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
            DAY 30/31
          </text>
        </g>

        {/* Clamping & Safe Renewal Ribbon */}
        <rect x="0" y="96" width="160" height="20" rx="0" fill="#F8FAFC" />
        <text x="80" y="110" fill="#4F46E5" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">
          MONTH-END CLAMPED • LEAP SAFE
        </text>
      </g>

      {/* Left Recurring Tag */}
      <g transform="translate(18, 64)">
        <rect x="0" y="0" width="70" height="42" rx="6" fill="#FFFFFF" fillOpacity="0.9" stroke="#E0E7FF" strokeWidth="1" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.05))" />
        <text x="35" y="16" fill="#64748B" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600" textAnchor="middle">
          CADENCE
        </text>
        <text x="35" y="32" fill="#4F46E5" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          1 MONTH
        </text>
      </g>

      {/* Right Automatic Renewal Pill */}
      <g transform="translate(272, 64)">
        <rect x="0" y="0" width="72" height="42" rx="6" fill="#FFFFFF" fillOpacity="0.9" stroke="#E0E7FF" strokeWidth="1" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.05))" />
        <text x="36" y="16" fill="#64748B" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600" textAnchor="middle">
          RENEWAL
        </text>
        <text x="36" y="32" fill="#10B981" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          AUTO-SYNC
        </text>
      </g>
    </svg>
  );
}

/**
 * 4. Yearly / Annual Commitment Cadence Illustration
 * Visualizes 12-month commitment ring, 4 quarters (Q1-Q4), prestige star/shield emblem, and enterprise longevity.
 */
export function YearlyBillingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full select-none", className)}
      aria-label="Yearly Billing Illustration"
    >
      <defs>
        <linearGradient id="yearly-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.16" />
          <stop offset="50%" stopColor="#4F46E5" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="yearly-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="yearly-shield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>

      <rect width="360" height="160" fill="url(#yearly-bg)" />

      {/* 365-Day Annual Orbit */}
      <circle cx="180" cy="80" r="70" stroke="#10B981" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="8 4" />
      <circle cx="180" cy="80" r="54" stroke="#F59E0B" strokeOpacity="0.2" strokeWidth="1" />

      {/* 4 Quarterly Milestones Q1, Q2, Q3, Q4 */}
      <g transform="translate(180, 80)">
        <circle cx="0" cy="-70" r="8" fill="#10B981" />
        <text x="0" y="-67" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          Q1
        </text>

        <circle cx="70" cy="0" r="8" fill="#10B981" />
        <text x="70" y="3" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          Q2
        </text>

        <circle cx="0" cy="70" r="8" fill="#10B981" />
        <text x="0" y="73" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          Q3
        </text>

        <circle cx="-70" cy="0" r="8" fill="#10B981" />
        <text x="-70" y="3" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          Q4
        </text>
      </g>

      {/* Central Enterprise Annual Commitment Plaque */}
      <g transform="translate(120, 36)">
        <rect
          x="0"
          y="0"
          width="120"
          height="88"
          rx="10"
          fill="#FFFFFF"
          fillOpacity="0.95"
          stroke="#A7F3D0"
          strokeWidth="1.5"
          filter="drop-shadow(0 12px 24px rgba(16, 185, 129, 0.18))"
        />

        {/* Shield Icon Top */}
        <g transform="translate(60, 22)">
          <path
            d="M 0 -14 L 14 -7 L 14 7 C 14 15, 0 20, 0 20 C 0 20, -14 15, -14 7 L -14 -7 Z"
            fill="url(#yearly-shield)"
          />
          {/* Gold Star */}
          <polygon
            points="0,-6 2,-1 7,-1 3,2 5,7 0,4 -5,7 -3,2 -7,-1 -2,-1"
            fill="#FDE68A"
          />
        </g>

        <text
          x="60"
          y="56"
          fill="#0F172A"
          fontSize="12"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="700"
          textAnchor="middle"
        >
          ANNUAL
        </text>
        <text
          x="60"
          y="69"
          fill="#059669"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="600"
          textAnchor="middle"
        >
          365 DAYS
        </text>
        <rect x="20" y="74" width="80" height="2" fill="#E2E8F0" rx="1" />
      </g>

      {/* Enterprise Tier Badge Left */}
      <g transform="translate(18, 62)">
        <rect x="0" y="0" width="76" height="38" rx="6" fill="#FFFFFF" fillOpacity="0.9" stroke="#E2E8F0" strokeWidth="1" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.05))" />
        <text x="38" y="15" fill="#64748B" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600" textAnchor="middle">
          SAVINGS
        </text>
        <text x="38" y="30" fill="#059669" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          BEST VALUE
        </text>
      </g>

      {/* Commitment Badge Right */}
      <g transform="translate(266, 62)">
        <rect x="0" y="0" width="76" height="38" rx="6" fill="#FFFFFF" fillOpacity="0.9" stroke="#E2E8F0" strokeWidth="1" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.05))" />
        <text x="38" y="15" fill="#64748B" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600" textAnchor="middle">
          CONTRACT
        </text>
        <text x="38" y="30" fill="#4F46E5" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          12 MONTHS
        </text>
      </g>
    </svg>
  );
}

/**
 * 5. General / Default Subscription Illustration
 */
export function GenericBillingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full select-none", className)}
      aria-label="Subscription Plan Illustration"
    >
      <rect width="360" height="160" fill="#EEF2FF" />
      <g transform="translate(120, 36)">
        <rect x="0" y="0" width="120" height="88" rx="8" fill="#4F46E5" />
        <text x="60" y="50" fill="#FFFFFF" fontSize="14" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle">
          SUBSCRIPTION
        </text>
      </g>
    </svg>
  );
}

/**
 * Dynamic Illustration Selector based on Billing Frequency
 */
export function PlanFrequencyIllustration({
  frequency,
  className,
}: PlanIllustrationProps) {
  const norm = (frequency || "").toUpperCase();
  switch (norm) {
    case "DAILY":
      return <DailyBillingIllustration className={className} />;
    case "WEEKLY":
      return <WeeklyBillingIllustration className={className} />;
    case "MONTHLY":
      return <MonthlyBillingIllustration className={className} />;
    case "YEARLY":
      return <YearlyBillingIllustration className={className} />;
    default:
      return <MonthlyBillingIllustration className={className} />;
  }
}

export interface PlanCardImageProps {
  imageUrl?: string | null;
  billingFrequency: string;
  planName: string;
  className?: string;
  badge?: React.ReactNode;
}

/**
 * Visual Header Area for Subscription Plan Cards & Details Drawer
 * Handles custom uploaded images with graceful fallback to cadence SVG illustrations.
 */
export function PlanCardImage({
  imageUrl,
  billingFrequency,
  planName,
  className,
  badge,
}: PlanCardImageProps) {
  const [imgError, setImgError] = useState(false);

  const hasCustomImage = Boolean(imageUrl && !imgError);

  return (
    <div
      className={cn(
        "relative w-full h-40 overflow-hidden bg-bg-subtle/80 border-b border-border flex items-center justify-center transition-colors",
        className
      )}
    >
      {hasCustomImage ? (
        <img
          src={imageUrl!}
          alt={planName}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <PlanFrequencyIllustration frequency={billingFrequency} />
      )}

      {/* Subtle bottom gradient scrim for seamless visual blend */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-base/40 via-transparent to-transparent pointer-events-none" />

      {/* Frequency / status badge overlay */}
      {badge && <div className="absolute top-3 right-3 z-10">{badge}</div>}
    </div>
  );
}
