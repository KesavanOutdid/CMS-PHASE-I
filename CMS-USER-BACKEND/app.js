const express = require('express');
const http = require('http');
const path = require('path');
const router = require('./routes');
const logger = require('./logger');
const { initializeWebSocket } = require('./websocket');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');

// Load environment variables from .env file
dotenv.config();

// Create an Express app
const app = express();

// Create an HTTP server using Express app
const httpServer = http.createServer(app);

// Create a separate HTTP server for WebSocket
const webSocketServer = http.createServer();
const ClientWebSocketServer = http.createServer();

// Set up middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/', router);
app.use(express.static(path.join(__dirname, 'public')));

// Define HTTP server port
const HTTP_PORT = process.env.HTTP_PORT || 3000;

// Start the HTTP server
httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Server listening on port ${HTTP_PORT}`);
    logger.info(`HTTP Server listening on port ${HTTP_PORT}`);
});

// Initialize WebSocket connections and map modules on WebSocket server
initializeWebSocket(webSocketServer, ClientWebSocketServer);

// Define WebSocket server port
const WS_PORT = process.env.WS_PORT || 8080;

// Start the WebSocket server
webSocketServer.listen(WS_PORT, () => {
    console.log(`WebSocket Server listening on port ${WS_PORT}`);
    logger.info(`WebSocket Server listening on port ${WS_PORT}`);
});

// Define client WebSocket server port
const WS_PORT_CLIENT = process.env.WS_PORT_CLIENT || 8050;

// Start the client WebSocket server
ClientWebSocketServer.listen(WS_PORT_CLIENT, () => {
    console.log(`Client WebSocket Server listening on port ${WS_PORT_CLIENT}`);
    logger.info(`Client WebSocket Server listening on port ${WS_PORT_CLIENT}`);
});