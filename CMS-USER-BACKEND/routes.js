const express = require('express');
const auth = require('./auth');
const database = require('./db');
const url = require('url');
const logger = require('./logger');
const { wsConnections,OCPPResponseMap } = require('./MapModules');
const { savePaymentDetails, getIpAndupdateUser } = require('./functions');
var sha256 = require('sha256');
var uniqid = require('uniqid');
var axios = require('axios');
const cors = require('cors');

// Create a router instance
const router = express.Router();

// Enable CORS
router.use(cors());

// Parse URL-encoded bodies
router.use(express.urlencoded({ extended: true }));

// Route to check login credentials
router.post('/CheckLoginCredentials', auth.authenticate, (req, res) => {
    res.status(200).json({ message: 'Success' });
});

// Route to logout and update users fields
router.post('/LogoutCheck', async(req, res) => {
    const chargerID = req.body.ChargerID;
    try {
        const db = await database.connectToDatabase();
        const latestStatus = await db.collection('ev_charger_status').findOne({ chargerID: chargerID });

        if (latestStatus) {
            if (latestStatus.status === 'Available' || latestStatus.status === 'Faulted') {
                const collection = db.collection('ev_details');
                const result = await collection.updateOne({ ChargerID: chargerID }, { $set: { current_or_active_user: null } });

                if (result.modifiedCount === 0) {
                    console.log('logoutCheck - Not Updated !');
                    res.status(200).json({ message: 'NOT OK' });
                } else {
                    console.log('logoutCheck - Updated !');
                    res.status(200).json({ message: 'OK' });
                }
            } else {
                console.log("logoutCheck - Status is not in Available");
                res.status(200).json({ message: 'OK' });
            }
        }

    } catch (error) {
        console.error('LoginCheck - error while update:', error);
        res.status(200).json({ message: 'LoginCheck - error while update' });
    }
});

// Route to add a new user (Save into database)
router.post('/RegisterNewUser', auth.registerUser, (req, res) => {
    res.status(200).json({ message: 'Success' });
});

// Route to get user wallet balance
router.get('/GetWalletBalance', async(req, res) => {
    try {
        const username = req.query.username;
        const db = await database.connectToDatabase();
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ username: username });

        if (!user) {
            const errorMessage = 'Username not found to get wallet details';
            return res.status(404).json({ message: errorMessage });
        }

        res.status(200).json({ balance: user.walletBalance });

    } catch (error) {
        console.error('Error retrieving wallet balance:', error);
        const errorMessage = 'Internal Server Error';
        return res.status(500).json({ message: errorMessage });
    }
});

// Route to Update username based on charger status
router.get('/endChargingSession', async(req, res) => {
    const ChargerID = req.query.ChargerID;
    try {
        const db = await database.connectToDatabase();
        const collection = db.collection('ev_details');
        const chargerStatus = await db.collection('ev_charger_status').findOne({ chargerID: ChargerID });

        if (chargerStatus.status === 'Available' || chargerStatus.status === 'Faulted' || chargerStatus.status === 'Finishing' || chargerStatus.status === 'Unavailable') {

            const result = await collection.updateOne({ ChargerID: ChargerID }, { $set: { current_or_active_user: null } });

            if (result.modifiedCount === 0) {
                const errorMessage = 'Username not found to update end charging session';
                return res.status(404).json({ message: errorMessage });
            }

            res.status(200).json({ message: 'End Charging session updated successfully.' });
        } else {
            console.log("endChargingSession - Status is not in Available/Faulted/Finishing/Unavailable");
            res.status(200).json({ message: 'OK' });
        }

    } catch (error) {
        console.error('Error updating end charging session:', error);
        const errorMessage = 'Internal Server Error';
        return res.status(500).json({ message: errorMessage });
    }
});

//Route to Check charger ID from database
router.post('/SearchCharger', async(req, res) => {
    try {
        const ChargerID = req.body.searchChargerID;
        const user = req.body.Username;
        
        const db = await database.connectToDatabase();
        const evDetailsCollection = db.collection('ev_details');
        const usersCollection = db.collection('users');

        // Search for the document in the 'ev_details' collection
        const chargerDetails = await evDetailsCollection.findOne({ ChargerID: ChargerID });

        if (!chargerDetails) {
            const errorMessage = 'Device ID not found !';
            return res.status(404).json({ message: errorMessage });
        }

        // Check if current_or_active_user is already set
        if (chargerDetails.current_or_active_user && user !== chargerDetails.current_or_active_user) {
            const errorMessage = 'Charger is already in use !';
            return res.status(400).json({ message: errorMessage });
        }


        // Get wallet balance from the 'users' collection
        const userRecord = await usersCollection.findOne({ username: user });

        if (!userRecord) {
            const errorMessage = 'User not found';
            return res.status(404).json({ message: errorMessage });
        }

        const walletBalance = userRecord.walletBalance;

        if(chargerDetails.infrastructure === 1){
            if(chargerDetails.AssignedUser !== user){            
                const errorMessage = 'Access Denied: You do not have permission to use this private charger.';
                return res.status(400).json({ message: errorMessage });
            }
        }else{
            // Check if wallet balance is below 100 Rs
            if (walletBalance < 100) {
                const errorMessage = 'Your wallet balance is not enough to charge (minimum 100 Rs required)';
                return res.status(400).json({ message: errorMessage });
            }
        }

        // Update the user field in the chargerDetails
        chargerDetails.user = user;

        // Update the document in the 'ev_details' collection
        const updateResult = await evDetailsCollection.updateOne({ ChargerID: ChargerID }, { $set: { current_or_active_user: user } });

        if (updateResult.modifiedCount !== 1) {
            console.log('Failed to update current_or_active username');
        }

        // Respond with the charger details
        res.status(200).json({ message: 'Success' });

    } catch (error) {
        console.error('Error searching for charger:', error);
        const errorMessage = 'Internal Server Error';
        return res.status(500).json({ message: errorMessage });
    }
});

//Route to Fetch latest charger details
router.post('/FetchLaststatus', async(req, res) => {
    const id = req.body.id
    try {
        const db = await database.connectToDatabase();
        const latestStatus = await db.collection('ev_charger_status').findOne({ chargerID: id });

        if (latestStatus) {
            console.log(`ChargerID - ${id} last status fetched from the database`);
            res.status(200).json({ message: latestStatus });
        } else {
            console.log(`ChargerID - ${id} No last data found`);
            res.json({ message: `ChargerID - ${id} No last data found` });
        }
    } catch (error) {
        console.error(`ChargerID: ${id} - Error occur while FetchLaststatus:`, error);
        const errorMessage = 'Internal Server Error';
        res.status(500).json({ message: errorMessage });

    }

});

//Route to start the charger
router.post('/start', async(req, res) => {
    // const parsedUrl = url.parse(req.url, true);
    // const queryParams = parsedUrl.query;
    const id = req.body.id;
    const user = req.body.user;

    //const deviceIDToSendTo = id;
    const ip = await getIpAndupdateUser(id, user);
    const wsToSendTo = wsConnections.get(ip);

    if (wsToSendTo) {
        const remoteStartRequest = [2, "1695798668459", "RemoteStartTransaction", {
            "connectorId": 1,
            "idTag": "B4A63CDB",
            "timestamp": new Date().toISOString(),
            "meterStart": 0,
            "reservationId": 0
        }];

        wsToSendTo.send(JSON.stringify(remoteStartRequest));

        console.log('StartCharger message sent to the WebSocket client for device ID:', id);
        res.status(200).json({ message: `StartCharger message sent to the WebSocket client for device ID: ${id}` });
        //res.end('StartCharger message sent to the WebSocket client for device ID: ' + deviceIDToSendTo);
    } else {
        // Charger ID Not Found/Available
        console.log('WebSocket client not found in start charger device ID:', id);
        res.status(404).json({ message: `ChargerID not available in the WebSocket client devcieID: deviceIDToSendTo` });
    }
});

//Route to stop the charger
router.post('/stop', async(req, res) => {
    // const parsedUrl = url.parse(req.url, true);
    // const queryParams = parsedUrl.query;
    const id = req.body.id;
    const ip = await getIpAndupdateUser(id);
    // Specify the device ID you want to send the message to
    //const deviceIDToSendTo = id;
    const db = await database.connectToDatabase();

    await db.collection('ev_details').findOne({ ChargerID: id })
        .then(transData => {
            if (transData) {
                const wsToSendTo = wsConnections.get(ip);
                if (wsToSendTo) {
                    const transId = transData.transactionId;
                    const remoteStopRequest = [2, "1695798668459", "RemoteStopTransaction", { "transactionId": transId }];
                    wsToSendTo.send(JSON.stringify(remoteStopRequest));

                    console.log('Stop message sent to the WebSocket client for device ID:', id);
                    logger.info('Stop message sent to the WebSocket client for device ID:', id);
                    res.status(200).json({ message: `Stop message sent to the WebSocket client for device ID: ${id}` });
                    //res.end('Stop message sent to the WebSocket client for device ID: ' + deviceIDToSendTo);
                } else {
                    console.log('WebSocket client not found in stop charger device ID:', id);
                    logger.info('WebSocket client not found in stop charger device ID:', id);
                    res.status(404).json({ message: `ChargerID not available in the WebSocket client deviceID: ${id}` });
                }
            } else {
                console.log(`ID: ${id} - TransactionID/ChargerID not set or not available !`);
                logger.error(`ID: ${id} - TransactionID/ChargerID not set or not available !`);
                res.status(404).json({ message: `ID: ${id} - TransactionID/ChargerID not set or not available !` });
            }
        })
        .catch(error => {
            console.log(`ChargerID: ${id} - Transaction ID not set or not available: ${error}`);
            logger.error(`ChargerID: ${id} - Transaction ID not set or not available: ${error}`);
            res.status(400).json({ message: `ChargerID: ${id} - Transaction ID not set or not available: ${error}` });
            //res.end(`ChargerID: ${deviceIDToSendTo} - Transaction ID not set or not available: ${error}`);
        });
});

//Route to Get charging session details at the time of stop
router.post('/getUpdatedCharingDetails', async(req, res) => {
    try {
        // const parsedUrl = url.parse(req.url, true);
        // const queryParams = parsedUrl.query;
        const chargerID = req.body.chargerID;
        const user = req.body.user;
        const db = await database.connectToDatabase();
        const chargingSessionResult = await db.collection('charging_session')
            .find({ ChargerID: chargerID, user: user })
            .sort({ StopTimestamp: -1 })
            .limit(1)
            .next();

        if (!chargingSessionResult) {
            return res.status(404).json({ error: 'getUpdatedCharingDetails - Charging session not found' });
        }
        const userResult = await db.collection('users').findOne({ username: user });
        if (!userResult) {
            return res.status(404).json({ error: 'getUpdatedCharingDetails - User not found' });
        }
        const combinedResult = {
            chargingSession: chargingSessionResult,
            user: userResult
        };
        console.log(combinedResult);
        res.status(200).json({ message: 'Success', value: combinedResult });
    } catch (error) {
        console.error('getUpdatedCharingDetails- Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

//Route to Call phonepe API to recharge
router.get('/pay', async function(req, res, next) {
    try {
        const RCuser = req.query.RCuser;
        const RCamt = parseInt(req.query.amount);
        let result = RCamt * 100;
        let tx_uuid = uniqid();
        let normalPayLoad = {
            "merchantId": process.env.merchantId,
            "merchantTransactionId": tx_uuid,
            "merchantUserId": process.env.merchantUserId,
            "amount": result,
            "redirectUrl": `http://122.166.210.142:4040/pay-return-url?user=${RCuser}`,
            "redirectMode": "POST",
            "callbackUrl": `http://122.166.210.142:4040/pay-return-url?user=${RCuser}`,
            "bankId": "SBIN",
            "paymentInstrument": {
                "type": "PAY_PAGE"
            }
        }
        let saltKey = process.env.saltKey;
        let saltIndex = process.env.saltIndex;
        let bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
        let base64String = bufferObj.toString("base64");
        let string = base64String + '/pg/v1/pay' + saltKey;
        let sha256_val = sha256(string);
        let checksum = sha256_val + '###' + saltIndex;
        axios.post(process.env.paymentURL, {
            'request': base64String
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'accept': 'application/json'
            }
        }).then(function(response) {
            res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
        }).catch(function(error) {
            console.log(error);
            //res.render('index', { page_respond_data: JSON.stringify(error) });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

// Route to Return phonepe API after recharge
router.all('/pay-return-url', async function(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const queryParams = parsedUrl.query;
    const user = queryParams.user;
    if (req.body.code == 'PAYMENT_SUCCESS' && req.body.merchantId && req.body.transactionId && req.body.providerReferenceId) {
        if (req.body.transactionId) {
            let saltKey = process.env.saltKey;
            let saltIndex = process.env.saltIndex;
            let surl = process.env.paymentURLStatus + req.body.transactionId;
            let string = '/pg/v1/status/PGTESTPAYUAT/' + req.body.transactionId + saltKey;
            let sha256_val = sha256(string);
            let checksum = sha256_val + '###' + saltIndex;
            axios.get(surl, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                    'X-MERCHANT-ID': req.body.transactionId,
                    'accept': 'application/json'
                }
            }).then(async function(response) {
                const result = await savePaymentDetails(response.data, user);
                if (result === true) {
                    //res.cookie('message', 'Recharge successful');
                    return res.status(200).redirect('/PaymentSuccess');
                } else {
                    return res.status(400).redirect('/PaymentUnsuccess');
                }
            }).catch(function(error) {
                console.log(error);
            });
        } else {
            console.log("Sorry!! Error1");
        }
    } else {
        console.log(req.body);
    }
});

// Route to Fetch all the charger details
router.get('/GetAllChargerDetails', async function(req, res) {
    try {
        const db = await database.connectToDatabase();
        const chargerDetailsCursor = await db.collection('ev_details').find({});
        const GetAllChargerDetails = await chargerDetailsCursor.toArray();
        if (GetAllChargerDetails) {
            console.log(`GetAllChargerDetails successful`);
            res.status(200).json({ message: 'success', value: GetAllChargerDetails });
        } else {
            console.log(`GetAllChargerDetails successful`);
            res.status(400).json({ message: `Unsuccessful` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

//Route to Fetch specific user details
router.get('/getUserDetails', async function(req, res) {
    try {
        const user = req.query.username;
        if (!user) {
            const errorMessage = 'UserDetails - Username undefined !';
            return res.status(401).json({ message: errorMessage });
        }
        const db = await database.connectToDatabase();
        const usersCollection = db.collection('users');
        const result = await usersCollection.findOne({ username: user });

        if (!result) {
            const errorMessage = 'getUserDetail - Username not found !';
            console.log(errorMessage);
            return res.status(404).json({ message: errorMessage });
        }

        res.status(200).json({ value: result });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

//Route to Fetch specific user charging session details
router.get('/getChargingSessionDetails', async function(req, res) {
    try {
        const user = req.query.username;
        if (!user) {
            const errorMessage = 'ChargerSessionDetails - Username undefined !';
            return res.status(401).json({ message: errorMessage });
        }
        const db = await database.connectToDatabase();
        const Collection = db.collection('charging_session');
        const result = await Collection.find({ user: user, StopTimestamp: { $ne: null } }).sort({ StopTimestamp: -1 }).toArray();

        if (!result || result.length === 0) {
            const errorMessage = 'ChargerSessionDetails - No record found !';
            return res.status(404).json({ message: errorMessage });
        }

        return res.status(200).json({ value: result });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

//Route to Fetch specific user wallet deduction and wallet recharge history
router.get('/getTransactionDetails', async function(req, res) {
    try {
        const user = req.query.username;
        if (!user) {
            const errorMessage = 'TransactionDetails - Username undefined !';
            return res.status(401).json({ message: errorMessage });
        }
        const db = await database.connectToDatabase();
        const CharSessionCollection = db.collection('charging_session');
        const walletTransCollection = db.collection('paymentDetails');

        // Query charging_session collection and sort by StopTimestamp
        const chargingSessionResult = await CharSessionCollection.find({ user: user }).toArray();

        // Query paymentDetails collection and sort by date_time
        const paymentDetailsResult = await walletTransCollection.find({ user: user }).toArray();

        if (chargingSessionResult.length || paymentDetailsResult.length) {

            // Add 'type' field to indicate credit
            const deducted = chargingSessionResult
                .filter(session => session.StopTimestamp !== null)
                .map(session => ({ status: 'Deducted', amount: session.price, time: session.StopTimestamp }));

            // Add 'type' field to indicate deducted
            const credits = paymentDetailsResult.map(payment => ({ status: 'Credited', amount: payment.RechargeAmt, time: payment.date_time }));

            // Combine both sets of documents into one array
            let mergedResult = [...credits, ...deducted];

            // Sort the merged array by timestamp
            mergedResult.sort((a, b) => {
                const timestampA = new Date(a.time);
                const timestampB = new Date(b.time);
                return timestampB - timestampA; // Sort in descending order by timestamp
            });

            const finalResult = mergedResult.map(item => ({ status: item.status, amount: item.amount, time: item.time }));

            return res.status(200).json({ value: finalResult });
        } else {
            return res.status(200).json({ message: 'No Record Found !' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

//Route to Update user details
router.post('/updateUserDetails', async function(req, res) {
    try {
        const user = req.body.updateUsername;
        const phone = req.body.updatePhone;
        const pin = req.body.updatePass;

        if (!user || !phone || !pin) {
            const errorMessage = 'Update User - Values undefined';
            return res.status(401).json({ message: errorMessage });
        }

        const db = await database.connectToDatabase();
        const usersCollection = db.collection('users');

        // Update the user details
        const result = await usersCollection.updateOne({ username: user }, { $set: { phone: phone, password: pin } });

        if (result.modifiedCount === 1) {
            console.log(`User ${user} details updated successfully`);
            res.status(200).json({ message: `User ${user} details updated successfully` });
        } else {
            console.log(`User ${user} not found`);
            res.status(404).json({ message: `User ${user} not found` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

//Fetch all action options for OCPPConfig
router.get('/GetAction', async(req, res) => {

    try {
        const db = await database.connectToDatabase();
        const collection = db.collection('ocpp_actions');

        const Data = await collection.find({}).toArray();

        // Map the database documents into the desired format
        const ResponseVal = Data.map(item => {
            return {
                action: item.action,
                payload: JSON.parse(item.payload)
            };
        });

        res.status(200).json(ResponseVal);
    } catch (error) {
        console.log("Error form GetAction - ", error);
        logger.error("Error form GetAction - ", error);
    }

})

//send request to charger from OCPPConfig 
router.get('/SendOCPPRequest', async(req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const queryParams = parsedUrl.query;
    const id = queryParams.id;
    const payload = JSON.parse(queryParams.req);
    const action = queryParams.actionBtn;

    const deviceIDToSendTo = id; // Specify the device ID you want to send the message to
    const ip = await getIpAndupdateUser(id);
    const wsToSendTo = wsConnections.get(ip);
    let ReqMsg = "";

    if (wsToSendTo) {

        switch (action) {

            case "GetConfiguration":
                ReqMsg = [2, "1701682466381", "GetConfiguration", payload];
                break;
            case "DataTransfer":
                ReqMsg = [2, "1701682577682", "DataTransfer", payload];
                break;
            case "UpdateFirmware":
                ReqMsg = [2, "1701682616333", "UpdateFirmware", payload];
                break;
            case "ChangeConfiguration":
                ReqMsg = [2, "1701682616334", "ChangeConfiguration", payload];
                break;
            case "ClearCache":
                ReqMsg = [2, "1701682616335", "ClearCache", ''];
                break;
            case "TriggerMessage":
                ReqMsg = [2, "1701682616336", "TriggerMessage", payload];
                break;
            case "Reset":
                ReqMsg = [2, "1701682616337", "Reset", payload];
                break;
            case "UnlockConnector":
                ReqMsg = [2, "1701682616338", "UnlockConnector", payload];
                break;
            case "RemoteStartTransaction":
                ReqMsg = [2, "1695798668459", "RemoteStartTransaction", { "connectorId": 1, "idTag": "B4A63CDB", "timestamp": "2023-12-23T09:58:12.596Z" }];
                break;
            case "RemoteStopTransaction":
                ReqMsg = [2, "1695798668459", "RemoteStopTransaction", payload];
                break;
            case "GetDiagnostics":
                ReqMsg = [2, "1701682616340", "GetDiagnostics", payload];
                console.log(ReqMsg);
                break;
            case "ChangeAvailability":
                ReqMsg = [2, "1701682616341", "ChangeAvailability", payload];
                break;
            case "CancelReservation":
                ReqMsg = [2, "1701682616342", "CancelReservation", payload];
                break;
            case "ReserveNow":
                ReqMsg = [2, "1701682616343", "ReserveNow", payload];
                break;
            case "SendLocalList":
                ReqMsg = [2, "1701682616344", "SendLocalList", payload];
                break;
            case "GetLocalListVersion":
                ReqMsg = [2, "1701682616345", "GetLocalListVersion", payload];
                break;
        }

        // Map the WebSocket connection to the HTTP response
        OCPPResponseMap.set(wsToSendTo, res);
        wsToSendTo.send(JSON.stringify(ReqMsg));

        console.log('Request message sent to the OCPP Request client for device ID:', deviceIDToSendTo);
        logger.info('Request message sent to the OCPP Request client for device ID:', deviceIDToSendTo);

    } else {
        // Charger ID Not Found/Available
        console.log('OCPP Request client not found for the specified device ID:', deviceIDToSendTo);
        logger.info('OCPP Request client not found for the specified device ID:', deviceIDToSendTo);
        res.status(404).end('OCPP Request client not found for the specified device ID: ' + deviceIDToSendTo);
    }
});

router.get('/getRecentSessionDetails', async function(req, res) {
    try {
        const user = req.query.username;
        if (!user) {
            const errorMessage = 'ChargerSessionDetails - Username undefined!';
            return res.status(401).json({ message: errorMessage });
        }
        const db = await database.connectToDatabase();
        const Collection = db.collection('charging_session');
        
        // Fetch all charging sessions for the user
        const result = await Collection.find({ user: user, StopTimestamp: { $ne: null } }).sort({ StopTimestamp: -1 }).toArray();
        if (!result || result.length === 0) {
            const errorMessage = 'ChargerSessionDetails - No record found!';
            return res.status(404).json({ message: errorMessage });
        }
        
        // Extract unique charger IDs
        const chargerIDs = [...new Set(result.map(session => session.ChargerID))];

        return res.status(200).json({ value: chargerIDs });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

// Export the router
module.exports = router;