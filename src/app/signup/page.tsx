import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { databaseConfigured, getViewer, safeNext } from "@/lib/auth";

export const metadata = { title: "Join — CivicHands" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  return <main>
    <SiteHeader/>
    <section className="auth-page">
      <p className="eyebrow">Join your neighbors</p>
      <h1 className="page-title">Create an account</h1>
      <p className="lede small">Your email stays private. Only your role is shown on the public audit log — never your name or contact details, unless you&apos;re acting as a city official or administrator.</p>
      {databaseConfigured() ? <AuthForm mode="signup" next={next}/> : <p className="notice">Accounts are unavailable until this deployment is connected to a database.</p>}
      <p className="auth-switch">Already have an account? <Link href={`/signin?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
    </section>
  </main>;
}
