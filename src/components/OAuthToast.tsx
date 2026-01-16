"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, X } from "lucide-react";

interface ToastState {
  type: "success" | "error";
  message: string;
}

export function OAuthToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const oauthSuccess = searchParams.get("oauth_success");
    const oauthError = searchParams.get("oauth_error");
    const serverName = searchParams.get("server");

    if (oauthSuccess === "true") {
      setToast({
        type: "success",
        message: serverName
          ? `Successfully connected to "${serverName}"`
          : "OAuth connection successful",
      });
      // Clean up URL params and redirect to original path
      const returnPath = sessionStorage.getItem("oauth_return_path") || "/";
      sessionStorage.removeItem("oauth_return_path");
      router.replace(returnPath, { scroll: false });
    } else if (oauthError) {
      setToast({
        type: "error",
        message: `OAuth error: ${oauthError}`,
      });
      // Clean up URL params and redirect to original path
      const returnPath = sessionStorage.getItem("oauth_return_path") || "/";
      sessionStorage.removeItem("oauth_return_path");
      router.replace(returnPath, { scroll: false });
    }
  }, [searchParams, router]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <div className="animate-in slide-in-from-top-2 fade-in fixed top-4 right-4 z-50 duration-300">
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
          isSuccess
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 size={20} className="flex-shrink-0 text-green-600" />
        ) : (
          <XCircle size={20} className="flex-shrink-0 text-red-600" />
        )}
        <p className="text-sm font-medium">{toast.message}</p>
        <button
          onClick={() => setToast(null)}
          className="ml-2 flex-shrink-0 cursor-pointer text-current opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
