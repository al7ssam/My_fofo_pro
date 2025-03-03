/*******************************************************
 * manage_app.js
 * إدارة التصنيفات والخدمات
 * يعرض ويتيح إضافة/تعديل/حذف
 *******************************************************/

const STORAGE_KEY = 'services_data';
// وقت التحديث التلقائي للأرصدة (15 دقيقة)
const UPDATE_INTERVAL = 15 * 60 * 1000;

let globalData = { 
  categories: {}, 
  services: [],
  rawServices: [], // الخدمات الخام (رقم الخدمة والمزود)
  serviceLinks: [] // روابط الخدمات بالتصنيفات
};

// لعرض الخدمات (سواء الأصلية أم المفلترة)
let filteredServices = [];
let filteredRawServices = []; // للخدمات الخام المفلترة

/**
 * تحديث رصيد سيوكليفرز
 */
async function updateSeoBalance() {
  try {
    const response = await fetch('/api/balance/seoclevers');
    
    if (!response.ok) {
      throw new Error(`خطأ في الاتصال: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    const balanceElement = document.getElementById('seoBalance');
    const lastUpdateElement = document.getElementById('seoLastUpdate');
    
    if (data.balance && data.currency) {
      const balance = parseFloat(data.balance);
      balanceElement.textContent = `${balance.toFixed(2)} ${data.currency}`;
      
      // تعيين لون الرصيد بناءً على القيمة (أخضر إذا كان أكبر من 50، أصفر إذا كان أقل)
      balanceElement.style.color = balance > 50 ? 'var(--success-color)' : '#FFA500';
      
      // تحديث وقت آخر تحديث
      const now = new Date();
      lastUpdateElement.textContent = `آخر تحديث: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // إظهار تنبيه إذا كان الرصيد منخفضاً
      if (balance <= 50) {
        showToast(`تنبيه: رصيد سيوكليفرز منخفض (${balance.toFixed(2)} ${data.currency})`, 'error');
      }
    } else {
      throw new Error('بيانات غير صالحة');
    }
  } catch (error) {
    console.error('خطأ في تحديث رصيد سيوكليفرز:', error);
    document.getElementById('seoBalance').textContent = 'خطأ في التحديث';
    document.getElementById('seoBalance').style.color = 'var(--danger-color)';
    showToast(`فشل تحديث رصيد سيوكليفرز: ${error.message}`, 'error');
  }
}

/**
 * تحديث رصيد دكتور دعم
 */
async function updateDrDaamBalance() {
  try {
    const response = await fetch('/api/balance/drdaam');
    
    if (!response.ok) {
      throw new Error(`خطأ في الاتصال: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    const balanceElement = document.getElementById('drDaamBalance');
    const lastUpdateElement = document.getElementById('drDaamLastUpdate');
    
    if (data.balance && data.currency) {
      const balance = parseFloat(data.balance);
      balanceElement.textContent = `${balance.toFixed(2)} ${data.currency}`;
      
      // تعيين لون الرصيد بناءً على القيمة (أخضر إذا كان أكبر من 50، أصفر إذا كان أقل)
      balanceElement.style.color = balance > 50 ? 'var(--success-color)' : '#FFA500';
      
      // تحديث وقت آخر تحديث
      const now = new Date();
      lastUpdateElement.textContent = `آخر تحديث: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // إظهار تنبيه إذا كان الرصيد منخفضاً
      if (balance <= 50) {
        showToast(`تنبيه: رصيد دكتور دعم منخفض (${balance.toFixed(2)} ${data.currency})`, 'error');
      }
    } else {
      throw new Error('بيانات غير صالحة');
    }
  } catch (error) {
    console.error('خطأ في تحديث رصيد دكتور دعم:', error);
    document.getElementById('drDaamBalance').textContent = 'خطأ في التحديث';
    document.getElementById('drDaamBalance').style.color = 'var(--danger-color)';
    showToast(`فشل تحديث رصيد دكتور دعم: ${error.message}`, 'error');
  }
}

/**
 * تهيئة التطبيق
 */
function initApp() {
  loadData();
  renderMainCats();
  renderServices();
  renderRawServices();
  populateMainCatSelect();
  populateRawServiceSelect();
  populateEditLinkMainCategorySelect();
  setupSectionListeners();
  // تحديث أرصدة المزودين عند تحميل الصفحة
  updateSeoBalance();
  updateDrDaamBalance();
  
  // تحديث أرصدة المزودين كل 15 دقيقة
  setInterval(() => {
    updateSeoBalance();
    updateDrDaamBalance();
  }, UPDATE_INTERVAL);
}

// استدعاء initApp عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initApp);

/** تحميل البيانات من localStorage أو JSON */
async function loadData() {
  try {
    console.log('بدء تحميل البيانات...');
  const storedData = localStorage.getItem(STORAGE_KEY);
    
  if (storedData) {
      console.log('تم العثور على بيانات مخزنة محلياً');
      try {
        const parsedData = JSON.parse(storedData);
        console.log('تم تحليل البيانات المخزنة بنجاح');
        
        // التحقق من صحة البيانات المخزنة
        if (parsedData && parsedData.categories && Array.isArray(parsedData.rawServices)) {
          return parsedData;
  } else {
          console.warn('البيانات المخزنة غير مكتملة، سيتم تحميل البيانات من الملف');
        }
      } catch (parseError) {
        console.error('خطأ في تحليل البيانات المخزنة:', parseError);
        // حذف البيانات المخزنة غير الصالحة
        localStorage.removeItem(STORAGE_KEY);
        // المتابعة لتحميل البيانات من الملف
      }
    }
    
    console.log('جاري تحميل البيانات من الملف...');
    
    // محاولة تحميل البيانات بأكثر من طريقة للتوافق مع مختلف الخوادم
    let data = null;
    
    // محاولة أولى باستخدام المسار النسبي المطلق
    try {
      const response = await fetch('/servicesData.json');
      if (response.ok) {
        data = await response.json();
        console.log('تم جلب البيانات من المسار: /servicesData.json');
      }
    } catch (error) {
      console.warn('فشل في تحميل البيانات من المسار: /servicesData.json -', error.message);
    }
    
    // إذا فشلت المحاولة الأولى، حاول باستخدام المسار النسبي
    if (!data) {
      try {
        const response = await fetch('./servicesData.json');
        if (response.ok) {
          data = await response.json();
          console.log('تم جلب البيانات من المسار: ./servicesData.json');
        }
      } catch (error) {
        console.warn('فشل في تحميل البيانات من المسار: ./servicesData.json -', error.message);
      }
    }
    
    // إذا فشلت المحاولة الثانية، حاول باستخدام مسار نسبي آخر
    if (!data) {
      try {
        const response = await fetch('../servicesData.json');
        if (response.ok) {
          data = await response.json();
          console.log('تم جلب البيانات من المسار: ../servicesData.json');
        }
      } catch (error) {
        console.warn('فشل في تحميل البيانات من المسار: ../servicesData.json -', error.message);
      }
    }
    
    // إذا فشلت جميع المحاولات، ارجع خطأ
    if (!data) {
      throw new Error('فشل في تحميل البيانات من جميع المسارات المحتملة');
    }
    
    console.log('تم جلب البيانات من الملف بنجاح');
    
    // التحقق من صحة البيانات قبل تخزينها
    if (data && data.categories && Array.isArray(data.rawServices)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    } else {
      throw new Error('البيانات التي تم تحميلها غير مكتملة أو غير صحيحة');
    }
  } catch (error) {
    console.error('فشل في تحميل البيانات:', error);
    // محاولة تحميل نسخة احتياطية مبسطة من البيانات
    return {
        categories: {},
      services: [],
      rawServices: [],
      serviceLinks: []
      };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalData));
}

/** توسيع/طي أقسام الصفحة */
function toggleSection(sectionId) {
  try {
    console.log('تبديل حالة القسم:', sectionId);
  const section = document.getElementById(sectionId);
    
    if (!section) {
      console.error('لم يتم العثور على القسم:', sectionId);
      return;
    }
    
    if (section.classList.contains('open')) {
      console.log('إغلاق القسم:', sectionId);
      section.classList.remove('open');
    } else {
      console.log('فتح القسم:', sectionId);
      section.classList.add('open');
    }
  } catch (error) {
    console.error('خطأ في تبديل حالة القسم:', error);
  }
}

/** =========== قسم إضافة التصنيفات =========== **/

// تعبئة القائمة الرئيسية لإضافة فرعي
function populateMainCatForAddSub() {
  const selectEl = document.getElementById('selectMainCatForAddSub');
  selectEl.innerHTML = '';
  const mainCatKeys = Object.keys(globalData.categories);
  mainCatKeys.forEach(catKey => {
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
  const subCats = globalData.categories[mainCatVal].subCategories || {};
  Object.keys(subCats).forEach(subKey => {
    const option = document.createElement('option');
    option.value = subKey;
    option.textContent = subKey;
    subEl.appendChild(option);
  });
}

/** قسم إدارة التصنيفات **/
function populateMainCatSelect() {
  const selectMainCat = document.getElementById('selectMainCat');
  selectMainCat.innerHTML = '';
  const mainCatKeys = Object.keys(globalData.categories);
  mainCatKeys.forEach(catKey => {
    const option = document.createElement('option');
    option.value = catKey;
    option.textContent = catKey;
    selectMainCat.appendChild(option);
  });
}

function updateSubCats() {
  const mainCatVal = document.getElementById('mainCatSelect').value;
  const subCatSelect = document.getElementById('subCatSelect');
  
  updateSubCategorySelect(
    mainCatVal,
    subCatSelect,
    '-- اختر تصنيف فرعي --',
    '',
    updateSubSubCats
  );
}

function updateSubSubCats() {
  const mainCatVal = document.getElementById('mainCatSelect').value;
  const subCatVal = document.getElementById('subCatSelect').value;
  const subSubCatSelect = document.getElementById('subSubCatSelect');
  
  updateSubSubCategorySelect(
    mainCatVal,
    subCatVal,
    subSubCatSelect,
    '-- اختر الباقة --'
  );
}

/** إضافة تصنيف رئيسي/فرعي/فرعي للفرعي **/
function addMainCategory() {
  const newMainCat = document.getElementById('newMainCat').value.trim();
  if (!newMainCat) {
    showToast('الرجاء إدخال اسم التصنيف الرئيسي', true);
    return;
  }
  if (globalData.categories[newMainCat]) {
    showToast('هذا التصنيف موجود مسبقًا', true);
    return;
  }
  globalData.categories[newMainCat] = { subCategories: {} };
  saveData();

  // تحديث الواجهات
  populateMainCatForAddSub();
  populateMainCatSelect();
  populateServiceSelectors();
  populateLinkCategorySelectors();

  document.getElementById('newMainCat').value = '';
  showToast('تمت إضافة التصنيف الرئيسي بنجاح');
}

function addSubCat() {
  const mainCatVal = document.getElementById('selectMainCatForAddSub').value;
  if (!mainCatVal) {
    showToast('اختر تصنيفًا رئيسيًا أولاً', true);
    return;
  }
  const newSubCat = document.getElementById('newSubCat').value.trim();
  if (!newSubCat) {
    showToast('الرجاء إدخال اسم التصنيف الفرعي', true);
    return;
  }
  const subCats = globalData.categories[mainCatVal].subCategories;
  if (subCats[newSubCat]) {
    showToast('التصنيف الفرعي موجود مسبقًا', true);
    return;
  }
  subCats[newSubCat] = { subSubCategories: [] };
  saveData();

  populateSubCatForAddSubSub();
  updateSubCats();
  populateServiceSelectors();

  document.getElementById('newSubCat').value = '';
  showToast('تمت إضافة التصنيف الفرعي بنجاح');
}

function addSubSubCat() {
  const mainCatVal = document.getElementById('selectMainCatForAddSub').value;
  const subCatVal = document.getElementById('selectSubCatForAddSubSub').value;
  if (!mainCatVal || !subCatVal) {
    showToast('اختر تصنيفًا رئيسيًا وفرعيًا', true);
    return;
  }
  const newSubSubCat = document.getElementById('newSubSubCat').value.trim();
  if (!newSubSubCat) {
    showToast('الرجاء إدخال اسم الباقة', true);
    return;
  }
  const subSubs = globalData.categories[mainCatVal].subCategories[subCatVal].subSubCategories;
  if (subSubs.includes(newSubSubCat)) {
    showToast('هذه الباقة موجودة مسبقًا', true);
    return;
  }
  subSubs.push(newSubSubCat);
  saveData();

  populateSubCatForAddSubSub();
  updateSubSubCats();
  populateServiceSelectors();

  document.getElementById('newSubSubCat').value = '';
  showToast('تمت إضافة الباقة بنجاح');
}

/** حذف/تعديل التصنيفات **/
function deleteMainCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  if (!mainCatVal) return;
  if (!confirm('هل أنت متأكد من حذف التصنيف الرئيسي وجميع التصنيفات الفرعية بداخله؟')) return;
  delete globalData.categories[mainCatVal];
  saveData();
  populateMainCatForAddSub();
  populateMainCatSelect();
  populateServiceSelectors();
  document.getElementById('selectSubCat').innerHTML = '';
  document.getElementById('selectSubSubCat').innerHTML = '';
  showToast('تم حذف التصنيف الرئيسي بنجاح');
}

function renameMainCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  if (!mainCatVal) return;
  const newName = prompt('أدخل الاسم الجديد للتصنيف الرئيسي:', mainCatVal);
  if (!newName || !newName.trim()) return;
  if (globalData.categories[newName]) {
    showToast('التصنيف الجديد موجود مسبقًا', true);
    return;
  }
  globalData.categories[newName] = globalData.categories[mainCatVal];
  delete globalData.categories[mainCatVal];
  saveData();
  populateMainCatForAddSub();
  populateMainCatSelect();
  populateServiceSelectors();
  showToast('تم تعديل التصنيف الرئيسي بنجاح');
}

function deleteSubCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatVal = document.getElementById('selectSubCat').value;
  if (!mainCatVal || !subCatVal) return;
  if (!confirm('هل أنت متأكد من حذف التصنيف الفرعي وجميع الباقات داخله؟')) return;
  delete globalData.categories[mainCatVal].subCategories[subCatVal];
  saveData();
  updateSubCats();
  populateSubCatForAddSubSub();
  populateServiceSelectors();
  showToast('تم حذف التصنيف الفرعي بنجاح');
}

function renameSubCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatVal = document.getElementById('selectSubCat').value;
  if (!mainCatVal || !subCatVal) return;
  const newName = prompt('أدخل الاسم الجديد للتصنيف الفرعي:', subCatVal);
  if (!newName || !newName.trim()) return;
  const subCats = globalData.categories[mainCatVal].subCategories;
  if (subCats[newName]) {
    showToast('التصنيف الفرعي الجديد موجود مسبقًا', true);
    return;
  }
  subCats[newName] = subCats[subCatVal];
  delete subCats[subCatVal];
  saveData();
  updateSubCats();
  populateSubCatForAddSubSub();
  populateServiceSelectors();
  showToast('تم تعديل التصنيف الفرعي بنجاح');
}

function deleteSubSubCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatVal = document.getElementById('selectSubCat').value;
  const subSubCatVal = document.getElementById('selectSubSubCat').value;
  if (!mainCatVal || !subCatVal || !subSubCatVal) return;
  if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
  const subSubs = globalData.categories[mainCatVal].subCategories[subCatVal].subSubCategories;
  const idx = subSubs.indexOf(subSubCatVal);
  if (idx !== -1) {
    subSubs.splice(idx, 1);
    saveData();
    updateSubSubCats();
    populateServiceSelectors();
    showToast('تم حذف التصنيف الفرعي للفرعي بنجاح');
  }
}

function renameSubSubCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatVal = document.getElementById('selectSubCat').value;
  const subSubCatVal = document.getElementById('selectSubSubCat').value;
  if (!mainCatVal || !subCatVal || !subSubCatVal) return;
  const newName = prompt('أدخل الاسم الجديد للباقة:', subSubCatVal);
  if (!newName || !newName.trim()) return;
  const subSubs = globalData.categories[mainCatVal].subCategories[subCatVal].subSubCategories;
  if (subSubs.includes(newName)) {
    showToast('الباقة الجديدة موجودة مسبقًا', true);
    return;
  }
  const idx = subSubs.indexOf(subSubCatVal);
  if (idx !== -1) {
    subSubs[idx] = newName;
    saveData();
    updateSubSubCats();
    populateServiceSelectors();
    showToast('تم تعديل الاسم بنجاح');
  }
}

/** =========== إدارة الخدمات =========== **/

/** عرض الخدمات المرتبطة بالتصنيفات */
function renderServices() {
  try {
    console.log('بدء عرض الخدمات المرتبطة بالتصنيفات...');
  const servicesGrid = document.getElementById('servicesGrid');
    if (!servicesGrid) {
      console.error('لم يتم العثور على عنصر servicesGrid');
      return;
    }
    
  servicesGrid.innerHTML = '';

    // التحقق من وجود الخدمات المفلترة
    if (!filteredServices || !Array.isArray(filteredServices)) {
      console.warn('مصفوفة filteredServices غير معرفة أو ليست مصفوفة');
      filteredServices = [...globalData.services];
    }
    
    console.log('عدد الخدمات للعرض:', filteredServices.length);
  
    // عرض رسالة إذا لم تكن هناك خدمات للعرض
    if (filteredServices.length === 0) {
      servicesGrid.innerHTML = '<div style="text-align: center; padding: 20px; width: 100%; grid-column: 1 / -1;"><p>لا توجد خدمات مرتبطة بالتصنيفات للعرض. يمكنك ربط الخدمات بالتصنيفات من قسم "ربط الخدمات بالتصنيفات".</p></div>';
      
      // محاولة تحديث الخدمات من الروابط مرة أخرى
      if (globalData && Array.isArray(globalData.serviceLinks) && globalData.serviceLinks.length > 0) {
        console.log('محاولة تحديث الخدمات من الروابط مرة أخرى...');
        updateServicesFromLinks();
        return;
      }
      
      return;
    }
  
    // عرض الخدمات
  filteredServices.forEach(service => {
      try {
        if (!service) return; // تخطي الخدمات الفارغة
        
    const card = document.createElement('div');
    card.className = 'serviceCard';
        
        // التأكد من أن الخدمة مرتبطة بتصنيف (من مصفوفة services)
        if (service.mainCategory) {
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
        }
      } catch (cardError) {
        console.error('خطأ في إنشاء بطاقة الخدمة:', cardError, service);
      }
    });
    
    console.log('تم عرض الخدمات المرتبطة بالتصنيفات بنجاح');
  } catch (error) {
    console.error('خطأ في عرض الخدمات:', error);
    showToast('حدث خطأ أثناء عرض الخدمات: ' + error.message, true);
  }
}

/** البحث عن الخدمة بالاسم أو الرمز */
function filterServices() {
  try {
    console.log('بدء تصفية الخدمات المرتبطة بالتصنيفات...');
    const searchInput = document.getElementById('searchServiceInput');
    
    if (!searchInput) {
      console.error('لم يتم العثور على عنصر searchServiceInput');
      return;
    }
    
    const searchVal = searchInput.value.toLowerCase().trim();
    console.log('قيمة البحث:', searchVal);
    
    // التأكد من وجود مصفوفة الخدمات
    if (!globalData || !Array.isArray(globalData.services)) {
      console.error('مصفوفة الخدمات غير موجودة أو غير صالحة');
      filteredServices = [];
      renderServices();
      return;
    }
    
  if (!searchVal) {
      // إذا كان البحث فارغاً، عرض جميع الخدمات
    filteredServices = [...globalData.services];
      console.log('لا توجد قيمة بحث، عرض جميع الخدمات:', filteredServices.length);
  } else {
      // تصفية الخدمات حسب البحث
      filteredServices = globalData.services.filter(service => {
        if (!service) return false;
        
        // البحث في الاسم
        if (service.name && service.name.toLowerCase().includes(searchVal)) {
          return true;
        }
        
        // البحث في رمز الخدمة
        if (service.id && service.id.toString().includes(searchVal)) {
          return true;
        }
        
        // البحث في المزود
        if (service.provider && service.provider.toLowerCase().includes(searchVal)) {
          return true;
        }
        
        // البحث في التصنيف الرئيسي
        if (service.mainCategory && service.mainCategory.toLowerCase().includes(searchVal)) {
          return true;
        }
        
        // البحث في التصنيف الفرعي
        if (service.subCategory && service.subCategory.toLowerCase().includes(searchVal)) {
          return true;
        }
        
        // البحث في الباقة
        if (service.subSubCategory && service.subSubCategory.toLowerCase().includes(searchVal)) {
          return true;
        }
        
        return false;
      });
      console.log('تم تصفية الخدمات بناءً على البحث:', filteredServices.length);
    }
    
    console.log('تم تصفية الخدمات، العدد الناتج:', filteredServices.length);
  renderServices();
  } catch (error) {
    console.error('خطأ في تصفية الخدمات:', error);
    showToast('حدث خطأ أثناء تصفية الخدمات: ' + error.message, true);
  }
}

/** إضافة خدمة جديدة */
function populateServiceSelectors() {
  const addMainCatSel = document.getElementById('addMainCatSel');
  addMainCatSel.innerHTML = '';
  const mainCatKeys = Object.keys(globalData.categories);
  mainCatKeys.forEach(catKey => {
    const option = document.createElement('option');
    option.value = catKey;
    option.textContent = catKey;
    addMainCatSel.appendChild(option);
  });
  updateAddSubCatSel();
}

function updateAddSubCatSel() {
  const addMainCatVal = document.getElementById('addMainCatSel').value;
  const addSubCatSel = document.getElementById('addSubCatSel');
  addSubCatSel.innerHTML = '';

  if (!addMainCatVal || !globalData.categories[addMainCatVal]) return;
  const subCats = globalData.categories[addMainCatVal].subCategories || {};
  Object.keys(subCats).forEach(subKey => {
    const option = document.createElement('option');
    option.value = subKey;
    option.textContent = subKey;
    addSubCatSel.appendChild(option);
  });
  updateAddSubSubCatSel();
}

function updateAddSubSubCatSel() {
  const addMainCatVal = document.getElementById('addMainCatSel').value;
  const addSubCatVal = document.getElementById('addSubCatSel').value;
  const addSubSubCatSel = document.getElementById('addSubSubCatSel');
  addSubSubCatSel.innerHTML = '';

  if (!addMainCatVal || !addSubCatVal) return;
  const subSubs = globalData.categories[addMainCatVal].subCategories[addSubCatVal].subSubCategories || [];
  subSubs.forEach(ssc => {
    const option = document.createElement('option');
    option.value = ssc;
    option.textContent = ssc;
    addSubSubCatSel.appendChild(option);
  });
}

function addService() {
  // تنبيه: هذه الوظيفة تستخدم الطريقة القديمة لإضافة الخدمات
  // يفضل استخدام النظام الجديد (إضافة خدمة خام ثم ربطها بالتصنيفات)
  // تم الاحتفاظ بهذه الوظيفة للتوافق مع الإصدارات السابقة فقط
  
  const mainCat = document.getElementById('addMainCatSel').value;
  const subCat = document.getElementById('addSubCatSel').value;
  const subSubCat = document.getElementById('addSubSubCatSel').value;
  const serviceName = document.getElementById('addServiceName').value.trim();
  const serviceId = Number(document.getElementById('addServiceId').value);
  const quantity = Number(document.getElementById('addQuantity').value);
  const provider = document.getElementById('addProvider').value;

  if (!serviceName || !serviceId || !mainCat || !subCat) {
    showToast('الرجاء تعبئة الحقول المطلوبة', true);
    return;
  }

  // تحقق من عدم وجود رمز خدمة مكرر ضمن نفس (mainCat/subCat/subSubCat)
  const exists = globalData.services.find(s => 
    s.id === serviceId &&
    s.mainCategory === mainCat &&
    s.subCategory === subCat &&
    s.subSubCategory === subSubCat
  );
  if (exists) {
    showToast('هناك خدمة بنفس الرمز ضمن نفس التصنيف/الباقة', true);
    return;
  }

  // التحقق من وجود الخدمة الخام
  let rawService = globalData.rawServices.find(s => s.id === serviceId && s.provider === provider);
  
  // إذا لم تكن الخدمة الخام موجودة، نقوم بإنشائها
  if (!rawService) {
    rawService = {
    id: serviceId,
    provider: provider,
      defaultName: serviceName.split(' ')[0] // استخدام الكلمة الأولى من الاسم كاسم افتراضي
    };
    globalData.rawServices.push(rawService);
  }
  
  // إنشاء رابط الخدمة
  const newLink = {
    rawServiceId: serviceId,
    mainCategory: mainCat,
    subCategory: subCat,
    subSubCategory: subSubCat,
    name: serviceName,
    quantity: quantity
  };
  
  globalData.serviceLinks.push(newLink);
  
  // تحديث مصفوفة الخدمات
  updateServicesFromLinks();
  
  saveData();
  showToast('تمت إضافة الخدمة بنجاح');

  document.getElementById('addServiceName').value = '';
  document.getElementById('addServiceId').value = '';
  document.getElementById('addQuantity').value = '';

  // تحديث العرض
  filteredRawServices = [...globalData.rawServices];
  renderServices();
}

/** تعديل/حذف خدمة */
function deleteService(serviceId, mainCategory, subCategory, subSubCategory) {
  if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
  
  // قد تكون هناك عدة خدمات بنفس الـID لكن في تصنيفات مختلفة
  const index = globalData.services.findIndex(s => 
    s.id === serviceId && 
    s.mainCategory === mainCategory && 
    s.subCategory === subCategory && 
    s.subSubCategory === subSubCategory
  );
  
  if (index !== -1) {
    globalData.services.splice(index, 1);
    saveData();
    showToast('تم حذف الخدمة بنجاح');
    filterServices();
  }
}

let currentEditServiceId = null;
let currentEditMainCategory = null;
let currentEditSubCategory = null;
let currentEditSubSubCategory = null;

function editService(serviceId, mainCategory, subCategory, subSubCategory) {
  currentEditServiceId = serviceId;
  currentEditMainCategory = mainCategory;
  currentEditSubCategory = subCategory;
  currentEditSubSubCategory = subSubCategory;
  
  const service = globalData.services.find(s => 
    s.id === serviceId && 
    s.mainCategory === mainCategory && 
    s.subCategory === subCategory && 
    s.subSubCategory === subSubCategory
  );
  
  if (!service) return;

  // البحث عن رابط الخدمة المقابل
  const serviceLink = globalData.serviceLinks.find(link => 
    link.rawServiceId === serviceId && 
    link.mainCategory === mainCategory && 
    link.subCategory === subCategory && 
    link.subSubCategory === subSubCategory
  );

  if (!serviceLink) {
    console.error('لم يتم العثور على رابط الخدمة');
    return;
  }

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
  
  // تعبئة قائمة الخدمات الخام
  populateEditRawServiceSelect(serviceId);
  
  // تعبئة قوائم التصنيفات
  populateEditMainCategorySelect(mainCategory);
  updateEditSubCategorySelect(mainCategory, subCategory);
  updateEditSubSubCategorySelect(mainCategory, subCategory, subSubCategory);
  
  // إضافة مستمعي الأحداث للقوائم المنسدلة
  document.getElementById('editMainCategorySelect').addEventListener('change', function() {
    const selectedMainCat = this.value;
    updateEditSubCategorySelect(selectedMainCat, '');
  });
  
  document.getElementById('editSubCategorySelect').addEventListener('change', function() {
    const selectedMainCat = document.getElementById('editMainCategorySelect').value;
    const selectedSubCat = this.value;
    updateEditSubSubCategorySelect(selectedMainCat, selectedSubCat, '');
  });
  
  modalOverlay.style.display = 'flex';
}

// تعبئة قائمة الخدمات الخام في نموذج التعديل
function populateEditRawServiceSelect(currentRawServiceId) {
  const select = document.getElementById('editRawServiceSelect');
  select.innerHTML = '';
  
  if (!globalData || !Array.isArray(globalData.rawServices)) return;
  
  globalData.rawServices.forEach(rawService => {
    const option = document.createElement('option');
    option.value = rawService.id;
    option.textContent = `${rawService.id} - ${rawService.defaultName}`;
    option.selected = rawService.id === currentRawServiceId;
    select.appendChild(option);
  });
}

// تعبئة قائمة التصنيفات الرئيسية في نموذج التعديل
function populateEditMainCategorySelect(currentMainCategory) {
  const select = document.getElementById('editMainCategorySelect');
  select.innerHTML = '';
  
  if (!globalData || !globalData.categories) return;
  
  Object.keys(globalData.categories).forEach(mainCat => {
    const option = document.createElement('option');
    option.value = mainCat;
    option.textContent = mainCat;
    option.selected = mainCat === currentMainCategory;
    select.appendChild(option);
  });
}

// تحديث قائمة التصنيفات الفرعية عند تعديل خدمة
function updateEditSubCategorySelect(mainCategory, currentSubCategory) {
  const editSubCategorySelect = document.getElementById('editSubCategorySelect');
  
  updateSubCategorySelect(
    mainCategory,
    editSubCategorySelect,
    '-- اختر تصنيف فرعي --',
    currentSubCategory,
    () => {
      updateEditSubSubCategorySelect(mainCategory, editSubCategorySelect.value);
    }
  );
}

// تحديث قائمة التصنيفات الفرعية للفرعي في نموذج التعديل
function updateEditSubSubCategorySelect(mainCategory, subCategory, currentSubSubCategory) {
  const editSubSubCategorySelect = document.getElementById('editSubSubCategorySelect');
  
  updateSubSubCategorySelect(
    mainCategory,
    subCategory,
    editSubSubCategorySelect,
    '-- اختر الباقة --',
    currentSubSubCategory
  );
}

function saveEditService() {
  if (currentEditServiceId === null) return;

  // الحصول على القيم المحدثة من النموذج
  const newRawServiceId = Number(document.getElementById('editRawServiceSelect').value);
  const newMainCategory = document.getElementById('editMainCategorySelect').value;
  const newSubCategory = document.getElementById('editSubCategorySelect').value;
  const newSubSubCategory = document.getElementById('editSubSubCategorySelect').value;
  const newName = document.getElementById('editServiceName').value.trim();
  const newQty = Number(document.getElementById('editQuantity').value);
  
  if (!newName || !newRawServiceId || !newMainCategory || !newQty) {
    showToast('الرجاء تعبئة جميع الحقول المطلوبة', true);
    return;
  }
  
  // البحث عن الخدمة الخام الجديدة
  const rawService = globalData.rawServices.find(s => s.id === newRawServiceId);
  if (!rawService) {
    showToast('الخدمة الخام غير موجودة', true);
    return;
  }
  
  // البحث عن رابط الخدمة الحالي
  const serviceLinkIndex = globalData.serviceLinks.findIndex(link => 
    link.rawServiceId === currentEditServiceId && 
    link.mainCategory === currentEditMainCategory && 
    link.subCategory === currentEditSubCategory && 
    link.subSubCategory === currentEditSubSubCategory
  );
  
  if (serviceLinkIndex === -1) {
    showToast('لم يتم العثور على رابط الخدمة', true);
    return;
  }

  // تحديث رابط الخدمة
  globalData.serviceLinks[serviceLinkIndex] = {
    rawServiceId: newRawServiceId,
    mainCategory: newMainCategory,
    subCategory: newSubCategory,
    subSubCategory: newSubSubCategory,
    name: newName,
    quantity: newQty
  };
  
  // تحديث مصفوفة الخدمات من روابط الخدمات
  updateServicesFromLinks();

  saveData();
  closeModal();
  showToast('تم حفظ التعديلات بنجاح');
  filterServices();
}

function closeModal() {
  currentEditServiceId = null;
  currentEditMainCategory = null;
  currentEditSubCategory = null;
  currentEditSubSubCategory = null;
  currentEditRawServiceId = null;
  document.getElementById('modalOverlay').style.display = 'none';
}

/** Toast تصميم الرسائل */
function showToast(msg, isError=false) {
  const toast = document.getElementById('toast');
  toast.innerHTML = msg.replace(/\n/g, '<br>'); // دعم أسطر متعددة
  toast.classList.remove('error');
  if (isError) toast.classList.add('error');

  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 5000);
}

/** =========== قسم إدارة الخدمات الخام =========== **/

// إضافة خدمة خام جديدة
function addRawService() {
  const serviceId = Number(document.getElementById('rawServiceId').value);
  const provider = document.getElementById('rawServiceProvider').value;
  const defaultName = document.getElementById('rawServiceDefaultName').value.trim();

  if (!serviceId || !defaultName) {
    showToast('الرجاء تعبئة جميع الحقول المطلوبة', true);
    return;
  }

  // التحقق من عدم وجود خدمة خام بنفس الرقم والمزود
  const exists = globalData.rawServices.find(s => s.id === serviceId && s.provider === provider);
  if (exists) {
    showToast('هذه الخدمة موجودة مسبقاً', true);
    return;
  }

  const newRawService = {
    id: serviceId,
    provider: provider,
    defaultName: defaultName
  };

  globalData.rawServices.push(newRawService);
  saveData();
  showToast('تمت إضافة الخدمة بنجاح');

  // تفريغ الحقول
  document.getElementById('rawServiceId').value = '';
  document.getElementById('rawServiceDefaultName').value = '';

  // تحديث العرض والقوائم
  renderServices();
  populateRawServiceSelect();
}

/** تعديل خدمة خام */
function editRawService(serviceId) {
  try {
    console.log('بدء تعديل الخدمة الخام:', serviceId);
    
    // تحويل serviceId إلى رقم إذا كان نصيًا
    if (typeof serviceId === 'string') {
      serviceId = parseInt(serviceId, 10);
    }
    
    const serviceIndex = globalData.rawServices.findIndex(service => service.id === serviceId);
    
    if (serviceIndex === -1) {
      console.error('الخدمة الخام غير موجودة:', serviceId);
      showToast('الخدمة الخام غير موجودة', true);
      return;
    }
    
    const service = globalData.rawServices[serviceIndex];
    
    // استخدام نافذة منبثقة لتعديل الخدمة الخام
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
        <button class="editBtn" onclick="saveEditRawService(${serviceId})">حفظ</button>
        <button class="deleteBtn" onclick="closeModal()">إلغاء</button>
      </div>
    `;
    
    modalOverlay.style.display = 'flex';
    
  } catch (error) {
    console.error('خطأ في تعديل الخدمة الخام:', error);
    showToast('حدث خطأ أثناء تعديل الخدمة الخام: ' + error.message, true);
  }
}

/** حذف خدمة خام */
function deleteRawService(serviceId) {
  try {
    console.log('بدء حذف الخدمة الخام:', serviceId);
    
    // تحويل serviceId إلى رقم إذا كان نصيًا
    if (typeof serviceId === 'string') {
      serviceId = parseInt(serviceId, 10);
    }
    
    const serviceIndex = globalData.rawServices.findIndex(service => service.id === serviceId);
    
    if (serviceIndex === -1) {
      console.error('الخدمة الخام غير موجودة:', serviceId);
      showToast('الخدمة الخام غير موجودة', true);
      return;
    }
    
    // التحقق من الخدمة قبل الحذف
    const linksCount = countServiceLinks(serviceId);
    if (linksCount > 0) {
      if (!confirm(`هذه الخدمة مرتبطة بـ ${linksCount} تصنيف. هل أنت متأكد من حذفها؟ (سيتم حذف جميع الارتباطات أيضًا)`)) {
        console.log('تم إلغاء حذف الخدمة الخام');
        return;
      }
      
      // حذف الارتباطات
      globalData.serviceLinks = globalData.serviceLinks.filter(link => link.rawServiceId !== serviceId);
      console.log('تم حذف ارتباطات الخدمة الخام');
    }
    
    // حذف الخدمة الخام
    globalData.rawServices.splice(serviceIndex, 1);
    
    // تحديث المصفوفة المفلترة
    filteredRawServices = filteredRawServices.filter(service => service.id !== serviceId);
    
    // حفظ البيانات
    saveData();
    
    // تحديث العرض
    renderRawServices();
    renderServices();
    populateRawServiceSelect();
    
    console.log('تم حذف الخدمة الخام بنجاح');
    showToast('تم حذف الخدمة الخام بنجاح');
  } catch (error) {
    console.error('خطأ في حذف الخدمة الخام:', error);
    showToast('حدث خطأ أثناء حذف الخدمة الخام: ' + error.message, true);
  }
}

/** حساب عدد ارتباطات الخدمة الخام */
function countServiceLinks(rawServiceId) {
  return globalData.serviceLinks.filter(link => link.rawServiceId === rawServiceId).length;
}

/** =========== قسم ربط الخدمات بالتصنيفات =========== **/

/** تعبئة قائمة الخدمات الخام للربط */
function populateRawServiceSelect() {
  try {
    console.log('بدء تعبئة قائمة الخدمات الخام...');
    const selectRawService = document.getElementById('selectRawService');
    
    if (!selectRawService) {
      console.error('لم يتم العثور على عنصر selectRawService');
      return;
    }
    
    // حفظ القيمة المحددة حالياً إن وجدت
    const currentValue = selectRawService.value;
    
    // تفريغ القائمة
    selectRawService.innerHTML = '';
    
    // إضافة خيار فارغ
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- اختر خدمة --';
    selectRawService.appendChild(emptyOption);
    
    // التأكد من وجود مصفوفة الخدمات الخام
    if (!globalData || !Array.isArray(globalData.rawServices) || globalData.rawServices.length === 0) {
      console.warn('لا توجد خدمات خام لعرضها في القائمة');
      return;
    }
    
    // إضافة الخدمات الخام إلى القائمة
    globalData.rawServices.forEach(service => {
      try {
        if (!service || !service.id) return;
        
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = `${service.defaultName || 'بدون اسم'} (${service.id}) - ${service.provider || 'غير معروف'}`;
        selectRawService.appendChild(option);
      } catch (optionError) {
        console.error('خطأ في إضافة خيار للقائمة:', optionError, service);
      }
    });
    
    // إعادة تحديد القيمة السابقة إن وجدت
    if (currentValue) {
      selectRawService.value = currentValue;
    }
    
    // تحديث معلومات الخدمة المختارة
    updateSelectedRawServiceInfo();
    
    console.log('تم تعبئة قائمة الخدمات الخام بنجاح، عدد الخدمات:', globalData.rawServices.length);
  } catch (error) {
    console.error('خطأ في تعبئة قائمة الخدمات الخام:', error);
  }
}

// تحديث معلومات الخدمة الخام المختارة
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
  
  // عرض معلومات الخدمة
  infoBox.innerHTML = `
    <p><strong>رمز الخدمة:</strong> ${rawService.id}</p>
    <p><strong>المزود:</strong> ${rawService.provider === 'drd3m' ? 'دكتور دعم' : 'سيوكليفرز'}</p>
    <p><strong>الاسم الافتراضي:</strong> ${rawService.defaultName}</p>
    <p><strong>عدد الارتباطات الحالية:</strong> ${countServiceLinks(rawService.id)}</p>
  `;
  
  // اقتراح اسم للخدمة المرتبطة
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

// تعبئة قوائم التصنيفات لربط الخدمات
function populateLinkCategorySelectors() {
  const linkMainCatSel = document.getElementById('linkMainCatSel');
  if (!linkMainCatSel) return;
  
  linkMainCatSel.innerHTML = '';
  
  // إضافة خيار فارغ
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '-- اختر تصنيف --';
  linkMainCatSel.appendChild(emptyOption);
  
  // إضافة التصنيفات الرئيسية
  const mainCatKeys = Object.keys(globalData.categories);
  mainCatKeys.forEach(catKey => {
    const option = document.createElement('option');
    option.value = catKey;
    option.textContent = catKey;
    linkMainCatSel.appendChild(option);
  });
  
  updateLinkSubCatSel();
}

// تحديث قائمة التصنيفات الفرعية لربط الخدمات
function updateLinkSubCatSel() {
  const linkMainCatVal = document.getElementById('linkMainCatSel').value;
  const linkSubCatSel = document.getElementById('linkSubCatSel');
  
  updateSubCategorySelect(
    linkMainCatVal,
    linkSubCatSel,
    '-- اختر تصنيف فرعي --',
    '',
    () => {
      updateLinkSubSubCatSel();
      updateSelectedRawServiceInfo(); // تحديث اقتراح الاسم
    }
  );
}

// تحديث قائمة الباقات لربط الخدمات
function updateLinkSubSubCatSel() {
  const linkMainCatVal = document.getElementById('linkMainCatSel').value;
  const linkSubCatVal = document.getElementById('linkSubCatSel').value;
  const linkSubSubCatSel = document.getElementById('linkSubSubCatSel');
  
  updateSubSubCategorySelect(
    linkMainCatVal,
    linkSubCatVal,
    linkSubSubCatSel,
    '-- اختر الباقة --'
  );
  
  updateSelectedRawServiceInfo(); // تحديث اقتراح الاسم
}

// ربط خدمة خام بتصنيف
function linkServiceToCategory() {
  const rawServiceId = Number(document.getElementById('selectRawService').value);
  const mainCat = document.getElementById('linkMainCatSel').value;
  const subCat = document.getElementById('linkSubCatSel').value;
  const subSubCat = document.getElementById('linkSubSubCatSel').value;
  const serviceName = document.getElementById('linkServiceName').value.trim();
  const quantity = Number(document.getElementById('linkQuantity').value);
  
  if (!rawServiceId || !mainCat || !serviceName || !quantity) {
    showToast('الرجاء تعبئة الحقول المطلوبة: الخدمة، التصنيف الرئيسي، اسم الخدمة، والكمية', true);
    return;
  }
  
  // التحقق من وجود الخدمة الخام
  const rawService = globalData.rawServices.find(s => s.id === rawServiceId);
  if (!rawService) {
    showToast('الخدمة الخام غير موجودة', true);
    return;
  }
  
  // التحقق من عدم وجود ربط مماثل
  const exists = globalData.serviceLinks.find(link => 
    link.rawServiceId === rawServiceId &&
    link.mainCategory === mainCat &&
    link.subCategory === subCat &&
    link.subSubCategory === subSubCat
  );
  if (exists) {
    showToast('هذا الربط موجود مسبقاً', true);
    return;
  }
  
  // إنشاء الربط الجديد
  const newLink = {
    rawServiceId: rawServiceId,
    mainCategory: mainCat,
    subCategory: subCat || "", // استخدام قيمة فارغة إذا لم يتم اختيار تصنيف فرعي
    subSubCategory: subSubCat || "", // استخدام قيمة فارغة إذا لم يتم اختيار باقة
    name: serviceName,
    quantity: quantity
  };
  
  globalData.serviceLinks.push(newLink);
  
  // تحديث مصفوفة الخدمات من روابط الخدمات (للتوافق مع النظام القديم)
  updateServicesFromLinks();
  
  saveData();
  showToast('تم ربط الخدمة بالتصنيف بنجاح');
  
  // تفريغ الحقول
  document.getElementById('linkQuantity').value = '';
  
  // تحديث العرض
  filterServices();
}

// تحديث مصفوفة الخدمات من روابط الخدمات (للتوافق مع النظام القديم)
function updateServicesFromLinks() {
  try {
    console.log('بدء تحديث الخدمات من روابط الخدمات...');
    
    // التحقق من وجود البيانات اللازمة
    if (!globalData || !Array.isArray(globalData.serviceLinks) || !Array.isArray(globalData.rawServices)) {
      console.error('البيانات غير متوفرة لتحديث الخدمات من الروابط');
      return;
    }
    
    console.log('عدد روابط الخدمات:', globalData.serviceLinks.length);
    console.log('عدد الخدمات الخام:', globalData.rawServices.length);
    
    // إفراغ مصفوفة الخدمات
    globalData.services = [];
    
    // إعادة بناء مصفوفة الخدمات من روابط الخدمات
    globalData.serviceLinks.forEach(link => {
      const rawService = globalData.rawServices.find(s => s.id === link.rawServiceId);
      if (!rawService) {
        console.warn('لم يتم العثور على الخدمة الخام بالرمز:', link.rawServiceId);
        return;
      }
      
      const service = {
        id: rawService.id,
        mainCategory: link.mainCategory,
        subCategory: link.subCategory,
        subSubCategory: link.subSubCategory,
        name: link.name,
        quantity: link.quantity,
        provider: rawService.provider
      };
      
      globalData.services.push(service);
    });
    
    console.log('تم تحديث الخدمات، العدد الجديد:', globalData.services.length);
    
    // تحديث filteredServices
    filteredServices = [...globalData.services];
    
    // حفظ البيانات المحدثة
    saveData();
    
    // إعادة عرض الخدمات
    renderServices();
    
    console.log('تم تحديث الخدمات من روابط الخدمات بنجاح');
  } catch (error) {
    console.error('خطأ في تحديث الخدمات من روابط الخدمات:', error);
  }
}

// تحويل الخدمات الحالية إلى النظام الجديد (خدمات خام وروابط)
function migrateToNewSystem() {
  // التحقق من وجود بيانات للتحويل
  if (globalData.rawServices.length > 0 || globalData.serviceLinks.length > 0) {
    return; // تم التحويل مسبقاً
  }
  
  // إنشاء مجموعة من الخدمات الخام الفريدة
  const uniqueRawServices = new Map();
  
  globalData.services.forEach(service => {
    const key = `${service.id}-${service.provider}`;
    if (!uniqueRawServices.has(key)) {
      uniqueRawServices.set(key, {
        id: service.id,
        provider: service.provider,
        defaultName: service.name.split(' ')[0] // استخدام الكلمة الأولى من الاسم كاسم افتراضي
      });
    }
  });
  
  // تحويل المجموعة إلى مصفوفة
  globalData.rawServices = Array.from(uniqueRawServices.values());
  
  // إنشاء روابط الخدمات
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

/** تصدير البيانات */
function exportData() {
  // إنشاء نسخة من البيانات للتصدير
  const exportData = {
    categories: globalData.categories,
    services: globalData.services,
    rawServices: globalData.rawServices,
    serviceLinks: globalData.serviceLinks
  };
  
  // تحويل البيانات إلى نص JSON
  const jsonStr = JSON.stringify(exportData, null, 2);
  
  // إنشاء رابط تنزيل
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // إنشاء عنصر رابط وهمي للتنزيل
  const a = document.createElement('a');
  a.href = url;
  a.download = 'servicesData.json';
  document.body.appendChild(a);
  a.click();
  
  // تنظيف
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
  
  showToast('تم تصدير البيانات بنجاح');
}

/** تهيئة الصفحة */
async function init() {
  try {
    console.log('بدء تهيئة الصفحة...');
    
    // محاولة تحميل البيانات
  globalData = await loadData();
    console.log('تم تحميل البيانات:', globalData);
    
    // التحقق من وجود البيانات الأساسية
    if (!globalData || !globalData.categories || !globalData.rawServices) {
      throw new Error('البيانات المحملة غير مكتملة أو غير صحيحة');
    }
    
    // التأكد من وجود serviceLinks
    if (!globalData.serviceLinks) {
      console.warn('لم يتم العثور على serviceLinks، سيتم إنشاء مصفوفة فارغة');
      globalData.serviceLinks = [];
    }
    
    // تحويل البيانات إلى النظام الجديد إذا لزم الأمر
    migrateToNewSystem();
    
    // تحديث مصفوفة الخدمات من روابط الخدمات (للتوافق مع النظام القديم)
    console.log('تحديث الخدمات من روابط الخدمات...');
    updateServicesFromLinks();
    
    // تهيئة التصنيفات
    console.log('جاري تهيئة التصنيفات...');
    populateMainCategorySelects();
    
    // تهيئة الخدمات
    console.log('عدد الخدمات الخام:', globalData.rawServices.length);
    console.log('عدد روابط الخدمات:', globalData.serviceLinks.length);
    console.log('عدد الخدمات المحدثة:', globalData.services.length);
    
    // التأكد من أن مصفوفات الخدمات المفلترة موجودة
    if (!Array.isArray(globalData.rawServices)) {
      globalData.rawServices = [];
      console.warn('تم إنشاء مصفوفة خدمات خام فارغة لأنها غير موجودة');
    }
    
    if (!Array.isArray(globalData.services)) {
      globalData.services = [];
      console.warn('تم إنشاء مصفوفة خدمات فارغة لأنها غير موجودة');
    }
    
    // تهيئة مصفوفات الخدمات المفلترة
    filteredRawServices = [...globalData.rawServices];
    filteredServices = [...globalData.services];
    
    console.log('تم تهيئة filteredRawServices:', filteredRawServices.length);
    console.log('تم تهيئة filteredServices:', filteredServices.length);
    
    // عرض الخدمات المرتبطة بالتصنيفات
    renderServices();
    
    // عرض الخدمات الخام
    renderRawServices();
    
    // تهيئة قائمة الخدمات الخام للربط
    populateRawServiceSelect();
    
    // تهيئة قوائم التصنيفات للربط
    try {
      populateLinkCategorySelectors();
    } catch (error) {
      console.error('خطأ في تهيئة قوائم التصنيفات للربط:', error);
    }
    
    // تأكد من أن جميع الأقسام مغلقة افتراضيًا
    // إزالة الكود الذي يفتح الأقسام تلقائيًا
    // ملاحظة: لا نفتح أي قسم افتراضيًا، المستخدم سيقوم بفتح ما يريد
    
    // تم حذف رسائل "تم تهيئة الصفحة بنجاح" بناءً على طلب المستخدم
  } catch (error) {
    console.error('خطأ في تهيئة الصفحة:', error);
    showToast('حدث خطأ أثناء تهيئة الصفحة: ' + error.message, true);
  }
}

/** عرض الخدمات الخام */
function renderRawServices() {
  try {
    console.log('بدء عرض الخدمات الخام...');
    const rawServicesGrid = document.getElementById('rawServicesGrid');
    if (!rawServicesGrid) {
      console.error('لم يتم العثور على عنصر rawServicesGrid');
      return;
    }
    
    // تفريغ محتوى العنصر قبل إضافة الخدمات الجديدة
    rawServicesGrid.innerHTML = '';
    
    // التحقق من وجود الخدمات المفلترة
    if (!Array.isArray(filteredRawServices) || filteredRawServices.length === 0) {
      console.warn('مصفوفة filteredRawServices غير معرفة أو فارغة');
      
      // التحقق من وجود الخدمات الخام في globalData
      if (!Array.isArray(globalData.rawServices) || globalData.rawServices.length === 0) {
        console.warn('لا توجد خدمات خام في globalData');
        rawServicesGrid.innerHTML = '<div style="text-align: center; padding: 20px; width: 100%; grid-column: 1 / -1;"><p>لا توجد خدمات خام للعرض. يمكنك إضافة خدمات خام جديدة من قسم "إضافة خدمة جديدة".</p></div>';
        return;
      }
      
      // إعادة تعيين filteredRawServices من globalData
      filteredRawServices = [...globalData.rawServices];
      console.log('تمت إعادة تعيين filteredRawServices من globalData:', filteredRawServices.length);
    }
    
    console.log('عدد الخدمات الخام للعرض:', filteredRawServices.length);
  
    // عرض رسالة إذا لم تكن هناك خدمات للعرض
    if (filteredRawServices.length === 0) {
      rawServicesGrid.innerHTML = '<div style="text-align: center; padding: 20px; width: 100%; grid-column: 1 / -1;"><p>لا توجد خدمات خام للعرض. يمكنك إضافة خدمات خام جديدة من قسم "إضافة خدمة جديدة".</p></div>';
      return;
    }
  
    // عرض الخدمات الخام
    filteredRawServices.forEach(service => {
      try {
        if (!service) return; // تخطي الخدمات الفارغة
        
        const card = document.createElement('div');
        card.className = 'serviceCard';
        
        // تمييز الخدمات الخام بلون مختلف
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
      } catch (cardError) {
        console.error('خطأ في إنشاء بطاقة الخدمة الخام:', cardError, service);
      }
    });
    
    console.log('تم عرض الخدمات الخام بنجاح');
  } catch (error) {
    console.error('خطأ في عرض الخدمات الخام:', error);
    showToast('حدث خطأ أثناء عرض الخدمات الخام: ' + error.message, true);
  }
}

/** البحث عن الخدمة الخام بالاسم أو الرمز */
function filterRawServices() {
  try {
    console.log('بدء تصفية الخدمات الخام...');
    const searchInput = document.getElementById('searchRawServiceInput');
    
    if (!searchInput) {
      console.error('لم يتم العثور على عنصر searchRawServiceInput');
      return;
    }
    
    const searchVal = searchInput.value.toLowerCase().trim();
    console.log('قيمة البحث للخدمات الخام:', searchVal);
    
    // التأكد من وجود مصفوفة الخدمات الخام
    if (!globalData || !Array.isArray(globalData.rawServices)) {
      console.error('مصفوفة الخدمات الخام غير موجودة أو غير صالحة');
      filteredRawServices = [];
      renderRawServices();
      return;
    }
    
    if (!searchVal) {
      // إذا كان البحث فارغاً، عرض جميع الخدمات الخام
      filteredRawServices = [...globalData.rawServices];
      console.log('لا توجد قيمة بحث، عرض جميع الخدمات الخام:', filteredRawServices.length);
    } else {
      // تصفية الخدمات الخام حسب البحث
      filteredRawServices = globalData.rawServices.filter(service => {
        if (!service) return false;
        
        // البحث في الاسم الافتراضي
        if (service.defaultName && service.defaultName.toLowerCase().includes(searchVal)) {
          return true;
        }
        
        // البحث في رمز الخدمة
        if (service.id && service.id.toString().includes(searchVal)) {
          return true;
        }
        
        // البحث في المزود
        if (service.provider && service.provider.toLowerCase().includes(searchVal)) {
          return true;
        }
        
        return false;
      });
      console.log('تم تصفية الخدمات الخام بناءً على البحث:', filteredRawServices.length);
    }
    
    console.log('تم تصفية الخدمات الخام، العدد الناتج:', filteredRawServices.length);
    renderRawServices();
  } catch (error) {
    console.error('خطأ في تصفية الخدمات الخام:', error);
    showToast('حدث خطأ أثناء تصفية الخدمات الخام: ' + error.message, true);
  }
}

/** تعبئة قوائم التصنيفات الرئيسية */
function populateMainCategorySelects() {
  // تعبئة قائمة التصنيفات الرئيسية لإضافة تصنيف فرعي
  populateMainCatForAddSub();

  // تعبئة قائمة التصنيفات الرئيسية لإدارة التصنيفات
  populateMainCatSelect();

  // تعبئة قائمة التصنيفات الرئيسية لإضافة خدمة
  populateServiceSelectors();

  // تعبئة قائمة التصنيفات الرئيسية لربط الخدمات
  populateLinkCategorySelectors();
  
  console.log('تم تعبئة قوائم التصنيفات الرئيسية');
}

/** عند تحميل الصفحة */
window.addEventListener('DOMContentLoaded', async () => {
  console.log('تم تحميل الصفحة، جاري تهيئة التطبيق...');
  
  try {
    // استدعاء دالة init لتهيئة الصفحة بشكل كامل
    await init();
    
    // عرض رسالة توضيحية حول النظام الجديد
    // تم حذف رسالة النظام الجديد بناءً على طلب المستخدم
    
    // ملاحظة: تمت إزالة الأسطر التي تفتح الأقسام تلقائيًا
    // للسماح للمستخدم بفتح الأقسام يدويًا حسب الحاجة
    
    // التأكد من تهيئة مصفوفات الخدمات المفلترة
    if (!filteredServices || !Array.isArray(filteredServices) || filteredServices.length === 0) {
      console.log('إعادة تهيئة filteredServices...');
      
      // التحقق من وجود الخدمات في globalData
      if (globalData && Array.isArray(globalData.services) && globalData.services.length > 0) {
  filteredServices = [...globalData.services];
        console.log('تم إعادة تهيئة filteredServices من globalData.services:', filteredServices.length);
      } else if (globalData && Array.isArray(globalData.serviceLinks) && globalData.serviceLinks.length > 0) {
        // محاولة تحديث الخدمات من الروابط
        console.log('محاولة تحديث الخدمات من الروابط...');
        updateServicesFromLinks();
      }
    }
    
    if (!filteredRawServices || !Array.isArray(filteredRawServices) || filteredRawServices.length === 0) {
      console.log('إعادة تهيئة filteredRawServices...');
      
      if (globalData && Array.isArray(globalData.rawServices) && globalData.rawServices.length > 0) {
        filteredRawServices = [...globalData.rawServices];
        console.log('تم إعادة تهيئة filteredRawServices:', filteredRawServices.length);
      }
    }
    
    // عرض جميع الخدمات مباشرة
  renderServices();
    
    // عرض جميع الخدمات الخام مباشرة
    renderRawServices();
    
    console.log('تم تهيئة وعرض الخدمات بنجاح');

  // ربط الأحداث
  document.getElementById('selectMainCatForAddSub').addEventListener('change', populateSubCatForAddSubSub);
  document.getElementById('addMainCatSel').addEventListener('change', updateAddSubCatSel);
  document.getElementById('addSubCatSel').addEventListener('change', updateAddSubSubCatSel);
    
    // ربط أحداث النظام الجديد
    document.getElementById('selectRawService').addEventListener('change', updateSelectedRawServiceInfo);
    document.getElementById('linkMainCatSel').addEventListener('change', updateLinkSubCatSel);
    document.getElementById('linkSubCatSel').addEventListener('change', updateLinkSubSubCatSel);
    document.getElementById('linkSubSubCatSel').addEventListener('change', updateSelectedRawServiceInfo);
    
    // ربط أحداث البحث
    document.getElementById('searchServiceInput').addEventListener('input', filterServices);
    document.getElementById('searchRawServiceInput').addEventListener('input', filterRawServices);
  } catch (error) {
    console.error('خطأ في تهيئة الصفحة عند التحميل:', error);
    showToast('حدث خطأ أثناء تهيئة الصفحة: ' + error.message, true);
  }
});

// تنفيذ وظيفة init عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
  console.log('تم تحميل الصفحة، جاري تنفيذ init...');
  
  // تحقق من وجود عناصر DOM قبل تهيئة الصفحة
  const rawServicesGrid = document.getElementById('rawServicesGrid');
  if (!rawServicesGrid) {
    console.error('لم يتم العثور على عنصر rawServicesGrid في DOM');
  } else {
    console.log('تم العثور على عنصر rawServicesGrid في DOM');
  }
  
  // تهيئة الصفحة
  await init();
  
  // التأكد من تحميل البيانات وعرضها بشكل صحيح
  console.log('تم الانتهاء من تهيئة الصفحة');
});

/** تحديث خدمة خام بعد التعديل */
function updateRawService(oldServiceId) {
  try {
    console.log('بدء تحديث الخدمة الخام:', oldServiceId);
    
    // تحويل oldServiceId إلى رقم إذا كان نصيًا
    if (typeof oldServiceId === 'string') {
      oldServiceId = parseInt(oldServiceId, 10);
    }
    
    // الحصول على القيم الجديدة من النموذج
    const newId = parseInt(document.getElementById('rawServiceId').value, 10);
    const provider = document.getElementById('rawServiceProvider').value;
    const defaultName = document.getElementById('rawServiceDefaultName').value.trim();
    
    // التحقق من صحة البيانات
    if (isNaN(newId) || !provider || !defaultName) {
      showToast('يرجى تعبئة جميع الحقول بشكل صحيح', true);
      return;
    }
    
    // التحقق من عدم وجود خدمة أخرى بنفس الرمز والمزود (باستثناء الخدمة الحالية)
    const duplicateService = globalData.rawServices.find(service => 
      service.id === newId && 
      service.provider === provider && 
      service.id !== oldServiceId
    );
    
    if (duplicateService) {
      showToast('توجد خدمة أخرى بنفس الرمز والمزود', true);
      return;
    }
    
    // تحديث الخدمة
    const serviceIndex = globalData.rawServices.findIndex(service => service.id === oldServiceId);
    if (serviceIndex === -1) {
      console.error('الخدمة الخام غير موجودة:', oldServiceId);
      showToast('الخدمة الخام غير موجودة', true);
      return;
    }
    
    // تخزين الخدمة المحدثة
    const updatedService = {
      id: newId,
      provider: provider,
      defaultName: defaultName
    };
    
    // استبدال الخدمة القديمة بالخدمة المحدثة
    globalData.rawServices[serviceIndex] = updatedService;
    
    // تحديث روابط الخدمات إذا تغير رمز الخدمة
    if (oldServiceId !== newId) {
      globalData.serviceLinks.forEach(link => {
        if (link.rawServiceId === oldServiceId) {
          link.rawServiceId = newId;
        }
      });
    }
    
    // تحديث المصفوفة المفلترة
    filteredRawServices = [...globalData.rawServices];
    
    // إعادة ضبط النموذج وزر الإضافة
    document.getElementById('rawServiceId').value = '';
    document.getElementById('rawServiceDefaultName').value = '';
    const addBtn = document.querySelector('#rawServicesSection .addBtn');
    addBtn.textContent = 'إضافة خدمة';
    addBtn.onclick = addRawService;
    
    // حفظ البيانات
    saveData();
    
    // تحديث العرض
    renderRawServices();
    renderServices();
    populateRawServiceSelect();
    
    console.log('تم تحديث الخدمة الخام بنجاح');
    showToast('تم تحديث الخدمة الخام بنجاح');
  } catch (error) {
    console.error('خطأ في تحديث الخدمة الخام:', error);
    showToast('حدث خطأ أثناء تحديث الخدمة الخام: ' + error.message, true);
  }
}

/** حفظ تعديلات الخدمة الخام */
function saveEditRawService(oldServiceId) {
  try {
    console.log('بدء حفظ تعديلات الخدمة الخام:', oldServiceId);
    
    // الحصول على القيم الجديدة من النموذج
    const newId = parseInt(document.getElementById('editRawServiceId').value, 10);
    const provider = document.getElementById('editRawServiceProvider').value;
    const defaultName = document.getElementById('editRawServiceName').value.trim();
    
    // التحقق من صحة البيانات
    if (isNaN(newId) || !provider || !defaultName) {
      showToast('يرجى تعبئة جميع الحقول بشكل صحيح', true);
      return;
    }
    
    // التحقق من عدم وجود خدمة أخرى بنفس الرمز والمزود (باستثناء الخدمة الحالية)
    const duplicateService = globalData.rawServices.find(service => 
      service.id === newId && 
      service.provider === provider && 
      service.id !== oldServiceId
    );
    
    if (duplicateService) {
      showToast('توجد خدمة أخرى بنفس الرمز والمزود', true);
      return;
    }
    
    // تحديث الخدمة
    const serviceIndex = globalData.rawServices.findIndex(service => service.id === oldServiceId);
    if (serviceIndex === -1) {
      console.error('الخدمة الخام غير موجودة:', oldServiceId);
      showToast('الخدمة الخام غير موجودة', true);
      return;
    }
    
    // تخزين الخدمة المحدثة
    const updatedService = {
      id: newId,
      provider: provider,
      defaultName: defaultName
    };
    
    // استبدال الخدمة القديمة بالخدمة المحدثة
    globalData.rawServices[serviceIndex] = updatedService;
    
    // تحديث روابط الخدمات إذا تغير رمز الخدمة
    if (oldServiceId !== newId) {
      globalData.serviceLinks.forEach(link => {
        if (link.rawServiceId === oldServiceId) {
          link.rawServiceId = newId;
        }
      });
    }
    
    // تحديث المصفوفة المفلترة
    filteredRawServices = [...globalData.rawServices];
    
    // حفظ البيانات
    saveData();
    
    // إغلاق النافذة المنبثقة
    closeModal();
    
    // تحديث العرض
    renderRawServices();
    renderServices();
    populateRawServiceSelect();
    
    console.log('تم تحديث الخدمة الخام بنجاح');
    showToast('تم تحديث الخدمة الخام بنجاح');
  } catch (error) {
    console.error('خطأ في تحديث الخدمة الخام:', error);
    showToast('حدث خطأ أثناء تحديث الخدمة الخام: ' + error.message, true);
  }
}

/**
 * تهيئة المستمعين للأقسام
 */
function setupSectionListeners() {
  // الحصول على جميع الأقسام
  const sections = document.querySelectorAll('.section');
  
  // إضافة مستمع أحداث لكل قسم
  sections.forEach(section => {
    const header = section.querySelector('.sectionHeader');
    
    if (header) {
      header.addEventListener('click', () => {
        // تبديل حالة القسم (مفتوح/مغلق)
        section.classList.toggle('open');
      });
    }
  });
  
  console.log('تم تهيئة مستمعين الأقسام');
}

// دالة مساعدة أساسية لتحديث قوائم التصنيفات الفرعية
function updateSubCategorySelect(mainCategoryId, subCategorySelect, emptyOptionText, currentValue = '', callback = null) {
  if (!subCategorySelect) return;
  
  subCategorySelect.innerHTML = '';
  
  // إضافة خيار فارغ
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyOptionText || '-- اختر تصنيف فرعي --';
  subCategorySelect.appendChild(emptyOption);
  
  if (!mainCategoryId || !globalData.categories[mainCategoryId]) return;
  
  // إضافة التصنيفات الفرعية
  const subCats = globalData.categories[mainCategoryId].subCategories || {};
  Object.keys(subCats).forEach(subKey => {
    const option = document.createElement('option');
    option.value = subKey;
    option.textContent = subKey;
    
    // تحديد الخيار الحالي إذا كان مطابقاً
    if (currentValue && subKey === currentValue) {
      option.selected = true;
    }
    
    subCategorySelect.appendChild(option);
  });
  
  // استدعاء دالة التعليمات البرمجية اللاحقة إذا تم تمريرها
  if (typeof callback === 'function') {
    callback();
  }
}

// دالة مساعدة أساسية لتحديث قوائم الباقات (subSubCategory)
function updateSubSubCategorySelect(mainCategoryId, subCategoryId, subSubCategorySelect, emptyOptionText, currentValue = '') {
  if (!subSubCategorySelect) return;
  
  subSubCategorySelect.innerHTML = '';
  
  // إضافة خيار فارغ
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyOptionText || '-- اختر الباقة --';
  subSubCategorySelect.appendChild(emptyOption);
  
  if (!mainCategoryId || !globalData.categories[mainCategoryId]) return;
  const subCats = globalData.categories[mainCategoryId].subCategories || {};
  if (!subCategoryId || !subCats[subCategoryId]) return;
  
  // إضافة الباقات
  const subSubs = subCats[subCategoryId].subSubCategories || [];
  subSubs.forEach(ssc => {
    const option = document.createElement('option');
    option.value = ssc;
    option.textContent = ssc;
    
    // تحديد الخيار الحالي إذا كان مطابقاً
    if (currentValue && ssc === currentValue) {
      option.selected = true;
    }
    
    subSubCategorySelect.appendChild(option);
  });
}
