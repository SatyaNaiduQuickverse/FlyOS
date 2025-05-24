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
    
    console.log('Forwarding request to:', `${droneDbServiceUrl}/api/drones`);
    console.log('With authorization:', authHeader.substring(0, 20) + '...');
    
    // Get the list of active drones from the database service
    const response = await axios.get(`${droneDbServiceUrl}/api/drones`, {
      headers: {
        Authorization: authHeader
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('Backend response status:', response.status);
    console.log('Backend response data:', response.data);
    
    // Return the response data
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error fetching drones:', error.message);
    
    if (error.response) {
      console.error('Backend error status:', error.response.status);
      console.error('Backend error data:', error.response.data);
      
      return NextResponse.json(
        error.response.data || { 
          success: false, 
          message: 'Backend service error' 
        }, 
        { status: error.response.status }
      );
    }
    
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error: ' + error.message 
    }, { status: 500 });
  }
}
