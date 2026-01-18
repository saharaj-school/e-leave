// notifications.js - ระบบแจ้งเตือนแบบครบวงจร
// รองรับ Line Notify และ EmailJS

class NotificationManager {
    constructor(config = {}) {
        this.lineToken = config.lineToken || '';
        this.emailJsServiceId = config.emailJsServiceId || '';
        this.emailJsTemplateId = config.emailJsTemplateId || '';
        this.emailJsPublicKey = config.emailJsPublicKey || '';
        
        // เตรียม EmailJS
        if (this.emailJsPublicKey) {
            emailjs.init(this.emailJsPublicKey);
        }
    }

    // ส่ง Line Notify
    async sendLineNotification(message) {
        if (!this.lineToken) {
            console.warn('Line Notify Token not configured');
            return { success: false, error: 'No token' };
        }

        try {
            const response = await fetch('https://notify-api.line.me/api/notify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.lineToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `message=${encodeURIComponent(message)}`
            });

            if (response.ok) {
                return { success: true };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('Line Notify Error:', error);
            return { success: false, error: error.message };
        }
    }

    // ส่ง Email
    async sendEmail(params) {
        if (!this.emailJsServiceId || !this.emailJsTemplateId) {
            console.warn('EmailJS not configured');
            return { success: false, error: 'Email not configured' };
        }

        try {
            const response = await emailjs.send(
                this.emailJsServiceId,
                this.emailJsTemplateId,
                params
            );
            
            return { success: true, response };
        } catch (error) {
            console.error('Email Error:', error);
            return { success: false, error: error.message };
        }
    }

    // แจ้งเตือนคำขอลาใหม่
    async notifyNewLeaveRequest(leaveData) {
        const { userName, leaveType, startDate, endDate, days, reason } = leaveData;

        // Line Message
        const lineMessage = `
🔔 มีคำขอลาใหม่!

👤 ชื่อ: ${userName}
📋 ประเภท: ${leaveType}
📅 วันที่: ${startDate} ถึง ${endDate}
⏰ จำนวน: ${days} วัน
📝 เหตุผล: ${reason}

กรุณาพิจารณาอนุมัติด้วยค่ะ 🙏
        `.trim();

        // ส่ง Line
        const lineResult = await this.sendLineNotification(lineMessage);

        // ส่ง Email (ถ้ามี)
        if (leaveData.userEmail) {
            const emailParams = {
                to_email: leaveData.adminEmail || 'admin@school.com',
                to_name: 'ผู้อำนวยการ',
                teacher_name: userName,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                days: days,
                reason: reason,
                status: 'รอการอนุมัติ'
            };
            await this.sendEmail(emailParams);
        }

        return lineResult;
    }

    // แจ้งผลการอนุมัติ
    async notifyLeaveApproved(leaveData) {
        const { userName, userEmail, leaveType, startDate, endDate, days, approvedBy, note } = leaveData;

        // Line Message
        const lineMessage = `
✅ คำขอลาได้รับการอนุมัติ

👤 ชื่อ: ${userName}
📋 ประเภท: ${leaveType}
📅 วันที่: ${startDate} ถึง ${endDate}
⏰ จำนวน: ${days} วัน
👨‍💼 อนุมัติโดย: ${approvedBy}
${note ? `📝 หมายเหตุ: ${note}` : ''}

ขอให้มีความสุขกับวันลาค่ะ! 🎉
        `.trim();

        const lineResult = await this.sendLineNotification(lineMessage);

        // ส่ง Email ถึงครู
        if (userEmail) {
            const emailParams = {
                to_email: userEmail,
                to_name: userName,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                days: days,
                status: 'อนุมัติแล้ว',
                approved_by: approvedBy,
                note: note || 'ไม่มีหมายเหตุเพิ่มเติม'
            };
            await this.sendEmail(emailParams);
        }

        return lineResult;
    }

    // แจ้งผลการปฏิเสธ
    async notifyLeaveRejected(leaveData) {
        const { userName, userEmail, leaveType, startDate, endDate, days, rejectedBy, reason } = leaveData;

        // Line Message
        const lineMessage = `
❌ คำขอลาถูกปฏิเสธ

👤 ชื่อ: ${userName}
📋 ประเภท: ${leaveType}
📅 วันที่: ${startDate} ถึง ${endDate}
⏰ จำนวน: ${days} วัน
👨‍💼 ปฏิเสธโดย: ${rejectedBy}
📝 เหตุผล: ${reason}

กรุณาติดต่อผู้บริหารเพื่อสอบถามรายละเอียดเพิ่มเติมค่ะ
        `.trim();

        const lineResult = await this.sendLineNotification(lineMessage);

        // ส่ง Email ถึงครู
        if (userEmail) {
            const emailParams = {
                to_email: userEmail,
                to_name: userName,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                days: days,
                status: 'ปฏิเสธ',
                rejected_by: rejectedBy,
                reason: reason
            };
            await this.sendEmail(emailParams);
        }

        return lineResult;
    }

    // แจ้งครูแทน
    async notifySubstituteTeacher(data) {
        const { substituteName, substituteEmail, teacherName, leaveType, date, subject } = data;

        const lineMessage = `
🔔 มีการขอให้ท่านเป็นครูแทน

👤 ครูที่ลา: ${teacherName}
📋 ประเภทการลา: ${leaveType}
📅 วันที่: ${date}
📚 วิชา/งานที่ต้องทำแทน: ${subject || 'ดูรายละเอียดในระบบ'}

กรุณาเข้าระบบเพื่อรับหรือปฏิเสธ
        `.trim();

        const lineResult = await this.sendLineNotification(lineMessage);

        if (substituteEmail) {
            const emailParams = {
                to_email: substituteEmail,
                to_name: substituteName,
                teacher_name: teacherName,
                leave_type: leaveType,
                date: date,
                subject: subject || 'ดูรายละเอียดในระบบ'
            };
            await this.sendEmail(emailParams);
        }

        return lineResult;
    }

    // รายงานสรุปประจำวัน
    async sendDailySummary(summaryData) {
        const { date, totalLeaves, approvedLeaves, pendingLeaves, todayLeaves } = summaryData;

        const lineMessage = `
📊 สรุปการลาประจำวัน ${date}

📋 คำขอลาทั้งหมด: ${totalLeaves} รายการ
✅ อนุมัติแล้ว: ${approvedLeaves} รายการ
⏳ รอพิจารณา: ${pendingLeaves} รายการ
🏥 ลาวันนี้: ${todayLeaves} คน

${todayLeaves > 0 ? '\n👥 รายชื่อผู้ลาวันนี้:\n' + summaryData.todayLeavesList.map(l => `- ${l.name} (${l.type})`).join('\n') : ''}
        `.trim();

        return await this.sendLineNotification(lineMessage);
    }

    // รายงานสรุปรายสัปดาห์
    async sendWeeklySummary(summaryData) {
        const { weekStart, weekEnd, stats } = summaryData;

        const lineMessage = `
📊 สรุปการลารายสัปดาห์
📅 ${weekStart} - ${weekEnd}

📈 สถิติ:
- คำขอทั้งหมด: ${stats.total} รายการ
- อนุมัติ: ${stats.approved} รายการ
- ปฏิเสธ: ${stats.rejected} รายการ
- รอพิจารณา: ${stats.pending} รายการ

📋 ประเภทที่ลามากที่สุด:
${stats.topTypes.map((t, i) => `${i+1}. ${t.type}: ${t.count} ครั้ง`).join('\n')}
        `.trim();

        return await this.sendLineNotification(lineMessage);
    }

    // แจ้งเตือนวันลาใกล้หมด
    async notifyLowLeaveBalance(data) {
        const { userName, userEmail, leaveType, remaining, threshold } = data;

        const lineMessage = `
⚠️ วันลาเหลือน้อย!

👤 ชื่อ: ${userName}
📋 ประเภท: ${leaveType}
⏰ เหลือเพียง: ${remaining} วัน

กรุณาวางแผนการลาให้เหมาะสมค่ะ
        `.trim();

        const lineResult = await this.sendLineNotification(lineMessage);

        if (userEmail) {
            const emailParams = {
                to_email: userEmail,
                to_name: userName,
                leave_type: leaveType,
                remaining: remaining,
                threshold: threshold
            };
            await this.sendEmail(emailParams);
        }

        return lineResult;
    }

    // แจ้งเตือนปีงบประมาณใกล้สิ้นสุด
    async notifyFiscalYearEnd(data) {
        const { daysRemaining, resetDate } = data;

        const lineMessage = `
🔔 แจ้งเตือนปีงบประมาณ

⏰ เหลือเวลาอีก ${daysRemaining} วัน
📅 จะรีเซ็ตวันลาในวันที่: ${resetDate}

กรุณาตรวจสอบและใช้วันลาที่เหลือให้เหมาะสมค่ะ
        `.trim();

        return await this.sendLineNotification(lineMessage);
    }

    // แจ้งเตือน File Upload สำเร็จ
    async notifyFileUploaded(data) {
        const { userName, fileName, leaveId } = data;

        const lineMessage = `
✅ อัปโหลดไฟล์แนบสำเร็จ

👤 ผู้อัปโหลด: ${userName}
📎 ไฟล์: ${fileName}
🆔 รหัสใบลา: ${leaveId}

ไฟล์ถูกเก็บไว้ในระบบเรียบร้อยแล้ว
        `.trim();

        return await this.sendLineNotification(lineMessage);
    }

    // แจ้งเตือนระบบ (System Alerts)
    async sendSystemAlert(message, severity = 'info') {
        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '🚨',
            success: '✅'
        };

        const lineMessage = `
${icons[severity]} แจ้งเตือนจากระบบ

${message}

เวลา: ${new Date().toLocaleString('th-TH')}
        `.trim();

        return await this.sendLineNotification(lineMessage);
    }
}

// Export สำหรับใช้งาน
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}

// ตัวอย่างการใช้งาน
/*

// 1. สร้าง instance
const notifier = new NotificationManager({
    lineToken: 'YOUR_LINE_NOTIFY_TOKEN',
    emailJsServiceId: 'YOUR_EMAILJS_SERVICE_ID',
    emailJsTemplateId: 'YOUR_EMAILJS_TEMPLATE_ID',
    emailJsPublicKey: 'YOUR_EMAILJS_PUBLIC_KEY'
});

// 2. แจ้งคำขอลาใหม่
await notifier.notifyNewLeaveRequest({
    userName: 'นายสมชาย ใจดี',
    userEmail: 'somchai@school.com',
    adminEmail: 'admin@school.com',
    leaveType: 'ลาป่วย',
    startDate: '2024-01-15',
    endDate: '2024-01-16',
    days: 2,
    reason: 'ป่วยเป็นไข้'
});

// 3. แจ้งผลการอนุมัติ
await notifier.notifyLeaveApproved({
    userName: 'นายสมชาย ใจดี',
    userEmail: 'somchai@school.com',
    leaveType: 'ลาป่วย',
    startDate: '2024-01-15',
    endDate: '2024-01-16',
    days: 2,
    approvedBy: 'ผู้อำนวยการ วิชาชีพ',
    note: 'อนุมัติตามที่ขอ หายป่วยเร็วๆ นะครับ'
});

// 4. ส่งสรุปรายวัน
await notifier.sendDailySummary({
    date: '15 มกราคม 2024',
    totalLeaves: 15,
    approvedLeaves: 12,
    pendingLeaves: 3,
    todayLeaves: 5,
    todayLeavesList: [
        { name: 'นายสมชาย', type: 'ลาป่วย' },
        { name: 'นางสาวสมหญิง', type: 'ลากิจ' }
    ]
});

// 5. แจ้งเตือนระบบ
await notifier.sendSystemAlert(
    'ระบบจะปิดปรับปรุงวันที่ 20 มกราคม 2024 เวลา 18:00-22:00 น.',
    'warning'
);

*/
