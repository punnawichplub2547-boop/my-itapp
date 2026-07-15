# เอกสารส่งมอบระบบ IT System

## ภาพรวมของโปรเจกต์

IT System เป็นเว็บแอปภายในสำหรับผู้ดูแลระบบ ใช้สำหรับ:

- จัดการข้อมูลอุปกรณ์ในองค์กร
- สร้างและติดตามรายการแจ้งซ่อม
- อัปเดตสถานะงานซ่อม
- ดูรายงานงานที่เสร็จสิ้นหรือปิดงานแล้ว
- ตรวจสอบสถานะประกันและความเสี่ยงด้านอายุการใช้งานของอุปกรณ์

ระบบนี้ออกแบบมาเพื่อการใช้งานของผู้ดูแลระบบเป็นหลัก ยังไม่ได้ออกแบบให้เป็นพอร์ทัลสำหรับพนักงานทั่วไปใช้งานด้วยตนเอง

## เทคโนโลยีที่ใช้

- Next.js 16
- React 19
- Node.js
- MySQL

มีไฟล์สำหรับ Docker เตรียมไว้แล้ว แต่ไม่จำเป็นต้องใช้ Docker หากต้องการ deploy แบบตรงบนเครื่อง server

## ฟังก์ชันที่ใช้งานได้ในปัจจุบัน

- ระบบล็อกอินสำหรับผู้ดูแลระบบ
- Dashboard ภาพรวมระบบ
- Device Inventory
- Add New Device
- Create Repair Request
- Repair Status Management
- Reports สำหรับงานที่เสร็จสิ้นหรือปิดงานแล้ว
- Warranty Audit แบบ read-only

## ข้อจำกัดที่ควรทราบ

- เมนู `Current Assignment` ในหน้ารายละเอียดอุปกรณ์ แสดงเฉพาะข้อมูลผู้ถือครองปัจจุบัน ยังไม่ใช่ assignment history ย้อนหลังแบบเต็ม
- เมนู `Repair Log` มีทั้งข้อมูลที่ยืนยันได้จากตัวอุปกรณ์จริง และ ticket ที่จับคู่แบบ heuristic
- การจับคู่ ticket กับอุปกรณ์บางกรณียังอาศัยข้อมูลในข้อความ, model และ department ไม่ได้อ้างอิง `deviceId` โดยตรงทุกกรณี
- ระบบนี้เหมาะกับงานภายในที่ผู้ดูแลระบบใช้งานเป็นหลัก

## ที่เก็บโค้ด

GitHub repository:

- [punnawichplub2547-boop/my-itapp](https://github.com/punnawichplub2547-boop/my-itapp)

## ไฟล์ environment

ให้ใช้เฉพาะไฟล์ตัวอย่าง:

- `.env.example`
- `.env.production.example`

ไม่ควรส่งหรือ commit ไฟล์ที่มีค่าจริง เช่น:

- `.env.local`
- `.env.docker.local`

## Database

ระบบปัจจุบันใช้ MySQL สำหรับเก็บข้อมูลอุปกรณ์และข้อมูล ticket แบบถาวร

เอกสารอ้างอิง:

- `docs/device-database.md`
- `docs/repair-ticket-database.md`
- `docs/migrations/create_device_repair_events.sql`

migration script ที่เกี่ยวข้อง:

- `scripts/migrate-add-warranty-alerted-at.ts`
- `scripts/migrate-add-completed-at.ts`

หากต้องการเริ่มระบบใหม่:

- สร้าง MySQL database ใหม่แบบว่าง
- สร้างตารางที่จำเป็นให้ครบ
- ไม่ต้องนำข้อมูล `repair_tickets` เดิมเข้าไป
- ticket numbering จะเริ่มใหม่เองในฐานข้อมูลใหม่

## วิธี deploy ที่แนะนำ

แนะนำให้ deploy แบบไม่ใช้ Docker ก่อน โดยใช้:

- Node.js
- MySQL

ขั้นตอน deploy แบบละเอียดอยู่ใน:

- `DEPLOY.md`
- `RECIPIENT_GUIDE_TH.md`

## เช็กลิสต์หลัง deploy

ควรตรวจสอบอย่างน้อย:

1. ล็อกอิน admin ได้
2. Dashboard เปิดได้
3. Device Inventory โหลดข้อมูลจาก MySQL ได้
4. Create Repair Request ใช้งานได้
5. Repair Status และ Quick Status Shift ใช้งานได้
6. Reports เปิดได้
7. Warranty Audit เปิดได้

## เช็กลิสต์ก่อนส่งมอบ

1. ตรวจสอบว่าไม่มี secret จริงอยู่ใน repository
2. ส่งเฉพาะไฟล์ตัวอย่าง env
3. แนบเอกสาร database และ deployment ให้ครบ
4. ส่งลิงก์ GitHub repository ให้หัวหน้า IT
5. หากจำเป็น สามารถ demo ระบบสั้น ๆ เพิ่มเติมได้

## ผู้จัดทำ

- Punnawich
