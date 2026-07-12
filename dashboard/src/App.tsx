import { useEffect, useState } from 'react';
import { supabase } from './main';
import './App.css';

interface SecurityEvent {
  id: number;
  tx_hash: string;
  sender: string;
  target: string;
  risk_score: number;
  chain_id: string;
  timestamp: string;
  validated: boolean;
}

function App() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching events:', error);
        setError(error.message);
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    }
    fetchEvents();
  }, []);

  return (
    <>
      <section id="center">
        <div>
          <h1>Aetheron Sentinel L3</h1>
          <p>Real-time security event monitoring</p>
        </div>

        {error && <p style={{ color: 'red' }}>Error: {error}</p>}

        {loading ? (
          <p>Loading events...</p>
        ) : events.length > 0 ? (
          <table className="events-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Sender</th>
                <th>Target</th>
                <th>Risk</th>
                <th>Chain</th>
                <th>Validated</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.tx_hash.slice(0, 10)}...</td>
                  <td>{event.sender.slice(0, 8)}...</td>
                  <td>{event.target.slice(0, 8)}...</td>
                  <td>{event.risk_score}</td>
                  <td>{event.chain_id}</td>
                  <td>{event.validated ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No security events found. The Sentinel is watching...</p>
        )}
      </section>

      <section id="next-steps">
        <div id="docs">
          <h2>Documentation</h2>
          <p>Security events are indexed from the Aetheron Sentinel L3 blockchain</p>
        </div>
      </section>
    </>
  );
}

export default App;