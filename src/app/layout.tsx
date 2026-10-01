import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans=DM_Sans({variable:"--font-sans",subsets:["latin"]});
const serif=Fraunces({variable:"--font-serif",subsets:["latin"]});
export const metadata: Metadata={title:"CivicHands — Neighbors caring for home",description:"Report local needs, lend a hand safely, and help care for the places your community shares."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>}
