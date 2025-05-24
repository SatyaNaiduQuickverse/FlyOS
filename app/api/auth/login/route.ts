// app/api/auth/login/route.ts - SUPABASE VERSION
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    console.log(`Supabase authentication successful: ${user.username} (${user.role})`);

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      sessionId: data.session.access_token
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
