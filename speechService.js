// speechService.js
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

const keyFilenameCandidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, 'credentials', 'google-sa.json'),
    path.join(__dirname, 'gen-lang-client-0459196732-222fff43dcf44.json'),
].filter(Boolean);

const resolvedKeyFilename = keyFilenameCandidates.find((p) => {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
});

const client = resolvedKeyFilename ? new SpeechClient({ keyFilename: resolvedKeyFilename }) : new SpeechClient();

async function transcribeWavBuffer(buffer) {
    if (!buffer || buffer.length === 0) return '';

    const audio = {
        content: buffer.toString('base64'),
    };

    const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'ar-IQ',
        model: 'latest_long',
        useEnhanced: true,
        speechContexts: [
            {
                phrases: [
                    'التقيت',
                    'قابلت',
                    'رحت عند',
                    'الزبون',
                    'العميل',
                    'اسمه',
                    'اسم الزبون',
                    'رقمه',
                    'رقم الهاتف',
                    'ملاحظات',
                    'محل',
                    'شركة',
                    'مطعم',
                    'مقهى',
                    'كافيه',
                ],
                boost: 15.0,
            },
        ],
    };

    const request = {
        audio,
        config,
    };

    try {
        const [operation] = await client.longRunningRecognize(request);
        const [response] = await operation.promise();

        const transcription = (response.results || [])
            .map((result) => (result.alternatives && result.alternatives[0] ? result.alternatives[0].transcript : ''))
            .filter(Boolean)
            .join('\n')
            .trim();

        return transcription;
    } catch (error) {
        console.error('Speech-to-Text Error:', error.message);
        return '';
    }
}

module.exports = { transcribeWavBuffer };