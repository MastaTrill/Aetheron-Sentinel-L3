"use client";

import { useEffect, useState } from "react";

export function useSentinelFeed() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  // Default safe values so UI never crashes
  const [threats, setThreats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [states, setStates] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Store raw events
        setEvents((prev) => [data, ...prev].slice(0, 50));

        // Handle different event types
        if (data.type === "threat") {
          setThreats((prev) => [data, ...prev].slice(0, 10));
        } else if (data.type === "alert") {
          setAlerts((prev) => [data, ...prev].slice(0, 20));
        } else if (data.type === "state") {
          setStates((prev) => [data, ...prev].slice(0, 10));
        }
      } catch (e) {
        console.error("Failed to parse event", e);
      }
    };

    return () => ws.close();
  }, []);

  return {
    events,
    connected,
    threats,
    alerts,
    states,
  };
}
