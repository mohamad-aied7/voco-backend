require('dotenv').config();
const dns = require('dns');

// 👇👇👇 هذا السطر هو الحل لمشكلة "غير متصل" 👇👇👇
// يجبر السيرفر على استخدام النظام القديم للإنترنت (IPv4) المتوافق مع Supabase
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

// إعداد الاتصال بقاعدة البيانات
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // ضروري لـ Render
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// تشغيل ملفات الداشبورد (HTML)
app.use(express.static('public'));

// ---------------------------------------------------------
// 📥 1. فحص حالة النظام (Health Check)
// ---------------------------------------------------------
app.get('/api/status', async (req, res) => {
    try {
        // تجربة استعلام بسيط جداً للتأكد من الاتصال
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'online', db: 'connected' });
    } catch (err) {
        console.error("Database connection error:", err);
        res.status(500).json({ status: 'offline', error: err.message });
    }
});

// ---------------------------------------------------------
// 📥 2. جلب البيانات (GET Requests)
// ---------------------------------------------------------

// جلب جميع الزيارات
app.get('/api/visits', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM visits ORDER BY created_at DESC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Error fetching visits:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// جلب المستخدمين
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT name, phone, balance FROM users ORDER BY name ASC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// جلب الإشعارات
app.get('/api/notifications', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20');
        const countRes = await pool.query('SELECT COUNT(*) FROM notifications WHERE is_read = FALSE');
        
        res.status(200).json({ 
            success: true, 
            data: result.rows, 
            unreadCount: parseInt(countRes.rows[0].count) 
        });
    } catch (err) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------
// 📤 3. إرسال البيانات (POST Requests)
// ---------------------------------------------------------

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1 AND password = $2', [phone, password]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.status(200).json({ success: true, user: user });
        } else {
            res.status(401).json({ success: false, message: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// تسجيل زيارة جديدة
app.post('/api/visits', async (req, res) => {
    const { 
        user_id, rep_name, rep_phone, customer_name, customer_phone,
        place_type, voice_text, is_interested,
        has_next_meeting, next_meeting_date, next_meeting_location,
        lat, lng 
    } = req.body;

    try {
        await pool.query(
            `INSERT INTO visits (
                user_id, rep_name, rep_phone, customer_name, customer_phone, place_type, 
                voice_text, is_interested, has_next_meeting, next_meeting_date, next_meeting_location, 
                lat, lng
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                user_id, rep_name, rep_phone, customer_name, customer_phone, place_type, 
                voice_text, is_interested, has_next_meeting, next_meeting_date || null, next_meeting_location, 
                lat, lng
            ]
        );

        await pool.query('UPDATE users SET balance = balance + 10 WHERE id = $1', [user_id]);

        let notifTitle = 'زيارة جديدة 📍';
        let notifType = 'info';
        let notifMsg = `قام ${rep_name} بزيارة ${customer_name}`;

        if (is_interested) {
            notifTitle = 'فرصة بيع محتملة! 🔥';
            notifType = 'success';
            notifMsg += ' (العميل مهتم جداً)';
        }

        await pool.query("INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)", 
            [notifTitle, notifMsg, notifType]);

        res.status(200).json({ success: true, message: 'تم الحفظ بنجاح' });

    } catch (err) {
        console.error("Error saving visit:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running securely on port ${PORT}`);
});