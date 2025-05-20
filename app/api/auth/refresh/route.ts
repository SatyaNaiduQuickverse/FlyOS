// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;
    
    if (!refreshToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'Refresh token is required' 
      }, { status: 400 });
    }
    
    // Forward to auth service
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:4000';
    const response = await axios.post(`${authServiceUrl}/auth/refresh`, 
      { refreshToken },
      { 
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    // Return the response from auth service
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Token refresh error:', error);
    
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to refresh token' 
    }, { status: error.response?.status || 500 });
  }
}