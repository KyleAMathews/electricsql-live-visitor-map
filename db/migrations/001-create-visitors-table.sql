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
