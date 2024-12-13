require('dotenv').config(); // Load environment variables from .env
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.resolve(__dirname, 'credentials.json');
const TOKEN_PATH = path.resolve(__dirname, 'token.json');

async function authenticate() {
    let credentials;
    try {
        credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    } catch (error) {
        console.error(`Error reading ${CREDENTIALS_PATH}:`, error.message);
        process.exit(1); // Exit the program if credentials.json is invalid
    }

    // Check if the structure contains "web"
    const config = credentials.web || credentials.installed;
    if (!config) {
        console.error('Invalid credentials.json file. Ensure it contains the "web" or "installed" object.');
        process.exit(1);
    }

    const { client_secret, client_id, redirect_uris } = config;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        oAuth2Client.setCredentials(token);
    } else {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar.readonly'],
        });
        console.log('Authorize this app by visiting this URL:', authUrl);

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        await new Promise((resolve) => {
            readline.question('Enter the code from that page here: ', async (code) => {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
                console.log('Token stored to', TOKEN_PATH);
                readline.close();
                resolve();
            });
        });
    }

    return oAuth2Client;
}


async function getFreeBusyIntervals(auth, calendarId, timeMin, timeMax) {
    const calendar = google.calendar({ version: 'v3', auth });
    try {
        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin,
                timeMax,
                items: [{ id: calendarId }],
            },
        });

        const busyIntervals = response.data.calendars[calendarId].busy;
        console.log('Busy intervals:', busyIntervals);
        return busyIntervals;
    } catch (error) {
        console.error('Error fetching free/busy intervals:', error.message);
        throw error;
    }
}

async function main() {
    const calendarId = 'your-shared-calendar-id@group.calendar.google.com';
    const timeMin = '2024-12-13T00:00:00Z';
    const timeMax = '2024-12-13T23:59:59Z';

    try {
        const auth = await authenticate();
        const intervals = await getFreeBusyIntervals(auth, calendarId, timeMin, timeMax);
        console.log('Free/Busy intervals:', intervals);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
