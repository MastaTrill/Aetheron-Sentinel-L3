"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function BootOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[9999]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold tracking-widest text-emerald-400">
              SENTINEL‑L3
            </h1>
            <p className="text-zinc-500 mt-2 tracking-[0.3em] text-xs">
              AETHERON WATCH PROTOCOL
            </p>
          </motion.div>

          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.5, ease: "easeInOut", delay: 0.5 }}
            className="h-1 bg-emerald-500 mt-10 rounded"
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8 }}
            className="text-xs text-zinc-600 mt-4 font-mono"
          >
            initializing subsystems…
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

