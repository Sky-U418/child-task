// firebase-config.js — Firebase 初始化
// 项目: child-task-4df76

const firebaseConfig = {
  apiKey: "AIzaSyC_S5dm0nUa-k-7vtKklHVkhmKOXgGq0XY",
  authDomain: "child-task-4df76.firebaseapp.com",
  projectId: "child-task-4df76",
  storageBucket: "child-task-4df76.firebasestorage.app",
  messagingSenderId: "1096898694693",
  appId: "1:1096898694693:web:5b698c578a37d6845a39cc"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

// Anonymous Auth — 自动登录
auth.signInAnonymously().catch(err => {
  console.error('Firebase Auth 失败:', err);
});

// 等待认证完成再初始化应用
auth.onAuthStateChanged(user => {
  if (user) {
    window._uid = user.uid;
    document.dispatchEvent(new CustomEvent('firebase:ready', { detail: { uid: user.uid } }));
  }
});
