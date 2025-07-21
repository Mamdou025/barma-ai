const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

let cachedRules = null;

function getRules() {
  if (!cachedRules) {
    const file = path.join(__dirname, '..', 'rules.yml');
    try {
      const contents = fs.readFileSync(file, 'utf8');
      cachedRules = yaml.load(contents) || {};
    } catch (err) {
      console.error('Failed to load rules.yml:', err);
      cachedRules = {};
    }
  }
  return cachedRules;
}

module.exports = { getRules };
