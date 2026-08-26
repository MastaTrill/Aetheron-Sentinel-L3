import { Buffer } from 'buffer';
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import SentinelProBilling from './components/SentinelProBilling.tsx';
import { installSentinelFetchBridge } from './api/sentinelClient.ts';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

installSentinelFetchBridge();

const config = createConfig({
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SentinelProBilling />
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
