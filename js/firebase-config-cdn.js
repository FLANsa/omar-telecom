// Firebase Configuration for Phone Store Demo - CDN Version
// إعدادات Firebase للمستودع الجديد - نسخة CDN

const firebaseConfig = {
  apiKey: "AIzaSyAjLgTfb2TJuQ5EIyls5v1GNX21LcaZVb4",
  authDomain: "omar-telecom-682ac.firebaseapp.com",
  projectId: "omar-telecom-682ac",
  storageBucket: "omar-telecom-682ac.firebasestorage.app",
  messagingSenderId: "357723312982",
  appId: "1:357723312982:web:a7fbe2c0e1f55f545ffcf7",
  measurementId: "G-FK23TTC0TG"
};

// تهيئة Firebase باستخدام CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// تصدير الخدمات للاستخدام في الملفات الأخرى
window.firebaseDB = db;
window.firebaseAuth = auth;
window.firebaseAnalytics = analytics;

console.log('🔥 Firebase initialized successfully!');
console.log('📊 Firestore Database:', db);
console.log('🔐 Authentication:', auth);
console.log('📈 Analytics:', analytics);
