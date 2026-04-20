
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const upload = require('./storage');
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

app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from the "public" folder
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Serve uploaded images from the "uploads" folder
app.use('/uploads', express.static('uploads'));


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
app.get('/userSettings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userSettings.html'));
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

    // 🔍 Log the full header
    console.log("AUTH HEADER:", authHeader);

    const token = authHeader && authHeader.split(' ')[1];

    // 🔍 Log extracted token
    console.log("TOKEN:", token);

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log("JWT ERROR:", err.message); // 🔍 very useful
            return res.status(403).json({ message: "Invalid token." });
        }

        req.user = user;

        // 🔍 Confirm decoded payload
        console.log("DECODED USER:", user);

        next();
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

        await connection.end();

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { email: user.email, role: user.role }, // ← add role here
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});
// Forgot Password 
const crypto = require('crypto'); // add at top if not already

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    let connection;
    try {
        connection = await createConnection();

        // Check if user exists
        const [rows] = await connection.execute(
            'SELECT * FROM user WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            await connection.end();
            return res.status(400).json({ message: 'User not found' });
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        // Save token in DB
        await connection.execute(
            'UPDATE user SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
            [token, expiry, email]
        );

        await connection.end();

        const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;

        await sendEmail(
            email,
            "Password Reset",
            `<p>Click below to reset your password:</p>
             <a href="${resetLink}">${resetLink}</a>`
        );

        res.json({ message: 'Reset link sent to email' });

    } catch (error) {
        console.error(error);
        if (connection) await connection.end();
        res.status(500).json({ message: 'Error processing request' });
    }
});

//reset password 
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    let connection;
    try {
        connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT * FROM user WHERE reset_token = ? AND reset_token_expiry > NOW()',
            [token]
        );

        if (rows.length === 0) {
            await connection.end();
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE user SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = ?',
            [hashedPassword, token]
        );

        const email = rows[0].email;

        await connection.end();

        await sendEmail(
            email,
            "Password Changed",
            "<p>Your password has been successfully updated.</p>"
        );

        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        console.error(error);
        if (connection) await connection.end();
        res.status(500).json({ message: 'Error resetting password' });
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
app.post(
  '/api/events',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {

    console.log("ROUTE HIT: /api/events");

    const { type, description, event_datetime, location, tags } = req.body;

    if (!type || !description || !event_datetime || !location) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
      const connection = await createConnection();

      // Get user ID
      const [userRows] = await connection.execute(
        'SELECT user_id FROM user WHERE email = ?',
        [req.user.email]
      );

      const userId = userRows[0].user_id;

      // Multer provides the saved filename
      const imageFilename = req.file ? req.file.filename : null;

      // Insert event (store filename only)
      const [result] = await connection.execute(
        `INSERT INTO events (type, description, event_datetime, location, created_by, tags, image)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          type,
          description,
          event_datetime,
          location,
          userId,
          tags?.trim() || null,
          imageFilename
        ]
      );

      await connection.end();

      res.status(201).json({
        message: 'Event created successfully',
        event_id: result.insertId,
        // Return a usable URL for frontend
        image: imageFilename ? `/uploads/${imageFilename}` : null
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error creating event.' });

      console.log("FILE:", req.file);
    }
  }
);

// Route: Update Event 
app.put(
  '/api/events/:id',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {

    const { type, description, event_datetime, location, tags } = req.body;
    const eventId = req.params.id;

    if (!type || !description || !event_datetime || !location) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
      const connection = await createConnection();

      // Get current image filename
      const [existingRows] = await connection.execute(
        'SELECT image FROM events WHERE event_id = ?',
        [eventId]
      );

      if (existingRows.length === 0) {
        await connection.end();
        return res.status(404).json({ message: 'Event not found.' });
      }

      const currentImage = existingRows[0].image;

      // Determine new image (if uploaded)
      const newImageFilename = req.file ? req.file.filename : currentImage;

      // Update event
      await connection.execute(
        `UPDATE events 
         SET type = ?, description = ?, event_datetime = ?, location = ?, tags = ?, image = ?
         WHERE event_id = ?`,
        [
          type,
          description,
          event_datetime,
          location,
          tags?.trim() || null,
          newImageFilename,
          eventId
        ]
      );

      await connection.end();

      // Delete old image ONLY if a new one was uploaded
      if (req.file && currentImage) {
        const oldPath = path.join(__dirname, 'uploads', currentImage);

        fs.unlink(oldPath, (err) => {
          if (err) {
            console.log("Old image deletion failed:", err.message);
          } else {
            console.log("Old image deleted:", currentImage);
          }
        });
      }

      res.json({
        message: 'Event updated successfully.',
        image: newImageFilename ? `/uploads/${newImageFilename}` : null
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error updating event.' });
    }
  }
);

// Route: Delete Event

const { connect } = require('http2');
app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    const eventId = req.params.id;

    try {
        const connection = await createConnection();

        // 1. Get image filename BEFORE deleting event
        const [rows] = await connection.execute(
            'SELECT image FROM events WHERE event_id = ?',
            [eventId]
        );

        if (rows.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Event not found.' });
        }

        const imageFilename = rows[0].image;

        // 2. Delete dependent tables
        await connection.execute(
            'DELETE FROM registration WHERE event_id = ?',
            [eventId]
        );

        await connection.execute(
            'DELETE FROM user_reminders WHERE event_id = ?',
            [eventId]
        );

        // 3. Delete event
        const [result] = await connection.execute(
            'DELETE FROM events WHERE event_id = ?',
            [eventId]
        );

        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        // 4. Delete image file from server (if exists)
        if (imageFilename) {
            const imagePath = path.join(__dirname, 'uploads', imageFilename);

            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.log('Image deletion failed:', err.message);
                } else {
                    console.log('Image deleted:', imageFilename);
                }
            });
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
                    <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil RSVP</h1>
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
                    <div style="text-align:center; margin-top:24px;">
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/events.html" style="background:#8C1D40; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px; margin-right:10px;">View Event</a>
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/reminders.html" style="background:#FFC627; color:black; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px;">Manage Reminders</a>
                    </div>
                </div>
                <div style="background:#f5f5f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                    <p style="margin:0;">Arizona State University | Sun Devil RSVP</p>
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
                    <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil RSVP</h1>
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
                    <p style="margin:0;">Arizona State University | Sun Devil RSVP</p>
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
                <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
                    <div style="background:#8C1D40; padding:25px; text-align:center;">
                        <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil RSVP</h1>
                        <p style="color:white; margin:5px 0 0 0; font-size:14px;">Arizona State University</p>
                    </div>
                    <div style="padding:30px;">
                        <h2 style="color:#8C1D40; margin-top:0;">Event Reminder</h2>
                        <p>Hi Sun Devil,</p>
                        <p>This is a friendly reminder for the following event:</p>
                        <div style="background:#f9f9f9; padding:15px; border-left:4px solid #FFC627; border-radius:4px; margin:20px 0;">
                            <p style="margin:5px 0;"><strong>Event:</strong> ${row.title}</p>
                            <p style="margin:5px 0;"><strong>Time:</strong> ${row.event_datetime}</p>
                            <p style="margin:5px 0;"><strong>Location:</strong> ${row.location}</p>
                        </div>
                        <p>We look forward to seeing you there! <strong>Go Devils!</strong></p>
                        <div style="text-align:center; margin-top:24px;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/events.html" style="background:#8C1D40; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px; margin-right:10px;">View Event</a>
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/reminders.html" style="background:#FFC627; color:black; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px;">Manage Reminders</a>
                        </div>
                    </div>
                    <div style="background:#f5f5f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                        <p style="margin:0;">Arizona State University | Sun Devil RSVP</p>
                    </div>
                </div>
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
                    <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil RSVP</h1>
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
                    <p style="margin:0;">Arizona State University | Sun Devil RSVP</p>
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
// Route: Change Password
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Validate inputs
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new password are required.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    let connection;
    try {
        connection = await createConnection();

        // Get the user's current hashed password from the database
        const [rows] = await connection.execute(
            'SELECT password FROM user WHERE email = ?',
            [req.user.email]  // email comes from the JWT token via authenticateToken
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if current password matches what's in the database
        const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the password in the database
        await connection.execute(
            'UPDATE user SET password = ? WHERE email = ?',
            [hashedNewPassword, req.user.email]
        );

        res.status(200).json({ message: 'Password changed successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error changing password.' });
    } finally {
        if (connection) await connection.end();
    }
    console.log("USER:", req.user);
});

// Image Upload Route
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;

  res.status(201).json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    url: imageUrl
  });
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
                <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
                    <div style="background:#8C1D40; padding:25px; text-align:center;">
                        <h1 style="color:#FFC627; margin:0; font-size:24px;">Sun Devil RSVP</h1>
                        <p style="color:white; margin:5px 0 0 0; font-size:14px;">Arizona State University</p>
                    </div>
                    <div style="padding:30px;">
                        <h2 style="color:#8C1D40; margin-top:0;">Event Reminder</h2>
                        <p>Hi Sun Devil,</p>
                        <p>This is a friendly reminder for the following event:</p>
                        <div style="background:#f9f9f9; padding:15px; border-left:4px solid #FFC627; border-radius:4px; margin:20px 0;">
                            <p style="margin:5px 0;"><strong>Event:</strong> ${row.title}</p>
                            <p style="margin:5px 0;"><strong>Time:</strong> ${row.event_datetime}</p>
                            <p style="margin:5px 0;"><strong>Location:</strong> ${row.location}</p>
                        </div>
                        <p>We look forward to seeing you there! <strong>Go Devils!</strong></p>
                        <div style="text-align:center; margin-top:24px;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/events.html" style="background:#8C1D40; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px; margin-right:10px;">View Event</a>
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/reminders.html" style="background:#FFC627; color:black; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px;">Manage Reminders</a>
                        </div>
                    </div>
                    <div style="background:#f5f5f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                        <p style="margin:0;">Arizona State University | Sun Devil RSVP</p>
                    </div>
                </div>
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
// Route: Delete Account
app.delete('/api/delete-account', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();

        // 1. Get user_id first
        const [userRows] = await connection.execute(
            'SELECT user_id FROM user WHERE email = ?',
            [req.user.email]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const userId = userRows[0].user_id;

        // 2. Delete registrations for events this user created
        await connection.execute(`
            DELETE FROM registration WHERE event_id IN 
            (SELECT event_id FROM events WHERE created_by = ?)
        `, [userId]);

        // 3. Delete reminders for events this user created
        await connection.execute(`
            DELETE FROM user_reminders WHERE event_id IN 
            (SELECT event_id FROM events WHERE created_by = ?)
        `, [userId]);

        // 4. Delete the user's own registrations
        await connection.execute(
            'DELETE FROM registration WHERE user_id = ?', 
            [userId]
        );

        // 5. Delete the user's own reminders
        await connection.execute(
            'DELETE FROM user_reminders WHERE user_id = ?', 
            [userId]
        );

        // 6. Delete events the user created
        await connection.execute(
            'DELETE FROM events WHERE created_by = ?', 
            [userId]
        );

        // 7. Finally delete the user
        await connection.execute(
            'DELETE FROM user WHERE user_id = ?', 
            [userId]
        );

        res.status(200).json({ message: 'Account deleted successfully.' });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Error deleting account.' });
    } finally {
        if (connection) await connection.end();
    }
});
//Get User account creation
app.get('/api/user-info', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT email, created_at FROM user WHERE email = ?',
            [req.user.email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching user info' });
    } finally {
        if (connection) await connection.end();
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

//Health Check Functions (dashboard)
app.get('/api/health', async (req, res) => {
    try {
        const connection = await createConnection();
        await connection.execute('SELECT 1');
        await connection.end();
        res.json({ status: 'ok', db: 'connected'});
    } catch (error){
        console.error('Health check error:', error)
        res.status(503).json({ status: 'error', message: error.message});
    }
});


//get all table names for builder dropdown
app.get('/api/tables', async (req, res) => {
    try{
        const connection = await createConnection();
        const [rows] = await connection.execute('SHOW TABLES');
        await connection.end();
        const key = Object.keys(rows[0])[0];
        res.json({ tables: rows.map(r => r[key]) });
    } catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ message: 'Error fetching tables'});
    }
});

//Column List
app.get('/api/columns/:table', async (req, res) =>{
    try{
        const connection = await createConnection();
        const tableName = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
        const [rows] = await connection.execute(`DESCRIBE \`${tableName}\``);
        await connection.end();
        res.json({ columns: rows.map(r => r.Field) });
    } catch (error) {
        console.error('Error fetching columns:', error);
        res.status(500).json({ message: 'Error fetching columns.'});
    }
});

// Chart Data Query — supports optional JOIN
app.post('/api/chart-data', async (req, res) => {
    const { table, joinTable, xCol, yCol, agg } = req.body;

    const ALLOWED_AGG = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'];
    if (!ALLOWED_AGG.includes(agg))
        return res.status(400).json({ message: 'Invalid aggregate function.' });
    if (!table || !xCol || !yCol)
        return res.status(400).json({ message: 'table, xCol and yCol are required.' });

    // Sanitize all identifiers
    const safeTable     = table.replace(/[^a-zA-Z0-9_]/g, '');
    const safeX         = xCol.replace(/[^a-zA-Z0-9_.]/g, '');   // allow dot for table.col
    const safeY         = yCol.replace(/[^a-zA-Z0-9_.]/g, '');
    const safeJoinTable = joinTable ? joinTable.replace(/[^a-zA-Z0-9_]/g, '') : null;

    // Known join relationships — automatic, no user input needed
    const JOIN_MAP = {
        'registration:events':      'registration.event_id = events.event_id',
        'events:registration':      'registration.event_id = events.event_id',
        'registration:user':        'registration.user_id = user.user_id',
        'user:registration':        'registration.user_id = user.user_id',
        'events:user':              'events.created_by = user.user_id',
        'user:events':              'events.created_by = user.user_id',
        'user_reminders:events':    'user_reminders.event_id = events.event_id',
        'events:user_reminders':    'user_reminders.event_id = events.event_id',
        'user_reminders:user':      'user_reminders.user_id = user.user_id',
        'user:user_reminders':      'user_reminders.user_id = user.user_id',
    };

    try {
        const connection = await createConnection();
        let sql;

        if (safeJoinTable) {
            const joinKey = JOIN_MAP[`${safeTable}:${safeJoinTable}`];
            if (!joinKey) {
                await connection.end();
                return res.status(400).json({ message: `No known relationship between "${safeTable}" and "${safeJoinTable}".` });
            }

            sql = `
                SELECT ${safeX} AS label, ${agg}(${safeY}) AS value
                FROM   \`${safeTable}\`
                JOIN   \`${safeJoinTable}\` ON ${joinKey}
                GROUP  BY ${safeX}
                ORDER  BY value DESC
                LIMIT  50
            `;
        } else {
            // Single table — original behavior
            sql = `
                SELECT \`${safeX}\` AS label, ${agg}(\`${safeY}\`) AS value
                FROM   \`${safeTable}\`
                GROUP  BY \`${safeX}\`
                ORDER  BY value DESC
                LIMIT  50
            `;
        }

        const [rows] = await connection.execute(sql);
        await connection.end();

        res.json({
            labels: rows.map(r => String(r.label ?? 'NULL')),
            values: rows.map(r => parseFloat(r.value) || 0),
        });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ message: 'Error fetching chart data.' });
    }
});


//Stat Cards
app.get('/api/admin/stats/users', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
 
        let total = 0, active = 0, withRsvp = 0, new30d = 0;
         try {
            const [[row]] = await connection.execute(
                'SELECT COUNT(*) AS cnt FROM user WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
            );
            new30d = row.cnt;
        } catch (e) { console.error('stats new30d:', e.message); }
 
        try {
            const [[row]] = await connection.execute('SELECT COUNT(*) AS cnt FROM user');
            total = row.cnt;
        } catch (e) { console.error('stats total:', e.message); }
 
        try {
            const [[row]] = await connection.execute('SELECT COUNT(DISTINCT user_id) AS cnt FROM registration');
            active = row.cnt;
        } catch (e) { console.error('stats active:', e.message); }
 
        try {
            const [[row]] = await connection.execute('SELECT COUNT(DISTINCT user_id) AS cnt FROM user_reminders WHERE is_active = 1');
            withRsvp = row.cnt;
        } catch (e) { console.error('stats withRsvp:', e.message); }
 
        await connection.end();
        res.json({ total, active, withRsvp, new30d });
 
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ message: 'Error fetching user stats.' });
    } finally {
        if (connection) await connection.end();
    }
});

//Get todays RSVP count
app.get('/api/admin/stats/rsvp-today', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [[row]] = await connection.execute(
            'SELECT COUNT(*) AS cnt FROM registration WHERE DATE(reg_at) = CURDATE()'
        );
        await connection.end();
        res.json({ count: row.cnt });
    } catch (error) {
        console.error('Error fetching today RSVP count:', error);
        res.status(500).json({ message: 'Error fetching today RSVP count.' });
    } finally {
        if (connection) await connection.end();
    }
});


//Get Saved Charts from the Database
app.get('/api/saved-charts', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
 
        const createdBy = req.query.user || null;
        let rows;
 
        if (createdBy) {
            [rows] = await connection.execute(
                'SELECT * FROM saved_charts WHERE shared = 1 OR created_by = ? ORDER BY created_at DESC',
                [createdBy]
            );
        } else {
            [rows] = await connection.execute(
                'SELECT * FROM saved_charts ORDER BY created_at DESC'
            );
        }
 
        await connection.end();
 
        const charts = rows.map(r => ({
            id:           r.id,
            name:         r.name,
            category:     r.category,
            chartType:    r.chart_type,
            table:        r.table_name,
            xCol:         r.x_col,
            yCol:         r.y_col,
            agg:          r.agg_func,
            dataCategory: r.data_category,
            labels:       JSON.parse(r.labels_json || '[]'),
            values:       JSON.parse(r.values_json || '[]'),
            shared:       !!r.shared,
            createdBy:    r.created_by,
            createdAt:    new Date(r.created_at).toLocaleDateString(),
        }));
 
        res.json({ charts });
    } catch (error) {
        console.error('Error fetching saved charts:', error);
        res.status(500).json({ message: 'Error fetching saved charts.' });
    } finally {
        if (connection) await connection.end();
    }
});


// Saved Charts Create
app.post('/api/saved-charts', authenticateToken, async (req,res) =>{
    const {
        name, category, chartType, table, xCol, yCol,
        agg, dataCategory, labels, values, shared
    } = req.body;

    if(!name) {
        return res.status(400).json({ message: 'Chart name is required. '});
    }

    let connection;
    try {
        connection = await createConnection();

        const [result] = await connection.execute(
            `INSERT INTO saved_charts
            (name, category, chart_type, table_name, x_col, y_col,
            agg_func, data_category, labels_json, values_json, shared, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                category || 'parked',
                chartType || null,
                table || null,
                xCol || null,
                yCol || null,
                agg || null,
                dataCategory || null,
                JSON.stringify(labels || []),
                JSON.stringify(values || []),
                shared ? 1 : 0,
                req.user.email,
            ]
        );
        await connection.end();
        res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Error saving chart:', error);
        res.status(500).json({ message: 'Error saving chart.' });
    } finally {
        if (connection) await connection.end();
    }
});

//Saved Charts Delete
app.delete('/api/saved-charts/:id', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [result] = await connection.execute(
            'DELETE FROM saved_charts WHERE id = ?',
            [req.params.id] 
        );
        await connection.end();

        if (result.affectedRows === 0 ) {
            return res.status(404).json({ message: 'Chart not found.' });
        }
        res.json({ message: 'Chart deleted successfuly.'});
    } catch (error) {
        console.error('Error deleting chart:', error);
        res.status(500).json({ message: 'Error deleting chart.'});
    } finally {
        if (connection) await connection.end();
    }
});

//Saved Charts Move Category (drag and drop function)
app.patch('/api/saved-charts/:id/category', authenticateToken, async (req, res) => {
    const {category} = req.body;
    const VALID_CATS = ['parked', 'rsvp', 'event', 'user'];

    if(!VALID_CATS.includes(category)) {
        return res.status(400).json({message: 'Invalid category'});
    }

    let connection;
    try {
        connection = await createConnection();
        await connection.execute(
            'UPDATE saved_charts SET category = ? WHERE id = ?',
            [category, req.params.id]
        );
        await connection.end();
        res.json({ message: 'Category updated. '});
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({message: 'Error updating category.' });
    } finally {
        if (connection) await connection.end();
    }
});

//Toggle chart sharing
app.patch('/api/saved-charts/:id/share', authenticateToken, async (req,res) => {
    const {shared} = req.body;

    let connection;
    try {
        connection = await createConnection();
        await connection.execute(
            'UPDATE saved_charts SET shared = ? WHERE id = ?',
            [shared ? 1:0, req.params.id]
        );
        await connection.end();
        res.json({ message: `Chart ${shared ? 'shared' : 'unshared'} successfully.`});
    } catch (error) {
        console.error('Error updating share status:', error);
        res.status(500).json({ message: 'Error updating share status.'});
    } finally {
        if (connection) await connection.end();
    }
});

app.get('/api/admin/stats/users', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
 
        const [[totalRow]] = await connection.execute(
            'SELECT COUNT(*) AS cnt FROM user'
        );
 
        // Users who have at least one registration (active users)
        const [[activeRow]] = await connection.execute(
            'SELECT COUNT(DISTINCT user_id) AS cnt FROM registration'
        );
 
        // Users who have an active reminder
        const [[reminderRow]] = await connection.execute(
            'SELECT COUNT(DISTINCT user_id) AS cnt FROM user_reminders WHERE is_active = 1'
        );
 
        await connection.end();
        res.json({
            total:      totalRow.cnt,
            active:     activeRow.cnt,
            withRsvp:   reminderRow.cnt,
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ message: 'Error fetching user stats.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Route: Get all users (admin)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [rows] = await connection.execute(
            'SELECT user_id, email, role, created_at FROM user ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Route: Update user role (admin)
app.patch('/api/admin/users/:id/role', authenticateToken, async (req, res) => {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role.' });
    }
    let connection;
    try {
        connection = await createConnection();
        await connection.execute(
            'UPDATE user SET role = ? WHERE user_id = ?',
            [role, req.params.id]
        );
        res.json({ message: `User role updated to ${role}.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating role.' });
    } finally {
        if (connection) await connection.end();
    }
});