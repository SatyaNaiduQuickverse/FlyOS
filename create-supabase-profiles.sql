-- Create the profiles table that Supabase expects (without auth schema reference)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('MAIN_HQ', 'REGIONAL_HQ', 'OPERATOR')),
  region_id TEXT,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert your existing user into profiles (using the Supabase user ID)
INSERT INTO profiles (id, username, role, region_id, full_name)
VALUES (
  'a1c1a645-6b32-45bd-86c9-38c090b0a8e9'::UUID,  -- Your Supabase user ID from the token
  'main_admin',
  'MAIN_HQ',
  NULL,
  'Main HQ Administrator'
)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

-- Show the result
SELECT * FROM profiles;
