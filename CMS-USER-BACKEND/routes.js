const express = require('express');
const path = require('path');
const auth = require('./auth');
const database = require('./db');
const url = require('url');
const logger = require('./logger');
const { wsConnections } = require('./MapModules');
var sha256 = require('sha256'); //create hash for data like password
var uniqid = require('uniqid'); //generate unique ID
var axios = require('axios'); //like ajax
const cors = require('cors');

const router = express.Router();
router.use(cors());

router.use(express.urlencoded({ extended: true }));

router.post('/CheckLoginCredentials', auth.authenticate, (req, res) => {
    res.status(200).json({ message: 'Success' });
});

router.post('/LogoutCheck', async(req, res) => {
    const chargerID = req.body.ChargerID;
    try {
        const db = await database.connectToDatabase();
        const latestStatus = await db.collection('ev_charger_status').findOne({ chargerID: chargerID });

        if (latestStatus) {
            if (latestStatus.status === 'Available') {
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

router.post('/RegisterNewUser', auth.registerUser, (req, res) => {
    res.status(200).json({ message: 'Success' });
});

router.get('/GetWalletBalance', async(req, res) => {
    const username = req.query.username;

    try {
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

router.get('/endChargingSession', async(req, res) => {
    const ChargerID = req.query.ChargerID;
    try {
        const db = await database.connectToDatabase();
        const collection = db.collection('ev_details');
        const result = await collection.updateOne({ ChargerID: ChargerID }, { $set: { current_or_active_user: null } });

        if (result.modifiedCount === 0) {
            const errorMessage = 'Username not found to update end charging session';
            return res.status(404).json({ message: errorMessage });
        }

        res.status(200).json({ message: 'End Charging session updated successfully.' });

    } catch (error) {
        console.error('Error updating end charging session:', error);
        const errorMessage = 'Internal Server Error';
        return res.status(500).json({ message: errorMessage });
    }
});

router.post('/SearchCharger', async(req, res) => {
    const ChargerID = req.body.searchChargerID;
    const user = req.body.Username;

    try {
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

        // Check if wallet balance is below 100 Rs
        if (walletBalance < 100) {
            const errorMessage = 'Your wallet balance is not enough to charge (minimum 100 Rs required)';
            return res.status(400).json({ message: errorMessage });
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

//fetch last charger status
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

//start the charger
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

//stop the charger
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

router.post('/getUpdatedCharingDetails', async(req, res) => {
    try {
        const parsedUrl = url.parse(req.url, true);
        const queryParams = parsedUrl.query;
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
            "redirectUrl": `http://192.168.1.70:4040/pay-return-url?user=${RCuser}`,
            "redirectMode": "POST",
            "callbackUrl": `http://192.168.1.70:4040/pay-return-url?user=${RCuser}`,
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

async function savePaymentDetails(data, user) {
    const responseCode = data.data.responseCode;
    const amount = parseFloat((data.data.amount / 100).toFixed(2));
    const transactionId = data.data.transactionId;
    const RCuser = user;

    const db = await database.connectToDatabase();
    const paymentCollection = db.collection('paymentDetails');
    const userCollection = db.collection('users');

    try {
        // Insert payment details
        const paymentResult = await paymentCollection.insertOne({
            user: RCuser,
            RechargeAmt: amount,
            transactionId: transactionId,
            responseCode: responseCode,
            date_time: new Date().toLocaleString()
        });

        if (!paymentResult) {
            throw new Error('Failed to save payment details');
        }

        // Update user's wallet
        const updateResult = await userCollection.updateOne({ username: RCuser }, { $inc: { walletBalance: amount } });

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
                console.log('User is undefined');
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

// Export the router
module.exports = router;