import { createClient } from '@supabase/supabase-js'

// ⚠️ REPLACE THESE TWO VALUES with your new Supabase project's
// URL and publishable (anon) key before committing.
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)
