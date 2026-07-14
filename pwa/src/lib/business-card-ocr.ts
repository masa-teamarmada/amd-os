import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clampConfidence,
  cleanText,
  sanitizeFieldConfidence,
} from "@/lib/business-card-server";

const PROMPT_KEY = "business_card.ocr";

export type BusinessCardOcrResult = {
  fullName: string;
  fullNameKana: string;
  companyName: string;
  department: string;
  jobTitle: string;
  email: string;
  phone: string;
  mobile: string;
  postalCode: string;
  address: string;
  website: string;
  rawText: string;
  confidence: number | null;
  fieldConfidence: Record<string, number>;
  model: string;
};

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("OCR結果にJSONがなかったよ");
  const parsed = JSON.parse(match[0]) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OCR結果のJSON形式が違うよ");
  }
  return parsed as Record<string, unknown>;
}

export async function extractBusinessCard(params: {
  admin: SupabaseClient;
  bytes: Buffer;
  mimeType: string;
}): Promise<BusinessCardOcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定だよ");

  const { data: prompt, error: promptError } = await params.admin
    .from("llm_prompts")
    .select("body,model,max_tokens,is_active")
    .eq("prompt_key", PROMPT_KEY)
    .maybeSingle();
  if (promptError) throw promptError;
  if (!prompt?.is_active || !cleanText(prompt.body, 20000)) {
    throw new Error(
      "名刺OCRプロンプトが無効だよ。/admin/prompts で business_card.ocr を確認してね",
    );
  }

  const modelName = cleanText(prompt.model, 120) || "gemini-2.5-flash";
  const generation = new GoogleGenerativeAI(apiKey);
  const model = generation.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: Math.max(512, Math.min(Number(prompt.max_tokens) || 2048, 8192)),
      temperature: 0,
    },
  });
  const result = await model.generateContent([
    { text: String(prompt.body) },
    {
      inlineData: {
        mimeType: params.mimeType,
        data: params.bytes.toString("base64"),
      },
    },
  ]);
  const parsed = parseJsonObject(result.response.text());

  return {
    fullName: cleanText(parsed.full_name, 240),
    fullNameKana: cleanText(parsed.full_name_kana, 240),
    companyName: cleanText(parsed.company_name, 320),
    department: cleanText(parsed.department, 320),
    jobTitle: cleanText(parsed.job_title, 240),
    email: cleanText(parsed.email, 320),
    phone: cleanText(parsed.phone, 80),
    mobile: cleanText(parsed.mobile, 80),
    postalCode: cleanText(parsed.postal_code, 40),
    address: cleanText(parsed.address, 600),
    website: cleanText(parsed.website, 500),
    rawText: cleanText(parsed.raw_text, 6000),
    confidence: clampConfidence(parsed.confidence),
    fieldConfidence: sanitizeFieldConfidence(parsed.field_confidence),
    model: modelName,
  };
}
