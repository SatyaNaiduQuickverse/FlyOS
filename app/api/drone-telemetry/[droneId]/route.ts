import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { droneId: string } }
) {
  try {
    const { droneId } = params;
    
    console.log(`[API] Fetching telemetry for drone: ${droneId}`);
    
    // Fetch Redis data from drone-connection-service
    const response = await fetch(`http://drone-connection-service:4005/redis/${droneId}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store' // Ensure fresh data
    });
    
    if (!response.ok) {
      console.log(`[API] Drone service response not ok: ${response.status}`);
      return NextResponse.json({ 
        id: droneId, 
        connected: false, 
        error: `Service unavailable (${response.status})` 
      });
    }
    
    const data = await response.json();
    console.log(`[API] Retrieved data for ${droneId}:`, data ? 'SUCCESS' : 'EMPTY');
    
    return NextResponse.json(data || { id: droneId, connected: false });
    
  } catch (error) {
    console.error('[API] Error fetching drone telemetry:', error);
    return NextResponse.json({ 
      id: params.droneId, 
      connected: false, 
      error: 'Network error' 
    });
  }
}