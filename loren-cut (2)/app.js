// cPanel Node.js Application Startup File
// Place this file in the root directory of your cPanel Node.js app

const path = require('path');
const fs = require('fs');

const serverFile = path.join(__dirname, 'dist', 'server.cjs');

if (fs.existsSync(serverFile)) {
  require(serverFile);
} else {
  console.error('Error: dist/server.cjs not found! Please run "npm run build" first.');
}
