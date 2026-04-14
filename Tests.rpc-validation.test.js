const { validateRPC } = require('../src/rpc-validator');

describe('RPC Validation', () => {
  test('allows valid eth_getBalance call', () => {
    const request = { 
      method: "eth_getBalance", 
      params: ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e"] 
    };
    expect(validateRPC(request)).toBe(true);
  });

  test('blocks oversized payload', () => {
    const hugeRequest = { 
      method: "eth_call", 
      params: };
    expect(validateRPC(hugeRequest)).toBe(false);
  });

  test('blocks dangerous debug methods', () => {
    const badRequest = { method: "debug_traceTransaction" };
    expect(validateRPC(badRequest)).toBe(false);
  });

  test('blocks malformed JSON-RPC', () => {
    const badRequest = { method: null };
    expect(validateRPC(badRequest)).toBe(false);
  });
});