#!/usr/bin/env node

/**
 * Script to populate dashboard with sample detection data
 * Run with: node scripts/populate-dashboard-data.js
 */

const websiteId = process.argv[2] || 'example-com'

async function populateData() {
  try {
    console.log(`🔄 Populating dashboard data for website: ${websiteId}`)

    const response = await fetch('http://localhost:3000/api/generate-sample-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        websiteId: websiteId,
        timeRange: '24h'
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Success:', result.message)
      console.log('📊 Stats:', result.stats)
      console.log(`🌐 Website ID: ${result.websiteId}`)
      console.log('\n🎯 Dashboard should now show real data!')
      console.log(`   Visit: http://localhost:3000/dashboard?websiteId=${result.websiteId}`)
    } else {
      console.error('❌ Error:', result.error)
    }
  } catch (error) {
    console.error('❌ Failed to populate data:', error.message)
    console.log('\n💡 Make sure your Next.js development server is running on port 3000')
  }
}

populateData()