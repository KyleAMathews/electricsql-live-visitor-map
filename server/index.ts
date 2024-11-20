import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sql } from '../src/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import fetch, { Headers } from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const visitSchema = z.object({
  visitorId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
});

// Shape API endpoint
app.get('/api/visitors/shape', async (req, res) => {
  try {
    const originUrl = new URL(
      process.env.PRIVATE_ELECTRIC_URL
        ? `${process.env.PRIVATE_ELECTRIC_URL}/v1/shape`
        : `http://localhost:5133/v1/shape`
    );

    originUrl.searchParams.set('table', 'visitors');

    // Copy all search parameters from the original request
    for (const [key, value] of Object.entries(req.query)) {
      originUrl.searchParams.set(key, value as string);
    }

    if (process.env.PRIVATE_DATABASE_ID) {
      originUrl.searchParams.set('database_id', process.env.PRIVATE_DATABASE_ID);
    }

    // Forward the request to Electric
    const headers = new Headers(req.headers as any);
    headers.delete('host');

    if (process.env.PRIVATE_ELECTRIC_TOKEN) {
      originUrl.searchParams.set('token', process.env.PRIVATE_ELECTRIC_TOKEN);
    }

    console.log(originUrl.toString())
    const response = await fetch(originUrl.toString(), { headers });
    
    // Copy status and headers from Electric response
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Send the response body
    const body = await response.text();
    res.send(body);
  } catch (error) {
    console.error('Error proxying to Electric:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record visit endpoint
app.post('/api/record-visit', async (req, res) => {
  try {
    const result = visitSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: result.error.issues 
      });
    }

    const { visitorId, latitude, longitude, country, city } = result.data;

    await sql`
      INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen)
      VALUES (${uuidv4()}, ${visitorId}, ${latitude}, ${longitude}, ${country}, ${city}, NOW())
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording visit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
