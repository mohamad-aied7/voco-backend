require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
});

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(bodyParser.json());

// 1. جلب الزيارات (للداشبورد والتطبيق)
app.get('/api/visits', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM visits ORDER BY created_at DESC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. جلب المستخدمين
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT name, phone, balance FROM users ORDER BY name ASC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. جلب الإشعارات
app.get('/api/notifications', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5');
        const countRes = await pool.query('SELECT COUNT(*) FROM notifications WHERE is_read = FALSE');
        
        res.status(200).json({ 
            success: true, 
            data: result.rows, 
            unreadCount: countRes.rows[0].count 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'فشل جلب الإشعارات' });
    }
});

// 4. تحليل AI (مؤقت)
app.post('/api/analyze-ai', (req, res) => {
    const { visitsText, repName } = req.body;
    const analysis = `AI Analysis for ${repName}: Received ${visitsText ? visitsText.length : 0} records.`;
    res.status(200).json({ success: true, analysis: analysis });
});

// ---------------------------------------------------------
// 🚀 الإضافات الجديدة لربط الموبايل
// ---------------------------------------------------------

// 5. تسجيل الدخول (للموبايل)
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1 AND password = $2', [phone, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            // إضافة إشعار
            await pool.query("INSERT INTO notifications (title, message, type) VALUES ($1, $2, 'info')", 
                ['تسجيل دخول', `المندوب ${user.name} دخل للتطبيق`]);
            
            res.status(200).json({ success: true, user: user });
        } else {
            res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. استلام زيارة جديدة (من الموبايل)
app.post('/api/visits', async (req, res) => {
    const { user_id, rep_name, customer_name, voice_text, lat, lng } = req.body;
    try {
        // حفظ الزيارة
        await pool.query(
            'INSERT INTO visits (user_id, rep_name, customer_name, voice_text, lat, lng) VALUES ($1, $2, $3, $4, $5, $6)',
            [user_id, rep_name, customer_name, voice_text, lat, lng]
        );

        // خصم الرصيد (نقطة واحدة)
        await pool.query('UPDATE users SET balance = balance - 1 WHERE id = $1', [user_id]);

        // إشعار للإدارة
        await pool.query("INSERT INTO notifications (title, message, type) VALUES ($1, $2, 'success')", 
            ['زيارة جديدة', `قام ${rep_name} بزيارة العميل ${customer_name}`]);

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});


// update cors fix