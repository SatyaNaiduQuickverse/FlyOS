import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '../../../../types/auth';

// Mock users for demonstration
const MOCK_USERS = [
  {
    id: '1',
    username: 'main_admin',
    password: 'password', // In production, never store plain text passwords
    role: UserRole.MAIN_HQ,
    fullName: 'Main HQ Administrator',
    email: 'main@flyos.mil',
  },
  {
    id: '2',
    username: 'region_east',
    password: 'password',
    role: UserRole.REGIONAL_HQ,
    regionId: 'east',
    fullName: 'Eastern Region Commander',
    email: 'east@flyos.mil',
  },
  {
    id: '3',
    username: 'operator1',
    password: 'password',
    role: UserRole.OPERATOR,
    regionId: 'east',
    fullName: 'Field Operator Alpha',
    email: 'op1@flyos.mil',
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Find user by username and password
    const user = MOCK_USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // In a real app, you would use a proper JWT library
    // For demonstration, we'll create a simple token
    const token = `mock-jwt-token-${Date.now()}`;

    // Remove password before sending user data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...safeUser } = user;

    return NextResponse.json({
      message: 'Authentication successful',
      user: safeUser,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}