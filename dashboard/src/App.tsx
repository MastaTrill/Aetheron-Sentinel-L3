import { useEffect, useState } from 'react';
import { supabase } from './main';
import SwapWidget from './components/SwapWidget';
import InstitutionalPortal from './components/InstitutionalPortal';
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

  // Real-time alerting state
  const [latestAlert, setLatestAlert] = useState<SecurityEvent | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // API Access state
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Live Gateway Logs state
  const [gatewayLogs, setGatewayLogs] = useState<Record<string, any>[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const fetchGatewayLogs = async () => {
    setFetchingLogs(true);
    setLogsError(null);
    try {
      const response = await fetch('/api/sentinel/logs?limit=5', {
        headers: {
          'X-API-Key': 'fallback-dev-key-do-not-use-in-prod',
        },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setGatewayLogs(data.logs || []);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setLogsError(errMsg);
    }
    setFetchingLogs(false);
  };

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

    // Subscribe to real-time inserts
    const channel = supabase
      .channel('public:security_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_events' },
        payload => {
          const newEvent = payload.new as SecurityEvent;
          setEvents(prev => [newEvent, ...prev].slice(0, 10));

          if (newEvent.risk_score > 7) {
            setLatestAlert(newEvent);
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const generateApiKey = () => {
    // Generate a mock API key
    const mockKey = 'sk_test_' + crypto.randomUUID().replace(/-/g, '');
    setApiKey(mockKey);
  };

  return (
    <>
      {showAlert && latestAlert && (
        <div className="toast toast-critical">
          <h4>Critical Security Alert!</h4>
          <p>
            High risk event ({latestAlert.risk_score}/10) detected on {latestAlert.chain_id}
          </p>
          <code>Tx: {latestAlert.tx_hash.slice(0, 10)}...</code>
        </div>
      )}

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
              {events.map(event => (
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

      <section id="gateway-logs" className="api-section">
        <h2>🛡️ Live Gateway Audit Logs</h2>
        <p>Direct API query to the Sentinel gateway threat logging database.</p>
        <button className="btn-primary" onClick={fetchGatewayLogs} disabled={fetchingLogs}>
          {fetchingLogs ? 'Fetching...' : 'Fetch Live Logs'}
        </button>
        {logsError && <p style={{ color: 'red', marginTop: '10px' }}>Error: {logsError}</p>}
        {gatewayLogs.length > 0 ? (
          <ul
            className="logs-list"
            style={{
              marginTop: '20px',
              textAlign: 'left',
              background: '#111',
              padding: '15px',
              borderRadius: '6px',
              listStyleType: 'none',
            }}
          >
            {gatewayLogs.map((log, index) => (
              <li
                key={index}
                style={{
                  marginBottom: '10px',
                  borderBottom: '1px solid #222',
                  paddingBottom: '10px',
                }}
              >
                <strong>[{new Date(log.timestamp).toLocaleTimeString()}]</strong> Threat Score:{' '}
                <span style={{ color: log.score >= 0.75 ? '#ff4a4a' : '#4aff4a' }}>
                  {log.score.toFixed(2)}
                </span>
                <br />
                <em style={{ color: '#aaa' }}>Reasons:</em> {log.reasons.join(', ') || 'None'}
                <br />
                <code style={{ fontSize: '12px' }}>Payload: {log.prompt.slice(0, 100)}...</code>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: '10px', color: '#666' }}>No gateway logs fetched yet.</p>
        )}
      </section>

      <section id="api-access" className="api-section">
        <h2>Developer API Access</h2>
        <p>Integrate Sentinel L3 real-time alerts into your own applications.</p>

        {!apiKey ? (
          <button className="btn-primary" onClick={generateApiKey}>
            Generate API Key
          </button>
        ) : (
          <div className="api-key-container">
            <div className="api-key-box">
              <span>Your API Key:</span>
              <code>{apiKey}</code>
            </div>

            <div className="code-snippet">
              <h4>cURL Example</h4>
              <pre>
                <code>{`curl -X GET "https://api.sentinel-l3.io/v1/events?limit=10" \\
  -H "Authorization: Bearer \${apiKey}"`}</code>
              </pre>
            </div>
          </div>
        )}
      </section>

      <section id="swap-section" className="swap-section">
        <SwapWidget />
      </section>

      <section id="institutional-section">
        <InstitutionalPortal />
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
