const fs = require('fs');

// Read .env.local file directly
function loadEnvFromFile(filePath) {
  const env = {};
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.trim() === '' || line.startsWith('#')) continue;
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1'); // Remove quotes if present
      env[key.trim()] = value;
    }
  } catch (error) {
    console.error('Error reading .env.local:', error);
  }
  return env;
}

const env = loadEnvFromFile('./.env.local');

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key exists:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Simple test to verify we can connect
console.log('Testing connection to Supabase...');

// Make a simple HTTP request to test the URL
const https = require('https');

const url = new URL(supabaseUrl);
const options = {
  hostname: url.hostname,
  port: 443,
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': supabaseServiceKey,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log('✅ Connection successful!');
  } else {
    console.log('❌ Connection failed');
  }
});

req.on('error', (error) => {
  console.error('Connection error:', error.message);
});

req.end();