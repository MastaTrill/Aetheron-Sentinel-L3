import { createClient } from '@/lib/supabase/server';
import SentinelStatus from '@/components/SentinelStatus';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

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
    </main>
  );
}
