import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";

import "./globals.css";


const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["500", "600", "700"],
});

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
});


export const metadata = {
  title: "RX Restaurant Calorie Portal",
  description: "V1 restaurant-facing calorie estimation portal built from the existing Rx nutritional modeling assets.",
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
