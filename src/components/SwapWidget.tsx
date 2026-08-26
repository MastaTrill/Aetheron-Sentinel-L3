"use client";

import { useState } from 'react';

export default function SwapWidget() {
  const [tokenIn, setTokenIn] = useState('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'); // WBTC
  const [tokenOut, setTokenOut] = useState('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'); // WETH
  const [amount, setAmount] = useState('100000000'); // 1 WBTC (8 decimals)
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchQuote = async () => {
    setLoading(true);
    setError('');
    setQuote(null);
    try {
      const response = await fetch('/api/uniswap/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-universal-router-version': '2.0',
        },
        body: JSON.stringify({
          tokenIn,
          tokenOut,
          tokenInChainId: '1',
          tokenOutChainId: '1',
          amount,
          type: 'EXACT_INPUT',
          slippageTolerance: 0.5,
          routingPreference: 'BEST_PRICE'
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch quote');
      }
      setQuote(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 max-w-md shadow-sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pay (Token Address)</label>
          <input 
            type="text" 
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input 
            type="text" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Receive (Token Address)</label>
          <input 
            type="text" 
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <button 
          onClick={fetchQuote}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Fetching Quote...' : 'Review Swap'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded">
            Error: {error}
          </div>
        )}

        {quote && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <p><span className="font-medium">Routing Type:</span> {quote.routing}</p>
            {quote.routing === 'CLASSIC' ? (
              <>
                <p><span className="font-medium">Expected Output:</span> {quote.quote.output.amount}</p>
                <p><span className="font-medium">Est. Gas (USD):</span> ${quote.quote.gasFeeUSD}</p>
              </>
            ) : (
              <p><span className="font-medium">Expected Output:</span> {quote.quote.orderInfo.outputs[0].startAmount}</p>
            )}
            <button className="mt-2 w-full bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition">
              Confirm Swap
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
