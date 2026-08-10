export interface DeployedContract {
  address: string;
  name: string;
  network: string;
  chainId: number;
  explorerUrl: string;
}

export const BASE_SEPOLIA_CONTRACTS = {
  SentinelInterceptor: {
    address: '0x5459D1398B0d29a758432183B6Fb306B46aD64f3',
    name: 'SentinelInterceptor',
    network: 'baseSepolia',
    chainId: 84532,
    explorerUrl: 'https://sepolia.basescan.org/address/0x5459D1398B0d29a758432183B6Fb306B46aD64f3',
  },
  CircuitBreaker: {
    address: '0x7233e0805d71EEd3632a9E7579C5Fdfd7Fd6b88B',
    name: 'CircuitBreaker',
    network: 'baseSepolia',
    chainId: 84532,
    explorerUrl: 'https://sepolia.basescan.org/address/0x7233e0805d71EEd3632a9E7579C5Fdfd7Fd6b88B',
  },
  RateLimiter: {
    address: '0xB84Cc1C36a8a037F56B85d4634fd293e89D59257',
    name: 'RateLimiter',
    network: 'baseSepolia',
    chainId: 84532,
    explorerUrl: 'https://sepolia.basescan.org/address/0xB84Cc1C36a8a037F56B85d4634fd293e89D59257',
  },
} as const;

export const BASE_MAINNET_CONTRACTS = {
  AetheronToken: {
    address: '0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e',
    name: 'Aetheron',
    symbol: 'AETH',
    network: 'base',
    chainId: 8453,
    explorerUrl: 'https://basescan.org/token/0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e',
  },
  SentinelToken: {
    address: '0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e',
    name: 'AETH',
    network: 'base',
    chainId: 8453,
    explorerUrl: 'https://basescan.org/token/0xecf7e17fae148c01e1b5008a31dfd2d1b6608e4e',
  },
} as const;
