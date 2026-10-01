import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getViewer, isStaff } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();
  return <header className="topbar">
    <Link className="brand" href="/" aria-label="CivicHands home"><span className="brand-mark"><HeartHandshake size={21}/></span><span>CivicHands</span></Link>
    <nav aria-label="Main">
      <Link href="/#explore">Map</Link>
      <Link href="/#principles">How it works</Link>
      <Link href="/transparency">Transparency</Link>
      {isStaff(viewer) && <Link href="/admin">{viewer?.role === "admin" ? "Admin" : "Manage reports"}</Link>}
    </nav>
    {viewer
      ? <div className="account-links"><Link className="header-link" href="/account">{viewer.displayName}</Link><form action={signOut}><button className="text-button">Sign out</button></form></div>
      : <div className="account-links"><Link className="header-link" href="/signin">Sign in</Link><Link className="small-button" href="/signup">Join</Link></div>}
  </header>;
}
