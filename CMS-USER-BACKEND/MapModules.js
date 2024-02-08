const ClientConnections = new Set();
const wsConnections = new Map();
const clients = new Map();
const OCPPResponseMap = new Map();
const meterValuesMap = new Map();
const sessionFlags = new Map();
const charging_states = new Map();

module.exports = { wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap, sessionFlags, charging_states };