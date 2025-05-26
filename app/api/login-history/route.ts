// app/api/auth/login-history/route.ts - NEW FILE FOR LOGIN HISTORY
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
        role: user.user_metadata?.role || 'OPERATOR',
        username: user.user_metadata?.username || user.email?.split('@')[0]
      };
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // For now, let's generate mock data since we don't have login_history table in Supabase yet
    // In a real implementation, you would query your login_history table
    
    const mockLoginHistory = generateMockLoginHistory(userProfile, userId, limit, offset);
    
    return NextResponse.json({
      success: true,
      totalCount: mockLoginHistory.totalCount,
      pages: Math.ceil(mockLoginHistory.totalCount / limit),
      currentPage: page,
      loginHistory: mockLoginHistory.data
    });
    
  } catch (error) {
    console.error('Login history error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}

// Generate mock login history data
function generateMockLoginHistory(userProfile: any, userId: string | null, limit: number, offset: number) {
  const now = new Date();
  const allEntries = [];
  
  // Generate entries for multiple users if MAIN_HQ
  const users = userProfile?.role === 'MAIN_HQ' && !userId ? [
    { id: 'user1', username: 'main_admin', role: 'MAIN_HQ' },
    { id: 'user2', username: 'region_east', role: 'REGIONAL_HQ' },
    { id: 'user3', username: 'operator1', role: 'OPERATOR' },
    { id: 'user4', username: 'operator2', role: 'OPERATOR' },
  ] : [
    { id: userId || userProfile?.id || 'current_user', username: userProfile?.username || 'current_user', role: userProfile?.role || 'OPERATOR' }
  ];
  
  // Generate 50 total entries across all users
  for (let i = 0; i < 50; i++) {
    const user = users[i % users.length];
    const loginTime = new Date(now.getTime() - (i * 3 * 60 * 60 * 1000)); // Every 3 hours
    const logoutTime = i % 5 === 0 ? null : new Date(loginTime.getTime() + (2 * 60 * 60 * 1000)); // 2 hour sessions, some still active
    const sessionDuration = logoutTime ? Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000) : null;
    
    allEntries.push({
      id: `entry-${i + 1}`,
      userId: user.id,
      username: user.username,
      ipAddress: `192.168.1.${100 + (i % 50)}`,
      userAgent: 'Mozilla/5.0 (compatible; FlyOS Dashboard)',
      loginTime: loginTime.toISOString(),
      logoutTime: logoutTime?.toISOString() || null,
      status: i % 15 === 0 ? 'FAILED' : 'SUCCESS',
      failureReason: i % 15 === 0 ? 'Invalid credentials' : null,
      sessionDuration: sessionDuration,
    });
  }
  
  // Sort by login time (newest first)
  allEntries.sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());
  
  // Apply pagination
  const paginatedData = allEntries.slice(offset, offset + limit);
  
  return {
    data: paginatedData,
    totalCount: allEntries.length
  };
}

// Alternative: Real implementation using Supabase login_history table
// Uncomment this when you create the login_history table in Supabase
/*
async function getRealLoginHistory(userProfile: any, userId: string | null, limit: number, offset: number) {
  try {
    let query = supabase
      .from('login_history')
      .select('*', { count: 'exact' })
      .order('login_time', { ascending: false })
      .range(offset, offset + limit - 1);

    // Role-based filtering
    if (userProfile?.role !== 'MAIN_HQ' || userId) {
      const targetUserId = userId || userProfile?.id;
      query = query.eq('user_id', targetUserId);
    }

    const { data, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    return {
      data: data || [],
      totalCount: count || 0
    };
  } catch (error) {
    console.error('Error fetching login history from Supabase:', error);
    throw error;
  }
}
*/