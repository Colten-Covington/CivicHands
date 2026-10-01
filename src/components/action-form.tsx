"use client";
import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

/** A form bound to a server action that shows the action's result message inline. */
export function ActionForm({ action, children, submitLabel, pendingLabel = "Saving…", className, buttonClassName = "primary-button" }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return <form action={formAction} className={className ?? "action-form"}>
    {children}
    <button className={buttonClassName} disabled={pending}>{pending ? pendingLabel : submitLabel}</button>
    {state && <p className={state.ok ? "form-success" : "form-error"} role="status">{state.message}</p>}
  </form>;
}
