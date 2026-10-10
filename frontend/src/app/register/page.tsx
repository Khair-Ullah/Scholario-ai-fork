"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const referralCode =
        new URLSearchParams(window.location.search).get("ref") || undefined;
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...form, referral_code: referralCode }),
      });
      router.replace("/onboarding");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create your account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <Link className="brand auth-brand" href="/">
        <Image
          className="brand-logo"
          src="/images/logo/logo.png"
          alt="Scholario"
          width={39}
          height={36}
          priority
        />{" "}
        scholario<span className="brand-period">.</span>
      </Link>
      <Link className="back-home" href="/">
        <ArrowLeft size={15} /> Home
      </Link>
      <section className="auth-form-wrap">
        <p className="eyebrow">MAKE A LITTLE ROOM FOR WHAT&apos;S NEXT</p>
        <h1>
          Start with
          <br />
          your story.
        </h1>
        <p className="auth-intro">
          Create an account to find scholarships shaped around you.
        </p>
        <form onSubmit={submit} className="auth-form">
          <label>
            Full name
            <input
              autoComplete="name"
              required
              minLength={1}
              value={form.full_name}
              onChange={(event) =>
                setForm({ ...form, full_name: event.target.value })
              }
              placeholder="Your name"
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="At least 8 characters"
            />
            <span className="input-hint">Use 8 or more characters.</span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
      <div className="auth-aside register-aside">
        <div className="aside-cap register-cap">
          <Image
            className="aside-cap-img"
            src="/images/design/cap.png"
            alt=""
            width={110}
            height={100}
            priority
          />
        </div>
        <span className="aside-index">
          YOUR PLAN, WITH A LITTLE MORE CLARITY
        </span>
        <p>
          Find a path
          <br />
          that feels like
          <br />
          <em>yours.</em>
        </p>
        <span className="aside-bottom">scholario · start anywhere</span>
      </div>
    </main>
  );
}
