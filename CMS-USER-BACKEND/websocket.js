const WebSocket = require('ws');
const { handleWebSocketConnection } = require('./websocketHandler');
const { wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap, sessionFlags, charging_states } = require('./MapModules');

const initializeWebSocket = (server, ClientWebSocketServer) => {
    const wss = new WebSocket.Server({ server });
    const ClientWss = new WebSocket.Server({ server: ClientWebSocketServer });

    handleWebSocketConnection(WebSocket, wss, ClientWss, wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap, sessionFlags, charging_states);
};

module.exports = { initializeWebSocket, wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap };