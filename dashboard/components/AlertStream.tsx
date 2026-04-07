// dashboard/components/AlertStream.tsx
'use client';

import AlertFeed from './AlertFeed';
import type { AlertItem } from './AlertFeed';

interface Props {
  events: AlertItem[];
}

export default function AlertStream({ events }: Props) {
  return <AlertFeed alerts={events} autoScroll={true} maxItems={200} />;
}
