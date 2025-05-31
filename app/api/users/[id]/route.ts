// app/api/users/[id]/route.ts - Proxy for user operations by ID
import { NextRequest, NextResponse } from 'next/server';

const USER_SERVICE_URL = process.env.USER_MANAGEMENT_SERVICE_URL || 'http://user-management-service:4003';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    
    const response = await fetch(`${USER_SERVICE_URL}/api/users/${params.id}`, {
      headers: { Authorization: authHeader || '' }
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();
    
    const response = await fetch(`${USER_SERVICE_URL}/api/users/${params.id}`, {
      method: 'PUT',
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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    
    const response = await fetch(`${USER_SERVICE_URL}/api/users/${params.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader || '' }
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Service unavailable' }, { status: 503 });
  }
}