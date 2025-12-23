require('dotenv').config();
const dns = require('dns');
// إجبار النظام على استخدام IPv4
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 👇👇👇 هنا وضعنا الرابط الصحيح مباشرة لضمان العمل 👇👇👇
const connectionString = 'postgresql://postgres.fdmsuhkfbfbvkvifwgpo:MjdD3yt6!gQ2T9n@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
});

// --- مسار الفحص للتأكد ---
app.get('/api/status', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'Online 🟢', port: 6543 });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ status: 'Offline 🔴', error: err.message });
    }
});

// --- باقي المسارات (Visits, Users, etc.) ---

app.get('/api/visits', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM visits ORDER BY created_at DESC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Error fetching visits:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT name, phone, balance FROM users ORDER BY name ASC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/notifications', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20');
        const countRes = await pool.query('SELECT COUNT(*) FROM notifications WHERE is_read = FALSE');
        res.status(200).json({ success: true, data: result.rows, unreadCount: parseInt(countRes.rows[0].count) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/visits', async (req, res) => {
    const { user_id, rep_name, rep_phone, customer_name, customer_phone, place_type, voice_text, is_interested, has_next_meeting, next_meeting_date, next_meeting_location, lat, lng } = req.body;
    try {
        await pool.query(
            `INSERT INTO visits (user_id, rep_name, rep_phone, customer_name, customer_phone, place_type, voice_text, is_interested, has_next_meeting, next_meeting_date, next_meeting_location, lat, lng) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [user_id, rep_name, rep_phone, customer_name, customer_phone, place_type, voice_text, is_interested, has_next_meeting, next_meeting_date || null, next_meeting_location, lat, lng]
        );
        if(user_id) await pool.query('UPDATE users SET balance = balance + 10 WHERE id = $1', [user_id]);
        
        // إضافة إشعار
        let notifTitle = 'زيارة جديدة 📍';
        let notifType = 'info';
        if (is_interested) { notifTitle = 'فرصة بيع! 🔥'; notifType = 'success'; }
        await pool.query("INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)", [notifTitle, `بواسطة ${rep_name}`, notifType]);

        res.status(200).json({ success: true, message: 'Saved' });
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running securely on port ${PORT}`);
});