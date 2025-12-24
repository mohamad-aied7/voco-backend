require('dotenv').config();
const dns = require('dns');
// إجبار النظام على استخدام IPv4 لحل مشاكل الاتصال بـ Render
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

// 👇 رابط قاعدة البيانات (Supabase Connection Pooler)
const connectionString = 'postgresql://postgres.fdmsuhkfbfbvkvifwgpo:MjdD3yt6!gQ2T9n@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
});

// --- 1. مسار الفحص (Health Check) ---
app.get('/api/status', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'Online 🟢', port: 6543 });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ status: 'Offline 🔴', error: err.message });
    }
});

// --- 2. مسار تسجيل الدخول (مهم جداً للتطبيق) ---
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        // بحث عن المستخدم برقم الهاتف
        const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            // تحقق بسيط من الباسوورد (في التطبيق الحقيقي يفضل التشفير)
            if (user.password == password) {
                res.status(200).json({ 
                    success: true, 
                    user: { 
                        id: user.id, 
                        name: user.name, 
                        balance: user.balance 
                    } 
                });
            } else {
                res.status(200).json({ success: false, message: 'كلمة المرور غير صحيحة' });
            }
        } else {
            res.status(200).json({ success: false, message: 'رقم الهاتف غير مسجل' });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- 3. جلب الزيارات ---
app.get('/api/visits', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM visits ORDER BY created_at DESC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- 4. جلب المستخدمين ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT name, phone, balance FROM users ORDER BY name ASC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- 5. جلب الإشعارات ---
app.get('/api/notifications', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20');
        const countRes = await pool.query('SELECT COUNT(*) FROM notifications WHERE is_read = FALSE');
        res.status(200).json({ success: true, data: result.rows, unreadCount: parseInt(countRes.rows[0].count) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- 6. حفظ زيارة جديدة (مع البيانات الذكية) ---
app.post('/api/visits', async (req, res) => {
    // استلام كافة البيانات الجديدة من التطبيق
    const { 
        user_id, rep_name, rep_phone, 
        customer_name, customer_phone, 
        place_type, voice_text, 
        is_interested, has_next_meeting, 
        next_meeting_date, next_meeting_location, 
        lat, lng 
    } = req.body;

    try {
        await pool.query(
            `INSERT INTO visits (
                user_id, rep_name, rep_phone, 
                customer_name, customer_phone, 
                place_type, voice_text, 
                is_interested, has_next_meeting, 
                next_meeting_date, next_meeting_location, 
                lat, lng
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                user_id, rep_name, rep_phone, 
                customer_name, customer_phone, 
                place_type, voice_text, 
                is_interested, has_next_meeting, 
                next_meeting_date || null, // إذا ماكو تاريخ خليه null
                next_meeting_location, 
                lat, lng
            ]
        );
        
        // زيادة رصيد المندوب 10 نقاط
        if(user_id) await pool.query('UPDATE users SET balance = balance + 10 WHERE id = $1', [user_id]);
        
        // إنشاء إشعار للإدارة
        let notifTitle = 'زيارة جديدة 📍';
        let notifType = 'info';
        if (is_interested) { notifTitle = 'فرصة بيع قوية! 🔥'; notifType = 'success'; }
        
        await pool.query("INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)", 
            [notifTitle, `المندوب ${rep_name} زار ${customer_name} (${place_type})`, notifType]
        );

        res.status(200).json({ success: true, message: 'Saved successfully' });
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running securely on port ${PORT}`);
});


// Update login fix 1