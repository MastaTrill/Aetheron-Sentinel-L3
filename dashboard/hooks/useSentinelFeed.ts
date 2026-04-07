"use client";

import { useEffect, useState } from "react";

export function useSentinelFeed() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  // Default safe values so UI never crashes
  const [threat, setThreat] = useState(Array(5).fill(Array(6).fill(0)));
  const [integrity, setIntegrity] = useState(100);
  const [state, setState] = useState("IDLE");

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:7071");

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Store raw events
        setEvents((prev) => [data, ...prev].slice(0, 50));

        // Update threat grid if present
        if (data.threat) setThreat(data.threat);

        // Update integrity if present
        if (data.integrity !== undefined) setIntegrity(data.integrity);

        // Update state machine if present
        if (data.state) setState(data.state);

      } catch (e) {
        console.error("Failed to parse event", e);
      }
    };

    return () => ws.close();
  }, []);

  return {
    events,
    connected,
    threat,
    integrity,
    state,
  };
}

