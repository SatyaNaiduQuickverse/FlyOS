import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check critical services
    const healthChecks = await Promise.allSettled([
      fetch('http://drone-connection-service:4005/health', { signal: AbortSignal.timeout(3000) }),
      fetch('http://realtime-service:4002/health', { signal: AbortSignal.timeout(3000) }),
      fetch('http://user-management-service:4003/health', { signal: AbortSignal.timeout(3000) })
    ]);

    const services = {
      'drone-connection': healthChecks[0].status === 'fulfilled' && healthChecks[0].value.ok,
      'realtime-service': healthChecks[1].status === 'fulfilled' && healthChecks[1].value.ok,
      'user-management': healthChecks[2].status === 'fulfilled' && healthChecks[2].value.ok
    };

    const allHealthy = Object.values(services).every(Boolean);

    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      version: process.env.npm_package_version || '1.0.0'
    }, { 
      status: allHealthy ? 200 : 503 
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
