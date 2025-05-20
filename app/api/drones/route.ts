// app/api/drones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ 
        success: false, 
        message: 'Authorization required' 
      }, { status: 401 });
    }
    
    // Forward the request to your drone-db-service
    const droneDbServiceUrl = process.env.DRONE_DB_SERVICE_URL || 'http://drone-db-service:4001';
    
    // Get the list of active drones from the database service
    const response = await axios.get(`${droneDbServiceUrl}/api/drones`, {
      headers: {
        Authorization: authHeader
      }
    });
    
    // Return the response data
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error fetching drones:', error);
    
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    }, { status: error.response?.status || 500 });
  }
}