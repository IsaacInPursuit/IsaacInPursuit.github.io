import { NextResponse } from "next/server";

const DEFAULT_ENDPOINT = "https://formspree.io/f/mkgnjopd";

type ContactRequest = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
};

function sanitizeField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  try {
    const body = (await request.json()) as ContactRequest;
    const name = sanitizeField(body?.name);
    const email = sanitizeField(body?.email);
    const message = sanitizeField(body?.message);

    if (!name || !email || !message) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    await forwardToEndpoint({ name, email, message });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const description = error instanceof Error && error.message ? error.message : "Unexpected error.";
    const status = description === "All fields are required." ? 400 : 500;
    return NextResponse.json({ error: description }, { status });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
