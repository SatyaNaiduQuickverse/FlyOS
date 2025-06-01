import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://drone-connection-service:4005/status');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ connectedDrones: {}, totalConnected: 0 });
  }
}