require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
// 🟢 استدعاء مكتبة جوجل (Gemini)
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { appendDataToSheet } = require('./sheetsService'); 

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

// ملفات الويب
app.use(express.static(path.join(__dirname, 'web-crm'))); 

// إعداد Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 🟢 إعداد Gemini (تم وضع مفتاحك هنا)
const genAI = new GoogleGenerativeAI("AIzaSyDO4T_ZdgbgVlq-B4r8IRHPC0LMFvWceuM");
// التعديل هنا 👇
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // موديل سريع ومجاني

// --- الروابط (APIs) ---

// 1. الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web-crm', 'dashboard.html'));
});

// 2. تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    const { data, error } = await supabase
        .from('users').select('*').eq('phone', phone).eq('password', password).single();

    if (error || !data) return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });
    res.json({ success: true, user: { id: data.id, name: data.name, balance: data.balance } });
});

// 3. استلام زيارة
app.post('/api/visits', async (req, res) => {
    const { user_id, rep_name, customer_name, voice_text, lat, lng, address_text, voice_url } = req.body;
    
    // التحقق من الرصيد
    const { data: user } = await supabase.from('users').select('balance').eq('id', user_id).single();
    if (!user || user.balance <= 0) return res.status(400).json({ success: false, message: 'رصيدك نفد!' });

    await supabase.from('users').update({ balance: user.balance - 1 }).eq('id', user_id);

    // الحفظ في Supabase
    const { error } = await supabase
        .from('visits')
        .insert([{ user_id, rep_name, customer_name, voice_text, lat, lng, voice_url }]);
        
    // الحفظ في Sheets
    await appendDataToSheet({ user_id, customer_name, voice_transcription: voice_text, address_text, lat, lng });

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: 'تم الحفظ' });
});

// 4. جلب الزيارات
app.get('/api/visits', async (req, res) => {
    const { data } = await supabase.from('visits').select('*').order('created_at', { ascending: false });
    res.json({ data });
});

// 5. جلب المستخدمين
app.get('/api/users', async (req, res) => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    res.json({ success: true, data });
});

// 6. 🧠 تحليل الذكاء الاصطناعي (باستخدام Gemini)
app.post('/api/analyze-ai', async (req, res) => {
    const { visitsText, repName } = req.body;

    if (!visitsText || visitsText.length === 0) {
        return res.json({ success: false, analysis: "لا توجد بيانات كافية للتحليل." });
    }

    const combinedText = visitsText.join("\n- ");

    try {
        const prompt = `
            أنت مساعد مدير مبيعات ذكي. قم بتحليل تقارير المندوب "${repName}".
            هذه هي نصوص الزيارات التي سجلها:
            - ${combinedText}

            المطلوب منك كتابة تقرير ملخص بالعربية يحتوي على:
            1. ملخص الإنجاز (ماذا فعل المندوب باختصار).
            2. أبرز ملاحظات أو مشاكل العملاء.
            3. توصيات للتحسين.
            
            اجعل الرد بتنسيق HTML بسيط (استخدم <b> للعريض و <br> للأسطر) ليكون مرتباً. لا تستخدم Markdown.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.json({ success: true, analysis: responseText });

    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ success: false, error: "فشل الاتصال بـ Google Gemini." });
    }
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`✅ Server Running on port ${PORT}`);
});