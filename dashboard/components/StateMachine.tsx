"use client";
import { useState, useEffect } from "react";
import styles from "./stateMachine.module.css";

type MachineState = "IDLE" | "SCANNING" | "LOCK" | "BREACH" | "RECOVERY";

export default function StateMachine() {
  const [state, setState] = useState<MachineState>("IDLE");

  useEffect(() => {
    const sequence: MachineState[] = [
      "IDLE",
      "SCANNING",
      "LOCK",
      "BREACH",
      "RECOVERY",
    ];

    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % sequence.length;
      setState(sequence[i]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.shape} ${styles[state.toLowerCase()]}`} />
      <div className={styles.label}>{state}</div>
    </div>
  );
}

