const { GoogleGenerativeAI } = require("@google/generative-ai");

// مفتاحك
const genAI = new GoogleGenerativeAI("AIzaSyDO4T_ZdgbgVlq-B4r8IRHPC0LMFvWceuM");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function run() {
  try {
    console.log("⏳ جاري محاولة الاتصال بجوجل...");
    const result = await model.generateContent("هل تسمعني؟ أجب بكلمة واحدة: نعم");
    const response = await result.response;
    console.log("✅ نجح الاتصال! الرد هو: " + response.text());
  } catch (error) {
    console.log("❌ فشل الاتصال. السبب:");
    console.error(error.message); // هذا سيعطينا السبب الحقيقي
  }
}

run();