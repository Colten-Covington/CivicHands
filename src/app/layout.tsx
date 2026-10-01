import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata={title:"CivicHands — Neighbors caring for home",description:"Report local needs, lend a hand safely, and help care for the places your community shares."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
