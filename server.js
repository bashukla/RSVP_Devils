require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
// EMAIL TRANSPORTER CONFIGURATION
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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
app.get('userSetting.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userSetting.html'));
})


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

// HELPER: Send Email Function
async function sendEmail(to, subject, html) {
    // Restriction: Only allow .edu emails
    if (!to.endsWith('.edu')) {
        console.log(`Blocked email to non-.edu address: ${to}`);
        return;
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: to,
            subject: subject,
            html: html,
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
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
            [type, description, event_datetime, location, userId, tags?.trim() || null]
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
            [type, description, event_datetime, location, tags?.trim() || null, eventId]
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

        // 1. Delete RSVPs (dependent table)
        await connection.execute(
            'DELETE FROM registration WHERE event_id = ?',
            [eventId]
        );

        // 2. Delete reminders (dependent table)
        await connection.execute(
            'DELETE FROM user_reminders WHERE event_id = ?',
            [eventId]
        );

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
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Error deleting event.' });
    }
});

// Route: RSVP to an Event
app.post('/api/rsvp', authenticateToken, async (req, res) => {
    const eventId = Number(req.body.event_id);
    if (!eventId) return res.status(400).json({ message: 'Valid Event ID is required.' });
    
    let connection;
    try {
        connection = await createConnection();
        
        // Check if event exists
        const [eventCheck] = await connection.execute(
            'SELECT event_id FROM events WHERE event_id = ?',
            [eventId]
        );
        if (eventCheck.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Event does not exist.' });
        }
        
        // Get user_id
        const [userRows] = await connection.execute(
            'SELECT user_id FROM user WHERE email = ?',
            [req.user.email]
        );
        const userId = userRows[0].user_id;
        
        // Try inserting RSVP
        try {
            await connection.execute(
                'INSERT INTO registration(user_id, event_id) VALUES(?, ?)',
                [userId, eventId]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                await connection.end();
                return res.status(409).json({ message: 'You have already RSVPed for this event.' });
            } else {
                throw err;
            }
        }
        
        // Auto-create reminder when RSVPing (BEFORE closing connection)
        await connection.execute(`
            INSERT INTO user_reminders (user_id, event_id, is_active, email_sent)
            VALUES (?, ?, 1, 0)
            ON DUPLICATE KEY UPDATE is_active = 1, email_sent = 0
        `, [userId, eventId]);
        
        // Get event details for email
        const [eventRows] = await connection.execute('SELECT description, event_datetime, location FROM events WHERE event_id = ?', [eventId]);
        const event = eventRows[0];
        
        await connection.end(); // Close AFTER all queries
        
        // Send RSVP Confirmation Email (after connection closed)
        const rsvpHtml = `
            <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
                <div style="background:#8C1D40; padding:25px; text-align:center;">
                    <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil Central</h1>
                    <p style="color:white; margin:5px 0 0 0; font-size:14px;">Arizona State University</p>
                </div>
                <div style="padding:30px;">
                    <h2 style="color:#8C1D40; margin-top:0;">RSVP Confirmed</h2>
                    <p>Hi Sun Devil,</p>
                    <p>You're all set! Your RSVP has been confirmed for the following event:</p>
                    <div style="background:#f9f9f9; padding:20px; border-left:4px solid #FFC627; border-radius:4px; margin:20px 0;">
                        <p style="margin:5px 0;"><strong>Event:</strong> ${event.description}</p>
                        <p style="margin:5px 0;"><strong>Date:</strong> ${new Date(event.event_datetime).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
                        <p style="margin:5px 0;"><strong>Time:</strong> ${new Date(event.event_datetime).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}</p>
                        <p style="margin:5px 0;"><strong>Location:</strong> ${event.location}</p>
                    </div>
                    <p>A reminder email will be sent 24 hours before the event starts.</p>
                    <p>We look forward to seeing you there! <strong>Go Devils!</strong></p>
                </div>
                <div style="background:#f5f5f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                    <p style="margin:0;">Arizona State University | Sun Devil Central</p>
                    <p style="margin:5px 0 0 0;">To manage your reminders, visit your account settings.</p>
                </div>
            </div>
        `;
        await sendEmail(req.user.email, `RSVP Confirmed: ${event.description}`, rsvpHtml);
        
        res.status(201).json({ message: 'RSVP successful.' });
    } catch (err) {
        console.error('RSVP Error:', err);
        if (connection) await connection.end();
        res.status(500).json({ message: 'Error processing RSVP.' });
    }
});

// Route: Cancel RSVP
app.delete('/api/rsvp/:eventId', authenticateToken, async (req, res) => {
    const eventId = Number(req.params.eventId);
    if (!eventId) return res.status(400).json({ message: 'Valid Event ID is required.' });
    
    let connection;
    try {
        connection = await createConnection();
        
        // Get user_id
        const [userRows] = await connection.execute(
            'SELECT user_id, email FROM user WHERE email = ?',
            [req.user.email]
        );
        const userId = userRows[0].user_id;
        const userEmail = userRows[0].email;
        
        // 1. Delete Registration
        const [result] = await connection.execute(
            'DELETE FROM registration WHERE user_id = ? AND event_id = ?',
            [userId, eventId]
        );
        
        // 2. Disable Reminder (Don't delete, just disable)
        await connection.execute(
            'UPDATE user_reminders SET is_active = 0 WHERE user_id = ? AND event_id = ?',
            [userId, eventId]
        );
        
        // 3. Get event name for email
        const [eventRows] = await connection.execute('SELECT description FROM events WHERE event_id = ?', [eventId]);
        const eventName = eventRows.length > 0 ? eventRows[0].description : 'Event';
        
        await connection.end(); // Close AFTER all queries
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'RSVP not found.' });
        }
        
        // 4. Send Cancellation Email (after connection closed)
        const cancelHtml = `
            <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
                <div style="background:#8C1D40; padding:25px; text-align:center;">
                    <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil Central</h1>
                    <p style="color:white; margin:5px 0 0 0; font-size:14px;">Arizona State University</p>
                </div>
                <div style="padding:30px;">
                    <h2 style="color:#8C1D40; margin-top:0;">RSVP Cancelled</h2>
                    <p>Hi Sun Devil,</p>
                    <p>Your RSVP has been cancelled for the following event:</p>
                    <div style="background:#fff5f5; padding:20px; border-left:4px solid #dc3545; border-radius:4px; margin:20px 0;">
                        <p style="margin:5px 0;"><strong>Event:</strong> ${eventName}</p>
                    </div>
                    <p style="color:#dc3545;"><strong>No reminder will be sent for this event.</strong></p>
                    <p>If this was a mistake, you can re-RSVP anytime from the events page.</p>
                </div>
                <div style="background:#f5f5f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                    <p style="margin:0;">Arizona State University | Sun Devil Central</p>
                    <p style="margin:5px 0 0 0;">To manage your reminders, visit your account settings.</p>
                </div>
            </div>
        `;
        await sendEmail(userEmail, `RSVP Cancelled: ${eventName}`, cancelHtml);
        
        res.json({ message: 'RSVP cancelled.' });
    } catch (err) {
        console.error('Cancel RSVP Error:', err);
        if (connection) await connection.end();
        res.status(500).json({ message: 'Error cancelling RSVP.' });
    }
});

// Route: Get RSVP count for all events
app.get('/api/rsvp-count', async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            `SELECT e.event_id, e.type, e.description, e.event_datetime, e.location, 
                    COUNT(r.user_id) AS rsvp_count
             FROM events e
             LEFT JOIN registration r ON e.event_id = r.event_id
             GROUP BY e.event_id, e.type, e.description, e.event_datetime, e.location`
        );

        await connection.end();
        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching RSVP counts.' });
    }
});

// Route: Test - Manually trigger reminder emails (dev/testing only)
app.get('/api/reminders/test-send', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();

        const [rows] = await connection.execute(`
            SELECT u.email, e.description as title, e.event_datetime, e.location, ur.reminder_id
            FROM user_reminders ur
            JOIN user u ON ur.user_id = u.user_id
            JOIN events e ON ur.event_id = e.event_id
            WHERE ur.is_active = 1
            AND e.event_datetime >= NOW()
        `);

        if (rows.length === 0) {
            return res.json({ message: 'No active reminders found.' });
        }

        for (const row of rows) {
            const html = `
                <h3>Event Reminder</h3>
                <p>Hi Sun Devil,</p>
                <p>This is a friendly reminder for the following event:</p>
                <div style="background:#f9f9f9; padding:15px; border-left:4px solid #FFC627;">
                    <p><strong>Event:</strong> ${row.title}</p>
                    <p><strong>Time:</strong> ${row.event_datetime}</p>
                    <p><strong>Location:</strong> ${row.location}</p>
                </div>
                <p>We look forward to seeing you there!</p>
            `;
            await sendEmail(row.email, `Reminder: ${row.title}`, html);
            await connection.execute('UPDATE user_reminders SET email_sent = 1 WHERE reminder_id = ?', [row.reminder_id]);
        }

        res.json({ message: `Sent ${rows.length} reminder(s).` });
    } catch (error) {
        console.error('Test reminder error:', error);
        res.status(500).json({ message: 'Error sending test reminders.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Route: GET User's Reminders
app.get('/api/reminders', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [userRows] = await connection.execute('SELECT user_id FROM user WHERE email = ?', [req.user.email]);
        if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });
        
        const userId = userRows[0].user_id;

        // Get all events with reminder status for this user
        const [rows] = await connection.execute(`
            SELECT e.event_id, e.description as title, e.event_datetime, e.location, e.type, 
                   ur.is_active, ur.email_sent, r.event_id as rsvp_id
            FROM events e
            LEFT JOIN user_reminders ur ON e.event_id = ur.event_id AND ur.user_id = ?
            LEFT JOIN registration r ON e.event_id = r.event_id AND r.user_id = ?
            WHERE e.event_datetime >= NOW()
            ORDER BY e.event_datetime ASC
        `, [userId, userId]);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching reminders' });
    } finally {
        if (connection) await connection.end();
    }
});

// Route: TOGGLE Reminder (Enable/Disable)
app.post('/api/reminders/toggle', authenticateToken, async (req, res) => {
    const { event_id, is_active } = req.body;
    let connection;
    try {
        connection = await createConnection();
        const [userRows] = await connection.execute('SELECT user_id, email FROM user WHERE email = ?', [req.user.email]);
        const userId = userRows[0].user_id;
        const userEmail = userRows[0].email;

        // Upsert (Insert or Update)
        await connection.execute(`
            INSERT INTO user_reminders (user_id, event_id, is_active, email_sent)
            VALUES (?, ?, ?, 0)
            ON DUPLICATE KEY UPDATE is_active = ?, email_sent = 0
        `, [userId, event_id, is_active, is_active]);

        // Send Confirmation Email (outside try block so connection is already closed)
        const status = is_active ? 'Enabled' : 'Disabled';
        const statusColor = is_active ? '#28a745' : '#dc3545';

        // Get event name for the email
        const [eventRows] = await connection.execute('SELECT description FROM events WHERE event_id = ?', [event_id]);
        const eventName = eventRows.length > 0 ? eventRows[0].description : `Event ID ${event_id}`;

        await connection.end();

        const html = `
            <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
                <div style="background:#8C1D40; padding:25px; text-align:center;">
                    <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil Central</h1>
                    <p style="color:white; margin:5px 0 0 0; font-size:14px;">Arizona State University</p>
                </div>
                <div style="padding:30px;">
                    <h2 style="color:#8C1D40; margin-top:0;">Reminder ${status}</h2>
                    <p>Hi Sun Devil,</p>
                    <p>Your reminder setting has been updated:</p>
                    <div style="background:#f9f9f9; padding:20px; border-left:4px solid #FFC627; border-radius:4px; margin:20px 0;">
                        <p style="margin:5px 0;"><strong>Event:</strong> ${eventName}</p>
                        <p style="margin:5px 0;"><strong>Status:</strong> <span style="color:${statusColor}; font-weight:bold;">${status}</span></p>
                    </div>
                    <p>${is_active ? 'You will receive a reminder email 24 hours before this event.' : 'You will no longer receive a reminder for this event.'}</p>
                </div>
                <div style="background:#f5f5f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                    <p style="margin:0;">Arizona State University | Sun Devil Central</p>
                    <p style="margin:5px 0 0 0;">To manage your reminders, visit your account settings.</p>
                </div>
            </div>
        `;
        await sendEmail(userEmail, `Reminder ${status}: ${eventName}`, html);

        res.json({ message: `Reminder ${status}` });
    } catch (error) {
        console.error(error);
        if (connection) await connection.end();
        res.status(500).json({ message: 'Error toggling reminder' });
    }
});
//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////

// CRON JOB: Check for reminders every hour
cron.schedule('0 * * * *', async () => {
    console.log('Running scheduled reminder check...');
    let connection;
    try {
        connection = await createConnection();
        
        // CHANGED: e.title → e.description
        const [rows] = await connection.execute(`
            SELECT u.email, e.description as title, e.event_datetime, e.location, ur.reminder_id
            FROM user_reminders ur
            JOIN user u ON ur.user_id = u.user_id
            JOIN events e ON ur.event_id = e.event_id
            WHERE ur.is_active = 1 
            AND ur.email_sent = 0
            AND e.event_datetime BETWEEN DATE_ADD(NOW(), INTERVAL 24 HOUR) AND DATE_ADD(NOW(), INTERVAL 25 HOUR)
        `);

        for (const row of rows) {
            const html = `
                <h3>Event Reminder</h3>
                <p>Hi Sun Devil,</p>
                <p>This is a friendly reminder for the following event:</p>
                <div style="background:#f9f9f9; padding:15px; border-left:4px solid #FFC627;">
                    <p><strong>Event:</strong> ${row.title}</p>
                    <p><strong>Time:</strong> ${row.event_datetime}</p>
                    <p><strong>Location:</strong> ${row.location}</p>
                </div>
                <p>We look forward to seeing you there!</p>
            `;
            await sendEmail(row.email, `Reminder: ${row.title}`, html);
            await connection.execute('UPDATE user_reminders SET email_sent = 1 WHERE reminder_id = ?', [row.reminder_id]);
        }
    } catch (error) {
        console.error('Cron job error:', error);
    } finally {
        if (connection) await connection.end();
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});