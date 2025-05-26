// app/api/auth/refresh/route.ts - FIXED FOR SUPABASE ONLY
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    
    console.log('Refreshing Supabase session...');
    
    // Use Supabase to refresh the session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });
    
    if (error) {
      console.error('Supabase refresh error:', error.message);
      return NextResponse.json({
        success: false,
        message: error.message
      }, { status: 401 });
    }
    
    if (!data.session) {
      return NextResponse.json({
        success: false,
        message: 'Failed to refresh session'
      }, { status: 401 });
    }
    
    // Get user profile if needed
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
      console.warn('Profile not found during refresh, using user metadata');
    }
    
    // Create user object
    const user = {
      id: data.user.id,
      username: profile?.username || data.user.user_metadata?.username || data.user.email?.split('@')[0],
      role: profile?.role || data.user.user_metadata?.role || 'OPERATOR',
      regionId: profile?.region_id || data.user.user_metadata?.region_id,
      fullName: profile?.full_name || data.user.user_metadata?.full_name || 'User',
      email: data.user.email,
    };
    
    console.log('Supabase session refreshed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user,
      sessionId: data.session.access_token
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}