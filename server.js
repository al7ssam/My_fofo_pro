// server.js
const express = require('express');
const fetch = require('node-fetch'); // تأكد من تثبيت node-fetch@2
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// لتفسير بيانات POST (x-www-form-urlencoded)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// إعداد CORS للسماح للواجهة بالوصول
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // في الإنتاج يمكنك تحديد النطاق المسموح به
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// جعل المجلد العام متاحًا للوصول إليه
app.use(express.static(path.join(__dirname, 'public')));

// عند فتح الصفحة الرئيسية، يتم إرسال `index.html`
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
