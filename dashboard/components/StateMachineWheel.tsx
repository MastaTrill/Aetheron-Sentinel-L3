"use client";

import { motion } from "framer-motion";

const STATES = ["IDLE", "SCAN", "LOCK", "VERIFY"] as const;

export default function StateMachineWheel() {
  const active = "SCAN"; // placeholder until sentinelStore exists
  const index = STATES.indexOf(active);
  const angle = (index / STATES.length) * 360;

  return (
    <div className="panel p-4">
      <h3 className="text-sm mb-2">STATE MACHINE</h3>
      <div className="relative h-40 flex items-center justify-center">
        <motion.div
          animate={{ rotate: -angle }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="w-28 h-28 rounded-full border border-zinc-700 flex items-center justify-center relative"
        >
          {STATES.map((s, i) => {
            const a = (i / STATES.length) * 2 * Math.PI;
            const x = Math.cos(a) * 40;
            const y = Math.sin(a) * 40;
            const isActive = s === active;

            return (
              <motion.div
                key={s}
                className="absolute text-xs"
                style={{ transform: `translate(${x}px, ${y}px)` }}
                animate={{
                  color: isActive ? "#22c55e" : "#a1a1aa",
                  scale: isActive ? 1.2 : 1,
                }}
              >
                {s}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

