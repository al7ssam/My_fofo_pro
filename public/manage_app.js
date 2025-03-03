/*******************************************************
 * manage_app.js
 * إدارة التصنيفات والخدمات
 * النسخة النهائية (V3) بعد إزالة النظام القديم والتكرار غير الضروري
 * وحل مشكلة عدم ظهور الخدمات الخام
 *******************************************************/

// الثوابت العامة
const STORAGE_KEY = 'services_data';
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 دقيقة

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

/** تحميل البيانات من LocalStorage أو ملف JSON */
async function loadData() {
  try {
    console.log('بدء تحميل البيانات...');
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        if (parsedData && parsedData.categories && Array.isArray(parsedData.rawServices)) {
          console.log('تم تحميل البيانات من التخزين المحلي');
          return parsedData;
        }
      } catch (e) {
        console.error('خطأ في تحليل البيانات المخزنة:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    console.log('جاري تحميل البيانات من الملف...');
    let data = null;
    const paths = ['/servicesData.json', './servicesData.json', '../servicesData.json'];
    for (let path of paths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          data = await response.json();
          console.log(`تم جلب البيانات من: ${path}`);
          break;
        }
      } catch (err) {
        console.warn(`فشل تحميل البيانات من: ${path} - ${err.message}`);
      }
    }
    if (!data) throw new Error('فشل في تحميل البيانات من جميع المسارات المحتملة');
    if (data && data.categories && Array.isArray(data.rawServices)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    } else {
      throw new Error('البيانات المحملة غير مكتملة أو غير صحيحة');
    }
  } catch (error) {
    console.error('فشل تحميل البيانات:', error);
    return { categories: {}, services: [], rawServices: [], serviceLinks: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalData));
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

function addMainCategory() {
  const newMainCat = document.getElementById('newMainCat').value.trim();
  if (!newMainCat) return showToast('الرجاء إدخال اسم التصنيف الرئيسي', true);
  if (globalData.categories[newMainCat]) return showToast('هذا التصنيف موجود مسبقًا', true);
  globalData.categories[newMainCat] = { subCategories: {} };
  saveData();
  populateMainCatForAddSub();
  populateMainCatSelect();
  populateLinkCategorySelectors();
  document.getElementById('newMainCat').value = '';
  showToast('تمت إضافة التصنيف الرئيسي بنجاح');
}

function addSubCat() {
  const mainCatVal = document.getElementById('selectMainCatForAddSub').value;
  if (!mainCatVal) return showToast('اختر تصنيفًا رئيسيًا أولاً', true);
  const newSubCat = document.getElementById('newSubCat').value.trim();
  if (!newSubCat) return showToast('الرجاء إدخال اسم التصنيف الفرعي', true);
  const subCats = globalData.categories[mainCatVal].subCategories;
  if (subCats[newSubCat]) return showToast('التصنيف الفرعي موجود مسبقًا', true);
  subCats[newSubCat] = { subSubCategories: [] };
  saveData();
  populateSubCatForAddSubSub();
  updateSubCats();
  populateLinkCategorySelectors();
  document.getElementById('newSubCat').value = '';
  showToast('تمت إضافة التصنيف الفرعي بنجاح');
}

function addSubSubCat() {
  const mainCatVal = document.getElementById('selectMainCatForAddSub').value;
  const subCatVal = document.getElementById('selectSubCatForAddSubSub').value;
  if (!mainCatVal || !subCatVal) return showToast('اختر تصنيفًا رئيسيًا وفرعيًا', true);
  const newSubSubCat = document.getElementById('newSubSubCat').value.trim();
  if (!newSubSubCat) return showToast('الرجاء إدخال اسم الباقة', true);
  const subSubs = globalData.categories[mainCatVal].subCategories[subCatVal].subSubCategories;
  if (subSubs.includes(newSubSubCat)) return showToast('هذه الباقة موجودة مسبقًا', true);
  subSubs.push(newSubSubCat);
  saveData();
  populateSubCatForAddSubSub();
  updateSubSubCats();
  populateLinkCategorySelectors();
  document.getElementById('newSubSubCat').value = '';
  showToast('تمت إضافة الباقة بنجاح');
}

function deleteMainCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  if (!mainCatVal) return;
  if (!confirm('هل أنت متأكد من حذف التصنيف الرئيسي وجميع التصنيفات الفرعية بداخله؟')) return;
  delete globalData.categories[mainCatVal];
  saveData();
  populateMainCatForAddSub();
  populateMainCatSelect();
  populateLinkCategorySelectors();
  document.getElementById('selectSubCat').innerHTML = '';
  document.getElementById('selectSubSubCat').innerHTML = '';
  showToast('تم حذف التصنيف الرئيسي بنجاح');
}

function renameMainCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  if (!mainCatVal) return;
  const newName = prompt('أدخل الاسم الجديد للتصنيف الرئيسي:', mainCatVal);
  if (!newName || !newName.trim()) return;
  if (globalData.categories[newName]) return showToast('التصنيف الجديد موجود مسبقًا', true);
  globalData.categories[newName] = globalData.categories[mainCatVal];
  delete globalData.categories[mainCatVal];
  saveData();
  populateMainCatForAddSub();
  populateMainCatSelect();
  populateLinkCategorySelectors();
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
  populateLinkCategorySelectors();
  showToast('تم حذف التصنيف الفرعي بنجاح');
}

function renameSubCat() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatVal = document.getElementById('selectSubCat').value;
  if (!mainCatVal || !subCatVal) return;
  const newName = prompt('أدخل الاسم الجديد للتصنيف الفرعي:', subCatVal);
  if (!newName || !newName.trim()) return;
  const subCats = globalData.categories[mainCatVal].subCategories;
  if (subCats[newName]) return showToast('التصنيف الفرعي الجديد موجود مسبقًا', true);
  subCats[newName] = subCats[subCatVal];
  delete subCats[subCatVal];
  saveData();
  updateSubCats();
  populateSubCatForAddSubSub();
  populateLinkCategorySelectors();
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
    populateLinkCategorySelectors();
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
  if (subSubs.includes(newName)) return showToast('الباقة الجديدة موجودة مسبقًا', true);
  const idx = subSubs.indexOf(subSubCatVal);
  if (idx !== -1) {
    subSubs[idx] = newName;
    saveData();
    updateSubSubCats();
    populateLinkCategorySelectors();
    showToast('تم تعديل الاسم بنجاح');
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
function deleteService(serviceId, mainCategory, subCategory, subSubCategory) {
  if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
  const index = globalData.services.findIndex(s => s.id === serviceId && s.mainCategory === mainCategory && s.subCategory === subCategory && s.subSubCategory === subSubCategory);
  if (index !== -1) {
    globalData.services.splice(index, 1);
    saveData();
    showToast('تم حذف الخدمة بنجاح');
    filterServices();
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

function saveEditService() {
  if (currentEditServiceId === null) return;
  const newRawServiceId = Number(document.getElementById('editRawServiceSelect').value);
  const newMainCategory = document.getElementById('editMainCategorySelect').value;
  const newSubCategory = document.getElementById('editSubCategorySelect').value;
  const newSubSubCategory = document.getElementById('editSubSubCategorySelect').value;
  const newName = document.getElementById('editServiceName').value.trim();
  const newQty = Number(document.getElementById('editQuantity').value);
  if (!newName || !newRawServiceId || !newMainCategory || !newQty) return showToast('الرجاء تعبئة جميع الحقول المطلوبة', true);
  const rawService = globalData.rawServices.find(s => s.id === newRawServiceId);
  if (!rawService) return showToast('الخدمة الخام غير موجودة', true);
  const serviceLinkIndex = globalData.serviceLinks.findIndex(link => 
    link.rawServiceId === currentEditServiceId && 
    link.mainCategory === currentEditMainCategory && 
    link.subCategory === currentEditSubCategory && 
    link.subSubCategory === currentEditSubSubCategory
  );
  if (serviceLinkIndex === -1) return showToast('لم يتم العثور على رابط الخدمة', true);
  globalData.serviceLinks[serviceLinkIndex] = {
    rawServiceId: newRawServiceId,
    mainCategory: newMainCategory,
    subCategory: newSubCategory,
    subSubCategory: newSubSubCategory,
    name: newName,
    quantity: newQty
  };
  updateServicesFromLinks();
  saveData();
  closeModal();
  showToast('تم حفظ التعديلات بنجاح');
  filterServices();
}

function closeModal() {
  currentEditServiceId = currentEditMainCategory = currentEditSubCategory = currentEditSubSubCategory = null;
  document.getElementById('modalOverlay').style.display = 'none';
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

function deleteRawService(serviceId) {
  serviceId = Number(serviceId);
  const serviceIndex = globalData.rawServices.findIndex(service => service.id === serviceId);
  if (serviceIndex === -1) return showToast('الخدمة الخام غير موجودة', true);
  const linksCount = countServiceLinks(serviceId);
  if (linksCount > 0 && !confirm(`هذه الخدمة مرتبطة بـ ${linksCount} تصنيف. هل أنت متأكد من حذفها؟ (سيتم حذف جميع الارتباطات أيضًا)`)) return;
  globalData.serviceLinks = globalData.serviceLinks.filter(link => link.rawServiceId !== serviceId);
  globalData.rawServices.splice(serviceIndex, 1);
  filteredRawServices = filteredRawServices.filter(service => service.id !== serviceId);
  saveData();
  renderRawServices();
  renderServices();
  populateRawServiceSelect();
  showToast('تم حذف الخدمة الخام بنجاح');
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

function linkServiceToCategory() {
  const rawServiceId = Number(document.getElementById('selectRawService').value);
  const mainCat = document.getElementById('linkMainCatSel').value;
  const subCat = document.getElementById('linkSubCatSel').value;
  const subSubCat = document.getElementById('linkSubSubCatSel').value;
  const serviceName = document.getElementById('linkServiceName').value.trim();
  const quantity = Number(document.getElementById('linkQuantity').value);
  if (!rawServiceId || !mainCat || !serviceName || !quantity)
    return showToast('الرجاء تعبئة الحقول المطلوبة: الخدمة، التصنيف الرئيسي، اسم الخدمة، والكمية', true);
  const rawService = globalData.rawServices.find(s => s.id === rawServiceId);
  if (!rawService) return showToast('الخدمة الخام غير موجودة', true);
  const exists = globalData.serviceLinks.find(link => 
    link.rawServiceId === rawServiceId &&
    link.mainCategory === mainCat &&
    link.subCategory === subCat &&
    link.subSubCategory === subSubCat
  );
  if (exists) return showToast('هذا الربط موجود مسبقاً', true);
  const newLink = {
    rawServiceId: rawServiceId,
    mainCategory: mainCat,
    subCategory: subCat || "",
    subSubCategory: subSubCat || "",
    name: serviceName,
    quantity: quantity
  };
  globalData.serviceLinks.push(newLink);
  updateServicesFromLinks();
  saveData();
  showToast('تم ربط الخدمة بالتصنيف بنجاح');
  document.getElementById('linkQuantity').value = '';
  filterServices();
}

function updateServicesFromLinks() {
  try {
    if (!globalData.serviceLinks || !globalData.rawServices) return;
    globalData.services = [];
    globalData.serviceLinks.forEach(link => {
      const rawService = globalData.rawServices.find(s => s.id === link.rawServiceId);
      if (!rawService) return;
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
    filteredServices = [...globalData.services];
    saveData();
    renderServices();
  } catch (error) {
    console.error('خطأ في تحديث الخدمات من روابط الخدمات:', error);
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