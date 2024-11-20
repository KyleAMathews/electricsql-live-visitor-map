import { initDB } from '../src/lib/db.js';

console.log('Initializing database...');
await initDB();
console.log('Database initialized successfully!');
