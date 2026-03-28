# RSVP Devils — Campus Event Discovery & RSVP Platform

A web app for Arizona State University students to discover, create, and RSVP to campus events, with automated email reminders.

## Setup

- Run `npm install` in the project root
- Copy `.env.example` to `.env` and fill in your credentials:
  - MySQL database connection details
  - JWT secret key
  - Email SMTP credentials (Gmail or Mailtrap for testing)
- Run the DDL script in `user_table_ddl.sql` against your MySQL database to create the required tables
- Start the app with `npm run dev`
- Navigate to `http://localhost:3000`

## Environment Variables

```
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
```

## Features

- JWT-based authentication with bcrypt password hashing
- Browse, create, edit, and delete campus events
- Filter events by category, location, and date
- RSVP to events with confirmation email sent on registration
- Cancel RSVP with automatic reminder deactivation
- Automated email reminders sent 24 hours before events via cron job
- Toggle reminders on/off per event from the reminders page
- Email preview per reminder on the reminders page
- Admin dashboard showing registered users
- Only `.edu` email addresses can receive notifications

## Email Testing

For local development, use [Mailtrap](https://mailtrap.io) sandbox SMTP credentials in your `.env` to catch all outgoing emails without delivering to real inboxes.

For production, swap in Gmail SMTP or any real email provider credentials — no code changes needed.

## Architecture

- `server.js` — Express backend, REST API routes, cron job, email logic
- `public/js/` — Frontend controllers per page
- `public/css/` — Page-specific stylesheets
- `user_table_ddl.sql` — Database schema
