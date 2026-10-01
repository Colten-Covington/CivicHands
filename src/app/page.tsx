import { desc } from "drizzle-orm";
import { ArrowDown, HeartHandshake, ShieldCheck, UsersRound } from "lucide-react";
import { MapWorkspace, type MapNeed } from "@/components/map-workspace";
import { getDb } from "@/db";
import { needs } from "@/db/schema";
import { demoNeeds } from "@/lib/demo-needs";

export const dynamic = "force-dynamic";

async function getNeeds(): Promise<MapNeed[]> {
  if (!process.env.DATABASE_URL) return demoNeeds.map((need) => ({ ...need }));
  try {
    const rows=await getDb().select().from(needs).orderBy(desc(needs.createdAt)).limit(50);
    return rows.length ? rows.map((need)=>({...need,createdAt:"Recently"})) : demoNeeds.map((need)=>({...need}));
  } catch { return demoNeeds.map((need)=>({...need})); }
}

export default async function Home(){
  const nearbyNeeds=await getNeeds();
  return <main>
    <header className="topbar"><a className="brand" href="#top" aria-label="CivicHands home"><span className="brand-mark"><HeartHandshake size={21}/></span><span>CivicHands</span></a><nav><a href="#explore">Explore</a><a href="#principles">How it works</a></nav><a className="header-link" href="#explore">Open the map</a></header>
    <section className="hero" id="top">
      <div className="hero-copy"><p className="eyebrow"><span/>A community care network</p><h1>Home is something<br/>we <em>take care of.</em></h1><p className="lede">Notice what needs attention. Pin the exact place. Help when it’s safe—or make sure the right city team sees it.</p><a className="primary-button" href="#explore">Explore Texas City <ArrowDown size={17}/></a></div>
      <div className="hero-proof"><div className="proof-map" aria-hidden="true"><span className="road r1"/><span className="road r2"/><span className="road r3"/><span className="water"/><i className="pin p1"/><i className="pin p2"/><i className="pin p3"/></div><div className="proof-card"><span className="live-dot"/>Community pilot<div><strong>3 ways to help</strong><small>Public care · City referral · Neighbor support</small></div></div></div>
    </section>
    <MapWorkspace initialNeeds={nearbyNeeds}/>
    <section className="principles" id="principles"><div className="principles-intro"><p className="eyebrow">Built for good faith</p><h2>Useful action.<br/>Human recognition.</h2><p>Service should build trust, not turn neighbors into competitors.</p></div><div className="principle-grid"><article><ShieldCheck/><span>01</span><h3>Safety decides the route</h3><p>Road, utility, hazardous waste, and large-tree issues go to trained city crews—not volunteers.</p></article><article><UsersRound/><span>02</span><h3>Privacy comes first</h3><p>Private addresses stay hidden until the person requesting help approves a specific helper.</p></article><article><HeartHandshake/><span>03</span><h3>Trust without a scoreboard</h3><p>Steady helpers can show verified history and references, never points, ranks, or streak pressure.</p></article></div></section>
    <footer><a className="brand" href="#top"><span className="brand-mark"><HeartHandshake size={19}/></span>CivicHands</a><p>Neighbors taking care of the places we share.</p><p className="footer-note">Texas City pilot</p></footer>
  </main>;
}
