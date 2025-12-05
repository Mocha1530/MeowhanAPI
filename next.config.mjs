/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['tiktok-live-connector', 'puppeteer-core', '@sparticuz/chromium'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'tiktok-live-connector': 'commonjs tiktok-live-connector',
        'puppeteer-core': 'commonjs puppeteer-core',
        '@sparticuz/chromium': 'commonjs @sparticuz/chromium'
      });
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }

    return config;
  },

  // turbopack: {
  //   resolveAlias: {
  //     fs: false,
  //     net: false,
  //     tls: false,
  //     crypto: false,
  //     stream: false,
  //     url: false,
  //     zlib: false,
  //     http: false,
  //     https: false,
  //     assert: false,
  //     os: false,
  //     path: false,
  //   },
  // }
};

export default nextConfig
