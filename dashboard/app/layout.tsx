"use client";

import "../globals.css";
import { useState } from "react";
import BootOverlay from "../components/BootOverlay";

export default function RootLayout({ children }) {
  const [booted, setBooted] = useState(false);

  return (
    <html lang="en">
      <body className="bg-black text-white">
        {/* <BootOverlay onComplete={() => setBooted(true)} /> */}
         {children}
      </body>
    </html>
  );
}

