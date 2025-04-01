import dotenv from 'dotenv';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Create the project_files table directly with SQL
async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  
  console.log('Creating project_files table...');
  
  try {
    // Check if the table already exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'project_files'
      );
    `;
    
    if (!tableExists[0].exists) {
      console.log('Creating project_files table...');
      
      await sql`
        CREATE TABLE IF NOT EXISTS project_files (
          id SERIAL PRIMARY KEY,
          submission_id UUID NOT NULL,
          project_name TEXT NOT NULL,
          project_summary TEXT NOT NULL,
          dev_environment TEXT NOT NULL,
          compiler TEXT NOT NULL,
          contracts JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `;
      console.log('project_files table created successfully!');
    } else {
      console.log('project_files table already exists.');
    }
  } catch (error) {
    console.error('Error creating project_files table:', error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);