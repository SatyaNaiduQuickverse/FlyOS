// app/secure/main-hq/drone-control/[droneId]/[...params]/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Handle GET requests to the drone control API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { droneId: string; params: string[] } }
) {
  const { droneId, params: pathSegments } = params;
  
  // Construct the target backend URL
  const targetUrl = buildTargetUrl(droneId, pathSegments, request.nextUrl.search);
  
  try {
    // Forward the request to the backend service
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
    });
    
    // Return the response data
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Handle POST requests to the drone control API
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { droneId: string; params: string[] } }
) {
  const { droneId, params: pathSegments } = params;
  
  // Construct the target backend URL
  const targetUrl = buildTargetUrl(droneId, pathSegments);
  
  try {
    // Get the request body
    const body = await request.json();
    
    // Forward the request to the backend service
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // Return the response data
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Helper function to build the target backend URL
 */
function buildTargetUrl(droneId: string, pathSegments: string[], queryString: string = '') {
  const droneDbServiceUrl = process.env.DRONE_DB_SERVICE_URL || 'http://drone-db-service:4001';
  const path = pathSegments.join('/');
  return `${droneDbServiceUrl}/api/drones/${droneId}/${path}${queryString}`;
}
