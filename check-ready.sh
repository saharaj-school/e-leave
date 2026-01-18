#!/bin/bash
# สคริปต์ตรวจสอบความพร้อมก่อน Deploy

echo "🔍 กำลังตรวจสอบความพร้อมของระบบ..."
echo ""

# สีสำหรับ output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

# ตรวจสอบไฟล์หลัก
echo "📁 ตรวจสอบไฟล์หลัก..."
files=(
    "index.html"
    "admin-login.html"
    "admin-dashboard.html"
    "teacher-leave.html"
    "setup.html"
    "calendar-view.html"
    "css/admin-dashboard.css"
    "js/admin-dashboard.js"
    "js/notifications.js"
    "js/utils.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file (ไม่พบไฟล์)"
        ((errors++))
    fi
done

echo ""

# ตรวจสอบ Firebase Config
echo "🔥 ตรวจสอบ Firebase Config..."

if grep -q "AIzaSyCFyb7qu110Nt2_MhRXK-AlSvu1Hhj2cJU" index.html; then
    echo -e "${YELLOW}⚠️${NC}  Firebase Config ยังเป็น Default (ต้องแทนที่)"
    ((warnings++))
else
    echo -e "${GREEN}✅${NC} Firebase Config ถูกแทนที่แล้ว"
fi

echo ""

# ตรวจสอบ Line Token
echo "💬 ตรวจสอบ Line Notify Token..."

if [ -f "js/admin-dashboard.js" ]; then
    if grep -q "const LINE_NOTIFY_TOKEN = '';" js/admin-dashboard.js; then
        echo -e "${YELLOW}⚠️${NC}  Line Token ยังว่างเปล่า (ตั้งค่าทีหลังได้)"
        ((warnings++))
    else
        echo -e "${GREEN}✅${NC} Line Token ถูกตั้งค่าแล้ว"
    fi
fi

echo ""

# ตรวจสอบโครงสร้าง
echo "📂 ตรวจสอบโครงสร้างโฟลเดอร์..."
folders=("css" "js" "docs" "assets")

for folder in "${folders[@]}"; do
    if [ -d "$folder" ]; then
        echo -e "${GREEN}✅${NC} $folder/"
    else
        echo -e "${RED}❌${NC} $folder/ (ไม่พบโฟลเดอร์)"
        ((errors++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $errors -eq 0 ]; then
    echo -e "${GREEN}🎉 ระบบพร้อม Deploy!${NC}"
    echo ""
    if [ $warnings -gt 0 ]; then
        echo -e "${YELLOW}📝 มี $warnings คำเตือน (ไม่จำเป็นต้องแก้ก่อน Deploy)${NC}"
    fi
    echo ""
    echo "ขั้นตอนถัดไป:"
    echo "1. แก้ไข Firebase Config (ถ้ายังไม่ได้แก้)"
    echo "2. รัน: firebase deploy --only hosting"
    echo "3. หรือ upload ไฟล์ทั้งหมดไปยัง hosting"
else
    echo -e "${RED}❌ พบข้อผิดพลาด $errors รายการ${NC}"
    echo "กรุณาแก้ไขก่อน Deploy"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
