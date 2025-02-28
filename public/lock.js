// lock.js
document.addEventListener("DOMContentLoaded", function() {
    const lockOverlay = document.getElementById("lockOverlay");
    const passwordInput = document.getElementById("passwordInput");
    const pageKey = window.location.href.includes("manage_services.html") ? "manageServicesPage" : "orderPage";
    
    // التحقق من حالة الدخول المخزنة مع مفتاح الصفحة
    const unlockTimestamp = localStorage.getItem("unlockTimestamp_" + pageKey);
    const now = Date.now();
    if (unlockTimestamp && now < parseInt(unlockTimestamp)) {
      lockOverlay.style.display = "none";
    } else {
      lockOverlay.style.display = "flex";
    }
    
    // تحميل كلمات المرور من ملف passwords.json
    fetch("passwords.json")
      .then(response => response.json())
      .then(data => {
        window.correctPassword = data[pageKey];
      })
      .catch(err => {
        console.error("خطأ في تحميل كلمات المرور:", err);
        window.correctPassword = "";
      });
    
    // دعم الضغط على مفتاح Enter في حقل الإدخال
    passwordInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        checkPassword();
      }
    });
  });
  
  function checkPassword() {
    const input = document.getElementById("passwordInput").value;
    const pageKey = window.location.href.includes("manage_services.html") ? "manageServicesPage" : "orderPage";
    if (input === window.correctPassword) {
      // تخزين حالة الدخول لمدة 30 يوم مع مفتاح الصفحة
      const validUntil = Date.now() + (30 * 24 * 60 * 60 * 1000);
      localStorage.setItem("unlockTimestamp_" + pageKey, validUntil.toString());
      document.getElementById("lockOverlay").style.display = "none";
    } else {
      alert("كلمة المرور غير صحيحة!");
    }
  }
  