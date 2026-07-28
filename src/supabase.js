import { createClient } from '@supabase/supabase-js'

// ⚠️ REPLACE THESE TWO VALUES with your new Supabase project's
// URL and publishable (anon) key before committing.
const supabaseUrl = 'https://mnwmutnxzlickocqrwvj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ud211dG54emxpY2tvY3Fyd3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNDkzMTgsImV4cCI6MjEwMDgyNTMxOH0.XcVD5eqPmicztaQk-dXJopFMYjRMlDeicZpVk-uE_IY'

export const supabase = createClient(supabaseUrl, supabaseKey)
