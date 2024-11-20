import postgres from 'postgres';

const DATABASE_URL = 'postgresql://postgres:password@localhost:64321/visitormap?sslmode=disable';

export const sql = postgres(
  typeof process !== 'undefined' 
    ? DATABASE_URL 
    : (import.meta.env.DATABASE_URL || DATABASE_URL)
);

// Initialize the database
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS visitors (
      id UUID PRIMARY KEY,
      latitude DECIMAL,
      longitude DECIMAL,
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      visitor_id UUID,
      country TEXT,
      city TEXT,
      visit_count INTEGER DEFAULT 1
    );
  `;
}
