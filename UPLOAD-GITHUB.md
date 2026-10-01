# วิธีอัปโหลดเว็บสำรวจมิเตอร์ไฟสาธารณะ

1. แตกไฟล์ public-light-meter-github.zip
2. เปิด repository ใน GitHub หรือสร้างใหม่ชื่อ public-light-meter
3. กด Add file → Upload files
4. ลากไฟล์และโฟลเดอร์ข้างใน ZIP ทั้งหมดลงหน้า Upload files ไม่ต้องอัปโหลดตัว ZIP และไม่ต้องครอบด้วยโฟลเดอร์อีกชั้น
5. ตรวจว่า package.json, package-lock.json และโฟลเดอร์ app อยู่ที่หน้าแรกของ repository
6. กด Commit changes
7. ใน Vercel กด Add New → Project → เลือก repository → Import
8. Framework Preset เลือก Next.js และ Root Directory ใช้ค่าเริ่มต้น Build/Output Directory ใช้ค่าอัตโนมัติ
9. เชื่อม Neon ผ่าน Storage ให้มี DATABASE_URL สำหรับ Production และ Preview ถ้ามี Neon เดิมให้เชื่อมของเดิมได้
10. กด Deploy ถ้าตั้ง DATABASE_URL หลัง Deploy ให้กด Redeploy อีกครั้ง

ถ้าอัปโหลดทับ repository เดิม ให้ใช้โครงสร้างเดียวกันและแทนไฟล์ที่ชื่อซ้ำทุกไฟล์ ผลสำรวจในฐานข้อมูลเดิมยังอยู่เพราะชุดนี้ใช้ตารางเดิมของเว็บมิเตอร์

ไฟล์ .env.example เป็นเพียงตัวอย่าง ไม่ใช่รหัสฐานข้อมูลจริง ให้ตั้งค่าจริงใน Vercel Environment Variables

หน้าเว็บเปิดดูได้ทันทีหลัง Deploy แต่การบันทึกผลสำรวจและการแสดงตำแหน่งทีมข้ามเครื่องต้องเชื่อมฐานข้อมูลก่อน ดูรายละเอียดเพิ่มเติมใน README.md
