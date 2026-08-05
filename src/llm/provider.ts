import Groq from "groq-sdk";
import { z } from "zod";
import { logger } from "../logger";

export interface GenerateOptions {
  systemPrompt?: string;
  timeoutMs?: number;
  temperature?: number;
}

export interface LLMResult<T> {
  data: T;
  modelUsed: string;
}

const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 30_000;

let groqClient: Groq | null = null;
let geminiClientInstance: any = null;

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

async function getGeminiClient(): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClientInstance) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      geminiClientInstance = new GoogleGenAI({ apiKey });
    } catch (err) {
      logger.warn({ err }, "Could not load @google/genai dynamically");
      return null;
    }
  }
  return geminiClientInstance;
}

export function getLLMStatus() {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  return {
    groqAvailable: hasGroq,
    geminiAvailable: hasGemini,
    primaryModel: DEFAULT_GROQ_MODEL,
    secondaryModel: DEFAULT_GEMINI_MODEL,
  };
}

/**
 * Extract first valid JSON object or array from LLM text response.
 */
function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Try to locate ```json ... ``` markdown block
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
      try {
        return JSON.parse(markdownMatch[1]);
      } catch {
        // continue
      }
    }
    // Try to find the outermost { ... } or [ ... ]
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // continue
      }
    }
    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(text.slice(firstBracket, lastBracket + 1));
      } catch {
        // continue
      }
    }
    throw new Error(`Unable to extract valid JSON from LLM output: ${text.slice(0, 200)}...`);
  }
}

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`LLM call timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Calls Groq chat completion to produce a JSON object.
 */
async function callGroqJSON(
  prompt: string,
  options: GenerateOptions,
): Promise<{ rawText: string; model: string }> {
  const groq = getGroqClient();
  if (!groq) {
    throw new Error("GROQ_API_KEY not set");
  }
  const model = DEFAULT_GROQ_MODEL;
  const systemMessage = options.systemPrompt
    ? `${options.systemPrompt}\nIMPORTANT: Reply ONLY with valid JSON. Do not include markdown codeblocks or preamble.`
    : "Reply ONLY with valid JSON. Do not include markdown codeblocks or preamble.";

  const completion = await callWithTimeout(
    groq.chat.completions.create({
      model,
      temperature: options.temperature ?? 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
    }),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const rawText = completion.choices[0]?.message?.content || "";
  return { rawText, model: `groq/${model}` };
}

/**
 * Calls Gemini generateContent to produce a JSON object (secondary fallback).
 */
async function callGeminiJSON(
  prompt: string,
  options: GenerateOptions,
): Promise<{ rawText: string; model: string }> {
  const gemini = await getGeminiClient();
  if (!gemini) {
    throw new Error("GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not set");
  }
  const model = DEFAULT_GEMINI_MODEL;
  const systemInstruction = options.systemPrompt
    ? `${options.systemPrompt}\nRespond in valid JSON only.`
    : "Respond in valid JSON only.";

  const response = await callWithTimeout(
    gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
      config: {
        responseMimeType: "application/json",
        temperature: options.temperature ?? 0.1,
      },
    }),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const rawText = (response as any).text || "";
  return { rawText, model: `gemini/${model}` };
}

/**
 * Robust JSON generation with Zod validation, retry on failure, and Groq -> Gemini fallback.
 */
export async function generateJSON<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: GenerateOptions = {},
): Promise<LLMResult<T>> {
  let lastError: Error | null = null;
  const status = getLLMStatus();

  // Try Groq first if available
  if (status.groqAvailable) {
    try {
      const { rawText, model } = await callGroqJSON(prompt, options);
      const parsed = extractJSON(rawText);
      const validated = schema.safeParse(parsed);
      if (validated.success) {
        return { data: validated.data, modelUsed: model };
      }
      // Retry once with error hint
      logger.warn({ error: validated.error.message }, "Groq output failed Zod validation, retrying with correction hint...");
      const retryPrompt = `${prompt}\n\nYour previous response failed validation with this error:\n${validated.error.message}\nPlease return a corrected, strictly valid JSON object matching the requested schema.`;
      const retryResult = await callGroqJSON(retryPrompt, options);
      const retryParsed = extractJSON(retryResult.rawText);
      const retryValidated = schema.safeParse(retryParsed);
      if (retryValidated.success) {
        return { data: retryValidated.data, modelUsed: retryResult.model };
      }
      logger.warn("Groq retry also failed schema validation. Falling back to Gemini...");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ err: lastError.message }, "Groq call failed, falling back to Gemini...");
    }
  }

  // Fallback to Gemini
  if (status.geminiAvailable) {
    try {
      const { rawText, model } = await callGeminiJSON(prompt, options);
      const parsed = extractJSON(rawText);
      const validated = schema.safeParse(parsed);
      if (validated.success) {
        return { data: validated.data, modelUsed: model };
      }
      // Retry once
      logger.warn({ error: validated.error.message }, "Gemini output failed validation, retrying...");
      const retryPrompt = `${prompt}\n\nPrevious response validation error:\n${validated.error.message}\nProvide corrected valid JSON.`;
      const retryResult = await callGeminiJSON(retryPrompt, options);
      const retryParsed = extractJSON(retryResult.rawText);
      const retryValidated = schema.safeParse(retryParsed);
      if (retryValidated.success) {
        return { data: retryValidated.data, modelUsed: retryResult.model };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ err: lastError.message }, "Gemini call failed.");
    }
  }

  throw new Error(
    `Failed to generate valid structured data via LLM. ${lastError ? lastError.message : "No LLM API keys configured (set GROQ_API_KEY or GEMINI_API_KEY)."}`
  );
}

/**
 * Multimodal generation with an image using Gemini (primary for vision) or Groq vision fallback.
 */
export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  options: GenerateOptions = {},
): Promise<{ text: string; modelUsed: string }> {
  const gemini = await getGeminiClient();
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  if (gemini) {
    const model = DEFAULT_GEMINI_MODEL;
    const response = await callWithTimeout(
      gemini.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
      }),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    return { text: (response as any).text || "", modelUsed: `gemini/${model}` };
  }

  // Fallback to Groq vision model if available
  const groq = getGroqClient();
  if (groq) {
    const visionModel = "llama-3.2-11b-vision-preview";
    const completion = await callWithTimeout(
      groq.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${cleanBase64}` },
              },
            ],
          },
        ],
      }),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    return {
      text: completion.choices[0]?.message?.content || "",
      modelUsed: `groq/${visionModel}`,
    };
  }

  throw new Error("No vision-capable LLM configured (GEMINI_API_KEY or GROQ_API_KEY).");
}
