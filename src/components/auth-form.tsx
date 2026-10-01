"use client";
import { useActionState } from "react";
import { signIn, signUp } from "@/app/actions/auth";

export function AuthForm({ mode, next }: { mode: "signin" | "signup"; next: string }) {
  const [state, action, pending] = useActionState(mode === "signin" ? signIn : signUp, null);
  return <form action={action} className="auth-form">
    <input type="hidden" name="next" value={next}/>
    {mode === "signup" && <label>Display name<input name="displayName" required minLength={2} maxLength={60} autoComplete="nickname"/><small>Shown on your account. City officials and administrators are listed publicly by this name.</small></label>}
    <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
    <label>Password<input name="password" type="password" required minLength={mode === "signup" ? 12 : 1} maxLength={200} autoComplete={mode === "signup" ? "new-password" : "current-password"}/>{mode === "signup" && <small>At least 12 characters.</small>}</label>
    {mode === "signup" && <label className="checkbox"><input type="checkbox" name="agree" required/>I&apos;ll follow the community safety guidelines: no entering traffic or handling utilities, hazardous materials, or suspended limbs, and I&apos;ll respect neighbors&apos; privacy.</label>}
    {state && !state.ok && <p className="form-error" role="alert">{state.message}</p>}
    <button className="primary-button wide" disabled={pending}>{pending ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}</button>
  </form>;
}
