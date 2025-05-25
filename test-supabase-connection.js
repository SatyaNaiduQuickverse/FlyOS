const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ftktazhukuquenyshvka.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0a3Rhemh1a3VxdWVueXNodmthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODAzMTA0OCwiZXhwIjoyMDYzNjA3MDQ4fQ.lF9pnk_8R52ARVSWOWCV8DhDZ9RXIdfkRA6FxZ4WCWk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test with your actual token
    const token = 'eyJhbGciOiJIUzI1NiIsImtpZCI6Ijl0RDIwL3BzeVphdklNazgiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2Z0a3Rhemh1a3VxdWVueXNodmthLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJhMWMxYTY0NS02YjMyLTQ1YmQtODZjOS0zOGMwOTBiMGE4ZTkiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQ4MTcyNDI3LCJpYXQiOjE3NDgxNjg4MjcsImVtYWlsIjoibWFpbkBmbHlvcy5taWwiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImZ1bGxfbmFtZSI6Ik1haW4gSFEgQWRtaW5pc3RyYXRvciIsInJvbGUiOiJNQUlOX0hRIiwidXNlcm5hbWUiOiJtYWluX2FkbWluIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NDgxNjg4Mjd9XSwic2Vzc2lvbl9pZCI6IjlkZTgyMzFjLWQzZTctNDU0NS04YTNiLWFjNGZhNWJkMzBkNCIsImlzX2Fub255bW91cyI6ZmFsc2V9.DrNtbgNWn24Hn_HCO7FFW5aORdozrJgl6jiEGqJv6jo';
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('❌ Supabase auth error:', error.message);
      console.log('Full error:', error);
    } else if (user) {
      console.log('✅ Supabase user found:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- User metadata:', user.user_metadata);
      console.log('- App metadata:', user.app_metadata);
    } else {
      console.log('❌ No user found but no error');
    }
  } catch (err) {
    console.log('❌ Connection error:', err.message);
  }
}

testConnection();
