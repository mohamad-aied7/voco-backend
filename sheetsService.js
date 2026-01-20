// sheetsService.js
const { google } = require('googleapis');

// (التعديل 1: تأكد أن اسم المفتاح صحيح)
const key = require('./gen-lang-client-0459196732-222fff43dcf44.json');

// (التعديل 2 و 3)
const SPREADSHEET_ID = '1TQQplpXbt1t8i3cXOZJYjxLmvuW3Cp61bTBHHeHgGK0';
const SHEET_NAME = 'Sheet1'; 

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function appendDataToSheet(data) {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const row = [
            new Date().toISOString(),   // A: DATE_TIME
            data.user_id || 'N/A',      // B: MANDOUB_ID
            data.customer_name,         // C: CLIENT_NAME
            data.voice_transcription || 'N/A', // D: VOICE_TRANSCRIPTION (النص المُحوَّل من Flutter)
            data.address_text || 'N/A', // E: ADDRESS_TEXT
            data.lat,                   // F: LATITUDE
            data.lng,                   // G: LONGITUDE
            'No'                        // H: IS_TEST
        ];

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:H`, 
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [row],
            },
        });

        console.log(`✅ ${response.data.updates.updatedCells} cells updated in Google Sheet.`);
        return { success: true };
    } catch (error) {
        console.error("🛑 Error appending data to Google Sheet:", error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { appendDataToSheet };