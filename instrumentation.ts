export async function register() {
  // Only initialize in the Node.js runtime — @opentelemetry/sdk-node uses
  // Node.js-only APIs that are not available in the Edge runtime.
  // Next.js may evaluate this file in both contexts.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.LANGFUSE_ENABLED === "true") {
    // Dynamic imports are required here so Next.js doesn't attempt to bundle
    // Node.js-only modules for the Edge runtime.
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { LangfuseSpanProcessor } = await import("@langfuse/otel");

    const sdk = new NodeSDK({
      spanProcessors: [new LangfuseSpanProcessor()],
    });

    sdk.start();
  }
}
