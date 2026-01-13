import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DynamicStructuredTool } from "@langchain/core/tools";

export interface CreateChatModelOptions {
  provider?: string; // 'openai' | 'google' | others later
  model: string;
  temperature?: number;
}

/**
 * Central factory for creating a chat model based on provider + model name.
 */
export function createChatModel({
  provider = "google",
  model,
  temperature = 1,
}: CreateChatModelOptions): BaseChatModel {
  switch (provider) {
    case "openai":
      return new ChatOpenAI({ model, temperature });
    case "google":
    default:
      return new ChatGoogleGenerativeAI({ model, temperature });
  }
}
export interface AgentConfigOptions {
  model?: string;
  provider?: string; // 'google' | 'openai' etc.
  systemPrompt?: string; // system prompt override
  tools?: unknown[]; // tools from registry or direct tool objects
  approveAllTools?: boolean; // if true, skip tool approval prompts
}

export /**
 * JSON Schema keywords that are not supported by Google Gemini's function calling API.
 * These need to be stripped from tool schemas before passing to the LLM.
 */
const UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "definitions",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "additionalProperties",
  "patternProperties",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "contentMediaType",
  "contentEncoding",
  "examples",
  "default",
  "const",
  "readOnly",
  "writeOnly",
  "deprecated",
  "title",
  "format", // Gemini doesn't support format validation
]);

/**
 * Normalizes a JSON Schema type field.
 * Gemini requires type to be a string, not an array.
 * For nullable types like ["string", "null"], we extract the non-null type.
 */
function normalizeType(type: unknown): string | undefined {
  if (typeof type === "string") {
    return type;
  }

  if (Array.isArray(type)) {
    // Filter out "null" and take the first remaining type
    const nonNullTypes = type.filter((t) => t !== "null");
    if (nonNullTypes.length > 0) {
      return nonNullTypes[0] as string;
    }
    // If only "null" types, default to "string"
    return "string";
  }

  return undefined;
}

/**
 * Recursively sanitizes a JSON Schema object by removing unsupported keywords
 * and normalizing values for Google Gemini's function calling API.
 */
function sanitizeSchema(schema: unknown): Record<string, unknown> | unknown {
  // Handle non-object values
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeSchema(item));
  }

  const schemaObj = schema as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schemaObj)) {
    // Skip unsupported keywords
    if (UNSUPPORTED_SCHEMA_KEYWORDS.has(key)) {
      continue;
    }

    // Special handling for "type" field - normalize array types to string
    if (key === "type") {
      const normalizedType = normalizeType(value);
      if (normalizedType) {
        sanitized[key] = normalizedType;
      }
      continue;
    }

    // Special handling for "items" - if it's an array, take first element
    // JSON Schema allows items to be an array for tuple validation, but Gemini doesn't support it
    if (key === "items" && Array.isArray(value)) {
      if (value.length > 0) {
        sanitized[key] = sanitizeSchema(value[0]);
      }
      continue;
    }

    // Recursively sanitize nested objects and arrays
    if (value && typeof value === "object") {
      sanitized[key] = sanitizeSchema(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes a DynamicStructuredTool's schema to be compatible with Google Gemini.
 * Modifies the tool's schema in place to remove unsupported JSON Schema keywords.
 */
export function sanitizeTool(tool: DynamicStructuredTool): DynamicStructuredTool {
  // Access the schema property and sanitize it
  const originalSchema = tool.schema as Record<string, unknown>;
  const sanitizedSchema = sanitizeSchema(originalSchema) as Record<string, unknown>;

  // Update the tool's schema in place (lc_kwargs contains the constructor args)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tool as any).schema = sanitizedSchema;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((tool as any).lc_kwargs?.schema) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tool as any).lc_kwargs.schema = sanitizedSchema;
  }

  return tool;
}
export const DEFAULT_MODEL_PROVIDER = "google";
export const DEFAULT_MODEL_NAME = "gemini-3-flash-preview";
