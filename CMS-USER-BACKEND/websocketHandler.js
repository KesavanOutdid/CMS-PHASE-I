const logger = require('./logger');
const { connectToDatabase } = require('./db');

let charging_state = false;
let sessionFlag = 0;

connectToDatabase();

const getUniqueIdentifierFromRequest = (request) => {
    return request.url.split('/').pop();
};

const handleWebSocketConnection = (WebSocket, wss, wsConnections, ClientConnections, clients, OCPPResponseMap, meterValuesMap) => {
    wss.on('connection', async(ws, req) => {
        const uniqueIdentifier = getUniqueIdentifierFromRequest(req);
        const clientIpAddress = req.connection.remoteAddress;

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
                .then(result => {
                    console.log(`ChargerID: ${uniqueIdentifier} - Matched ${result.matchedCount} document(s) and modified ${result.modifiedCount} document(s)`);
                    logger.info(`ChargerID: ${uniqueIdentifier} - Matched ${result.matchedCount} document(s) and modified ${result.modifiedCount} document(s)`);
                })
                .catch(err => {
                    console.error(`ChargerID: ${uniqueIdentifier} - Error occur while updating in ev_details:`, err);
                    logger.error(`ChargerID: ${uniqueIdentifier} - Error occur while updating in ev_details:`, err);
                });

            await db.collection('ev_charger_status').updateOne({ chargerID: uniqueIdentifier }, { $set: { clientIP: clientIpAddress } }, function(err, result) {
                if (err) throw err;
                console.log(`ChargerID: ${uniqueIdentifier} - Matched ${result.matchedCount} document(s) and modified ${result.modifiedCount} document(s)`);
                logger.info(`ChargerID: ${uniqueIdentifier} - Matched ${result.matchedCount} document(s) and modified ${result.modifiedCount} document(s)`);
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
                        const response = [3, Identifier, {
                            "status": "Accepted",
                            "currentTime": new Date().toISOString(),
                            "interval": 10
                        }];
                        ws.send(JSON.stringify(response));
                    } else if (requestType === 2 && requestName === "StatusNotification") {
                        const response = [3, Identifier, {}];
                        ws.send(JSON.stringify(response));

                        const status = requestData[3].status;
                        const errorCode = requestData[3].errorCode;
                        const timestamp = requestData[3].timestamp;
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

                        let StartTimestamp;
                        let StopTimestamp;

                        if (status == 'Charging') {
                            charging_state = true;
                            sessionFlag = 1;
                            StartTimestamp = timestamp;
                        }
                        if ((status == 'Finishing') && (charging_state)) {
                            sessionFlag = 1;
                            StopTimestamp = timestamp;
                            charging_state = false;
                        }
                        if ((status == 'SuspendedEV') && (charging_state)) {
                            sessionFlag = 1;
                            StopTimestamp = timestamp;
                            charging_state = false;
                        }
                        if ((status == 'Faulted') && (charging_state)) {
                            sessionFlag = 1;
                            StopTimestamp = timestamp;
                            charging_state = false;
                        }

                        if (sessionFlag == 1) {
                            let unit;
                            let sessionPrice;
                            const meterValues = getMeterValues(uniqueIdentifier);
                            if (meterValues.firstMeterValues && meterValues.lastMeterValues) {
                                ({ unit, sessionPrice } = await calculateDifference(meterValues.firstMeterValues, meterValues.lastMeterValues));
                                console.log(`Energy consumed during charging session: ${unit} Unit's - Price: ${sessionPrice}`);
                                meterValues.firstMeterValues = undefined;
                            } else {
                                console.log("StartMeterValues or LastMeterValues is not available.");
                            }
                            const user = await getUsername(uniqueIdentifier);
                            handleChargingSession(uniqueIdentifier, StartTimestamp, StopTimestamp, unit, sessionPrice, user);
                            sessionFlag = 0;
                        }

                    } else if (requestType === 2 && requestName === "Heartbeat") {
                        const response = [3, Identifier, { "currentTime": formattedDate }];
                        ws.send(JSON.stringify(response));
                        await updateTime(uniqueIdentifier);
                    } else if (requestType === 2 && requestName === "Authorize") {
                        const response = [3, Identifier, { "idTagInfo": { "status": "Accepted", "parentIdTag": "B4A63CDB" } }];
                        ws.send(JSON.stringify(response));
                    } else if (requestType === 2 && requestName === "StartTransaction") {
                        let transId;
                        const generatedTransactionId = generateRandomTransactionId();
                        await db.collection('ev_details').findOneAndUpdate({ ip: clientIpAddress }, { $set: { transactionId: generatedTransactionId } }, { returnDocument: 'after' })
                            .then(updatedDocument => {
                                transId = updatedDocument.transactionId;

                                const response = [3, Identifier, {
                                    "transactionId": transId,
                                    "idTagInfo": { "status": "Accepted", "parentIdTag": "B4A63CDB" }
                                }];
                                ws.send(JSON.stringify(response));
                            }).catch(error => {
                                console.error(`${uniqueIdentifier}: Error executing while updating transactionId:`, error);
                                logger.error(`${uniqueIdentifier}: Error executing while updating transactionId:`, error);
                            });
                    } else if (requestType === 2 && requestName === "MeterValues" && !getMeterValues(uniqueIdentifier).firstMeterValues) {
                        getMeterValues(uniqueIdentifier).firstMeterValues = await captureMetervalues(Identifier, requestData, uniqueIdentifier, clientIpAddress);
                        console.log(`First MeterValues for ${uniqueIdentifier} : ${getMeterValues(uniqueIdentifier).firstMeterValues}`);
                    } else if (requestType === 2 && requestName === "MeterValues" && getMeterValues(uniqueIdentifier).firstMeterValues) {
                        getMeterValues(uniqueIdentifier).lastMeterValues = await captureMetervalues(Identifier, requestData, uniqueIdentifier, clientIpAddress);
                        console.log(`Last MeterValues for ${uniqueIdentifier}  : ${getMeterValues(uniqueIdentifier).lastMeterValues}`);
                    } else if (requestType === 2 && requestName === "StopTransaction") {
                        const response = [3, Identifier, {}];
                        ws.send(JSON.stringify(response));
                    }
                }
            });

            ws.on('close', (code, reason) => {
                if (code === 1001) {
                    console.error(`WebSocket connection closed from browser side`);
                    logger.error(`WebSocket connection closed from browser side`);
                } else {
                    console.error(`WebSocket connection closed with code ${code} and reason: ${reason}`);
                    logger.error(`WebSocket connection closed with code ${code} and reason: ${reason}`);
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

        async function captureMetervalues(Identifier, requestData, uniqueIdentifier, clientIpAddress) {
            const response = [3, Identifier, {}];
            ws.send(JSON.stringify(response));

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
            const ChargerValue = JSON.stringify(keyValuePair);
            await SaveChargerValue(ChargerValue);
            await updateTime(uniqueIdentifier);
            if (keyValuePair['Energy.Active.Import.Register'] !== undefined) {
                return EnergyValue;
            }
            return undefined;
        }

        // Function to calculate the difference between two sets of MeterValues
        async function calculateDifference(startValues, lastValues) {
            const startEnergy = startValues || 0;
            const lastEnergy = lastValues || 0;
            console.log(startEnergy, lastEnergy);
            const differ = lastEnergy - startEnergy;
            const unit = parseFloat(differ / 1000).toFixed(2);
            console.log(`Unit: ${unit}`);
            const sessionPrice = await calculatePrice(unit);
            return { unit, sessionPrice };
        }

        async function calculatePrice(unit) {
            try {
                // Fetch the price from MongoDB (replace 'YourCollection' and 'yourQuery' with your actual collection and query)
                const db = await connectToDatabase();
                const priceDocument = await db.collection('ev_pricing').findOne({});

                if (priceDocument) {
                    const pricePerUnit = priceDocument.UnitPrice; // Adjust this based on your actual MongoDB document structure
                    const totalPrice = unit * pricePerUnit;

                    console.log(`Price per unit: RS.${pricePerUnit}`);
                    console.log(`Total price: RS.${totalPrice}`);

                    return totalPrice;
                } else {
                    console.error('Price not found in the database');
                }
            } catch (error) {
                console.error('Error in calculatePrice:', error);
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
        ClientConnections.forEach(ws => {
            if (ws !== sender && ws.readyState === WebSocket.OPEN) {
                ws.send(jsonMessage, (error) => {
                    if (error) {
                        console.log(`ChargerID: ${DeviceID} - Error while sending message to browser/client: ${error.message}`);
                        logger.error(`ChargerID: ${DeviceID} - Error while sending message to browser/client: ${error.message}`);
                    }
                });
            }
        });
    };
};

//generateRandomTransactionId function
function generateRandomTransactionId() {
    return Math.floor(1000000 + Math.random() * 9000000); // Generates a random number between 1000000 and 9999999
}

//Save the received ChargerStatus
async function SaveChargerStatus(chargerStatus) {

    const db = await connectToDatabase();
    const collection = db.collection('ev_charger_status');
    const ChargerStatus = JSON.parse(chargerStatus);
    // Check if a document with the same chargerID already exists
    await collection.findOne({ clientIP: ChargerStatus.clientIP })
        .then(existingDocument => {
            if (existingDocument) {
                // Update the existing document
                collection.updateOne({ clientIP: ChargerStatus.clientIP }, { $set: { status: ChargerStatus.status, timestamp: ChargerStatus.timestamp, errorCode: ChargerStatus.errorCode } })
                    .then(result => {
                        if (result) {
                            console.log(`ChargerID ${ChargerStatus.chargerID}: Status successfully updated.`);
                            logger.info(`ChargerID ${ChargerStatus.chargerID}: Status successfully updated.`);
                        } else {
                            console.log(`ChargerID ${ChargerStatus.chargerID}: Status not updated`);
                            logger.info(`ChargerID ${ChargerStatus.chargerID}: Status not updated`);
                        }
                    })
                    .catch(error => {
                        console.log(`ChargerID ${ChargerStatus.chargerID}: Error occur while update the status: ${error}`);
                        logger.error(`ChargerID ${ChargerStatus.chargerID}: Error occur while update the status: ${error}`);
                    });

            } else {

                db.collection('ev_details').findOne({ ChargerID: ChargerStatus.chargerID }) // changed 08/12
                    .then(foundDocument => {
                        if (foundDocument) {
                            ChargerStatus.chargerID = foundDocument.ChargerID;

                            collection.insertOne(ChargerStatus)
                                .then(result => {
                                    if (result) {
                                        console.log(`ChargerID ${ChargerStatus.chargerID}: Status successfully inserted.`);
                                    } else {
                                        console.log(`ChargerID ${ChargerStatus.chargerID}: Status not inserted`);
                                    }
                                })
                                .catch(error => {
                                    console.log(`ChargerID ${ChargerStatus.chargerID}: Error occur while insert the status: ${error}`);
                                });

                        } else {
                            console.log('Document not found in ChargerStatusSave function');
                        }
                    })
            }
        })
        .catch(error => {
            console.log(error);
        });
}

//Save the received ChargerValue
async function SaveChargerValue(ChargerVal) {


    const db = await connectToDatabase();
    const collection = db.collection('ev_charger_values');
    const ChargerValue = JSON.parse(ChargerVal);

    await db.collection('ev_details').findOne({ ip: ChargerValue.clientIP })
        .then(foundDocument => {
            if (foundDocument) {
                ChargerValue.chargerID = foundDocument.ChargerID; // Assuming ChargerID is the correct field name
                collection.insertOne(ChargerValue)
                    .then(result => {
                        if (result) {
                            console.log(`ChargerID ${ChargerValue.chargerID}: Value successfully inserted.`);
                            logger.info(`ChargerID ${ChargerValue.chargerID}: Value successfully inserted.`);
                        } else {
                            console.log(`ChargerID ${ChargerValue.chargerID}: Value not inserted`);
                            logger.error(`ChargerID ${ChargerValue.chargerID}: Value not inserted`);
                        }
                    })
                    .catch(error => {
                        console.log(`ChargerID ${ChargerValue.chargerID}: An error occurred while inserting the value: ${error}.`);
                        logger.info(`ChargerID ${ChargerValue.chargerID}: An error occurred while inserting the value: ${error}.`);
                    });
            } else {
                console.log(`ChargerID ${ChargerValue.chargerID}: Value not available in the ChargerSavevalue function`);
                logger.info(`ChargerID ${ChargerValue.chargerID}: Value not available in the ChargerSavevalue function`);
            }
        })

}

//update time while while receive message from ws
async function updateTime(Device_ID) {

    const db = await connectToDatabase();
    const collection = db.collection('ev_charger_status');

    const filter = { chargerID: Device_ID };
    const update = { $set: { timestamp: new Date() } };

    const result = await collection.updateOne(filter, update);

    if (result.modifiedCount === 1) {
        console.log(`The time for ChargerID ${Device_ID} has been successfully updated.`);
        logger.info(`The time for ChargerID ${Device_ID} has been successfully updated.`);
    } else {
        console.log(`ChargerID ${Device_ID} not found to update time`);
        logger.error(`ChargerID ${Device_ID} not found to update time`);
    }
}

//insert charging session into the database
async function handleChargingSession(chargerID, startTime, stopTime, TotalUnitConsumed, price, user) {
    const db = await connectToDatabase();
    const collection = db.collection('charging_session');
    const sessionPrice = parseFloat(price).toFixed(2);
    // Check if a document with the same chargerID already exists in the charging_session table
    const existingDocument = await collection
        .find({ ChargerID: chargerID })
        .sort({ _id: -1 })
        .limit(1)
        .next();

    if (existingDocument) {
        // ChargerID exists in charging_session table
        if (existingDocument.StopTimestamp === null) {
            // StopTimestamp is null, update the existing document's StopTimestamp
            const result = await collection.updateOne({ ChargerID: chargerID, StopTimestamp: null }, {
                $set: {
                    StopTimestamp: stopTime !== null ? stopTime : undefined,
                    Unitconsumed: TotalUnitConsumed,
                    price: sessionPrice,
                    user: user
                }
            });

            if (result.modifiedCount > 0) {
                console.log(`ChargerID ${chargerID}: Session/StopTimestamp updated`);
                logger.info(`ChargerID ${chargerID}: Session/StopTimestamp updated`);
                const SessionPriceToUser = await updateSessionPriceToUser(user, sessionPrice);
                if (SessionPriceToUser === true) {
                    console.log(`ChargerID - ${chargerID}: Session Price updated for ${user}`);
                } else {
                    console.log(`ChargerID - ${chargerID}: Session Price Not updated for ${user}`);
                }
            } else {
                console.log(`ChargerID ${chargerID}: Session/StopTimestamp not updated`);
                logger.info(`ChargerID ${chargerID}: Session/StopTimestamp not updated`);
            }
        } else {

            const newSession = {
                ChargerID: chargerID,
                StartTimestamp: startTime !== null ? startTime : undefined,
                StopTimestamp: stopTime !== null ? stopTime : undefined,
                Unitconsumed: TotalUnitConsumed,
                price: sessionPrice,
                user: user
            };

            const result = await collection.insertOne(newSession);

            if (result.acknowledged === true) {
                console.log(`ChargerID ${chargerID}: Session/StartTimestamp inserted`);
                logger.info(`ChargerID ${chargerID}: Session/StartTimestamp inserted`);
            } else {
                console.log(`ChargerID ${chargerID}: Session/StartTimestamp not inserted`);
                logger.info(`ChargerID ${chargerID}: Session/StartTimestamp not inserted`);
            }

        }
    } else {
        // ChargerID is not in charging_session table, insert a new document
        const evDetailsDocument = await db.collection('ev_details').findOne({ ChargerID: chargerID });

        if (evDetailsDocument) {
            const newSession = {
                ChargerID: chargerID,
                StartTimestamp: startTime !== null ? startTime : undefined,
                StopTimestamp: stopTime !== null ? stopTime : undefined,
                Unitconsumed: TotalUnitConsumed,
                price: sessionPrice,
                user: user
            };

            const result = await collection.insertOne(newSession);

            if (result.acknowledged === true) {
                console.log(`ChargerID ${chargerID}: Session inserted`);
                logger.info(`ChargerID ${chargerID}: Session inserted`);
            } else {
                console.log(`ChargerID ${chargerID}: Session not inserted`);
                logger.info(`ChargerID ${chargerID}: Session not inserted`);
            }
        } else {
            console.log(`ChargerID ${chargerID}: Please add the chargerID in the database!`);
            logger.info(`ChargerID ${chargerID}: Please add the chargerID in the database!`);
        }
    }
}

async function updateSessionPriceToUser(user, price) {
    try {
        const sessionPrice = parseFloat(price).toFixed(2);
        const db = await connectToDatabase();
        const usersCollection = db.collection('users');

        const userDocument = await usersCollection.findOne({ username: user });

        if (userDocument) {
            // Subtract sessionPrice from walletBalance
            const updatedWalletBalance = userDocument.walletBalance - sessionPrice;
            const result = await usersCollection.updateOne({ username: user }, { $set: { walletBalance: updatedWalletBalance } });

            if (result.modifiedCount > 0) {
                console.log(`Wallet balance updated for user ${user}.`);
                return true;
            } else {
                console.log(`Wallet balance not updated for user ${user}.`);
                return false;
            }
        } else {
            console.log(`User not found with username ${user}.`);
        }

    } catch (error) {
        console.error('Error in updateSessionPriceToUser:', error);
    }
}


module.exports = { handleWebSocketConnection };