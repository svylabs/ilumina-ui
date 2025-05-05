// Script to push schema changes to the database without prompting
import pg from 'pg';
const { Pool } = pg;

// Create a database client
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    console.log('Connecting to the database...');
    
    // Execute a simple query to verify DB connection
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Check if chat_messages table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'chat_messages'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    if (!tableExists) {
      console.log('Creating chat_messages table...');
      await pool.query(`
        CREATE TABLE chat_messages (
          id SERIAL PRIMARY KEY,
          submission_id UUID NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
          classification JSONB,
          action_taken BOOLEAN DEFAULT FALSE,
          section TEXT DEFAULT 'general',
          conversation_id TEXT NOT NULL DEFAULT gen_random_uuid()::text
        );
      `);
      console.log('chat_messages table created successfully!');
    } else {
      console.log('chat_messages table already exists, ensuring conversation_id is not null');
      
      // First check if conversation_id column exists
      const columnCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'chat_messages' 
          AND column_name = 'conversation_id'
        );
      `);
      
      const columnExists = columnCheck.rows[0].exists;
      
      if (columnExists) {
        // Modify existing column
        await pool.query(`
          DO $$ 
          BEGIN
            -- First set a default for existing NULL rows
            UPDATE chat_messages 
            SET conversation_id = gen_random_uuid()::text 
            WHERE conversation_id IS NULL;
            
            -- Then alter to make NOT NULL if needed
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'chat_messages' 
              AND column_name = 'conversation_id' 
              AND is_nullable = 'YES'
            ) THEN
              ALTER TABLE chat_messages 
              ALTER COLUMN conversation_id SET NOT NULL;
              RAISE NOTICE 'conversation_id modified to be NOT NULL';
            ELSE
              RAISE NOTICE 'Column conversation_id is already NOT NULL';
            END IF;
            
            -- Set a default for new rows
            ALTER TABLE chat_messages 
            ALTER COLUMN conversation_id SET DEFAULT gen_random_uuid()::text;
          END;
          $$;
        `);
      } else {
        // Add the column if it doesn't exist
        await pool.query(`
          ALTER TABLE chat_messages
          ADD COLUMN conversation_id TEXT NOT NULL DEFAULT gen_random_uuid()::text;
        `);
      }
      
      console.log('Schema updated successfully!');
    }
  } catch (error) {
    console.error('Error updating schema:', error);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

main();
