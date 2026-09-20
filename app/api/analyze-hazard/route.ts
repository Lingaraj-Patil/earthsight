import { NextRequest, NextResponse } from "next/server";

/**
 * Real multimodal vision analysis for EarthSight hazard reports.
 *
 * Browser  →  this route (server-only)  →  Google Gemini API  →  structured JSON  →  browser
 *
 * Gemini was chosen specifically because Google AI Studio issues a genuine
 * free-tier API key (Flash-class models, no credit card, no billing
 * account required) — see .env.example for how to get one. The API key
 * (GEMINI_API_KEY) is read from process.env on the server and is never
 * sent to, or bundled into, client-side JavaScript. This route performs
 * the actual image analysis — there is no demo/hardcoded fallback here.
 * If the key is missing or the provider call fails, we return a clear,
 * typed error instead of fabricating a result.
 */

export const runtime = "nodejs";

const DEFAULT_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // guard before spending a model call

const SYSTEM_PROMPT = `You are analyzing an environmental hazard photograph for EarthSight, an environmental early-warning platform.

Analyze ONLY what is visually supported by the image. Do not invent details that cannot be observed.

Identify:
- the environmental hazard type visible in the image
- the material(s) visible (e.g. plastic waste, sediment, chemical discharge, stagnant water)
- any visible obstruction, damage, or contamination
- the potential environmental impact if conditions worsen (for example, if heavy rain were to fall soon)
- a severity score from 0-100 reflecting how severe the hazard appears from visual evidence ALONE (do not factor in weather — that is handled separately)
- a confidence score from 0-100 reflecting how confident you are in this assessment given the image's clarity and information content
- 2 to 5 short visible indicators (a few words each) that support your assessment
- a one-sentence reasoning statement explaining your severity judgment

If the image is blurry, unclear, too distant, or does not clearly show an environmental hazard, lower your confidence score accordingly rather than inventing certainty. If the image shows no discernible environmental hazard at all, still return your best-effort structured assessment with a low confidence score and say so plainly in "reasoning".

Respond with ONLY valid JSON, no markdown formatting, no code fences, no prose before or after, matching exactly this shape:
{
  "hazardType": string,
  "observedMaterial": string,
  "description": string,
  "severity": number,
  "confidence": number,
  "environmentalImpact": string,
  "visibleIndicators": string[],
  "reasoning": string
}`;

type HazardAnalysisResponse = {
  hazardType: string;
  observedMaterial: string;
  description: string;
  severity: number;
  confidence: number;
  environmentalImpact: string;
  visibleIndicators: string[];
  reasoning: string;
};

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function validateHazardAnalysisShape(value: unknown): HazardAnalysisResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  if (
    typeof v.hazardType !== "string" ||
    typeof v.observedMaterial !== "string" ||
    typeof v.description !== "string" ||
    (typeof v.severity !== "number" && typeof v.severity !== "string") ||
    (typeof v.confidence !== "number" && typeof v.confidence !== "string") ||
    typeof v.environmentalImpact !== "string" ||
    !Array.isArray(v.visibleIndicators) ||
    typeof v.reasoning !== "string"
  ) {
    return null;
  }

  return {
    hazardType: v.hazardType,
    observedMaterial: v.observedMaterial,
    description: v.description,
    severity: clampScore(v.severity),
    confidence: clampScore(v.confidence),
    environmentalImpact: v.environmentalImpact,
    visibleIndicators: (v.visibleIndicators as unknown[])
      .filter((x): x is string => typeof x === "string")
      .slice(0, 6),
    reasoning: v.reasoning,
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "CONFIG_MISSING",
        message:
          "AI hazard analysis is not configured on this server. Set GEMINI_API_KEY in .env.local (see .env.example — Google AI Studio issues free keys at aistudio.google.com/apikey) and restart the app.",
      },
      { status: 503 }
    );
  }

  let body: { imageDataUrl?: string; hazardTypeLabel?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Invalid request body." },
      { status: 400 }
    );
  }

  const { imageDataUrl, hazardTypeLabel, description } = body;

  if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "A valid image is required for analysis." },
      { status: 400 }
    );
  }

  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Image data could not be parsed." },
      { status: 400 }
    );
  }
  const [, mediaType, base64Data] = match;

  const approxBytes = (base64Data.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: "IMAGE_TOO_LARGE",
        message: "Image is too large to analyze. Please use a smaller photo.",
      },
      { status: 413 }
    );
  }

  const contextLine = [
    hazardTypeLabel ? `The reporter categorized this as: ${hazardTypeLabel}.` : null,
    description ? `The reporter's own description: "${description}".` : null,
    "Use this context only as background — base your assessment primarily on what is visible in the image itself.",
  ]
    .filter(Boolean)
    .join(" ");

  const model = process.env.AI_ANALYSIS_MODEL || DEFAULT_MODEL;
  const endpoint = `${GEMINI_API_BASE}/${model}:generateContent`;

  let aiResponse: Response;
  try {
    aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: contextLine },
              { inline_data: { mime_type: mediaType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 1536,
          // Gemini 2.5 Flash spends part of maxOutputTokens on internal
          // "thinking" tokens by default, before writing the visible
          // answer. For a fixed structured-JSON task we don't need that —
          // and leaving it on caused intermittent truncated/empty
          // responses (the model used its whole budget thinking and had
          // nothing left to write). Disabling it makes output reliable
          // and faster.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "NETWORK_ERROR", message: "Could not reach the AI provider." },
      { status: 502 }
    );
  }

  if (aiResponse.status === 429) {
    return NextResponse.json(
      {
        error: "AI_PROVIDER_ERROR",
        message:
          "The free Gemini tier is rate-limited (a handful of requests per minute). Wait a moment and try again.",
      },
      { status: 502 }
    );
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text().catch(() => "");
    return NextResponse.json(
      {
        error: "AI_PROVIDER_ERROR",
        message: `AI provider returned an error (status ${aiResponse.status}).`,
        detail: errText.slice(0, 300),
      },
      { status: 502 }
    );
  }

  const data = await aiResponse.json().catch(() => null);

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    return NextResponse.json(
      {
        error: "AI_PROVIDER_ERROR",
        message: `The AI provider declined to analyze this image (reason: ${blockReason}). Try a different photo.`,
      },
      { status: 502 }
    );
  }

  const candidate = data?.candidates?.[0];
  const raw: string | undefined = candidate?.content?.parts?.[0]?.text;

  if (!raw && candidate?.finishReason === "MAX_TOKENS") {
    return NextResponse.json(
      {
        error: "AI_MALFORMED_RESPONSE",
        message: "The AI response was cut off before finishing. Please try again.",
      },
      { status: 502 }
    );
  }

  if (!raw) {
    return NextResponse.json(
      { error: "AI_MALFORMED_RESPONSE", message: "AI provider returned no analyzable content." },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    // The model is instructed (and configured, via responseMimeType) to
    // return raw JSON; strip accidental code fences defensively rather
    // than trusting it blindly.
    const cleaned = raw.trim().replace(/^```json\s*|^```\s*|```$/g, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "AI_MALFORMED_RESPONSE", message: "Could not parse the AI response as JSON." },
      { status: 502 }
    );
  }

  const validated = validateHazardAnalysisShape(parsed);
  if (!validated) {
    return NextResponse.json(
      {
        error: "AI_MALFORMED_RESPONSE",
        message: "AI response did not match the expected hazard analysis schema.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(validated, { status: 200 });
}
