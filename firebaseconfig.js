// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js"; 
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCJyR-H63mAy4RiwOavd3CLvOeETvJxgZI",
  authDomain: "biblioteca-colegio-secundario.firebaseapp.com",
  projectId: "biblioteca-colegio-secundario",
  storageBucket: "biblioteca-colegio-secundario.firebasestorage.app",
  messagingSenderId: "35239130564",
  appId: "1:35239130564:web:94e0cf5aafcfde6f20a091",
  measurementId: "G-SQESM34XF9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

