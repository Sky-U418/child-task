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

// Auth 超时降级：15 秒内未完成则显示错误 UI
let _authDone = false;
const AUTH_TIMEOUT_MS = 15000;
setTimeout(() => {
  if (_authDone) return;
  document.documentElement.innerHTML = `
    <body style="margin:0;padding:0;background:#0a0e17;color:#e0e0e0;font-family:system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center">
      <div>
        <h2 style="color:#ff6b6b">无法连接到服务器</h2>
        <p style="color:#8892b0;margin:8px 0 20px">请检查网络连接后刷新页面</p>
        <button onclick="location.reload()" style="background:#00d4ff;color:#0a0e17;border:none;
          padding:10px 28px;border-radius:6px;font-size:16px;cursor:pointer">重试</button>
      </div>
    </body>`;
}, AUTH_TIMEOUT_MS);

// 共享 UID：使用事务防止多设备同时写入的竞态条件
auth.onAuthStateChanged(async user => {
  if (!user) return;

  try {
    const cfgRef = db.collection('appConfig').doc('config');

    const sharedUid = await db.runTransaction(async transaction => {
      const cfgSnap = await transaction.get(cfgRef);
      if (cfgSnap.exists && cfgSnap.data().sharedUid) {
        return cfgSnap.data().sharedUid;
      }
      const uid = user.uid;
      transaction.set(cfgRef, { sharedUid: uid }, { merge: true });
      return uid;
    });

    _authDone = true;
    window._uid = sharedUid;
    document.dispatchEvent(new CustomEvent('firebase:ready', { detail: { uid: sharedUid } }));
  } catch (err) {
    console.error('共享 UID 配置失败:', err);
    _authDone = true;
    window._uid = user.uid;
    document.dispatchEvent(new CustomEvent('firebase:ready', { detail: { uid: user.uid } }));
  }
});
