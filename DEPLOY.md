# คู่มือการ Deploy

โปรเจกต์นี้สามารถ deploy ได้โดยไม่ต้องใช้ Docker สำหรับการส่งต่องานครั้งนี้ แนะนำให้ใช้วิธีนี้ เพราะตรวจสอบและดูแลบนเซิร์ฟเวอร์ภายในได้ง่ายกว่า

## รูปแบบการ Deploy ที่แนะนำ

- ใช้ Node.js + MySQL บนเซิร์ฟเวอร์
- ไม่จำเป็นต้องใช้ Docker

## สิ่งที่ต้องเตรียมก่อน

ติดตั้งหรือตรวจสอบให้แน่ใจว่าเซิร์ฟเวอร์ปลายทางมีสิ่งต่อไปนี้:

- Node.js
- npm
- MySQL

ตรวจสอบเวอร์ชัน:

```bash
node -v
npm -v
mysql --version
```

## ขั้นตอนที่ 1: ดึง Source Code

Clone repository:

```bash
git clone https://github.com/punnawichplub2547-boop/my-itapp.git
cd my-itapp
```

## ขั้นตอนที่ 2: สร้างฐานข้อมูล MySQL

เปิด MySQL แล้วสร้างฐานข้อมูลใหม่:

```sql
CREATE DATABASE repairlink;
USE repairlink;
```

จากนั้นสร้างตารางที่จำเป็นตามไฟล์ต่อไปนี้:

- `docs/device-database.md`
- `docs/repair-ticket-database.md`
- `docs/migrations/create_device_repair_events.sql`

ถ้าต้องการให้เลข ticket เริ่มใหม่ ให้ใช้ฐานข้อมูลว่างชุดใหม่ และไม่ต้อง import ข้อมูลเก่าจากตาราง `repair_tickets`

## ขั้นตอนที่ 3: เตรียม Environment Variables

สร้างไฟล์ `.env.production` โดยอ้างอิงจากไฟล์ `.env.production.example`

ค่าขั้นต่ำที่ต้องกำหนด:

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

## ขั้นตอนที่ 4: ติดตั้ง Dependencies

```bash
npm install
```

## ขั้นตอนที่ 5: Build แอป

```bash
npm run build
```

## ขั้นตอนที่ 6: เริ่มรันแอป

```bash
npm run start
```

โดยค่าเริ่มต้น แอปจะรันที่ port `3000`

เปิดใช้งานผ่าน:

- `http://<server-ip>:3000`

## ขั้นตอนที่ 7: Checklist สำหรับตรวจสอบ

หลังจากเริ่มรันแอปแล้ว ให้ตรวจสอบว่า:

1. Login ใช้งานได้
2. เปิดหน้า Dashboard ได้
3. หน้า Device Inventory โหลดข้อมูลจาก MySQL ได้
4. สร้าง Repair Request ได้
5. เปิดหน้า Repair Status ได้ และอัปเดตสถานะ ticket ได้
6. เปิดหน้า Reports ได้
7. เปิดหน้า Warranty Audit ได้

## ทางเลือกเพิ่มเติม: รันเป็น Process ระยะยาว

ตัวเลือกที่แนะนำ:

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

## ทางเลือกเพิ่มเติม: Docker

มีไฟล์สำหรับรองรับ Docker อยู่แล้ว:

- `Dockerfile`
- `.dockerignore`

Docker เป็นทางเลือกเพิ่มเติม และไม่จำเป็นสำหรับการส่งต่องานครั้งนี้
