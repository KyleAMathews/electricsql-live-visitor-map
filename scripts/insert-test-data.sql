-- Insert test visits from various cities around the world

-- North America
INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), 40.7128, -74.0060, 'United States', 'New York', NOW());

INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), 34.0522, -118.2437, 'United States', 'Los Angeles', NOW());

-- Europe
INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), 51.5074, -0.1278, 'United Kingdom', 'London', NOW());

INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), 48.8566, 2.3522, 'France', 'Paris', NOW());

-- Asia
INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), 35.6762, 139.6503, 'Japan', 'Tokyo', NOW());

INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), 22.3193, 114.1694, 'China', 'Hong Kong', NOW());

-- Australia
INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), -33.8688, 151.2093, 'Australia', 'Sydney', NOW());

-- South America
INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), -22.9068, -43.1729, 'Brazil', 'Rio de Janeiro', NOW());

-- Africa
INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), -33.9249, 18.4241, 'South Africa', 'Cape Town', NOW());

-- Middle East
INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen) VALUES (uuid_generate_v4(), uuid_generate_v4(), 25.2048, 55.2708, 'United Arab Emirates', 'Dubai', NOW());
