// app/api/drones/[droneId]/command/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(
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
    
    // Get the request body
    const body = await request.json();
    
    // Forward the command to the drone-db-service
    const droneDbServiceUrl = process.env.DRONE_DB_SERVICE_URL || 'http://drone-db-service:4001';
    const response = await axios.post(
      `${droneDbServiceUrl}/api/drones/${droneId}/command`, 
      body,
      {
        headers: {
          Authorization: authHeader
        }
      }
    );
    
    // Return the response data
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error(`Error sending command to drone ${params.droneId}:`, error);
    
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    }, { status: error.response?.status || 500 });
  }
}