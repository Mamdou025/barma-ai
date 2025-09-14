const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { createClient } = require('@supabase/supabase-js');

// Base in-memory registry of alias -> { name, sector }
// Keys are stored in lowercase for case-insensitive lookup.
let registry = {
  acme: { name: 'ACME Corporation', sector: 'manufacturing' },
  globex: { name: 'Globex Corporation', sector: 'technology' }
};

function loadYamlRegistry() {
  try {
    const file = path.join(__dirname, 'entityRegistry.yaml');
    if (!fs.existsSync(file)) return {};
    const data = yaml.load(fs.readFileSync(file, 'utf8')) || {};
    const map = {};
    for (const [alias, info] of Object.entries(data)) {
      if (info && info.name) {
        map[alias.toLowerCase()] = {
          name: info.name,
          sector: info.sector || null
        };
      }
    }
    return map;
  } catch (err) {
    console.error('Failed to load entity registry from YAML', err);
    return {};
  }
}

async function loadSupabaseRegistry() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return {};
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from('entity_registry')
      .select('alias,name,sector');
    if (error) throw error;
    const map = {};
    for (const row of data) {
      if (row.alias && row.name) {
        map[row.alias.toLowerCase()] = {
          name: row.name,
          sector: row.sector || null
        };
      }
    }
    return map;
  } catch (err) {
    console.error('Failed to load entity registry from Supabase', err);
    return {};
  }
}

function preloadRegistry() {
  registry = { ...registry, ...loadYamlRegistry() };
}

preloadRegistry();

async function preloadFromSupabase() {
  const data = await loadSupabaseRegistry();
  registry = { ...registry, ...data };
}

function resolveEntities(names = []) {
  const seen = new Set();
  return names
    .map(n => n && n.toLowerCase())
    .filter(Boolean)
    .map(alias => {
      const entry = registry[alias];
      return entry ? entry : { name: alias, sector: null };
    })
    .filter(entry => {
      const key = entry.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

module.exports = { resolveEntities, preloadFromSupabase };
