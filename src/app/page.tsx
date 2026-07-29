"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import SentinelStatus from '@/components/SentinelStatus';
import SwapWidget from '@/components/SwapWidget';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Sentinel Dashboard</h1>
      {session ? (
        <div className="mb-8">
          <p className="text-green-600">Authenticated</p>
          <p className="text-sm text-gray-600">User: {session.user.email}</p>
        </div>
      ) : (
        <p className="text-gray-600 mb-8">Not authenticated</p>
      )}
      <SentinelStatus />
      
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Uniswap Trading</h2>
        <SwapWidget />
      </div>
    </main>
  );
}
