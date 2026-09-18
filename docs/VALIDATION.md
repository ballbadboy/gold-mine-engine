# Validation — Marketing Workspace + AI Admin Pilot

## AI Admin extension — 18 September 2026

- `pnpm check`: lint, TypeScript, **46 unit/database tests**, production build ผ่าน
- `pnpm test:integration`: **19 HTTP checks** ผ่าน รวม flow เดิมและ support flow ใหม่ 7 กรณี
- ทดสอบแชตผู้เล่นและผู้ดูแลใน browser ที่ 1280×720 และ 390×844: โหลดตัวอย่าง, คำถาม FAQ ได้คำตอบพร้อมที่มา, ขอคน, ผู้ดูแลตอบแล้วผู้เล่นเห็นหลัง reload, สรุปงานตรงกับจำนวนเรื่อง, เพิ่มฉบับร่างและเผยแพร่คำตอบ
- ทดสอบ session แยกผู้เล่น, hash secret, วันหมดอายุ, origin/owner authorization, ข้อมูลซ้ำ, ปกปิดอีเมล/หมายเลข/OTP บางรูปแบบ, ฉบับร่างไม่เผยแพร่, optimistic revision, พักคำตอบขณะ AI ทำงาน, คนรับช่วงเหนือผล AI, timeout recovery และโควตาที่จองพร้อมกันไม่เกินขีดจำกัด
- ทดสอบว่าคำสั่งจากโมเดลที่ไม่ตรง schema ไม่ถูกใช้, ID คำตอบต้องอยู่ในคลังที่เผยแพร่, คำตอบผู้เล่นมาจากข้อความที่อนุมัติ และตัวเลขหลังบ้านคำนวณจากข้อมูลโดยตรง
- ทดสอบคำถามปัญหาเดียวกันที่ระบุกลุ่มประชากรต่างกัน ให้ routing แบบคลังคำตอบเหมือนกัน ผลนี้ไม่ใช่การรับรองความเป็นธรรมของโมเดลจริง

ใช้ข้อมูลสังเคราะห์และ model stub เท่านั้น **ไม่ได้เรียกหรือประเมิน LLM จริง**, ไม่ได้เชื่อม LINE/Messenger, หลังบ้านเกม หรือ hosted Supabase และไม่ได้ deploy ส่วนแชตสาธารณะ/AI ปิดโดยค่าเริ่มต้น การตอบสาธิตผ่านคลังคำตอบไม่ใช่หลักฐานว่าเชื่อมผู้ให้บริการ AI แล้ว

การตรวจเดิมด้านล่างเป็นหลักฐานของ Marketing Pilot 01 ก่อนเพิ่มแอดมิน จำนวนรวมล่าสุดอยู่ในส่วนนี้

ตรวจในเครื่องด้วยข้อมูลสังเคราะห์ วันที่ 18 กันยายน 2026 (Node 22.23.2 / pnpm 10.33.0 / Next.js 16.2.4)

## Automated checks

- `pnpm check`: ESLint, TypeScript, unit/database tests 29 กรณี และ production build
- `pnpm test:integration`: 12 กรณี HTTP ผ่าน Next.js server ที่เปิดด้วยข้อมูลชั่วคราวและกุญแจสุ่มสำหรับทดสอบ
- Migration รัน SQL จริงใน Postgres/WASM (PGlite): เรียกซ้ำได้, ตัด policy เดิม, ปิดสิทธิ์ anon/authenticated, service_role เขียนได้ และ stale revision ไม่เขียนทับ

การทดสอบครอบคลุมยอดฝากกับรายได้แยกกัน, CPA, ฝากซ้ำ, event ID ซ้ำ/ขัดแย้ง, ผู้ฝากครั้งแรกไม่ซ้ำ, ข้อมูลมาไม่เรียงเวลา, วันที่ UTC ที่มี offset, แยกสกุลเงิน, ตัวหารศูนย์, ค่าใช้จ่ายวันเดิม, สถานะพัก, การเขียนไฟล์พร้อมกัน, ไฟล์เสีย, scrypt/session, Origin, HMAC และ public content/cron/API ที่ไม่ได้รับอนุญาต

HTTP flow: เข้าระบบ → สร้างแคมเปญ/พาร์ตเนอร์/ลิงก์ → ปฏิเสธร่างที่ยังไม่พร้อม → อนุมัติภายใน → redirect พร้อม click ID → signed registration/first deposit/repeat deposit/net revenue → บันทึกค่าใช้จ่าย → กระทบยอด → ส่งออก brief/CSV → พักพาร์ตเนอร์ → ออกจากระบบ

## Browser review

ตรวจผ่าน browser ของแอปที่ 1280×720 และ 390×844:

- โหลดข้อมูลตัวอย่างและเปิด Dashboard ภาษาไทย
- สร้างแคมเปญที่ยังไม่มี URL และยืนยันว่าการอนุมัติถูกปฏิเสธพร้อมระบุข้อมูลที่ขาด
- เพิ่มพาร์ตเนอร์ CPA USD 7.50 และสร้างลิงก์ที่ผูกพาร์ตเนอร์ถูกต้อง
- กรอกค่าโฆษณา USD 12.34 แล้วเปิดหน้าใหม่ ยอดโฆษณาจาก USD 195.00 เป็น USD 207.34; ส่วนเหลือจาก USD 185.00 เป็น USD 172.66; ยอดฝากยัง USD 600.00
- ตรวจการแสดงผลหน้าจอและแบบฟอร์มบนมือถือ ปุ่มและข้อมูลสำคัญแสดงได้ พร้อมคืนขนาด viewport เดิมหลังทดสอบ

## สิ่งที่ยังไม่ได้รับการยืนยัน

- ไม่มีการส่งโฆษณาจริงและยังไม่มี Meta/Google API adapter; brief ระบุ `NOT_SUBMITTED`
- ไม่ได้เชื่อมบัญชีโฆษณา, หลังบ้านเกม หรือ Supabase hosted project ของผู้ใช้ และไม่ได้ deploy/migrate ฐานข้อมูลจริง
- PGlite และ local HTTP checks ไม่ใช่การทดสอบโหลด/เครือข่าย/สิทธิ์บน Supabase hosted
- ไม่ได้ตรวจยืนยันเอกสารสิทธิ์ตลาดหรือการอนุมัติแพลตฟอร์ม
- รุ่นนี้เป็น single-owner pilot, มีขีดจำกัด snapshot; ต้องเพิ่ม event storage, ingress rate limit, monitoring และกระทบยอดต้นทางก่อน traffic จริง
- ไม่ได้เพิ่ม GitHub Actions workflow; มีคำสั่งตรวจซ้ำใน repo

## แก้ฐานโค้ดเดิมที่เกี่ยวข้อง

เพิ่ม owner access ก่อนเข้าหน้า/API ภายใน, ปิดช่องทาง seed ที่เขียนข้อมูลจำลองลงข้อมูลจริง, cron ต้องใช้ secret ที่ตั้งค่าไว้, public content จำกัด website + published, escape JSON-LD และแสดง expanded Markdown แบบไม่เปิด raw HTML, รักษาลำดับผล bulk generation ให้ตรง keyword และใช้ weighted CTR/bounce rate ใน loop

เครื่องมือ legacy ยังมีข้อจำกัดของการเชื่อม analytics/AI เดิม รายงานการตลาดใหม่ใช้ event และค่าใช้จ่ายของ Marketing Workspace โดยตรง
