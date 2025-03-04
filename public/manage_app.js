/*******************************************************
 * manage_app.js
 * إدارة التصنيفات والخدمات
 * النسخة النهائية (V3) بعد إزالة النظام القديم والتكرار غير الضروري
 * وحل مشكلة عدم ظهور الخدمات الخام
 *******************************************************/

// الثوابت العامة
const API_ENDPOINTS = {
  UPDATE_SERVICES: '/api/update-services',
  SERVER_STATUS: '/api/server-status',
  CHECK_JSON_INTEGRITY: '/api/check-json-integrity',
  CREATE_BACKUP: '/api/create-backup'
};
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 دقيقة
const CONNECTION_CHECK_INTERVAL = 30 * 1000; // 30 ثانية

// البيانات العالمية
let globalData = { 
  categories: {}, 
  services: [],
  rawServices: [],
  serviceLinks: []
};

// مصفوفات العرض
let filteredServices = [];
let filteredRawServices = []; // تم تصحيح الاسم بدلاً من filterRanServices

// متغيرات تحرير الخدمة
let currentEditServiceId = null, currentEditMainCategory = null, currentEditSubCategory = null, currentEditSubSubCategory = null;

/** دالة مشتركة لتحديث رصيد المزود */
async function updateBalance(apiEndpoint, balanceElId, lastUpdateElId, serviceLabel) {
  try {
    const response = await fetch(apiEndpoint);
    if (!response.ok) throw new Error(`خطأ في الاتصال: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    const balanceElement = document.getElementById(balanceElId);
    const lastUpdateElement = document.getElementById(lastUpdateElId);
    if (data.balance && data.currency) {
      const balance = parseFloat(data.balance);
      balanceElement.textContent = `${balance.toFixed(2)} ${data.currency}`;
      balanceElement.style.color = balance > 50 ? 'var(--success-color)' : '#FFA500';
      const now = new Date();
      lastUpdateElement.textContent = `آخر تحديث: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (balance <= 50) {
        showToast(`تنبيه: رصيد ${serviceLabel} منخفض (${balance.toFixed(2)} ${data.currency})`, true);
      }
    } else {
      throw new Error('بيانات غير صالحة');
    }
  } catch (error) {
    console.error(`خطأ في تحديث رصيد ${serviceLabel}:`, error);
    document.getElementById(balanceElId).textContent = 'خطأ في التحديث';
    document.getElementById(balanceElId).style.color = 'var(--danger-color)';
    showToast(`فشل تحديث رصيد ${serviceLabel}: ${error.message}`, true);
  }
}

function updateSeoBalance() {
  updateBalance('/api/balance/seoclevers', 'seoBalance', 'seoLastUpdate', 'سيوكليفرز');
}

function updateDrDaamBalance() {
  updateBalance('/api/balance/drdaam', 'drDaamBalance', 'drDaamLastUpdate', 'دكتور دعم');
}

/** تحميل البيانات من ملف JSON باستخدام API */
async function loadData() {
  try {
    showLoading('جاري تحميل البيانات...');
    console.log('بدء تحميل البيانات...');
    
    // محاولة تحميل البيانات من الملف
    console.log('جاري تحميل البيانات من الملف...');
    let data = null;
    const paths = ['/servicesData.json', './servicesData.json', '../servicesData.json'];
    
    for (let path of paths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          data = await response.json();
          console.log(`تم جلب البيانات من: ${path}`);
          updateConnectionStatus('success', 'تم الاتصال بالخادم بنجاح');
          break;
        }
      } catch (err) {
        console.warn(`فشل تحميل البيانات من: ${path} - ${err.message}`);
      }
    }
    
    if (!data) {
      updateConnectionStatus('error', 'تعذر الاتصال بالخادم');
      throw new Error('فشل في تحميل البيانات من جميع المسارات المحتملة');
    }
    
    if (data && data.categories && Array.isArray(data.rawServices)) {
      hideLoading();
      return data;
    } else {
      updateConnectionStatus('error', 'البيانات المستلمة غير صالحة');
      throw new Error('البيانات المحملة غير مكتملة أو غير صحيحة');
    }
  } catch (error) {
    console.error('فشل تحميل البيانات:', error);
    hideLoading();
    return { categories: {}, services: [], rawServices: [], serviceLinks: [] };
  }
}

/** حفظ البيانات باستخدام طلب API */
async function saveData(silentMode = false, retryCount = 0) {
  const MAX_RETRIES = 3; // عدد محاولات إعادة المحاولة
  
  try {
    if (!silentMode) {
      showLoading('جاري حفظ البيانات...');
    }
    
    // الحصول على كلمة المرور من صفحة القفل
    const password = window.passwordValue; // متغير من ملف lock.js
    
    if (!password) {
      if (!silentMode) hideLoading();
      showToast('لم يتم تسجيل الدخول بشكل صحيح', true);
      return false;
    }
    
    // تكوين البيانات للإرسال
    const dataToSend = {
      data: JSON.parse(JSON.stringify(globalData)), // عمل نسخة عميقة لتجنب مشاكل البيانات المرجعية
      pageKey: 'manage',
      password: password
    };
    
    // طباعة حجم البيانات للتشخيص
    const dataSize = JSON.stringify(dataToSend).length;
    console.log(`حجم البيانات المرسلة: ${dataSize} بايت`);
    
    // التحقق من سلامة البيانات قبل الإرسال
    if (!dataToSend.data.categories || !Array.isArray(dataToSend.data.services) || !Array.isArray(dataToSend.data.rawServices)) {
      console.error('بنية البيانات غير صالحة:', dataToSend.data);
      if (!silentMode) hideLoading();
      showToast('خطأ في بنية البيانات قبل الإرسال', true);
      return false;
    }
    
    const response = await fetch(API_ENDPOINTS.UPDATE_SERVICES, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataToSend)
    });
    
    // محاولة تحليل الاستجابة
    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error('خطأ في تحليل استجابة JSON:', jsonError);
      throw new Error('فشل في قراءة استجابة الخادم: ' + jsonError.message);
    }
    
    if (response.ok && result.success) {
      if (!silentMode) {
        hideLoading();
        updateConnectionStatus('success', 'تم حفظ البيانات بنجاح');
        showToast('تم حفظ البيانات بنجاح');
      }
      return true;
    } else {
      console.error('استجابة الخادم غير ناجحة:', result);
      throw new Error(result.error || 'حدث خطأ أثناء حفظ البيانات');
    }
  } catch (error) {
    console.error(`محاولة حفظ البيانات ${retryCount + 1}/${MAX_RETRIES} فشلت:`, error);
    
    // التحقق من إذا كان يجب إعادة المحاولة
    if (retryCount < MAX_RETRIES) {
      console.log(`إعادة محاولة حفظ البيانات (${retryCount + 1}/${MAX_RETRIES})...`);
      return new Promise(resolve => {
        // إعادة المحاولة بعد تأخير تصاعدي
        setTimeout(async () => {
          const retryResult = await saveData(silentMode, retryCount + 1);
          resolve(retryResult);
        }, 1000 * (retryCount + 1)); // 1s, 2s, 3s
      });
    }
    
    if (!silentMode) {
      hideLoading();
      updateConnectionStatus('error', 'فشل حفظ البيانات');
    }
    showToast(`فشل حفظ البيانات بعد عدة محاولات: ${error.message}`, true);
    return false;
  }
}

/** تبديل حالة القسم */
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.classList.toggle('open');
}

/** =========== إدارة التصنيفات =========== **/
function populateMainCatForAddSub() {
  const selectEl = document.getElementById('selectMainCatForAddSub');
  selectEl.innerHTML = '';
  Object.keys(globalData.categories).forEach(catKey => {
    const option = document.createElement('option');
    option.value = catKey;
    option.textContent = catKey;
    selectEl.appendChild(option);
  });
  populateSubCatForAddSubSub();
}

function populateSubCatForAddSubSub() {
  const mainCatVal = document.getElementById('selectMainCatForAddSub').value;
  const subEl = document.getElementById('selectSubCatForAddSubSub');
  subEl.innerHTML = '';
  if (!mainCatVal || !globalData.categories[mainCatVal]) return;
  Object.keys(globalData.categories[mainCatVal].subCategories || {}).forEach(subKey => {
    const option = document.createElement('option');
    option.value = subKey;
    option.textContent = subKey;
    subEl.appendChild(option);
  });
}

function populateMainCatSelect() {
  const selectMainCat = document.getElementById('selectMainCat');
  selectMainCat.innerHTML = '';
  Object.keys(globalData.categories).forEach(catKey => {
    const option = document.createElement('option');
    option.value = catKey;
    option.textContent = catKey;
    selectMainCat.appendChild(option);
  });
}

function updateSubCats() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatSelect = document.getElementById('selectSubCat');
  updateSubCategorySelect(mainCatVal, subCatSelect, '-- اختر تصنيف فرعي --', '', updateSubSubCats);
}

function updateSubSubCats() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatVal = document.getElementById('selectSubCat').value;
  const subSubCatSelect = document.getElementById('selectSubSubCat');
  updateSubSubCategorySelect(mainCatVal, subCatVal, subSubCatSelect, '-- اختر الباقة --');
}

/** إضافة تصنيف رئيسي جديد */
async function addMainCategory() {
  try {
    const newMainCat = document.getElementById('newMainCat').value.trim();
    
    // التحقق من صحة المدخلات
    if (!newMainCat) {
      showToast('الرجاء إدخال اسم التصنيف الرئيسي', true);
      return false;
    }
    
    // التحقق من عدم وجود التصنيف مسبقًا
    if (globalData.categories[newMainCat]) {
      showToast('هذا التصنيف موجود مسبقًا', true);
      return false;
    }
    
    showLoading('جاري إضافة التصنيف الرئيسي...');
    
    // إضافة التصنيف الجديد
    globalData.categories[newMainCat] = { subCategories: {} };
    
    // حفظ البيانات إلى ملف JSON
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      populateMainCatForAddSub();
      populateMainCatSelect();
      populateLinkCategorySelectors();
      
      // إعادة تعيين حقل الإدخال
      document.getElementById('newMainCat').value = '';
      
      // إعلام المستخدم بالنجاح
      showToast('تمت إضافة التصنيف الرئيسي وحفظ البيانات بنجاح');
    } else {
      showToast('تمت إضافة التصنيف لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في إضافة التصنيف الرئيسي:', error);
    hideLoading();
    showToast(`خطأ في إضافة التصنيف: ${error.message}`, true);
    return false;
  }
}

/** إضافة تصنيف فرعي جديد */
async function addSubCat() {
  try {
    // الحصول على القيم
    const mainCatVal = document.getElementById('selectMainCatForAddSub').value;
    const newSubCat = document.getElementById('newSubCat').value.trim();
    
    // التحقق من اختيار تصنيف رئيسي
    if (!mainCatVal) {
      showToast('اختر تصنيفًا رئيسيًا أولاً', true);
      return false;
    }
    
    // التحقق من إدخال اسم التصنيف الفرعي
    if (!newSubCat) {
      showToast('الرجاء إدخال اسم التصنيف الفرعي', true);
      return false;
    }
    
    // التحقق من عدم وجود التصنيف الفرعي مسبقًا
    const subCats = globalData.categories[mainCatVal].subCategories;
    if (subCats[newSubCat]) {
      showToast('التصنيف الفرعي موجود مسبقًا', true);
      return false;
    }
    
    showLoading('جاري إضافة التصنيف الفرعي...');
    
    // إضافة التصنيف الفرعي الجديد
    subCats[newSubCat] = { subSubCategories: [] };
    
    // حفظ البيانات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      populateSubCatForAddSubSub();
      updateSubCats();
      populateLinkCategorySelectors();
      
      // إعادة تعيين حقل الإدخال
      document.getElementById('newSubCat').value = '';
      
      // إعلام المستخدم بالنجاح
      showToast('تمت إضافة التصنيف الفرعي وحفظ البيانات بنجاح');
    } else {
      showToast('تمت إضافة التصنيف الفرعي لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في إضافة التصنيف الفرعي:', error);
    hideLoading();
    showToast(`خطأ في إضافة التصنيف الفرعي: ${error.message}`, true);
    return false;
  }
}

/** إضافة باقة (تصنيف فرعي للفرعي) جديدة */
async function addSubSubCat() {
  try {
    // الحصول على القيم
    const mainCatVal = document.getElementById('selectMainCatForAddSub').value;
    const subCatVal = document.getElementById('selectSubCatForAddSubSub').value;
    const newSubSubCat = document.getElementById('newSubSubCat').value.trim();
    
    // التحقق من اختيار التصنيفات
    if (!mainCatVal || !subCatVal) {
      showToast('اختر تصنيفًا رئيسيًا وفرعيًا', true);
      return false;
    }
    
    // التحقق من إدخال اسم الباقة
    if (!newSubSubCat) {
      showToast('الرجاء إدخال اسم الباقة', true);
      return false;
    }
    
    // التحقق من عدم وجود الباقة مسبقًا
    const subSubs = globalData.categories[mainCatVal].subCategories[subCatVal].subSubCategories;
    if (subSubs.includes(newSubSubCat)) {
      showToast('هذه الباقة موجودة مسبقًا', true);
      return false;
    }
    
    showLoading('جاري إضافة الباقة...');
    
    // إضافة الباقة الجديدة
    subSubs.push(newSubSubCat);
    
    // حفظ البيانات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      populateSubCatForAddSubSub();
      updateSubSubCats();
      populateLinkCategorySelectors();
      
      // إعادة تعيين حقل الإدخال
      document.getElementById('newSubSubCat').value = '';
      
      // إعلام المستخدم بالنجاح
      showToast('تمت إضافة الباقة وحفظ البيانات بنجاح');
    } else {
      showToast('تمت إضافة الباقة لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في إضافة الباقة:', error);
    hideLoading();
    showToast(`خطأ في إضافة الباقة: ${error.message}`, true);
    return false;
  }
}

/** حذف تصنيف رئيسي */
async function deleteMainCat() {
  try {
    // الحصول على التصنيف الرئيسي المحدد
    const mainCatVal = document.getElementById('selectMainCat').value;
    
    // التحقق من اختيار تصنيف رئيسي
    if (!mainCatVal) {
      showToast('يرجى اختيار تصنيف رئيسي لحذفه', true);
      return false;
    }
    
    // طلب تأكيد من المستخدم
    if (!confirm('هل أنت متأكد من حذف التصنيف الرئيسي وجميع التصنيفات الفرعية بداخله؟')) {
      return false;
    }
    
    showLoading('جاري حذف التصنيف الرئيسي...');
    
    // حذف التصنيف الرئيسي
    delete globalData.categories[mainCatVal];
    
    // حفظ التغييرات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      populateMainCatForAddSub();
      populateMainCatSelect();
      populateLinkCategorySelectors();
      
      // إعادة تعيين القوائم الفرعية لفارغة
      document.getElementById('selectSubCat').innerHTML = '';
      document.getElementById('selectSubSubCat').innerHTML = '';
      
      // إعلام المستخدم بالنجاح
      showToast('تم حذف التصنيف الرئيسي وحفظ التغييرات بنجاح');
    } else {
      showToast('تم حذف التصنيف لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في حذف التصنيف الرئيسي:', error);
    hideLoading();
    showToast(`خطأ في حذف التصنيف الرئيسي: ${error.message}`, true);
    return false;
  }
}

/** إعادة تسمية تصنيف رئيسي */
async function renameMainCat() {
  try {
    // الحصول على التصنيف الرئيسي المحدد
    const mainCatVal = document.getElementById('selectMainCat').value;
    
    // التحقق من اختيار تصنيف رئيسي
    if (!mainCatVal) {
      showToast('يرجى اختيار تصنيف رئيسي لإعادة تسميته', true);
      return false;
    }
    
    // طلب الاسم الجديد من المستخدم
    const newName = prompt('أدخل الاسم الجديد للتصنيف الرئيسي:', mainCatVal);
    
    // التحقق من إدخال اسم جديد صحيح
    if (!newName || !newName.trim()) {
      return false;
    }
    
    // التحقق من عدم وجود الاسم الجديد مسبقًا
    if (globalData.categories[newName]) {
      showToast('التصنيف الجديد موجود مسبقًا', true);
      return false;
    }
    
    showLoading('جاري إعادة تسمية التصنيف الرئيسي...');
    
    // إعادة تسمية التصنيف الرئيسي
    globalData.categories[newName] = globalData.categories[mainCatVal];
    delete globalData.categories[mainCatVal];
    
    // حفظ التغييرات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      populateMainCatForAddSub();
      populateMainCatSelect();
      populateLinkCategorySelectors();
      
      // إعلام المستخدم بالنجاح
      showToast('تم تعديل التصنيف الرئيسي وحفظ التغييرات بنجاح');
    } else {
      showToast('تم تعديل التصنيف لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في إعادة تسمية التصنيف الرئيسي:', error);
    hideLoading();
    showToast(`خطأ في إعادة تسمية التصنيف: ${error.message}`, true);
    return false;
  }
}

/** حذف تصنيف فرعي */
async function deleteSubCat() {
  try {
    // الحصول على التصنيفات المحددة
    const mainCatVal = document.getElementById('selectMainCat').value;
    const subCatVal = document.getElementById('selectSubCat').value;
    
    // التحقق من اختيار التصنيفات
    if (!mainCatVal || !subCatVal) {
      showToast('يرجى اختيار تصنيف رئيسي وفرعي للحذف', true);
      return false;
    }
    
    // طلب تأكيد من المستخدم
    if (!confirm('هل أنت متأكد من حذف التصنيف الفرعي وجميع الباقات داخله؟')) {
      return false;
    }
    
    showLoading('جاري حذف التصنيف الفرعي...');
    
    // حذف التصنيف الفرعي
    delete globalData.categories[mainCatVal].subCategories[subCatVal];
    
    // حفظ التغييرات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      updateSubCats();
      populateSubCatForAddSubSub();
      populateLinkCategorySelectors();
      document.getElementById('selectSubSubCat').innerHTML = '';
      
      // إعلام المستخدم بالنجاح
      showToast('تم حذف التصنيف الفرعي وحفظ التغييرات بنجاح');
    } else {
      showToast('تم حذف التصنيف لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في حذف التصنيف الفرعي:', error);
    hideLoading();
    showToast(`خطأ في حذف التصنيف الفرعي: ${error.message}`, true);
    return false;
  }
}

/** إعادة تسمية تصنيف فرعي */
async function renameSubCat() {
  try {
    // الحصول على التصنيفات المحددة
    const mainCatVal = document.getElementById('selectMainCat').value;
    const subCatVal = document.getElementById('selectSubCat').value;
    
    // التحقق من اختيار التصنيفات
    if (!mainCatVal || !subCatVal) {
      showToast('يرجى اختيار تصنيف رئيسي وفرعي لإعادة التسمية', true);
      return false;
    }
    
    // طلب الاسم الجديد من المستخدم
    const newName = prompt('أدخل الاسم الجديد للتصنيف الفرعي:', subCatVal);
    
    // التحقق من إدخال اسم جديد صحيح
    if (!newName || !newName.trim()) {
      return false;
    }
    
    const subCats = globalData.categories[mainCatVal].subCategories;
    
    // التحقق من عدم وجود الاسم الجديد مسبقًا
    if (subCats[newName]) {
      showToast('التصنيف الفرعي الجديد موجود مسبقًا', true);
      return false;
    }
    
    showLoading('جاري إعادة تسمية التصنيف الفرعي...');
    
    // إعادة تسمية التصنيف الفرعي
    subCats[newName] = subCats[subCatVal];
    delete subCats[subCatVal];
    
    // حفظ التغييرات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      updateSubCats();
      populateSubCatForAddSubSub();
      populateLinkCategorySelectors();
      
      // إعلام المستخدم بالنجاح
      showToast('تم تعديل التصنيف الفرعي وحفظ التغييرات بنجاح');
    } else {
      showToast('تم تعديل التصنيف لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في إعادة تسمية التصنيف الفرعي:', error);
    hideLoading();
    showToast(`خطأ في إعادة تسمية التصنيف الفرعي: ${error.message}`, true);
    return false;
  }
}

/** حذف باقة (تصنيف فرعي للفرعي) */
async function deleteSubSubCat() {
  try {
    // الحصول على التصنيفات المحددة
    const mainCatVal = document.getElementById('selectMainCat').value;
    const subCatVal = document.getElementById('selectSubCat').value;
    const subSubCatVal = document.getElementById('selectSubSubCat').value;
    
    // التحقق من اختيار جميع التصنيفات
    if (!mainCatVal || !subCatVal || !subSubCatVal) {
      showToast('يرجى اختيار التصنيفات والباقة للحذف', true);
      return false;
    }
    
    // طلب تأكيد من المستخدم
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) {
      return false;
    }
    
    // الحصول على مصفوفة الباقات
    const subSubs = globalData.categories[mainCatVal].subCategories[subCatVal].subSubCategories;
    const idx = subSubs.indexOf(subSubCatVal);
    
    // التحقق من وجود الباقة
    if (idx === -1) {
      showToast('لم يتم العثور على الباقة', true);
      return false;
    }
    
    showLoading('جاري حذف الباقة...');
    
    // حذف الباقة
    subSubs.splice(idx, 1);
    
    // حفظ التغييرات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      updateSubSubCats();
      populateLinkCategorySelectors();
      
      // إعلام المستخدم بالنجاح
      showToast('تم حذف الباقة وحفظ التغييرات بنجاح');
    } else {
      showToast('تم حذف الباقة لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في حذف الباقة:', error);
    hideLoading();
    showToast(`خطأ في حذف الباقة: ${error.message}`, true);
    return false;
  }
}

/** إعادة تسمية باقة (تصنيف فرعي للفرعي) */
async function renameSubSubCat() {
  try {
    // الحصول على التصنيفات المحددة
    const mainCatVal = document.getElementById('selectMainCat').value;
    const subCatVal = document.getElementById('selectSubCat').value;
    const subSubCatVal = document.getElementById('selectSubSubCat').value;
    
    // التحقق من اختيار جميع التصنيفات
    if (!mainCatVal || !subCatVal || !subSubCatVal) {
      showToast('يرجى اختيار التصنيفات والباقة لإعادة التسمية', true);
      return false;
    }
    
    // طلب الاسم الجديد من المستخدم
    const newName = prompt('أدخل الاسم الجديد للباقة:', subSubCatVal);
    
    // التحقق من إدخال اسم جديد صحيح
    if (!newName || !newName.trim()) {
      return false;
    }
    
    // الحصول على مصفوفة الباقات
    const subSubs = globalData.categories[mainCatVal].subCategories[subCatVal].subSubCategories;
    
    // التحقق من عدم وجود الاسم الجديد مسبقًا
    if (subSubs.includes(newName)) {
      showToast('الباقة الجديدة موجودة مسبقًا', true);
      return false;
    }
    
    // التحقق من وجود الباقة المراد تغيير اسمها
    const idx = subSubs.indexOf(subSubCatVal);
    if (idx === -1) {
      showToast('لم يتم العثور على الباقة', true);
      return false;
    }
    
    showLoading('جاري إعادة تسمية الباقة...');
    
    // إعادة تسمية الباقة
    subSubs[idx] = newName;
    
    // حفظ التغييرات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    if (saveResult) {
      // تحديث الواجهة
      updateSubSubCats();
      populateLinkCategorySelectors();
      
      // إعلام المستخدم بالنجاح
      showToast('تم تعديل اسم الباقة وحفظ التغييرات بنجاح');
    } else {
      showToast('تم تعديل اسم الباقة لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في إعادة تسمية الباقة:', error);
    hideLoading();
    showToast(`خطأ في إعادة تسمية الباقة: ${error.message}`, true);
    return false;
  }
}

/** دوال إضافية لتحديث القوائم الخاصة بنموذج تعديل الخدمة */
function updateEditSubCategorySelect(mainCategory, currentSubCategory) {
  const editSubCategorySelect = document.getElementById('editSubCategorySelect');
  updateSubCategorySelect(mainCategory, editSubCategorySelect, '-- اختر تصنيف فرعي --', currentSubCategory, function() {
    updateEditSubSubCategorySelect(mainCategory, editSubCategorySelect.value, '');
  });
}

function updateEditSubSubCategorySelect(mainCategory, subCategory, currentSubSubCategory) {
  const editSubSubCategorySelect = document.getElementById('editSubSubCategorySelect');
  updateSubSubCategorySelect(mainCategory, subCategory, editSubSubCategorySelect, '-- اختر الباقة --', currentSubSubCategory);
}

/** إدارة الخدمات المرتبطة بالتصنيفات */
function renderServices() {
  try {
    const servicesGrid = document.getElementById('servicesGrid');
    if (!servicesGrid) return;
    servicesGrid.innerHTML = '';
    if (!filteredServices || !Array.isArray(filteredServices)) {
      filteredServices = [...globalData.services];
    }
    if (filteredServices.length === 0) {
      servicesGrid.innerHTML = '<div style="text-align: center; padding: 20px; width: 100%;"><p>لا توجد خدمات مرتبطة بالتصنيفات للعرض. يمكنك ربط الخدمات من قسم "ربط الخدمات بالتصنيفات".</p></div>';
      if (globalData.serviceLinks && globalData.serviceLinks.length > 0) {
        updateServicesFromLinks();
        return;
      }
      return;
    }
    filteredServices.forEach(service => {
      if (!service) return;
      const card = document.createElement('div');
      card.className = 'serviceCard';
      card.innerHTML = `
        <h4>${service.name || 'بدون اسم'}</h4>
        <p>رمز الخدمة: ${service.id || 'غير معروف'}</p>
        <p>المزود: ${service.provider || 'غير معروف'}</p>
        <p>التصنيف: ${service.mainCategory} / ${service.subCategory || 'بدون تصنيف فرعي'}</p>
        ${service.subSubCategory ? `<p>الباقة: ${service.subSubCategory}</p>` : ''}
        <p>الكمية: ${service.quantity}</p>
        <div class="serviceActions">
          <button class="editBtn" onclick="editService(${service.id}, '${service.mainCategory}', '${service.subCategory}', '${service.subSubCategory || ''}')">تعديل</button>
          <button class="deleteBtn" onclick="deleteService(${service.id}, '${service.mainCategory}', '${service.subCategory}', '${service.subSubCategory || ''}')">حذف</button>
        </div>
      `;
      servicesGrid.appendChild(card);
    });
  } catch (error) {
    console.error('خطأ في عرض الخدمات:', error);
    showToast('حدث خطأ أثناء عرض الخدمات: ' + error.message, true);
  }
}

/** دالة عرض الخدمات الخام */
function renderRawServices() {
  try {
    const rawServicesGrid = document.getElementById('rawServicesGrid');
    if (!rawServicesGrid) return;
    rawServicesGrid.innerHTML = '';
    if (!filteredRawServices || !Array.isArray(filteredRawServices) || filteredRawServices.length === 0) {
      rawServicesGrid.innerHTML = '<div style="text-align: center; padding: 20px;"><p>لا توجد خدمات خام للعرض. يمكنك إضافة خدمات خام جديدة من قسم "إضافة خدمة جديدة".</p></div>';
      return;
    }
    filteredRawServices.forEach(service => {
      if (!service) return;
      const card = document.createElement('div');
      card.className = 'serviceCard';
      card.style.backgroundColor = '#3a3a3a';
      card.innerHTML = `
        <h4>${service.defaultName || 'بدون اسم'}</h4>
        <p>رمز الخدمة: ${service.id || 'غير معروف'}</p>
        <p>المزود: ${service.provider || 'غير معروف'}</p>
        <p>عدد الارتباطات: ${countServiceLinks(service.id)}</p>
        <div class="serviceActions">
          <button class="editBtn" onclick="editRawService('${service.id}')">تعديل</button>
          <button class="deleteBtn" onclick="deleteRawService('${service.id}')">حذف</button>
        </div>
      `;
      rawServicesGrid.appendChild(card);
    });
  } catch (error) {
    console.error('خطأ في عرض الخدمات الخام:', error);
    showToast('حدث خطأ أثناء عرض الخدمات الخام: ' + error.message, true);
  }
}

function filterServices() {
  try {
    const searchInput = document.getElementById('searchServiceInput');
    if (!searchInput) return;
    const searchVal = searchInput.value.toLowerCase().trim();
    if (!searchVal) {
      filteredServices = [...globalData.services];
    } else {
      filteredServices = globalData.services.filter(service => {
        if (!service) return false;
        return (
          (service.name && service.name.toLowerCase().includes(searchVal)) ||
          (service.id && service.id.toString().includes(searchVal)) ||
          (service.provider && service.provider.toLowerCase().includes(searchVal)) ||
          (service.mainCategory && service.mainCategory.toLowerCase().includes(searchVal)) ||
          (service.subCategory && service.subCategory.toLowerCase().includes(searchVal)) ||
          (service.subSubCategory && service.subSubCategory.toLowerCase().includes(searchVal))
        );
      });
    }
    renderServices();
  } catch (error) {
    console.error('خطأ في تصفية الخدمات:', error);
    showToast('حدث خطأ أثناء تصفية الخدمات: ' + error.message, true);
  }
}

/** حذف/تعديل خدمة مرتبطة */
/** حذف خدمة من القائمة */
async function deleteService(serviceId, mainCategory, subCategory, subSubCategory) {
  try {
    // تأكيد الحذف
    if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;

    showLoading('جاري حذف الخدمة...');
    
    // البحث عن الخدمة في مصفوفة الخدمات
    const serviceIndex = globalData.services.findIndex(s => 
      s.id === serviceId && 
      s.mainCategory === mainCategory && 
      s.subCategory === subCategory && 
      s.subSubCategory === subSubCategory
    );
    
    if (serviceIndex === -1) {
      hideLoading();
      showToast('الخدمة غير موجودة في قائمة الخدمات', true);
      return;
    }
    
    // حذف الخدمة من مصفوفة الخدمات
    globalData.services.splice(serviceIndex, 1);
    
    // البحث عن رابط الخدمة وحذفه من مصفوفة الروابط
    const linkIndex = globalData.serviceLinks.findIndex(link => 
      link.rawServiceId === serviceId && 
      link.mainCategory === mainCategory && 
      link.subCategory === subCategory && 
      link.subSubCategory === subSubCategory
    );
    
    if (linkIndex !== -1) {
      globalData.serviceLinks.splice(linkIndex, 1);
      console.log(`تم حذف رابط الخدمة من مصفوفة الروابط بنجاح`);
    }
    
    // حفظ البيانات المحدثة
    const saveResult = await saveData(false);
    
    hideLoading();
    
    // عرض النتيجة للمستخدم
    if (saveResult) {
      showToast('تم حذف الخدمة وحفظ البيانات بنجاح');
    } else {
      showToast('تم حذف الخدمة لكن فشل حفظ البيانات', true);
    }
    
    // تحديث عرض الخدمات
    filterServices();
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في حذف الخدمة:', error);
    hideLoading();
    showToast(`خطأ في حذف الخدمة: ${error.message}`, true);
    return false;
  }
}

/** تحرير خدمة مرتبطة */
function editService(serviceId, mainCategory, subCategory, subSubCategory) {
  currentEditServiceId = serviceId;
  currentEditMainCategory = mainCategory;
  currentEditSubCategory = subCategory;
  currentEditSubSubCategory = subSubCategory;
  const service = globalData.services.find(s => s.id === serviceId && s.mainCategory === mainCategory && s.subCategory === subCategory && s.subSubCategory === subSubCategory);
  if (!service) return;
  const serviceLink = globalData.serviceLinks.find(link => link.rawServiceId === serviceId && link.mainCategory === mainCategory && link.subCategory === subCategory && link.subSubCategory === subSubCategory);
  if (!serviceLink) return console.error('لم يتم العثور على رابط الخدمة');
  const modalOverlay = document.getElementById('modalOverlay');
  const editModal = document.getElementById('editModal');
  editModal.innerHTML = `
    <h4>تعديل سجل ربط الخدمة</h4>
    <div class="flexColumn">
      <label>الخدمة الخام</label>
      <select id="editRawServiceSelect"></select>
      <label>التصنيف الرئيسي</label>
      <select id="editMainCategorySelect"></select>
      <label>التصنيف الفرعي</label>
      <select id="editSubCategorySelect"></select>
      <label>التصنيف الفرعي للفرعي (باقة)</label>
      <select id="editSubSubCategorySelect"></select>
      <label>الاسم المعروض</label>
      <input type="text" id="editServiceName" value="${service.name}">
      <label>الكمية</label>
      <input type="number" id="editQuantity" value="${service.quantity}">
    </div>
    <div class="btnGroup">
      <button class="editBtn" onclick="saveEditService()">حفظ</button>
      <button class="deleteBtn" onclick="closeModal()">إلغاء</button>
    </div>
  `;
  populateEditRawServiceSelect(serviceId);
  populateEditMainCategorySelect(mainCategory);
  updateEditSubCategorySelect(mainCategory, subCategory);
  updateEditSubSubCategorySelect(mainCategory, subCategory, subSubCategory);
  document.getElementById('editMainCategorySelect').addEventListener('change', function() {
    updateEditSubCategorySelect(this.value, '');
  });
  document.getElementById('editSubCategorySelect').addEventListener('change', function() {
    updateEditSubSubCategorySelect(document.getElementById('editMainCategorySelect').value, this.value, '');
  });
  modalOverlay.style.display = 'flex';
}

/** دوال مساعدة لنموذج تعديل الخدمة */
function updateEditSubCategorySelect(mainCategory, currentSubCategory) {
  const editSubCategorySelect = document.getElementById('editSubCategorySelect');
  updateSubCategorySelect(mainCategory, editSubCategorySelect, '-- اختر تصنيف فرعي --', currentSubCategory, function() {
    updateEditSubSubCategorySelect(mainCategory, editSubCategorySelect.value, '');
  });
}

function updateEditSubSubCategorySelect(mainCategory, subCategory, currentSubSubCategory) {
  const editSubSubCategorySelect = document.getElementById('editSubSubCategorySelect');
  updateSubSubCategorySelect(mainCategory, subCategory, editSubSubCategorySelect, '-- اختر الباقة --', currentSubSubCategory);
}

function populateEditRawServiceSelect(currentRawServiceId) {
  const select = document.getElementById('editRawServiceSelect');
  select.innerHTML = '';
  globalData.rawServices.forEach(rawService => {
    const option = document.createElement('option');
    option.value = rawService.id;
    option.textContent = `${rawService.id} - ${rawService.defaultName}`;
    option.selected = rawService.id === currentRawServiceId;
    select.appendChild(option);
  });
}

function populateEditMainCategorySelect(currentMainCategory) {
  const select = document.getElementById('editMainCategorySelect');
  select.innerHTML = '';
  Object.keys(globalData.categories).forEach(mainCat => {
    const option = document.createElement('option');
    option.value = mainCat;
    option.textContent = mainCat;
    option.selected = mainCat === currentMainCategory;
    select.appendChild(option);
  });
}

/** حفظ تعديلات الخدمة */
async function saveEditService() {
  try {
    // التحقق من وجود بيانات التحرير الحالية
    if (currentEditServiceId === null) {
      showToast('لا توجد خدمة محددة للتعديل', true);
      return false;
    }
    
    showLoading('جاري حفظ التعديلات...');
    
    // الحصول على القيم الجديدة من النموذج
    const newRawServiceId = Number(document.getElementById('editRawServiceSelect').value);
    const newMainCategory = document.getElementById('editMainCategorySelect').value;
    const newSubCategory = document.getElementById('editSubCategorySelect').value;
    const newSubSubCategory = document.getElementById('editSubSubCategorySelect').value;
    const newName = document.getElementById('editServiceName').value.trim();
    const newQty = Number(document.getElementById('editQuantity').value);
    
    // التحقق من صحة البيانات
    if (!newName || !newRawServiceId || !newMainCategory || !newQty) {
      hideLoading();
      showToast('الرجاء تعبئة جميع الحقول المطلوبة', true);
      return false;
    }
    
    // التحقق من وجود الخدمة الخام
    const rawService = globalData.rawServices.find(s => s.id === newRawServiceId);
    if (!rawService) {
      hideLoading();
      showToast('الخدمة الخام غير موجودة', true);
      return false;
    }
    
    // البحث عن رابط الخدمة الحالي
    const serviceLinkIndex = globalData.serviceLinks.findIndex(link => 
      link.rawServiceId === currentEditServiceId && 
      link.mainCategory === currentEditMainCategory && 
      link.subCategory === currentEditSubCategory && 
      link.subSubCategory === currentEditSubSubCategory
    );
    
    if (serviceLinkIndex === -1) {
      hideLoading();
      showToast('لم يتم العثور على رابط الخدمة', true);
      return false;
    }
    
    // تحديث رابط الخدمة بالقيم الجديدة
    globalData.serviceLinks[serviceLinkIndex] = {
      rawServiceId: newRawServiceId,
      mainCategory: newMainCategory,
      subCategory: newSubCategory || '',
      subSubCategory: newSubSubCategory || '',
      name: newName,
      quantity: newQty
    };
    
    console.log('تم تحديث رابط الخدمة في المصفوفة:', globalData.serviceLinks[serviceLinkIndex]);
    
    // تحديث الخدمات وحفظ البيانات
    const updateResult = await updateServicesFromLinks();
    
    hideLoading();
    closeModal();
    
    // إعلام المستخدم بنتيجة العملية
    if (updateResult) {
      showToast('تم حفظ التعديلات وتحديث البيانات بنجاح');
    } else {
      showToast('تم تعديل الخدمة لكن فشل حفظ البيانات', true);
    }
    
    // تحديث عرض الخدمات
    filterServices();
    
    return updateResult;
  } catch (error) {
    console.error('خطأ في حفظ تعديلات الخدمة:', error);
    hideLoading();
    showToast(`خطأ في حفظ التعديلات: ${error.message}`, true);
    return false;
  }
}

function closeModal() {
  currentEditServiceId = currentEditMainCategory = currentEditSubCategory = currentEditSubSubCategory = null;
  document.getElementById('modalOverlay').style.display = 'none';
}

/** Toast لعرض الرسائل */
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

/** إنشاء نسخة احتياطية يدوية لملف البيانات */
async function createManualBackup() {
  try {
    showLoading('جاري إنشاء نسخة احتياطية...');
    
    const response = await fetch(API_ENDPOINTS.CREATE_BACKUP);
    const result = await response.json();
    
    hideLoading();
    
    if (response.ok) {
      if (result.status === 'success') {
        // تم إنشاء النسخة الاحتياطية بنجاح
        const backupFile = result.backupFile;
        const backups = result.backups;
        
        // عرض رسالة نجاح
        showToast('تم إنشاء نسخة احتياطية بنجاح');
        
        // عرض معلومات النسخة الاحتياطية
        console.info('معلومات النسخة الاحتياطية:', backupFile);
        
        // إذا كانت هناك نسخ احتياطية متعددة، عرض قائمة بها
        if (backups && backups.length > 0) {
          let backupInfo = `تم إنشاء نسخة احتياطية جديدة:\n` +
                        `اسم الملف: ${backupFile.name}\n` +
                        `الحجم: ${Math.round(backupFile.size / 1024)} كيلوبايت\n\n`;
          
          backupInfo += `النسخ الاحتياطية المتوفرة (${backups.length}):\n`;
          
          // إضافة أول 3 نسخ احتياطية للقائمة
          const displayBackups = backups.slice(0, 3);
          displayBackups.forEach((backup, index) => {
            const backupDate = new Date(backup.created).toLocaleString('ar');
            const backupSize = Math.round(backup.size / 1024);
            backupInfo += `${index + 1}. ${backup.name} (${backupSize} كيلوبايت) - ${backupDate}\n`;
          });
          
          if (backups.length > 3) {
            backupInfo += `... و${backups.length - 3} نسخ احتياطية أخرى`;
          }
          
          alert(backupInfo);
        } else {
          alert(`تم إنشاء نسخة احتياطية جديدة: ${backupFile.name}`);
        }
        
        return true;
      } else {
        // حالة غير متوقعة
        console.warn('حالة غير متوقعة من الخادم:', result);
        showToast(`حالة غير متوقعة: ${result.status}`, true);
        return false;
      }
    } else {
      // خطأ في الطلب
      const errorMsg = result.error || 'خطأ غير معروف أثناء إنشاء نسخة احتياطية';
      console.error('خطأ في إنشاء نسخة احتياطية:', result);
      showToast(errorMsg, true);
      return false;
    }
  } catch (error) {
    console.error('خطأ أثناء إنشاء النسخة الاحتياطية:', error);
    hideLoading();
    showToast(`خطأ في إنشاء النسخة الاحتياطية: ${error.message}`, true);
    return false;
  }
}

/** التحقق من سلامة ملف JSON */
async function checkJsonIntegrity() {
  try {
    showLoading('جاري التحقق من سلامة ملف البيانات...');
    
    const response = await fetch(API_ENDPOINTS.CHECK_JSON_INTEGRITY);
    const result = await response.json();
    
    hideLoading();
    
    if (response.ok) {
      // التحقق من نتيجة الفحص
      const status = result.status;
      const report = result.integrityReport;
      
      if (status === 'ok') {
        // الملف سليم
        showToast('ملف البيانات سليم ويحتوي على بنية صحيحة');
        
        // عرض معلومات إضافية
        console.info('تقرير سلامة الملف:', report);
        alert(
          `تقرير سلامة ملف البيانات:\n\n` +
          `حالة الملف: سليم\n` +
          `عدد التصنيفات: ${report.counts.categories}\n` +
          `عدد الخدمات: ${report.counts.services}\n` +
          `عدد الخدمات الخام: ${report.counts.rawServices}\n` +
          `حجم الملف: ${report.file.sizeKB} كيلوبايت\n` +
          `آخر تحديث: ${new Date(report.file.lastModified).toLocaleString('ar')}`
        );
        
        return true;
      } else if (status === 'warning') {
        // هناك مشكلة محتملة في الملف
        showToast(`تحذير: ملف البيانات قد يحتوي على مشكلات`, true);
        
        // عرض التفاصيل
        console.warn('تحذير في سلامة الملف:', result);
        
        if (!report.structure.hasCategories) {
          alert('تحذير: ملف البيانات لا يحتوي على تصنيفات صالحة');
        } else if (!report.structure.hasServices || !report.structure.hasRawServices) {
          alert('تحذير: ملف البيانات لا يحتوي على مصفوفات الخدمات المطلوبة');
        } else if (!report.consistency.servicesConsistent) {
          alert('تحذير: هناك تناقض بين عدد الخدمات والخدمات الخام');
        } else {
          alert(`تحذير: هناك مشكلة غير محددة في ملف البيانات. التفاصيل في وحدة التحكم.`);
        }
        
        return false;
      } else {
        // حالة غير متوقعة
        showToast(`حالة غير معروفة: ${status}`, true);
        return false;
      }
    } else {
      // خطأ في الطلب
      const errorMsg = result.error || 'خطأ غير معروف أثناء التحقق من سلامة الملف';
      console.error('خطأ في التحقق من سلامة الملف:', result);
      showToast(errorMsg, true);
      return false;
    }
  } catch (error) {
    console.error('خطأ أثناء التحقق من سلامة الملف:', error);
    hideLoading();
    showToast(`خطأ في التحقق من سلامة الملف: ${error.message}`, true);
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

/** Toast لعرض الرسائل */
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.innerHTML = msg.replace(/\n/g, '<br>');
  toast.classList.toggle('error', isError);
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 5000);
}

/** إدارة الخدمات الخام */
function addRawService() {
  const serviceId = Number(document.getElementById('rawServiceId').value);
  const provider = document.getElementById('rawServiceProvider').value;
  const defaultName = document.getElementById('rawServiceDefaultName').value.trim();
  if (!serviceId || !defaultName) return showToast('الرجاء تعبئة جميع الحقول المطلوبة', true);
  const exists = globalData.rawServices.find(s => s.id === serviceId && s.provider === provider);
  if (exists) return showToast('هذه الخدمة موجودة مسبقاً', true);
  const newRawService = { id: serviceId, provider: provider, defaultName: defaultName };
  globalData.rawServices.push(newRawService);
  saveData();
  showToast('تمت إضافة الخدمة بنجاح');
  document.getElementById('rawServiceId').value = '';
  document.getElementById('rawServiceDefaultName').value = '';
  renderServices();
  populateRawServiceSelect();
  renderRawServices();
}

function editRawService(serviceId) {
  serviceId = Number(serviceId);
  const serviceIndex = globalData.rawServices.findIndex(service => service.id === serviceId);
  if (serviceIndex === -1) return showToast('الخدمة الخام غير موجودة', true);
  const service = globalData.rawServices[serviceIndex];
  const modalOverlay = document.getElementById('modalOverlay');
  const editModal = document.getElementById('editModal');
  editModal.innerHTML = `
    <h4>تعديل الخدمة الخام</h4>
    <div class="flexColumn">
      <label>رمز الخدمة (ID)</label>
      <input type="number" id="editRawServiceId" value="${service.id}">
      <label>المزود</label>
      <select id="editRawServiceProvider">
        <option value="seoclevers" ${service.provider === 'seoclevers' ? 'selected' : ''}>سيوكليفرز</option>
        <option value="drd3m" ${service.provider === 'drd3m' ? 'selected' : ''}>دكتور دعم</option>
      </select>
      <label>الاسم الافتراضي</label>
      <input type="text" id="editRawServiceName" value="${service.defaultName}">
    </div>
    <div class="btnGroup">
      <button class="editBtn" onclick="saveEditRawService(${service.id})">حفظ</button>
      <button class="deleteBtn" onclick="closeModal()">إلغاء</button>
    </div>
  `;
  modalOverlay.style.display = 'flex';
}

/** حذف خدمة خام مع جميع الروابط المرتبطة بها */
async function deleteRawService(serviceId) {
  try {
    // تحويل المعرف إلى رقم
    serviceId = Number(serviceId);
    
    // التحقق من وجود الخدمة الخام
    const serviceIndex = globalData.rawServices.findIndex(service => service.id === serviceId);
    if (serviceIndex === -1) {
      showToast('الخدمة الخام غير موجودة', true);
      return false;
    }
    
    // حساب عدد الروابط المرتبطة بهذه الخدمة
    const linksCount = countServiceLinks(serviceId);
    
    // تأكيد الحذف إذا كانت هناك روابط
    const confirmMessage = linksCount > 0 
      ? `هذه الخدمة مرتبطة بـ ${linksCount} تصنيف. هل أنت متأكد من حذفها؟ (سيتم حذف جميع الارتباطات أيضًا)` 
      : 'هل أنت متأكد من حذف هذه الخدمة الخام؟';
    
    if (!confirm(confirmMessage)) return false;
    
    showLoading('جاري حذف الخدمة الخام...');
    
    // حذف جميع الروابط المتعلقة بهذه الخدمة
    const previousLinksCount = globalData.serviceLinks.length;
    globalData.serviceLinks = globalData.serviceLinks.filter(link => link.rawServiceId !== serviceId);
    const removedLinks = previousLinksCount - globalData.serviceLinks.length;
    console.log(`تم حذف ${removedLinks} رابط مرتبط بالخدمة الخام`);
    
    // حذف الخدمة الخام من المصفوفة
    globalData.rawServices.splice(serviceIndex, 1);
    
    // تحديث الخدمات بناءً على الروابط الجديدة
    await updateServicesFromLinks(false); // لا حاجة لحفظ البيانات هنا لأننا سنحفظها لاحقًا
    
    // تحديث مصفوفة الخدمات الخام المصفاة
    filteredRawServices = filteredRawServices.filter(service => service.id !== serviceId);
    
    // حفظ جميع التغييرات
    const saveResult = await saveData(false);
    
    hideLoading();
    
    // تحديث عناصر الواجهة
    renderRawServices();
    renderServices();
    populateRawServiceSelect();
    
    // إعلام المستخدم بنتيجة العملية
    if (saveResult) {
      showToast(`تم حذف الخدمة الخام و${removedLinks > 0 ? ` ${removedLinks} روابط مرتبطة بها` : ''} بنجاح`);
    } else {
      showToast('تم حذف الخدمة الخام لكن فشل حفظ البيانات', true);
    }
    
    return saveResult;
  } catch (error) {
    console.error('خطأ في حذف الخدمة الخام:', error);
    hideLoading();
    showToast(`خطأ في حذف الخدمة الخام: ${error.message}`, true);
    return false;
  }
}

function countServiceLinks(rawServiceId) {
  return globalData.serviceLinks.filter(link => link.rawServiceId === rawServiceId).length;
}

/** ربط الخدمات بالتصنيفات */
function populateRawServiceSelect() {
  const selectRawService = document.getElementById('selectRawService');
  if (!selectRawService) return;
  const currentValue = selectRawService.value;
  selectRawService.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '-- اختر خدمة --';
  selectRawService.appendChild(emptyOption);
  if (!globalData.rawServices || !globalData.rawServices.length) return;
  globalData.rawServices.forEach(service => {
    if (!service || !service.id) return;
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.defaultName || 'بدون اسم'} (${service.id}) - ${service.provider || 'غير معروف'}`;
    selectRawService.appendChild(option);
  });
  if (currentValue) selectRawService.value = currentValue;
  updateSelectedRawServiceInfo();
}

function updateSelectedRawServiceInfo() {
  const selectEl = document.getElementById('selectRawService');
  const infoBox = document.getElementById('selectedRawServiceInfo');
  if (!selectEl || !infoBox) return;
  const rawServiceId = Number(selectEl.value);
  if (!rawServiceId) {
    infoBox.innerHTML = '<p>الرجاء اختيار خدمة</p>';
    return;
  }
  const rawService = globalData.rawServices.find(s => s.id === rawServiceId);
  if (!rawService) {
    infoBox.innerHTML = '<p>الخدمة غير موجودة</p>';
    return;
  }
  infoBox.innerHTML = `
    <p><strong>رمز الخدمة:</strong> ${rawService.id}</p>
    <p><strong>المزود:</strong> ${rawService.provider === 'drd3m' ? 'دكتور دعم' : 'سيوكليفرز'}</p>
    <p><strong>الاسم الافتراضي:</strong> ${rawService.defaultName}</p>
    <p><strong>عدد الارتباطات الحالية:</strong> ${countServiceLinks(rawService.id)}</p>
  `;
  const linkNameInput = document.getElementById('linkServiceName');
  if (linkNameInput) {
    const mainCatSel = document.getElementById('linkMainCatSel');
    const subCatSel = document.getElementById('linkSubCatSel');
    const subSubCatSel = document.getElementById('linkSubSubCatSel');
    let suggestedName = rawService.defaultName;
    if (mainCatSel && mainCatSel.value) {
      suggestedName = `${mainCatSel.value} ${suggestedName}`;
      if (subCatSel && subCatSel.value) {
        suggestedName += ` ${subCatSel.value}`;
        if (subSubCatSel && subSubCatSel.value) {
          suggestedName += ` ${subSubCatSel.value}`;
        }
      }
    }
    linkNameInput.value = suggestedName;
  }
}

function populateLinkCategorySelectors() {
  const linkMainCatSel = document.getElementById('linkMainCatSel');
  if (!linkMainCatSel) return;
  linkMainCatSel.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '-- اختر تصنيف --';
  linkMainCatSel.appendChild(emptyOption);
  Object.keys(globalData.categories).forEach(catKey => {
    const option = document.createElement('option');
    option.value = catKey;
    option.textContent = catKey;
    linkMainCatSel.appendChild(option);
  });
  updateLinkSubCatSel();
}

function updateLinkSubCatSel() {
  const linkMainCatVal = document.getElementById('linkMainCatSel').value;
  const linkSubCatSel = document.getElementById('linkSubCatSel');
  updateSubCategorySelect(linkMainCatVal, linkSubCatSel, '-- اختر تصنيف فرعي --', '', () => {
    updateLinkSubSubCatSel();
    updateSelectedRawServiceInfo();
  });
}

function updateLinkSubSubCatSel() {
  const linkMainCatVal = document.getElementById('linkMainCatSel').value;
  const linkSubCatVal = document.getElementById('linkSubCatSel').value;
  const linkSubSubCatSel = document.getElementById('linkSubSubCatSel');
  updateSubSubCategorySelect(linkMainCatVal, linkSubCatVal, linkSubSubCatSel, '-- اختر الباقة --');
  updateSelectedRawServiceInfo();
}

/** ربط خدمة خام بتصنيف محدد */
async function linkServiceToCategory() {
  try {
    showLoading('جاري ربط الخدمة بالتصنيف...');
    
    // الحصول على قيم الحقول
    const rawServiceId = Number(document.getElementById('selectRawService').value);
    const mainCat = document.getElementById('linkMainCatSel').value;
    const subCat = document.getElementById('linkSubCatSel').value;
    const subSubCat = document.getElementById('linkSubSubCatSel').value;
    const serviceName = document.getElementById('linkServiceName').value.trim();
    const quantity = Number(document.getElementById('linkQuantity').value);
    
    // التحقق من إدخال الحقول المطلوبة
    if (!rawServiceId || !mainCat || !serviceName || !quantity) {
      hideLoading();
      showToast('الرجاء تعبئة الحقول المطلوبة: الخدمة، التصنيف الرئيسي، اسم الخدمة، والكمية', true);
      return;
    }
    
    // التحقق من وجود الخدمة الخام
    const rawService = globalData.rawServices.find(s => s.id === rawServiceId);
    if (!rawService) {
      hideLoading();
      showToast('الخدمة الخام غير موجودة', true);
      return;
    }
    
    // التحقق من عدم وجود الربط مسبقاً
    const exists = globalData.serviceLinks.find(link => 
      link.rawServiceId === rawServiceId &&
      link.mainCategory === mainCat &&
      link.subCategory === subCat &&
      link.subSubCategory === subSubCat
    );
    
    if (exists) {
      hideLoading();
      showToast('هذا الربط موجود مسبقاً', true);
      return;
    }
    
    // إنشاء رابط جديد
    const newLink = {
      rawServiceId: rawServiceId,
      mainCategory: mainCat,
      subCategory: subCat || "",
      subSubCategory: subSubCat || "",
      name: serviceName,
      quantity: quantity
    };
    
    // إضافة الرابط إلى مصفوفة الروابط
    globalData.serviceLinks.push(newLink);
    
    // تحديث الخدمات وحفظ البيانات
    const updateResult = await updateServicesFromLinks();
    
    hideLoading();
    
    // التحقق من نجاح التحديث
    if (updateResult) {
      showToast('تم ربط الخدمة بالتصنيف وحفظ البيانات بنجاح');
      // إعادة تعيين حقل الكمية
      document.getElementById('linkQuantity').value = '';
      document.getElementById('linkServiceName').value = '';
    } else {
      showToast('تم ربط الخدمة بالتصنيف لكن فشل حفظ البيانات', true);
    }
    
    // تحديث عرض الخدمات
    filterServices();
  } catch (error) {
    console.error('خطأ في ربط الخدمة بالتصنيف:', error);
    hideLoading();
    showToast(`خطأ في ربط الخدمة: ${error.message}`, true);
  }
}

/** تحديث الخدمات بناءً على روابط الخدمات مع التصنيفات */
async function updateServicesFromLinks() {
  try {
    console.log('بدء تحديث الخدمات من روابط التصنيفات...');
    
    // التحقق من وجود البيانات المطلوبة
    if (!Array.isArray(globalData.serviceLinks)) {
      console.error('مصفوفة روابط الخدمات غير موجودة أو غير صالحة');
      showToast('خطأ في بنية روابط الخدمات', true);
      return false;
    }
    
    if (!Array.isArray(globalData.rawServices)) {
      console.error('مصفوفة الخدمات الخام غير موجودة أو غير صالحة');
      showToast('خطأ في بنية الخدمات الخام', true);
      return false;
    }
    
    // إعادة بناء مصفوفة الخدمات
    globalData.services = [];
    let missingServicesCount = 0;
    
    globalData.serviceLinks.forEach(link => {
      // التحقق من صحة بنية الرابط
      if (!link || typeof link !== 'object' || !link.rawServiceId) {
        console.warn('تم العثور على رابط خدمة غير صالح:', link);
        return;
      }
      
      // البحث عن الخدمة الخام المرتبطة
      const rawService = globalData.rawServices.find(s => s.id === link.rawServiceId);
      if (!rawService) {
        console.warn(`الخدمة الخام غير موجودة: ${link.rawServiceId}`);
        missingServicesCount++;
        return;
      }
      
      // إنشاء سجل خدمة جديد
      const service = {
        id: rawService.id,
        mainCategory: link.mainCategory,
        subCategory: link.subCategory || '',
        subSubCategory: link.subSubCategory || '',
        name: link.name || rawService.defaultName,
        quantity: link.quantity || 1,
        provider: rawService.provider
      };
      
      globalData.services.push(service);
    });
    
    console.log(`تم تحديث ${globalData.services.length} خدمة. خدمات مفقودة: ${missingServicesCount}`);
    
    // تحديث المصفوفة المصفاة للعرض
    filteredServices = [...globalData.services];
    
    // حفظ البيانات مع التأكد من النجاح
    const saveResult = await saveData(false);
    if (!saveResult) {
      console.error('فشل في حفظ البيانات بعد تحديث الخدمات');
      showToast('تم تحديث الخدمات لكن فشل الحفظ', true);
    }
    
    // تحديث العرض
    renderServices();
    return saveResult;
  } catch (error) {
    console.error('خطأ في تحديث الخدمات من روابط الخدمات:', error);
    showToast(`خطأ في تحديث الخدمات: ${error.message}`, true);
    return false;
  }
}

function migrateToNewSystem() {
  if (globalData.rawServices.length > 0 || globalData.serviceLinks.length > 0) return;
  const uniqueRawServices = new Map();
  globalData.services.forEach(service => {
    const key = `${service.id}-${service.provider}`;
    if (!uniqueRawServices.has(key)) {
      uniqueRawServices.set(key, {
        id: service.id,
        provider: service.provider,
        defaultName: service.name.split(' ')[0]
      });
    }
  });
  globalData.rawServices = Array.from(uniqueRawServices.values());
  globalData.serviceLinks = globalData.services.map(service => ({
    rawServiceId: service.id,
    mainCategory: service.mainCategory,
    subCategory: service.subCategory,
    subSubCategory: service.subSubCategory,
    name: service.name,
    quantity: service.quantity
  }));
  saveData();
  showToast('تم تحويل البيانات إلى النظام الجديد بنجاح');
}

function exportData() {
  const exportData = {
    categories: globalData.categories,
    services: globalData.services,
    rawServices: globalData.rawServices,
    serviceLinks: globalData.serviceLinks
  };
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'servicesData.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
  showToast('تم تصدير البيانات بنجاح');
}

/** دوال مساعدة لتحديث القوائم الفرعية */
function updateSubCategorySelect(mainCategoryId, subCategorySelect, emptyOptionText, currentValue = '', callback = null) {
  if (!subCategorySelect) return;
  subCategorySelect.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyOptionText || '-- اختر تصنيف فرعي --';
  subCategorySelect.appendChild(emptyOption);
  if (!mainCategoryId || !globalData.categories[mainCategoryId]) return;
  const subCats = globalData.categories[mainCategoryId].subCategories || {};
  Object.keys(subCats).forEach(subKey => {
    const option = document.createElement('option');
    option.value = subKey;
    option.textContent = subKey;
    if (currentValue && subKey === currentValue) option.selected = true;
    subCategorySelect.appendChild(option);
  });
  if (typeof callback === 'function') callback();
}

function updateSubSubCategorySelect(mainCategoryId, subCategoryId, subSubCategorySelect, emptyOptionText, currentValue = '') {
  if (!subSubCategorySelect) return;
  subSubCategorySelect.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyOptionText || '-- اختر الباقة --';
  subSubCategorySelect.appendChild(emptyOption);
  if (!mainCategoryId || !globalData.categories[mainCategoryId]) return;
  const subCats = globalData.categories[mainCategoryId].subCategories || {};
  if (!subCategoryId || !subCats[subCategoryId]) return;
  const subSubs = subCats[subCategoryId].subSubCategories || [];
  subSubs.forEach(ssc => {
    const option = document.createElement('option');
    option.value = ssc;
    option.textContent = ssc;
    if (currentValue && ssc === currentValue) option.selected = true;
    subSubCategorySelect.appendChild(option);
  });
}

/** تهيئة التصنيفات عند تحميل الصفحة */
function populateMainCatSelects() {
  populateMainCatForAddSub();
  populateMainCatSelect();
  populateLinkCategorySelectors();
  console.log('تم تعبئة قوائم التصنيفات الرئيسية');
}

/** تهيئة الصفحة بالكامل */
async function init() {
  try {
    // بدء مراقبة حالة الاتصال بالخادم
    setupConnectionMonitoring();
    
    // تحميل البيانات
    globalData = await loadData();
    if (!globalData || !globalData.categories || !globalData.rawServices)
      throw new Error('البيانات المحملة غير مكتملة أو غير صحيحة');
    if (!globalData.serviceLinks) {
      globalData.serviceLinks = [];
      console.warn('لم يتم العثور على serviceLinks، سيتم إنشاء مصفوفة فارغة');
    }
    migrateToNewSystem();
    updateServicesFromLinks();
    populateMainCatSelects();
    filteredRawServices = Array.isArray(globalData.rawServices) ? [...globalData.rawServices] : [];
    filteredServices = Array.isArray(globalData.services) ? [...globalData.services] : [];
    renderServices();
    renderRawServices(); // عرض الخدمات الخام
    populateRawServiceSelect();
    try {
      populateLinkCategorySelectors();
    } catch (error) {
      console.error('خطأ في تهيئة قوائم التصنيفات للربط:', error);
    }
    document.getElementById('selectRawService').addEventListener('change', updateSelectedRawServiceInfo);
    document.getElementById('linkMainCatSel').addEventListener('change', updateLinkSubCatSel);
    document.getElementById('linkSubCatSel').addEventListener('change', updateLinkSubSubCatSel);
    document.getElementById('linkSubSubCatSel').addEventListener('change', updateSelectedRawServiceInfo);
    document.getElementById('searchServiceInput').addEventListener('input', filterServices);
    document.getElementById('searchRawServiceInput').addEventListener('input', filterRawServices);
  } catch (error) {
    console.error('خطأ في تهيئة الصفحة:', error);
    showToast('حدث خطأ أثناء تهيئة الصفحة: ' + error.message, true);
  }
}

document.addEventListener('DOMContentLoaded', async () => { 
  await init(); 
  console.log('تم الانتهاء من تهيئة الصفحة');
});