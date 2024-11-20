# Visitor Map

A real-time visitor tracking and visualization application built with Astro, React, and SST. The application displays visitor locations on an interactive world map, with features for clustering and zooming.

## 🌟 Features

- Real-time visitor tracking and visualization
- Interactive world map using react-simple-maps
- Automatic visitor clustering based on zoom level
- Responsive design with Tailwind CSS
- Serverless infrastructure using SST and AWS
- PostgreSQL database for visitor data storage

## 🛠️ Tech Stack

- **Framework:** Astro + React
- **Styling:** Tailwind CSS
- **Maps:** react-simple-maps
- **Database:** PostgreSQL with ElectricSQL
- **Infrastructure:** SST (Serverless Stack) on AWS
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

- The map component uses dynamic clustering based on zoom level for better performance with large datasets
- Visitor data is updated in real-time using ElectricSQL
- The application is deployed using SST's serverless infrastructure

## 🔧 Configuration

The application can be configured through environment variables and the SST configuration file (`sst.config.ts`).

## 📝 License

MIT
