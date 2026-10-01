import Link from "next/link";
import { ArrowDown, HeartHandshake, ShieldCheck, UsersRound } from "lucide-react";
import { MapWorkspace } from "@/components/map-workspace";
import { SiteHeader } from "@/components/site-header";
import { databaseConfigured, getViewer, type Viewer } from "@/lib/auth";
import { demoNeeds } from "@/lib/demo-needs";
import type { MapNeed } from "@/lib/needs";
import { loadMapNeeds } from "@/lib/queries";

export const dynamic = "force-dynamic";

async function getNeeds(viewer: Viewer | null): Promise<{ needs: MapNeed[]; demo: boolean }> {
  if (!databaseConfigured()) return { needs: demoNeeds, demo: true };
  return { needs: await loadMapNeeds(viewer), demo: false };
}

export default async function Home(){
  const viewer=await getViewer();
  const {needs:nearbyNeeds,demo}=await getNeeds(viewer);
  return <main>
    <SiteHeader/>
    <section className="hero" id="top">
      <div className="hero-copy"><p className="eyebrow"><span/>A community care network</p><h1>A city is its<br/><em>neighbors.</em></h1><p className="lede">We all need a hand sometimes. Notice a small, safe way to help? Lend one when you can. Need support, or see something that calls for a city crew? Put it on the map so the right people can find it.</p><a className="primary-button" href="#explore">Explore the community map <ArrowDown size={17}/></a></div>
      <div className="hero-proof">
        <div className="proof-map" aria-hidden="true"><span className="road r1"/><span className="road r2"/><span className="road r3"/><span className="water"/><i className="pin p1"/><i className="pin p2"/><i className="pin p3"/></div>
        <div className="proof-card"><span className="proof-label">A place to start</span><strong>{demo?"Explore 3 sample reports":nearbyNeeds.length===0?"No reports yet—start with what you notice":`${nearbyNeeds.length} ${nearbyNeeds.length===1?"report":"reports"} on the map`}</strong><span>Help a neighbor · Care for shared spaces · Ask the city</span><small>Illustration only · Real locations are on the map below</small></div>
      </div>
    </section>
    <MapWorkspace initialNeeds={nearbyNeeds} signedIn={Boolean(viewer)} demo={demo}/>
    <section className="principles" id="principles"><div className="principles-intro"><p className="eyebrow">What makes a community</p><h2>We make the<br/>city together.</h2><p>A city is more than people living side by side. We all have days when we can help and days when we need help. A small act of care can make someone else’s day easier—without turning kindness into a service or a competition.</p></div><div className="principle-grid"><article><HeartHandshake/><span>01</span><h3>Help when you can</h3><p>Notice a safe, manageable task? Take it on if you have time, or share it so someone else can. No points, ranks, or pressure to do it all.</p></article><article><ShieldCheck/><span>02</span><h3>The city is here too</h3><p>When a problem needs trained hands—traffic, utilities, hazardous waste, or large limbs—leave it to city crews. Never enter a roadway to help.</p></article><article><UsersRound/><span>03</span><h3>Ask with dignity</h3><p>Needing help is part of life. Neighbor requests keep exact addresses private until the person asking chooses a vetted helper.</p></article></div></section>
    <footer><a className="brand" href="#top"><span className="brand-mark"><HeartHandshake size={19}/></span>CivicHands</a><p>Neighbors taking care of the places we share.</p><p className="footer-note"><Link href="/transparency">Public audit log</Link> · Texas City pilot · <a href="https://github.com/Colten-Covington/CivicHands/issues" target="_blank" rel="noreferrer">Report app/site issues or request features on GitHub</a></p></footer>
  </main>;
}
