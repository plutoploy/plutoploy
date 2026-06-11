import { startServer } from "./backend/server";
import './backend/src/db/database'; // Initialize database

console.log('Starting Plutoploy deployment platform...');
process.stdout.write(''); // Flush stdout

try {
  startServer();
  console.log('Server started successfully!');
  process.stdout.write(''); // Flush stdout
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
