import { supabase } from './utils/supabaseClient.js';

async function testConnection() {
  const { data, error } = await supabase.from('documents').select('*').limit(1);
  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
  } else {
    console.log('✅ Supabase is connected. Sample data:', data);
  }
}

testConnection();
