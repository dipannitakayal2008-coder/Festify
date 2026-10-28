import { supabase } from './supabaseClient'

export async function testSupabase() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Supabase test failed:', error.message)
    return
  }

  console.log('Supabase connected!', data)
}
