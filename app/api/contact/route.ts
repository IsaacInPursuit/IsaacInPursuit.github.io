import { NextResponse } from "next/server";

const DEFAULT_ENDPOINT = "https://formspree.io/f/mkgnjopd";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

type ContactRequest = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
};

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function sanitizeField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) {
      return first.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

function applyRateLimit(identifier: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || existing.expiresAt <= now) {
    rateLimitStore.set(identifier, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
    return { limited: true, retryAfterSeconds: retryAfter };
  }

  const updatedEntry: RateLimitEntry = {
    count: existing.count + 1,
    expiresAt: existing.expiresAt,
  };
  rateLimitStore.set(identifier, updatedEntry);

  const retryAfter = Math.max(1, Math.ceil((updatedEntry.expiresAt - now) / 1000));
  return { limited: false, retryAfterSeconds: retryAfter };
}

async function forwardToEndpoint(payload: { name: string; email: string; message: string }) {
  const endpoint = process.env.FORMSPREE_ENDPOINT ?? DEFAULT_ENDPOINT;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      if (typeof data?.error === "string") {
        detail = data.error;
      } else if (typeof data?.message === "string") {
        detail = data.message;
      }
    } catch (error) {
      // Ignore JSON parsing errors and fall back to a generic message.
    }

    const message = detail || "Unable to send message right now. Please try again later.";
    throw new Error(message);
  }
}

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  const rateLimit = applyRateLimit(identifier);

  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before submitting again." },
      {
        status: 429,
        headers: { "Retry-After": rateLimit.retryAfterSeconds.toString() },
      },
    );
  }

  let body: ContactRequest;
  try {
    body = (await request.json()) as ContactRequest;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = sanitizeField(body?.name);
  const email = sanitizeField(body?.email);
  const message = sanitizeField(body?.message);

  if (!name || !email || !message) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await forwardToEndpoint({ name, email, message });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const description = error instanceof Error && error.message ? error.message : "Unexpected error.";
    return NextResponse.json({ error: description }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
