const WebSocket = require('ws');
const { handleWebSocketConnection } = require('./websocketHandler');
const { wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap } = require('./MapModules');

const initializeWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    handleWebSocketConnection(WebSocket, wss, wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap);
};

module.exports = { initializeWebSocket, wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap };