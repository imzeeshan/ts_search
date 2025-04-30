import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const createClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseKey);
};