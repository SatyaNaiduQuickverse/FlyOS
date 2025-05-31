// app/api/users/route.ts - Proxy to user-management-service
import { NextRequest, NextResponse } from 'next/server';

const USER_SERVICE_URL = process.env.USER_MANAGEMENT_SERVICE_URL || 'http://user-management-service:4003';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const searchParams = request.nextUrl.searchParams;
    
    const response = await fetch(`${USER_SERVICE_URL}/api/users?${searchParams}`, {
      headers: {
        Authorization: authHeader || '',
      }
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();
    
    const response = await fetch(`${USER_SERVICE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader || ''
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 });
  }
}