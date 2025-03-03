// server.js
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// مفاتيح API (DrD3m و Seoclevers) من متغيرات البيئة
const DRD3M_API_KEY = process.env.DRD3M_API_KEY;
const SEOCLEVERS_API_KEY = process.env.SEOCLEVERS_API_KEY;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// إعداد CORS للسماح للواجهة بالوصول
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // في الإنتاج، يمكنك تحديد النطاق المسموح به
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

app.options('*', (req, res) => {
  res.sendStatus(200);
});

// تقديم الملفات الثابتة من مجلد public
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// عند فتح الصفحة الرئيسية، يتم إرسال index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ★★★ نقطة نهاية للتحقق من كلمة المرور (آمن) ★★★

// متغير عام لتخزين كلمات المرور في ذاكرة الخادم
// تحميلها مرة واحدة عند بدء الخادم بدلاً من قراءتها مع كل طلب
let passwordConfig = {};

// دالة لتحميل ملف كلمات المرور
function loadPasswordConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'passwords.json');
    
    // التحقق من وجود الملف
    if (!fs.existsSync(configPath)) {
      console.error('خطأ: ملف كلمات المرور غير موجود');
      // إنشاء ملف افتراضي لكلمات المرور
      const defaultConfig = {
        "manageServicesPage": "0",
        "orderPage": "1"
      };
      
      // التأكد من وجود مجلد config
      if (!fs.existsSync(path.join(process.cwd(), 'config'))) {
        fs.mkdirSync(path.join(process.cwd(), 'config'), { recursive: true });
      }
      
      // كتابة الملف الافتراضي
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      console.log('تم إنشاء ملف كلمات المرور الافتراضي');
      passwordConfig = defaultConfig;
      return;
    }
    
    // قراءة الملف
    const data = fs.readFileSync(configPath, 'utf8');
    
    // محاولة تحليل JSON
    try {
      passwordConfig = JSON.parse(data);
      console.log('تم تحميل ملف كلمات المرور بنجاح');
    } catch (parseError) {
      console.error('خطأ في تنسيق ملف كلمات المرور. استخدام القيم الافتراضية');
      passwordConfig = {
        "manageServicesPage": "0",
        "orderPage": "1"
      };
    }
  } catch (error) {
    console.error('خطأ أثناء تحميل كلمات المرور:', error.message);
    passwordConfig = {
      "manageServicesPage": "0",
      "orderPage": "1"
    };
  }
}

// تحميل كلمات المرور عند بدء الخادم
loadPasswordConfig();

// للتتبع ومنع هجمات تخمين كلمات المرور
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const BLOCK_TIME = 15 * 60 * 1000; // 15 دقيقة بالملي ثانية

// إعادة تعيين عداد محاولات تسجيل الدخول كل 15 دقيقة
setInterval(() => {
  const now = Date.now();
  for (const ip in loginAttempts) {
    if (now - loginAttempts[ip].timestamp > BLOCK_TIME) {
      delete loginAttempts[ip];
    }
  }
}, BLOCK_TIME);

// نقطة نهاية للتحقق من كلمة المرور
app.post('/api/check-password', (req, res) => {
  const { pageKey, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  
  // التحقق من صحة المدخلات
  if (!pageKey || !password || typeof pageKey !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid input format' });
  }
  
  // فحص عدد محاولات تسجيل الدخول
  if (loginAttempts[ip] && loginAttempts[ip].count >= MAX_ATTEMPTS) {
    const timeLeft = Math.ceil((BLOCK_TIME - (Date.now() - loginAttempts[ip].timestamp)) / 60000);
    return res.status(429).json({ 
      success: false, 
      error: `Too many attempts. Please try again later (${timeLeft} minutes remaining).` 
    });
  }
  
  try {
    // التحقق من كلمة المرور
    if (passwordConfig[pageKey] && passwordConfig[pageKey] === password) {
      // إعادة تعيين عداد المحاولات عند نجاح تسجيل الدخول
      if (loginAttempts[ip]) {
        delete loginAttempts[ip];
      }
      return res.json({ success: true });
    } else {
      // تسجيل محاولة الدخول الفاشلة
      if (!loginAttempts[ip]) {
        loginAttempts[ip] = { count: 1, timestamp: Date.now() };
      } else {
        loginAttempts[ip].count += 1;
        loginAttempts[ip].timestamp = Date.now();
      }
      
      // إذا كان هناك صفحة لكن كلمة المرور خاطئة
      if (passwordConfig[pageKey]) {
        return res.status(401).json({ success: false, error: 'Invalid password' });
      } else {
        // إذا لم تكن هناك صفحة بالمفتاح المحدد
        return res.status(401).json({ success: false, error: 'Invalid page key' });
      }
    }
  } catch (err) {
    console.error('خطأ أثناء التحقق من كلمة المرور:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// تقديم ملف servicesData.json (إذا كنت تستخدمه)
app.get('/servicesData.json', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(publicPath, 'servicesData.json'), 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err) {
    console.error('Error reading servicesData.json:', err);
    res.status(500).json({ error: 'Failed to read services data' });
  }
});

// نقطة النهاية للـ DrD3m Proxy
app.post('/api/drd3m', async (req, res) => {
  try {
    const postData = new URLSearchParams(req.body);
    postData.append('key', DRD3M_API_KEY);
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

// نقطة النهاية للـ Seoclevers Proxy
app.post('/api/seoclevers', async (req, res) => {
  try {
    const postData = new URLSearchParams(req.body);
    postData.append('key', SEOCLEVERS_API_KEY);
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

// نقاط نهاية API لاستعلام الأرصدة
app.get('/api/balance/seoclevers', async (req, res) => {
  try {
    const response = await fetch('https://seoclevers.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: SEOCLEVERS_API_KEY,
        action: 'balance'
      })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: DRD3M_API_KEY,
        action: 'balance'
      })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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