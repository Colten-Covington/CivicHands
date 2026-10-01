import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { databaseConfigured, getViewer, safeNext } from "@/lib/auth";

export const metadata = { title: "Sign in — CivicHands" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  return <main>
    <SiteHeader/>
    <section className="auth-page">
      <p className="eyebrow">Welcome back</p>
      <h1 className="page-title">Sign in</h1>
      {databaseConfigured() ? <AuthForm mode="signin" next={next}/> : <p className="notice">Accounts are unavailable until this deployment is connected to a database.</p>}
      <p className="auth-switch">New to CivicHands? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
    </section>
  </main>;
}
