import { NextApiRequest, NextApiResponse } from 'next';
import httpProxy from 'http-proxy';

// Create proxy server
const proxy = httpProxy.createProxyServer();

// Handle API routes
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { droneId, params } = req.query;
  
  // Target backend service based on the endpoint
  // This will route requests to the appropriate microservice
  const target = process.env.DRONE_DB_SERVICE_URL || 'http://localhost:4001';
  
  return new Promise((resolve, reject) => {
    // Forward the request to backend service
    proxy.web(req, res, { target }, (err) => {
      if (err) {
        console.error('Proxy error:', err);
        res.status(500).json({ message: 'Internal Server Error' });
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}

// Disable body parsing, let the proxy handle it
export const config = {
  api: {
    bodyParser: false,
  },
};
