// server.js
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// تعريف المسارات للملفات والمجلدات
const publicPath = path.join(process.cwd(), 'public');
const dataDirectory = path.join(process.cwd(), 'data');
const servicesFilePath = path.join(dataDirectory, 'servicesData.json');
const publicServicesPath = path.join(publicPath, 'servicesData.json');

// متغيرات البيئة (Environment Variables)
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
app.use(express.static(publicPath));

// عند فتح الصفحة الرئيسية، يتم إرسال index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// حذف نقطة النهاية التي تعرض passwords.json
// app.get('/passwords.json', ... ); // تم إزالتها لأسباب أمنية

// إضافة نقطة نهاية للتحقق من كلمة المرور بشكل آمن
app.post('/api/check-password', (req, res) => {
  const { pageKey, password } = req.body;
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'config', 'passwords.json'), 'utf8');
    const passwords = JSON.parse(data);
    if (passwords[pageKey] && passwords[pageKey] === password) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  } catch (err) {
    console.error('Error reading passwords.json:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// تحميل البيانات من ملف JSON (يُقدم ملف servicesData.json من مساره الجديد)
app.get('/servicesData.json', (req, res) => {
  try {
    // تغيير المسار إلى المسار الجديد في مجلد البيانات
    const data = fs.readFileSync(servicesFilePath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err) {
    console.error('Error reading servicesData.json:', err);
    res.status(500).json({ error: 'Failed to read services data' });
  }
});

// نقطة نهاية API جديدة للوصول إلى البيانات من المسار الجديد
app.get('/api/services-data', (req, res) => {
  console.log('تم طلب البيانات من المسار الجديد:', servicesFilePath);
  try {
    const data = fs.readFileSync(servicesFilePath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err) {
    console.error('خطأ في قراءة ملف البيانات:', err);
    res.status(500).json({ error: 'فشل في قراءة ملف البيانات' });
  }
});

// نقطة النهاية للـDrD3m Proxy
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

// نقطة النهاية للـSeoclevers Proxy
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
      body: new URLSearchParams({ key: SEOCLEVERS_API_KEY, action: 'balance' })
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
      body: new URLSearchParams({ key: DRD3M_API_KEY, action: 'balance' })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching DrDaam balance:', error);
    res.status(500).json({ error: 'خطأ في الاتصال بـ API دكتور دعم' });
  }
});

// نقطة نهاية API لتحديث ملف servicesData.json
app.post('/api/update-services', (req, res) => {
  console.log('تم استلام طلب تحديث بيانات الخدمات');
  try {
    const { data, pageKey, password } = req.body;
    
    // التحقق من صحة البيانات
    if (!data || !pageKey || !password) {
      console.error('بيانات الطلب غير مكتملة:', { hasData: !!data, hasPageKey: !!pageKey, hasPassword: !!password });
      return res.status(400).json({ success: false, error: 'بيانات الطلب غير مكتملة' });
    }
    
    // التحقق من صحة كلمة المرور
    const configPath = path.join(process.cwd(), 'config');
    const passwordsPath = path.join(configPath, 'passwords.json');
    
    if (!fs.existsSync(passwordsPath)) {
      console.error('ملف كلمات المرور غير موجود:', passwordsPath);
      return res.status(500).json({ success: false, error: 'خطأ في التحقق من كلمة المرور' });
    }
    
    const passwordsData = fs.readFileSync(passwordsPath, 'utf8');
    let passwords;
    
    try {
      passwords = JSON.parse(passwordsData);
    } catch (parseErr) {
      console.error('خطأ في تحليل ملف كلمات المرور:', parseErr);
      return res.status(500).json({ success: false, error: 'خطأ في تحليل ملف كلمات المرور' });
    }
    
    if (!passwords[pageKey] || passwords[pageKey] !== password) {
      console.error('فشل التحقق من كلمة المرور لـ:', pageKey);
      return res.status(401).json({ success: false, error: 'كلمة المرور غير صحيحة' });
    }
    
    // التحقق من صحة بنية البيانات
    if (!data.categories || typeof data.categories !== 'object') {
      console.error('بنية التصنيفات غير صحيحة:', typeof data.categories);
      return res.status(400).json({ success: false, error: 'بنية التصنيفات غير صحيحة' });
    }
    
    if (!Array.isArray(data.rawServices)) {
      console.error('بنية الخدمات الخام غير صحيحة:', typeof data.rawServices);
      return res.status(400).json({ success: false, error: 'بنية الخدمات الخام غير صحيحة' });
    }
    
    if (!Array.isArray(data.services)) {
      console.error('بنية الخدمات غير صحيحة:', typeof data.services);
      return res.status(400).json({ success: false, error: 'بنية الخدمات غير صحيحة' });
    }
    
    // عمل نسخة احتياطية من الملف الحالي قبل التحديث
    const currentDate = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '_');
    const backupPath = path.join(dataDirectory, 'backups');
    
    // التأكد من وجود مجلد النسخ الاحتياطية
    if (!fs.existsSync(backupPath)) {
      try {
        fs.mkdirSync(backupPath, { recursive: true });
        console.log('تم إنشاء مجلد النسخ الاحتياطية:', backupPath);
      } catch (mkdirErr) {
        console.error('فشل في إنشاء مجلد النسخ الاحتياطية:', mkdirErr);
        // نستمر في المعالجة
      }
    }
    
    // قبل الكتابة، تحقق من وجود الملف وقراءة محتوياته للتأكد من أنه صالح
    let currentDataValid = false;
    let currentData = '{}';
    
    if (fs.existsSync(servicesFilePath)) {
      try {
        currentData = fs.readFileSync(servicesFilePath, 'utf8');
        // التحقق من أن الملف يحتوي على JSON صالح
        JSON.parse(currentData);
        currentDataValid = true;
        console.log('تم قراءة الملف الحالي بنجاح للنسخ الاحتياطي');
      } catch (readErr) {
        console.error('خطأ في قراءة الملف الحالي للنسخ الاحتياطي:', readErr);
        // سنستمر ونستبدل الملف التالف
      }
    }
    
    // إنشاء نسخة احتياطية إذا كانت البيانات الحالية صالحة
    if (currentDataValid) {
      const backupFilePath = path.join(backupPath, `servicesData_${currentDate}.json`);
      try {
        fs.writeFileSync(backupFilePath, currentData, 'utf8');
        console.log('تم إنشاء نسخة احتياطية بنجاح في:', backupFilePath);
      } catch (backupErr) {
        console.error('فشل في إنشاء نسخة احتياطية:', backupErr);
        // سنستمر في عملية التحديث على أي حال
      }
    }
    
    // حفظ البيانات الجديدة في الملف
    try {
      // قياس وقت العملية
      const startTime = Date.now();
      console.log(`بدء عملية تحديث servicesData.json: ${new Date().toISOString()}`);
      
      // التحقق من حجم البيانات قبل الكتابة
      const jsonData = JSON.stringify(data, null, 2);
      const dataSizeKB = Math.round(jsonData.length / 1024);
      console.log(`حجم البيانات للكتابة: ${dataSizeKB} كيلوبايت`);
      
      // التأكد من وجود المجلد
      const publicDirExists = fs.existsSync(publicPath);
      if (!publicDirExists) {
        console.error(`مسار المجلد العام غير موجود: ${publicPath}`);
        try {
          fs.mkdirSync(publicPath, { recursive: true });
          console.log(`تم إنشاء المجلد العام: ${publicPath}`);
        } catch (mkdirErr) {
          console.error(`فشل في إنشاء المجلد العام: ${mkdirErr.message}`);
          throw new Error(`لا يمكن إنشاء المجلد العام: ${mkdirErr.message}`);
        }
      }
      
      // إنشاء اسم فريد للملف المؤقت لتجنب التصادمات
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 10);
      const tempFilePath = path.join(publicPath, `servicesData.${timestamp}.${randomStr}.temp.json`);
      
      // 1. كتابة إلى ملف مؤقت أولاً بأكثر الطرق أمانًا
      try {
        // نستخدم writeFileSync لضمان اكتمال العملية قبل المتابعة
        console.log(`جاري كتابة الملف المؤقت: ${tempFilePath}`);
        fs.writeFileSync(tempFilePath, jsonData, { encoding: 'utf8', flag: 'wx' });
        console.log(`تم كتابة الملف المؤقت بنجاح: ${tempFilePath}`);
      } catch (tempWriteErr) {
        console.error(`فشل في كتابة الملف المؤقت: ${tempWriteErr.message}`);
        throw new Error(`فشل في كتابة الملف المؤقت: ${tempWriteErr.message}`);
      }
      
      // 2. التحقق من أنه يمكن قراءة الملف المؤقت وأنه يحتوي على JSON صالح
      try {
        console.log(`التحقق من الملف المؤقت: ${tempFilePath}`);
        const tempFileContent = fs.readFileSync(tempFilePath, 'utf8');
        const parsedTemp = JSON.parse(tempFileContent); // هذا يتحقق من صحة JSON
        
        // التحقق من سلامة البنية
        if (!parsedTemp.categories || !parsedTemp.services || !parsedTemp.rawServices) {
          throw new Error('الملف المؤقت لا يحتوي على بنية بيانات صحيحة');
        }
        
        console.log(`تم التحقق من سلامة الملف المؤقت`);
      } catch (validateErr) {
        // حذف الملف المؤقت إذا كان غير صالح
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`تم حذف الملف المؤقت غير الصالح: ${tempFilePath}`);
          }
        } catch (unlinkErr) {
          console.error(`فشل في حذف الملف المؤقت غير الصالح: ${unlinkErr.message}`);
        }
        
        throw new Error(`فشل في التحقق من سلامة الملف المؤقت: ${validateErr.message}`);
      }
      
      // 3. استبدال الملف الأصلي بالملف المؤقت (مع محاولة كتابة مباشرة كخطة بديلة)
      try {
        console.log(`جاري استبدال الملف الأصلي: ${servicesFilePath}`);
        
        // حذف الملف الأصلي إذا كان موجودًا لتجنب مشاكل في نظام ملفات Windows
        if (fs.existsSync(servicesFilePath)) {
          fs.unlinkSync(servicesFilePath);
          console.log(`تم حذف الملف الأصلي القديم: ${servicesFilePath}`);
        }
        
        // نقل الملف المؤقت ليحل محل الملف الأصلي
        fs.renameSync(tempFilePath, servicesFilePath);
        console.log(`تم استبدال الملف الأصلي بنجاح: ${servicesFilePath}`);
      } catch (replaceErr) {
        console.error(`فشل في استبدال الملف الأصلي: ${replaceErr.message}`);
        
        // محاولة إضافية - نسخ المحتوى بدلاً من إعادة التسمية
        try {
          console.log(`محاولة احتياطية - نسخ المحتوى مباشرة`);
          const tempContent = fs.readFileSync(tempFilePath, 'utf8');
          fs.writeFileSync(servicesFilePath, tempContent, 'utf8');
          console.log(`تم نسخ المحتوى ونجحت المحاولة الاحتياطية`);
          
          // حذف الملف المؤقت بعد النجاح
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
              console.log(`تم حذف الملف المؤقت بعد النسخ الاحتياطي`);
            }
          } catch (cleanupErr) {
            console.error(`فشل في حذف الملف المؤقت بعد النسخ: ${cleanupErr.message}`);
          }
        } catch (copyErr) {
          console.error(`فشل في نسخ المحتوى: ${copyErr.message}`);
          throw new Error(`فشل في كل محاولات استبدال الملف: ${replaceErr.message}, ${copyErr.message}`);
        }
      }
      
      // حساب الوقت المستغرق
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      console.log(`تم تحديث ملف servicesData.json بنجاح في ${durationMs}ms`);
      
      // التحقق النهائي من وجود وصحة الملف
      try {
        const finalStats = fs.statSync(servicesFilePath);
        console.log(`حجم الملف النهائي: ${Math.round(finalStats.size / 1024)} كيلوبايت`);
        
        // قراءة الملف النهائي للتأكد من سلامته
        const finalContent = fs.readFileSync(servicesFilePath, 'utf8');
        JSON.parse(finalContent); // التحقق من صحة JSON
        console.log(`تم التحقق من سلامة الملف النهائي`);
      } catch (finalVerifyErr) {
        console.error(`فشل في التحقق النهائي من سلامة الملف: ${finalVerifyErr.message}`);
        // سنستمر لأن العملية نجحت في المراحل السابقة
      }
      
      res.json({ 
        success: true, 
        message: 'تم تحديث البيانات بنجاح',
        metadata: {
          fileSizeKB: dataSizeKB,
          processTimeMs: durationMs,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (writeErr) {
      console.error('خطأ أثناء كتابة البيانات إلى الملف:', writeErr);
      
      // محاولة أخيرة باستخدام writeFileSync المباشر
      try {
        console.log('بدء المحاولة الأخيرة للكتابة المباشرة');
        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFileSync(servicesFilePath, jsonData, 'utf8');
        console.log(`تم تحديث الملف بنجاح في المحاولة الأخيرة: ${servicesFilePath}`);
        
        return res.json({ 
          success: true, 
          message: 'تم تحديث البيانات بنجاح (محاولة أخيرة)',
          fallback: true
        });
      } catch (finalErr) {
        console.error('فشل نهائي في كتابة البيانات:', finalErr);
        return res.status(500).json({ 
          success: false, 
          error: 'فشل في كتابة البيانات بعد محاولات متعددة: ' + finalErr.message,
          originalError: writeErr.message
        });
      }
    }
    
  } catch (err) {
    console.error('خطأ عام في تحديث ملف servicesData.json:', err);
    res.status(500).json({ 
      success: false, 
      error: 'فشل في تحديث البيانات: ' + err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// نقطة نهاية لإنشاء نسخة احتياطية يدوية لملف البيانات
app.get('/api/create-backup', (req, res) => {
  console.log('جاري إنشاء نسخة احتياطية يدوية لملف البيانات');
  
  try {
    // استخدام المسار الجديد للملف
    
    // التحقق من وجود الملف
    if (!fs.existsSync(servicesFilePath)) {
      console.error('ملف البيانات غير موجود:', servicesFilePath);
      return res.status(404).json({
        status: 'error',
        error: 'ملف البيانات غير موجود',
        file: servicesFilePath
      });
    }
    
    // قراءة ملف البيانات
    const fileContent = fs.readFileSync(servicesFilePath, 'utf8');
    
    // تحقق من صحة JSON
    try {
      JSON.parse(fileContent);
    } catch (jsonError) {
      console.error('ملف البيانات يحتوي على JSON غير صالح:', jsonError);
      return res.status(400).json({
        status: 'error',
        error: 'ملف البيانات يحتوي على JSON غير صالح',
        details: jsonError.message
      });
    }
    
    // إنشاء مجلد للنسخ الاحتياطية إذا لم يكن موجودًا
    const backupDir = path.join(publicPath, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('تم إنشاء مجلد النسخ الاحتياطية:', backupDir);
    }
    
    // إنشاء اسم ملف النسخة الاحتياطية باستخدام التاريخ والوقت
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
    const backupFilePath = path.join(backupDir, `servicesData_${timestamp}.json`);
    
    // نسخ الملف
    fs.writeFileSync(backupFilePath, fileContent, 'utf8');
    console.log('تم إنشاء نسخة احتياطية بنجاح:', backupFilePath);
    
    // الحصول على قائمة النسخ الاحتياطية الحالية
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('servicesData_') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        timestamp: file.replace('servicesData_', '').replace('.json', ''),
        stats: fs.statSync(path.join(backupDir, file))
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // فرز بترتيب زمني تنازلي
    
    // الاحتفاظ بأحدث 10 نسخ احتياطية فقط (لتجنب امتلاء القرص)
    const MAX_BACKUPS = 10;
    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log('تم حذف نسخة احتياطية قديمة:', file.name);
        } catch (err) {
          console.error('خطأ في حذف نسخة احتياطية قديمة:', file.name, err);
        }
      });
    }
    
    // الرد بالنجاح
    res.json({
      status: 'success',
      message: 'تم إنشاء نسخة احتياطية بنجاح',
      backupFile: {
        name: path.basename(backupFilePath),
        path: backupFilePath,
        timestamp: timestamp,
        size: fs.statSync(backupFilePath).size
      },
      backups: backupFiles.slice(0, MAX_BACKUPS).map(file => ({
        name: file.name,
        timestamp: file.timestamp,
        size: file.stats.size,
        created: file.stats.mtime
      }))
    });
    
  } catch (error) {
    console.error('خطأ أثناء إنشاء نسخة احتياطية:', error);
    res.status(500).json({
      status: 'error',
      error: `خطأ في إنشاء نسخة احتياطية: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// نقطة نهاية للتحقق من سلامة ملف البيانات
app.get('/api/check-json-integrity', (req, res) => {
  console.log('جاري التحقق من سلامة ملف البيانات');
  
  try {
    // استخدام المسار الجديد للملف
    
    // التحقق من وجود الملف
    if (!fs.existsSync(servicesFilePath)) {
      console.error('ملف البيانات غير موجود:', servicesFilePath);
      return res.status(404).json({
        status: 'error',
        error: 'ملف البيانات غير موجود',
        file: servicesFilePath
      });
    }
    
    // الحصول على معلومات الملف
    const fileStats = fs.statSync(servicesFilePath);
    const fileSizeKB = Math.round(fileStats.size / 1024);
    const lastModified = fileStats.mtime;
    
    // محاولة قراءة الملف وتحليل JSON
    const fileContent = fs.readFileSync(servicesFilePath, 'utf8');
    
    // التحقق من أن الملف يحتوي على محتوى
    if (!fileContent || fileContent.trim() === '') {
      console.error('ملف البيانات فارغ');
      return res.status(200).json({
        status: 'warning',
        error: 'ملف البيانات فارغ',
        fileSizeKB,
        lastModified
      });
    }
    
    // محاولة تحليل JSON
    const jsonData = JSON.parse(fileContent);
    
    // التحقق من بنية البيانات
    const hasCategories = jsonData.categories && typeof jsonData.categories === 'object';
    const hasServices = Array.isArray(jsonData.services);
    const hasRawServices = Array.isArray(jsonData.rawServices);
    
    // التحقق من الآتساق بين البيانات
    const serviceCount = hasServices ? jsonData.services.length : 0;
    const rawServiceCount = hasRawServices ? jsonData.rawServices.length : 0;
    
    // التحقق من أن الخدمات لها نفس العدد أو عدد أقل من الخدمات الخام
    const servicesConsistent = serviceCount <= rawServiceCount;
    
    // عد التصنيفات
    const categoryCount = hasCategories ? Object.keys(jsonData.categories).length : 0;
    
    // إعداد تقرير السلامة
    const integrityStatus = {
      valid: hasCategories && hasServices && hasRawServices && servicesConsistent,
      structure: {
        hasCategories,
        hasServices,
        hasRawServices
      },
      counts: {
        categories: categoryCount,
        services: serviceCount,
        rawServices: rawServiceCount
      },
      consistency: {
        servicesConsistent
      },
      file: {
        path: servicesFilePath,
        sizeKB: fileSizeKB,
        lastModified
      }
    };
    
    console.log('نتيجة التحقق من سلامة الملف:', integrityStatus.valid ? 'صالح' : 'غير صالح');
    
    res.json({
      status: integrityStatus.valid ? 'ok' : 'warning',
      timestamp: new Date().toISOString(),
      integrityReport: integrityStatus
    });
    
  } catch (error) {
    console.error('خطأ أثناء التحقق من سلامة ملف JSON:', error);
    res.status(500).json({
      status: 'error',
      error: `خطأ في التحقق من سلامة الملف: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// نقطة نهاية لفحص حالة الخادم
app.get('/api/server-status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
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