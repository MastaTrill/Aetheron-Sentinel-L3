#!/usr/bin/env node
/**
 * Aetheron Sentinel L3 - Zero-Dependency Autonomous Self-Hosted Server
 * Serves the telemetry web UI and proxies threat intelligence directly.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3005;
const SITE_DIR = path.join(__dirname, '..', 'site');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // CORS Headers for on-chain telemetry
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'aetheron-sentinel-self-hosted', timestamp: new Date().toISOString() }));
    return;
  }

  // Clean URL parsing
  let sanitizedPath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[\/\\])+/, '');
  if (sanitizedPath === '/' || sanitizedPath === '\\') {
    sanitizedPath = '/index.html';
  }

  const filePath = path.join(SITE_DIR, sanitizedPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<!DOCTYPE html><html><body style="background:#0b0f19;color:#00f2fe;font-family:sans-serif;text-align:center;padding:50px;"><h1>404 - Aetheron Sentinel Node Resource Not Found</h1></body></html>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Node Error: ${err.code}`);
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🛡️  ======================================================`);
  console.log(`   AETHERON SENTINEL L3 - AUTONOMOUS NODE HOST`);
  console.log(`   ------------------------------------------------------`);
  console.log(`   📡 Live Node Web UI : http://localhost:${PORT}`);
  console.log(`   🔗 Connected Network: Base Sepolia (Chain ID: 84532)`);
  console.log(`   ✨ Zero Cloud Vendor Lock-In - 100% Self-Hosted`);
  console.log(`======================================================\n`);
});
