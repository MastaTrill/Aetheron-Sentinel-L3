import SentinelStatus from './components/SentinelStatus';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Aetheron Sentinel L3</h1>
        <p className="text-gray-500">Autonomous Governance Dashboard</p>
      </header>
      <main>
        <SentinelStatus />
      </main>
    </div>
  );
}

export default App;
