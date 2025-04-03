import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// For automatic migration application
async function main() {
  const connectionString = process.env.DATABASE_URL;
  const sql = postgres(connectionString, { max: 1 });

  // Apply schema changes to the database
  // This is equivalent to running `drizzle-kit push` but allows us to do it programmatically
  // and handle all tables as new (create mode)
  
  // Add tables field by field to avoid interactive prompts
  try {
    // Create teams table
    console.log("Creating teams table...");
    await sql`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_by INTEGER NOT NULL
      )
    `;
    
    // Create team_members table
    console.log("Creating team_members table...");
    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
        invited_by INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'invited',
        PRIMARY KEY (team_id, user_id)
      )
    `;
    
    // Create team_invitations table
    console.log("Creating team_invitations table...");
    await sql`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        invited_by INTEGER NOT NULL,
        invited_at TIMESTAMP DEFAULT NOW() NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP,
        token TEXT NOT NULL
      )
    `;
    
    // Add teamId to projects if it doesn't exist
    console.log("Adding teamId to projects table...");
    try {
      await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id INTEGER`;
    } catch (e) {
      console.log("Column team_id might already exist:", e.message);
    }
    
    console.log("Schema migration completed successfully!");
  } catch (e) {
    console.error("Error during schema migration:", e);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);