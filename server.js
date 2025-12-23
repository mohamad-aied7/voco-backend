require('dotenv').config();
const dns = require('dns');
// حل مشكلة الاتصال بـ Supabase (IPv6)
dns.setDefaultResultOrder('ipv4first'); 

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

// إعداد الاتصال بقاعدة البيانات
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } // ضروري لـ Supabase/Render
});

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(bodyParser.json());

// ---------------------------------------------------------
// 📥 1. جلب البيانات (GET Requests)
// ---------------------------------------------------------

// جلب جميع الزيارات (للداشبورد والتطبيق)
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
        res.status(500).json({ success: false, error: err.message });
    }
});

// جلب الإشعارات (آخر 20 إشعار)
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
        res.status(500).json({ success: false, error: 'فشل جلب الإشعارات' });
    }
});

// ---------------------------------------------------------
// 📤 2. إرسال البيانات (POST Requests)
// ---------------------------------------------------------

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1 AND password = $2', [phone, password]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            
            // تسجيل إشعار دخول (اختياري - يمكن إيقافه لتقليل الازعاج)
            // await pool.query("INSERT INTO notifications (title, message, type) VALUES ($1, $2, 'info')", 
            //     ['تسجيل دخول', `المندوب ${user.name} دخل للتطبيق`]);
            
            res.status(200).json({ success: true, user: user });
        } else {
            res.status(401).json({ success: false, message: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔥 استلام زيارة جديدة (مع الذكاء والتفاصيل الكاملة)
app.post('/api/visits', async (req, res) => {
    const { 
        user_id, 
        rep_name, rep_phone,       // بيانات المندوب
        customer_name, customer_phone, // بيانات العميل
        place_type,                // 🏢 نوع المكان
        voice_text, 
        is_interested,             // ❤️ مهتم؟
        has_next_meeting,          // 📅 موعد قادم؟
        next_meeting_date, 
        next_meeting_location,
        lat, lng 
    } = req.body;

    try {
        // 1. حفظ الزيارة في قاعدة البيانات
        await pool.query(
            `INSERT INTO visits (
                user_id, rep_name, rep_phone, 
                customer_name, customer_phone, place_type, 
                voice_text, is_interested, 
                has_next_meeting, next_meeting_date, next_meeting_location, 
                lat, lng
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                user_id, rep_name, rep_phone, 
                customer_name, customer_phone, place_type, 
                voice_text, is_interested, 
                has_next_meeting, next_meeting_date || null, next_meeting_location, 
                lat, lng
            ]
        );

        // 2. زيادة رصيد المندوب (مكافأة 10 نقاط لكل زيارة) 💰
        // (تم تعديلها لزيادة الرصيد بدلاً من الخصم كتحفيز)
        await pool.query('UPDATE users SET balance = balance + 10 WHERE id = $1', [user_id]);

        // 3. إرسال إشعار للإدارة
        let notifTitle = 'زيارة جديدة 📍';
        let notifType = 'info';
        let notifMsg = `قام ${rep_name} بزيارة ${customer_name}`;

        if (is_interested) {
            notifTitle = 'فرصة بيع محتملة! 🔥';
            notifType = 'success';
            notifMsg += ' (العميل مهتم جداً)';
        } else if (place_type) {
            notifMsg += ` - نوع المكان: ${place_type}`;
        }

        await pool.query("INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)", 
            [notifTitle, notifMsg, notifType]);

        res.status(200).json({ success: true, message: 'تم الحفظ بنجاح' });

    } catch (err) {
        console.error("Error saving visit:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`✅ Server running securely on port ${PORT}`);
});