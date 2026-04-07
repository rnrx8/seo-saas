/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['xlsx', 'mammoth', 'pdfjs-dist'],
  turbopack: {
    resolveAlias: {
      canvas: { browser: './node_modules/pdfjs-dist/legacy/build/pdf.mjs' },
    },
  },
};

export default nextConfig;
