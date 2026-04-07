"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "./uiStore";

export default function RitualOverlay() {
  const mode = useUIStore((s) => s.mode);

  return (
    <AnimatePresence>
      {mode === "Ritual" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="fixed inset-0 pointer-events-none flex items-center justify-center z-[9000]"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
            className="text-6xl font-bold text-amber-500/40 tracking-widest"
          >
            ✦ A E T H E R O N ✦
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

