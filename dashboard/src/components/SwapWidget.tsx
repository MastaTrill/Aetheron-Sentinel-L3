import { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSendTransaction, useSignTypedData } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseEther, formatEther } from 'viem';

const API_KEY = import.meta.env.VITE_UNISWAP_API_KEY || 'mock-api-key'; // Fallback to mock

// Example token addresses for Mainnet
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

export default function SwapWidget() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();

  const [amountIn, setAmountIn] = useState('0.1');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'x-universal-router-version': '2.0',
  };

  const getQuote = async () => {
    if (!address) return;
    setLoading(true);
    setStatus('Fetching quote from Uniswap Trading API...');
    try {
      const response = await fetch('/api/uniswap/quote', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          swapper: address,
          tokenIn: WETH,
          tokenOut: USDC,
          tokenInChainId: '1',
          tokenOutChainId: '1',
          amount: parseEther(amountIn).toString(),
          type: 'EXACT_INPUT',
          slippageTolerance: 0.5,
          routingPreference: 'BEST_PRICE',
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setQuote(data);
      setStatus('Quote received.');
    } catch (err: any) {
      console.error(err);
      setStatus(`Quote Error: ${err.message}`);
    }
    setLoading(false);
  };

  const executeSwap = async () => {
    if (!quote || !address) return;
    setLoading(true);
    setStatus('Preparing swap transaction...');

    try {
      // Clean quote as per Uniswap SKILL requirements
      const { permitData, permitTransaction, ...cleanQuote } = quote;
      const swapRequest: any = { ...cleanQuote };

      // Handle Permit2 if present for UniswapX (DUTCH_V2)
      const isUniswapX = quote.routing === 'DUTCH_V2' || quote.routing === 'PRIORITY';
      
      if (isUniswapX && permitData) {
        setStatus('Please sign the Permit2 message in your wallet...');
        const signature = await signTypedDataAsync({
          domain: permitData.domain,
          types: permitData.types,
          primaryType: 'PermitWitnessTransferFrom',
          message: permitData.values,
        });
        swapRequest.signature = signature;
      } else if (!isUniswapX && permitData && typeof permitData === 'object') {
        setStatus('Please sign the Permit2 message in your wallet...');
        const signature = await signTypedDataAsync({
          domain: permitData.domain,
          types: permitData.types,
          primaryType: 'PermitSingle',
          message: permitData.values,
        });
        swapRequest.signature = signature;
        swapRequest.permitData = permitData;
      }

      setStatus('Requesting transaction payload from Trading API...');
      const response = await fetch('/api/uniswap/swap', {
        method: 'POST',
        headers,
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      if (!data.swap || !data.swap.data) {
        throw new Error('Invalid swap response. Quote may have expired.');
      }

      setStatus('Please confirm the transaction in your wallet...');
      const txHash = await sendTransactionAsync({
        to: data.swap.to,
        data: data.swap.data,
        value: BigInt(data.swap.value || 0),
      });

      setStatus(`Swap submitted! Tx: ${txHash.slice(0, 10)}...`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Swap Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="swap-widget">
      <h2>Swap via Uniswap (WETH → USDC)</h2>
      
      {!isConnected ? (
        <button onClick={() => connect({ connector: injected() })} className="btn-primary">
          Connect Wallet to Swap
        </button>
      ) : (
        <div className="swap-interface">
          <p>Connected: {address?.slice(0, 8)}...</p>
          <button onClick={() => disconnect()} className="btn-secondary">Disconnect</button>
          
          <div className="input-group">
            <label>You pay (WETH):</label>
            <input 
              type="number" 
              value={amountIn} 
              onChange={(e) => setAmountIn(e.target.value)} 
            />
          </div>

          <button onClick={getQuote} disabled={loading} className="btn-primary">
            {loading ? 'Processing...' : 'Get Quote'}
          </button>

          {quote && (
            <div className="quote-result">
              <h4>Routing: {quote.routing}</h4>
              {quote.routing === 'CLASSIC' ? (
                <p>Output: {formatEther(BigInt(quote.quote.output.amount))} USDC</p>
              ) : (
                <p>Est. Output: {formatEther(BigInt(quote.quote.orderInfo.outputs[0].startAmount))} USDC</p>
              )}
              <button onClick={executeSwap} disabled={loading} className="btn-primary success">
                Execute Swap
              </button>
            </div>
          )}

          {status && <p className="status-text">{status}</p>}
        </div>
      )}
    </div>
  );
}
