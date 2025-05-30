// app/api/drones/[droneId]/telemetry/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(
  request: NextRequest,
  { params }: { params: { droneId: string } }
) {
  try {
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ 
        success: false, 
        message: 'Authorization required' 
      }, { status: 401 });
    }
    
    const { droneId } = params;
    
    // Get URL params
    const searchParams = request.nextUrl.searchParams;
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const interval = searchParams.get('interval');
    
    if (!startTime || !endTime) {
      return NextResponse.json({ 
        success: false, 
        message: 'startTime and endTime are required' 
      }, { status: 400 });
    }
    
    // Forward the request to your drone-db-service
    const droneDbServiceUrl = process.env.DRONE_DB_SERVICE_URL || 'http://drone-db-service:4001';
    
    // Create query string
    const queryString = new URLSearchParams({
      startTime,
      endTime,
      ...(interval ? { interval } : {})
    }).toString();
    
    // Get historical telemetry data
    const response = await axios.get(
      `${droneDbServiceUrl}/api/drones/${droneId}/telemetry?${queryString}`, 
      {
        headers: {
          Authorization: authHeader
        }
      }
    );
    
    // Return the response data
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error(`Error fetching telemetry for drone ${params.droneId}:`, error);
    
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    }, { status: error.response?.status || 500 });
  }
}