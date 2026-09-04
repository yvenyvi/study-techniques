const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kcwlzexmmjbbarltxfvv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjd2x6ZXhtbWpiYmFybHR4ZnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODUxNzM4MiwiZXhwIjoyMTA0MDkzMzgyfQ.qhQZgcbODNCTDObDnUkAHJYaXfNHrO7SUkKtEYcgbEM');

// We need to run SQL to create policies, but supabase-js via rest can't easily execute raw SQL.
// We can use the postgres connection string or an RPC if one exists.
// Wait, the user gave us the database password: 8LRqNBssVJlVCtAh
// So we can connect to the postgres database and run SQL.
// I can use `psql` if it is installed, or node-postgres.
