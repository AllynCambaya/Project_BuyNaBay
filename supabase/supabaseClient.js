// supabase/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phkrehgybzmqgvxnmlhk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoa3JlaGd5YnptcWd2eG5tbGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1ODg4NzQsImV4cCI6MjA3MDE2NDg3NH0.LRRfFk4ovn4LrEMpCcxCURp0LLJgz3TkZ6PpZ5FVX6g';

export const supabase = createClient(supabaseUrl, supabaseKey);
