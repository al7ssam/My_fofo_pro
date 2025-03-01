// server.js
const express = require('express');
const fetch = require('node-fetch'); // إضافة هذه السطر لاستيراد fetch
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DRD3M_API_KEY = process.env.DRD3M_API_KEY;
const SEOCLEVERS_API_KEY = process.env.SEOCLEVERS_API_KEY;

// لتفسير بيانات POST (x-www-form-urlencoded)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// إعداد CORS للسماح للواجهة بالوصول
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // في الإنتاج، يمكنك تحديد النطاق المسموح به
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // ✅ حل مشكلة CORS
  next();
});

// معالجة طلبات OPTIONS لمنع أخطاء CORS
app.options('*', (req, res) => {
  res.sendStatus(200);
});

// جعل المجلد العام متاحًا للوصول إليه
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// عند فتح الصفحة الرئيسية، يتم إرسال `index.html`
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// نقطة النهاية للـDrD3m Proxy
app.post('/api/drd3m', async (req, res) => {
  try {
    const response = await fetch('https://drd3m.me/api/v2', {
      method: 'POST',
      body: new URLSearchParams(req.body),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const json = await response.json();
    res.json(json);
  } catch (err) {
    console.error("Error in /api/drd3m:", err);
    res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
});

// نقطة النهاية للـSeoclevers Proxy
app.post('/api/seoclevers', async (req, res) => {
  try {
    const response = await fetch('https://seoclevers.com/api/v2', {
      method: 'POST',
      body: new URLSearchParams(req.body),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const json = await response.json();
    res.json(json);
  } catch (err) {
    console.error("Error in /api/seoclevers:", err);
    res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Proxy server listening on port ${PORT}`);
});

// self-ping لمنع السبات
function selfPing() {
  const url = 'https://my-fofo-pro.onrender.com/';
  require('node-fetch')(url)
    .then(response => {
      if (response.ok) {
        console.log('Self ping successful');
      } else {
        console.error('Self ping failed with status', response.status);
      }
    })
    .catch(err => console.error('Self ping error:', err));
}

setInterval(selfPing, 15 * 60 * 1000);