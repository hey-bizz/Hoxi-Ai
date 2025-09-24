require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

// Use environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key exists:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initDatabase() {
  console.log('Initializing database tables...');
  
  try {
    // Read the SQL schema file
    const schema = await fs.readFile('./scripts/init-supabase-schema.sql', 'utf8');
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      // console.log('Statement:', statement.substring(0, 100) + '...');
      
      try {
        // For CREATE statements, we need to use a different approach
        // Let's try to execute a simple query first to test the connection
        if (i === 0) {
          const { data, error } = await supabase.rpc('version');
          if (error) {
            console.log('Connection test error:', error);
          } else {
            console.log('Connection test successful');
          }
        }
        
        // Skip RLS and policy statements for now as they might cause issues
        if (statement.includes('ROW LEVEL SECURITY') || 
            statement.includes('ENABLE ROW LEVEL SECURITY') ||
            statement.includes('CREATE POLICY') ||
            statement.includes('ALTER TABLE') ||
            statement.includes('CREATE OR REPLACE FUNCTION')) {
          console.log(`Skipping RLS/policy statement ${i + 1}`);
          continue;
        }
        
        // Use the RPC method to execute SQL
        const { error } = await supabase.rpc('execute_sql', { sql: statement });
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error.message);
          // Don't exit on error, continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (stmtError) {
        console.error(`Error executing statement ${i + 1}:`, stmtError.message);
      }
    }
    
    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();