"use client";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./globals.css";
import { ThreadProvider } from "@/contexts/ThreadContext";
import { UISettingsProvider } from "@/contexts/UISettingsContext";
import { OAuthToast } from "@/components/OAuthToast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>LangGraph & NextJS Agent</title>
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <UISettingsProvider>
            <ThreadProvider>
              <Suspense fallback={null}>
                <OAuthToast />
              </Suspense>
              {children}
            </ThreadProvider>
          </UISettingsProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
