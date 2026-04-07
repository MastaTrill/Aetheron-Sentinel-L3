"use client";

export default function GlyphWrapper({ children }) {
  return (
    <div className="relative">
      <img
        src="/glyphs/aetheron-glyph.svg"
        className="absolute inset-0 w-full h-full opacity-20 glyph-pulse glyph-drift"
      />
      {children}
    </div>
  );
}
