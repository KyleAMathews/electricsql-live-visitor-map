import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { v4 as uuidv4 } from "uuid"
import postgres from 'postgres'
import { Resource } from "sst"

const app = new Hono()

// Enable CORS
app.use('*', cors())

const visitSchema = z.object({
  visitorId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
})

// Shape API endpoint
app.get('/api/visitors/shape', async (c) => {
  try {
    const originUrl = new URL(
      Resource.ElectricUrl.url + '/v1/shape'
    )

    originUrl.searchParams.set('table', 'visitors')

    // Copy all search parameters from the original request
    const query = c.req.query()
    for (const [key, value] of Object.entries(query)) {
      originUrl.searchParams.set(key, value)
    }

    originUrl.searchParams.set('database_id', Resource.electricInfo.database_id)
    originUrl.searchParams.set('token', Resource.electricInfo.token)

    // Forward the request to Electric
    const headers = new Headers(c.req.raw.headers)
    headers.delete('host')

    const response = await fetch(originUrl.toString(), { headers })
    const buffer = await response.arrayBuffer()

    return new Response(buffer, {
      status: response.status,
      headers: response.headers
    })
  } catch (error) {
    console.error('Error proxying to Electric:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Record visit endpoint
app.post('/api/record-visit', zValidator('json', visitSchema), async (c) => {
  try {
    const { visitorId, latitude, longitude, country, city } = c.req.valid('json')

    // Create a new postgres client for each request
    const sql = postgres(Resource.databaseUriLink.url)

    await sql`
      INSERT INTO visitors (id, visitor_id, latitude, longitude, country, city, last_seen)
      VALUES (${uuidv4()}, ${visitorId}, ${latitude}, ${longitude}, ${country}, ${city}, NOW())
    `

    await sql.end()
    return c.json({ success: true })
  } catch (error) {
    console.error('Error recording visit:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default {
  fetch: app.fetch,
}
