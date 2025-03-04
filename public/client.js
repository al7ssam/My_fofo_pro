/*******************************************************
 * client.js
 * صفحة إرسال الطلبات
 * -----------------------------------------------------
 * - يقرأ البيانات من servicesData.json (أو من localStorage)
 * - يملأ قائمة mainCategory، وتقوم الدوال بتعبئة القوائم الفرعية (subCategory, subSubCategory) إن وُجدت.
 * - يولّد نصًا بصيغة: serviceID | link | quantity
 * - عند الضغط على "إرسال"، يتم جمع الخدمات المطابقة لاختيارات المستخدم،
 *   ومن ثم إرسال كل خدمة إلى خادم البروكسي (Proxy) الذي يتولى استخدام مفاتيح الـ API من البيئة.
 * - تعرض الدالة رسالة تفصيلية تُظهر عدد الطلبات الناجحة والفاشلة مع أسباب الفشل.
 * - بعد الإرسال، يتم تفريغ حقل الرابط ومربع النتائج لمنع الإرسال المتكرر دون تغيير الرابط.
 *******************************************************/

/**
 * دالة تعريب رسائل الاستجابة من الإنجليزية إلى العربية.
 * تُترجم الأخطاء وحالة الطلب والردود الأخرى.
 */
function translateResponse(response) {
  // ترجمة الأخطاء
  if (response.error) {
    const errorMap = {
      "Incorrect order ID": "معرف الطلب غير صحيح",
      "link_duplicate": "الرابط مستخدم مسبقاً",
      "neworder.error.link_duplicate": "الرابط مستخدم مسبقاً"
      // يمكنك إضافة المزيد من الأخطاء هنا إذا لزم الأمر
    };
    return errorMap[response.error] || response.error;
  }
  
  // ترجمة حالة الطلب
  if (response.status) {
    const statusMap = {
      "Partial": "جزئي",
      "In progress": "قيد التنفيذ",
      "Completed": "مكتمل"
    };
    let statusText = statusMap[response.status] || response.status;
    return `حالة الطلب: ${statusText}\nالرسوم: ${response.charge || ""}\nالبداية: ${response.start_count || ""}\nالمتبقي: ${response.remains || ""}\nالعملة: ${response.currency || ""}`;
  }
  
  // ترجمة الرد عند إضافة الطلب
  if (response.order) {
    return `تم إضافة الطلب بنجاح. رقم الطلب: ${response.order}`;
  }
  
  // ترجمة استعلام الرصيد
  if (response.balance) {
    return `الرصيد الحالي: ${response.balance} ${response.currency}`;
  }
  
  // ترجمة إعادة التعبئة (Refill)
  if (response.refill) {
    return `تم إنشاء إعادة تعبئة بنجاح. رقم إعادة التعبئة: ${response.refill}`;
  }
  if (response.refill_status) {
    const refillMap = {
      "Completed": "مكتمل",
      "Rejected": "مرفوض",
      "In progress": "قيد التنفيذ"
    };
    let statusText = refillMap[response.refill_status] || response.refill_status;
    return `حالة إعادة التعبئة: ${statusText}`;
  }
  
  return JSON.stringify(response);
}

const API_ENDPOINTS = {
  UPDATE_SERVICES: '/api/update-services',
  SERVER_STATUS: '/api/server-status'
};
let globalData = { categories: {}, services: [], rawServices: [], serviceLinks: [] };

const DRD3M_PROXY_URL = '/api/drd3m';
const SEOCLEVERS_PROXY_URL = '/api/seoclevers';
const CONNECTION_CHECK_INTERVAL = 30 * 1000; // 30 ثانية

/** تحميل البيانات من ملف JSON باستخدام API */
async function loadData() {
  try {
    showLoading('جاري تحميل البيانات...');
    
    // محاولة تحميل البيانات من عدة مسارات محتملة
    const possiblePaths = [
      '/servicesData.json',
      './servicesData.json',
      '../servicesData.json',
      'servicesData.json'
    ];
    
    let data = null;
    
    // محاولة كل مسار حتى ينجح أحدها
    for (const path of possiblePaths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          data = await response.json();
          updateConnectionStatus('success', 'تم الاتصال بالخادم بنجاح');
          break; // الخروج من الحلقة عند النجاح
        }
      } catch (error) {
        // تخطي المسار الفاشل والانتقال للمسار التالي
      }
    }
    
    if (!data) {
      updateConnectionStatus('error', 'تعذر الاتصال بالخادم');
      hideLoading();
      return { categories: {}, services: [], rawServices: [], serviceLinks: [] };
    }
    
    if (data && data.categories && Array.isArray(data.rawServices)) {
      hideLoading();
      return data;
    } else {
      updateConnectionStatus('error', 'البيانات المستلمة غير صالحة');
      hideLoading();
      return { categories: {}, services: [], rawServices: [], serviceLinks: [] };
    }
  } catch (error) {
    console.error('فشل تحميل البيانات:', error);
    updateConnectionStatus('error', 'حدث خطأ أثناء تحميل البيانات');
    hideLoading();
    return { categories: {}, services: [], rawServices: [], serviceLinks: [] };
  }
}

/** تعبئة قائمة التصنيفات الرئيسية */
function populateMainCategories() {
  const mainCatSelect = document.getElementById('mainCategory');
  mainCatSelect.innerHTML = '';
  const catKeys = Object.keys(globalData.categories);
  if (catKeys.length === 0) return;
  catKeys.forEach(catKey => {
    const option = document.createElement('option');
    option.value = catKey;
    option.textContent = catKey;
    mainCatSelect.appendChild(option);
  });
}

/** تحديث قائمة التصنيفات الفرعية بناءً على التصنيف الرئيسي */
function updateSubCategories() {
  const mainCategory = document.getElementById('mainCategory').value;
  const subCategory = document.getElementById('subCategory');
  const subCatLabel = document.getElementById('subCatLabel');
  subCategory.innerHTML = '';
  subCategory.style.display = 'none';
  subCatLabel.style.display = 'none';
  if (!mainCategory || !globalData.categories[mainCategory]) return;
  const subCats = globalData.categories[mainCategory].subCategories || {};
  const subCatKeys = Object.keys(subCats);
  if (subCatKeys.length > 0) {
    subCatLabel.style.display = 'block';
    subCategory.style.display = 'block';
    subCatKeys.forEach(subCatKey => {
      const option = document.createElement('option');
      option.value = subCatKey;
      option.textContent = subCatKey;
      subCategory.appendChild(option);
    });
    updateSubSubCategories();
  }
}

/** تحديث قائمة الباقات (subSubCategory) بناءً على التصنيف الفرعي */
function updateSubSubCategories() {
  const mainCategory = document.getElementById('mainCategory').value;
  const subCatVal = document.getElementById('subCategory').value;
  const subSubCatSelect = document.getElementById('subSubCategory');
  const subSubCatLabel = document.getElementById('subSubCategoryLabel');
  subSubCatSelect.innerHTML = '';
  subSubCatSelect.style.display = 'none';
  subSubCatLabel.style.display = 'none';
  if (!mainCategory || !globalData.categories[mainCategory]) return;
  const subCats = globalData.categories[mainCategory].subCategories || {};
  if (!subCatVal || !subCats[subCatVal]) return;
  const subSubs = subCats[subCatVal].subSubCategories || [];
  if (subSubs.length > 0) {
    subSubCatSelect.style.display = 'block';
    subSubCatLabel.style.display = 'block';
    subSubs.forEach(ssc => {
      const option = document.createElement('option');
      option.value = ssc;
      option.textContent = ssc;
      subSubCatSelect.appendChild(option);
    });
  }
}

/** توليد النص النهائي المعروض للمستخدم */
function generateFormula() {
  const link = document.getElementById('contentLink').value.trim();
  if (!link) {
    document.getElementById('result').value = '';
    return;
  }
  const mainCategory = document.getElementById('mainCategory').value || '';
  const subCategory = document.getElementById('subCategory').value || '';
  const subSubCategory = document.getElementById('subSubCategory').value || '';

  // جلب كل الخدمات المطابقة للخيارات
  const matchedServices = globalData.services.filter(s => 
    s.mainCategory === mainCategory &&
    (!subCategory || s.subCategory === subCategory) &&
    (!subSubCategory || s.subSubCategory === subSubCategory)
  );

  let formula = matchedServices.map(srv => 
    `${srv.id} | ${link} | ${srv.quantity}`
  ).join('\n');

  document.getElementById('result').value = formula;
}

/** نسخ النص إلى الحافظة */
function copyToClipboard() {
  const text = document.getElementById('result').value;
  if (!text.trim()) {
    showToast('لا يوجد نص لنسخه!', true);
    return;
  }
  navigator.clipboard.writeText(text)
    .then(() => showToast('تم نسخ النص بنجاح!'))
    .catch(() => showToast('فشل النسخ!', true));
}

/**
 * إرسال الطلب:
 * - يجمع كل الخدمات المطابقة.
 * - لكل خدمة: يُرسل طلبًا إلى البروكسي المناسب (حسب provider) عبر الخادم الذي يقوم بإضافة مفتاح الـ API من البيئة.
 * - يعرض تقريرًا نهائيًا يوضح عدد الطلبات الناجحة والفاشلة مع أسباب الفشل.
 */
async function sendOrder() {
  // تعريف حقل الرابط وزر الإرسال باستخدام معرّف الزر (sendBtn)
  const linkField = document.getElementById('contentLink');
  const sendBtn = document.getElementById('sendBtn');
  
  const link = linkField.value.trim();
  if (!link) {
    showToast('الرجاء إدخال الرابط.', true);
    return;
  }
  
  // إظهار مؤشر التحميل
  showLoading('جاري إرسال الطلبات...');
  
  // تعطيل زر الإرسال أثناء عملية الإرسال
  sendBtn.disabled = true;
  sendBtn.textContent = "جارٍ الإرسال...";
  
  const mainCategory = document.getElementById('mainCategory').value || '';
  const subCategory = document.getElementById('subCategory').value || '';
  const subSubCategory = document.getElementById('subSubCategory').value || '';

  const matchedServices = globalData.services.filter(s => 
    s.mainCategory === mainCategory &&
    (!subCategory || s.subCategory === subCategory) &&
    (!subSubCategory || s.subSubCategory === subSubCategory)
  );

  if (matchedServices.length === 0) {
    showToast('لم يتم العثور على خدمات.', true);
    sendBtn.disabled = false;
    sendBtn.textContent = "إرسال";
    return;
  }

  let successes = 0;
  let fails = 0;
  let failReasons = [];

  for (let srv of matchedServices) {
    try {
      // الحصول على معلومات المزود من الخدمة الخام
      let rawService = null;
      
      // إذا كانت البيانات تستخدم النظام الجديد (rawServices و serviceLinks)
      if (globalData.rawServices && globalData.rawServices.length > 0) {
        rawService = globalData.rawServices.find(rs => rs.id === srv.id);
      }
      
      // إذا لم نجد الخدمة الخام، نستخدم معلومات المزود من الخدمة نفسها
      const provider = rawService ? rawService.provider : srv.provider;
      
      let apiResp = await sendToApi(srv, link, provider);
      let translatedMsg = translateResponse(apiResp);
      if (apiResp && apiResp.order) {
        successes++;
        console.log(`طلب الخدمة ${srv.id} تم بنجاح. رقم الطلب: ${apiResp.order}`);
      } else if (apiResp && apiResp.error) {
        fails++;
        failReasons.push(`الخدمة ${srv.id}: ${translatedMsg}`);
      } else {
        fails++;
        failReasons.push(`الخدمة ${srv.id}: استجابة غير متوقعة`);
      }
    } catch (err) {
      fails++;
      failReasons.push(`الخدمة ${srv.id}: ${err.message || err}`);
    }
  }

  const total = matchedServices.length;
  if (fails === 0) {
    showToast(`تم إرسال جميع الطلبات بنجاح! (عددها ${successes})`);
    updateConnectionStatus('success', `تم إرسال ${successes} طلب بنجاح`);
  } else if (successes === 0) {
    const msg = `فشلت جميع الطلبات (${fails}/${total}).\nالأسباب:\n` + failReasons.join('\n');
    showToast(msg, true);
    updateConnectionStatus('error', 'فشل إرسال جميع الطلبات');
  } else {
    const msg = `تم إرسال ${successes} من أصل ${total} بنجاح، وفشلت ${fails}.\nالأسباب:\n` + failReasons.join('\n');
    showToast(msg, true);
    updateConnectionStatus('warning', `تم إرسال ${successes} طلب بنجاح وفشل ${fails}`);
  }
  
  // التعديل الجديد: تفريغ حقل الرابط ومربع النتائج بعد انتهاء عملية الإرسال
  linkField.value = '';
  document.getElementById('result').value = '';
  
  // إخفاء مؤشر التحميل
  hideLoading();
}

/**
 * إرسال طلب إلى API
 * @param {Object} service - معلومات الخدمة
 * @param {string} link - الرابط المراد إرساله
 * @param {string} provider - مزود الخدمة (drd3m أو seoclevers)
 */
async function sendToApi(service, link, provider) {
  // إذا لم يتم تمرير المزود، نستخدم المزود من الخدمة
  provider = provider || service.provider;
  
  const apiEndpoint = `/api/${provider}`;
  const data = new URLSearchParams();
  data.append('action', 'add');
  data.append('service', service.id);
  data.append('link', link);
  data.append('quantity', service.quantity);

  try {
    // تحديث حالة الاتصال قبل الإرسال
    updateConnectionStatus('warning', `جاري الاتصال بخدمة ${provider}...`);
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: data
    });

    if (!response.ok) {
      updateConnectionStatus('error', `خطأ الخادم: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.order) {
      updateConnectionStatus('success', `تم إرسال الطلب بنجاح - رقم ${result.order}`);
    }
    return result;
  } catch (error) {
    console.error('Error sending to API:', error);
    updateConnectionStatus('error', `خطأ في الاتصال: ${error.message}`);
    throw error;
  }
}

/** وظائف إدارة مؤشرات التحميل وحالة الاتصال */

// إظهار مؤشر التحميل
function showLoading(message = 'جاري التحميل...') {
  const loadingIndicator = document.getElementById('loading-indicator');
  const loadingMessage = loadingIndicator.querySelector('.loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
  loadingIndicator.classList.remove('hidden');
}

// إخفاء مؤشر التحميل
function hideLoading() {
  const loadingIndicator = document.getElementById('loading-indicator');
  loadingIndicator.classList.add('hidden');
}

// تحديث حالة الاتصال
function updateConnectionStatus(status, message) {
  const connectionStatus = document.getElementById('connection-status');
  if (!connectionStatus) return;
  
  // إزالة جميع الفئات
  connectionStatus.classList.remove('success', 'warning', 'error', 'hidden');
  
  // إضافة الفئة المناسبة
  connectionStatus.classList.add(status);
  
  // تحديث نص الرسالة
  connectionStatus.textContent = message;
  
  // إظهار المؤشر
  connectionStatus.classList.remove('hidden');
  
  // إخفاء المؤشر بعد فترة زمنية
  setTimeout(() => {
    connectionStatus.classList.add('hidden');
  }, 5000);
}

// التحقق من حالة الخادم
async function checkServerStatus() {
  try {
    const response = await fetch(API_ENDPOINTS.SERVER_STATUS);
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'online') {
        updateConnectionStatus('success', 'الخادم يعمل بشكل طبيعي');
        return true;
      }
    }
    throw new Error('الخادم لا يستجيب بشكل صحيح');
  } catch (error) {
    console.error('خطأ في التحقق من حالة الخادم:', error);
    updateConnectionStatus('error', 'تعذر الاتصال بالخادم');
    return false;
  }
}

// تفقد حالة الخادم بشكل دوري
function setupConnectionMonitoring() {
  // تحقق من الاتصال مباشرة
  checkServerStatus();
  
  // تحقق بشكل دوري
  setInterval(checkServerStatus, CONNECTION_CHECK_INTERVAL);
}

// توصيل دالة sendOrder إلى زر الإرسال
document.addEventListener('DOMContentLoaded', function() {
  // بدء مراقبة حالة الاتصال بالخادم
  setupConnectionMonitoring();
  
  // تحميل البيانات
  loadData()
    .then(data => {
      globalData = data;
      populateMainCategories();
      updateSubCategories();
      generateFormula();
    })
    .catch(error => {
      showToast('حدث خطأ أثناء تحميل البيانات', true);
    });
  
  // إعداد زر الإرسال
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendOrder);
  }
  
  // إعادة تمكين زر الإرسال عند تغيير الرابط
  const linkInput = document.getElementById('contentLink');
  if (linkInput) {
    linkInput.addEventListener('input', function() {
      const sendBtn = document.getElementById('sendBtn');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "إرسال";
      }
    });
  }
});