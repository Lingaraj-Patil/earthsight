import { HazardAnalysis } from "@/types/hazard";
import { labelForScore } from "@/lib/riskEngine";

/**
 * Client-side entry point for hazard image analysis.
 *
 * This calls the server route at /api/analyze-hazard, which performs real
 * multimodal vision analysis via Google's Gemini API (free tier via Google
 * AI Studio). The API key is only ever read server-side (see
 * app/api/analyze-hazard/route.ts) — it never reaches the browser.
 *
 * There is intentionally NO local fallback/demo analysis in this file. If
 * the server is missing GEMINI_API_KEY, or the AI call fails, this
 * throws a HazardAnalysisError with a specific `code` so the UI can show
 * an honest, actionable error instead of fabricating a result.
 */

export type HazardAnalysisInput = {
  hazardTypeLabel: string;
  description?: string;
  imageDataUrl: string;
};

export type HazardAnalysisErrorCode =
  | "CONFIG_MISSING"
  | "BAD_REQUEST"
  | "IMAGE_TOO_LARGE"
  | "AI_PROVIDER_ERROR"
  | "AI_MALFORMED_RESPONSE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class HazardAnalysisError extends Error {
  code: HazardAnalysisErrorCode;
  constructor(message: string, code: HazardAnalysisErrorCode) {
    super(message);
    this.name = "HazardAnalysisError";
    this.code = code;
  }
}

type RawAnalysisResponse = {
  hazardType: string;
  observedMaterial: string;
  description: string;
  severity: number;
  confidence: number;
  environmentalImpact: string;
  visibleIndicators: string[];
  reasoning: string;
};

export async function analyzeHazard(input: HazardAnalysisInput): Promise<HazardAnalysis> {
  let response: Response;
  try {
    response = await fetch("/api/analyze-hazard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new HazardAnalysisError(
      "Could not reach the analysis service. Check your connection and try again.",
      "NETWORK_ERROR"
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const code: HazardAnalysisErrorCode = payload?.error ?? "UNKNOWN";
    const message: string = payload?.message ?? "Hazard analysis failed.";
    throw new HazardAnalysisError(message, code);
  }

  if (!payload) {
    throw new HazardAnalysisError(
      "The analysis service returned an empty response.",
      "AI_MALFORMED_RESPONSE"
    );
  }

  const raw = payload as RawAnalysisResponse;

  return {
    hazardType: raw.hazardType,
    observedMaterial: raw.observedMaterial,
    description: raw.description,
    severityScore: raw.severity,
    severityLabel: labelForScore(raw.severity),
    confidence: raw.confidence,
    environmentalImpact: raw.environmentalImpact,
    visibleIndicators: raw.visibleIndicators ?? [],
    reasoning: raw.reasoning,
  };
}
