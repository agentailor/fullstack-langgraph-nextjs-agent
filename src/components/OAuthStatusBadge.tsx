"use client";

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export type OAuthStatusType = "UNKNOWN" | "NOT_REQUIRED" | "REQUIRED" | "CONNECTED" | "EXPIRED";

interface OAuthStatusBadgeProps {
  status?: OAuthStatusType | string | null;
}

const statusConfig: Record<
  OAuthStatusType,
  { label: string; className: string; icon?: React.ReactNode }
> = {
  UNKNOWN: {
    label: "",
    className: "",
  },
  NOT_REQUIRED: {
    label: "",
    className: "",
  },
  REQUIRED: {
    label: "Auth Required",
    className: "bg-yellow-100 text-yellow-700",
    icon: <AlertCircle size={12} />,
  },
  CONNECTED: {
    label: "Connected",
    className: "bg-green-100 text-green-700",
    icon: <CheckCircle2 size={12} />,
  },
  EXPIRED: {
    label: "Expired",
    className: "bg-red-100 text-red-700",
    icon: <XCircle size={12} />,
  },
};

export function OAuthStatusBadge({ status }: OAuthStatusBadgeProps) {
  // Don't show badge for servers that don't require auth
  if (!status || status === "NOT_REQUIRED") {
    return null;
  }

  const config = statusConfig[status as OAuthStatusType] || statusConfig.UNKNOWN;

  if (!config.label) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
