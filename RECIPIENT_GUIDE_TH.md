# คู่มือสำหรับผู้รับโปรเจกต์ RepairLink

เอกสารนี้จัดทำขึ้นสำหรับผู้ดูแลระบบที่จะรับช่วงโปรเจกต์นี้ไปติดตั้ง ทดสอบ หรือใช้งานต่อ

## สิ่งที่ได้รับ

เมื่อรับโปรเจกต์นี้ ควรได้รับอย่างน้อย:

- source code จาก GitHub repository
- เอกสาร [README.md](README.md)
- เอกสาร [HANDOVER.md](HANDOVER.md)
- เอกสาร [DEPLOY.md](DEPLOY.md)
- ไฟล์ตัวอย่าง environment
- เอกสาร database schema

GitHub repository:

- [punnawichplub2547-boop/my-itapp](https://github.com/punnawichplub2547-boop/my-itapp)

## วัตถุประสงค์ของระบบ

RepairLink เป็นระบบภายในสำหรับผู้ดูแลระบบ ใช้สำหรับ:

- จัดการข้อมูลอุปกรณ์
- สร้างและติดตามรายการแจ้งซ่อม
- อัปเดตสถานะ ticket
- ดูรายงานงานซ่อม
- ตรวจสอบสถานะประกันของอุปกรณ์

ระบบนี้ออกแบบให้ใช้งานโดย admin เป็นหลัก

## สิ่งที่ผู้รับต้องเตรียม

ก่อนเริ่มติดตั้ง ควรมีสิ่งต่อไปนี้:

- Node.js
- npm
- MySQL
- สิทธิ์เข้าถึงเครื่อง server หรือเครื่องทดสอบ

คำสั่งเช็กเวอร์ชัน:

```bash
node -v
npm -v
mysql --version
```

## ขั้นตอนที่ผู้รับต้องทำ

### 1. ดึง source code

```bash
git clone https://github.com/punnawichplub2547-boop/my-itapp.git
cd my-itapp
```

### 2. อ่านเอกสารหลัก

ควรอ่านเอกสารเหล่านี้ก่อน:

- `README.md`
- `HANDOVER.md`
- `DEPLOY.md`

## 3. สร้างฐานข้อมูล MySQL

สร้างฐานข้อมูลใหม่:

```sql
CREATE DATABASE repairlink;
USE repairlink;
```

จากนั้นสร้างตารางตามเอกสาร:

- `docs/device-database.md`
- `docs/repair-ticket-database.md`
- `docs/migrations/create_device_repair_events.sql`

หมายเหตุ:

- หากต้องการเริ่มระบบใหม่ ให้ใช้ฐานข้อมูลว่าง
- ไม่จำเป็นต้องนำ ticket เก่าเข้ามา
- ticket numbering จะเริ่มใหม่เองในฐานข้อมูลใหม่

## 4. สร้างไฟล์ environment

ให้ใช้ไฟล์ตัวอย่างเหล่านี้:

- `.env.example`
- `.env.production.example`

สร้างไฟล์ `.env.production` และตั้งค่าจริง เช่น:

```env
DEVICE_REPOSITORY=mysql
DATABASE_URL=mysql://root:yourpassword@127.0.0.1:3306/repairlink

AUTH_ADMIN_USERNAME=admin
AUTH_ADMIN_PASSWORD=change-me
AUTH_SESSION_SECRET=change-me-to-a-long-random-secret

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=RepairLink <noreply@example.com>
```

ข้อควรระวัง:

- ไม่ควรใช้ `.env.local` ของผู้พัฒนา
- ไม่ควร commit ไฟล์ env ที่มีค่าจริงกลับเข้า repository

## 5. ติดตั้ง package

```bash
npm install
```

## 6. build โปรเจกต์

```bash
npm run build
```

## 7. รันระบบ

```bash
npm run start
```

จากนั้นเปิด:

- `http://<server-ip>:3000`

## 8. ทดสอบหลังติดตั้ง

ควรตรวจสอบอย่างน้อย:

1. ล็อกอินได้
2. Dashboard เปิดได้
3. Device Inventory โหลดข้อมูลได้
4. Create Repair Request ใช้งานได้
5. Repair Status ใช้งานได้
6. Reports เปิดได้
7. Warranty Audit เปิดได้

## 9. หากต้องการให้ระบบรันค้าง

แนะนำให้ใช้ `pm2`

```bash
npm install -g pm2
pm2 start npm --name repairlink -- run start
pm2 save
```

คำสั่งที่ใช้บ่อย:

```bash
pm2 list
pm2 logs repairlink
pm2 restart repairlink
```

## ไฟล์ที่ไม่ควรใช้เป็นไฟล์ส่งมอบหลัก

ไม่ควรนำไฟล์เหล่านี้ไปใช้เป็นค่าจริงหรือส่งต่อแบบเปิดเผย:

- `.env.local`
- `.env.docker.local`
- ไฟล์ log ชั่วคราว
- cookie หรือ temp file ภายในเครื่องผู้พัฒนา

## หากพบปัญหา

ควรตรวจสอบลำดับนี้:

1. Node.js และ npm ติดตั้งครบหรือไม่
2. MySQL ทำงานอยู่หรือไม่
3. `.env.production` ตั้งค่าครบหรือไม่
4. database schema ถูกสร้างครบหรือไม่
5. `npm run build` ผ่านหรือไม่

## สรุปสั้น

ผู้รับโปรเจกต์ต้องทำหลัก ๆ ดังนี้:

1. clone repository
2. อ่านเอกสาร
3. สร้าง MySQL database และ tables
4. ตั้งค่า `.env.production`
5. รัน `npm install`
6. รัน `npm run build`
7. รัน `npm run start`
8. ทดสอบ flow หลัก
