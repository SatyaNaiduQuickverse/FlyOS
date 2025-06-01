// app/api/drone-telemetry/[droneId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { droneId: string } }
) {
  try {
    const { droneId } = params;
    
    // Fetch Redis data from drone-connection-service
    const response = await fetch(`http://drone-connection-service:4005/redis/${droneId}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return NextResponse.json({});
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching drone telemetry:', error);
    return NextResponse.json({});
  }
}