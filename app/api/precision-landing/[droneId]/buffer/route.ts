// app/api/precision-landing/[droneId]/buffer/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { droneId: string } }
) {
  try {
    const { droneId } = params;
    const count = request.nextUrl.searchParams.get('count') || '100';
    
    console.log(`[API] Fetching precision landing buffer for drone: ${droneId}`);
    
    // Fetch from drone-connection-service
    const response = await fetch(
      `http://drone-connection-service:4005/precision-landing/${droneId}/buffer?count=${count}`,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      }
    );
    
    if (!response.ok) {
      console.log(`[API] Precision landing service response not ok: ${response.status}`);
      return NextResponse.json({ 
        droneId, 
        messages: [],
        count: 0,
        error: `Service unavailable (${response.status})` 
      });
    }
    
    const data = await response.json();
    console.log(`[API] Retrieved precision landing buffer for ${droneId}: ${data.count} messages`);
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[API] Error fetching precision landing buffer:', error);
    return NextResponse.json({ 
      droneId: params.droneId, 
      messages: [],
      count: 0,
      error: 'Network error' 
    });
  }
}