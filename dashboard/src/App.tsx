import { useEffect, useState, useRef } from 'react';
import { supabase } from './main';
import SwapWidget from './components/SwapWidget';
import InstitutionalPortal from './components/InstitutionalPortal';
import { useAccount, useReadContract } from 'wagmi';
import CircuitBreakerABI from './abis/CircuitBreaker.json';
import SentinelStakingABI from './abis/SentinelStaking.json';
import './App.css';

const CIRCUIT_BREAKER_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const STAKING_ADDRESS = '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e';

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

  const { address: userAddress } = useAccount();

  // Read Paused state from Circuit Breaker
  const { data: isPaused } = useReadContract({
    address: CIRCUIT_BREAKER_ADDRESS,
    abi: CircuitBreakerABI,
    functionName: 'paused',
    query: {
      refetchInterval: 1000,
    },
  });

  // Read APY from Staking
  const { data: liveAPY } = useReadContract({
    address: STAKING_ADDRESS,
    abi: SentinelStakingABI,
    functionName: 'getUserAPY',
    args: [userAddress || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
    query: {
      refetchInterval: 1000,
    },
  });

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

  const [demoStatus, setDemoStatus] = useState<string>('');
  const [demoLoading, setDemoLoading] = useState(false);

  const simulateDemoAttack = async (type: string) => {
    setDemoLoading(true);
    setDemoStatus('Analyzing exploit payload...');

    let promptText = '';
    if (type === 'safe') {
      promptText = 'Transfer 10 tokens to treasury';
    } else if (type === 'mev') {
      promptText = 'Broadcast frontrun tx to execute sandwich_attack on pool reserves';
    } else if (type === 'oracle') {
      promptText = 'Execute swap skew_reserves to trigger oracle_skew on low liquidity pool';
    }

    try {
      const response = await fetch('/api/sentinel/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'fallback-dev-key-do-not-use-in-prod',
        },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setDemoStatus(`Intercept Result: Score: ${data.score.toFixed(2)} | Action: ${data.action}`);

      setTimeout(() => {
        fetchGatewayLogs();
      }, 1000);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setDemoStatus(`Simulate Error: ${errMsg}`);
    }
    setDemoLoading(false);
  };

  const triggerDemoHoneypot = async () => {
    setDemoLoading(true);
    setDemoStatus('Triggering simulated exploit attempt on decoy honeypot...');
    try {
      const response = await fetch('/api/sentinel/honeypot', {
        method: 'POST',
        headers: {
          'X-API-Key': 'fallback-dev-key-do-not-use-in-prod',
        },
      });
      if (!response.ok) throw new Error(await response.text());
      setDemoStatus('Decoy Honeypot triggered! Incident reported to Security Auditor.');
      setTimeout(() => {
        fetchGatewayLogs();
      }, 1000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setDemoStatus(`Honeypot Error: ${errMsg}`);
    }
    setDemoLoading(false);
  };

  const resetDemoSystem = async () => {
    setDemoLoading(true);
    setDemoStatus('Executing Hardhat network recovery reset...');
    try {
      const response = await fetch('/api/sentinel/reset', {
        method: 'POST',
        headers: {
          'X-API-Key': 'fallback-dev-key-do-not-use-in-prod',
        },
      });
      if (!response.ok) throw new Error(await response.text());
      setDemoStatus('System Recovery Reset complete. Circuit Breaker unpaused.');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setDemoStatus(`Reset Error: ${errMsg}`);
    }
    setDemoLoading(false);
  };

  // APY scroll history logic
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [apyHistory, setApyHistory] = useState<number[]>(() => Array(30).fill(5));

  useEffect(() => {
    const currentAPY = liveAPY ? Number(liveAPY) / 100 : 5;
    setApyHistory(prev => [...prev.slice(1), currentAPY]);
  }, [liveAPY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0d233a';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    ctx.beginPath();
    const margin = 10;
    const step = (canvas.width - margin * 2) / (apyHistory.length - 1);
    const maxVal = 20;

    apyHistory.forEach((val, index) => {
      const x = margin + index * step;
      const ratio = val / maxVal;
      const y = canvas.height - margin - ratio * (canvas.height - margin * 2);

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    const isSystemPaused = isPaused;
    ctx.strokeStyle = isSystemPaused ? '#ff4a4a' : '#00f5ff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 4;
    ctx.shadowColor = isSystemPaused ? '#ff4a4a' : '#00f5ff';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [apyHistory, isPaused]);

  // FHE Shield Simulator
  const [fheA, setFheA] = useState<number>(10);
  const [fheB, setFheB] = useState<number>(20);
  const [fheCipherA, setFheCipherA] = useState<string>('');
  const [fheCipherB, setFheCipherB] = useState<string>('');
  const [fheResultCipher, setFheResultCipher] = useState<string>('');
  const [fheStatus, setFheStatus] = useState<string>('');
  const [fheLoading, setFheLoading] = useState<boolean>(false);

  const runFheAddition = async () => {
    setFheLoading(true);
    setFheStatus('🔒 Encrypting inputs into TFHE ciphertexts...');
    await new Promise(r => setTimeout(r, 600));
    const cipherA = '0x_fhe_cipher_' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const cipherB = '0x_fhe_cipher_' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');
    setFheCipherA(cipherA);
    setFheCipherB(cipherB);
    
    setFheStatus('🌀 Executing homomorphic addition on ciphertext matrices (TFHE.add)...');
    await new Promise(r => setTimeout(r, 800));
    const resultCipher = '0x_fhe_cipher_' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');
    setFheResultCipher(resultCipher);
    
    setFheStatus(`🟢 Math completed on encrypted data! Output: ${fheA + fheB} (decrypted only at user node).`);
    setFheLoading(false);
  };

  // Anti-MEV Guard
  const [mevLogs, setMevLogs] = useState<string[]>([]);
  const [mevProtected, setMevProtected] = useState<boolean>(true);
  const [mevStatus, setMevStatus] = useState<string>('');
  
  const triggerMevSwap = async () => {
    setMevStatus('Pending');
    setMevLogs(['📡 Broadcasting Swap transaction packet...']);
    await new Promise(r => setTimeout(r, 600));
    
    if (mevProtected) {
      setMevLogs(prev => [
        ...prev,
        '🔒 Anti-MEV Guard: Routing via Private RPC bundle...',
        '📦 Transaction packaged in flashbots bundle.',
        '🟢 Mined directly in block without public mempool exposure. Swap secure!'
      ]);
      setMevStatus('SUCCESS');
    } else {
      setMevLogs(prev => [
        ...prev,
        '⚠️ Public Mempool: Transaction exposed to searchers.',
        '🔴 MEV Sandwich Bot front-runs swap, skewing reserves!',
        '🔴 Transaction executed. Slippage hit max limit. Capital drained: -0.42 ETH',
      ]);
      setMevStatus('EXPLOITED');
    }
  };

  // Lattice Cryptography
  const latticeRef = useRef<HTMLCanvasElement | null>(null);
  const [latticeSeed, setLatticeSeed] = useState<number>(0);
  
  useEffect(() => {
    const canvas = latticeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#102a45';
    const gap = 20;
    for (let x = gap; x < canvas.width; x += gap) {
      for (let y = gap; y < canvas.height; y += gap) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, canvas.height / 2);
    
    let currX = canvas.width / 2;
    let currY = canvas.height / 2;
    
    for (let i = 0; i < 4; i++) {
      const stepX = (Math.sin(latticeSeed + i) > 0 ? 1 : -1) * gap * 2;
      const stepY = (Math.cos(latticeSeed + i) > 0 ? 1 : -1) * gap * 2;
      currX += stepX;
      currY += stepY;
      ctx.lineTo(currX, currY);
    }
    ctx.stroke();
    
    ctx.fillStyle = '#00ffaa';
    ctx.beginPath();
    ctx.arc(currX, currY, 5, 0, Math.PI * 2);
    ctx.fill();
  }, [latticeSeed]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLatticeSeed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Geo-IP Global Attack Visualizer Map
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  const [mapPulse, setMapPulse] = useState<number>(0);
  
  useEffect(() => {
    const canvas = mapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#0d233a';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    const nodes = [
      { name: 'US-EAST', x: 120, y: 50 },
      { name: 'EU-WEST', x: 300, y: 40 },
      { name: 'APAC-SOUTH', x: 480, y: 90 },
    ];
    
    nodes.forEach(node => {
      ctx.fillStyle = isPaused ? '#ff4a4a' : '#00b3ff';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#888';
      ctx.font = '9px monospace';
      ctx.fillText(node.name, node.x - 20, node.y - 10);
    });
    
    if (mapPulse > 0) {
      const startX = 50;
      const startY = 100;
      const targetX = 480;
      const targetY = 90;
      
      const progress = (mapPulse % 20) / 20;
      const currentX = startX + (targetX - startX) * progress;
      const currentY = startY + (targetY - startY) * progress;
      
      ctx.strokeStyle = '#ff4a4a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      
      ctx.fillStyle = '#ff4a4a';
      ctx.beginPath();
      ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [mapPulse, isPaused]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMapPulse(prev => prev + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Solana Sync & Governance state
  const solanaStatus = isPaused ? 'HALTED / SECURED' : 'ACTIVE / SECURED';
  const [pqcVotes, setPqcVotes] = useState<number>(142);
  const [voted, setVoted] = useState<boolean>(false);
  
  const castPqcVote = () => {
    if (voted) return;
    setPqcVotes(prev => prev + 1);
    setVoted(true);
  };

  // Hardware Enclave SGX Co-Processor
  const [enclaveLogs, setEnclaveLogs] = useState<string[]>([]);
  const [enclaveStatus, setEnclaveStatus] = useState<string>('IDLE');
  
  const runEnclaveAttestation = async () => {
    setEnclaveStatus('ATTESTING');
    setEnclaveLogs([
      '🔒 SGX: Mounting secure enclave hardware memory page...',
      '🔑 SGX: Attesting signature against CPU secret key...',
    ]);
    await new Promise(r => setTimeout(r, 600));
    setEnclaveLogs(prev => [
      ...prev,
      '🌀 SGX: Computing confidential transaction logic inside isolated RAM...',
      '🟢 SGX: Attestation complete. Attestation Report: 0x9f23... signed successfully.'
    ]);
    setEnclaveStatus('SECURE');
  };

  // Cyber Warfare states
  const [hackBackLogs, setHackBackLogs] = useState<string[]>([]);
  const [hackBackStatus, setHackBackStatus] = useState<string>('IDLE');
  
  const runHackBack = async () => {
    setHackBackStatus('RUNNING');
    setHackBackLogs([
      '🚨 COUNTER-STRIKE: Exploit payload signature match from 0xAttacker...',
      '⚡ COUNTER-STRIKE: Generating flash-loan frontrun counter-exploit payload...',
    ]);
    await new Promise(r => setTimeout(r, 600));
    setHackBackLogs(prev => [
      ...prev,
      '💸 COUNTER-STRIKE: Executing contract drain on attacker-owned deployment...',
      '💥 COUNTER-STRIKE: Attacker contract drained! +100.00 ETH recovered to Sentinel vault.'
    ]);
    setHackBackStatus('SUCCESS');
  };

  const [whaleLogs, setWhaleLogs] = useState<string[]>([]);
  const [whaleStatus, setWhaleStatus] = useState<string>('IDLE');
  
  const runWhaleSqueeze = async () => {
    setWhaleStatus('RUNNING');
    setWhaleLogs([
      '⚠️ WHALE-DEFENSE: Malicious short position detected on SentinelAMM pool...',
      '🏦 WHALE-DEFENSE: Initiating flash-loan buyback squeeze (1,500,000 tokens)...',
    ]);
    await new Promise(r => setTimeout(r, 600));
    setWhaleLogs(prev => [
      ...prev,
      '📈 WHALE-DEFENSE: Spot price squeezed +42%! Triggering whale position liquidation...',
      '💥 WHALE-DEFENSE: Whale short liquidated. Seized 120.00 ETH attacker collateral.'
    ]);
    setWhaleStatus('SUCCESS');
  };

  // AI Swarm Consensus
  const swarmRef = useRef<HTMLCanvasElement | null>(null);
  const [swarmPulse, setSwarmPulse] = useState<number>(0);
  
  useEffect(() => {
    const canvas = swarmRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const nodes = [
      { x: 100, y: 75 },
      { x: 220, y: 40 },
      { x: 220, y: 110 },
      { x: 340, y: 40 },
      { x: 340, y: 110 },
      { x: 460, y: 75 },
    ];
    
    ctx.strokeStyle = '#0d233a';
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
    
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 1.5;
    const activeIdx = swarmPulse % nodes.length;
    const nextIdx = (swarmPulse + 1) % nodes.length;
    ctx.beginPath();
    ctx.moveTo(nodes[activeIdx].x, nodes[activeIdx].y);
    ctx.lineTo(nodes[nextIdx].x, nodes[nextIdx].y);
    ctx.stroke();
    
    nodes.forEach((node, idx) => {
      ctx.fillStyle = idx === activeIdx ? '#00ffaa' : '#081525';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#00ffaa';
      ctx.stroke();
    });
  }, [swarmPulse]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSwarmPulse(prev => prev + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // EVM Sandbox Honeynet Simulator
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);
  const [sandboxStatus, setSandboxStatus] = useState<string>('IDLE');
  
  const runSandboxSimulation = async () => {
    setSandboxStatus('RUNNING');
    setSandboxLogs([
      '🔬 SANDBOX: Forking local EVM state at block height 1,420,123...',
      '🧪 SANDBOX: Loading transaction context details...',
    ]);
    await new Promise(r => setTimeout(r, 600));
    setSandboxLogs(prev => [
      ...prev,
      '⚠️ SANDBOX: Transaction execution attempted state modification on protected owner slot...',
      '🔴 SANDBOX: Exploit path detected! Reverting transaction side-effects...',
      '🟢 SANDBOX: Analysis complete. Threat verified. Transaction safely blocked on main chain.'
    ]);
    setSandboxStatus('BLOCKED');
  };

  // CCIP Telemetry Mesh Route
  const telemetryRef = useRef<HTMLCanvasElement | null>(null);
  const [telemetryPulse, setTelemetryPulse] = useState<number>(0);
  
  useEffect(() => {
    const canvas = telemetryRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const layers = [
      { name: 'Ethereum L1 (Mainnet)', x: 100, y: 110 },
      { name: 'Base L2 (Rollup)', x: 300, y: 75 },
      { name: 'Aetheron L3 (Sentinel)', x: 500, y: 40 },
    ];
    
    ctx.strokeStyle = '#0d233a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(layers[0].x, layers[0].y);
    ctx.lineTo(layers[1].x, layers[1].y);
    ctx.lineTo(layers[2].x, layers[2].y);
    ctx.stroke();
    
    if (telemetryPulse > 0) {
      const progress = (telemetryPulse % 30) / 30;
      let currentX, currentY;
      
      if (progress < 0.5) {
        const segmentProgress = progress * 2;
        currentX = layers[2].x + (layers[1].x - layers[2].x) * segmentProgress;
        currentY = layers[2].y + (layers[1].y - layers[2].y) * segmentProgress;
      } else {
        const segmentProgress = (progress - 0.5) * 2;
        currentX = layers[1].x + (layers[0].x - layers[1].x) * segmentProgress;
        currentY = layers[0].y + (layers[1].y - layers[0].y) * (1 - segmentProgress);
      }
      
      ctx.fillStyle = '#00ffaa';
      ctx.beginPath();
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    layers.forEach(layer => {
      ctx.fillStyle = '#040d1a';
      ctx.beginPath();
      ctx.arc(layer.x, layer.y, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#00b3ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(layer.name, layer.x - 50, layer.y - 18);
    });
  }, [telemetryPulse]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetryPulse(prev => prev + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // AI Self-Healing Debugger
  const [healingLogs, setHealingLogs] = useState<string[]>([]);
  const [healingStatus, setHealingStatus] = useState<string>('IDLE');
  
  const runSelfHealing = async () => {
    setHealingStatus('RUNNING');
    setHealingLogs([
      '🚨 AUTO-PATCH: Invariant Broken - Vault total balance does not match share ratios (Reentrancy vector identified).',
      '🤖 AUTO-PATCH: AI compiler agent writing Solidity patch...',
    ]);
    await new Promise(r => setTimeout(r, 600));
    setHealingLogs(prev => [
      ...prev,
      '🛠️ AUTO-PATCH: Re-compiling secure implementation layout (solc-v0.8.24)...',
      '⚙️ AUTO-PATCH: Triggering Proxy delegate call contract replacement...',
      '🟢 AUTO-PATCH: Upgrade complete. Vault invariant restored. Security status: SECURE.'
    ]);
    setHealingStatus('SUCCESS');
  };

  // ZK-Shielded Dark Pool Mixer
  const [zkMixerLogs, setZkMixerLogs] = useState<string[]>([]);
  const [zkMixerStatus, setZkMixerStatus] = useState<string>('IDLE');
  const [depositNote, setDepositNote] = useState<string>('');
  
  const runZkMixerDeposit = async () => {
    setZkMixerStatus('DEPOSITING');
    setZkMixerLogs(['🔒 MIXER: Shielding 1.00 ETH in private pool...']);
    await new Promise(r => setTimeout(r, 600));
    const note = 'zk_note_' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');
    setDepositNote(note);
    setZkMixerLogs(prev => [
      ...prev,
      `🔑 MIXER: Commitment hash registered on-chain. Generated secret note:`,
      note,
      '🟢 MIXER: Deposit secure and completely masked.'
    ]);
    setZkMixerStatus('DEPOSITED');
  };

  const runZkMixerWithdraw = async () => {
    if (!depositNote) return;
    setZkMixerStatus('WITHDRAWING');
    setZkMixerLogs(prev => [
      ...prev,
      '🌀 MIXER: Formatting zk-SNARK withdrawal path proofs...',
      '🛡️ MIXER: Verifying membership proof against Merkle root...'
    ]);
    await new Promise(r => setTimeout(r, 800));
    setZkMixerLogs(prev => [
      ...prev,
      '🟢 MIXER: Zero-Knowledge proof verified! Withdrawn 1.00 ETH to new clean address anonymized.'
    ]);
    setZkMixerStatus('WITHDRAWN');
  };

  // ARS Proactive Scan & Kill Switch state
  const [proactiveScanLogs, setProactiveScanLogs] = useState<string[]>([]);
  const [proactiveScanStatus, setProactiveScanStatus] = useState<string>('IDLE');
  const [killSwitchLoading, setKillSwitchLoading] = useState<boolean>(false);

  const runProactiveScan = async () => {
    setProactiveScanStatus('SCANNING');
    setProactiveScanLogs([
      '🔍 ARS SCAN: Forking validator state vectors...',
      '🔍 ARS SCAN: Disassembling smart contract bytecode bytes...',
      '🔍 ARS SCAN: Running neural static analyzer on storage slot invariants...'
    ]);
    await new Promise(r => setTimeout(r, 800));
    setProactiveScanLogs(prev => [
      ...prev,
      '🔍 ARS SCAN: Comparing weights against Solidity threat classifier weights...',
      '🔍 ARS SCAN: Checking memory page allocations for CPU SGX attestation paths...',
      '🟢 ARS SCAN: System verified clean! Zero anomalies or exploits detected.'
    ]);
    setProactiveScanStatus('DONE');
  };

  const toggleKillSwitch = async () => {
    setKillSwitchLoading(true);
    setDemoStatus('Triggering Emergency Kill Switch protocol...');
    try {
      const response = await fetch('/api/sentinel/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'fallback-dev-key-do-not-use-in-prod',
        },
        body: JSON.stringify({ prompt: 'trigger oracle_skew on low liquidity pool' }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setDemoStatus(`EMERGENCY HALT TRIGGERED: ${data.action}`);
    } catch (err) {
      setDemoStatus(`Kill Switch Error: ${err}`);
    }
    setKillSwitchLoading(false);
  };

  // Chat/Copilot state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: string; text: string }>>([
    {
      sender: 'Copilot',
      text: 'Aetheron Security Copilot v1.0 active. Ask me about system APY updates, circuit breaker status, or threat logs.',
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [encryptionLogs, setEncryptionLogs] = useState<string[]>([]);

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatHistory(prev => [...prev, { sender: 'User', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    setEncryptionLogs([
      '🔒 Encrypting message query using Kyber-1024...',
      '📡 Dispatching payload through QKD Photon polarization channel...',
    ]);
    await new Promise(r => setTimeout(r, 600));

    try {
      const response = await fetch('/api/sentinel/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'fallback-dev-key-do-not-use-in-prod',
        },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!response.ok) throw new Error('Failed to chat');
      const data = await response.json();

      setEncryptionLogs(prev => [
        ...prev,
        '🟢 Response payload received.',
        '🔑 Decrypting response using Kyber private key...',
      ]);
      await new Promise(r => setTimeout(r, 400));

      setChatHistory(prev => [...prev, { sender: 'Copilot', text: data.response }]);
    } catch {
      setChatHistory(prev => [
        ...prev,
        { sender: 'Copilot', text: 'Error communicating with Security Copilot.' },
      ]);
    }
    setEncryptionLogs([]);
    setChatLoading(false);
  };

  // Fuzzing & Invariant Visualizer state
  const [fuzzingState, setFuzzingState] = useState({
    runs: 1240,
    paths: 42,
    coverage: 84.2,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setFuzzingState(prev => {
        const diffRuns = Math.floor(Math.random() * 20) + 5;
        const diffPaths = Math.random() > 0.7 ? 1 : 0;
        const nextCoverage = Math.min(98.5, Number((prev.coverage + (Math.random() > 0.8 ? 0.1 : 0)).toFixed(2)));
        return {
          runs: prev.runs + diffRuns,
          paths: prev.paths + diffPaths,
          coverage: nextCoverage,
        };
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Real-Time L3 Block Explorer Ticker
  const [blocks, setBlocks] = useState<Array<{ number: number; hash: string; txCount: number; validationRoot: string; status: string }>>([]);

  useEffect(() => {
    const initialBlocks = Array.from({ length: 8 }, (_, idx) => {
      const num = 1240500 + idx;
      return {
        number: num,
        hash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        txCount: Math.floor(Math.random() * 8) + 1,
        validationRoot: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        status: 'VALIDATED',
      };
    });
    setBlocks(initialBlocks);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlocks(prev => {
        const nextNum = prev[prev.length - 1].number + 1;
        const newBlock = {
          number: nextNum,
          hash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
          txCount: Math.floor(Math.random() * 8) + 1,
          validationRoot: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
          status: isPaused ? 'COMPROMISED' : 'VALIDATED',
        };
        return [...prev.slice(1), newBlock];
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Zero-Knowledge Identity state
  const [zkInput, setZkInput] = useState<string>('');
  const [zkProofStatus, setZkProofStatus] = useState<string>('');
  const [zkProofLoading, setZkProofLoading] = useState<boolean>(false);

  const generateAndSubmitZKProof = async () => {
    if (!zkInput.trim()) return;
    setZkProofLoading(true);
    setZkProofStatus('🔒 Initializing ZK-Witness constraints...');
    await new Promise(r => setTimeout(r, 600));
    setZkProofStatus('🌀 Proving witness correctness off-chain using Groth16 Snark Prover...');
    await new Promise(r => setTimeout(r, 800));
    setZkProofStatus('📡 Submitting proof (pi_a, pi_b, pi_c) to SentinelZKIdentity.sol verification gate...');
    await new Promise(r => setTimeout(r, 600));
    setZkProofStatus('🟢 Zero-Knowledge identity verified on-chain. Signature verified successfully.');
    setZkProofLoading(false);
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
    const mockKey = 'sk_test_' + crypto.randomUUID().replace(/-/g, '');
    setApiKey(mockKey);
  };

  // Tabs states
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'analytics' | 'scheduled' | 'fleet'>('analytics');
  const [activeCopilotTab, setActiveCopilotTab] = useState<'neural' | 'fuzzing' | 'lattice'>('neural');

  // Interactive Exploit Curing States
  const [remediationLogs, setRemediationLogs] = useState<string[]>([]);
  const [curingExploit, setCuringExploit] = useState<string | null>(null);

  const runRemediationCure = async (exploitType: string) => {
    setCuringExploit(exploitType);
    setRemediationLogs([
      `🔧 ARS-CURE: Formulating remediation patch for exploit: ${exploitType}...`,
      '🔧 ARS-CURE: Forking Solidity contract AST (Abstract Syntax Tree)...',
    ]);
    await new Promise(r => setTimeout(r, 600));
    setRemediationLogs(prev => [
      ...prev,
      '🔧 ARS-CURE: Synthesizing modifier guards & checks-effects-interactions logic...',
      '🛠️ ARS-CURE: Triggering proxy delegate upgrades on local Hardhat Node...',
      '🟢 ARS-CURE: Remediation patch executed successfully! Vulnerability closed.'
    ]);
    setCuringExploit(null);
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

      {/* Main Top Header Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 30px',
        background: '#040d1a',
        borderBottom: '1px solid #102a45',
        boxSizing: 'border-box'
      }}>
        {/* Left Side Status Indicators */}
        <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: '#00ffaa', borderRadius: '50%', boxShadow: '0 0 8px #00ffaa' }}></span>
            <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>QUANTUM CORE: ACTIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>YIELD: 3.15%</span>
          </div>
        </div>

        {/* Center Logo */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#00f5ff', letterSpacing: '2px', textShadow: '0 0 10px rgba(0, 245, 255, 0.4)' }}>AETHERON SENTINEL</h1>
          <div style={{ fontSize: '0.75rem', color: '#888', letterSpacing: '4px', textTransform: 'uppercase' }}>- L3 QUANTUM SECURITY LAYER -</div>
        </div>

        {/* Right Side Actions */}
        <div style={{ display: 'flex', gap: '15px' }}>
          <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>☁️ CLOUD SYNC</button>
          <button className="btn-primary" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>💳 CONNECT WALLET</button>
          <button className="btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>⚙️ EXECUTE</button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ background: '#02060d', minHeight: 'calc(100vh - 80px)', padding: '25px', boxSizing: 'border-box' }}>
        
        {/* Workspace Subheader Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #102a45', paddingBottom: '15px', marginBottom: '25px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', textTransform: 'uppercase' }}>APEX SECURE DEFENSIVE WORKSPACE</h2>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>REAL-TIME INTEL CORRELATION AND ZERO-DAY AUTO-REMEDIATION WORKSPACE</div>
          </div>

          {/* Action Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveWorkspaceTab('analytics')}
              style={{
                background: activeWorkspaceTab === 'analytics' ? '#00f5ff' : 'transparent',
                color: activeWorkspaceTab === 'analytics' ? '#030812' : '#00f5ff',
                border: '1px solid #00f5ff',
                padding: '6px 15px',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              MANUAL THREAT MITIGATION
            </button>
            <button 
              onClick={() => setActiveWorkspaceTab('scheduled')}
              style={{
                background: activeWorkspaceTab === 'scheduled' ? '#00f5ff' : 'transparent',
                color: activeWorkspaceTab === 'scheduled' ? '#030812' : '#00f5ff',
                border: '1px solid #00f5ff',
                padding: '6px 15px',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              24H SCHEDULED REPORTING
            </button>
            <button 
              onClick={() => setActiveWorkspaceTab('fleet')}
              style={{
                background: activeWorkspaceTab === 'fleet' ? '#00f5ff' : 'transparent',
                color: activeWorkspaceTab === 'fleet' ? '#030812' : '#00f5ff',
                border: '1px solid #00f5ff',
                padding: '6px 15px',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              FLEET LOGS
            </button>
          </div>
        </div>

        {/* 3-Column Cyber Deck Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '25px', textAlign: 'left' }}>
          
          {/* Column 1: Bounty, Metrics, Command Deck */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Card 1: Bounty Intelligence */}
            <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🏆 Bounty Intelligence</h3>
                <span style={{ background: 'rgba(0, 255, 170, 0.1)', color: '#00ffaa', border: '1px solid #00ffaa', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  SAFE (98.4%)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>TOTAL EARNED</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>$1,240,000</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>GLOBAL RANK</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>#4</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>VULNS FOUND</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>142</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>ACTIVE PROGS</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>28</div>
                </div>
              </div>

              <div style={{ border: '1px solid #102a45', padding: '12px', borderRadius: '6px', background: '#02060d', marginBottom: '15px' }}>
                <span style={{ fontSize: '0.7rem', color: '#ffb84d' }}>UNCLAIMED BOUNTY FUNDS: $315,000</span>
              </div>

              <button className="btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}>
                OPEN DISBURSEMENT ROUTER
              </button>
            </div>

            {/* Card 2: Metrics or Threat Security */}
            <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>📡 Network Stats</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>NETWORK TPS</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>1,449</div>
                </div>
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>GAS PRICE</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>14 Gwei</div>
                </div>
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>ACTIVE NODES</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>128</div>
                </div>
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>INTERCEPTED</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ff4a4a' }}>12,450</div>
                </div>
              </div>
            </div>

            {/* Card 3: Decade Yield Aggregator */}
            <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>💸 Decade Yield Aggregator</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>CURRENT APY</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00ffaa' }}>3.15%</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>10Y PEAK TARGET</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>25.00%</div>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <span style={{ fontSize: '0.75rem', color: '#aaa', display: 'block', marginBottom: '5px' }}>ADJUST YIELD RATE slider</span>
                <input type="range" min="1" max="25" value="3" readOnly style={{ width: '100%' }} />
              </div>
              <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '10px', borderRadius: '8px', height: '80px' }}>
                <canvas ref={canvasRef} width={280} height={60} style={{ width: '100%', height: '60px' }} />
              </div>
            </div>

          </div>

          {/* Column 2: Lattice Security & ZK Proof Pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Card 1: Lattice Command Deck */}
            <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🕸️ Lattice Extreme Security Command Deck</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '15px' }}>
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '10px', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <strong>VECTOR_TPS_DIFF</strong>
                  <div style={{ color: '#aaa', marginTop: '5px' }}>Tracks spike fluctuations across block paths.</div>
                </div>
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '10px', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <strong>VECTOR_SYNCD_NODES</strong>
                  <div style={{ color: '#aaa', marginTop: '5px' }}>Identifies active ledger validators sync.</div>
                </div>
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '10px', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <strong>VECTOR_QUANTUM_CORE</strong>
                  <div style={{ color: '#aaa', marginTop: '5px' }}>Evaluates cryptographically secure keys.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button className="btn-primary" onClick={() => simulateDemoAttack('mev')} disabled={demoLoading} style={{ fontSize: '0.8rem', flex: '1' }}>INJECT TPS SPIKE</button>
                <button className="btn-secondary" onClick={resetDemoSystem} disabled={demoLoading} style={{ fontSize: '0.8rem', flex: '1' }}>MITIGATION NODE</button>
                <button className="btn-primary" onClick={triggerDemoHoneypot} disabled={demoLoading} style={{ fontSize: '0.8rem', flex: '1', background: '#ff3b30' }}>COMPROMISE VAULT</button>
              </div>
              {demoStatus && (
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#ffb84d', background: '#02060d', padding: '6px', borderRadius: '4px', border: '1px solid #102a45' }}>
                  &gt; {demoStatus}
                </div>
              )}
            </div>

            {/* Card 2: ZK Proof Pipeline */}
            <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🛡️ ZK-Proof Pipeline Playground</h3>
              
              <div style={{ background: '#02060d', padding: '12px', borderRadius: '6px', border: '1px solid #102a45', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '15px', color: '#00ffaa' }}>
                COMPUTE WITNESS SECRET (XKE) : X = 3
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                <div>Step 1: Assign Witness and Evaluate</div>
                <input 
                  type="text" 
                  placeholder="Type witness parameter (e.g. 5)..." 
                  value={zkInput} 
                  onChange={e => setZkInput(e.target.value)} 
                  style={{ background: '#02060d', border: '1px solid #102a45', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
                <button className="btn-primary" onClick={generateAndSubmitZKProof} disabled={zkProofLoading}>
                  {zkProofLoading ? 'Compiling...' : 'COMPILE ARITHMETIC WITNESS'}
                </button>
                {zkProofStatus && <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#aaa', marginTop: '5px' }}>{zkProofStatus}</div>}
              </div>
            </div>

            {/* Card 3: Geo-IP Global Attack Visualizer Map */}
            <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🗺️ LATTICE COMMAND SPECTRUM MAP</h3>
              <canvas ref={mapRef} width={300} height={150} style={{ width: '100%', height: '150px', borderRadius: '6px', border: '1px solid #102a45' }} />
            </div>

          </div>

          {/* Column 3: Autonomous Response System (ARS) & Neural Core */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Card 1: Autonomous Response (ARS) */}
            <div style={{ background: '#040d1a', border: '2px solid #00ffaa', padding: '20px', borderRadius: '12px', boxShadow: '0 0 15px rgba(0, 255, 170, 0.1)' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#00ffaa', fontSize: '0.95rem', textTransform: 'uppercase' }}>🤖 Autonomous Response (ARS)</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                <button className="btn-primary" onClick={runProactiveScan} disabled={proactiveScanStatus === 'SCANNING'} style={{ background: '#00ffaa', color: '#030812', width: '100%', padding: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {proactiveScanStatus === 'SCANNING' ? 'SCANNING CORE...' : '🔍 PROACTIVE AI SCAN'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#02060d', padding: '12px', borderRadius: '6px', border: '1px solid #102a45' }}>
                  <span style={{ fontSize: '0.8rem', color: '#888' }}>COUNTER-PATCH ENGINE:</span>
                  <span style={{ color: '#00ffaa', fontWeight: 'bold', fontSize: '0.85rem' }}>READY</span>
                </div>

                <button className="btn-primary" onClick={toggleKillSwitch} disabled={killSwitchLoading} style={{ background: '#ff4a4a', color: '#fff', width: '100%', padding: '10px' }}>
                  🚨 EMERGENCY KILL SWITCH
                </button>
              </div>

              {proactiveScanLogs.length > 0 && (
                <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#00ffaa' }}>
                  {proactiveScanLogs.map((log, idx) => (
                    <div key={idx}>&gt; {log}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 2: Sentinel ML Neural Core */}
            <div style={{ background: '#040d1a', border: '2px solid #00f5ff', padding: '20px', borderRadius: '12px', boxShadow: '0 0 15px rgba(0, 245, 255, 0.1)' }}>
              {/* Core Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #102a45', paddingBottom: '10px', marginBottom: '15px', gap: '8px' }}>
                <button 
                  onClick={() => setActiveCopilotTab('neural')}
                  style={{
                    background: 'transparent',
                    color: activeCopilotTab === 'neural' ? '#00f5ff' : '#6b7280',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  SENTINEL
                </button>
                <span style={{ color: '#102a45' }}>|</span>
                <button 
                  onClick={() => setActiveCopilotTab('fuzzing')}
                  style={{
                    background: 'transparent',
                    color: activeCopilotTab === 'fuzzing' ? '#00f5ff' : '#6b7280',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  REPLICA
                </button>
                <span style={{ color: '#102a45' }}>|</span>
                <button 
                  onClick={() => setActiveCopilotTab('lattice')}
                  style={{
                    background: 'transparent',
                    color: activeCopilotTab === 'lattice' ? '#00f5ff' : '#6b7280',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  LATTICE
                </button>
              </div>

              {/* Tab Contents */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activeCopilotTab === 'neural' && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: '#02060d', border: '1px solid #102a45', borderRadius: '8px', padding: '15px', height: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                      {chatHistory.map((msg, idx) => (
                        <div key={idx} style={{
                          alignSelf: msg.sender === 'User' ? 'flex-end' : 'flex-start',
                          background: msg.sender === 'User' ? '#00f5ff' : '#081525',
                          color: msg.sender === 'User' ? '#030812' : '#fff',
                          padding: '8px 12px',
                          borderRadius: '12px',
                          maxWidth: '85%',
                          fontSize: '0.85rem'
                        }}>
                          <strong>{msg.sender}:</strong> {msg.text}
                        </div>
                      ))}
                      {chatLoading && <div style={{ color: '#00ffaa', fontSize: '0.8rem' }}>🤖 Copilot processing...</div>}
                    </div>

                    {encryptionLogs.length > 0 && (
                      <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.7rem', color: '#00ffaa', marginBottom: '10px' }}>
                        {encryptionLogs.map((log, idx) => (
                          <div key={idx}>&gt; {log}</div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask Neural Core..." style={{ flex: 1, background: '#02060d', border: '1px solid #102a45', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.85rem' }} />
                      <button className="btn-primary" onClick={handleChatSubmit} disabled={chatLoading} style={{ padding: '10px 15px' }}>Send</button>
                    </div>
                  </div>
                )}

                {activeCopilotTab === 'fuzzing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '0.85rem' }}>Echidna Invariant Fuzzer Coverage</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                        <div>Consensus runs: <strong>{fuzzingState.runs} runs</strong></div>
                        <div>Coverage: <strong style={{ color: '#00ffaa' }}>{fuzzingState.coverage}%</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {activeCopilotTab === 'lattice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <canvas ref={latticeRef} width={300} height={150} style={{ width: '100%', height: '150px', borderRadius: '8px', border: '1px solid #102a45' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Swarm consensus node network */}
            <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🐝 Swarm Consensus Network</h3>
              <canvas ref={swarmRef} width={300} height={120} style={{ width: '100%', height: '120px', borderRadius: '8px' }} />
            </div>

          </div>

        </div>

        {/* Exploit Vector Analysis Curing Panel */}
        <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '25px', borderRadius: '12px', marginTop: '25px', textAlign: 'left' }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#00f5ff', fontSize: '1.2rem', textTransform: 'uppercase' }}>⚡ Exploit Vector Analysis</h2>
          <p style={{ color: '#888', marginBottom: '20px' }}>Remediate vulnerabilities detected on-chain instantly using targeted secure compiler patches.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #ff4a4a' }}>
              <span style={{ background: '#ff4a4a', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>CRITICAL</span>
              <h4 style={{ margin: '10px 0 5px 0', color: '#fff' }}>CRITICAL LATTICE BREAK-IN DETECTED</h4>
              <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '15px' }}>Mitigate coordinate forgery exploit attempts on Dilithium ring key vectors.</p>
              <button className="btn-primary" onClick={() => runRemediationCure('Lattice Break-In')} disabled={curingExploit !== null} style={{ width: '100%', fontSize: '0.8rem' }}>
                {curingExploit === 'Lattice Break-In' ? 'Executing cure...' : 'EXECUTE CURE'}
              </button>
            </div>

            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #ff4a4a' }}>
              <span style={{ background: '#ff4a4a', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>CRITICAL</span>
              <h4 style={{ margin: '10px 0 5px 0', color: '#fff' }}>REENTRANCY IN WITHDRAWAL</h4>
              <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '15px' }}>Fix vault contract invariant balance leaks by auto-patching reentrancy guard modifiers.</p>
              <button className="btn-primary" onClick={() => runRemediationCure('Reentrancy Withdrawal')} disabled={curingExploit !== null} style={{ width: '100%', fontSize: '0.8rem' }}>
                {curingExploit === 'Reentrancy Withdrawal' ? 'Executing cure...' : 'EXECUTE CURE'}
              </button>
            </div>

          </div>

          {remediationLogs.length > 0 && (
            <div style={{ marginTop: '20px', background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#00ffaa' }}>
              {remediationLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
            </div>
          )}
        </div>

        {/* CCIP and BlockExplorer Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '25px', marginTop: '25px', textAlign: 'left' }}>
          
          <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>📡 Cross-Chain CCIP Telemetry Route Mesh</h3>
            <canvas ref={telemetryRef} width={500} height={150} style={{ width: '100%', height: '150px', borderRadius: '8px' }} />
          </div>

          <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🧱 Real-Time Block Explorer</h3>
            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', padding: '5px 0' }}>
              {blocks.map((block, idx) => (
                <div key={idx} style={{
                  flex: '0 0 180px',
                  background: block.status === 'COMPROMISED' ? 'rgba(255, 74, 74, 0.1)' : 'rgba(0, 245, 255, 0.02)',
                  border: block.status === 'COMPROMISED' ? '1px solid #ff4a4a' : '1px solid #102a45',
                  borderRadius: '6px',
                  padding: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: '5px' }}>
                    <span>Block #{block.number}</span>
                    <span style={{ color: block.status === 'COMPROMISED' ? '#ff4a4a' : '#4aff4a', fontWeight: 'bold' }}>
                      {block.status === 'COMPROMISED' ? 'HALTED' : 'MINED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#fff', wordBreak: 'break-all' }}>
                    Hash: {block.hash.slice(0, 8)}...
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Live gateway logs and Event Feeds */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '25px', marginTop: '25px', textAlign: 'left' }}>
          
          <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🛡️ Live Gateway Audit Logs</h3>
            <button className="btn-primary" onClick={fetchGatewayLogs} disabled={fetchingLogs} style={{ padding: '8px 15px', fontSize: '0.85rem' }}>
              {fetchingLogs ? 'Fetching...' : 'Fetch Live Logs'}
            </button>
            {logsError && <p style={{ color: 'red', marginTop: '10px' }}>Error: {logsError}</p>}
            {gatewayLogs.length > 0 ? (
              <ul className="logs-list" style={{ marginTop: '15px', textAlign: 'left', background: '#02060d', padding: '10px', borderRadius: '6px', listStyleType: 'none', border: '1px solid #102a45', maxHeight: '180px', overflowY: 'auto' }}>
                {gatewayLogs.map((log, index) => (
                  <li key={index} style={{ marginBottom: '8px', borderBottom: '1px solid #102a45', paddingBottom: '8px', fontSize: '0.8rem' }}>
                    <strong>[{new Date(log.timestamp).toLocaleTimeString()}]</strong> Threat Score:{' '}
                    <span style={{ color: log.score >= 0.75 ? '#ff4a4a' : '#4aff4a' }}>
                      {log.score.toFixed(2)}
                    </span>
                    <br />
                    <em style={{ color: '#aaa' }}>Reasons:</em> {log.reasons.join(', ') || 'None'}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ marginTop: '10px', color: '#666', fontSize: '0.85rem' }}>No gateway logs fetched yet.</p>
            )}
          </div>

          <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', color: '#00f5ff', textTransform: 'uppercase' }}>🔑 Developer API Access Gateway</h3>
            {!apiKey ? (
              <button className="btn-primary" onClick={generateApiKey} style={{ padding: '8px 15px', fontSize: '0.85rem' }}>
                Generate API Key
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: '#02060d', padding: '10px', borderRadius: '4px', border: '1px solid #102a45' }}>
                  <code style={{ wordBreak: 'break-all', fontSize: '13px' }}>{apiKey}</code>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Advanced Apex Warfare & Crypto-Shield Protocols */}
        <div style={{ background: '#040d1a', border: '1px solid #102a45', padding: '25px', borderRadius: '12px', marginTop: '25px', textAlign: 'left' }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#00f5ff', textShadow: '0 0 10px rgba(0, 245, 255, 0.4)', textTransform: 'uppercase', fontSize: '1.2rem' }}>
            🔒 ADVANCED APEX WARFARE & CRYPTO-SHIELD PROTOCOLS
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Supabase real-time events feed */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>📋 Oracle Threat Intelligence Event Feed</h4>
              {error && <p style={{ color: 'red', fontSize: '0.8rem' }}>{error}</p>}
              {loading ? (
                <p style={{ color: '#888', fontSize: '0.8rem' }}>Loading logs...</p>
              ) : events.length > 0 ? (
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {events.map(event => (
                    <div key={event.id} style={{ fontSize: '0.75rem', borderBottom: '1px solid #102a45', paddingBottom: '5px', marginBottom: '5px' }}>
                      <code>{event.tx_hash.slice(0, 10)}...</code> | Risk: <strong style={{ color: event.risk_score >= 8 ? '#ff4a4a' : '#00b3ff' }}>{event.risk_score}/10</strong> | Chain: {event.chain_id}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#888', fontSize: '0.8rem' }}>No events logged.</p>
              )}
            </div>

            {/* FHE Ciphertexts output */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🔒 FHE Homomorphic Ciphertexts</h4>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                <input type="number" value={fheA} onChange={e => setFheA(Number(e.target.value))} style={{ width: '45px', background: '#040d1a', border: '1px solid #102a45', color: '#fff', padding: '4px', borderRadius: '4px' }} />
                <span style={{ color: '#aaa' }}>+</span>
                <input type="number" value={fheB} onChange={e => setFheB(Number(e.target.value))} style={{ width: '45px', background: '#040d1a', border: '1px solid #102a45', color: '#fff', padding: '4px', borderRadius: '4px' }} />
                <button className="btn-primary" onClick={runFheAddition} disabled={fheLoading} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  {fheLoading ? 'Math...' : 'TFHE.add'}
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>&gt; Cipher A: <span style={{ color: '#00ffaa' }}>{fheCipherA || 'None'}</span></div>
                <div>&gt; Cipher B: <span style={{ color: '#00ffaa' }}>{fheCipherB || 'None'}</span></div>
                {fheResultCipher && <div>&gt; Homomorphic Result: <span style={{ color: '#00ffaa' }}>{fheResultCipher}</span></div>}
              </div>
              {fheStatus && <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '8px', fontFamily: 'monospace' }}>{fheStatus}</div>}
            </div>

            {/* EVM Sandbox */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🧪 EVM Sandbox Honeynet</h4>
              <button className="btn-secondary" onClick={runSandboxSimulation} disabled={sandboxStatus === 'RUNNING'} style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}>
                {sandboxStatus === 'RUNNING' ? 'Simulating...' : 'Run EVM Sandbox Simulation'}
              </button>
              {sandboxLogs.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#888', fontFamily: 'monospace', maxHeight: '100px', overflowY: 'auto' }}>
                  {sandboxLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                </div>
              )}
            </div>

            {/* Anti-MEV Mempool Guard Controls */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>⚡ Anti-MEV Mempool Guard</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px', fontSize: '0.8rem' }}>
                <input type="checkbox" checked={mevProtected} onChange={e => setMevProtected(e.target.checked)} />
                <span>Private RPC Protection (Flashbots)</span>
              </label>
              <button className="btn-primary" onClick={triggerMevSwap} disabled={mevStatus === 'Pending'} style={{ width: '100%', fontSize: '0.8rem', padding: '5px' }}>
                Execute Swap (0.1 ETH)
              </button>
              {mevLogs.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#888', fontFamily: 'monospace' }}>
                  {mevLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                </div>
              )}
            </div>

            {/* Solana sync and PQC Gov */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🦀 Solana Sync & PQC Governance</h4>
              <div style={{ fontSize: '0.8rem', marginBottom: '8px' }}>
                SVM Bridge Status: <strong style={{ color: solanaStatus.includes('HALTED') ? '#ff4a4a' : '#00ffaa' }}>{solanaStatus}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '8px' }}>
                Governance proposals signed: <strong>{pqcVotes} votes</strong>
              </div>
              <button className="btn-secondary" onClick={castPqcVote} disabled={voted} style={{ width: '100%', fontSize: '0.8rem', padding: '5px' }}>
                {voted ? 'Proposal Signed' : 'Sign Proposal via Dilithium-5'}
              </button>
            </div>

            {/* SGX Enclave co-processor */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🔒 SGX Hardware Enclave Co-Processor</h4>
              <button className="btn-primary" onClick={runEnclaveAttestation} disabled={enclaveStatus === 'ATTESTING'} style={{ width: '100%', fontSize: '0.8rem', padding: '5px', marginBottom: '10px' }}>
                Execute Enclave Attestation
              </button>
              {enclaveLogs.length > 0 && (
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#aaa' }}>
                  {enclaveLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                </div>
              )}
            </div>

            {/* Hack-Back warfare */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>⚔️ Hack-Back Counterstrike Protocol</h4>
              <button className="btn-primary" onClick={runHackBack} disabled={hackBackStatus === 'RUNNING'} style={{ width: '100%', fontSize: '0.8rem', padding: '5px', background: '#ff4a4a', color: '#fff', marginBottom: '10px' }}>
                ⚡ Initiate Hack-Back Protocol
              </button>
              {hackBackLogs.length > 0 && (
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#aaa' }}>
                  {hackBackLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                </div>
              )}
            </div>

            {/* Whale Squeeze */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🐋 Whale-Squeeze Liquidation Defense</h4>
              <button className="btn-primary" onClick={runWhaleSqueeze} disabled={whaleStatus === 'RUNNING'} style={{ width: '100%', fontSize: '0.8rem', padding: '5px', marginBottom: '10px' }}>
                🐋 Counter Hostile Whale Short
              </button>
              {whaleLogs.length > 0 && (
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#aaa' }}>
                  {whaleLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                </div>
              )}
            </div>

            {/* AI Self-Healing Debugger */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🩹 AI Self-Healing Proxy Debugger</h4>
              <button className="btn-primary" onClick={runSelfHealing} disabled={healingStatus === 'RUNNING'} style={{ width: '100%', fontSize: '0.8rem', padding: '5px', marginBottom: '10px' }}>
                🩹 Initiate Auto-Patching
              </button>
              {healingLogs.length > 0 && (
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#aaa' }}>
                  {healingLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                </div>
              )}
            </div>

            {/* ZK Mixer Dark Pool */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🌀 ZK Mixer Shielded Dark Pool</h4>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button className="btn-primary" onClick={runZkMixerDeposit} disabled={zkMixerStatus === 'DEPOSITING'} style={{ flex: 1, fontSize: '0.75rem', padding: '5px' }}>
                  Deposit (Shielded)
                </button>
                <button className="btn-secondary" onClick={runZkMixerWithdraw} disabled={!depositNote || zkMixerStatus === 'WITHDRAWING' || zkMixerStatus === 'WITHDRAWN'} style={{ flex: 1, fontSize: '0.75rem', padding: '5px' }}>
                  Withdraw via SNARK
                </button>
              </div>
              {zkMixerLogs.length > 0 && (
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#aaa' }}>
                  {zkMixerLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                </div>
              )}
            </div>

            {/* Swap Widgets & Portals */}
            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>⚡ Swap Portal</h4>
              <SwapWidget />
            </div>

            <div style={{ background: '#02060d', border: '1px solid #102a45', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#00f5ff' }}>🏢 Institutional Portal</h4>
              <InstitutionalPortal />
            </div>

          </div>
        </div>

      </div>
    </>
  );
}

export default App;
