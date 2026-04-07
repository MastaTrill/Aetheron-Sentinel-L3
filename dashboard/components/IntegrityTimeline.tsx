"use client";

import React from "react";
import { useSentinelFeed } from "../hooks/useSentinelFeed";

interface TimelineEvent {
  timestamp?: number;
  type?: string;
  message?: string;
  [key: string]: any;
}

export default function IntegrityTimeline() {
  const { events = [] } = useSentinelFeed();

  const sortedEvents: TimelineEvent[] = [...events]
    .filter((event) => event.timestamp)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 20); // Show last 20 events

  return (
    <div className="space-y-2 text-xs">
      {sortedEvents.length === 0 ? (
        <div className="text-zinc-500">No timeline events</div>
      ) : (
        sortedEvents.map((event, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="text-zinc-300">
                {event.type || "Event"} -{" "}
                {event.message || JSON.stringify(event)}
              </div>
              <div className="text-zinc-500 text-[10px]">
                {new Date(event.timestamp || Date.now()).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
