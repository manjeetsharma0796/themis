"use client";
// Frictionless onboarding — Wallet (required) → Brain (BYOK) → Remote (Telegram) → Ready.
import { useState } from "react";
import Link from "next/link";
import { WalletCard } from "@/components/settings/WalletCard";
import { KeyManager } from "@/components/settings/KeyManager";
import { markOnboarded } from "@/lib/config";

const STEPS = ["Wallet", "Brain", "Remote", "Ready"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <div className="grain min-h-screen bg-ink">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* stepper */}
        <div className="mb-10 flex items-center justify-center">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs ${
                  i <= step ? "bg-brass text-ink" : "keyline-soft text-faint"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span
                className={`ml-2 font-mono text-[11px] uppercase tracking-widest ${
                  i === step ? "text-parchment" : "text-faint"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="mx-3 h-px w-8 bg-hairline-soft" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brass">required · step 1 of 4</p>
              <h1 className="mt-2 font-serif text-4xl">Create your wallet</h1>
              <p className="mt-2 text-muted">
                Auto-created on this device — the only step you truly need. Fund it later from Settings.
              </p>
            </div>
            <WalletCard />
            <button
              onClick={() => setStep(1)}
              className="w-full rounded bg-brass px-6 py-3 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
            >
              Continue →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">optional · step 2 of 4</p>
              <h1 className="mt-2 font-serif text-4xl">Give it a brain</h1>
              <p className="mt-2 text-muted">
                Bring your own key for the full copilot. Skip to run in basic mode (deterministic tribunal).
              </p>
            </div>
            <KeyManager />
            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="keyline-soft rounded px-4 py-3 font-mono text-sm text-muted transition-colors hover:text-parchment"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded bg-brass px-6 py-3 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
              >
                Continue →
              </button>
            </div>
            <button
              onClick={() => setStep(2)}
              className="mx-auto block font-mono text-xs text-faint transition-colors hover:text-muted"
            >
              skip for now
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">optional · step 3 of 4</p>
              <h1 className="mt-2 font-serif text-4xl">Connect Telegram</h1>
              <p className="mt-2 text-muted">Message the copilot from anywhere — away from the browser.</p>
            </div>
            <section className="keyline-soft rounded bg-surface p-5">
              <h3 className="font-serif text-lg font-medium">Remote control</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
                <li>
                  Create a bot with{" "}
                  <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-brass hover:underline">
                    @BotFather
                  </a>{" "}
                  and copy its token.
                </li>
                <li>
                  Set <code className="rounded bg-ink px-1 text-brass">TELEGRAM_BOT_TOKEN</code> in{" "}
                  <code className="rounded bg-ink px-1 text-brass">.env</code>, then run{" "}
                  <code className="rounded bg-ink px-1 text-brass">npm run bot</code>.
                </li>
                <li>Open your bot in Telegram and send it an intent like “long BTC $200”.</li>
              </ol>
            </section>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="keyline-soft rounded px-4 py-3 font-mono text-sm text-muted transition-colors hover:text-parchment"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded bg-brass px-6 py-3 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rise mt-16 text-center">
            <p className="font-serif text-5xl">
              You&apos;re set<span className="text-brass">.</span>
            </p>
            <p className="mt-4 text-lg text-muted">The court is in session.</p>
            <Link
              href="/console"
              onClick={() => markOnboarded()}
              className="mt-8 inline-block rounded bg-brass px-8 py-3 font-mono text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
            >
              Enter the console →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
