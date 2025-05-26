// app/api/auth/login/route.ts - UPDATED TO RECORD REAL LOGIN HISTORY
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback - this won't be the real IP in production behind a proxy
  return '0.0.0.0';
}

// Helper function to parse user agent
function parseBrowserInfo(userAgent: string | null) {
  if (!userAgent) return {};
  
  const browserInfo: any = {
    raw: userAgent,
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Desktop'
  };
  
  // Simple browser detection
  if (userAgent.includes('Chrome')) browserInfo.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browserInfo.browser = 'Firefox';
  else if (userAgent.includes('Safari')) browserInfo.browser = 'Safari';
  else if (userAgent.includes('Edge')) browserInfo.browser = 'Edge';
  
  // Simple OS detection
  if (userAgent.includes('Windows')) browserInfo.os = 'Windows';
  else if (userAgent.includes('Mac OS')) browserInfo.os = 'macOS';
  else if (userAgent.includes('Linux')) browserInfo.os = 'Linux';
  else if (userAgent.includes('Android')) browserInfo.os = 'Android';
  else if (userAgent.includes('iOS')) browserInfo.os = 'iOS';
  
  // Simple device detection
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    browserInfo.device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    browserInfo.device = 'Tablet';
  }
  
  return browserInfo;
}

// Function to record login attempt
async function recordLoginHistory(
  user: any,
  profile: any,
  request: NextRequest,
  status: 'SUCCESS' | 'FAILED' | 'EXPIRED' = 'SUCCESS',
  failureReason?: string
) {
  try {
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent');
    const browserInfo = parseBrowserInfo(userAgent);
    
    const loginHistoryData = {
      user_id: user?.id || null,
      username: profile?.username || user?.email?.split('@')[0] || 'unknown',
      email: user?.email || 'unknown@email.com',
      role: profile?.role || user?.user_metadata?.role || 'OPERATOR',
      ip_address: ip,
      user_agent: userAgent || 'Unknown',
      status,
      failure_reason: failureReason || null,
      browser_info: browserInfo,
      login_time: new Date().toISOString()
    };
    
    console.log('Recording login history:', {
      username: loginHistoryData.username,
      status: loginHistoryData.status,
      ip: loginHistoryData.ip_address
    });
    
    const { data, error } = await supabase
      .from('login_history')
      .insert([loginHistoryData])
      .select()
      .single();
    
    if (error) {
      console.error('Failed to record login history:', error);
      // Don't fail the login if history recording fails
      return null;
    }
    
    console.log('Login history recorded successfully:', data.id);
    return data;
    
  } catch (error) {
    console.error('Error recording login history:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log(`Supabase login attempt for: ${email}`);

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('Supabase auth error:', error.message);
      
      // Record failed login attempt
      await recordLoginHistory(
        { email }, 
        null, 
        request, 
        'FAILED', 
        error.message
      );
      
      return NextResponse.json(
        { 
          success: false,
          message: 'Invalid credentials' 
        },
        { status: 401 }
      );
    }

    if (!data.user || !data.session) {
      // Record failed login attempt
      await recordLoginHistory(
        { email }, 
        null, 
        request, 
        'FAILED', 
        'No user or session returned'
      );
      
      return NextResponse.json(
        { 
          success: false,
          message: 'Authentication failed' 
        },
        { status: 401 }
      );
    }

    // Get user profile
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (!profileError) {
        profile = profileData;
      }
    } catch (profileError) {
      console.warn('Profile not found, using user metadata');
    }

    // Create user object (use profile if available, otherwise metadata)
    const user = {
      id: data.user.id,
      username: profile?.username || data.user.user_metadata?.username || data.user.email?.split('@')[0],
      role: profile?.role || data.user.user_metadata?.role || 'OPERATOR',
      regionId: profile?.region_id || data.user.user_metadata?.region_id,
      fullName: profile?.full_name || data.user.user_metadata?.full_name || 'User',
      email: data.user.email,
    };

    // Record successful login
    const loginHistory = await recordLoginHistory(
      data.user,
      profile || user,
      request,
      'SUCCESS'
    );

    console.log(`Supabase authentication successful: ${user.username} (${user.role})`);
    
    // Return success response with login history ID for potential logout tracking
    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      sessionId: data.session.access_token,
      loginHistoryId: loginHistory?.id // For logout tracking
    });

  } catch (error) {
    console.error('Supabase login error:', error);
    
    // Record failed login attempt
    await recordLoginHistory(
      null, 
      null, 
      request, 
      'FAILED', 
      'Internal server error'
    );
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}