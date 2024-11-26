# Visitor Map

A real-time visitor tracking and visualization application powered by ElectricSQL's bulletproof sync. Why fetch visitor data when you can sync? This application displays visitor locations on an interactive world map.

## ⚡ Why ElectricSQL?

This application demonstrates the power of ElectricSQL's sync-first approach:

- **No Manual Data Fetching**: Replace traditional API calls with automatic data synchronization
- **Real-Time Updates**: Get instant visitor updates with automated cache invalidation
- **Offline Resilience**: Keep your app working even when the network isn't
- **Simplified Stack**: Reduce complexity by eliminating manual data fetching and caching logic

## 🌟 Features

- Real-time visitor tracking and visualization
- Interactive world map using react-simple-maps
- Automatic visitor clustering
- Serverless infrastructure using SST and AWS and Cloudflare
- PostgreSQL database with ElectricSQL sync

## 🛠️ Tech Stack

- **Data Sync:** ElectricSQL (★ 6.5k on GitHub)
- **Framework:** Astro + React
- **Maps:** react-globe & three.js
- **Database:** PostgreSQL (Neon)
- **Infrastructure:** SST on AWS and Cloudflare
- **Language:** TypeScript

## 🚀 Getting Started

1. **Install dependencies**
   ```sh
   npm install
   ```

2. **Initialize the database**
   ```sh
   npm run init-db
   ```

3. **Optional: Insert test data**
   ```sh
   npm run insert-fake-data
   ```

4. **Start the development server**
   ```sh
   npm run dev
   ```

## 📋 Available Scripts

| Command              | Description                                    |
| :------------------- | :--------------------------------------------- |
| `npm run dev`        | Start development server                       |
| `npm run build`      | Build for production                          |
| `npm run preview`    | Preview production build                      |
| `npm run init-db`    | Initialize the database                       |
| `npm run server`     | Start the backend server                      |
| `npm run insert-fake-data` | Insert sample visitor data              |

## 🏗️ Project Structure

```
/
├── src/
│   ├── components/     # React and Astro components
│   │   └── VisitorMap.tsx  # Main map visualization component
│   ├── pages/         # Astro pages
│   └── styles/        # CSS styles
├── server/           # Backend server code
├── scripts/         # Database and utility scripts
└── sst.config.ts    # SST infrastructure configuration
```

## 💡 Development Notes

- Leverages ElectricSQL's sync capabilities for real-time visitor updates
- No need for manual data fetching or cache invalidation
- Works offline by design thanks to ElectricSQL's sync architecture
- Deployed using SST's infra-as-code toolkit.

## 🔧 Configuration

The application can be configured through environment variables and the SST configuration file (`sst.config.ts`).

## 📝 License

MIT
