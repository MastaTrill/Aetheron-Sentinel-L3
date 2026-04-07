// dashboard/components/AlertStream.tsx
"use client";

import AlertFeed from "./AlertFeed";
import type { AlertItem } from "./AlertFeed";

interface Props {
  alerts: any[];
}

export default function AlertStream({ alerts }: Props) {
  const alertItems: AlertItem[] = alerts.map((a) => ({
    type: "alert",
    message: a.msg,
  }));
  return <AlertFeed alerts={alertItems} autoScroll={true} maxItems={200} />;
}
