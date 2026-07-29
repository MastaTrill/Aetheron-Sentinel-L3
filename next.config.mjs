const isMobileBuild = process.env.MOBILE_BUILD === 'true';

export default {
  output: isMobileBuild ? 'export' : undefined,
  pageExtensions: isMobileBuild ? ['tsx', 'jsx', 'mdx'] : ['tsx', 'ts', 'jsx', 'js', 'mdx'],
  async rewrites() {
    // Rewrites are not supported with static exports, so disable them on mobile
    if (isMobileBuild) return [];
    
    return [
      {
        source: '/api/uniswap/:path*',
        destination: 'https://trade-api.gateway.uniswap.org/v1/:path*',
      },
    ];
  }
};
