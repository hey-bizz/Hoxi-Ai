#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function testUpload() {
  console.log('🧪 Testing upload server logs flow...');

  const testFilePath = '/Users/aryansmac/Desktop/Bizz/Hoxi_AI/Test_data/bangaloretitans.com-web-logs-20250907183000-20250913183000.csv';

  // Check if file exists
  if (!fs.existsSync(testFilePath)) {
    console.error('❌ Test file not found:', testFilePath);
    return;
  }

  console.log('📁 Reading test file:', testFilePath);
  const fileBuffer = fs.readFileSync(testFilePath);
  const fileStats = fs.statSync(testFilePath);

  console.log('📊 File info:');
  console.log(`   Size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Lines: ${fileBuffer.toString().split('\n').length}`);

  // Create FormData
  const formData = new FormData();
  const file = new File([fileBuffer], path.basename(testFilePath), { type: 'text/csv' });
  formData.append('files', file);
  formData.append('websiteId', '550e8400-e29b-41d4-a716-446655440000'); // Valid UUID
  formData.append('dryRun', 'true'); // Use dry-run to avoid database writes

  console.log('🚀 Uploading to localhost:3000...');

  try {
    const response = await fetch('http://localhost:3000/api/process-logs', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Upload successful!');
      console.log('📈 Results:');
      console.log(`   Total entries: ${result.stats?.totalEntries || 0}`);
      console.log(`   Bot requests: ${result.stats?.botRequests || 0}`);
      console.log(`   Human requests: ${result.stats?.humanRequests || 0}`);
      console.log(`   Total bytes: ${result.stats?.totalBytes || 0}`);
      console.log(`   Potential savings: $${result.stats?.potentialSavings || 0}/month`);
      console.log(`   Message: ${result.message}`);
    } else {
      console.error('❌ Upload failed:', result.error);
      console.error('Response status:', response.status);
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.log('💡 Make sure the dev server is running on port 3000');
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testUpload().catch(console.error);
}