import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kjsfjekxgntwnffnehjf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqc2ZqZWt4Z250d25mZm5laGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDg0ODcsImV4cCI6MjA4NDgyNDQ4N30.f_emvDHa8vXqFj4EGcoqdMZq4zre0qqYwYEEi2h2F9s'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
