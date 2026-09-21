# เว็บสำรวจโคมไฟสาธารณะ น้ำพอง — GitHub + Vercel

เว็บ Next.js สำหรับมือถือ มีแผนที่ 351 จุดตามข้อมูล `app/lights.json`, ค้นหาตำบล/Location/PEA, ตำแหน่งมือถือ, บันทึก–แก้ไข–ลบผลสำรวจ และหน้ารายงาน/CSV สถานะส่วนกลางอยู่ใน Postgres; ทุกคนในทีมเห็นการเปลี่ยนแปลงภายในประมาณ 5 วินาที การบันทึกใช้ `revision` เพื่อป้องกันการเขียนทับเมื่อสองคนแก้จุดเดียวกัน

## 1. อัปขึ้น GitHub

แตก ZIP แล้วอัป **เนื้อหาภายในโฟลเดอร์นี้** เป็น repository ใหม่ (เช่น `pea-namphong-lights`) อย่าอัปไฟล์ `.env.local`, รหัสทีม หรือ URL ฐานข้อมูลขึ้น GitHub ไฟล์ `.gitignore` ตั้งไว้แล้วให้ข้ามไฟล์เหล่านี้

## 2. เตรียมฐานข้อมูล

สร้าง Postgres ที่รองรับ Vercel เช่น Neon ผ่าน Vercel Marketplace แล้วคัดลอก connection string แบบ `postgresql://...` มาใช้เป็น `DATABASE_URL` ตาราง `survey_status` จะสร้างอัตโนมัติเมื่อเว็บเชื่อมฐานข้อมูลครั้งแรก หรือจะรัน `schema.sql` ใน SQL editor ก่อนก็ได้

## 3. ตั้งค่า Vercel

เลือก **Add New Project → Import Git Repository** แล้วเลือก repository นี้ Framework Preset ควรเป็น **Next.js**; Root Directory คือราก repository, Build Command คือ `npm run build`

เพิ่ม Environment Variables ใน Vercel ก่อน Deploy:

| ชื่อ | ค่า |
| --- | --- |
| `DATABASE_URL` | Postgres connection string จากฐานข้อมูล |
| `TEAM_ACCESS_CODE` | รหัสทีมที่สุ่มยาวอย่างน้อย 12 ตัวอักษร แล้วแจ้งเฉพาะทีม |
| `SESSION_SECRET` | ค่าสุ่มอีกชุดหนึ่ง ยาวอย่างน้อย 32 ตัวอักษร **ห้ามใช้ค่าเดียวกับรหัสทีม** |

ตั้งค่าทั้ง Production และ Preview หากต้องการทดสอบ Preview ด้วย จากนั้น Deploy และเปิด URL ที่ Vercel ให้มา ผู้ใช้บน iPhone เปิด URL นี้ใน Safari, กรอกชื่อและรหัสทีมครั้งแรก จากนั้นกลับเข้าเว็บได้ด้วย session เดิมนาน 14 วัน

**สำคัญ:** รหัสทีมเป็นรหัสร่วม ผู้ที่รู้รหัสและ URL จะเข้าถึงพิกัดและแก้ไขผลสำรวจได้ ไม่ใช่การตรวจสมาชิก ChatGPT Workspace หากรหัสรั่วให้เปลี่ยน `TEAM_ACCESS_CODE` และ `SESSION_SECRET` ใน Vercel แล้ว Redeploy เพื่อออกจากระบบทุกเครื่อง

## 4. นำเข้าผลสำรวจจากเว็บเดิม (ถ้าต้องการ)

เว็บใหม่นี้ **ไม่ดึงสถานะจากเว็บเดิมโดยอัตโนมัติ** ก่อนย้ายการใช้งาน ให้เปิดหน้ารายงานของเว็บเดิมแล้วกด **ดาวน์โหลด CSV** จากนั้นรันคำสั่งต่อไปนี้บนคอมพิวเตอร์ที่มี Node.js 22+

```powershell
Copy-Item .env.example .env.local
# แก้ .env.local ด้วยค่าจริง; อย่า commit ไฟล์นี้
npm ci
$env:DATABASE_URL = 'postgresql://...'
npm run import:report -- 'C:\path\to\report.csv'
```

คำสั่งจะนำเข้าเฉพาะแถวที่ระบุว่า “สำรวจแล้ว” และ **ไม่เขียนทับ** ผลสำรวจที่มีอยู่ในฐานข้อมูลใหม่ ผลที่บันทึกเป็น “ยังไม่สำรวจ” ในเว็บเดิมแยกจากจุดที่ยังไม่เคยบันทึกไม่ได้จาก CSV รายงาน จึงไม่ถูกนำเข้า

## ทดสอบในเครื่อง

```powershell
npm ci
Copy-Item .env.example .env.local
# แก้ 3 ค่าจริงใน .env.local
npm run dev
```

เปิด `http://localhost:3000` หากยังไม่ตั้ง `DATABASE_URL` เว็บจะเข้าหน้า Login ได้ แต่จะโหลดสถานะสำรวจไม่ได้

ข้อมูลเพิ่มเติม: [Vercel Postgres integrations](https://vercel.com/docs/postgres), [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver), [Next.js deployment](https://nextjs.org/docs/app/guides/deploying)
