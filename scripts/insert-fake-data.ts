import { faker } from '@faker-js/faker';
import { sql } from '../src/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Major cities around the world with their coordinates
const cities = [
  { name: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
  { name: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241 },
  { name: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050 },
  { name: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173 },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
  { name: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 }
];

async function insertFakeData() {
  // Generate between 50-100 visitors
  const numVisitors = faker.number.int({ min: 50, max: 100 });
  const visitors = new Set();

  console.log(`Inserting ${numVisitors} visitors...`);

  for (let i = 0; i < numVisitors; i++) {
    // Generate a visitor ID that will be reused for repeat visits
    const visitorId = uuidv4();
    visitors.add(visitorId);

    // Generate 1-10 visits for this visitor
    const numVisits = faker.number.int({ min: 1, max: 10 });

    for (let j = 0; j < numVisits; j++) {
      // Pick a random city
      const city = cities[faker.number.int({ min: 0, max: cities.length - 1 })];
      
      // Add some random variation to the coordinates to spread out the points
      const latitude = city.lat + (faker.number.float() - 0.5) * 2;
      const longitude = city.lng + (faker.number.float() - 0.5) * 2;

      // Insert the visit with a random timestamp from the last month
      const timestamp = faker.date.recent({ days: 30 });
      
      await sql`
        INSERT INTO visitors (
          id,
          visitor_id,
          latitude,
          longitude,
          country,
          city,
          last_seen
        ) VALUES (
          ${uuidv4()},
          ${visitorId},
          ${latitude},
          ${longitude},
          ${city.country},
          ${city.name},
          ${timestamp}
        )
      `;
    }
  }

  console.log(`Successfully inserted data for ${visitors.size} visitors!`);
  process.exit(0);
}

insertFakeData().catch(error => {
  console.error('Error inserting fake data:', error);
  process.exit(1);
});
