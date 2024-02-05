const ClientConnections = new Set();
const wsConnections = new Map();
const clients = new Map();
const OCPPResponseMap = new Map();
const meterValuesMap = new Map();

module.exports = { wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap };