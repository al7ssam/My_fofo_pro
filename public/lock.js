/**
 * lock.js
 * 
 * This file handles the lock screen that appears on page load.
 * يتحكم هذا الملف في شاشة القفل التي تظهر عند تحميل الصفحة.
 */

/**
 * تحديد نوع الصفحة الحالية
 * Determines the current page type based on URL
 */
function getCurrentPageKey() {
  // استخدام URL الحالية لتحديد نوع الصفحة
  const currentPath = window.location.pathname;
  
  // إذا كان اسم الملف هو index.html أو /
  if (currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('/')) {
    console.log('صفحة الطلبات');
    return 'orderPage';
  } else {
    // افتراض أن أي صفحة أخرى (مثل manage_services.html) هي صفحة الإدارة
    console.log('صفحة الإدارة');
    return 'manageServicesPage';
  }
}

/**
 * checkPassword
 * 
 * Sends a POST request to /api/check-password with pageKey and password
 * يرسل طلب POST إلى /api/check-password للتحقق من كلمة المرور على الخادم
 */
async function checkPassword(inputVal, pageKey) {
  try {
    const response = await fetch('/api/check-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pageKey, password: inputVal })
    });
    if (!response.ok) {
      throw new Error('Invalid password or server error');
    }
    const data = await response.json();
    if (data.success) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error checking password:', error);
    return false;
  }
}

/**
 * تهيئة شاشة القفل عند تحميل الصفحة
 * Initialize the lock screen on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  const lockOverlay = document.getElementById('lockOverlay');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn'); // تأكد من وجود زر للدخول في HTML
  
  // تحديد نوع الصفحة الحالية
  const currentPageKey = getCurrentPageKey();
  console.log('نوع الصفحة الحالية:', currentPageKey);

  // Support pressing Enter in the input field
  // دعم الضغط على مفتاح Enter في حقل الإدخال
  if (passwordInput) {
    passwordInput.addEventListener('keypress', async function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        const passVal = passwordInput.value.trim();
        const isValid = await checkPassword(passVal, currentPageKey);
        if (isValid) {
          lockOverlay.style.display = 'none';
        } else {
          alert('كلمة المرور غير صحيحة / Incorrect password');
        }
      }
    });
  }

  // عند الضغط على زر الدخول
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const passVal = passwordInput.value.trim();
      const isValid = await checkPassword(passVal, currentPageKey);
      if (isValid) {
        lockOverlay.style.display = 'none';
      } else {
        alert('كلمة المرور غير صحيحة / Incorrect password');
      }
    });
  }
});