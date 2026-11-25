import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://ermsfysxuxnddjxbvtzw.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_mNDFH8utOPgjPhrGHqdu8w_RquSRsNy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
