// ─── Hub-proxied AI generation ───────────────────────────────────────
//
// Three Bearer-authed endpoints that forward user requests to upstream
// providers on the hub's dime, enforce per-user lifetime quotas, and
// clamp potentially-expensive parameters (dimensions, step counts,
// GPT quality tier) so a single request can't blow through the budget.
//
//   POST /ai/image/generate            → Runware (FLUX.2 or GPT Image 2)
//   POST /ai/image/remove-background   → Runware Bria RMBG v2.0
//   POST /ai/llm/complete              → OpenRouter → DeepSeek V3.2
//   POST /ai/llm/vision                → Anthropic Claude Sonnet 4.6
//
// Vision calls bill against the same `prompts_used` counter as
// completions — they're bucketed together as "LLM calls" per the
// spec. Image calls use `images_used`. Counters are decoupled from
// key rotation; an admin resets them explicitly via
// POST /admin/users/<id>/reset-usage.

import type { Env } from "../env";
import type { UserRow } from "../db";
import { incrementImageUsage, incrementPromptUsage } from "../db";
import { error, json, preflight } from "../util";

const CORS = { origin: "*" as const };

// ─── Model allowlist ─────────────────────────────────────────────────
// Any request whose `model` field isn't in one of these sets is
// rejected with 400. This keeps the surface small and predictable:
// no surprise expensive models, no unknown providers.

const IMAGE_MODELS = new Set([
  "runware:400@1", // FLUX.2 [dev]
  "runware:400@2", // FLUX.2 (commercial)
  "openai:gpt-image@2", // GPT Image 2
]);

// Background removal is locked to a single model — no caller choice.
// Bria RMBG v2.0 is fast, high quality, and priced at ~$0.018/image
// which fits comfortably inside the same image quota.
const BG_REMOVAL_MODEL = "bria:2@1";

// Default Runware FLUX model matches creator/src-tauri/src/runware.rs.
const DEFAULT_IMAGE_MODEL = "runware:400@2";

// Claude Haiku 4.5 via direct Anthropic API. Fast (~180 tok/s),
// excellent at structured JSON, and cheap.
const LLM_MODEL = "claude-haiku-4-5-20251001";

// Claude Sonnet 4.6 for vision.
const VISION_MODEL = "claude-sonnet-4-6";

// ─── Guardrails ──────────────────────────────────────────────────────

const MAX_IMAGE_DIM = 1024; // FLUX cap; matches generation::cap_generation_dims
const MAX_STEPS = 32;
const MAX_LLM_INPUT_CHARS = 64 * 1024; // Refuse absurd prompts before billing
const MAX_VISION_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB decoded base64

// ─── Router ──────────────────────────────────────────────────────────

export async function handleAi(
  req: Request,
  env: Env,
  pathname: string,
  user: UserRow,
): Promise<Response> {
  if (req.method === "OPTIONS") return preflight(CORS);

  // Tier gate. Publish-only users have valid credentials for /publish/*
  // but cannot spend AI budget. Demo and full tiers can — demo just
  // has much tighter quotas via DEFAULT_QUOTAS at signup time. D1 is
  // the authoritative tier; the `hubk_*_` prefix on the key is just a
  // UX hint the creator reads. Never trust the prefix; check here.
  if (user.tier === "publish") {
    return json(
      {
        error: "tier_forbidden",
        message:
          "This API key is publish-only and cannot use hub AI features. Ask the hub admin for a full-tier key.",
        tier: user.tier,
      },
      { status: 403 },
      CORS,
    );
  }

  if (pathname === "/ai/image/generate" && req.method === "POST") {
    return await imageGenerate(req, env, user);
  }
  if (pathname === "/ai/image/remove-background" && req.method === "POST") {
    return await imageRemoveBackground(req, env, user);
  }
  if (pathname === "/ai/llm/complete" && req.method === "POST") {
    return await llmComplete(req, env, user);
  }
  if (pathname === "/ai/llm/vision" && req.method === "POST") {
    return await llmVision(req, env, user);
  }
  return error(404, "Not found", CORS);
}

// ─── Quota helpers ───────────────────────────────────────────────────

function quotaExceeded(kind: "images" | "prompts", used: number, quota: number): Response {
  return json(
    {
      error: `hub_quota_exceeded:${kind}`,
      message: `You've used your lifetime ${kind} allowance (${used} / ${quota}). Ask the hub admin to reset your usage or raise your quota.`,
      used,
      quota,
    },
    { status: 429 },
    CORS,
  );
}

// ─── Image generation ────────────────────────────────────────────────

interface ImageGenerateBody {
  model?: string;
  prompt: string;
  negativePrompt?: string | null;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seedImage?: string | null; // data URL, for img2img
  guideImage?: string | null; // data URL, for FLUX Redux
  transparentBackground?: boolean;
  outputFormat?: "PNG" | "JPG" | "WEBP";
}

interface RunwareImageTask {
  taskType: "imageInference";
  taskUUID: string;
  positivePrompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  model: string;
  steps?: number;
  CFGScale?: number;
  seedImage?: string;
  strength?: number;
  ipAdapters?: { model: string; guideImage: string }[];
  outputFormat: string;
  numberResults: number;
  includeCost: boolean;
  providerSettings?: {
    openai: { quality: string };
  };
}

interface RunwareSuccessItem {
  taskType: string;
  taskUUID: string;
  imageUUID?: string;
  imageURL?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  seed?: number;
  cost?: number;
}

async function imageGenerate(req: Request, env: Env, user: UserRow): Promise<Response> {
  // ─── Quota gate ──────────────────────────────────────────────────
  if (user.images_used >= user.images_quota) {
    return quotaExceeded("images", user.images_used, user.images_quota);
  }

  // ─── Parse + validate body ───────────────────────────────────────
  let body: ImageGenerateBody;
  try {
    body = (await req.json()) as ImageGenerateBody;
  } catch {
    return error(400, "Invalid JSON body", CORS);
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return error(400, "Missing prompt", CORS);
  if (prompt.length > MAX_LLM_INPUT_CHARS) {
    return error(400, "Prompt too long", CORS);
  }

  const model = body.model?.trim() || DEFAULT_IMAGE_MODEL;
  if (!IMAGE_MODELS.has(model)) {
    return error(400, `Unsupported model "${model}". Allowed: ${[...IMAGE_MODELS].join(", ")}`, CORS);
  }

  const isGptImage = model.startsWith("openai:");

  // GPT Image is materially more expensive than FLUX per call (v2 is
  // token-priced: $5/1M text in, $8/1M image in, $10/1M text out,
  // $30/1M image out). Only playtester-tier
  // users (admin-invited) get access to it on the hub's dime; demo
  // and self-signup users are locked to FLUX regardless of what their
  // client asks for.
  if (isGptImage && user.tier !== "playtester") {
    return json(
      {
        error: "hub_model_forbidden",
        message:
          "Your tier can only use FLUX image models on the hub. Ask the hub admin for playtester access to enable GPT Image.",
        tier: user.tier,
        model,
      },
      { status: 403 },
      CORS,
    );
  }
  // `body.transparentBackground` is accepted for wire compat but no longer
  // influences the request — GPT Image v2 dropped providerSettings.openai.background.

  // ─── Dimension guardrail ─────────────────────────────────────────
  let width: number;
  let height: number;
  if (isGptImage) {
    [width, height] = snapGptImageDims(body.width ?? 1024, body.height ?? 1024);
  } else {
    const w = clamp(body.width ?? 1024, 256, MAX_IMAGE_DIM);
    const h = clamp(body.height ?? 1024, 256, MAX_IMAGE_DIM);
    width = roundTo16(w);
    height = roundTo16(h);
  }

  // ─── Build Runware task body ─────────────────────────────────────
  const task: RunwareImageTask = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: prompt,
    width,
    height,
    model,
    outputFormat: body.outputFormat ?? "PNG",
    numberResults: 1,
    // Ask Runware to include cost in the response so we can log it
    // and surface it in the hub response. GPT Image v2 bills per-token
    // (input + output), so per-image cost depends on prompt length
    // and resolution — `cost` in the response is the source of truth.
    includeCost: true,
  };

  if (isGptImage) {
    // Force quality "low" regardless of what the client asks. v2 dropped
    // the `background` field on providerSettings.openai; transparency is
    // no longer a provider-level toggle — the bg-removal pipeline handles it.
    task.providerSettings = {
      openai: {
        quality: "low",
      },
    };
  } else {
    if (body.negativePrompt?.trim()) task.negativePrompt = body.negativePrompt.trim();
    if (typeof body.steps === "number") task.steps = clamp(body.steps, 1, MAX_STEPS);
    if (typeof body.cfgScale === "number") task.CFGScale = clamp(body.cfgScale, 1, 20);
  }

  // Seed image / guide image (img2img) — pass through, Runware accepts
  // data URLs or base64. The hub doesn't re-encode.
  if (body.seedImage) task.seedImage = body.seedImage;
  if (body.guideImage) {
    task.ipAdapters = [
      {
        model: "runware:105@1", // FLUX Redux IP-Adapter; matches current Arcanum code
        guideImage: body.guideImage,
      },
    ];
  }

  // ─── Call Runware ────────────────────────────────────────────────
  const upstream = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNWARE_API_KEY}`,
    },
    body: JSON.stringify([task]),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return error(upstream.status, `Runware error (${upstream.status}): ${text.slice(0, 500)}`, CORS);
  }

  const raw = (await upstream.json()) as {
    data?: RunwareSuccessItem[];
    errors?: { message?: string; code?: string }[];
  };
  if (raw.errors?.length) {
    const msg = raw.errors[0]?.message ?? "unknown Runware error";
    return error(502, `Runware: ${msg}`, CORS);
  }
  const item = raw.data?.find((d) => d.taskUUID === task.taskUUID);
  if (!item) return error(502, "Runware returned no image", CORS);

  // ─── Increment usage and return ──────────────────────────────────
  await incrementImageUsage(env, user.id);

  return json(
    {
      imageURL: item.imageURL,
      imageBase64Data: item.imageBase64Data,
      imageDataURI: item.imageDataURI,
      seed: item.seed,
      width,
      height,
      model,
      cost: item.cost,
      usage: {
        images_used: user.images_used + 1,
        images_quota: user.images_quota,
      },
    },
    {},
    CORS,
  );
}

// ─── Background removal (Bria RMBG v2.0) ─────────────────────────────
//
// Server-side background removal via Runware's Bria model. Bills
// against the same `images_used` counter as image generation — it's
// one upstream image API call — so quota-exhausted users can't farm
// free bg-removal by switching modes.

interface RemoveBgBody {
  imageDataUrl?: string;
}

interface RunwareRemoveBgTask {
  taskType: "removeBackground";
  taskUUID: string;
  model: string;
  outputType: "base64Data";
  outputFormat: "PNG";
  inputs: { image: string };
  providerSettings: { bria: { preserveAlpha: boolean } };
  includeCost: boolean;
}

async function imageRemoveBackground(req: Request, env: Env, user: UserRow): Promise<Response> {
  if (user.images_used >= user.images_quota) {
    return quotaExceeded("images", user.images_used, user.images_quota);
  }

  let body: RemoveBgBody;
  try {
    body = (await req.json()) as RemoveBgBody;
  } catch {
    return error(400, "Invalid JSON body", CORS);
  }

  const image = (body.imageDataUrl ?? "").trim();
  if (!image) return error(400, "Missing imageDataUrl", CORS);
  // Accept either a data URL or a plain URL. Anything that is neither
  // (e.g. raw base64 with no prefix) gets a helpful error instead of
  // being forwarded and failing upstream with a Runware 400.
  if (!/^data:image\/[a-z+]+;base64,/.test(image) && !/^https?:\/\//.test(image)) {
    return error(
      400,
      "imageDataUrl must be a base64 data URL (data:image/...;base64,...) or an https URL",
      CORS,
    );
  }
  // Rough size guard for data URLs: a 10 MB decoded ceiling mirrors the
  // vision handler.
  if (image.startsWith("data:")) {
    const commaIdx = image.indexOf(",");
    const b64Len = commaIdx >= 0 ? image.length - commaIdx - 1 : image.length;
    if (b64Len * 0.75 > MAX_VISION_IMAGE_BYTES) {
      return error(413, "Image exceeds 10 MB", CORS);
    }
  }

  const task: RunwareRemoveBgTask = {
    taskType: "removeBackground",
    taskUUID: crypto.randomUUID(),
    model: BG_REMOVAL_MODEL,
    outputType: "base64Data",
    outputFormat: "PNG",
    inputs: { image },
    providerSettings: { bria: { preserveAlpha: false } },
    includeCost: true,
  };

  const upstream = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNWARE_API_KEY}`,
    },
    body: JSON.stringify([task]),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return error(upstream.status, `Runware error (${upstream.status}): ${text.slice(0, 500)}`, CORS);
  }

  const raw = (await upstream.json()) as {
    data?: RunwareSuccessItem[];
    errors?: { message?: string; code?: string }[];
  };
  if (raw.errors?.length) {
    const msg = raw.errors[0]?.message ?? "unknown Runware error";
    return error(502, `Runware: ${msg}`, CORS);
  }
  const item = raw.data?.find((d) => d.taskUUID === task.taskUUID);
  if (!item) return error(502, "Runware returned no image", CORS);

  await incrementImageUsage(env, user.id);

  return json(
    {
      imageURL: item.imageURL,
      imageBase64Data: item.imageBase64Data,
      imageDataURI: item.imageDataURI,
      model: BG_REMOVAL_MODEL,
      cost: item.cost,
      usage: {
        images_used: user.images_used + 1,
        images_quota: user.images_quota,
      },
    },
    {},
    CORS,
  );
}

// ─── LLM completion (Claude Haiku 4.5 via Anthropic) ─────────────────

interface LlmCompleteBody {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

async function llmComplete(req: Request, env: Env, user: UserRow): Promise<Response> {
  if (user.prompts_used >= user.prompts_quota) {
    return quotaExceeded("prompts", user.prompts_used, user.prompts_quota);
  }

  let body: LlmCompleteBody;
  try {
    body = (await req.json()) as LlmCompleteBody;
  } catch {
    return error(400, "Invalid JSON body", CORS);
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return error(400, "Missing prompt", CORS);
  if (prompt.length > MAX_LLM_INPUT_CHARS) return error(400, "Prompt too long", CORS);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: clamp(body.maxTokens ?? 1024, 16, 8192),
      temperature: clamp(body.temperature ?? 0.7, 0, 1),
      system: body.system?.trim() || undefined,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return error(upstream.status, `Anthropic error (${upstream.status}): ${text.slice(0, 500)}`, CORS);
  }

  const raw = (await upstream.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const content = raw.content?.find((b) => b.type === "text")?.text ?? "";
  if (!content) return error(502, "Anthropic returned no content", CORS);

  await incrementPromptUsage(env, user.id);

  return json(
    {
      content,
      model: LLM_MODEL,
      usage: {
        prompts_used: user.prompts_used + 1,
        prompts_quota: user.prompts_quota,
        prompt_tokens: raw.usage?.input_tokens,
        completion_tokens: raw.usage?.output_tokens,
      },
    },
    {},
    CORS,
  );
}

// ─── LLM vision (Anthropic Claude) ───────────────────────────────────

interface LlmVisionBody {
  system?: string;
  prompt: string;
  imageDataUrl: string; // must be "data:image/<type>;base64,<...>"
  maxTokens?: number;
}

async function llmVision(req: Request, env: Env, user: UserRow): Promise<Response> {
  if (user.prompts_used >= user.prompts_quota) {
    return quotaExceeded("prompts", user.prompts_used, user.prompts_quota);
  }

  let body: LlmVisionBody;
  try {
    body = (await req.json()) as LlmVisionBody;
  } catch {
    return error(400, "Invalid JSON body", CORS);
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return error(400, "Missing prompt", CORS);
  if (prompt.length > MAX_LLM_INPUT_CHARS) return error(400, "Prompt too long", CORS);

  const dataUrl = (body.imageDataUrl ?? "").trim();
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) return error(400, "imageDataUrl must be a base64 data URL of an image", CORS);
  const mediaType = match[1]!;
  const b64 = match[2]!;
  // Rough decoded-size check: base64 is ~4/3 the raw bytes.
  if (b64.length * 0.75 > MAX_VISION_IMAGE_BYTES) {
    return error(413, "Vision image exceeds 10 MB", CORS);
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: clamp(body.maxTokens ?? 1024, 16, 4096),
      system: body.system?.trim() || undefined,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: b64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return error(upstream.status, `Anthropic error (${upstream.status}): ${text.slice(0, 500)}`, CORS);
  }

  const raw = (await upstream.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const content = raw.content?.find((c) => c.type === "text")?.text ?? "";
  if (!content) return error(502, "Anthropic returned no text", CORS);

  await incrementPromptUsage(env, user.id);

  return json(
    {
      content,
      model: VISION_MODEL,
      usage: {
        prompts_used: user.prompts_used + 1,
        prompts_quota: user.prompts_quota,
        input_tokens: raw.usage?.input_tokens,
        output_tokens: raw.usage?.output_tokens,
      },
    },
    {},
    CORS,
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function roundTo16(n: number): number {
  return Math.max(256, Math.round(n / 16) * 16);
}

/** GPT Image v2 supports {1024x1024, 1024x1536, 1536x1024, 2560x1440, 3840x2160};
 *  we stay on the 1K tier because the rest of Arcanum caps generation at 1024px. */
function snapGptImageDims(w: number, h: number): [number, number] {
  const aspect = w / h;
  if (aspect > 1.2) return [1536, 1024];
  if (aspect < 0.8) return [1024, 1536];
  return [1024, 1024];
}
