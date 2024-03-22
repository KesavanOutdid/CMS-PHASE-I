const database = require('./db');
const logger = require('./logger');
const { connectToDatabase } = require('./db');

// Save recharge details
async function savePaymentDetails(data, user) {
    const responseCode = data.data.responseCode;
    const amount = (data.data.amount / 100).toFixed(2);
    const transactionId = data.data.transactionId;
    const RCuser = user;

    const db = await database.connectToDatabase();
    const paymentCollection = db.collection('paymentDetails');
    const userCollection = db.collection('users');

    try {
        // Insert payment details
        const paymentResult = await paymentCollection.insertOne({
            user: RCuser,
            RechargeAmt: parseFloat(amount),
            transactionId: transactionId,
            responseCode: responseCode,
            date_time: new Date().toISOString()
        });

        if (!paymentResult) {
            throw new Error('Failed to save payment details');
        }

        // Update user's wallet
        const updateResult = await userCollection.updateOne({ username: RCuser }, { $inc: { walletBalance: parseFloat(amount) } });

        if (updateResult.modifiedCount === 1) {
            return true;
        } else {
            throw new Error('Failed to update user wallet');
        }
    } catch (error) {
        console.error(error.message);
        return false;
    }
}

// Fetch ip and update user
async function getIpAndupdateUser(chargerID, user) {
    try {
        const db = await database.connectToDatabase();
        const getip = await db.collection('ev_details').findOne({ ChargerID: chargerID });
        const ip = getip.ip;
        if (getip) {
            if (user !== undefined) {
                const updateResult = await db.collection('ev_details').updateOne({ ChargerID: chargerID }, { $set: { current_or_active_user: user } });

                if (updateResult.modifiedCount === 1) {
                    console.log(`Updated current_or_active_user to ${user} successfully for ChargerID ${chargerID}`);
                } else {
                    console.log(`Failed to update current_or_active_user for ChargerID ${chargerID}`);
                }
            } else {
                console.log('User is undefined - On stop there will be no user details');
            }

            return ip;
        } else {
            console.log(`GetIP Unsuccessful`);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }

}

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
    const evDetailsCollection = db.collection('ev_details');
    const collection = db.collection('ev_charger_status');
    const unregisteredDevicesCollection = db.collection('UnRegister_Devices');

    const deviceExists = await evDetailsCollection.findOne({ ChargerID: Device_ID });

    if (deviceExists) {
        const filter = { chargerID: Device_ID };
        const update = { $set: { timestamp: new Date() } };

        const result = await collection.updateOne(filter, update);

        if (result.modifiedCount === 1) {
            console.log(`The time for ChargerID ${Device_ID} has been successfully updated.`);
            logger.info(`The time for ChargerID ${Device_ID} has been successfully updated.`);
        } else {
            console.log(`ChargerID ${Device_ID} not found to update time`);
            logger.error(`ChargerID ${Device_ID} not found to update time`);
            const deleteUnRegDev = await unregisteredDevicesCollection.deleteOne({ ChargerID: Device_ID });
            if (deleteUnRegDev.deletedCount === 1) {
                console.log(`UnRegisterDevices - ${Device_ID} has been deleted.`);
            } else {
                console.log(`Failed to delete UnRegisterDevices - ${Device_ID}.`);
            }
        }

        return true;

    } else {
        // Device_ID does not exist in ev_details collection
        console.log(`ChargerID ${Device_ID} does not exist.`);
        logger.error(`ChargerID ${Device_ID} does not exist.`);

        const unregisteredDevice = await unregisteredDevicesCollection.findOne({ ChargerID: Device_ID });

        if (unregisteredDevice) {
            // Device already exists in UnRegister_Devices, update its current time
            const filter = { ChargerID: Device_ID };
            const update = { $set: { LastUpdateTime: new Date() } };
            await unregisteredDevicesCollection.updateOne(filter, update);
            console.log(`UnRegisterDevices - ${Device_ID} LastUpdateTime Updated.`);
        } else {
            // Device does not exist in UnRegister_Devices, insert it with the current time
            await unregisteredDevicesCollection.insertOne({ ChargerID: Device_ID, LastUpdateTime: new Date() });
            console.log(`UnRegisterDevices - ${Device_ID} inserted.`);
        }

        return false;
    }
}

//insert charging session into the database
async function handleChargingSession(chargerID, startTime, stopTime, Unitconsumed, Totalprice, user, SessionID) {
    const db = await connectToDatabase();
    const collection = db.collection('charging_session');
    let TotalUnitConsumed;

    if (Unitconsumed === null || isNaN(parseFloat(Unitconsumed))) {
        TotalUnitConsumed = "0.000";
    } else {
        TotalUnitConsumed = Unitconsumed;
    }
    const sessionPrice = isNaN(Totalprice) || Totalprice === 'NaN' ? "0.00" : parseFloat(Totalprice).toFixed(2);
    // const sessionPrice = parseFloat(price).toFixed(2);

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
            const result = await collection.updateOne({ ChargerID: chargerID, ChargingSessionID: SessionID, StopTimestamp: null }, {
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
                ChargingSessionID: SessionID,
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
                ChargingSessionID: SessionID,
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

//update charging session with user
async function updateSessionPriceToUser(user, price) {
    try {
        const sessionPrice = parseFloat(price).toFixed(2);
        const db = await connectToDatabase();
        const usersCollection = db.collection('users');

        const userDocument = await usersCollection.findOne({ username: user });

        if (userDocument) {
            const updatedWalletBalance = (userDocument.walletBalance - sessionPrice).toFixed(2);
            // Check if the updated wallet balance is NaN
            if (!isNaN(updatedWalletBalance)) {
                const result = await usersCollection.updateOne({ username: user }, { $set: { walletBalance: parseFloat(updatedWalletBalance) } });

                if (result.modifiedCount > 0) {
                    console.log(`Wallet balance updated for user ${user}.`);
                    return true;
                } else {
                    console.log(`Wallet balance not updated for user ${user}.`);
                    return false;
                }
            } else {
                console.log(`Invalid updated wallet balance for user ${user}.`);
                return false; // Indicate invalid balance
            }
        } else {
            console.log(`User not found with username ${user}.`);
        }

    } catch (error) {
        console.error('Error in updateSessionPriceToUser:', error);
    }
}

//update current or active user to null
async function updateCurrentOrActiveUserToNull(uniqueIdentifier) {
    try {
        const db = await connectToDatabase();
        const collection = db.collection('ev_details');
        const result = await collection.updateOne({ ChargerID: uniqueIdentifier }, { $set: { current_or_active_user: null } });

        if (result.modifiedCount === 0) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error while update CurrentOrActiveUser To Null:', error);
        return false;
    }
}

module.exports = { savePaymentDetails, getIpAndupdateUser, generateRandomTransactionId, SaveChargerStatus, SaveChargerValue, updateTime, handleChargingSession, updateCurrentOrActiveUserToNull };