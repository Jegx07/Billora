"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export interface BilloraLogoProps {
  /**
   * Theme variant:
   * - "dark": for dark navy (#0B1220) and dark mode backgrounds (white wordmark + gradient icon)
   * - "light": for white and light-grey surfaces (dark wordmark + gradient icon)
   * - "auto": dynamically switches using CSS classes for light/dark theme
   */
  variant?: "dark" | "light" | "auto";
  /**
   * Predefined standard heights:
   * - xs: 24px (h-6)
   * - sm: 28px (h-7)
   * - md: 32px (h-8)
   * - lg: 40px (h-10)
   * - xl: 48px (h-12)
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function BilloraLogo({
  variant = "auto",
  size = "md",
  className,
  alt = "Billora — Revenue Intelligence Platform",
  priority = false,
}: BilloraLogoProps) {
  const sizeClasses = {
    xs: "h-6 w-auto",
    sm: "h-7 w-auto",
    md: "h-8 w-auto",
    lg: "h-10 w-auto",
    xl: "h-12 w-auto",
    custom: "",
  }[size];

  if (variant === "dark") {
    return (
      <img
        src="/brand/billora-logo-white.png"
        alt={alt}
        className={cn("object-contain select-none", sizeClasses, className)}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  if (variant === "light") {
    return (
      <img
        src="/brand/billora-logo.png"
        alt={alt}
        className={cn("object-contain select-none", sizeClasses, className)}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  // "auto": uses dark-mode variant when .dark class is on html/body, light otherwise
  return (
    <div className={cn("inline-flex items-center select-none", className)}>
      <img
        src="/brand/billora-logo.png"
        alt={alt}
        className={cn("dark:hidden object-contain", sizeClasses)}
        loading={priority ? "eager" : "lazy"}
      />
      <img
        src="/brand/billora-logo-white.png"
        alt={alt}
        className={cn("hidden dark:block object-contain", sizeClasses)}
        loading={priority ? "eager" : "lazy"}
      />
    </div>
  );
}

export interface BilloraIconProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  className?: string;
  alt?: string;
}

export function BilloraIcon({
  size = "md",
  className,
  alt = "Billora",
}: BilloraIconProps) {
  const sizeClasses = {
    xs: "h-5 w-5",
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
    custom: "",
  }[size];

  return (
    <img
      src="/brand/billora-icon.png"
      alt={alt}
      className={cn("object-contain select-none shrink-0", sizeClasses, className)}
    />
  );
}

export interface BilloraBrandLinkProps {
  href?: string;
  collapsed?: boolean;
  variant?: "dark" | "light" | "auto";
  tagline?: string;
  className?: string;
}

export function BilloraBrandLink({
  href = "/dashboard",
  collapsed = false,
  variant = "dark",
  tagline = "REVENUE INTELLIGENCE",
  className,
}: BilloraBrandLinkProps) {
  if (collapsed) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center justify-center h-10 w-10 rounded-lg hover:bg-white/5 transition-all",
          className
        )}
        title="Billora Revenue Intelligence"
      >
        <BilloraIcon size="md" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 overflow-hidden group transition-all",
        className
      )}
    >
      <BilloraLogo variant={variant} size="md" className="group-hover:scale-[1.02] transition-transform duration-150" />
      {tagline && (
        <span className="sr-only">Billora — {tagline}</span>
      )}
    </Link>
  );
}
