const express = require('express');
const http = require('http');
const path = require('path');
const router = require('./routes');
const logger = require('./logger');
const { initializeWebSocket } = require('./websocket');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');

dotenv.config();
const app = express();
const httpServer = http.createServer(app);
const webSocketServer = http.createServer();

// Middleware to pass map modules to routes
// app.use((req, res, next) => {
//     req.wsConnections = initializeWebSocket.wsConnections;
//     req.ClientConnections = initializeWebSocket.ClientConnections;
//     req.clients = initializeWebSocket.clients;
//     req.OCPPResponseMap = initializeWebSocket.OCPPResponseMap;
//     next();
// });

app.use(cors());
app.use(bodyParser.json());
app.use('/', router);

app.use(express.static(path.join(__dirname, 'public')));

const HTTP_PORT = process.env.HTTP_PORT;
httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Server listening on port ${HTTP_PORT}`);
    logger.info(`HTTP Server listening on port ${HTTP_PORT}`);
});

// Initialize WebSocket connections and map modules on WebSocket server
initializeWebSocket(webSocketServer);

// Start WebSocket server on port 8050
const WS_PORT = process.env.WS_PORT;
webSocketServer.listen(WS_PORT, () => {
    console.log(`WebSocket Server listening on port ${WS_PORT}`);
    logger.info(`WebSocket Server listening on port ${WS_PORT}`);
});