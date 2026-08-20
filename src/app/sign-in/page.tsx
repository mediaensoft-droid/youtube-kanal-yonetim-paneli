"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="animate-fade-in-up mx-auto flex max-w-sm flex-col items-center gap-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand">
        <svg width="20" height="14" viewBox="0 0 26 18">
          <path d="M10.5 5.5L17 9L10.5 12.5V5.5Z" fill="white" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-ink">Giriş yap</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Kanallarınızı görüntülemek için Google hesabınızla giriş yapın.
        </p>
      </div>
      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: "/" })}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-hover"
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        Google ile giriş yap
      </button>
    </div>
  );
}
