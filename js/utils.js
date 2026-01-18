// utils.js - Helper Functions and Utilities

// ========================================
// DATE VALIDATION & CALCULATIONS
// ========================================

/**
 * ตรวจสอบว่าวันที่ถูกต้องหรือไม่
 */
function validateLeaveDate(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ห้ามลาย้อนหลัง
    if (start < today) {
        return {
            valid: false,
            message: 'ไม่สามารถเลือกวันที่ย้อนหลังได้'
        };
    }

    // วันสิ้นสุดต้องมากกว่าหรือเท่ากับวันเริ่มต้น
    if (end < start) {
        return {
            valid: false,
            message: 'วันสิ้นสุดต้องมากกว่าหรือเท่ากับวันเริ่มต้น'
        };
    }

    return { valid: true };
}

/**
 * คำนวณจำนวนวันลา (ไม่นับเสาร์-อาทิตย์)
 */
function calculateLeaveDays(startDate, endDate, excludeWeekends = true) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let days = 0;
    let current = new Date(start);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        
        // ถ้า excludeWeekends = true, ไม่นับเสาร์ (6) และอาทิตย์ (0)
        if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
            days++;
        }
        
        current.setDate(current.getDate() + 1);
    }

    return days;
}

/**
 * ตรวจสอบว่ามีวันลาซ้ำซ้อนหรือไม่
 */
function checkLeaveOverlap(newStart, newEnd, existingLeaves) {
    const start = new Date(newStart);
    const end = new Date(newEnd);

    for (const leave of existingLeaves) {
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);

        // ตรวจสอบการทับซ้อน
        if (
            (start >= leaveStart && start <= leaveEnd) ||
            (end >= leaveStart && end <= leaveEnd) ||
            (start <= leaveStart && end >= leaveEnd)
        ) {
            return {
                hasOverlap: true,
                conflictingLeave: leave
            };
        }
    }

    return { hasOverlap: false };
}

/**
 * ตรวจสอบวันลาคงเหลือ
 */
function checkLeaveBalance(leaveType, days, userLeaveData) {
    const balanceMap = {
        'ลาป่วย': userLeaveData.sickLeaveRemaining || 30,
        'ลาคลอดบุตร': userLeaveData.maternityLeaveRemaining || 90,
        'ลาช่วยเหลือภริยาคลอดบุตร': userLeaveData.helpWifeLeaveRemaining || 15,
        'ลากิจส่วนตัว': userLeaveData.personalLeaveRemaining || 45,
        'ลาพักผ่อน': userLeaveData.vacationLeaveRemaining || 10,
        'ลาอุปสมบท': userLeaveData.ordinationLeaveRemaining || 120,
        'ลาศึกษา': userLeaveData.studyLeaveRemaining || 365,
        'ลาปฏิบัติงานองค์การระหว่างประเทศ': userLeaveData.intlOrgLeaveRemaining || 365,
        'ลาฟื้นฟูสมรรถภาพ': userLeaveData.rehabilitationLeaveRemaining || 365,
        'ลาติดตามคู่สมรส': userLeaveData.followSpouseLeaveRemaining || 365,
        'ลาปฏิบัติงานในหน่วยงานอื่น': userLeaveData.otherWorkLeaveRemaining || 365
    };

    const remaining = balanceMap[leaveType] || 0;

    if (days > remaining) {
        return {
            sufficient: false,
            remaining: remaining,
            requested: days,
            shortage: days - remaining
        };
    }

    return {
        sufficient: true,
        remaining: remaining,
        requested: days
    };
}

// ========================================
// FILE UPLOAD VALIDATION
// ========================================

/**
 * ตรวจสอบไฟล์ที่อัปโหลด
 */
function validateFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5 MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (!file) {
        return { valid: false, message: 'กรุณาเลือกไฟล์' };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            message: `ไฟล์มีขนาดใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(2)} MB) สูงสุด 5 MB`
        };
    }

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            message: 'ประเภทไฟล์ไม่ถูกต้อง กรุณาอัปโหลด JPG, PNG หรือ PDF เท่านั้น'
        };
    }

    return { valid: true };
}

/**
 * แปลงไฟล์เป็น Base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========================================
// FORMATTING HELPERS
// ========================================

/**
 * Format วันที่แบบไทย
 */
function formatThaiDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format วันที่แบบสั้น
 */
function formatShortDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Format เวลา
 */
function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format วันที่และเวลา
 */
function formatDateTime(date) {
    return `${formatThaiDate(date)} เวลา ${formatTime(date)}`;
}

/**
 * Format จำนวนวัน
 */
function formatDays(days) {
    return `${days} ${days === 1 ? 'วัน' : 'วัน'}`;
}

// ========================================
// LEAVE TYPE HELPERS
// ========================================

/**
 * ดึง icon ตามประเภทการลา
 */
function getLeaveTypeIcon(type) {
    const icons = {
        'ลาป่วย': '🏥',
        'ลาคลอดบุตร': '👶',
        'ลาช่วยเหลือภริยาคลอดบุตร': '🤱',
        'ลากิจส่วนตัว': '📝',
        'ลาพักผ่อน': '🏖️',
        'ลาอุปสมบท': '🙏',
        'ลาศึกษา': '📚',
        'ลาปฏิบัติงานองค์การระหว่างประเทศ': '🌏',
        'ลาฟื้นฟูสมรรถภาพ': '💪',
        'ลาติดตามคู่สมรส': '✈️',
        'ลาปฏิบัติงานในหน่วยงานอื่น': '🏛️'
    };
    return icons[type] || '📋';
}

/**
 * ดึงสีตามประเภทการลา
 */
function getLeaveTypeColor(type) {
    const colors = {
        'ลาป่วย': { main: '#ef4444', light: '#fee2e2' },
        'ลาคลอดบุตร': { main: '#ec4899', light: '#fce7f3' },
        'ลาช่วยเหลือภริยาคลอดบุตร': { main: '#f59e0b', light: '#fef3c7' },
        'ลากิจส่วนตัว': { main: '#3b82f6', light: '#dbeafe' },
        'ลาพักผ่อน': { main: '#10b981', light: '#d1fae5' },
        'ลาอุปสมบท': { main: '#06b6d4', light: '#cffafe' },
        'ลาศึกษา': { main: '#8b5cf6', light: '#ede9fe' },
        'ลาปฏิบัติงานองค์การระหว่างประเทศ': { main: '#14b8a6', light: '#ccfbf1' },
        'ลาฟื้นฟูสมรรถภาพ': { main: '#f97316', light: '#ffedd5' },
        'ลาติดตามคู่สมรส': { main: '#6366f1', light: '#e0e7ff' },
        'ลาปฏิบัติงานในหน่วยงานอื่น': { main: '#64748b', light: '#f1f5f9' }
    };
    return colors[type] || { main: '#64748b', light: '#f1f5f9' };
}

// ========================================
// STATUS HELPERS
// ========================================

/**
 * ดึง badge สำหรับสถานะ
 */
function getStatusBadge(status) {
    const badges = {
        'รอการอนุมัติ': {
            class: 'status-pending',
            icon: '⏳',
            text: 'รอการอนุมัติ'
        },
        'อนุมัติแล้ว': {
            class: 'status-approved',
            icon: '✅',
            text: 'อนุมัติแล้ว'
        },
        'ปฏิเสธ': {
            class: 'status-rejected',
            icon: '❌',
            text: 'ปฏิเสธ'
        }
    };
    return badges[status] || badges['รอการอนุมัติ'];
}

// ========================================
// EXPORT HELPERS
// ========================================

/**
 * Export ข้อมูลเป็น CSV
 */
function exportToCSV(data, filename) {
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

/**
 * Export ข้อมูลเป็น JSON
 */
function exportToJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// ========================================
// PRINT HELPERS
// ========================================

/**
 * พิมพ์เอกสาร
 */
function printDocument(content, title) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body {
                    font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
                    padding: 20px;
                }
                @media print {
                    @page {
                        margin: 2cm;
                    }
                }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// ========================================
// NOTIFICATION HELPERS
// ========================================

/**
 * แสดง Toast Notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add toast styles if not exist
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }
            .toast-info { background: #3b82f6; }
            .toast-success { background: #10b981; }
            .toast-warning { background: #f59e0b; }
            .toast-error { background: #ef4444; }
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========================================
// AUDIT LOG HELPERS
// ========================================

/**
 * บันทึก Audit Log
 */
async function logAudit(action, details, db) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || sessionStorage.getItem('currentAdmin'));
    
    if (!currentUser) return;

    const auditLog = {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: action,
        details: details,
        timestamp: new Date().toISOString(),
        ipAddress: await getClientIP(),
        userAgent: navigator.userAgent
    };

    try {
        // ใช้ Firebase เพื่อบันทึก
        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        await addDoc(collection(db, 'audit_logs'), auditLog);
    } catch (error) {
        console.error('Error logging audit:', error);
    }
}

/**
 * ดึง IP Address ของ Client
 */
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

// ========================================
// FISCAL YEAR HELPERS
// ========================================

/**
 * คำนวณจำนวนวันที่เหลือจนถึงสิ้นปีงบประมาณ
 */
function daysUntilFiscalYearEnd(fiscalYearStart = '10-01') {
    const now = new Date();
    const [month, day] = fiscalYearStart.split('-').map(Number);
    
    let fiscalEnd = new Date(now.getFullYear(), month - 1, day);
    if (fiscalEnd <= now) {
        fiscalEnd = new Date(now.getFullYear() + 1, month - 1, day);
    }
    
    const diff = fiscalEnd - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * ตรวจสอบว่าใกล้สิ้นปีงบประมาณหรือไม่
 */
function isNearFiscalYearEnd(threshold = 30) {
    const daysRemaining = daysUntilFiscalYearEnd();
    return {
        isNear: daysRemaining <= threshold,
        daysRemaining: daysRemaining
    };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generate random ID
 */
function generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Group array by key
 */
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const group = item[key];
        if (!result[group]) {
            result[group] = [];
        }
        result[group].push(item);
        return result;
    }, {});
}

/**
 * Sort array by date
 */
function sortByDate(array, dateKey, ascending = false) {
    return array.sort((a, b) => {
        const dateA = new Date(a[dateKey]);
        const dateB = new Date(b[dateKey]);
        return ascending ? dateA - dateB : dateB - dateA;
    });
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateLeaveDate,
        calculateLeaveDays,
        checkLeaveOverlap,
        checkLeaveBalance,
        validateFile,
        fileToBase64,
        formatThaiDate,
        formatShortDate,
        formatTime,
        formatDateTime,
        formatDays,
        getLeaveTypeIcon,
        getLeaveTypeColor,
        getStatusBadge,
        exportToCSV,
        exportToJSON,
        printDocument,
        showToast,
        logAudit,
        getClientIP,
        daysUntilFiscalYearEnd,
        isNearFiscalYearEnd,
        debounce,
        generateId,
        deepClone,
        groupBy,
        sortByDate
    };
}
