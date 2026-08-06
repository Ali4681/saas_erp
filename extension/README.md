# SaaS ERP — Delivery Chrome Extension

جسور Partner Portal → NestJS:

| قناة | WebSocket |
|------|-----------|
| HungerStation | `ws://127.0.0.1:3000/ws/hungerstation` |
| Ninja | `ws://127.0.0.1:3000/ws/ninja` |
| ToYou | `ws://127.0.0.1:3000/ws/toyou` |
| Mrsool | `ws://127.0.0.1:3000/ws/mrsool` |

## التثبيت

1. شغّل الـ backend على المنفذ 3000.
2. `chrome://extensions` → Developer mode → Load unpacked → مجلد `extension/`.
3. سجّل الدخول في بوابة الشريك المطلوبة.
4. في صفحة مشروع التكامل داخل ERP راقب حالة الجسر.

## ملاحظات

- **ToYou / Ninja**: المزامنة تعمل بـ HTTP مباشر بعد حفظ `accessToken` (والـ branch/menu لـ Ninja).
- **Mrsool / HungerStation**: الجسر مهم (CORS / PerimeterX).
- **HungerStation — أوامر الطلبات**: القبول / الجاهز / الإرسال / الإلغاء عبر Partner API الرسمي (`clientId` + `clientSecret` + `chainId`). الإكستنشن يمرّر طلبات Partner API عند الاتصال. لا يوجد إنشاء طلب عميل من طرف المطعم.
- **HungerStation — أوامر الجسر**: `gql`, `rest`, `rest_multipart` (رفع صور المنتجات), `partner_rest`, `get_cookies`, `save_session`, `ping`.
