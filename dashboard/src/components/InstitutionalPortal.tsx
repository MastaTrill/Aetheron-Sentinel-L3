import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import SentinelZKIdentityABI from '../abis/SentinelZKIdentity.json';

// Since we are mocking the deployment on the frontend dev server, 
// we will use a dummy address for the ZK Identity contract to bypass errors.
// In a real environment, this would be injected via window.SENTINEL_CONTRACTS
const ZK_IDENTITY_ADDRESS = '0x1234567890123456789012345678901234567890';

export default function InstitutionalPortal() {
  const { address, isConnected } = useAccount();
  
  // Read Identity Status from Smart Contract
  const { data: identityData, isLoading } = useReadContract({
    address: ZK_IDENTITY_ADDRESS,
    abi: SentinelZKIdentityABI.abi,
    functionName: 'getZKIdentity',
    args: [address],
    query: {
      enabled: isConnected && !!address,
      retry: false, // Don't retry since it will fail on mock address
    }
  });

  // Mocking state since we are using a dummy address for demo purposes
  const [isVerified, setIsVerified] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    // If the contract call succeeds (e.g. on a real network), map the result
    if (identityData && Array.isArray(identityData)) {
      setIsVerified(identityData[3]); // isVerified boolean is at index 3
    }
  }, [identityData]);

  const handleApply = () => {
    setIsApplying(true);
    // Mocking an async ZK proof generation & transaction
    setTimeout(() => {
      setIsVerified(true);
      setIsApplying(false);
    }, 2500);
  };

  if (!isConnected) {
    return (
      <div className="institutional-portal locked">
        <div className="overlay">
          <h2>🔒 Institutional Client Portal</h2>
          <p>Please connect your wallet to verify your Enterprise ZK Identity.</p>
        </div>
      </div>
    );
  }

  if (isLoading && !isVerified) {
    return (
      <div className="institutional-portal loading">
        <p>Querying Sentinel ZK Identity Registry...</p>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="institutional-portal unverified">
        <h2>⚠️ Unverified Entity</h2>
        <p>Your address (<code>{address}</code>) is not linked to a verified Sentinel ZK Identity.</p>
        <p>Access to the Institutional Client Portal is strictly gated to KYC/AML verified enterprise partners.</p>
        
        <button 
          className="btn-primary" 
          onClick={handleApply} 
          disabled={isApplying}
        >
          {isApplying ? 'Generating ZK Proof & Submitting...' : 'Submit Institutional KYC/AML Application'}
        </button>
      </div>
    );
  }

  // Render Premium Institutional Dashboard
  return (
    <div className="institutional-portal verified">
      <div className="verified-header">
        <h2>✅ Enterprise Dashboard Unlocked</h2>
        <span className="badge">ZK-Verified Institution</span>
      </div>
      
      <div className="enterprise-metrics">
        <div className="metric-card">
          <h4>Your Trust Score</h4>
          <h2>850 / 1000</h2>
        </div>
        <div className="metric-card">
          <h4>Private OTC Volume</h4>
          <h2>$14.2M</h2>
        </div>
        <div className="metric-card">
          <h4>Exclusive Staking APY</h4>
          <h2>5.2% (Alpha Boost)</h2>
        </div>
      </div>

      <div className="otc-desk">
        <h3>Private OTC Desk (Dark Pool)</h3>
        <p>Execute large block trades with zero slippage and MEV protection.</p>
        <button className="btn-secondary">Request OTC Quote</button>
      </div>
      
      <div className="compliance-reports">
        <h3>Compliance & Audit Reports</h3>
        <p>Download your monthly SOC2 and AML compliance proofs generated via zero-knowledge rollups.</p>
        <button className="btn-secondary">Download Latest Report</button>
      </div>
    </div>
  );
}
