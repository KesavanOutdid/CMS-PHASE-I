const logger = require('./logger');
const { connectToDatabase } = require('./db');
const { generateRandomTransactionId, SaveChargerStatus, SaveChargerValue, updateTime, handleChargingSession, updateCurrentOrActiveUserToNull } = require('./functions');

connectToDatabase();

const getUniqueIdentifierFromRequest = (request, ws) => {
    const urlParts = request.url.split('/');
    const firstPart = urlParts[1];
    const identifier = urlParts.pop();
    if (firstPart === 'OCPPJ') {
        return identifier;
    } else {
        ws.terminate(); // or throw new Error('Invalid request');
        console.log(`Connection terminate due to Invalid header - ${urlParts}`);
    }
};

const handleWebSocketConnection = (WebSocket, wss, ClientWss, wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap, sessionFlags, charging_states, startedChargingSet, chargingSessionID) => {
    wss.on('connection', async(ws, req) => {
        const uniqueIdentifier = getUniqueIdentifierFromRequest(req, ws);
        const clientIpAddress = req.connection.remoteAddress;
        let timeoutId;
        let GenerateChargingSessionID;
        let StartTimestamp;
        let StopTimestamp;
        let timestamp;

        const previousResults = new Map(); //updateTime - store previous result value
        const currentVal = new Map(); //updateTime - store current result value

        previousResults.set(uniqueIdentifier, null);
        wsConnections.set(clientIpAddress, ws);
        ClientConnections.add(ws);
        clients.set(ws, clientIpAddress);

        const db = await connectToDatabase();
        let query = { ChargerID: uniqueIdentifier };
        let updateOperation = { $set: { ip: clientIpAddress } };

        if (uniqueIdentifier) {
            console.log(`WebSocket connection established with ${uniqueIdentifier}`);
            logger.info(`WebSocket connection established with ${uniqueIdentifier}`);

            await db.collection('ev_details')
                .updateOne(query, updateOperation)
                .then(async result => {
                    console.log(`ChargerID: ${uniqueIdentifier} - Matched ${result.matchedCount} document(s) and modified ${result.modifiedCount} document(s)`);
                    logger.info(`ChargerID: ${uniqueIdentifier} - Matched ${result.matchedCount} document(s) and modified ${result.modifiedCount} document(s)`);
                    await db.collection('ev_charger_status').updateOne({ chargerID: uniqueIdentifier }, { $set: { clientIP: clientIpAddress } }, function(err, rslt) {
                        if (err) throw err;
                        console.log(`ChargerID: ${uniqueIdentifier} - Matched ${rslt.matchedCount} status document(s) and modified ${rslt.modifiedCount} document(s)`);
                        logger.info(`ChargerID: ${uniqueIdentifier} - Matched ${rslt.matchedCount} status document(s) and modified ${rslt.modifiedCount} document(s)`);
                    });
                })
                .catch(err => {
                    console.error(`ChargerID: ${uniqueIdentifier} - Error occur while updating in ev_details:`, err);
                    logger.error(`ChargerID: ${uniqueIdentifier} - Error occur while updating in ev_details:`, err);
                });

            clients.set(ws, clientIpAddress);
        } else {
            console.log(`WebSocket connection established from browser`);
            logger.info(`WebSocket connection established from browser`);
        }

        const getMeterValues = (uniqueIdentifier) => {
            if (!meterValuesMap.has(uniqueIdentifier)) {
                meterValuesMap.set(uniqueIdentifier, {});
            }
            return meterValuesMap.get(uniqueIdentifier);
        };

        function connectWebSocket() {
            // Event listener for messages from the client
            ws.on('message', async(message) => {
                const requestData = JSON.parse(message);
                let WS_MSG = `ChargerID: ${uniqueIdentifier} - ReceivedMessage: ${message}`;
                logger.info(WS_MSG);
                console.log(WS_MSG);

                broadcastMessage(uniqueIdentifier, requestData, ws);

                const currentDate = new Date();
                const formattedDate = currentDate.toISOString();

                if (requestData[0] === 3 && requestData[2].action === 'DataTransfer') {
                    const httpResponse = OCPPResponseMap.get(ws);
                    if (httpResponse) {
                        httpResponse.setHeader('Content-Type', 'application/json');
                        httpResponse.end(JSON.stringify(requestData));
                        OCPPResponseMap.delete(ws);
                    }
                }

                if (requestData[0] === 3 && requestData[2].configurationKey) {
                    const httpResponse = OCPPResponseMap.get(ws);
                    if (httpResponse) {
                        httpResponse.setHeader('Content-Type', 'application/json');
                        httpResponse.end(JSON.stringify(requestData));
                        OCPPResponseMap.delete(ws);
                    }
                }

                if (requestData[0] === 3 && requestData[2].status) {
                    const httpResponse = OCPPResponseMap.get(ws);
                    if (httpResponse) {
                        httpResponse.setHeader('Content-Type', 'application/json');
                        httpResponse.end(JSON.stringify(requestData));
                        OCPPResponseMap.delete(ws);
                    }
                }

                if (requestData[0] === 2 && requestData[2] === 'FirmwareStatusNotification') {
                    const httpResponse = OCPPResponseMap.get(ws);
                    if (httpResponse) {
                        httpResponse.setHeader('Content-Type', 'application/json');
                        httpResponse.end(JSON.stringify(requestData));
                        OCPPResponseMap.delete(ws);
                    }
                }

                if (Array.isArray(requestData) && requestData.length >= 4) {
                    const requestType = requestData[0];
                    const Identifier = requestData[1];
                    const requestName = requestData[2];

                    if (requestType === 2 && requestName === "BootNotification") {
                        const sendTo = wsConnections.get(clientIpAddress);
                        const response = [3, Identifier, {
                            "status": "Accepted",
                            "currentTime": new Date().toISOString(),
                            "interval": 14400
                        }];
                        sendTo.send(JSON.stringify(response));
                    } else if (requestType === 2 && requestName === "StatusNotification") {
                        const sendTo = wsConnections.get(clientIpAddress);
                        const response = [3, Identifier, {}];
                        sendTo.send(JSON.stringify(response));

                        const status = requestData[3].status;
                        const errorCode = requestData[3].errorCode;
                        timestamp = requestData[3].timestamp;

                        if (status != undefined) {
                            const keyValPair = {};
                            keyValPair.status = status;
                            keyValPair.timestamp = timestamp;
                            keyValPair.clientIP = clientIpAddress;
                            keyValPair.errorCode = errorCode;
                            keyValPair.chargerID = uniqueIdentifier;
                            const Chargerstatus = JSON.stringify(keyValPair);
                            await SaveChargerStatus(Chargerstatus);
                        }

                        if (status == 'Available') {
                            timeoutId = setTimeout(async() => {
                                const result = await updateCurrentOrActiveUserToNull(uniqueIdentifier);
                                if (result === true) {
                                    console.log(`ChargerID ${uniqueIdentifier} - End charging session is updated successfully.`);
                                } else {
                                    console.log(`ChargerID ${uniqueIdentifier} - End charging session is not updated.`);
                                }
                            }, 45000);
                        } else {
                            if (timeoutId !== undefined) {
                                console.log('Timeout Triggered');
                                clearTimeout(timeoutId);
                                timeoutId = undefined; // Reset the timeout reference
                            }
                        }

                        if(status == 'Preparing'){
                            sessionFlags.set(uniqueIdentifier, 0);
                            charging_states.set(uniqueIdentifier, false);
                        }

                        if (status == 'Charging' && !startedChargingSet.has(uniqueIdentifier)) {
                            sessionFlags.set(uniqueIdentifier, 1);
                            charging_states.set(uniqueIdentifier, true);
                            StartTimestamp = timestamp;
                            startedChargingSet.add(uniqueIdentifier);
                            GenerateChargingSessionID = generateRandomTransactionId();
                            chargingSessionID.set(uniqueIdentifier, GenerateChargingSessionID);
                        }
                        if ((status == 'Finishing') && (charging_states.get(uniqueIdentifier) == true)) {
                            sessionFlags.set(uniqueIdentifier, 1);
                            StopTimestamp = timestamp;
                            charging_states.set(uniqueIdentifier, false);
                            startedChargingSet.delete(uniqueIdentifier);
                        }

                        if ((status == 'SuspendedEV') && (charging_states.get(uniqueIdentifier) == true)) {
                            sessionFlags.set(uniqueIdentifier, 1);
                            StopTimestamp = timestamp;
                            charging_states.set(uniqueIdentifier, false);
                            startedChargingSet.delete(uniqueIdentifier);
                        }

                        if ((status == 'Faulted') && (charging_states.get(uniqueIdentifier) == true)) {
                            sessionFlags.set(uniqueIdentifier, 1);
                            StopTimestamp = timestamp;
                            charging_states.set(uniqueIdentifier, false);
                            startedChargingSet.delete(uniqueIdentifier);
                        }

                        if (sessionFlags.get(uniqueIdentifier) == 1) {
                            let unit;
                            let sessionPrice;
                            const meterValues = getMeterValues(uniqueIdentifier);
                            if (meterValues.firstMeterValues && meterValues.lastMeterValues) {
                                ({ unit, sessionPrice } = await calculateDifference(meterValues.firstMeterValues, meterValues.lastMeterValues,uniqueIdentifier));
                                console.log(`Energy consumed during charging session: ${unit} Unit's - Price: ${sessionPrice}`);
                                meterValues.firstMeterValues = undefined;
                            } else {
                                console.log("StartMeterValues or LastMeterValues is not available.");
                            }
                            const user = await getUsername(uniqueIdentifier);
                            const startTime = StartTimestamp;
                            const stopTime = StopTimestamp;                            
                            handleChargingSession(uniqueIdentifier, startTime, stopTime, unit, sessionPrice, user, chargingSessionID.get(uniqueIdentifier));
                            if (charging_states.get(uniqueIdentifier) == false) {
                                const result = await updateCurrentOrActiveUserToNull(uniqueIdentifier);
                                if (result === true) {
                                    console.log(`ChargerID ${uniqueIdentifier} Stop - End charging session is updated successfully.`);
                                } else {
                                    console.log(`ChargerID ${uniqueIdentifier} - End charging session is not updated.`);
                                }
                            } else {
                                console.log('End charging session is not updated - while stop only it will work');
                            }

                            sessionFlags.set(uniqueIdentifier, 0);
                        }

                    } else if (requestType === 2 && requestName === "Heartbeat") {
                        const sendTo = wsConnections.get(clientIpAddress);
                        const response = [3, Identifier, { "currentTime": formattedDate }];
                        sendTo.send(JSON.stringify(response));
                        const result = await updateTime(uniqueIdentifier);
                        currentVal.set(uniqueIdentifier, result);
                        if (currentVal.get(uniqueIdentifier) === true) {
                            if (previousResults.get(uniqueIdentifier) === false) {
                                sendTo.terminate();
                                console.log(`ChargerID - ${uniqueIdentifier} terminated and try to reconnect !`);
                            }
                        }
                        previousResults.set(uniqueIdentifier, result);
                    } else if (requestType === 2 && requestName === "Authorize") {
                        const sendTo = wsConnections.get(clientIpAddress);
                        const response = [3, Identifier, { "idTagInfo": { "status": "Accepted", "parentIdTag": "B4A63CDB" } }];
                        sendTo.send(JSON.stringify(response));
                    } else if (requestType === 2 && requestName === "StartTransaction") {
                        let transId;
                        const sendTo = wsConnections.get(clientIpAddress);
                        const generatedTransactionId = generateRandomTransactionId();
                        await db.collection('ev_details').findOneAndUpdate({ ip: clientIpAddress }, { $set: { transactionId: generatedTransactionId } }, { returnDocument: 'after' })
                            .then(updatedDocument => {
                                transId = updatedDocument.transactionId;

                                const response = [3, Identifier, {
                                    "transactionId": transId,
                                    "idTagInfo": { "status": "Accepted", "parentIdTag": "B4A63CDB" }
                                }];
                                sendTo.send(JSON.stringify(response));
                            }).catch(error => {
                                console.error(`${uniqueIdentifier}: Error executing while updating transactionId:`, error);
                                logger.error(`${uniqueIdentifier}: Error executing while updating transactionId:`, error);
                            });
                    } else if (requestType === 2 && requestName === "MeterValues") {
                        const UniqueChargingsessionId = chargingSessionID.get(uniqueIdentifier); // Use the current session ID
                        if (!getMeterValues(uniqueIdentifier).firstMeterValues) {
                            getMeterValues(uniqueIdentifier).firstMeterValues = await captureMetervalues(Identifier, requestData, uniqueIdentifier, clientIpAddress, UniqueChargingsessionId);
                            console.log(`First MeterValues for ${uniqueIdentifier} : ${getMeterValues(uniqueIdentifier).firstMeterValues}`);
                        } else {
                            getMeterValues(uniqueIdentifier).lastMeterValues = await captureMetervalues(Identifier, requestData, uniqueIdentifier, clientIpAddress, UniqueChargingsessionId);
                            console.log(`Last MeterValues for ${uniqueIdentifier}  : ${getMeterValues(uniqueIdentifier).lastMeterValues}`);
                        }
                    } else if (requestType === 2 && requestName === "StopTransaction") {
                        const sendTo = wsConnections.get(clientIpAddress);
                        const response = [3, Identifier, {}];
                        sendTo.send(JSON.stringify(response));
                        
                        // if ((charging_states.get(uniqueIdentifier) == true)) {
                        //     sessionFlags.set(uniqueIdentifier, 1);
                        //     StopTimestamp = timestamp;
                        //     charging_states.set(uniqueIdentifier, false);
                        //     startedChargingSet.delete(uniqueIdentifier);
                        // }
                    }

                    // if (sessionFlags.get(uniqueIdentifier) == 1) {
                    //     let unit;
                    //     let sessionPrice;
                    //     const meterValues = getMeterValues(uniqueIdentifier);
                    //     if (meterValues.firstMeterValues && meterValues.lastMeterValues) {
                    //         ({ unit, sessionPrice } = await calculateDifference(meterValues.firstMeterValues, meterValues.lastMeterValues));
                    //         console.log(`Energy consumed during charging session: ${unit} Unit's - Price: ${sessionPrice}`);
                    //         meterValues.firstMeterValues = undefined;
                    //     } else {
                    //         console.log("StartMeterValues or LastMeterValues is not available.");
                    //     }
                    //     const user = await getUsername(uniqueIdentifier);
                    //     const startTime = StartTimestamp;
                    //     const stopTime = StopTimestamp;
                    //     handleChargingSession(uniqueIdentifier, startTime, stopTime, unit, sessionPrice, user, chargingSessionID.get(uniqueIdentifier));
                    //     if (charging_states.get(uniqueIdentifier) == false) {
                    //         const result = await updateCurrentOrActiveUserToNull(uniqueIdentifier);
                    //         if (result === true) {
                    //             console.log(`ChargerID ${uniqueIdentifier} Stop - End charging session is updated successfully.`);
                    //         } else {
                    //             console.log(`ChargerID ${uniqueIdentifier} - End charging session is not updated.`);
                    //         }
                    //     } else {
                    //         console.log('End charging session is not updated - while stop only it will work');
                    //     }

                    //     sessionFlags.set(uniqueIdentifier, 0);
                    // }
                }
            });

            wss.on('close', (code, reason) => {
                if (code === 1001) {
                    console.error(`ChargerID - ${uniqueIdentifier}: WebSocket connection closed from browser side`);
                    logger.error(`ChargerID - ${uniqueIdentifier}: WebSocket connection closed from browser side`);
                } else {
                    console.error(`ChargerID - ${uniqueIdentifier}: WebSocket connection closed with code ${code} and reason: ${reason}`);
                    logger.error(`ChargerID - ${uniqueIdentifier}: WebSocket connection closed with code ${code} and reason: ${reason}`);
                }
                ClientConnections.delete(ws);
                // Attempt to reconnect after a delay
                setTimeout(() => {
                    connectWebSocket();
                }, 1000);
            });

            // Add a global unhandled rejection handler
            process.on('unhandledRejection', (reason, promise) => {
                console.log('Unhandled Rejection at:', promise, 'reason:', reason);
                logger.info('Unhandled Rejection at:', promise, 'reason:', reason);
            });

            // Event listener for WebSocket errors
            ws.on('error', (error) => {
                try {
                    if (error.code === 'WS_ERR_EXPECTED_MASK') {
                        // Handle the specific error
                        console.log(`WebSocket error ${uniqueIdentifier}: MASK bit must be set.`);
                        logger.error(`WebSocket error ${uniqueIdentifier}: MASK bit must be set.`);
                        // Attempt to reconnect after a delay
                        setTimeout(() => {
                            connectWebSocket();
                        }, 1000);
                    } else {
                        // Handle other WebSocket errors
                        console.log(`WebSocket error ${uniqueIdentifier}: ${error.message}`);
                        console.error(error.stack);
                        logger.error(`WebSocket error ${uniqueIdentifier}: ${error.message}`);
                    }
                } catch (err) {
                    // Log the error from the catch block
                    console.error(`Error in WebSocket error handler: ${err.message}`);
                    logger.error(`Error in WebSocket error handler: ${err.message}`);
                    console.error(error.stack);
                }
            });

        }

        async function getUsername(chargerID) {
            try {
                const db = await connectToDatabase();
                const evDetailsCollection = db.collection('ev_details');
                const chargerDetails = await evDetailsCollection.findOne({ ChargerID: chargerID });
                if (!chargerDetails) {
                    console.log('getUsername - Charger ID not found in the database');
                }
                const username = chargerDetails.current_or_active_user;
                return username;
            } catch (error) {
                console.error('Error getting username:', error);
            }
        }

        async function captureMetervalues(Identifier, requestData, uniqueIdentifier, clientIpAddress, UniqueChargingsessionId) {
            const sendTo = wsConnections.get(clientIpAddress);
            const response = [3, Identifier, {}];
            sendTo.send(JSON.stringify(response));

            let measurand;
            let value;
            let EnergyValue;

            const meterValueArray = requestData[3].meterValue[0].sampledValue;
            const keyValuePair = {};
            meterValueArray.forEach((sampledValue) => {
                measurand = sampledValue.measurand;
                value = sampledValue.value;
                keyValuePair[measurand] = value;
                if (measurand === 'Energy.Active.Import.Register') {
                    EnergyValue = value;
                }
            });

            const currentTime = new Date().toISOString();
            keyValuePair.Timestamp = currentTime;
            keyValuePair.clientIP = clientIpAddress;
            keyValuePair.SessionID = UniqueChargingsessionId;
            const ChargerValue = JSON.stringify(keyValuePair);
            await SaveChargerValue(ChargerValue);
            await updateTime(uniqueIdentifier);
            if (keyValuePair['Energy.Active.Import.Register'] !== undefined) {
                return EnergyValue;
            }
            return undefined;
        }

        // Function to calculate the difference between two sets of MeterValues
        async function calculateDifference(startValues, lastValues,uniqueIdentifier) {
            const startEnergy = startValues || 0;
            const lastEnergy = lastValues || 0;
            console.log(startEnergy, lastEnergy);
            const differ = lastEnergy - startEnergy;
            let calculatedUnit = parseFloat(differ / 1000).toFixed(3);
            let unit;
            if (calculatedUnit === null || isNaN(parseFloat(calculatedUnit))) {
                unit = 0;
            } else {
                unit = calculatedUnit;
            }
            console.log(`Unit: ${unit}`);
            const sessionPrice = await calculatePrice(unit, uniqueIdentifier);
            const formattedSessionPrice = isNaN(sessionPrice) || sessionPrice === 'NaN' ? 0 : parseFloat(sessionPrice).toFixed(2);
            return { unit, sessionPrice: formattedSessionPrice };
        }

        async function calculatePrice(unit,uniqueIdentifier) {
            try {
                // Fetch the price from MongoDB (replace 'YourCollection' and 'yourQuery' with your actual collection and query)
                const db = await connectToDatabase();
                const priceDocument = await db.collection('ev_pricing').findOne({});

                if (priceDocument) {
                    const pricePerUnit = priceDocument.UnitPrice; // Adjust this based on your actual MongoDB document structure
                    const totalPrice = (unit * pricePerUnit).toFixed(2);

                    console.log(`Price per unit: RS.${pricePerUnit}`);
                    console.log(`Total price: RS.${totalPrice}`);

                    const InfraCheck = await CheckInfraANDuser(uniqueIdentifier);
                    if(InfraCheck === 1){
                        return totalPrice;
                    }else{
                        return 0;
                    }
                } else {
                    console.error('Price not found in the database');
                }
            } catch (error) {
                console.error('Error in calculatePrice:', error);
            }
        }

        async function CheckInfraANDuser(ChargerID){
            try{
                const db = await connectToDatabase();
                const evDetailsCollection = db.collection('ev_details');

                const chargerDetails = await evDetailsCollection.findOne({ ChargerID: ChargerID });

                if(chargerDetails.infrastructure === 1){
                    return 0;
                }else{
                   return 1;
                }
            }catch(error){
                console.error('Error in CheckInfraANDuser:', error);
            }
        }

        // Initial websocket connection
        connectWebSocket();
    });

    const broadcastMessage = (DeviceID, message, sender) => {
        const data = {
            DeviceID,
            message,
        };

        const jsonMessage = JSON.stringify(data);

        // Iterate over each client connected to another_wss and send the message
        ClientWss.clients.forEach(client => {
            // Check if the client is not the sender and its state is open
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(jsonMessage, (error) => {
                    if (error) {
                        console.log(`Error sending message to client: ${error.message}`);
                        // Handle error as needed
                    }
                });
            }
        });

    };
};

module.exports = { handleWebSocketConnection };