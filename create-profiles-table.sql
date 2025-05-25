-- Create profiles table that mirrors your Supabase users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR')),
  region_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Insert the user that matches your Supabase user
INSERT INTO profiles (id, username, role, region_id, full_name, email)
VALUES (
  'a1c1a645-6b32-45bd-86c9-38c090b0a8e9'::UUID,  -- Your Supabase user ID
  'main_admin',
  'MAIN_HQ',
  NULL,
  'Main HQ Administrator',
  'main@flyos.mil'
)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email;

-- Verify the profile was created
SELECT * FROM profiles;
