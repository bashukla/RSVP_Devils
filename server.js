require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the "public" folder
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/images', express.static('public/images'));

// Public login page
app.get(['/', '/logon.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logon.html'));
});

//////////////////////////////////////
//ROUTES TO SERVE HTML FILES
//////////////////////////////////////

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/events.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events.html'));
});

app.get('/create-event.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'create-event.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/rsvp.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rsvp.html'));
});

app.get('/reminders.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reminders.html'));
});


//////////////////////////////////////
//END ROUTES TO SERVE HTML FILES
//////////////////////////////////////


/////////////////////////////////////////////////
//HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////
// Helper function to create a MySQL connection
async function createConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
}

// **Authorization API Middleware: Verify JWT Token and Check User in Database**
async function authenticateToken(req, res, next) {

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1]; // removes "Bearer "

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }

        try {
            const connection = await createConnection();

            const [rows] = await connection.execute(
                'SELECT email FROM user WHERE email = ?',
                [decoded.email]
            );

            await connection.end();

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Account not found or deactivated.' });
            }

            req.user = decoded;
            next();

        } catch (dbError) {
            console.error(dbError);
            res.status(500).json({ message: 'Database error during authentication.' });
        }
    });
}

// **Page Access Middleware: Redirect to Login if No Valid JWT Token**
async function authenticatePage(req, res, next) {

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.redirect('/logon.html');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {

        if (err) {
            return res.redirect('/logon.html');
        }

        try {

            const connection = await createConnection();

            const [rows] = await connection.execute(
                'SELECT email FROM user WHERE email = ?',
                [decoded.email]
            );

            await connection.end();

            if (rows.length === 0) {
                return res.redirect('/logon.html');
            }

            req.user = decoded;
            next();

        } catch (dbError) {
            console.error(dbError);
            res.redirect('/logon.html');
        }
    });
}

/////////////////////////////////////////////////
//END HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////


//////////////////////////////////////
//ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////
// Route: Create Account
app.post('/api/create-account', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();
        const hashedPassword = await bcrypt.hash(password, 10);  // Hash password

        const [result] = await connection.execute(
            'INSERT INTO user (email, password) VALUES (?, ?)',
            [email, hashedPassword]
        );

        await connection.end();  // Close connection

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: 'An account with this email already exists.' });
        } else {
            console.error(error);
            res.status(500).json({ message: 'Error creating account.' });
        }
    }
});

// Route: Login 
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT * FROM user WHERE email = ?',
            [email]
        );

        await connection.end();  // Close connection

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Route: Get All Email Addresses
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute('SELECT email FROM user');

        await connection.end();  // Close connection

        const emailList = rows.map((row) => row.email);
        res.status(200).json({ emails: emailList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving email addresses.' });
    }
});

// Route Get All Events 
app.get('/api/events', async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute('SELECT * FROM events');
        await connection.end(); // Close connection
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving events.' });
    }
});

// Route Get All User Events
app.get('/api/user-events', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        // Get user_id from email in JWT
        const [userRows] = await connection.execute(
            'SELECT user_id FROM user WHERE email = ?',
            [req.user.email]
        );

        if (userRows.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'User not found' });
        }

        const userId = userRows[0].user_id;
        console.log('Fetching RSVPed events for userId:', userId);

        // Query events joined with registration table
        const [events] = await connection.execute(
            `SELECT e.*
             FROM events e
             JOIN registration r ON e.event_id = r.event_id
             WHERE r.user_id = ?`,
            [userId]
        );

        console.log('Events fetched:', events);

        await connection.end();

        res.json(events);
    } catch (error) {
        console.error('Full error in /api/user-events:', error);
        res.status(500).json({ message: 'Error retrieving user events.' });
    }
});

// Route: Get All Events by Type or Location
app.get('/api/events/type', authenticateToken, async (req, res) => {
  const { type, location } = req.query;  
  try {
    const connection = await createConnection();

    let sql = 'SELECT * FROM events';
    const params = [];

    // Add filters if provided
    const conditions = [];
    if (type && type.trim() !== '') {
      conditions.push('type = ?');
      params.push(type);
    }
    if (location && location.trim() !== '') {
      conditions.push('location = ?');
      params.push(location);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const [rows] = await connection.execute(sql, params);
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Error retrieving filtered events:', error);
    res.status(500).json({ message: 'Error retrieving events.' });
  }
});

// Route: Create Event
app.post('/api/events', authenticateToken, async (req, res) => {
    const { type, description, event_datetime, location, tags } = req.body;

    if (!type || !description || !event_datetime || !location) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const connection = await createConnection();

        // Get user_id from logged in user
        const [userRows] = await connection.execute(
            'SELECT user_id FROM user WHERE email = ?',
            [req.user.email]
        );

        const userId = userRows[0].user_id;

        // Insert event
        const [result] = await connection.execute(
            `INSERT INTO events (type, description, event_datetime, location, created_by, tags)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [type, description, event_datetime, location, userId, tags]
        );

        await connection.end();

        res.status(201).json({
            message: 'Event created successfully',
            event_id: result.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating event.' });
    }
});

// Route: Update Event
app.put('/api/events/:id', authenticateToken, async (req, res) => {
    const { type, description, event_datetime, location, tags } = req.body;
    const eventId = req.params.id;

    if (!type || !description || !event_datetime || !location) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const connection = await createConnection();

        const [result] = await connection.execute(
            `UPDATE events 
             SET type = ?, description = ?, event_datetime = ?, location = ?, tags = ?
             WHERE event_id = ?`,
            [type, description, event_datetime, location, tags, eventId]
        );

        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        res.json({ message: 'Event updated successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating event.' });
    }
});

// Route: Delete Event
app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    const eventId = req.params.id;

    try {
        const connection = await createConnection();

        const [result] = await connection.execute(
            'DELETE FROM events WHERE event_id = ?',
            [eventId]
        );

        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        res.json({ message: 'Event deleted successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting event.' });
    }
});

//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});