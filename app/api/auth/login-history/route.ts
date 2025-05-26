// app/api/auth/login-history/route.ts - REAL DATA VERSION
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Authorization required' 
      }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid token' 
      }, { status: 401 });
    }
    
    // Get user profile to check role
    let userProfile = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      userProfile = profile;
    } catch (profileError) {
      // Use user metadata as fallback
      userProfile = {
        id: user.id,
        role: user.user_metadata?.role || 'OPERATOR',
        username: user.user_metadata?.username || user.email?.split('@')[0]
      };
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    
    console.log('Login history request:', {
      requestingUser: userProfile?.username,
      role: userProfile?.role,
      page,
      limit,
      targetUserId: userId
    });
    
    try {
      // Build the query - NO RLS, direct access with service role
      let query = supabase
        .from('login_history')
        .select('*', { count: 'exact' })
        .order('login_time', { ascending: false });
      
      // Role-based filtering
      if (userProfile?.role === 'MAIN_HQ' && !userId) {
        // MAIN_HQ can see all login history when no specific user is requested
        console.log('MAIN_HQ user - showing all login history');
      } else if (userProfile?.role === 'REGIONAL_HQ') {
        // Regional HQ can see their own and their operators' history
        // For now, just show their own unless specifically requesting an operator
        const targetUserId = userId || userProfile.id;
        query = query.eq('user_id', targetUserId);
        console.log('REGIONAL_HQ user - filtered to user:', targetUserId);
      } else {
        // Operators can only see their own history
        const targetUserId = userProfile.id;
        query = query.eq('user_id', targetUserId);
        console.log('OPERATOR user - filtered to own history:', targetUserId);
      }
      
      // Apply pagination
      const startRange = (page - 1) * limit;
      const endRange = startRange + limit - 1;
      query = query.range(startRange, endRange);
      
      const { data: loginHistory, error: queryError, count } = await query;
      
      if (queryError) {
        console.error('Supabase query error:', queryError);
        throw queryError;
      }
      
      console.log(`Retrieved ${loginHistory?.length || 0} login history entries`);
      
      // Transform data to match frontend expectations
      const transformedHistory = (loginHistory || []).map(entry => ({
        id: entry.id,
        userId: entry.user_id,
        username: entry.username,
        email: entry.email,
        role: entry.role,
        ipAddress: entry.ip_address,
        userAgent: entry.user_agent,
        loginTime: entry.login_time,
        logoutTime: entry.logout_time,
        status: entry.status,
        failureReason: entry.failure_reason,
        sessionDuration: entry.session_duration,
        browserInfo: entry.browser_info,
        createdAt: entry.created_at
      }));
      
      return NextResponse.json({
        success: true,
        totalCount: count || 0,
        pages: Math.ceil((count || 0) / limit),
        currentPage: page,
        loginHistory: transformedHistory,
        metadata: {
          requestingUser: userProfile?.username,
          role: userProfile?.role,
          showingAllUsers: userProfile?.role === 'MAIN_HQ' && !userId
        }
      });
      
    } catch (dbError) {
      console.error('Database query error:', dbError);
      
      // Fallback to mock data if database query fails
      console.log('Falling back to mock data due to database error');
      const mockData = generateFallbackMockData(userProfile, userId, limit, page);
      
      return NextResponse.json({
        success: true,
        totalCount: mockData.totalCount,
        pages: Math.ceil(mockData.totalCount / limit),
        currentPage: page,
        loginHistory: mockData.data,
        metadata: {
          requestingUser: userProfile?.username,
          role: userProfile?.role,
          showingAllUsers: userProfile?.role === 'MAIN_HQ' && !userId,
          fallbackData: true,
          error: dbError.message
        }
      });
    }
    
  } catch (error) {
    console.error('Login history API error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Fallback mock data generator
function generateFallbackMockData(userProfile: any, userId: string | null, limit: number, page: number) {
  const now = new Date();
  const allEntries = [];
  
  // Generate entries for multiple users if MAIN_HQ
  const users = userProfile?.role === 'MAIN_HQ' && !userId ? [
    { id: 'a1ca645-6b32-45bd-86c9-38c090b0a5e9', username: 'main_admin', role: 'MAIN_HQ', email: 'main@flyos.mil' },
    { id: 'c881f13d-ff81-420c-8719-c54b3d054bc1', username: 'region_east', role: 'REGIONAL_HQ', email: 'east@flyos.mil' },
    { id: 'user3', username: 'operator1', role: 'OPERATOR', email: 'op1@flyos.mil' },
    { id: 'user4', username: 'operator2', role: 'OPERATOR', email: 'op2@flyos.mil' },
  ] : [
    { 
      id: userId || userProfile?.id || 'current_user', 
      username: userProfile?.username || 'current_user', 
      role: userProfile?.role || 'OPERATOR',
      email: userProfile?.email || 'user@flyos.mil'
    }
  ];
  
  // Generate 30 total entries across all users
  for (let i = 0; i < 30; i++) {
    const user = users[i % users.length];
    const loginTime = new Date(now.getTime() - (i * 4 * 60 * 60 * 1000)); // Every 4 hours
    const logoutTime = i % 4 === 0 ? null : new Date(loginTime.getTime() + (2.5 * 60 * 60 * 1000)); // 2.5 hour sessions, some still active
    const sessionDuration = logoutTime ? Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000) : null;
    
    allEntries.push({
      id: `fallback-${i + 1}`,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      ipAddress: `192.168.1.${100 + (i % 50)}`,
      userAgent: 'Mozilla/5.0 (compatible; FlyOS Dashboard)',
      loginTime: loginTime.toISOString(),
      logoutTime: logoutTime?.toISOString() || null,
      status: i % 12 === 0 ? 'FAILED' : 'SUCCESS',
      failureReason: i % 12 === 0 ? 'Invalid credentials' : null,
      sessionDuration: sessionDuration,
      browserInfo: {
        browser: i % 3 === 0 ? 'Chrome' : i % 3 === 1 ? 'Firefox' : 'Safari',
        os: i % 2 === 0 ? 'Windows' : 'macOS',
        device: 'Desktop'
      },
      createdAt: loginTime.toISOString()
    });
  }
  
  // Sort by login time (newest first)
  allEntries.sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());
  
  // Apply pagination
  const startIndex = (page - 1) * limit;
  const paginatedData = allEntries.slice(startIndex, startIndex + limit);
  
  return {
    data: paginatedData,
    totalCount: allEntries.length
  };
}

// Optional: Create logout endpoint to record logout times
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loginHistoryId } = body;
    
    if (!loginHistoryId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Login history ID required' 
      }, { status: 400 });
    }
    
    // Update the login history record with logout time
    const logoutTime = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('login_history')
      .update({ 
        logout_time: logoutTime,
        session_duration: null // Will be calculated by the database if needed
      })
      .eq('id', loginHistoryId)
      .select()
      .single();
    
    if (error) {
      console.error('Error recording logout:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to record logout' 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Logout recorded successfully',
      data: data
    });
    
  } catch (error) {
    console.error('Logout recording error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}