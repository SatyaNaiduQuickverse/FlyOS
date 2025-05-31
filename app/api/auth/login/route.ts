// app/api/auth/login/route.ts - FIXED WITH PROFILE VALIDATION FIRST
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
  
  if (userAgent.includes('Chrome')) browserInfo.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browserInfo.browser = 'Firefox';
  else if (userAgent.includes('Safari')) browserInfo.browser = 'Safari';
  else if (userAgent.includes('Edge')) browserInfo.browser = 'Edge';
  
  if (userAgent.includes('Windows')) browserInfo.os = 'Windows';
  else if (userAgent.includes('Mac OS')) browserInfo.os = 'macOS';
  else if (userAgent.includes('Linux')) browserInfo.os = 'Linux';
  else if (userAgent.includes('Android')) browserInfo.os = 'Android';
  else if (userAgent.includes('iOS')) browserInfo.os = 'iOS';
  
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
      user_id: profile?.id || user?.id || null,
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
      return NextResponse.json(
        { 
          success: false,
          message: 'Authentication failed' 
        },
        { status: 401 }
      );
    }

    // PROFILE VALIDATION FIRST - Before any login history recording
    console.log('🚨 VALIDATION CHECK STARTING for:', data.user.email);
    let profile = null;
    try {
      const serviceUrl = process.env.USER_MANAGEMENT_SERVICE_URL || 'http://user-management-service:4003';
      console.log('🔍 Attempting to fetch profile from:', serviceUrl);
      
      const response = await fetch(`${serviceUrl}/api/users`, {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });
      
      console.log('📡 Profile fetch response status:', response.status);
      
      if (!response.ok) {
        console.log('❌ Profile fetch failed with status:', response.status);
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }
      
      const userData = await response.json();
      console.log('📊 Fetched users count:', userData.users?.length || 0);
      profile = userData.users?.find((u: any) => u.email === data.user.email);
      console.log('🔍 Profile search result for', data.user.email, ':', profile ? 'FOUND' : 'NOT FOUND');
      
      if (!profile) {
        console.log('❌ Profile not found in local database for:', data.user.email);
        
        return NextResponse.json(
          { 
            success: false,
            message: 'Account not found. Please contact administrator.' 
          },
          { status: 403 }
        );
      }
      
      if (profile.status !== 'ACTIVE') {
        console.log('❌ Profile status inactive for:', data.user.email, 'Status:', profile.status);
        
        return NextResponse.json(
          { 
            success: false,
            message: 'Account disabled. Please contact administrator.' 
          },
          { status: 403 }
        );
      }

    } catch (profileError) {
      console.error('Profile validation error:', profileError);
      
      return NextResponse.json(
        { 
          success: false,
          message: 'Account not found. Please contact administrator.' 
        },
        { status: 403 }
      );
    }

    // Profile validation passed - Create user object
    const user = {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      regionId: profile.regionId,
      fullName: profile.fullName,
      email: profile.email,
    };

    // Record successful login with valid profile
    const loginHistory = await recordLoginHistory(
      data.user,
      profile,
      request,
      'SUCCESS'
    );

    console.log(`✅ Authentication successful: ${user.username} (${user.role})`);
    
    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      sessionId: data.session.access_token,
      loginHistoryId: loginHistory?.id
    });

  } catch (error) {
    console.error('Supabase login error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}