Plan: التتبع + AI bots + HR employee expansion

Hand this document to the backend developer as the source of truth. Defaults chosen where you did not specify: cash sales approved by new permission hr.sales_cash.approve; Qiwa = store URL/reference only (no government API integration in this phase); Calls bot and Shift rules = stubs/placeholders.



0. Current baseline (do not reinvent)







Area



Already exists



Path





Employee master



number, name, contact, salary, targetPercent, targetCompletedPercent, lateDiscountAmount, absenceDiscountPerDay



[backend/prisma/models/hr.prisma](backend/prisma/models/hr.prisma)





HR API



/api/companies/:companyId/hr/* employees, attendance, leaves, advances, contracts, payroll, devices, me



[backend/src/modules/hr/](backend/src/modules/hr/)





Devices



AttendanceDevice CAMERA / BIOMETRIC / BOTH + punch + events



same HR module





E-wallet



EmployeeEwallet (today used mainly for purchase operators)



HR models





Frontend HR



list pages under app/c/[companyId]/hr/*, self-service hr/me, no employees/[id] detail



[frontend/lib/nav.ts](frontend/lib/nav.ts)





Permissions



hr.read / hr.write, ai.read / ai.write



[backend/prisma/seed.ts](backend/prisma/seed.ts)



1. Sidebar / modules

1.1 New section: التتبع (Tracking)

Purpose: Camera systems + biometric fingerprint attendance devices (move ownership out of HR nav).

Nav (frontend [lib/nav.ts](frontend/lib/nav.ts))





Parent: /c/{companyId}/tracking — permissions: ["tracking.read"]



Children:





/tracking/cameras — devices where deviceType in CAMERA, BOTH



/tracking/biometrics — devices where deviceType in BIOMETRIC, BOTH



/tracking/events — live/history punch & camera events



/tracking/attendance — optional deep-link/reuse of attendance list (or keep attendance under HR only; prefer events + devices under Tracking, attendance records stay under HR)

Remove from HR nav: hr/devices (keep route as redirect → /tracking/... for bookmarks).

Permissions (seed)





tracking.read, tracking.write



Grant to company admin / HR roles that already manage devices today

Backend





Prefer new thin controller TrackingController under companies/:companyId/tracking that reuses HrService device/event methods or move device endpoints from HR → Tracking and leave HR proxies deprecated.



Endpoints (mirror existing, filter by type):





GET/POST /tracking/cameras



GET/POST /tracking/biometrics



PATCH /tracking/devices/:id (activate/deactivate, rename, stream URL)



GET /tracking/events?deviceId&from&to&employeeId



Keep public punch: POST /tracking/devices/punch (migrate from /hr/devices/punch)

Frontend pages





Hub + cameras/biometrics tables (clone/adapt [hr/devices/page.tsx](frontend/app/c/[companyId]/hr/devices/page.tsx))



Events timeline with filters



Placeholder empty states in AR/EN i18n (nav.tracking*)

flowchart LR
  subgraph tracking [Tracking module]
    Cam[Cameras]
    Bio[Biometrics]
    Ev[Device events]
  end
  Ev --> Att[AttendanceRecord]
  Att --> HR[HR payroll / late rules]



1.2 AI subsections (stubs now, implement later)

Under existing AI parent (ai.read):







Nav key



Route



Phase





Bot WhatsApp



/c/{id}/ai/bots/whatsapp



Stub page + backend scaffold module AiBot / settings JSON only





Bot Calls



/c/{id}/ai/bots/calls



Stub page “قريباً” — no runtime

Backend (WhatsApp stub only)





Table ai_bot_configs: companyId, channel (WHATSAPP  VOICE_CALL), status (DISABLEDDRAFTACTIVE), settings JSON, timestamps



GET/PATCH /companies/:companyId/ai/bots/:channel — read/update settings; no message sending in this phase



Permissions: reuse ai.read / ai.write

Frontend: two pages under AI hub + nav children; Calls shows coming-soon; WhatsApp shows form for placeholders (API URL, token masked, webhook URL display).



2. HR — data model extensions (Prisma)

All tenant-scoped with companyId. Extend [hr.prisma](backend/prisma/models/hr.prisma); new migration.

2.1 Employee field additions







Field



Type



Notes





identityType



enum RESIDENT | CITIZEN



Required on create after phase





identityNumber



string



Iqama or National ID





identityExpiresOn



date



Expiry; notify before





iban / encrypted



use same pattern as finance ibanCiphertext + ibanLast4



Employee payout IBAN





ibanBankName



optional string









approvalStatus



enum PENDING | APPROVED | REJECTED



Approved when valid contract or loan contract exists, or HR override





salesTargetMode



enum PERCENT | AMOUNT | BOTH



Create-employee choice





salesTargetAmount



decimal?



When mode AMOUNT/BOTH





lateHourRate



decimal?



SAR per late hour (HR-set from salary); replace or complement lateDiscountAmount





advanceAllowanceMonthly



decimal?



Max advance this calendar month (HR-set from salary × days worked)





advanceAllowanceMonth



char(7)?



YYYY-MM for which allowance applies





insuranceAttachmentId



string?



FK/attachment; UI “بيانات غير مكتملة” if null





qiwaContractUrl



string?



Optional link/ref HR creates on Qiwa





qiwaContractRef



string?









profileComplete



computed in API



false if missing insurance / identity / IBAN as per rules

Keep existing: targetPercent, targetCompletedPercent, basicSalary, e-wallet relation.

2.2 New / extended models

WorkShift (stub for later rules)





id, companyId, name, startTime, endTime, breakMinutes, isActive



EmployeeShiftAssignment: employeeId, shiftId, effectiveFrom, effectiveTo?



APIs CRUD minimal; UI “تحديد الورديات” with banner “سيتم ضبط القواعد لاحقاً”

EmployeeSalesSubmission





employeeId, companyId, saleDate, amount, paymentMethod enum CASH  CARD  TRANSFER  NETWORK



status enum SUBMITTED  PENDING_CASH_APPROVAL  APPROVED  REJECTED  NEEDS_RECEIPT



receiptAttachmentId nullable (required for CARD/TRANSFER/NETWORK before final APPROVED)



approvedById, decidedAt, notes



On APPROVED: update employee targetCompletedPercent (or running period total — document formula) and optionally credit metrics

EmployeeContract extension





contractKind enum EMPLOYMENT  LOAN (default EMPLOYMENT)



Keep Qiwa fields on Employee or on contract: prefer contract externalPlatform / externalRef for Qiwa

Leave / Advance (mostly exist)





Leave: already has startsOn, endsOn, reason — ensure self + HR UIs enforce period + reason required



Advance: enforce amount <= remaining advanceAllowanceMonthly for current month; on APPROVED/PAID → credit EmployeeEwallet (not only purchase-operator wallets)

Notifications





Job/cron or scheduler hook: identity expiry in N days (e.g. 30/14/7) → notify HR role + employee user (notifications module)



Missing insurance → flag on employee detail, optional weekly digest later

2.3 Reports





Endpoint: GET /hr/employees/:id/personal-report?from=&to=



Returns one aggregated report per employee for period: leaves, advances, sales submissions, attendance summary, target progress — no pagination limits on the embedded arrays for that employee/period (stream or single JSON; warn if huge)



List endpoint for HR: select period + one employee (or “all employees” generating one report object each, not a capped global feed)



3. Backend API contract (for developer)

Base: /api/companies/:companyId

Tracking





As in §1.1

Employees





GET /hr/employees/:id — full profile (personal, shifts, financial, targets, docs flags)



POST /hr/employees — extend body with identity, salesTargetMode, targets, lateHourRate, IBAN (encrypted), approvalStatus default PENDING



PATCH /hr/employees/:id — sectioned updates (personal / financial / compliance)



POST /hr/employees/:id/insurance — upload attachment



PATCH /hr/employees/:id/advance-allowance — { month, amount } HR only



POST /hr/employees/:id/qiwa — { url?, ref? } mark Qiwa contract link



Approval: auto-set APPROVED when an ACTIVE employment or loan contract exists; HR can force via PATCH

Shifts (stub)





GET/POST /hr/shifts, POST /hr/employees/:id/shifts

Sales submissions





Employee: POST /hr/me/sales, GET /hr/me/sales



HR/Finance: GET /hr/sales-submissions?status=



POST /hr/sales-submissions/:id/receipt — upload



PATCH /hr/sales-submissions/:id/decision — approve/reject  





CASH → requires hr.sales_cash.approve  



CARD/TRANSFER/NETWORK → require receipt then hr.write or same approve perm

Self-service (/hr/me)





Expand GET: personal, shifts, financial summary (no full IBAN — last4 only), target %, sales, leaves, advances, insurance completeness



POST /hr/me/leaves — require date period + reason



POST /hr/me/advances — cap by allowance; paid to e-wallet



PATCH /hr/me/target-completed — employee updates own finishing % (or only via sales — choose: employee may PATCH targetCompletedPercent within 0–100, audited)

Reports





GET /hr/employees/:id/personal-report?from&to — unlimited arrays for that scope

Permissions to seed





tracking.read, tracking.write



hr.sales_cash.approve



Existing hr.read / hr.write for the rest

Encryption / attachments





Reuse company encryption service for IBAN (same as finance bank accounts)



Reuse attachments entityType=employee / employee_sales_receipt / employee_insurance



4. Frontend plan

4.1 Nav + i18n





[frontend/lib/nav.ts](frontend/lib/nav.ts): Tracking section; AI bot children; HR keep employees/contracts/…; remove devices from HR (redirect)



Messages AR/EN: nav.tracking, nav.trackingCameras, nav.trackingBiometrics, nav.aiBotWhatsapp, nav.aiBotCalls, employee detail tabs

4.2 Tracking UI





Pages under app/c/[companyId]/tracking/...



Reuse devices UI patterns; split CAMERA vs BIOMETRIC filters

4.3 AI bots UI





Stub pages under app/c/[companyId]/ai/bots/whatsapp and .../calls

4.4 Employee UX (major)





Create dialog ([hr/employees/page.tsx](frontend/app/c/[companyId]/hr/employees/page.tsx)): add identity type/number/expiry, sales target mode (percent / amount / both), late hour rate, advance allowance initial, IBAN; shifts multi-select stub



New detail route hr/employees/[employeeId]/page.tsx with tabs:





بيانات شخصية — identity, contacts, approval badge, insurance upload status (“غير مكتمل”), Qiwa link



الورديات وساعات العمل — assignments + stub note



بيانات مالية — salary, IBAN last4 + edit for HR, late hour rate, advance allowance, e-wallet balance, late discounts history



الهدف والمبيعات — target mode/values, employee-editable completion, sales submission list + approve actions for cash



التقارير الشخصية — date range → one report (leaves, advances, sales, attendance) no client-side artificial limit



Self-service [hr/me](frontend/app/c/[companyId]/hr/me/page.tsx): mirror tabs (read-only financial secrets); submit leave (period+reason), advance, sales + receipt upload; update target completion

4.5 Actions / types





Extend hr/actions.ts + shared types for new payloads



Gate cash approve buttons with can(user, "hr.sales_cash.approve")



5. Business rules (explicit for backend)





Target: on create, HR sets percent, amount, or both; employee can update completion %; sales approvals should recalculate or contribute to completion (document: completed = f(approvedSales, targetAmount|percent×salary) — implement amount-based if salesTargetAmount set, else keep percent field manual + sales list).



Late: prefer lateHourRate × lateHours from attendance; fall back to lateDiscountAmount if rate null.



Advance: HR sets advanceAllowanceMonthly for YYYY-MM from salary and days worked (HR enters amount; system does not auto-formula until they provide formula). Request rejected if sum(PENDING+APPROVED+PAID in month) + new > allowance. Disbursement credits e-wallet.



Cash sale: status PENDING_CASH_APPROVAL until hr.sales_cash.approve.



Card/transfer/network: employee must upload receipt; cannot APPROVED without attachment.



Employee approved: approvalStatus=APPROVED if ACTIVE contract of kind EMPLOYMENT or LOAN exists, or HR sets manually; show Qiwa CTA for HR.



Identity expiry: notify employee + users with hr.write at 30/14/7 days (use existing notifications).



Insurance missing: API profileComplete=false / UI banner; do not block login.



Personal report: one employee + period → full arrays, no take: 50 style caps.



6. Phased delivery (recommended for the backend team)







Phase



Scope



Ship criteria





P0



Tracking module (move devices) + permissions + nav



Cameras/biometrics/events work; HR devices redirects





P1



Employee identity, IBAN, insurance, approval, Qiwa fields + GET/PATCH :id + detail UI



Create/detail show compliance





P2



Advance allowance + e-wallet payout + leave reason/period enforcement



Caps enforced; wallet credited





P3



Sales submissions + cash approve + receipts + target mode



End-to-end sale flow





P4



Shifts stub + personal report endpoint/UI



Report unlimited for period





P5



Identity expiry notifications + AI bot stubs



Cron/scheduler + stub pages



7. Out of scope (this plan)





Real WhatsApp/Voice bot messaging providers



Live Qiwa government API



Automatic advance-allowance formula (HR enters amount until formula is defined)



Rewriting payroll engine beyond using lateHourRate when present

