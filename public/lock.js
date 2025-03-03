/**
 * lock.js
 * 
 * This file handles the lock screen that appears on page load.
 * يتحكم هذا الملف في شاشة القفل التي تظهر عند تحميل الصفحة.
 */

// Global variable to store passwords / متغير عام لتخزين كلمات المرور
let passwords = {};

/**
 * fetchPasswords
 * 
 * Fetches the passwords from the config/passwords.json file.
 * يقوم بتحميل كلمات المرور من الملف الموجود في المجلد config.
 */
async function fetchPasswords() {
  try {
    // تعديل المسار لتحميل الملف من المجلد config
    const response = await fetch('./config/passwords.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    passwords = await response.json();
    console.log('Passwords loaded successfully / تم تحميل كلمات المرور بنجاح');
  } catch (error) {
    console.error('Failed to load passwords.json / فشل تحميل ملف passwords.json:', error);
    passwords = {};
  }
}

/**
 * checkPassword
 * 
 * Checks if the input password matches the password set for the given page key.
 * تتحقق مما إذا كانت كلمة المرور المدخلة تتطابق مع كلمة المرور المحددة للصفحة.
 * 
 * @param {string} inputVal - The input password / كلمة المرور المدخلة.
 * @param {string} pageKey - The page key (e.g., "manageServicesPage") / مفتاح الصفحة.
 * @returns {boolean} - true if matched, false otherwise / true إذا كانت متطابقة، false خلاف ذلك.
 */
function checkPassword(inputVal, pageKey) {
  if (!passwords[pageKey]) {
    console.error(`No password defined for page key: ${pageKey} / لا يوجد مفتاح لكلمة المرور للصفحة: ${pageKey}`);
    return false;
  }
  return inputVal === passwords[pageKey];
}

/**
 * Initialize the lock screen on page load.
 * تهيئة شاشة القفل عند تحميل الصفحة.
 */
document.addEventListener('DOMContentLoaded', async () => {
  await fetchPasswords();

  const lockOverlay = document.getElementById('lockOverlay');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn'); // تأكد من وجود زر للدخول في HTML

  // Support pressing Enter in the input field
  // دعم الضغط على مفتاح Enter في حقل الإدخال
  if (passwordInput) {
    passwordInput.addEventListener('keypress', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        const passVal = passwordInput.value.trim();
        // استخدم مفتاح الصفحة المناسب؛ هنا نفترض "manageServicesPage"
        if (checkPassword(passVal, 'manageServicesPage')) {
          lockOverlay.style.display = 'none';
        } else {
          alert('Incorrect password / كلمة المرور غير صحيحة');
        }
      }
    });
  }

  // When the login button is clicked
  // عند الضغط على زر الدخول
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const passVal = passwordInput.value.trim();
      if (checkPassword(passVal, 'manageServicesPage')) {
        lockOverlay.style.display = 'none';
      } else {
        alert('Incorrect password / كلمة المرور غير صحيحة');
      }
    });
  }
});