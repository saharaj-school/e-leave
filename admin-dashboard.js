// Admin Dashboard Script - Version 2
// Updated with all 11 leave types support and table-based personnel management

(async function() {
    try {
        // Dynamically import Firebase modules
        const firebaseApp = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const firebaseFirestore = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const firebaseAnalytics = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js');

        const { initializeApp } = firebaseApp;
        const { 
            getFirestore, collection, query, where, orderBy, 
            onSnapshot, getDocs, doc, getDoc, updateDoc, 
            setDoc, deleteDoc 
        } = firebaseFirestore;
        const { getAnalytics } = firebaseAnalytics;

        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyCFyb7qu110Nt2_MhRXK-AlSvu1Hhj2cJU",
            authDomain: "e-leave-service.firebaseapp.com",
            projectId: "e-leave-service",
            storageBucket: "e-leave-service.firebasestorage.app",
            messagingSenderId: "936880215366",
            appId: "1:936880215366:web:dbd883b0ce4b03df4ec147",
            measurementId: "G-N2Y7J3P6MP"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const analytics = getAnalytics(app);

        // Check admin authentication
        const currentAdminData = sessionStorage.getItem('currentAdmin');
        if (!currentAdminData) {
            window.location.href = 'admin-login.html';
            return;
        }

        const currentAdmin = JSON.parse(currentAdminData);
        const currentAdminName = currentAdmin.name;

        // Update admin display
        function updateAdminDisplay() {
            const adminAvatar = document.querySelector('.admin-info .admin-avatar');
            const adminNameElement = document.querySelectorAll('.admin-info > div > div')[0];
            
            if (adminAvatar) adminAvatar.textContent = currentAdmin.name.charAt(0);
            if (adminNameElement) adminNameElement.textContent = currentAdmin.name;
        }

        // Get leave type style
        function getLeaveTypeStyle(type) {
            const styles = {
                'ลาป่วย': { icon: '🏥', color: '#ef4444', bg: '#fee2e2' },
                'ลาคลอดบุตร': { icon: '👶', color: '#ec4899', bg: '#fce7f3' },
                'ลาช่วยเหลือภริยาคลอดบุตร': { icon: '🤱', color: '#f59e0b', bg: '#fef3c7' },
                'ลากิจส่วนตัว': { icon: '📝', color: '#3b82f6', bg: '#dbeafe' },
                'ลาพักผ่อน': { icon: '🏖️', color: '#10b981', bg: '#d1fae5' },
                'ลาอุปสมบท': { icon: '🙏', color: '#06b6d4', bg: '#cffafe' },
                'ลาศึกษา': { icon: '📚', color: '#8b5cf6', bg: '#ede9fe' },
                'ลาปฏิบัติงานองค์การระหว่างประเทศ': { icon: '🌏', color: '#14b8a6', bg: '#ccfbf1' },
                'ลาฟื้นฟูสมรรถภาพ': { icon: '💪', color: '#f97316', bg: '#ffedd5' },
                'ลาติดตามคู่สมรส': { icon: '✈️', color: '#6366f1', bg: '#e0e7ff' },
                'ลาปฏิบัติงานในหน่วยงานอื่น': { icon: '🏛️', color: '#64748b', bg: '#f1f5f9' }
            };
            return styles[type] || { icon: '📋', color: '#64748b', bg: '#f1f5f9' };
        }

        // Global variables
        let allLeaves = [];

        // Logout function
        window.logout = function() {
            if (confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
                sessionStorage.removeItem('currentAdmin');
                window.location.href = 'admin-login.html';
            }
        };

        // Toggle mobile menu
        window.toggleMenu = function() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('mobile-show');
        };

        // Switch navigation tabs
        window.switchTab = function(tabName, clickedElement) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('mobile-show');

            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            if (clickedElement && clickedElement.closest) {
                clickedElement.closest('.nav-item').classList.add('active');
            }

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const targetTab = document.getElementById(tabName);
            if (targetTab) targetTab.classList.add('active');

            const titles = {
                'dashboard': 'แดชบอร์ด',
                'approvals': 'อนุมัติการลา',
                'personnel': 'จัดการบุคลากร',
                'reports': 'รายงานสรุป',
                'settings': 'ตั้งค่า'
            };
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) pageTitle.textContent = titles[tabName];

            if (tabName === 'approvals') loadApprovalsData();
            if (tabName === 'personnel') loadPersonnelData();
            if (tabName === 'reports') loadReportsData();
        };

        // Update user leave balance
        async function updateUserLeaveBalance(userId, leaveType, days) {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const updates = {};

                switch(leaveType) {
                    case 'ลาป่วย':
                        updates.sickLeaveRemaining = (userData.sickLeaveRemaining || 30) + days;
                        break;
                    case 'ลาคลอดบุตร':
                        updates.maternityLeaveRemaining = (userData.maternityLeaveRemaining || 90) + days;
                        break;
                    case 'ลาช่วยเหลือภริยาคลอดบุตร':
                        updates.helpWifeLeaveRemaining = (userData.helpWifeLeaveRemaining || 15) + days;
                        break;
                    case 'ลากิจส่วนตัว':
                        updates.personalLeaveRemaining = (userData.personalLeaveRemaining || 45) + days;
                        break;
                    case 'ลาพักผ่อน':
                        updates.vacationLeaveRemaining = (userData.vacationLeaveRemaining || 10) + days;
                        break;
                    case 'ลาอุปสมบท':
                        updates.ordinationLeaveRemaining = (userData.ordinationLeaveRemaining || 120) + days;
                        break;
                    case 'ลาศึกษา':
                        updates.studyLeaveRemaining = (userData.studyLeaveRemaining || 365) + days;
                        break;
                    case 'ลาปฏิบัติงานองค์การระหว่างประเทศ':
                        updates.internationalLeaveRemaining = (userData.internationalLeaveRemaining || 730) + days;
                        break;
                    case 'ลาฟื้นฟูสมรรถภาพ':
                        updates.rehabLeaveRemaining = (userData.rehabLeaveRemaining || 180) + days;
                        break;
                    case 'ลาติดตามคู่สมรส':
                        updates.followSpouseLeaveRemaining = (userData.followSpouseLeaveRemaining || 365) + days;
                        break;
                    case 'ลาปฏิบัติงานในหน่วยงานอื่น':
                        updates.workOtherLeaveRemaining = (userData.workOtherLeaveRemaining || 365) + days;
                        break;
                }

                if (Object.keys(updates).length > 0) {
                    await updateDoc(userRef, updates);
                }
            }
        }

        // Approve leave
        window.approveLeave = async function(button) {
            if (!confirm('ยืนยันการอนุมัติใบลานี้?')) return;

            const row = button.closest('tr');
            const leaveId = row.dataset.leaveId;

            try {
                const leaveRef = doc(db, 'leaves', leaveId);
                await updateDoc(leaveRef, {
                    status: 'อนุมัติแล้ว',
                    approvedBy: currentAdminName,
                    approvedDate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

                const leaveDoc = await getDoc(leaveRef);
                const leaveData = leaveDoc.data();
                await updateUserLeaveBalance(leaveData.userId, leaveData.type, -leaveData.days);

                alert('✅ อนุมัติใบลาเรียบร้อยแล้ว');
                updateDashboardStats();
            } catch (error) {
                console.error('Error approving leave:', error);
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            }
        };

        // Reject leave
        window.rejectLeave = async function(button) {
            const reason = prompt('กรุณาระบุเหตุผลที่ไม่อนุมัติ:');
            if (!reason) return;

            const row = button.closest('tr');
            const leaveId = row.dataset.leaveId;

            try {
                await updateDoc(doc(db, 'leaves', leaveId), {
                    status: 'ไม่อนุมัติ',
                    rejectedBy: currentAdminName,
                    rejectedDate: new Date().toISOString(),
                    adminNote: reason,
                    updatedAt: new Date().toISOString()
                });

                alert('❌ ไม่อนุมัติใบลาเรียบร้อยแล้ว');
                updateDashboardStats();
            } catch (error) {
                console.error('Error rejecting leave:', error);
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            }
        };

        // Update dashboard statistics - FIXED
        async function updateDashboardStats() {
            try {
                const usersSnapshot = await getDocs(collection(db, 'users'));
                let totalPersonnel = 0;
                usersSnapshot.forEach(docSnap => {
                    const userData = docSnap.data();
                    if (userData.role === 'teacher') {
                        totalPersonnel++;
                    }
                });

                const pendingQuery = query(collection(db, 'leaves'), where('status', '==', 'รออนุมัติ'));
                const pendingSnapshot = await getDocs(pendingQuery);
                const pendingCount = pendingSnapshot.size;

                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                firstDayOfMonth.setHours(0, 0, 0, 0);
                
                let approvedCount = 0;
                const allLeavesSnapshot = await getDocs(collection(db, 'leaves'));
                
                allLeavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว' && leave.approvedDate) {
                        const approvedDate = new Date(leave.approvedDate);
                        if (approvedDate >= firstDayOfMonth) {
                            approvedCount++;
                        }
                    }
                });

                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);
                
                let todayCount = 0;
                allLeavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว') {
                        const start = new Date(leave.startDate);
                        const end = new Date(leave.endDate);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        if (start <= todayEnd && end >= todayStart) {
                            todayCount++;
                        }
                    }
                });

                const statBoxes = document.querySelectorAll('.stats-overview .stat-box .stat-number');
                if (statBoxes.length >= 4) {
                    statBoxes[0].textContent = totalPersonnel;
                    statBoxes[1].textContent = pendingCount;
                    statBoxes[2].textContent = approvedCount;
                    statBoxes[3].textContent = todayCount;
                }
            } catch (error) {
                console.error('Error updating stats:', error);
            }
        }

        // Load daily report
        window.loadDailyReport = async function() {
            const selectedDate = document.getElementById('dailyReportDate').value;
            if (!selectedDate) {
                alert('⚠️ กรุณาเลือกวันที่');
                return;
            }

            const reportDiv = document.getElementById('dailyReportContent');
            reportDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);"><div style="border: 2px solid var(--border); border-top: 2px solid var(--primary); border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; margin: 0 auto 10px;"></div>กำลังโหลด...</div>';

            try {
                const leavesSnapshot = await getDocs(collection(db, 'leaves'));
                const selectedDateObj = new Date(selectedDate);
                selectedDateObj.setHours(0, 0, 0, 0);
                
                const leavesOnDate = [];
                
                leavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว') {
                        const startDate = new Date(leave.startDate);
                        const endDate = new Date(leave.endDate);
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        
                        if (selectedDateObj >= startDate && selectedDateObj <= endDate) {
                            leavesOnDate.push({ id: docSnap.id, ...leave });
                        }
                    }
                });

                const displayDate = selectedDateObj.toLocaleDateString('th-TH', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });

                if (leavesOnDate.length === 0) {
                    reportDiv.innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3rem; margin-bottom: 10px;">✅</div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                                ${displayDate}
                            </div>
                            <div style="color: var(--success); font-weight: 600;">
                                ไม่มีบุคลากรลาในวันนี้
                            </div>
                        </div>
                    `;
                } else {
                    let html = `
                        <div style="padding: 20px;">
                            <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--border);">
                                <div style="font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                                    📅 ${displayDate}
                                </div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">
                                    มีบุคลากรลา ${leavesOnDate.length} คน
                                </div>
                            </div>
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ลำดับ</th>
                                            <th>ชื่อ-นามสกุล</th>
                                            <th>ประเภทการลา</th>
                                            <th>ช่วงเวลา</th>
                                            <th>จำนวนวัน</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;

                    leavesOnDate.forEach((leave, index) => {
                        const startDate = new Date(leave.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                        const endDate = new Date(leave.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                        const style = getLeaveTypeStyle(leave.type);
                        
                        html += `
                            <tr>
                                <td>${index + 1}</td>
                                <td><strong>${leave.userName}</strong></td>
                                <td>
                                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: ${style.bg}; color: ${style.color}; border-radius: 16px; font-size: 0.875rem; font-weight: 500;">
                                        <span>${style.icon}</span>
                                        <span>${leave.type}</span>
                                    </span>
                                </td>
                                <td>${startDate} - ${endDate}</td>
                                <td><strong>${leave.days}</strong> วัน</td>
                            </tr>
                        `;
                    });

                    html += `</tbody></table></div></div>`;
                    reportDiv.innerHTML = html;
                }
            } catch (error) {
                console.error('Error loading daily report:', error);
                reportDiv.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 40px;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
            }
        };

        // Load daily trip report
        window.loadDailyTrip = async function() {
            const selectedDate = document.getElementById('dailyTripDate').value;
            if (!selectedDate) {
                alert('⚠️ กรุณาเลือกวันที่');
                return;
            }

            const reportDiv = document.getElementById('dailyTripContent');
            reportDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);"><div style="border: 2px solid var(--border); border-top: 2px solid var(--primary); border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; margin: 0 auto 10px;"></div>กำลังโหลด...</div>';

            try {
                const tripsSnapshot = await getDocs(collection(db, 'official_trips'));
                const selectedDateObj = new Date(selectedDate);
                selectedDateObj.setHours(0, 0, 0, 0);
                
                const tripsOnDate = [];
                
                tripsSnapshot.forEach(docSnap => {
                    const trip = docSnap.data();
                    
                    // Check both old format (date) and new format (startDate/endDate)
                    let isOnDate = false;
                    
                    if (trip.startDate && trip.endDate) {
                        const startDate = new Date(trip.startDate);
                        const endDate = new Date(trip.endDate);
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        
                        if (selectedDateObj >= startDate && selectedDateObj <= endDate) {
                            isOnDate = true;
                        }
                    } else if (trip.date) {
                        const tripDate = new Date(trip.date);
                        tripDate.setHours(0, 0, 0, 0);
                        
                        if (selectedDateObj.getTime() === tripDate.getTime()) {
                            isOnDate = true;
                        }
                    }
                    
                    if (isOnDate) {
                        tripsOnDate.push({ id: docSnap.id, ...trip });
                    }
                });

                const displayDate = selectedDateObj.toLocaleDateString('th-TH', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });

                if (tripsOnDate.length === 0) {
                    reportDiv.innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 3rem; margin-bottom: 10px;">✅</div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                                ${displayDate}
                            </div>
                            <div style="color: var(--success); font-weight: 600;">
                                ไม่มีบุคลากรไปราชการในวันนี้
                            </div>
                        </div>
                    `;
                } else {
                    let html = `
                        <div style="padding: 20px;">
                            <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--border);">
                                <div style="font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                                    📅 ${displayDate}
                                </div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: var(--primary);">
                                    มีบุคลากรไปราชการ ${tripsOnDate.length} คน
                                </div>
                            </div>
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ลำดับ</th>
                                            <th>ชื่อ-นามสกุล</th>
                                            <th>เรื่อง</th>
                                            <th>สถานที่</th>
                                            <th>วัตถุประสงค์</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;

                    tripsOnDate.forEach((trip, index) => {
                        html += `
                            <tr>
                                <td>${index + 1}</td>
                                <td><strong>${trip.userName}</strong></td>
                                <td>${trip.subject || '-'}</td>
                                <td>${trip.location}</td>
                                <td style="max-width: 400px;">${trip.purpose}</td>
                            </tr>
                        `;
                    });

                    html += `</tbody></table></div></div>`;
                    reportDiv.innerHTML = html;
                }
            } catch (error) {
                console.error('Error loading daily trip report:', error);
                reportDiv.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 40px;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
            }
        };

        // Load pending requests
        function loadPendingRequests() {
            const tbody = document.getElementById('pendingRequestsTable').querySelector('tbody');
            
            const q = query(
                collection(db, 'leaves'),
                where('status', '==', 'รออนุมัติ')
            );

            onSnapshot(q, (querySnapshot) => {
                if (querySnapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-light);">ไม่มีคำขอที่รอดำเนินการ</td></tr>';
                    return;
                }

                const leaves = [];
                querySnapshot.forEach((docSnapshot) => {
                    leaves.push({
                        id: docSnapshot.id,
                        ...docSnapshot.data()
                    });
                });

                leaves.sort((a, b) => {
                    const dateA = a.submittedDate ? new Date(a.submittedDate) : new Date(0);
                    const dateB = b.submittedDate ? new Date(b.submittedDate) : new Date(0);
                    return dateB - dateA;
                });

                tbody.innerHTML = '';
                leaves.forEach((leave) => {
                    const row = document.createElement('tr');
                    row.dataset.leaveId = leave.id;

                    const startDate = new Date(leave.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                    const endDate = new Date(leave.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                    const style = getLeaveTypeStyle(leave.type);

                    row.innerHTML = `
                        <td><strong>${leave.userName}</strong></td>
                        <td>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: ${style.bg}; color: ${style.color}; border-radius: 16px; font-size: 0.875rem; font-weight: 500;">
                                <span>${style.icon}</span>
                                <span>${leave.type}</span>
                            </span>
                        </td>
                        <td>${startDate} - ${endDate}</td>
                        <td>${leave.days} วัน</td>
                        <td><span class="status-badge status-pending">รออนุมัติ</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-success" onclick="approveLeave(this)">✓ อนุมัติ</button>
                                <button class="btn btn-danger" onclick="rejectLeave(this)">✗ ไม่อนุมัติ</button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            });
        }

        // Load approvals data
        function loadApprovalsData() {
            const tbody = document.getElementById('approvalsTableBody');
            
            const q = query(
                collection(db, 'leaves'),
                orderBy('submittedDate', 'desc')
            );

            onSnapshot(q, (querySnapshot) => {
                allLeaves = [];
                querySnapshot.forEach((docSnapshot) => {
                    allLeaves.push({ id: docSnapshot.id, ...docSnapshot.data() });
                });

                renderApprovalsTable(allLeaves);
            });
        }

        function renderApprovalsTable(leaves) {
            const tbody = document.getElementById('approvalsTableBody');
            
            if (leaves.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">ไม่มีข้อมูล</td></tr>';
                return;
            }

            tbody.innerHTML = leaves.map(leave => {
                const statusClass = leave.status === 'อนุมัติแล้ว' ? 'status-approved' : 
                                  leave.status === 'ไม่อนุมัติ' ? 'status-rejected' : 'status-pending';

                const submittedDate = new Date(leave.submittedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                const startDate = new Date(leave.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                const endDate = new Date(leave.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

                const actions = leave.status === 'รออนุมัติ' ? 
                    `<div class="action-buttons">
                        <button class="btn btn-success" onclick="approveLeave(this)">✓ อนุมัติ</button>
                        <button class="btn btn-danger" onclick="rejectLeave(this)">✗ ไม่อนุมัติ</button>
                    </div>` : 
                    `<span style="color: ${leave.status === 'อนุมัติแล้ว' ? 'var(--success)' : 'var(--danger)'};">${leave.status}</span>`;

                const style = getLeaveTypeStyle(leave.type);

                return `
                    <tr data-leave-id="${leave.id}">
                        <td>${submittedDate}</td>
                        <td><strong>${leave.userName}</strong></td>
                        <td>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: ${style.bg}; color: ${style.color}; border-radius: 16px; font-size: 0.875rem; font-weight: 500;">
                                <span>${style.icon}</span>
                                <span>${leave.type}</span>
                            </span>
                        </td>
                        <td>${startDate} - ${endDate}</td>
                        <td>${leave.reason}</td>
                        <td><span class="status-badge ${statusClass}">${leave.status}</span></td>
                        <td>${actions}</td>
                    </tr>
                `;
            }).join('');
        }

        // Filter state
        let currentFilters = {
            searchText: '',
            status: 'all',
            leaveType: 'all'
        };

        // Apply all filters
        function applyAllFilters() {
            let filtered = [...allLeaves];

            // Filter by search text
            if (currentFilters.searchText) {
                filtered = filtered.filter(leave => 
                    leave.userName.toLowerCase().includes(currentFilters.searchText.toLowerCase())
                );
            }

            // Filter by status
            if (currentFilters.status !== 'all') {
                const statusMap = {
                    'pending': 'รออนุมัติ',
                    'approved': 'อนุมัติแล้ว',
                    'rejected': 'ไม่อนุมัติ'
                };
                filtered = filtered.filter(leave => leave.status === statusMap[currentFilters.status]);
            }

            // Filter by leave type
            if (currentFilters.leaveType !== 'all') {
                filtered = filtered.filter(leave => leave.type === currentFilters.leaveType);
            }

            renderApprovalsTable(filtered);
        }

        // Filter functions
        window.filterApprovals = function(searchText) {
            currentFilters.searchText = searchText;
            applyAllFilters();
        };

        window.filterByStatus = function(status) {
            currentFilters.status = status;
            applyAllFilters();
        };

        window.filterByLeaveType = function(leaveType) {
            currentFilters.leaveType = leaveType;
            applyAllFilters();
        };

        // Load personnel data - UPDATED TO TABLE FORMAT
        function loadPersonnelData() {
            const tbody = document.getElementById('personnelTableBody');
            
            onSnapshot(collection(db, 'users'), (querySnapshot) => {
                if (querySnapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-light);">ยังไม่มีข้อมูลบุคลากร</td></tr>';
                    return;
                }

                const personnel = [];
                querySnapshot.forEach(docSnapshot => {
                    const user = { id: docSnapshot.id, ...docSnapshot.data() };
                    if (user.role === 'teacher') {
                        personnel.push(user);
                    }
                });

                tbody.innerHTML = personnel.map((person, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${person.name}</strong></td>
                        <td>${person.position || 'ไม่ระบุตำแหน่ง'}</td>
                        <td>${person.department || '-'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-primary" onclick="viewPersonnelDetail('${person.id}')">
                                    👁️ ดูวันลา
                                </button>
                                <button class="btn btn-secondary" onclick="editPersonnel('${person.id}')">
                                    ✏️ แก้ไข
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            });
        }

        // View personnel detail - CALCULATE FROM DATABASE
        window.viewPersonnelDetail = async function(userId) {
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (!userDoc.exists()) {
                    alert('ไม่พบข้อมูลบุคลากร');
                    return;
                }

                const user = userDoc.data();
                
                // Query all approved leaves for this user
                const leavesQuery = query(
                    collection(db, 'leaves'),
                    where('userId', '==', userId),
                    where('status', '==', 'อนุมัติแล้ว')
                );
                const leavesSnapshot = await getDocs(leavesQuery);
                
                // Calculate used days for each type
                const usedDays = {
                    sick: 0,
                    maternity: 0,
                    helpWife: 0,
                    personal: 0,
                    vacation: 0,
                    ordination: 0,
                    study: 0,
                    international: 0,
                    rehab: 0,
                    followSpouse: 0,
                    workOther: 0
                };
                
                leavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    const days = leave.days || 0;
                    
                    switch(leave.type) {
                        case 'ลาป่วย': usedDays.sick += days; break;
                        case 'ลาคลอดบุตร': usedDays.maternity += days; break;
                        case 'ลาช่วยเหลือภริยาคลอดบุตร': usedDays.helpWife += days; break;
                        case 'ลากิจส่วนตัว': usedDays.personal += days; break;
                        case 'ลาพักผ่อน': usedDays.vacation += days; break;
                        case 'ลาอุปสมบท': usedDays.ordination += days; break;
                        case 'ลาศึกษา': usedDays.study += days; break;
                        case 'ลาปฏิบัติงานองค์การระหว่างประเทศ': usedDays.international += days; break;
                        case 'ลาฟื้นฟูสมรรถภาพ': usedDays.rehab += days; break;
                        case 'ลาติดตามคู่สมรส': usedDays.followSpouse += days; break;
                        case 'ลาปฏิบัติงานในหน่วยงานอื่น': usedDays.workOther += days; break;
                    }
                });
                
                let message = `รายละเอียดวันลา: ${user.name}\n`;
                message += `ตำแหน่ง: ${user.position || 'ไม่ระบุ'}\n\n`;
                message += `📊 สรุปวันลา (ลาไปแล้ว / คงเหลือ):\n\n`;
                message += `🏥 ลาป่วย: ${usedDays.sick} / ${user.sickLeaveRemaining || 30} วัน\n`;
                message += `👶 ลาคลอดบุตร: ${usedDays.maternity} / ${user.maternityLeaveRemaining || 90} วัน\n`;
                message += `🤱 ลาช่วยภริยาคลอดบุตร: ${usedDays.helpWife} / ${user.helpWifeLeaveRemaining || 15} วัน\n`;
                message += `📝 ลากิจส่วนตัว: ${usedDays.personal} / ${user.personalLeaveRemaining || 45} วัน\n`;
                message += `🏖️ ลาพักผ่อน: ${usedDays.vacation} / ${user.vacationLeaveRemaining || 10} วัน\n`;
                message += `🙏 ลาอุปสมบท: ${usedDays.ordination} / ${user.ordinationLeaveRemaining || 120} วัน\n`;
                message += `📚 ลาศึกษา: ${usedDays.study} / ${user.studyLeaveRemaining || 365} วัน\n`;
                message += `🌏 ลาองค์การระหว่างประเทศ: ${usedDays.international} / ${user.internationalLeaveRemaining || 730} วัน\n`;
                message += `💪 ลาฟื้นฟูสมรรถภาพ: ${usedDays.rehab} / ${user.rehabLeaveRemaining || 180} วัน\n`;
                message += `✈️ ลาติดตามคู่สมรส: ${usedDays.followSpouse} / ${user.followSpouseLeaveRemaining || 365} วัน\n`;
                message += `🏛️ ลาปฏิบัติงานในหน่วยงานอื่น: ${usedDays.workOther} / ${user.workOtherLeaveRemaining || 365} วัน`;

                alert(message);
            } catch (error) {
                console.error('Error viewing personnel detail:', error);
                alert('เกิดข้อผิดพลาด: ' + error.message);
            }
        };

        window.filterPersonnel = function(searchText) {
            const rows = document.querySelectorAll('#personnelTableBody tr');
            rows.forEach(row => {
                const nameCell = row.cells[1];
                if (nameCell) {
                    const name = nameCell.textContent.toLowerCase();
                    row.style.display = name.includes(searchText.toLowerCase()) ? '' : 'none';
                }
            });
        };

        window.filterByPosition = function(position) {
            const rows = document.querySelectorAll('#personnelTableBody tr');
            rows.forEach(row => {
                const positionCell = row.cells[2]; // ตำแหน่งอยู่คอลัมน์ที่ 3
                if (positionCell) {
                    const positionText = positionCell.textContent;
                    if (position === 'all') {
                        row.style.display = '';
                    } else if (position === 'ครู') {
                        // กรองครูทุกระดับ
                        row.style.display = positionText.includes('ครู') && 
                                           !positionText.includes('ครูอัตราจ้าง') ? '' : 'none';
                    } else {
                        // กรองตามตำแหน่งที่เลือกเป่๊ะๆ
                        row.style.display = positionText.includes(position) ? '' : 'none';
                    }
                }
            });
        };

        // Load reports data - UPDATED
        async function loadReportsData() {
            try {
                const leavesSnapshot = await getDocs(collection(db, 'leaves'));
                const usersSnapshot = await getDocs(collection(db, 'users'));
                
                let totalLeaves = 0;
                let sickCount = 0;
                let personalCount = 0;
                let maternityCount = 0;
                let othersCount = 0;
                
                const fullLeaveCounts = {
                    'ลาป่วย': 0,
                    'ลาคลอดบุตร': 0,
                    'ลาช่วยเหลือภริยาคลอดบุตร': 0,
                    'ลากิจส่วนตัว': 0,
                    'ลาพักผ่อน': 0,
                    'ลาอุปสมบท': 0,
                    'ลาศึกษา': 0,
                    'ลาปฏิบัติงานองค์การระหว่างประเทศ': 0,
                    'ลาฟื้นฟูสมรรถภาพ': 0,
                    'ลาติดตามคู่สมรส': 0,
                    'ลาปฏิบัติงานในหน่วยงานอื่น': 0
                };
                
                leavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว') {
                        totalLeaves++;
                        
                        if (fullLeaveCounts.hasOwnProperty(leave.type)) {
                            fullLeaveCounts[leave.type]++;
                        }
                        
                        if (leave.type === 'ลาป่วย') {
                            sickCount++;
                        } else if (leave.type === 'ลากิจส่วนตัว') {
                            personalCount++;
                        } else if (leave.type === 'ลาคลอดบุตร') {
                            maternityCount++;
                        } else {
                            othersCount++;
                        }
                    }
                });

                const reportStatBoxes = document.querySelectorAll('#reports .stats-overview .stat-box .stat-number');
                if (reportStatBoxes.length >= 5) {
                    reportStatBoxes[0].textContent = totalLeaves;
                    reportStatBoxes[1].textContent = sickCount;
                    reportStatBoxes[2].textContent = personalCount;
                    reportStatBoxes[3].textContent = maternityCount;
                    reportStatBoxes[4].textContent = othersCount;
                }

                window.fullLeaveBreakdown = fullLeaveCounts;

                // Build user leave summary with ALL 11 leave types
                const userLeaveMap = new Map();
                
                usersSnapshot.forEach(docSnap => {
                    const user = docSnap.data();
                    if (user.role === 'teacher') {
                        userLeaveMap.set(docSnap.id, {
                            name: user.name,
                            sick: 0,
                            maternity: 0,
                            helpWife: 0,
                            personal: 0,
                            vacation: 0,
                            ordination: 0,
                            study: 0,
                            international: 0,
                            rehab: 0,
                            followSpouse: 0,
                            workOther: 0,
                            total: 0
                        });
                    }
                });

                leavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว' && userLeaveMap.has(leave.userId)) {
                        const userLeave = userLeaveMap.get(leave.userId);
                        const days = leave.days || 0;
                        
                        switch(leave.type) {
                            case 'ลาป่วย': userLeave.sick += days; break;
                            case 'ลาคลอดบุตร': userLeave.maternity += days; break;
                            case 'ลาช่วยเหลือภริยาคลอดบุตร': userLeave.helpWife += days; break;
                            case 'ลากิจส่วนตัว': userLeave.personal += days; break;
                            case 'ลาพักผ่อน': userLeave.vacation += days; break;
                            case 'ลาอุปสมบท': userLeave.ordination += days; break;
                            case 'ลาศึกษา': userLeave.study += days; break;
                            case 'ลาปฏิบัติงานองค์การระหว่างประเทศ': userLeave.international += days; break;
                            case 'ลาฟื้นฟูสมรรถภาพ': userLeave.rehab += days; break;
                            case 'ลาติดตามคู่สมรส': userLeave.followSpouse += days; break;
                            case 'ลาปฏิบัติงานในหน่วยงานอื่น': userLeave.workOther += days; break;
                        }
                        userLeave.total += days;
                    }
                });

                const tbody = document.querySelector('#reportsTable tbody');
                if (userLeaveMap.size === 0) {
                    tbody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 40px; color: var(--text-light);">ยังไม่มีข้อมูลบุคลากร</td></tr>';
                    return;
                }

                const sortedUsers = Array.from(userLeaveMap.values()).sort((a, b) => b.total - a.total);
                
                tbody.innerHTML = sortedUsers.map((user, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${user.name}</strong></td>
                        <td>${user.sick}</td>
                        <td>${user.maternity}</td>
                        <td>${user.helpWife}</td>
                        <td>${user.personal}</td>
                        <td>${user.vacation}</td>
                        <td>${user.ordination}</td>
                        <td>${user.study}</td>
                        <td>${user.international}</td>
                        <td>${user.rehab}</td>
                        <td>${user.followSpouse}</td>
                        <td>${user.workOther}</td>
                        <td><strong>${user.total}</strong></td>
                    </tr>
                `).join('');

                const today = new Date().toISOString().split('T')[0];
                document.getElementById('dailyLeaveDate').value = today;
                
            } catch (error) {
                console.error('Error loading reports:', error);
                document.querySelector('#reportsTable tbody').innerHTML = 
                    '<tr><td colspan="14" style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
            }
        }

        // Load daily leave
        window.loadDailyLeave = async function() {
            const selectedDate = document.getElementById('dailyLeaveDate').value;
            if (!selectedDate) {
                alert('⚠️ กรุณาเลือกวันที่');
                return;
            }

            const dailyLeaveDiv = document.getElementById('dailyLeaveInfo');
            dailyLeaveDiv.innerHTML = '<div style="text-align: center; color: var(--text-light);"><div style="border: 3px solid var(--border); border-top: 3px solid var(--primary); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>กำลังโหลด...</div>';

            try {
                const leavesSnapshot = await getDocs(collection(db, 'leaves'));
                const selectedDateObj = new Date(selectedDate);
                selectedDateObj.setHours(0, 0, 0, 0);
                
                const leavesOnDate = [];
                
                leavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว') {
                        const startDate = new Date(leave.startDate);
                        const endDate = new Date(leave.endDate);
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        
                        if (selectedDateObj >= startDate && selectedDateObj <= endDate) {
                            leavesOnDate.push(leave);
                        }
                    }
                });

                const displayDate = selectedDateObj.toLocaleDateString('th-TH', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });

                if (leavesOnDate.length === 0) {
                    dailyLeaveDiv.innerHTML = `
                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 3rem; margin-bottom: 10px;">✅</div>
                            <div style="font-size: 1.2rem; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                                ${displayDate}
                            </div>
                            <div style="color: var(--success); font-weight: 600;">
                                ไม่มีบุคลากรลาในวันนี้
                            </div>
                        </div>
                    `;
                } else {
                    let html = `
                        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--border);">
                            <div style="font-size: 1.1rem; font-weight: 600; color: var(--text); margin-bottom: 5px;">
                                📅 ${displayDate}
                            </div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">
                                มีบุคลากรลา ${leavesOnDate.length} คน
                            </div>
                        </div>
                    `;

                    leavesOnDate.forEach((leave, index) => {
                        html += `
                            <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid var(--primary);">
                                <div style="font-weight: 600; color: var(--text);">
                                    ${index + 1}. ${leave.userName} - ${leave.type}
                                </div>
                                <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 4px;">
                                    ${new Date(leave.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - 
                                    ${new Date(leave.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                    (${leave.days} วัน)
                                </div>
                            </div>
                        `;
                    });

                    dailyLeaveDiv.innerHTML = html;
                }

            } catch (error) {
                console.error('Error loading daily leave:', error);
                dailyLeaveDiv.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 20px;">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
            }
        };

        // Modal functions
        window.openAddPersonnelModal = function() {
            document.getElementById('addPersonnelModal').classList.add('active');
        };

        window.closeAddPersonnelModal = function() {
            document.getElementById('addPersonnelModal').classList.remove('active');
        };

        window.closeEditPersonnelModal = function() {
            document.getElementById('editPersonnelModal').classList.remove('active');
        };

        // Edit personnel - CALCULATE USED DAYS FROM DATABASE
        window.editPersonnel = async function(userId) {
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (!userDoc.exists()) {
                    alert('ไม่พบข้อมูลบุคลากร');
                    return;
                }

                const user = userDoc.data();
                
                // Query all approved leaves for this user to calculate actual used days
                const leavesQuery = query(
                    collection(db, 'leaves'),
                    where('userId', '==', userId),
                    where('status', '==', 'อนุมัติแล้ว')
                );
                const leavesSnapshot = await getDocs(leavesQuery);
                
                // Calculate used days for each type from actual database records
                const usedDays = {
                    sick: 0,
                    maternity: 0,
                    helpWife: 0,
                    personal: 0,
                    vacation: 0,
                    ordination: 0,
                    study: 0,
                    international: 0,
                    rehab: 0,
                    followSpouse: 0,
                    workOther: 0
                };
                
                leavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    const days = leave.days || 0;
                    
                    switch(leave.type) {
                        case 'ลาป่วย': usedDays.sick += days; break;
                        case 'ลาคลอดบุตร': usedDays.maternity += days; break;
                        case 'ลาช่วยเหลือภริยาคลอดบุตร': usedDays.helpWife += days; break;
                        case 'ลากิจส่วนตัว': usedDays.personal += days; break;
                        case 'ลาพักผ่อน': usedDays.vacation += days; break;
                        case 'ลาอุปสมบท': usedDays.ordination += days; break;
                        case 'ลาศึกษา': usedDays.study += days; break;
                        case 'ลาปฏิบัติงานองค์การระหว่างประเทศ': usedDays.international += days; break;
                        case 'ลาฟื้นฟูสมรรถภาพ': usedDays.rehab += days; break;
                        case 'ลาติดตามคู่สมรส': usedDays.followSpouse += days; break;
                        case 'ลาปฏิบัติงานในหน่วยงานอื่น': usedDays.workOther += days; break;
                    }
                });
                
                document.getElementById('editPersonnelId').value = userId;
                document.getElementById('editName').value = user.name || '';
                document.getElementById('editPosition').value = user.position || '';
                document.getElementById('editDepartment').value = user.department || '';
                document.getElementById('editUsername').value = user.username || '';
                document.getElementById('editPassword').value = '';
                
                // Set remaining leave days (from user profile or defaults)
                document.getElementById('editSickLeave').value = user.sickLeaveRemaining || 30;
                document.getElementById('editMaternityLeave').value = user.maternityLeaveRemaining || 90;
                document.getElementById('editHelpWifeLeave').value = user.helpWifeLeaveRemaining || 15;
                document.getElementById('editPersonalLeave').value = user.personalLeaveRemaining || 45;
                document.getElementById('editVacationLeave').value = user.vacationLeaveRemaining || 10;
                document.getElementById('editOrdinationLeave').value = user.ordinationLeaveRemaining || 120;
                document.getElementById('editStudyLeave').value = user.studyLeaveRemaining || 365;
                document.getElementById('editInternationalLeave').value = user.internationalLeaveRemaining || 730;
                document.getElementById('editRehabLeave').value = user.rehabLeaveRemaining || 180;
                document.getElementById('editFollowSpouseLeave').value = user.followSpouseLeaveRemaining || 365;
                document.getElementById('editWorkOtherLeave').value = user.workOtherLeaveRemaining || 365;
                
                // Set used leave days (calculated from actual database records)
                document.getElementById('editSickLeaveUsed').value = usedDays.sick;
                document.getElementById('editMaternityLeaveUsed').value = usedDays.maternity;
                document.getElementById('editHelpWifeLeaveUsed').value = usedDays.helpWife;
                document.getElementById('editPersonalLeaveUsed').value = usedDays.personal;
                document.getElementById('editVacationLeaveUsed').value = usedDays.vacation;
                document.getElementById('editOrdinationLeaveUsed').value = usedDays.ordination;
                document.getElementById('editStudyLeaveUsed').value = usedDays.study;
                document.getElementById('editInternationalLeaveUsed').value = usedDays.international;
                document.getElementById('editRehabLeaveUsed').value = usedDays.rehab;
                document.getElementById('editFollowSpouseLeaveUsed').value = usedDays.followSpouse;
                document.getElementById('editWorkOtherLeaveUsed').value = usedDays.workOther;
                
                document.getElementById('editEmail').value = user.email || '';
                document.getElementById('editPhone').value = user.phone || '';
                
                document.getElementById('editPersonnelModal').classList.add('active');
            } catch (error) {
                console.error('Error loading personnel data:', error);
                alert('เกิดข้อผิดพลาด: ' + error.message);
            }
        };

        // Delete personnel
        window.deletePersonnel = async function() {
            if (!confirm('⚠️ คุณแน่ใจหรือไม่ที่จะลบบุคลากรคนนี้?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้!')) {
                return;
            }

            const userId = document.getElementById('editPersonnelId').value;

            try {
                await deleteDoc(doc(db, 'users', userId));
                alert('✅ ลบบุคลากรเรียบร้อยแล้ว');
                window.closeEditPersonnelModal();
                updateDashboardStats();
                loadPersonnelData();
            } catch (error) {
                console.error('Error deleting personnel:', error);
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            }
        };

        // Export to Excel - UPDATED WITH ALL 11 LEAVE TYPES
        window.exportToExcel = async function() {
            try {
                const startDate = document.getElementById('reportStartDate').value;
                const endDate = document.getElementById('reportEndDate').value;

                if (!startDate || !endDate) {
                    alert('⚠️ กรุณาเลือกช่วงเวลาก่อน');
                    return;
                }

                const leavesSnapshot = await getDocs(collection(db, 'leaves'));
                const usersSnapshot = await getDocs(collection(db, 'users'));

                const userLeaveDetail = new Map();

                usersSnapshot.forEach(docSnap => {
                    const user = docSnap.data();
                    if (user.role === 'teacher') {
                        userLeaveDetail.set(docSnap.id, {
                            name: user.name,
                            position: user.position || '',
                            sick: 0,
                            maternity: 0,
                            helpWife: 0,
                            personal: 0,
                            vacation: 0,
                            ordination: 0,
                            study: 0,
                            international: 0,
                            rehab: 0,
                            followSpouse: 0,
                            workOther: 0,
                            total: 0
                        });
                    }
                });

                leavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว' && userLeaveDetail.has(leave.userId)) {
                        const leaveStart = new Date(leave.startDate);
                        const leaveEnd = new Date(leave.endDate);
                        const rangeStart = new Date(startDate);
                        const rangeEnd = new Date(endDate);

                        if (leaveStart <= rangeEnd && leaveEnd >= rangeStart) {
                            const userLeave = userLeaveDetail.get(leave.userId);
                            const days = leave.days || 0;
                            
                            switch(leave.type) {
                                case 'ลาป่วย': userLeave.sick += days; break;
                                case 'ลาคลอดบุตร': userLeave.maternity += days; break;
                                case 'ลาช่วยเหลือภริยาคลอดบุตร': userLeave.helpWife += days; break;
                                case 'ลากิจส่วนตัว': userLeave.personal += days; break;
                                case 'ลาพักผ่อน': userLeave.vacation += days; break;
                                case 'ลาอุปสมบท': userLeave.ordination += days; break;
                                case 'ลาศึกษา': userLeave.study += days; break;
                                case 'ลาปฏิบัติงานองค์การระหว่างประเทศ': userLeave.international += days; break;
                                case 'ลาฟื้นฟูสมรรถภาพ': userLeave.rehab += days; break;
                                case 'ลาติดตามคู่สมรส': userLeave.followSpouse += days; break;
                                case 'ลาปฏิบัติงานในหน่วยงานอื่น': userLeave.workOther += days; break;
                            }
                            userLeave.total += days;
                        }
                    }
                });

                let csv = '\uFEFF';
                csv += 'ลำดับ,ชื่อ-นามสกุล,ตำแหน่ง,ลาป่วย,ลาคลอดบุตร,ลาช่วยภริยา,ลากิจส่วนตัว,ลาพักผ่อน,ลาอุปสมบท,ลาศึกษา,ลาองค์การระหว่างประเทศ,ลาฟื้นฟูสมรรถภาพ,ลาติดตามคู่สมรส,ลาปฏิบัติงานอื่น,รวมทั้งหมด\n';

                const sortedUsers = Array.from(userLeaveDetail.values()).sort((a, b) => b.total - a.total);
                
                sortedUsers.forEach((user, index) => {
                    csv += `${index + 1},"${user.name}","${user.position}",${user.sick},${user.maternity},${user.helpWife},${user.personal},${user.vacation},${user.ordination},${user.study},${user.international},${user.rehab},${user.followSpouse},${user.workOther},${user.total}\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `รายงานการลา_${startDate}_${endDate}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                alert('✅ ส่งออกรายงานเรียบร้อยแล้ว');

            } catch (error) {
                console.error('Export error:', error);
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            }
        };

        window.saveSettings = function() {
            alert('💾 บันทึกการตั้งค่าเรียบร้อยแล้ว');
        };

        // Initialize event listeners
        function initializeEventListeners() {
            // Edit personnel form - SAVE BOTH USED AND REMAINING DAYS
            document.getElementById('editPersonnelForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const userId = document.getElementById('editPersonnelId').value;
                const newUsername = document.getElementById('editUsername').value.trim();
                const newPassword = document.getElementById('editPassword').value;
                
                // Check if username already exists (if changed)
                try {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    const oldUsername = userDoc.data().username;
                    
                    if (newUsername !== oldUsername) {
                        const usernameQuery = query(
                            collection(db, 'users'),
                            where('username', '==', newUsername)
                        );
                        const usernameSnapshot = await getDocs(usernameQuery);
                        
                        if (!usernameSnapshot.empty) {
                            alert('⚠️ ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น');
                            return;
                        }
                    }
                    
                    const updateData = {
                        name: document.getElementById('editName').value,
                        position: document.getElementById('editPosition').value,
                        department: document.getElementById('editDepartment').value,
                        username: newUsername,
                        // Save both remaining and used leave days
                        sickLeaveRemaining: parseInt(document.getElementById('editSickLeave').value) || 30,
                        maternityLeaveRemaining: parseInt(document.getElementById('editMaternityLeave').value) || 90,
                        helpWifeLeaveRemaining: parseInt(document.getElementById('editHelpWifeLeave').value) || 15,
                        personalLeaveRemaining: parseInt(document.getElementById('editPersonalLeave').value) || 45,
                        vacationLeaveRemaining: parseInt(document.getElementById('editVacationLeave').value) || 10,
                        ordinationLeaveRemaining: parseInt(document.getElementById('editOrdinationLeave').value) || 120,
                        studyLeaveRemaining: parseInt(document.getElementById('editStudyLeave').value) || 365,
                        internationalLeaveRemaining: parseInt(document.getElementById('editInternationalLeave').value) || 730,
                        rehabLeaveRemaining: parseInt(document.getElementById('editRehabLeave').value) || 180,
                        followSpouseLeaveRemaining: parseInt(document.getElementById('editFollowSpouseLeave').value) || 365,
                        workOtherLeaveRemaining: parseInt(document.getElementById('editWorkOtherLeave').value) || 365,
                        // Used leave days (manual override allowed)
                        sickLeaveUsed: parseInt(document.getElementById('editSickLeaveUsed').value) || 0,
                        maternityLeaveUsed: parseInt(document.getElementById('editMaternityLeaveUsed').value) || 0,
                        helpWifeLeaveUsed: parseInt(document.getElementById('editHelpWifeLeaveUsed').value) || 0,
                        personalLeaveUsed: parseInt(document.getElementById('editPersonalLeaveUsed').value) || 0,
                        vacationLeaveUsed: parseInt(document.getElementById('editVacationLeaveUsed').value) || 0,
                        ordinationLeaveUsed: parseInt(document.getElementById('editOrdinationLeaveUsed').value) || 0,
                        studyLeaveUsed: parseInt(document.getElementById('editStudyLeaveUsed').value) || 0,
                        internationalLeaveUsed: parseInt(document.getElementById('editInternationalLeaveUsed').value) || 0,
                        rehabLeaveUsed: parseInt(document.getElementById('editRehabLeaveUsed').value) || 0,
                        followSpouseLeaveUsed: parseInt(document.getElementById('editFollowSpouseLeaveUsed').value) || 0,
                        workOtherLeaveUsed: parseInt(document.getElementById('editWorkOtherLeaveUsed').value) || 0,
                        email: document.getElementById('editEmail').value,
                        phone: document.getElementById('editPhone').value,
                        updatedAt: new Date().toISOString(),
                        updatedBy: currentAdminName
                    };
                    
                    // Only update password if provided
                    if (newPassword) {
                        updateData.password = newPassword;
                    }

                    await updateDoc(doc(db, 'users', userId), updateData);
                    alert('✅ บันทึกข้อมูลเรียบร้อยแล้ว');
                    window.closeEditPersonnelModal();
                    updateDashboardStats();
                    loadPersonnelData();
                } catch (error) {
                    console.error('Error updating personnel:', error);
                    alert('❌ เกิดข้อผิดพลาด: ' + error.message);
                }
            });

            // Add personnel form
            document.getElementById('addPersonnelForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const formData = new FormData(this);
                const username = formData.get('username').trim();
                const password = formData.get('password');

                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    alert('⚠️ ชื่อผู้ใช้ต้องเป็นตัวอักษร a-z, A-Z, 0-9 และ _ เท่านั้น');
                    return;
                }

                try {
                    const usernameQuery = query(
                        collection(db, 'users'),
                        where('username', '==', username)
                    );
                    const usernameSnapshot = await getDocs(usernameQuery);
                    
                    if (!usernameSnapshot.empty) {
                        alert('⚠️ ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น');
                        return;
                    }

                    const userData = {
                        name: formData.get('name'),
                        position: formData.get('position'),
                        department: formData.get('department') || '',
                        username: username,
                        password: password,
                        email: formData.get('email') || '',
                        phone: formData.get('phone') || '',
                        role: 'teacher',
                        // Remaining leave days (initial allocation)
                        sickLeaveRemaining: 30,
                        maternityLeaveRemaining: 90,
                        helpWifeLeaveRemaining: 15,
                        personalLeaveRemaining: 45,
                        vacationLeaveRemaining: 10,
                        ordinationLeaveRemaining: 120,
                        studyLeaveRemaining: 365,
                        internationalLeaveRemaining: 730,
                        rehabLeaveRemaining: 180,
                        followSpouseLeaveRemaining: 365,
                        workOtherLeaveRemaining: 365,
                        // Note: Used leave days are calculated from database, not stored in user profile
                        createdAt: new Date().toISOString(),
                        createdBy: currentAdminName
                    };

                    const userId = 'teacher_' + Date.now();
                    await setDoc(doc(db, 'users', userId), userData);

                    alert(`✅ เพิ่มบุคลากรเรียบร้อยแล้ว!\n\nชื่อผู้ใช้: ${username}\nรหัสผ่าน: ${password}\n\n⚠️ โปรดบันทึกข้อมูลนี้และแจ้งให้บุคลากรทราบ`);
                    window.closeAddPersonnelModal();
                    this.reset();
                    updateDashboardStats();
                    loadPersonnelData();
                } catch (error) {
                    console.error('Error adding personnel:', error);
                    alert('❌ เกิดข้อผิดพลาด: ' + error.message);
                }
            });

            // Close modal when clicking outside
            document.getElementById('addPersonnelModal').addEventListener('click', function(e) {
                if (e.target === this) {
                    window.closeAddPersonnelModal();
                }
            });

            document.getElementById('editPersonnelModal').addEventListener('click', function(e) {
                if (e.target === this) {
                    window.closeEditPersonnelModal();
                }
            });
        }

        // Initialize on page load
        function initialize() {
            updateAdminDisplay();
            updateDashboardStats();
            loadPendingRequests();
            loadOfficialTripsData();
            loadLateArrivalsData();
            
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            document.getElementById('reportStartDate').valueAsDate = firstDay;
            document.getElementById('reportEndDate').valueAsDate = today;
            
            // Set today for daily reports
            document.getElementById('dailyReportDate').valueAsDate = today;
            document.getElementById('dailyTripDate').valueAsDate = today;
            
            // Load today's reports by default
            loadDailyReport();
            loadDailyTrip();
            
            initializeEventListeners();
        }

        // Load official trips data
        function loadOfficialTripsData() {
            const tbody = document.getElementById('officialTripsTableBody');
            
            const q = query(
                collection(db, 'official_trips'),
                orderBy('submittedDate', 'desc')
            );

            onSnapshot(q, (querySnapshot) => {
                if (querySnapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">ไม่มีข้อมูล</td></tr>';
                    return;
                }

                const trips = [];
                querySnapshot.forEach((docSnapshot) => {
                    trips.push({ id: docSnapshot.id, ...docSnapshot.data() });
                });

                tbody.innerHTML = trips.map(trip => {
                    const submittedDate = trip.submittedDate ? new Date(trip.submittedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';
                    
                    // Support both old format (date) and new format (startDate/endDate)
                    let dateDisplay = '';
                    if (trip.startDate && trip.endDate) {
                        const start = new Date(trip.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                        const end = new Date(trip.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                        dateDisplay = trip.startDate === trip.endDate ? start : `${start} - ${end}`;
                        if (trip.days && trip.days > 1) {
                            dateDisplay += ` (${trip.days} วัน)`;
                        }
                    } else if (trip.date) {
                        dateDisplay = new Date(trip.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                    }

                    return `
                        <tr>
                            <td>${submittedDate}</td>
                            <td><strong>${trip.userName}</strong></td>
                            <td>${trip.subject || '-'}</td>
                            <td>${dateDisplay}</td>
                            <td>${trip.location}</td>
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${trip.purpose}</td>
                            <td><span class="status-badge status-approved">${trip.status}</span></td>
                        </tr>
                    `;
                }).join('');
            }, (error) => {
                console.error('Error loading official trips:', error);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาด: ' + error.message + '</td></tr>';
            });
        }

        // Load late arrivals data
        function loadLateArrivalsData() {
            const tbody = document.getElementById('lateArrivalsTableBody');
            
            const q = query(
                collection(db, 'late_arrivals'),
                orderBy('submittedDate', 'desc')
            );

            onSnapshot(q, (querySnapshot) => {
                if (querySnapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-light);">ไม่มีข้อมูล</td></tr>';
                    return;
                }

                const lates = [];
                querySnapshot.forEach((docSnapshot) => {
                    lates.push({ id: docSnapshot.id, ...docSnapshot.data() });
                });

                tbody.innerHTML = lates.map(late => {
                    const submittedDate = late.submittedDate ? new Date(late.submittedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';
                    const date = late.date ? new Date(late.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

                    return `
                        <tr>
                            <td>${submittedDate}</td>
                            <td><strong>${late.userName}</strong></td>
                            <td>${date}</td>
                            <td>${late.arrivalTime} น.</td>
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${late.reason}</td>
                            <td><span class="status-badge status-approved">${late.status}</span></td>
                        </tr>
                    `;
                }).join('');
            }, (error) => {
                console.error('Error loading late arrivals:', error);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาด: ' + error.message + '</td></tr>';
            });
        }

        // Filter functions for official trips and late arrivals
        window.filterOfficialTrips = function(searchText) {
            const rows = document.querySelectorAll('#officialTripsTableBody tr');
            rows.forEach(row => {
                const nameCell = row.cells[1];
                if (nameCell) {
                    const name = nameCell.textContent.toLowerCase();
                    row.style.display = name.includes(searchText.toLowerCase()) ? '' : 'none';
                }
            });
        };

        window.filterLateArrivals = function(searchText) {
            const rows = document.querySelectorAll('#lateArrivalsTableBody tr');
            rows.forEach(row => {
                const nameCell = row.cells[1];
                if (nameCell) {
                    const name = nameCell.textContent.toLowerCase();
                    row.style.display = name.includes(searchText.toLowerCase()) ? '' : 'none';
                }
            });
        };

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            initialize();
        }

    } catch (error) {
        console.error('Failed to initialize:', error);
        alert('เกิดข้อผิดพลาดในการโหลดระบบ: ' + error.message);
    }
})();
