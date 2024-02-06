const database = require('./db');

const authenticate = async(req, res, next) => {
    const email = req.body.loginUsername;
    const password = req.body.loginPassword;
    try {
        const db = await database.connectToDatabase();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ username: email });

        if (!user || user.password !== password) {
            const errorMessage = 'Invalid credentials';
            return res.status(401).json({ message: errorMessage });
        }

        // Continue to the next middleware or route handler
        next();

    } catch (error) {
        console.error(error);
        const errorMessage = 'Internal Server Error';
        return res.status(500).json({ message: errorMessage });
    }
};

const registerUser = async(req, res, next) => {
    const { registerUsername, registerPassword, registerPhone } = req.body;
    console.log(registerPassword);
    try {
        const db = await database.connectToDatabase();
        const usersCollection = db.collection('users');

        // Check if the username is already taken
        const existingUser = await usersCollection.findOne({ username: registerUsername });
        if (existingUser) {
            const errorMessage = 'Username already registered with us !';
            return res.status(403).json({ message: errorMessage });
        }

        // Insert the new user into the database
        await usersCollection.insertOne({
            username: registerUsername,
            password: registerPassword,
            phone: registerPhone,
            walletBalance: 0.00
        });

        // Continue with any additional logic or response
        next();

    } catch (error) {
        console.error(error);
        const errorMessage = 'Internal Server Error';
        return res.status(500).json({ message: errorMessage });
    }
};

module.exports = { authenticate, registerUser };