import { useState, useEffect } from 'react';

// Pre-populated files for the code editor
const mockFiles = {
  'contracts/DecoyHoneypot.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface ISentinelSecurityAuditor {
    function reportSecurityIncident(
        string calldata incidentType,
        uint256 severity,
        string calldata description,
        bytes calldata evidence
    ) external returns (uint256);
}

contract DecoyHoneypot is Ownable {
    ISentinelSecurityAuditor public immutable s_auditor;
    uint256 public decoyBalance;

    mapping(address => bool) public isBlacklisted;

    event DecoyDeposited(address indexed user, uint256 amount);
    event HoneypotTriggered(address indexed attacker, uint256 severity);

    constructor(address auditor, address initialOwner) Ownable(initialOwner) {
        require(auditor != address(0), "Invalid auditor");
        s_auditor = ISentinelSecurityAuditor(auditor);
    }

    function depositDecoy() external payable {
        decoyBalance += msg.value;
        emit DecoyDeposited(msg.sender, msg.value);
    }

    function triggerHoneypotDrain() external {
        require(!isBlacklisted[msg.sender], "Trapped!");
        isBlacklisted[msg.sender] = true;

        s_auditor.reportSecurityIncident(
            "HONEYPOT_EXPLOIT_ATTEMPT",
            9,
            "Bait pool interaction: unauthorized contract drain signature matched",
            abi.encodePacked(msg.sender)
        );

        emit HoneypotTriggered(msg.sender, 9);
    }
}`,
  'contracts/CircuitBreaker.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract CircuitBreaker is Ownable, AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");
    bytes32 public constant SECURITY_ORACLE_ROLE = keccak256("SECURITY_ORACLE_ROLE");

    enum State { CLOSED, OPEN, HALF_OPEN }
    mapping(uint256 => State) public circuitStates;

    uint256 public constant FAILURE_THRESHOLD = 5;
    uint256 public constant TIMEOUT_PERIOD = 3600;

    constructor(address initialOwner) Ownable(initialOwner) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(OPERATOR_ROLE, initialOwner);
    }

    function triggerEmergencyLockdown() external onlyRole(SECURITY_ORACLE_ROLE) {
        _pause();
    }
}`,
  'sentinel/utils.py': `import re

def calculate_threat_score(prompt: str) -> tuple[float, list[str]]:
    score = 0.0
    reasons = []
    
    # Attack vectors matching logic
    if re.search(r'(reentrancy|recursive|call\\.value)', prompt, re.IGNORECASE):
        score += 0.85
        reasons.append("REENTRANCY_ATTACK_SIGNATURE")
        
    if re.search(r'(flash_loan|arbitrage|price_manipulation)', prompt, re.IGNORECASE):
        score += 0.75
        reasons.append("FLASH_LOAN_ARBITRAGE_VECTOR")
        
    if re.search(r'(frontrun|sandwich|mev)', prompt, re.IGNORECASE):
        score += 0.70
        reasons.append("MEV_SANDWICH_SIGNATURE")

    return min(score, 1.0), reasons
`
};

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface APIKeyItem {
  id: string;
  name: string;
  key: string;
  created: string;
  status: 'active' | 'revoked';
}

export default function AIStudioPlayground() {
  const [activeMenu, setActiveMenu] = useState<'playground' | 'apikeys' | 'usage' | 'gallery'>('playground');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'preview' | 'code' | 'lint' | 'settings'>('preview');
  const [lintLogs, setLintLogs] = useState<string[]>([]);
  const [linting, setLinting] = useState(false);

  // Playground state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: 'Aetheron Security Copilot active. I can analyze recent threat logs, explain APY status, or trigger testing events. What security details would you like to verify?',
      timestamp: new Date()
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Code editor state
  const [activeFile, setActiveFile] = useState<keyof typeof mockFiles>('contracts/DecoyHoneypot.sol');

  // Console Logs state
  const [logs, setLogs] = useState<Record<string, any>[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [consoleOpen, setConsoleOpen] = useState(true);

  // Settings state
  const [selectedModel, setSelectedModel] = useState('Gemini 2.0 Flash (Default)');
  const [temperature, setTemperature] = useState(0.2);
  const [systemInstruction, setSystemInstruction] = useState('You are the Aetheron Security Guardian agent. Detect vulnerability signals and guide system remediation patches.');

  // Live Demo/Preview State
  const [demoStatus, setDemoStatus] = useState('System Idle. Ready for transaction monitoring.');
  const [demoLoading, setDemoLoading] = useState(false);
  const [simulatedMetrics, setSimulatedMetrics] = useState({ score: 0.05, status: 'SECURED', apy: 3.15 });

  // API keys state
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([
    { id: '1', name: 'Dev-Key-Sentinel-L3', key: 'sentinel_live_f898...221e', created: '2026-07-20', status: 'active' },
    { id: '2', name: 'Bounty-Audit-Access', key: 'sentinel_live_d732...884f', created: '2026-07-21', status: 'active' }
  ]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Fetch logs on mount/refresh
  const refreshLogs = async () => {
    try {
      const response = await fetch('/api/sentinel/logs?limit=8', {
        headers: { 'X-API-Key': 'fallback-dev-key-do-not-use-in-prod' }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch {
      console.error("Failed to fetch gateway logs");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLogs();
    const interval = setInterval(refreshLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputVal;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = { sender: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setSendingChat(true);

    try {
      const response = await fetch('/api/sentinel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { sender: 'assistant', text: data.response, timestamp: new Date() }]);
      } else {
        throw new Error('API server unavailable');
      }
    } catch {
      setMessages(prev => [...prev, { sender: 'assistant', text: 'Error connecting to the Copilot backend. Please ensure sentinel_gateway_prototype.py is running.', timestamp: new Date() }]);
    }
    setSendingChat(false);
  };

  // Demo simulator commands
  const runPreviewSimulation = async (type: string) => {
    setDemoLoading(true);
    setDemoStatus('Analyzing query details & scoring payload...');
    let prompt = '';
    if (type === 'safe') prompt = 'Transfer 10 tokens to treasury';
    else if (type === 'reentrancy') prompt = 'Execute recursive withdrawal calling MSG.SENDER.CALL triggering reentrancy loop';
    else if (type === 'mev') prompt = 'Broadcast frontrun tx to execute sandwich_attack on pool reserves';

    try {
      const response = await fetch('/api/sentinel/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'fallback-dev-key-do-not-use-in-prod'
        },
        body: JSON.stringify({ prompt })
      });
      if (response.ok) {
        const data = await response.json();
        const score = data.score;
        const reasons = data.reasons || [];
        setDemoStatus(`Transaction analyzed. Threat Score: ${score.toFixed(2)} | Reasons: ${reasons.join(', ') || 'None'}`);
        setSimulatedMetrics({
          score,
          status: score >= 0.75 ? 'ALERT' : 'SECURED',
          apy: score >= 0.75 ? 1.05 : 3.15
        });
        refreshLogs();
      }
    } catch {
      setDemoStatus('Failed to send analysis request.');
    }
    setDemoLoading(false);
  };

  const triggerHoneypotPreview = async () => {
    setDemoLoading(true);
    setDemoStatus('Dispatching unauthorized bait drain event...');
    try {
      const response = await fetch('/api/sentinel/honeypot', { method: 'POST' });
      if (response.ok) {
        setDemoStatus('Honeypot exploit tripped! Incident reported, attacker blacklisted.');
        setSimulatedMetrics({ score: 0.90, status: 'ATTACKED', apy: 0.50 });
        refreshLogs();
      }
    } catch {
      setDemoStatus('Failed to trigger honeypot.');
    }
    setDemoLoading(false);
  };

  const handleCreateAPIKey = () => {
    if (!newKeyName.trim()) return;
    const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const newKey: APIKeyItem = {
      id: String(apiKeys.length + 1),
      name: newKeyName,
      key: `sentinel_live_${randomHex.slice(0, 4)}...${randomHex.slice(12)}`,
      created: new Date().toISOString().split('T')[0],
      status: 'active'
    };
    setApiKeys([...apiKeys, newKey]);
    setNewKeyName('');
    setShowKeyModal(false);
  };

  const revokeAPIKey = (id: string) => {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k));
  };

  const runSecurityLint = async () => {
    setLinting(true);
    setLintLogs([
      '🔍 INITIATING STATIC THREAT CLASSIFIER...',
      '🔍 Scanning Abstract Syntax Tree (AST) invariants...',
      '🔍 Processing semantic vulnerability footprints...'
    ]);
    await new Promise(r => setTimeout(r, 800));

    if (activeFile === 'contracts/DecoyHoneypot.sol') {
      setLintLogs(prev => [
        ...prev,
        '⚠️ [MEDIUM] DecoyHoneypot is using Ownable. Consider upgrading to Ownable2Step to prevent admin key compromise.',
        '🟢 [INFO] s_auditor is marked immutable. State is correctly secured.',
        '🟢 [INFO] triggerHoneypotDrain() requires local blacklisting and raises auditor incidents. Secure by design.'
      ]);
    } else if (activeFile === 'contracts/CircuitBreaker.sol') {
      setLintLogs(prev => [
        ...prev,
        '🟢 [INFO] CircuitBreaker uses keccak256 hash roles. All role modifiers verified.',
        '🟢 [INFO] triggerEmergencyLockdown() is restricted to SECURITY_ORACLE_ROLE. All system boundaries secure.'
      ]);
    } else {
      setLintLogs(prev => [
        ...prev,
        '⚠️ [WARNING] Prompt scanner uses regex signatures. Coordinate vectors could bypass checks. Consider training deep neural ML threat models.'
      ]);
    }
    setLinting(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', minHeight: 'calc(100vh - 80px)', background: '#080d19', color: '#a0aec0' }}>
      
      {/* 1. Left Sidebar Navigation */}
      <nav style={{ background: '#050a12', borderRight: '1px solid #142845', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '25px' }}>
        {/* Logo */}
        <div style={{ fontSize: '1.6rem', color: '#00f5ff', textShadow: '0 0 10px rgba(0, 245, 255, 0.4)', fontWeight: 'bold', marginBottom: '15px' }}>
          ♊
        </div>
        
        {/* Navigation Items */}
        <button 
          onClick={() => setActiveMenu('playground')}
          style={{ background: 'transparent', border: 'none', color: activeMenu === 'playground' ? '#00f5ff' : '#888', cursor: 'pointer', fontSize: '1.5rem', transition: 'color 0.2s', outline: 'none' }}
          title="Playground Workspace"
        >
          💻
          <span style={{ display: 'block', fontSize: '0.6rem', marginTop: '4px' }}>Workspace</span>
        </button>
        <button 
          onClick={() => setActiveMenu('apikeys')}
          style={{ background: 'transparent', border: 'none', color: activeMenu === 'apikeys' ? '#00f5ff' : '#888', cursor: 'pointer', fontSize: '1.5rem', transition: 'color 0.2s', outline: 'none' }}
          title="API Keys"
        >
          🔑
          <span style={{ display: 'block', fontSize: '0.6rem', marginTop: '4px' }}>API Keys</span>
        </button>
        <button 
          onClick={() => setActiveMenu('usage')}
          style={{ background: 'transparent', border: 'none', color: activeMenu === 'usage' ? '#00f5ff' : '#888', cursor: 'pointer', fontSize: '1.5rem', transition: 'color 0.2s', outline: 'none' }}
          title="Usage & Analytics"
        >
          📊
          <span style={{ display: 'block', fontSize: '0.6rem', marginTop: '4px' }}>Usage</span>
        </button>
        <button 
          onClick={() => setActiveMenu('gallery')}
          style={{ background: 'transparent', border: 'none', color: activeMenu === 'gallery' ? '#00f5ff' : '#888', cursor: 'pointer', fontSize: '1.5rem', transition: 'color 0.2s', outline: 'none' }}
          title="Template Gallery"
        >
          🗂️
          <span style={{ display: 'block', fontSize: '0.6rem', marginTop: '4px' }}>Gallery</span>
        </button>
      </nav>

      {/* 2. Main Workspace Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {activeMenu === 'playground' && (
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', flex: 1, overflow: 'hidden' }}>
            
            {/* A. Playground Left Panel: AI Chat Assistant */}
            <div style={{ borderRight: '1px solid #142845', display: 'flex', flexDirection: 'column', background: '#0b1120', overflow: 'hidden' }}>
              <div style={{ padding: '15px 20px', borderBottom: '1px solid #142845', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '1px' }}>🤖 SECURITY COPILOT</span>
                <span style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>V1.0</span>
              </div>

              {/* Chat Thread */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {messages.map((m, idx) => (
                  <div key={idx} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{
                      background: m.sender === 'user' ? '#1e3a8a' : '#142035',
                      color: m.sender === 'user' ? '#fff' : '#c3dae8',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '0.82rem',
                      border: m.sender === 'user' ? '1px solid #2563eb' : '1px solid #1e2e4a',
                      lineHeight: '1.4'
                    }}>
                      {m.text}
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'block', marginTop: '4px', textAlign: m.sender === 'user' ? 'right' : 'left' }}>
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Suggestions chips */}
              <div style={{ padding: '10px 15px', display: 'flex', gap: '8px', overflowX: 'auto', borderTop: '1px solid #142845', background: '#090e1a' }}>
                <button 
                  onClick={() => handleSendMessage('Explain Staking APY scaling')} 
                  style={{ background: '#12253f', border: '1px solid #1a365d', color: '#38bdf8', padding: '4px 10px', borderRadius: '15px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  💡 APY Rule
                </button>
                <button 
                  onClick={() => handleSendMessage('Detail the Circuit Breaker lockdown trigger')} 
                  style={{ background: '#12253f', border: '1px solid #1a365d', color: '#38bdf8', padding: '4px 10px', borderRadius: '15px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  💡 Lockdown
                </button>
                <button 
                  onClick={() => handleSendMessage('Check latest threat logs')} 
                  style={{ background: '#12253f', border: '1px solid #1a365d', color: '#38bdf8', padding: '4px 10px', borderRadius: '15px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  💡 Threat Log
                </button>
              </div>

              {/* Input box */}
              <div style={{ padding: '15px', borderTop: '1px solid #142845', background: '#0b1120' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Ask security copilot..."
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{ flex: 1, padding: '10px', fontSize: '0.85rem', backgroundColor: '#02060d', border: '1px solid #102a45', color: '#fff', borderRadius: '6px' }}
                  />
                  <button 
                    onClick={() => handleSendMessage()}
                    disabled={sendingChat}
                    className="btn-primary"
                    style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                  >
                    {sendingChat ? '...' : 'SEND'}
                  </button>
                </div>
              </div>
            </div>

            {/* B. Playground Right Panel: split editor/preview tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#090e1a' }}>
              
              {/* Workspace Tab Bar */}
              <div style={{ borderBottom: '1px solid #142845', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#060a12' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setActiveWorkspaceTab('preview')}
                    style={{
                      background: activeWorkspaceTab === 'preview' ? '#112240' : 'transparent',
                      color: activeWorkspaceTab === 'preview' ? '#00f5ff' : '#888',
                      border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    🖥️ PREVIEW SCREEN
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab('code')}
                    style={{
                      background: activeWorkspaceTab === 'code' ? '#112240' : 'transparent',
                      color: activeWorkspaceTab === 'code' ? '#00f5ff' : '#888',
                      border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    📝 SOURCE CODE
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab('lint')}
                    style={{
                      background: activeWorkspaceTab === 'lint' ? '#112240' : 'transparent',
                      color: activeWorkspaceTab === 'lint' ? '#00f5ff' : '#888',
                      border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    🛡️ SECURITY LINT
                  </button>
                  <button
                    onClick={() => setActiveWorkspaceTab('settings')}
                    style={{
                      background: activeWorkspaceTab === 'settings' ? '#112240' : 'transparent',
                      color: activeWorkspaceTab === 'settings' ? '#00f5ff' : '#888',
                      border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    ⚙️ MODEL SETTINGS
                  </button>
                </div>
              </div>

              {/* Workspace Content Viewport */}
              <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                
                {/* 1. Preview Panel */}
                {activeWorkspaceTab === 'preview' && (
                  <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Simulated Browser Frame Mockup */}
                    <div style={{ border: '1px solid #1e3a5f', borderRadius: '8px', background: '#030812', overflow: 'hidden' }}>
                      {/* Address bar */}
                      <div style={{ background: '#0b162a', padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #142845' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
                        </div>
                        <div style={{ flex: 1, background: '#02060d', borderRadius: '4px', border: '1px solid #1d3354', padding: '3px 12px', fontSize: '0.75rem', color: '#6884ad', fontFamily: 'monospace' }}>
                          http://localhost:5173/sentinel/
                        </div>
                        <button onClick={refreshLogs} style={{ background: 'none', border: 'none', color: '#00f5ff', cursor: 'pointer', fontSize: '0.8rem' }}>🔄 Reload</button>
                      </div>

                      {/* Mockup IFrame Render Content */}
                      <div style={{ padding: '20px', background: '#040914' }}>
                        
                        {/* Status bar */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                          <div style={{ background: '#09152b', border: '1px solid #172d54', padding: '12px', borderRadius: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#5b83ad' }}>SECURITY LEVEL</span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: simulatedMetrics.status === 'SECURED' ? '#00ffaa' : '#ef4444' }}>
                              {simulatedMetrics.status} ({Math.round((1 - simulatedMetrics.score) * 100)}%)
                            </div>
                          </div>
                          <div style={{ background: '#09152b', border: '1px solid #172d54', padding: '12px', borderRadius: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#5b83ad' }}>APY SCALE</span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00f5ff' }}>{simulatedMetrics.apy.toFixed(2)}%</div>
                          </div>
                          <div style={{ background: '#09152b', border: '1px solid #172d54', padding: '12px', borderRadius: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#5b83ad' }}>GATEWAY SIGNAL</span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>ONLINE</div>
                          </div>
                        </div>

                        {/* Interactive trigger controls */}
                        <div style={{ background: '#081021', border: '1px dashed #1c365d', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#fff', letterSpacing: '0.5px' }}>⚡ SIMULATION CONTROL DECK</h4>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button onClick={() => runPreviewSimulation('safe')} disabled={demoLoading} style={{ background: '#1d3557', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                              Simulate Safe Prompt
                            </button>
                            <button onClick={() => runPreviewSimulation('reentrancy')} disabled={demoLoading} style={{ background: '#a81c1c', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                              Simulate Reentrancy Exploit
                            </button>
                            <button onClick={() => runPreviewSimulation('mev')} disabled={demoLoading} style={{ background: '#e65c00', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                              Simulate MEV Sandwich
                            </button>
                            <button onClick={triggerHoneypotPreview} disabled={demoLoading} style={{ background: '#831843', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                              Trigger Honeypot Exploit
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#aaa', minHeight: '30px', borderTop: '1px solid #142845', paddingTop: '10px', fontFamily: 'monospace' }}>
                          Status: {demoStatus}
                        </div>

                      </div>
                    </div>

                  </div>
                )}

                {/* 2. Code Editor Panel */}
                {activeWorkspaceTab === 'code' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', height: '100%' }}>
                    {/* File tree */}
                    <div style={{ borderRight: '1px solid #142845', background: '#070c18', padding: '15px' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#566e94', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '0.5px' }}>EXPLORER</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {Object.keys(mockFiles).map((file) => (
                          <button
                            key={file}
                            onClick={() => setActiveFile(file as keyof typeof mockFiles)}
                            style={{
                              background: activeFile === file ? '#112240' : 'transparent',
                              border: 'none',
                              color: activeFile === file ? '#00f5ff' : '#a0aec0',
                              textAlign: 'left',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontFamily: 'monospace',
                              cursor: 'pointer',
                              width: '100%'
                            }}
                          >
                            📄 {file.split('/').pop()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Monaco mockup editor */}
                    <div style={{ background: '#030812', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: '#0b1426', padding: '8px 20px', fontSize: '0.75rem', fontFamily: 'monospace', borderBottom: '1px solid #142845', color: '#6884ad' }}>
                        {activeFile}
                      </div>
                      <pre style={{
                        margin: 0,
                        padding: '20px',
                        overflowX: 'auto',
                        fontFamily: 'Consolas, Monaco, monospace',
                        fontSize: '0.8rem',
                        lineHeight: '1.5',
                        color: '#60d1fa',
                        background: '#030812',
                        textAlign: 'left'
                      }}>
                        <code>
                          {mockFiles[activeFile]}
                        </code>
                      </pre>
                    </div>
                  </div>
                )}

                {/* 2.5 Security Linter Panel */}
                {activeWorkspaceTab === 'lint' && (
                  <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>🛡️ STATIC SECURITY CLASSIFIER</h3>
                    <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Scan the active contract file in the editor workspace for reentrancy, access leaks, or cryptographic anomalies.</p>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button 
                        onClick={runSecurityLint} 
                        disabled={linting} 
                        className="btn-primary" 
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        {linting ? 'SCANNING...' : 'RUN STATIC ANALYSIS'}
                      </button>
                      <span style={{ fontSize: '0.8rem', color: '#6884ad' }}>Active target: {activeFile}</span>
                    </div>

                    <div style={{ background: '#02060d', border: '1px solid #142845', padding: '15px', borderRadius: '6px', minHeight: '160px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#00ffaa', lineHeight: '1.6' }}>
                      {lintLogs.length > 0 ? (
                        lintLogs.map((log, idx) => (
                          <div key={idx} style={{
                            color: log.includes('⚠️') ? '#ffb84d' : log.includes('🟢') ? '#00ffaa' : '#6884ad',
                            marginBottom: '6px'
                          }}>
                            {log}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#566e94' }}>Click "RUN STATIC ANALYSIS" to evaluate the file invariants.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Settings Drawer Panel */}
                {activeWorkspaceTab === 'settings' && (
                  <div style={{ padding: '25px', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '1rem' }}>SYSTEM CONFIGURATION</h3>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#566e94', marginBottom: '8px', fontWeight: 'bold' }}>MODEL SELECTION</label>
                      <select 
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#02060d', border: '1px solid #102a45', color: '#fff', borderRadius: '6px' }}
                      >
                        <option>Gemini 2.0 Flash (Default)</option>
                        <option>Gemini 1.5 Pro</option>
                        <option>Gemini 3.5 Flash</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#566e94', marginBottom: '8px', fontWeight: 'bold' }}>SYSTEM INSTRUCTIONS</label>
                      <textarea
                        value={systemInstruction}
                        onChange={(e) => setSystemInstruction(e.target.value)}
                        rows={4}
                        style={{ width: '100%', background: '#02060d', border: '1px solid #102a45', color: '#fff', padding: '10px', borderRadius: '6px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.75rem', color: '#566e94', fontWeight: 'bold' }}>TEMPERATURE</label>
                        <span style={{ fontSize: '0.75rem', color: '#00f5ff', fontWeight: 'bold' }}>{temperature}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        value={temperature} 
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Collapse Console logs panel */}
              <div style={{ borderTop: '1px solid #142845', background: '#050a12' }}>
                <div 
                  onClick={() => setConsoleOpen(!consoleOpen)} 
                  style={{ padding: '8px 20px', background: '#0b162c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: consoleOpen ? '1px solid #142845' : 'none' }}
                >
                  <span style={{ fontSize: '0.7rem', color: '#5b83ad', fontWeight: 'bold', letterSpacing: '0.5px' }}>⌨️ TERMINAL GATEWAY LOGGER</span>
                  <span style={{ fontSize: '0.7rem', color: '#5b83ad' }}>{consoleOpen ? 'Collapse [▼]' : 'Expand [▲]'}</span>
                </div>

                {consoleOpen && (
                  <div style={{ height: '140px', overflowY: 'auto', padding: '15px 20px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#00ffaa', background: '#030812', textAlign: 'left', lineHeight: '1.6' }}>
                    {logs.length > 0 ? (
                      logs.map((log, idx) => (
                        <div key={idx} style={{ marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                          <span style={{ color: '#888' }}>[{log.timestamp?.slice(11, 19)}]</span>{' '}
                          <span style={{ color: '#ffb84d' }}>IP: {log.source_ip}</span>{' '}
                          <span>Score: {log.score?.toFixed(2)}</span>{' '}
                          <span style={{ color: '#38bdf8' }}>Prompt: {log.prompt}</span>{' '}
                          {log.reasons?.length > 0 && <span style={{ color: '#ef4444' }}>({log.reasons.join(', ')})</span>}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#5b83ad' }}>Waiting for threat activity logs...</div>
                    )}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 2. API Keys Menu view */}
        {activeMenu === 'apikeys' && (
          <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', width: '100%', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #142845', paddingBottom: '15px', marginBottom: '25px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>API KEYS</h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Secure credentials for interacting with the Aetheron Sentinel Gateway APIs.</div>
              </div>
              <button onClick={() => setShowKeyModal(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                CREATE API KEY
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e3a5f', background: '#0b1426', color: '#566e94' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>KEY NAME</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>API KEY</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>CREATED AT</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>STATUS</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #142845', background: '#060d1a' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#fff' }}>{item.name}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}><code>{item.key}</code></td>
                    <td style={{ padding: '12px', color: '#888' }}>{item.created}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        background: item.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: item.status === 'active' ? '#10b981' : '#ef4444',
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold'
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {item.status === 'active' && (
                        <button 
                          onClick={() => revokeAPIKey(item.id)}
                          style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          REVOKE
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Modal dialog */}
            {showKeyModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ background: '#091326', border: '1px solid #1e3b68', padding: '25px', borderRadius: '8px', width: '400px' }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#fff' }}>Generate New API Key</h3>
                  <input
                    type="text"
                    placeholder="Enter key name..."
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    style={{ width: '100%', padding: '10px', marginBottom: '20px', backgroundColor: '#02060d', border: '1px solid #102a45', color: '#fff', borderRadius: '6px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={() => setShowKeyModal(false)} className="btn-secondary" style={{ padding: '6px 12px' }}>CANCEL</button>
                    <button onClick={handleCreateAPIKey} className="btn-primary" style={{ padding: '6px 12px' }}>GENERATE</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Usage & Charts Mock View */}
        {activeMenu === 'usage' && (
          <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', width: '100%', textAlign: 'left' }}>
            <h2 style={{ borderBottom: '1px solid #142845', paddingBottom: '15px', marginBottom: '25px', color: '#fff' }}>USAGE ANALYTICS</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: '#060d1a', border: '1px solid #142845', padding: '20px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '0.85rem' }}>REQUEST COUNT VOLUME (LAST 24H)</h4>
                <div style={{ height: '120px', background: '#030812', borderRadius: '6px', border: '1px solid #102a45', display: 'flex', alignItems: 'flex-end', padding: '10px', gap: '8px' }}>
                  {logs.length > 0 ? (
                    logs.slice(0, 12).reverse().map((log, i) => {
                      const h = Math.round((log.score || 0.1) * 80) + 15;
                      return <div key={i} style={{ flex: 1, height: `${h}%`, background: '#00f5ff', borderRadius: '2px' }} title={`Score: ${log.score}`}></div>;
                    })
                  ) : (
                    [30, 45, 60, 25, 40, 80].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h}%`, background: '#00f5ff', borderRadius: '2px' }}></div>
                    ))
                  )}
                </div>
              </div>
              <div style={{ background: '#060d1a', border: '1px solid #142845', padding: '20px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '0.85rem' }}>GATEWAY LATENCY SCALE (MS)</h4>
                <div style={{ height: '120px', background: '#030812', borderRadius: '6px', border: '1px solid #102a45', display: 'flex', alignItems: 'flex-end', padding: '10px', gap: '8px' }}>
                  {logs.length > 0 ? (
                    logs.slice(0, 12).reverse().map((log, i) => {
                      const h = Math.round((log.score || 0.1) * 40) + 10;
                      return <div key={i} style={{ flex: 1, height: `${h * 2}%`, background: '#00ffaa', borderRadius: '2px' }} title={`Latency: ${h * 2}ms`}></div>;
                    })
                  ) : (
                    [12, 14, 15, 12, 18, 35].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h * 2}%`, background: '#00ffaa', borderRadius: '2px' }}></div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div style={{ background: '#060d1a', border: '1px solid #142845', padding: '20px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '0.85rem' }}>AGGREGATE STATS</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div style={{ background: '#030812', padding: '12px', borderRadius: '6px', border: '1px solid #102a45' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>INPUT TOKENS</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>14,849,202</div>
                </div>
                <div style={{ background: '#030812', padding: '12px', borderRadius: '6px', border: '1px solid #102a45' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>OUTPUT TOKENS</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>42,109,332</div>
                </div>
                <div style={{ background: '#030812', padding: '12px', borderRadius: '6px', border: '1px solid #102a45' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>AVG SUCCESS RATE</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00ffaa' }}>99.98%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. App Showcase Gallery Mock View */}
        {activeMenu === 'gallery' && (
          <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', width: '100%', textAlign: 'left' }}>
            <h2 style={{ borderBottom: '1px solid #142845', paddingBottom: '15px', marginBottom: '25px', color: '#fff' }}>TEMPLATE GALLERY</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ background: '#060d1a', border: '1px solid #142845', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', fontWeight: 'bold' }}>UTILITY</span>
                <h4 style={{ margin: 0, color: '#fff' }}>Bridge Watchdog Agent</h4>
                <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0 }}>Monitors logs on AetheronBridge contract and triggers CircuitBreaker lockdown.</p>
                <button className="btn-secondary" style={{ marginTop: 'auto', padding: '6px' }}>REMIX TEMPLATE</button>
              </div>
              <div style={{ background: '#060d1a', border: '1px solid #142845', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', fontWeight: 'bold' }}>DEFENSE</span>
                <h4 style={{ margin: 0, color: '#fff' }}>Honeypot Lure Auditor</h4>
                <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0 }}>Configures the DecoyHoneypot and verifies attacker addresses on blacklist maps.</p>
                <button className="btn-secondary" style={{ marginTop: 'auto', padding: '6px' }}>REMIX TEMPLATE</button>
              </div>
              <div style={{ background: '#060d1a', border: '1px solid #142845', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', fontWeight: 'bold' }}>SECURITY</span>
                <h4 style={{ margin: 0, color: '#fff' }}>APY Threat Regulator</h4>
                <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0 }}>Dynamically scales SentinelStaking APY based on security score updates.</p>
                <button className="btn-secondary" style={{ marginTop: 'auto', padding: '6px' }}>REMIX TEMPLATE</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
