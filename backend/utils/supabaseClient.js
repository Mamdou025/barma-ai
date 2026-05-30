const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Fail loudly and clearly at startup if the credentials are missing, instead of
// letting requests fail later with an opaque "Error fetching documents".
const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');
if (missing.length) {
  console.error(
    `❌ Missing Supabase environment variable(s): ${missing.join(', ')}. ` +
    `Set them in the backend environment (.env locally or the host's config).`
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Exposed so routes can report *why* a query failed without leaking secrets.
const supabaseConfig = {
  hasUrl: Boolean(SUPABASE_URL),
  hasServiceKey: Boolean(SUPABASE_SERVICE_KEY),
};

module.exports = { supabase, supabaseConfig };
