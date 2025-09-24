import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key must be provided in environment variables.')
}

export const getSupabaseBrowserClient = (() => {
  let client: ReturnType<typeof createClient> | null = null
  return () => {
    if (!client) {
      client = createClient(supabaseUrl, supabaseAnonKey)
    }
    return client
  }
})()
