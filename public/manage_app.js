/*******************************************************
 * manage_app.js
 * إدارة التصنيفات والخدمات
 * يعرض ويتيح إضافة/تعديل/حذف
 *******************************************************/

const STORAGE_KEY = 'services_data';
let globalData = { categories: {}, services: [] };

// لعرض الخدمات (سواء الأصلية أم المفلترة)
let filteredServices = [];

/** تحميل البيانات من localStorage أو JSON */
async function loadData() {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (storedData) {
    return JSON.parse(storedData);
  } else {
    try {
      const response = await fetch('servicesData.json');
      if (!response.ok) throw new Error('Network response was not ok: ' + response.status);
      const jsonData = await response.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jsonData));
      return jsonData;
    } catch (error) {
      console.error('فشل في جلب servicesData.json:', error);
      // بيانات افتراضية
      const fallbackData = {
        categories: {},
        services: []
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData));
      return fallbackData;
    }
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalData));
}

/** توسيع/طي أقسام الصفحة */
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  section.classList.toggle('open');
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
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatSelect = document.getElementById('selectSubCat');
  subCatSelect.innerHTML = '';

  if (!mainCatVal || !globalData.categories[mainCatVal]) return;
  const subCats = globalData.categories[mainCatVal].subCategories || {};
  Object.keys(subCats).forEach(subKey => {
    const option = document.createElement('option');
    option.value = subKey;
    option.textContent = subKey;
    subCatSelect.appendChild(option);
  });
  updateSubSubCats();
}

function updateSubSubCats() {
  const mainCatVal = document.getElementById('selectMainCat').value;
  const subCatVal = document.getElementById('selectSubCat').value;
  const selectSubSub = document.getElementById('selectSubSubCat');
  selectSubSub.innerHTML = '';

  if (!mainCatVal || !subCatVal) return;
  const subCats = globalData.categories[mainCatVal].subCategories || {};
  if (!subCats[subCatVal]) return;
  const subSubs = subCats[subCatVal].subSubCategories || [];
  subSubs.forEach(ssc => {
    const option = document.createElement('option');
    option.value = ssc;
    option.textContent = ssc;
    selectSubSub.appendChild(option);
  });
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

function renderServices() {
  const servicesGrid = document.getElementById('servicesGrid');
  servicesGrid.innerHTML = '';

  filteredServices.forEach(service => {
    const card = document.createElement('div');
    card.className = 'serviceCard';
    card.innerHTML = `
      <h4>${service.name}</h4>
      <p>رمز الخدمة: ${service.id}</p>
      <p>الكمية: ${service.quantity}</p>
      <p>المزود: ${service.provider}</p>
      <p>التصنيف الرئيسي: ${service.mainCategory}</p>
      <p>التصنيف الفرعي: ${service.subCategory}</p>
      <p>الباقة: ${service.subSubCategory}</p>
      <div class="serviceActions">
        <button class="editBtn" onclick="editService(${service.id})">تعديل</button>
        <button class="deleteBtn" onclick="deleteService(${service.id})">حذف</button>
      </div>
    `;
    servicesGrid.appendChild(card);
  });
}

/** البحث عن الخدمة بالاسم أو الرمز */
function filterServices() {
  const searchVal = document.getElementById('searchServiceInput').value.trim().toLowerCase();
  if (!searchVal) {
    filteredServices = [...globalData.services];
  } else {
    filteredServices = globalData.services.filter(srv => {
      const idStr = String(srv.id).toLowerCase();
      const nameStr = String(srv.name).toLowerCase();
      return idStr.includes(searchVal) || nameStr.includes(searchVal);
    });
  }
  renderServices();
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

  const newService = {
    id: serviceId,
    name: serviceName,
    quantity: quantity,
    provider: provider,
    mainCategory: mainCat,
    subCategory: subCat,
    subSubCategory: subSubCat
  };
  globalData.services.push(newService);
  saveData();
  showToast('تمت إضافة الخدمة بنجاح');

  document.getElementById('addServiceName').value = '';
  document.getElementById('addServiceId').value = '';
  document.getElementById('addQuantity').value = '';

  filterServices(); // تحديث العرض
}

/** تعديل/حذف خدمة */
function deleteService(serviceId) {
  if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
  // قد تكون هناك عدة خدمات بنفس الـID لكن في تصنيفات مختلفة
  // نبحث عن المطابقة الكاملة إن لزم
  const idx = globalData.services.findIndex(s => s.id === serviceId);
  if (idx !== -1) {
    globalData.services.splice(idx, 1);
    saveData();
    showToast('تم حذف الخدمة');
    filterServices();
  }
}

let currentEditServiceId = null;
function editService(serviceId) {
  currentEditServiceId = serviceId;
  const service = globalData.services.find(s => s.id === serviceId);
  if (!service) return;

  document.getElementById('editServiceName').value = service.name;
  document.getElementById('editServiceId').value = service.id;
  document.getElementById('editQuantity').value = service.quantity;
  document.getElementById('editProvider').value = service.provider;

  document.getElementById('modalOverlay').style.display = 'flex';
}

function saveEditService() {
  if (currentEditServiceId === null) return;
  const service = globalData.services.find(s => s.id === currentEditServiceId);
  if (!service) return;

  const newName = document.getElementById('editServiceName').value.trim();
  const newId = Number(document.getElementById('editServiceId').value);
  const newQty = Number(document.getElementById('editQuantity').value);
  const newProvider = document.getElementById('editProvider').value;

  // التحقق من عدم تكرار الرمز (إن تغير)
  const sameId = globalData.services.filter(s => 
    s.id === newId && s !== service
  );
  if (sameId.length > 0) {
    showToast('رمز الخدمة الجديد موجود لخدمة أخرى!', true);
    return;
  }

  service.name = newName;
  service.id = newId;
  service.quantity = newQty;
  service.provider = newProvider;

  saveData();
  closeModal();
  showToast('تم حفظ التعديلات بنجاح');
  filterServices();
}

function closeModal() {
  currentEditServiceId = null;
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

/** عند تحميل الصفحة */
window.addEventListener('DOMContentLoaded', async () => {
  globalData = await loadData();

  // تعبئة قوائم إضافة التصنيفات
  populateMainCatForAddSub();
  populateSubCatForAddSubSub();

  // تعبئة قسم إدارة التصنيفات
  populateMainCatSelect();
  updateSubCats();

  // تعبئة قسم إضافة خدمة جديدة
  populateServiceSelectors();

  // نملأ filteredServices بكل الخدمات
  filteredServices = [...globalData.services];
  renderServices();

  // ربط الأحداث
  document.getElementById('selectMainCatForAddSub').addEventListener('change', populateSubCatForAddSubSub);
  document.getElementById('addMainCatSel').addEventListener('change', updateAddSubCatSel);
  document.getElementById('addSubCatSel').addEventListener('change', updateAddSubSubCatSel);
});
