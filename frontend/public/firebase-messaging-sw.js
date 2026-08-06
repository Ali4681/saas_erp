/* eslint-disable no-undef */
importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js",
);

function initMessaging(config) {
  if (!config?.enabled || !config.firebase) return;
  if (!firebase.apps.length) {
    firebase.initializeApp(config.firebase);
  }
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "إشعار جديد";
    const options = {
      body: payload.notification?.body || "",
      data: payload.data || {},
      icon: "/logo.svg",
    };
    self.registration.showNotification(title, options);
  });
}

fetch("/api/auth/fcm/config")
  .then((res) => (res.ok ? res.json() : null))
  .then((config) => initMessaging(config))
  .catch(() => {});
