// server.js
const express = require('express');
const fetch = require('node-fetch'); // إضافة هذه السطر لاستيراد fetch
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// متغيرات البيئة التي يتم استخدامها في استضافة Render.com
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

// تحميل ملف كلمات المرور من المجلد الآمن
app.get('/passwords.json', (req, res) => {
  try {
    const data = fs.readFileSync('config/passwords.json', 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err) {
    console.error('Error reading passwords.json:', err);
    res.status(500).json({ error: 'Failed to read passwords data' });
  }
});

// تحميل البيانات من ملف JSON
app.get('/servicesData.json', (req, res) => {
  try {
    const data = fs.readFileSync('public/servicesData.json', 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err) {
    console.error('Error reading servicesData.json:', err);
    res.status(500).json({ error: 'Failed to read services data' });
  }
});

// نقطة النهاية للـDrD3m Proxy
app.post('/api/drd3m', async (req, res) => {
  try {
    const postData = new URLSearchParams(req.body);
    postData.append('key', DRD3M_API_KEY); // إضافة مفتاح API الخاص بـ DrD3m

    const response = await fetch('https://drd3m.me/api/v2', {
      method: 'POST',
      body: postData,
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
    const postData = new URLSearchParams(req.body);
    postData.append('key', SEOCLEVERS_API_KEY); // إضافة مفتاح API الخاص بـ Seoclevers

    const response = await fetch('https://seoclevers.com/api/v2', {
      method: 'POST',
      body: postData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const json = await response.json();
    res.json(json);
  } catch (err) {
    console.error("Error in /api/seoclevers:", err);
    res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
});

// نقاط نهاية API للحصول على أرصدة المزودين
app.get('/api/balance/seoclevers', async (req, res) => {
    try {
        const response = await fetch('https://seoclevers.com/api/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                key: SEOCLEVERS_API_KEY,
                action: 'balance'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching Seoclevers balance:', error);
        res.status(500).json({ error: 'خطأ في الاتصال بـ API سيوكليفرز' });
    }
});

app.get('/api/balance/drdaam', async (req, res) => {
    try {
        const response = await fetch('https://drd3m.me/api/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                key: DRD3M_API_KEY,
                action: 'balance'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching DrDaam balance:', error);
        res.status(500).json({ error: 'خطأ في الاتصال بـ API دكتور دعم' });
    }
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});

// self-ping لمنع السبات
function selfPing() {
  // استخدام متغير البيئة للرابط أو استخدام الرابط الافتراضي
  const appUrl = process.env.APP_URL || 'https://my-app.onrender.com';
  
  fetch(appUrl)
    .then(response => {
      if (!response.ok) {
        console.error('فشل الاتصال الذاتي:', response.status);
      }
    })
    .catch(err => console.error('خطأ في الاتصال الذاتي:', err));
}

setInterval(selfPing, 15 * 60 * 1000);