"use client";

import { FormEvent, useMemo, useState } from "react";

interface FormPayload {
  name: string;
  email: string;
  message: string;
}

type FormStatus = "idle" | "submitting" | "success" | "error";

function normalizeValue(value: FormDataEntryValue | null): string {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

const SUCCESS_MESSAGE = "Thanks, I will get back to you soon.";
const ERROR_FALLBACK = "Something went wrong. Please try again later or email isaacinpursuit@gmail.com.";

export default function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const statusClasses = useMemo(() => {
    switch (status) {
      case "success":
        return "text-sm font-medium text-emerald-600 dark:text-emerald-400";
      case "error":
        return "text-sm font-medium text-red-600 dark:text-red-400";
      case "submitting":
        return "text-sm font-medium text-neutral-600 dark:text-neutral-300";
      default:
        return "hidden text-sm";
    }
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload: FormPayload = {
      name: normalizeValue(formData.get("name")),
      email: normalizeValue(formData.get("email")),
      message: normalizeValue(formData.get("message")),
    };

    if (!payload.name || !payload.email || !payload.message) {
      setStatus("error");
      setMessage("All fields are required.");
      return;
    }

    setStatus("submitting");
    setMessage("Sending…");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMessage = typeof data?.error === "string" && data.error.trim().length > 0 ? data.error : ERROR_FALLBACK;
        throw new Error(errorMessage);
      }

      form.reset();
      setStatus("success");
      setMessage(SUCCESS_MESSAGE);
    } catch (error) {
      const description = error instanceof Error && error.message ? error.message : ERROR_FALLBACK;
      setStatus("error");
      setMessage(description);
    }
  };

  const isSubmitting = status === "submitting";
  const describedBy = status === "idle" ? undefined : "contact-status";

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-4"
      noValidate
      aria-busy={isSubmitting}
      aria-describedby={describedBy}
    >
      <div className="space-y-1">
        <label htmlFor="contact-name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="w-full rounded-md border border-neutral-300 p-2 text-neutral-900 focus:border-[#0A2239] focus:outline-none focus:ring-1 focus:ring-[#0A2239] dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="contact-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-neutral-300 p-2 text-neutral-900 focus:border-[#0A2239] focus:outline-none focus:ring-1 focus:ring-[#0A2239] dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="contact-message" className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          className="w-full rounded-md border border-neutral-300 p-2 text-neutral-900 focus:border-[#0A2239] focus:outline-none focus:ring-1 focus:ring-[#0A2239] dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-[#0A2239] px-4 py-2 text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2239] disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending…" : "Send"}
        </button>
        <p id="contact-status" role="status" aria-live="polite" className={statusClasses}>
          {status === "idle" ? "" : message}
        </p>
      </div>
    </form>
  );
}
