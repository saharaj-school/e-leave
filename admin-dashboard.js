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
                
                // Calculate pending days
                let pendingDays = 0;
                pendingSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    pendingDays += leave.days || 0;
                });

                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                firstDayOfMonth.setHours(0, 0, 0, 0);
                
                let approvedCount = 0;
                let approvedDays = 0;
                const allLeavesSnapshot = await getDocs(collection(db, 'leaves'));
                
                allLeavesSnapshot.forEach(docSnap => {
                    const leave = docSnap.data();
                    if (leave.status === 'อนุมัติแล้ว' && leave.approvedDate) {
                        const approvedDate = new Date(leave.approvedDate);
                        if (approvedDate >= firstDayOfMonth) {
                            approvedCount++;
                            approvedDays += leave.days || 0;
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

                // Load trip stats
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth();
                const tripSnapshot = await getDocs(collection(db, 'official_trips'));
                
                let tripCount = 0;
                let tripDays = 0;
                
                tripSnapshot.forEach(docSnap => {
                    const trip = docSnap.data();
                    const tripDate = trip.startDate ? new Date(trip.startDate) : (trip.date ? new Date(trip.date) : null);
                    
                    if (tripDate && tripDate.getFullYear() === currentYear) {
                        tripCount++;
                        tripDays += trip.days || 1;
                    }
                });
                
                // Load late arrival stats
                const lateSnapshot = await getDocs(collection(db, 'late_arrivals'));
                
                let lateCount = 0;
                let lateCountMonth = 0;
                
                lateSnapshot.forEach(docSnap => {
                    const late = docSnap.data();
                    const lateDate = new Date(late.date);
                    
                    if (lateDate.getFullYear() === currentYear) {
                        lateCount++;
                        
                        if (lateDate.getMonth() === currentMonth) {
                            lateCountMonth++;
                        }
                    }
                });

                const statBoxes = document.querySelectorAll('.stats-overview .stat-box .stat-number');
                const statSubnumbers = document.querySelectorAll('.stats-overview .stat-box .stat-subnumber');
                
                if (statBoxes.length >= 6) {
                    statBoxes[0].textContent = totalPersonnel;
                    statBoxes[1].textContent = pendingCount;
                    statBoxes[2].textContent = approvedCount;
                    statBoxes[3].textContent = todayCount;
                    statBoxes[4].textContent = tripCount;
                    statBoxes[5].textContent = lateCount;
                }
                
                // Update subnumbers (days)
                if (statSubnumbers.length >= 4) {
                    statSubnumbers[0].textContent = `${pendingDays} วัน`;
                    statSubnumbers[1].textContent = `${approvedDays} วัน`;
                    statSubnumbers[2].textContent = `${tripDays} วัน`;
                    statSubnumbers[3].textContent = `${lateCountMonth} เดือนนี้`;
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
                
                // Hide sidebar on mobile when modal opens
                const sidebar = document.getElementById('sidebar');
                if (sidebar && window.innerWidth <= 768) {
                    sidebar.classList.remove('mobile-show');
                }
                
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

        // Export to Excel - UPDATED WITH TIMES AND DAYS
        window.exportToExcel = async function() {
            // Check if XLSX library is loaded
            if (typeof XLSX === 'undefined') {
                alert('กรุณารอสักครู่ให้ระบบโหลดเสร็จ แล้วลองอีกครั้ง');
                return;
            }

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
                            sick: { count: 0, days: 0 },
                            maternity: { count: 0, days: 0 },
                            helpWife: { count: 0, days: 0 },
                            personal: { count: 0, days: 0 },
                            vacation: { count: 0, days: 0 },
                            ordination: { count: 0, days: 0 },
                            study: { count: 0, days: 0 },
                            international: { count: 0, days: 0 },
                            rehab: { count: 0, days: 0 },
                            followSpouse: { count: 0, days: 0 },
                            workOther: { count: 0, days: 0 },
                            totalCount: 0,
                            totalDays: 0
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
                            
                            let leaveType = null;
                            switch(leave.type) {
                                case 'ลาป่วย': leaveType = 'sick'; break;
                                case 'ลาคลอดบุตร': leaveType = 'maternity'; break;
                                case 'ลาช่วยเหลือภริยาคลอดบุตร': leaveType = 'helpWife'; break;
                                case 'ลากิจส่วนตัว': leaveType = 'personal'; break;
                                case 'ลาพักผ่อน': leaveType = 'vacation'; break;
                                case 'ลาอุปสมบท': leaveType = 'ordination'; break;
                                case 'ลาศึกษา': leaveType = 'study'; break;
                                case 'ลาปฏิบัติงานองค์การระหว่างประเทศ': leaveType = 'international'; break;
                                case 'ลาฟื้นฟูสมรรถภาพ': leaveType = 'rehab'; break;
                                case 'ลาติดตามคู่สมรส': leaveType = 'followSpouse'; break;
                                case 'ลาปฏิบัติงานในหน่วยงานอื่น': leaveType = 'workOther'; break;
                            }
                            
                            if (leaveType) {
                                userLeave[leaveType].count++;
                                userLeave[leaveType].days += days;
                                userLeave.totalCount++;
                                userLeave.totalDays += days;
                            }
                        }
                    }
                });

                // Prepare data for Excel
                const formattedStartDate = new Date(startDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
                const formattedEndDate = new Date(endDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
                
                const data = [];
                
                // Header rows
                data.push(['รายงานสรุปการลาบุคลากร']);
                data.push([`ช่วงเวลา: ${formattedStartDate} ถึง ${formattedEndDate}`]);
                data.push([`วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
                data.push([]);
                
                // Column headers
                data.push([
                    'ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง',
                    'ลาป่วย (ครั้ง)', 'ลาป่วย (วัน)',
                    'ลาคลอด (ครั้ง)', 'ลาคลอด (วัน)',
                    'ลาช่วยภริยา (ครั้ง)', 'ลาช่วยภริยา (วัน)',
                    'ลากิจ (ครั้ง)', 'ลากิจ (วัน)',
                    'ลาพักผ่อน (ครั้ง)', 'ลาพักผ่อน (วัน)',
                    'ลาอุปสมบท (ครั้ง)', 'ลาอุปสมบท (วัน)',
                    'ลาศึกษา (ครั้ง)', 'ลาศึกษา (วัน)',
                    'ลาองค์การฯ (ครั้ง)', 'ลาองค์การฯ (วัน)',
                    'ลาฟื้นฟูฯ (ครั้ง)', 'ลาฟื้นฟูฯ (วัน)',
                    'ลาติดตามฯ (ครั้ง)', 'ลาติดตามฯ (วัน)',
                    'ลาปฏิบัติงานฯ (ครั้ง)', 'ลาปฏิบัติงานฯ (วัน)',
                    'รวมทั้งหมด (ครั้ง)', 'รวมทั้งหมด (วัน)'
                ]);

                const sortedUsers = Array.from(userLeaveDetail.values())
                    .filter(user => user.totalCount > 0)
                    .sort((a, b) => b.totalDays - a.totalDays);
                
                sortedUsers.forEach((user, index) => {
                    data.push([
                        index + 1, user.name, user.position,
                        user.sick.count, user.sick.days,
                        user.maternity.count, user.maternity.days,
                        user.helpWife.count, user.helpWife.days,
                        user.personal.count, user.personal.days,
                        user.vacation.count, user.vacation.days,
                        user.ordination.count, user.ordination.days,
                        user.study.count, user.study.days,
                        user.international.count, user.international.days,
                        user.rehab.count, user.rehab.days,
                        user.followSpouse.count, user.followSpouse.days,
                        user.workOther.count, user.workOther.days,
                        user.totalCount, user.totalDays
                    ]);
                });
                
                // Summary row
                const totals = sortedUsers.reduce((acc, user) => {
                    acc.sick.count += user.sick.count;
                    acc.sick.days += user.sick.days;
                    acc.maternity.count += user.maternity.count;
                    acc.maternity.days += user.maternity.days;
                    acc.helpWife.count += user.helpWife.count;
                    acc.helpWife.days += user.helpWife.days;
                    acc.personal.count += user.personal.count;
                    acc.personal.days += user.personal.days;
                    acc.vacation.count += user.vacation.count;
                    acc.vacation.days += user.vacation.days;
                    acc.ordination.count += user.ordination.count;
                    acc.ordination.days += user.ordination.days;
                    acc.study.count += user.study.count;
                    acc.study.days += user.study.days;
                    acc.international.count += user.international.count;
                    acc.international.days += user.international.days;
                    acc.rehab.count += user.rehab.count;
                    acc.rehab.days += user.rehab.days;
                    acc.followSpouse.count += user.followSpouse.count;
                    acc.followSpouse.days += user.followSpouse.days;
                    acc.workOther.count += user.workOther.count;
                    acc.workOther.days += user.workOther.days;
                    acc.totalCount += user.totalCount;
                    acc.totalDays += user.totalDays;
                    return acc;
                }, {
                    sick: {count:0, days:0}, maternity: {count:0, days:0}, helpWife: {count:0, days:0},
                    personal: {count:0, days:0}, vacation: {count:0, days:0}, ordination: {count:0, days:0},
                    study: {count:0, days:0}, international: {count:0, days:0}, rehab: {count:0, days:0},
                    followSpouse: {count:0, days:0}, workOther: {count:0, days:0}, totalCount: 0, totalDays: 0
                });
                
                data.push([]);
                data.push([
                    'สรุปรวม', '', '',
                    totals.sick.count, totals.sick.days,
                    totals.maternity.count, totals.maternity.days,
                    totals.helpWife.count, totals.helpWife.days,
                    totals.personal.count, totals.personal.days,
                    totals.vacation.count, totals.vacation.days,
                    totals.ordination.count, totals.ordination.days,
                    totals.study.count, totals.study.days,
                    totals.international.count, totals.international.days,
                    totals.rehab.count, totals.rehab.days,
                    totals.followSpouse.count, totals.followSpouse.days,
                    totals.workOther.count, totals.workOther.days,
                    totals.totalCount, totals.totalDays
                ]);
                
                data.push([]);
                data.push(['หมายเหตุ: แสดงเฉพาะบุคลากรที่มีการลาในช่วงเวลาที่เลือก']);
                data.push([`จำนวนบุคลากรที่ลา: ${sortedUsers.length} คน`]);

                // Create workbook
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(data);

                // Set column widths
                ws['!cols'] = [
                    { wch: 8 },   // ลำดับ
                    { wch: 25 },  // ชื่อ
                    { wch: 20 },  // ตำแหน่ง
                    { wch: 12 }, { wch: 12 }, // ลาป่วย
                    { wch: 12 }, { wch: 12 }, // ลาคลอด
                    { wch: 14 }, { wch: 14 }, // ลาช่วยภริยา
                    { wch: 12 }, { wch: 12 }, // ลากิจ
                    { wch: 14 }, { wch: 14 }, // ลาพักผ่อน
                    { wch: 14 }, { wch: 14 }, // ลาอุปสมบท
                    { wch: 12 }, { wch: 12 }, // ลาศึกษา
                    { wch: 14 }, { wch: 14 }, // ลาองค์การฯ
                    { wch: 13 }, { wch: 13 }, // ลาฟื้นฟูฯ
                    { wch: 14 }, { wch: 14 }, // ลาติดตามฯ
                    { wch: 16 }, { wch: 16 }, // ลาปฏิบัติงานฯ
                    { wch: 15 }, { wch: 15 }  // รวม
                ];

                // Add worksheet to workbook
                XLSX.utils.book_append_sheet(wb, ws, 'รายงานการลา');

                // Generate filename
                const filename = `รายงานการลา_${startDate}_${endDate}.xlsx`;

                // Save file
                XLSX.writeFile(wb, filename);

                alert('✅ ส่งออกรายงานเรียบร้อยแล้ว');

            } catch (error) {
                console.error('Export error:', error);
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            }
        };

        window.saveSettings = function() {
            alert('💾 บันทึกการตั้งค่าเรียบร้อยแล้ว');
        };

        // Load Report Summary - Show only used leave types
        window.loadReportSummary = async function() {
            try {
                const startDate = document.getElementById('reportStartDate').value;
                const endDate = document.getElementById('reportEndDate').value;

                if (!startDate || !endDate) {
                    alert('⚠️ กรุณาเลือกช่วงเวลาก่อน');
                    return;
                }

                const container = document.getElementById('reportSummaryContainer');
                container.innerHTML = '<div style="text-align: center; padding: 40px;"><div style="border: 2px solid var(--border); border-top: 2px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 0.8s linear infinite; margin: 0 auto 15px;"></div>กำลังโหลดรายงาน...</div>';

                const leavesSnapshot = await getDocs(collection(db, 'leaves'));
                const usersSnapshot = await getDocs(collection(db, 'users'));

                const leaveTypeIcons = {
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

                const userLeaveDetail = new Map();
                const usedLeaveTypes = new Set();
                
                // Stats for cards
                let totalLeaves = 0;
                let sickCount = 0;
                let personalCount = 0;
                let maternityCount = 0;
                let otherCount = 0;

                // Initialize user data
                usersSnapshot.forEach(docSnap => {
                    const user = docSnap.data();
                    if (user.role === 'teacher') {
                        userLeaveDetail.set(docSnap.id, {
                            name: user.name,
                            position: user.position || '',
                            leaves: {}
                        });
                    }
                });

                // Process leaves
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
                            const type = leave.type;
                            
                            usedLeaveTypes.add(type);
                            totalLeaves++;
                            
                            // Count by type for cards
                            if (type === 'ลาป่วย') sickCount++;
                            else if (type === 'ลากิจส่วนตัว') personalCount++;
                            else if (type === 'ลาคลอดบุตร') maternityCount++;
                            else otherCount++;
                            
                            if (!userLeave.leaves[type]) {
                                userLeave.leaves[type] = { count: 0, days: 0 };
                            }
                            
                            userLeave.leaves[type].count++;
                            userLeave.leaves[type].days += days;
                        }
                    }
                });
                
                // Update stat cards
                document.getElementById('reportTotalLeaves').textContent = totalLeaves;
                document.getElementById('reportSickLeaves').textContent = sickCount;
                document.getElementById('reportPersonalLeaves').textContent = personalCount;
                document.getElementById('reportMaternityLeaves').textContent = maternityCount;
                document.getElementById('reportOtherLeaves').textContent = otherCount;

                // Filter users who have leaves
                const usersWithLeaves = Array.from(userLeaveDetail.values())
                    .filter(user => Object.keys(user.leaves).length > 0)
                    .sort((a, b) => {
                        const aTotalDays = Object.values(a.leaves).reduce((sum, l) => sum + l.days, 0);
                        const bTotalDays = Object.values(b.leaves).reduce((sum, l) => sum + l.days, 0);
                        return bTotalDays - aTotalDays;
                    });

                if (usersWithLeaves.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 3rem; margin-bottom: 15px;">📭</div>
                            <div style="font-size: 1.1rem; color: var(--text);">ไม่มีข้อมูลการลาในช่วงเวลาที่เลือก</div>
                            <div style="font-size: 0.9rem; color: var(--text-light); margin-top: 8px;">
                                ${new Date(startDate).toLocaleDateString('th-TH')} - ${new Date(endDate).toLocaleDateString('th-TH')}
                            </div>
                        </div>
                    `;
                    return;
                }

                const sortedLeaveTypes = Array.from(usedLeaveTypes).sort();

                // Calculate totals
                const typeTotals = {};
                sortedLeaveTypes.forEach(type => {
                    typeTotals[type] = { count: 0, days: 0 };
                });

                usersWithLeaves.forEach(user => {
                    sortedLeaveTypes.forEach(type => {
                        if (user.leaves[type]) {
                            typeTotals[type].count += user.leaves[type].count;
                            typeTotals[type].days += user.leaves[type].days;
                        }
                    });
                });

                const grandTotalCount = Object.values(typeTotals).reduce((sum, t) => sum + t.count, 0);
                const grandTotalDays = Object.values(typeTotals).reduce((sum, t) => sum + t.days, 0);

                // Build HTML
                let html = `
                    <div style="background: var(--bg); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="font-size: 1.2rem; color: var(--text); margin: 0;">📊 รายงานสรุปการลา</h3>
                            <div style="font-size: 0.9rem; color: var(--text-light);">
                                ${new Date(startDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} 
                                - 
                                ${new Date(endDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <div style="background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid var(--border);">
                                <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary);">${usersWithLeaves.length}</div>
                                <div style="font-size: 0.85rem; color: var(--text-light);">บุคลากรที่ลา</div>
                            </div>
                            <div style="background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid var(--border);">
                                <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary);">${grandTotalCount}</div>
                                <div style="font-size: 0.85rem; color: var(--text-light);">จำนวนครั้งทั้งหมด</div>
                            </div>
                            <div style="background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid var(--border);">
                                <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary);">${grandTotalDays}</div>
                                <div style="font-size: 0.85rem; color: var(--text-light);">จำนวนวันทั้งหมด</div>
                            </div>
                        </div>
                    </div>

                    <div class="table-container">
                        <table style="font-size: 0.9rem;">
                            <thead>
                                <tr>
                                    <th style="position: sticky; left: 0; background: white; z-index: 2;">ลำดับ</th>
                                    <th style="position: sticky; left: 50px; background: white; z-index: 2; min-width: 180px;">ชื่อ-นามสกุล</th>
                                    <th style="position: sticky; left: 230px; background: white; z-index: 2; min-width: 150px;">ตำแหน่ง</th>
                `;

                sortedLeaveTypes.forEach(type => {
                    html += `<th colspan="2" style="background: var(--bg); text-align: center; min-width: 120px;">${leaveTypeIcons[type] || '📋'} ${type}</th>`;
                });

                html += `
                                    <th colspan="2" style="background: #dbeafe; text-align: center; font-weight: 700;">รวมทั้งหมด</th>
                                </tr>
                                <tr style="background: var(--bg);">
                                    <th colspan="3"></th>
                `;

                sortedLeaveTypes.forEach(() => {
                    html += `<th style="font-size: 0.8rem; font-weight: 500;">ครั้ง</th><th style="font-size: 0.8rem; font-weight: 500;">วัน</th>`;
                });

                html += `
                                    <th style="font-size: 0.8rem; font-weight: 700;">ครั้ง</th>
                                    <th style="font-size: 0.8rem; font-weight: 700;">วัน</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                usersWithLeaves.forEach((user, index) => {
                    const userTotalCount = Object.values(user.leaves).reduce((sum, l) => sum + l.count, 0);
                    const userTotalDays = Object.values(user.leaves).reduce((sum, l) => sum + l.days, 0);

                    html += `
                        <tr>
                            <td style="position: sticky; left: 0; background: white;">${index + 1}</td>
                            <td style="position: sticky; left: 50px; background: white;"><strong>${user.name}</strong></td>
                            <td style="position: sticky; left: 230px; background: white;">${user.position}</td>
                    `;

                    sortedLeaveTypes.forEach(type => {
                        const leave = user.leaves[type];
                        if (leave) {
                            html += `
                                <td style="text-align: center;">${leave.count}</td>
                                <td style="text-align: center;"><strong>${leave.days}</strong></td>
                            `;
                        } else {
                            html += `<td style="text-align: center; color: var(--text-light);">-</td><td style="text-align: center; color: var(--text-light);">-</td>`;
                        }
                    });

                    html += `
                            <td style="text-align: center; background: #dbeafe; font-weight: 700;">${userTotalCount}</td>
                            <td style="text-align: center; background: #dbeafe; font-weight: 700;">${userTotalDays}</td>
                        </tr>
                    `;
                });

                // Summary row
                html += `
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td colspan="3" style="position: sticky; left: 0; background: #f1f5f9;">สรุปรวม</td>
                `;

                sortedLeaveTypes.forEach(type => {
                    html += `
                        <td style="text-align: center;">${typeTotals[type].count}</td>
                        <td style="text-align: center;">${typeTotals[type].days}</td>
                    `;
                });

                html += `
                        <td style="text-align: center; background: #bfdbfe; font-weight: 700;">${grandTotalCount}</td>
                        <td style="text-align: center; background: #bfdbfe; font-weight: 700;">${grandTotalDays}</td>
                    </tr>
                `;

                html += `
                            </tbody>
                        </table>
                    </div>
                `;

                container.innerHTML = html;

            } catch (error) {
                console.error('Error loading report:', error);
                document.getElementById('reportSummaryContainer').innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--danger);">
                        ❌ เกิดข้อผิดพลาด: ${error.message}
                    </div>
                `;
            }
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

        // Get Thai fiscal year (1 Oct - 30 Sep)
        function getFiscalYear(date = new Date()) {
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-11
            
            // If month is 0-8 (Jan-Sep), fiscal year is current year
            // If month is 9-11 (Oct-Dec), fiscal year is next year
            return month >= 9 ? year + 1 : year;
        }

        // Get days until fiscal year end
        function getDaysUntilFiscalYearEnd() {
            const today = new Date();
            const currentFY = getFiscalYear(today);
            const fyEnd = new Date(currentFY, 8, 30, 23, 59, 59, 999); // Sep 30
            
            const diffTime = fyEnd - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays > 0 ? diffDays : 0;
        }

        // Show fiscal year notification banner
        function showFiscalYearNotification() {
            const daysLeft = getDaysUntilFiscalYearEnd();
            const banner = document.getElementById('fiscalYearBanner');
            const bannerIcon = document.getElementById('bannerIcon');
            const bannerTitle = document.getElementById('bannerTitle');
            const bannerMessage = document.getElementById('bannerMessage');
            
            // Check if banner was dismissed today
            const dismissedDate = localStorage.getItem('fyBannerDismissed');
            const today = new Date().toDateString();
            
            if (dismissedDate === today) {
                return; // Don't show if dismissed today
            }
            
            // Show banner based on days left
            if (daysLeft > 0 && daysLeft <= 30) {
                const currentFY = getFiscalYear();
                
                // Determine severity and message
                if (daysLeft === 1) {
                    banner.className = 'fiscal-year-banner critical';
                    bannerIcon.textContent = '🚨';
                    bannerTitle.textContent = '⚠️ การรีเซ็ตปีงบประมาณ - พรุ่งนี้!';
                    bannerMessage.textContent = `ระบบจะรีเซ็ตวันลาอัตโนมัติในวันพรุ่งนี้ (1 ตุลาคม ${currentFY}) กรุณาตรวจสอบคำขอที่รออนุมัติและดาวน์โหลดรายงานก่อนปีงบสิ้นสุด`;
                } else if (daysLeft <= 7) {
                    banner.className = 'fiscal-year-banner critical';
                    bannerIcon.textContent = '⚠️';
                    bannerTitle.textContent = '⚠️ การรีเซ็ตปีงบประมาณ - เร็วๆ นี้!';
                    bannerMessage.textContent = `ระบบจะรีเซ็ตวันลาอัตโนมัติในวันที่ 1 ตุลาคม ${currentFY} (เหลืออีก ${daysLeft} วัน) กรุณาเตรียมพร้อมและดาวน์โหลดรายงานประจำปี`;
                } else if (daysLeft <= 14) {
                    banner.className = 'fiscal-year-banner urgent';
                    bannerIcon.textContent = '📅';
                    bannerTitle.textContent = 'การรีเซ็ตปีงบประมาณ';
                    bannerMessage.textContent = `ระบบจะรีเซ็ตวันลาอัตโนมัติในวันที่ 1 ตุลาคม ${currentFY} (เหลืออีก ${daysLeft} วัน)`;
                } else {
                    banner.className = 'fiscal-year-banner';
                    bannerIcon.textContent = '📢';
                    bannerTitle.textContent = 'แจ้งเตือนปีงบประมาณใหม่';
                    bannerMessage.textContent = `ระบบจะรีเซ็ตวันลาอัตโนมัติในวันที่ 1 ตุลาคม ${currentFY} (เหลืออีก ${daysLeft} วัน)`;
                }
                
                banner.style.display = 'block';
                document.body.classList.add('has-banner');
            } else if (daysLeft === 0) {
                // Today is Oct 1 - show different message
                const currentFY = getFiscalYear();
                banner.className = 'fiscal-year-banner critical';
                bannerIcon.textContent = '🎉';
                bannerTitle.textContent = 'วันนี้คือวันรีเซ็ตปีงบประมาณ!';
                bannerMessage.textContent = `ระบบกำลังรีเซ็ตวันลาสำหรับปีงบประมาณ ${currentFY} โปรดรอสักครู่...`;
                banner.style.display = 'block';
                document.body.classList.add('has-banner');
            }
        }

        // Close fiscal year banner
        window.closeFiscalYearBanner = function() {
            const banner = document.getElementById('fiscalYearBanner');
            banner.style.display = 'none';
            document.body.classList.remove('has-banner');
            
            // Save dismissal date
            localStorage.setItem('fyBannerDismissed', new Date().toDateString());
        };

        // Show fiscal year summary
        window.showFiscalYearSummary = async function() {
            try {
                const currentFY = getFiscalYear();
                const fyStart = new Date(currentFY - 1, 9, 1);
                const fyEnd = new Date(currentFY, 8, 30, 23, 59, 59, 999);
                const daysLeft = getDaysUntilFiscalYearEnd();
                
                // Get statistics
                const leavesSnapshot = await getDocs(collection(db, 'leaves'));
                const tripsSnapshot = await getDocs(collection(db, 'official_trips'));
                const latesSnapshot = await getDocs(collection(db, 'late_arrivals'));
                const usersSnapshot = await getDocs(collection(db, 'users'));
                
                let pendingLeaves = 0;
                let approvedLeaves = 0;
                let rejectedLeaves = 0;
                let totalTrips = 0;
                let totalLates = 0;
                let usersWithNoLeaveLeft = 0;
                let usersWithHighUsage = 0;
                let usersWithLowUsage = 0;
                
                leavesSnapshot.forEach(doc => {
                    const leave = doc.data();
                    const leaveDate = new Date(leave.startDate);
                    
                    if (leaveDate >= fyStart && leaveDate <= fyEnd) {
                        if (leave.status === 'รออนุมัติ') pendingLeaves++;
                        else if (leave.status === 'อนุมัติแล้ว') approvedLeaves++;
                        else if (leave.status === 'ปฏิเสธ') rejectedLeaves++;
                    }
                });
                
                tripsSnapshot.forEach(doc => {
                    const trip = doc.data();
                    const tripDate = new Date(trip.startDate || trip.date);
                    if (tripDate >= fyStart && tripDate <= fyEnd) totalTrips++;
                });
                
                latesSnapshot.forEach(doc => {
                    const late = doc.data();
                    const lateDate = new Date(late.date);
                    if (lateDate >= fyStart && lateDate <= fyEnd) totalLates++;
                });
                
                usersSnapshot.forEach(doc => {
                    const user = doc.data();
                    if (user.role === 'teacher') {
                        const sickRemaining = user.sickLeaveRemaining || 30;
                        const personalRemaining = user.personalLeaveRemaining || 12;
                        
                        const sickUsage = ((30 - sickRemaining) / 30) * 100;
                        const personalUsage = ((12 - personalRemaining) / 12) * 100;
                        const avgUsage = (sickUsage + personalUsage) / 2;
                        
                        if (sickRemaining === 0 && personalRemaining === 0) {
                            usersWithNoLeaveLeft++;
                        } else if (avgUsage >= 80) {
                            usersWithHighUsage++;
                        } else if (avgUsage <= 50) {
                            usersWithLowUsage++;
                        }
                    }
                });
                
                const summaryHTML = `
                    <div style="max-width: 700px; margin: 0 auto; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="font-size: 3rem; margin-bottom: 10px;">📊</div>
                            <h2 style="margin: 0; color: var(--primary); font-size: 1.8rem;">สรุปปีงบประมาณ ${currentFY - 1}</h2>
                            <p style="color: var(--text-light); margin: 10px 0 0 0;">
                                ช่วงเวลา: 1 ตุลาคม ${currentFY - 2} - 30 กันยายน ${currentFY - 1}
                            </p>
                            ${daysLeft > 0 ? `
                                <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; border: 2px solid #fbbf24;">
                                    <div style="font-size: 2rem; margin-bottom: 5px;">⏰</div>
                                    <strong style="color: #92400e; font-size: 1.2rem;">เหลือเวลาอีก ${daysLeft} วัน</strong>
                                    <div style="color: #92400e; font-size: 0.9rem; margin-top: 5px;">ก่อนระบบรีเซ็ตอัตโนมัติ</div>
                                </div>
                            ` : ''}
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                            <div style="padding: 20px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 10px; text-align: center;">
                                <div style="font-size: 2rem; margin-bottom: 8px;">📝</div>
                                <div style="font-size: 2rem; font-weight: bold; color: #1e40af;">${approvedLeaves}</div>
                                <div style="color: #1e40af; margin-top: 5px;">การลา (อนุมัติ)</div>
                            </div>
                            <div style="padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 10px; text-align: center;">
                                <div style="font-size: 2rem; margin-bottom: 8px;">⏳</div>
                                <div style="font-size: 2rem; font-weight: bold; color: #92400e;">${pendingLeaves}</div>
                                <div style="color: #92400e; margin-top: 5px;">รออนุมัติ</div>
                            </div>
                            <div style="padding: 20px; background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-radius: 10px; text-align: center;">
                                <div style="font-size: 2rem; margin-bottom: 8px;">🚗</div>
                                <div style="font-size: 2rem; font-weight: bold; color: #166534;">${totalTrips}</div>
                                <div style="color: #166534; margin-top: 5px;">ไปราชการ (ครั้ง)</div>
                            </div>
                            <div style="padding: 20px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 10px; text-align: center;">
                                <div style="font-size: 2rem; margin-bottom: 8px;">⏰</div>
                                <div style="font-size: 2rem; font-weight: bold; color: #991b1b;">${totalLates}</div>
                                <div style="color: #991b1b; margin-top: 5px;">เข้าสาย (ครั้ง)</div>
                            </div>
                        </div>

                        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
                            <h3 style="margin: 0 0 15px 0; color: var(--text); font-size: 1.2rem;">📈 สถิติบุคลากร</h3>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 8px;">
                                    <span style="color: var(--text);">ใช้วันลาหมดแล้ว:</span>
                                    <strong style="color: ${usersWithNoLeaveLeft > 0 ? '#dc2626' : '#059669'}; font-size: 1.2rem;">${usersWithNoLeaveLeft} คน</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 8px;">
                                    <span style="color: var(--text);">ใช้วันลามากกว่า 80%:</span>
                                    <strong style="color: ${usersWithHighUsage > 0 ? '#f59e0b' : '#059669'}; font-size: 1.2rem;">${usersWithHighUsage} คน</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 8px;">
                                    <span style="color: var(--text);">ใช้วันลาน้อยกว่า 50%:</span>
                                    <strong style="color: #059669; font-size: 1.2rem;">${usersWithLowUsage} คน</strong>
                                </div>
                            </div>
                        </div>

                        ${pendingLeaves > 0 ? `
                            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #fbbf24;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 1.5rem;">⚠️</span>
                                    <div>
                                        <strong style="color: #92400e;">มีคำขอที่รออนุมัติ ${pendingLeaves} คำขอ</strong>
                                        <div style="color: #92400e; font-size: 0.9rem; margin-top: 3px;">
                                            กรุณาตรวจสอบและอนุมัติก่อนปีงบสิ้นสุด
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <div style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); padding: 20px; border-radius: 10px; margin-bottom: 25px;">
                            <h3 style="margin: 0 0 10px 0; color: #3730a3; font-size: 1.1rem;">💡 เมื่อระบบรีเซ็ต (1 ตุลาคม ${currentFY})</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #3730a3;">
                                <li style="margin-bottom: 8px;">วันลาคงเหลือของทุกคนจะถูกรีเซ็ตเป็นค่าเริ่มต้น</li>
                                <li style="margin-bottom: 8px;">สถิติไปราชการและเข้าสายจะเริ่มนับใหม่</li>
                                <li style="margin-bottom: 8px;">ประวัติการลาทั้งหมดยังคงอยู่และสามารถดูย้อนหลังได้</li>
                            </ul>
                        </div>

                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button onclick="exportFiscalYearReport()" class="btn btn-primary" style="background: var(--primary); padding: 12px 24px;">
                                📊 ดาวน์โหลดรายงาน Excel
                            </button>
                            <button onclick="closeModal()" class="btn" style="background: var(--text-light); color: white; padding: 12px 24px;">
                                ปิด
                            </button>
                        </div>
                    </div>
                `;
                
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.style.zIndex = '10001';
                modal.innerHTML = summaryHTML;
                modal.onclick = function(e) {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                };
                
                window.closeModal = function() {
                    document.body.removeChild(modal);
                };
                
                document.body.appendChild(modal);
                
            } catch (error) {
                console.error('Error showing fiscal year summary:', error);
                alert('เกิดข้อผิดพลาดในการแสดงสรุปข้อมูล');
            }
        };

        // Export fiscal year report
        window.exportFiscalYearReport = async function() {
            try {
                if (typeof XLSX === 'undefined') {
                    alert('กรุณารอสักครู่ให้ระบบโหลดเสร็จ แล้วลองอีกครั้ง');
                    return;
                }

                const currentFY = getFiscalYear();
                const fyStart = new Date(currentFY - 1, 9, 1);
                const fyEnd = new Date(currentFY, 8, 30, 23, 59, 59, 999);
                
                const fyStartStr = `${currentFY - 1}-10-01`;
                const fyEndStr = `${currentFY}-09-30`;
                
                // Use existing export function with fiscal year dates
                document.getElementById('reportStartDate').value = fyStartStr;
                document.getElementById('reportEndDate').value = fyEndStr;
                
                await exportToExcel();
                
            } catch (error) {
                console.error('Error exporting fiscal year report:', error);
                alert('เกิดข้อผิดพลาดในการส่งออกรายงาน');
            }
        };

        // Check and reset for new fiscal year
        async function checkAndResetFiscalYear() {
            try {
                const currentFY = getFiscalYear();
                console.log('Current fiscal year:', currentFY);
                
                // Get system settings
                const settingsRef = doc(db, 'settings', 'system');
                const settingsDoc = await getDoc(settingsRef);
                const lastResetFY = settingsDoc.exists() ? settingsDoc.data().lastResetFiscalYear : null;

                console.log('Last reset fiscal year:', lastResetFY);

                if (lastResetFY !== currentFY) {
                    console.log(`🔄 New fiscal year detected: ${currentFY}. Resetting leave balances...`);

                    // Get all users
                    const usersSnapshot = await getDocs(collection(db, 'users'));
                    let resetCount = 0;
                    const updatePromises = [];

                    usersSnapshot.forEach(userDoc => {
                        const userData = userDoc.data();
                        if (userData.role === 'teacher') {
                            // Reset all leave types to default values
                            const resetData = {
                                sickLeaveRemaining: 30,
                                personalLeaveRemaining: 12,
                                maternityLeaveRemaining: 90,
                                vacationLeaveRemaining: 10,
                                ordinationLeaveRemaining: 120,
                                sterilizationLeaveRemaining: 60,
                                childcareLeaveRemaining: 365,
                                militaryLeaveRemaining: 60,
                                studyLeaveRemaining: 365,
                                followSpouseLeaveRemaining: 365,
                                workOtherLeaveRemaining: 365
                            };
                            
                            updatePromises.push(updateDoc(doc(db, 'users', userDoc.id), resetData));
                            resetCount++;
                        }
                    });

                    await Promise.all(updatePromises);

                    // Update last reset fiscal year
                    await setDoc(settingsRef, {
                        lastResetFiscalYear: currentFY,
                        lastResetDate: new Date().toISOString()
                    }, { merge: true });

                    console.log(`✅ Reset complete! ${resetCount} users updated for fiscal year ${currentFY}`);
                    
                    // Show notification to user
                    if (resetCount > 0) {
                        setTimeout(() => {
                            alert(`🎉 ระบบได้รีเซ็ตวันลาสำหรับปีงบประมาณ ${currentFY} เรียบร้อยแล้ว\n\nจำนวนบุคลากรที่ได้รับการรีเซ็ต: ${resetCount} คน`);
                        }, 2000);
                    }
                }
            } catch (error) {
                console.error('Error checking fiscal year reset:', error);
            }
        }

        // Initialize on page load
        function initialize() {
            updateAdminDisplay();
            updateDashboardStats();
            loadPendingRequests();
            loadOfficialTripsData();
            loadLateArrivalsData();
            calculateOfficialTripStats();
            calculateLateArrivalStats();
            
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            document.getElementById('reportStartDate').valueAsDate = firstDay;
            document.getElementById('reportEndDate').valueAsDate = today;
            
            // Set individual report dates
            document.getElementById('individualStartDate').valueAsDate = firstDay;
            document.getElementById('individualEndDate').valueAsDate = today;
            
            // Load individual report stats immediately
            loadIndividualReportStats();
            
            // Set today for daily reports
            document.getElementById('dailyReportDate').valueAsDate = today;
            document.getElementById('dailyTripDate').valueAsDate = today;
            
            // Load today's reports by default
            loadDailyReport();
            loadDailyTrip();
            
            // Check and reset for new fiscal year
            checkAndResetFiscalYear();
            
            // Show fiscal year notification banner
            showFiscalYearNotification();
            
            initializeEventListeners();
        }

        // Load official trips data
        // Calculate official trip stats
        async function calculateOfficialTripStats() {
            try {
                const now = new Date();
                const currentFY = getFiscalYear(now);
                
                // Fiscal year range: 1 Oct (previous year) - 30 Sep (current fiscal year)
                const fyStart = new Date(currentFY - 1, 9, 1); // Oct 1 of previous year
                const fyEnd = new Date(currentFY, 8, 30, 23, 59, 59, 999); // Sep 30 of fiscal year
                
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                
                const tripsSnapshot = await getDocs(collection(db, 'official_trips'));
                const usersSnapshot = await getDocs(collection(db, 'users'));
                
                let fyCount = 0;
                let fyDays = 0;
                let monthCount = 0;
                let monthDays = 0;
                const uniqueUsers = new Set();

                tripsSnapshot.forEach((doc) => {
                    const trip = doc.data();
                    const startDate = new Date(trip.startDate || trip.date);
                    const endDate = new Date(trip.endDate || trip.date);
                    
                    // Calculate days
                    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                    
                    // Fiscal year stats
                    if (startDate >= fyStart && startDate <= fyEnd) {
                        fyCount++;
                        fyDays += days;
                        uniqueUsers.add(trip.userId);
                    }
                    
                    // Month stats
                    if (startDate.getFullYear() === currentYear && startDate.getMonth() === currentMonth) {
                        monthCount++;
                        monthDays += days;
                    }
                });

                document.getElementById('adminTripTotal').textContent = fyCount;
                document.getElementById('adminTripTotalDays').textContent = `${fyDays} วัน`;
                document.getElementById('adminTripMonth').textContent = monthCount;
                document.getElementById('adminTripMonthDays').textContent = `${monthDays} วัน`;
                document.getElementById('adminTripPeople').textContent = uniqueUsers.size;
            } catch (error) {
                console.error('Error calculating trip stats:', error);
            }
        }

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

        // Calculate late arrival stats
        async function calculateLateArrivalStats() {
            try {
                const now = new Date();
                const currentFY = getFiscalYear(now);
                
                // Fiscal year range: 1 Oct (previous year) - 30 Sep (current fiscal year)
                const fyStart = new Date(currentFY - 1, 9, 1); // Oct 1 of previous year
                const fyEnd = new Date(currentFY, 8, 30, 23, 59, 59, 999); // Sep 30 of fiscal year
                
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth();
                
                const latesSnapshot = await getDocs(collection(db, 'late_arrivals'));
                
                let fyCount = 0;
                let monthCount = 0;
                const uniqueUsers = new Set();

                latesSnapshot.forEach((doc) => {
                    const late = doc.data();
                    const lateDate = new Date(late.date);
                    
                    // Fiscal year stats
                    if (lateDate >= fyStart && lateDate <= fyEnd) {
                        fyCount++;
                        uniqueUsers.add(late.userId);
                    }
                    
                    // Month stats
                    if (lateDate.getFullYear() === currentYear && lateDate.getMonth() === currentMonth) {
                        monthCount++;
                    }
                });

                document.getElementById('adminLateTotal').textContent = fyCount;
                document.getElementById('adminLateMonth').textContent = monthCount;
                document.getElementById('adminLatePeople').textContent = uniqueUsers.size;
            } catch (error) {
                console.error('Error calculating late arrival stats:', error);
            }
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

        // Load individual report stats only (for cards)
        window.loadIndividualReportStats = async function() {
            try {
                const startDate = document.getElementById('individualStartDate').value;
                const endDate = document.getElementById('individualEndDate').value;

                if (!startDate || !endDate) {
                    return;
                }

                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);

                // Get all users
                const usersSnapshot = await getDocs(collection(db, 'users'));
                let userCount = 0;
                usersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    if (userData.role === 'teacher') {
                        userCount++;
                    }
                });

                // Count trips
                const tripsSnapshot = await getDocs(collection(db, 'official_trips'));
                let totalTrips = 0;
                tripsSnapshot.forEach(doc => {
                    const trip = doc.data();
                    const tripDate = trip.startDate ? new Date(trip.startDate) : (trip.date ? new Date(trip.date) : null);
                    if (tripDate && tripDate >= start && tripDate <= end) {
                        totalTrips++;
                    }
                });

                // Count late arrivals
                const latesSnapshot = await getDocs(collection(db, 'late_arrivals'));
                let totalLates = 0;
                latesSnapshot.forEach(doc => {
                    const late = doc.data();
                    const lateDate = new Date(late.date);
                    if (lateDate >= start && lateDate <= end) {
                        totalLates++;
                    }
                });

                // Update stats
                document.getElementById('reportTotalTrips').textContent = totalTrips;
                document.getElementById('reportTotalLates').textContent = totalLates;
                document.getElementById('reportTotalPeople').textContent = userCount;

            } catch (error) {
                console.error('Error loading individual report stats:', error);
            }
        };

        // Load individual report
        window.loadIndividualReport = async function() {
            const startDate = document.getElementById('individualStartDate').value;
            const endDate = document.getElementById('individualEndDate').value;
            const container = document.getElementById('individualReportContainer');

            if (!startDate || !endDate) {
                alert('กรุณาเลือกช่วงเวลา');
                return;
            }

            container.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner"></div><div style="margin-top: 15px;">กำลังโหลดข้อมูล...</div></div>';

            try {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);

                // Get all users
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const users = {};
                usersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    if (userData.role === 'teacher') {
                        users[doc.id] = {
                            name: userData.name,
                            position: userData.position || 'ครู',
                            trips: 0,
                            lates: 0
                        };
                    }
                });

                // Count trips
                const tripsSnapshot = await getDocs(collection(db, 'official_trips'));
                let totalTrips = 0;
                tripsSnapshot.forEach(doc => {
                    const trip = doc.data();
                    if (users[trip.userId]) {
                        const tripDate = trip.startDate ? new Date(trip.startDate) : (trip.date ? new Date(trip.date) : null);
                        if (tripDate && tripDate >= start && tripDate <= end) {
                            users[trip.userId].trips++;
                            totalTrips++;
                        }
                    }
                });

                // Count late arrivals
                const latesSnapshot = await getDocs(collection(db, 'late_arrivals'));
                let totalLates = 0;
                latesSnapshot.forEach(doc => {
                    const late = doc.data();
                    if (users[late.userId]) {
                        const lateDate = new Date(late.date);
                        if (lateDate >= start && lateDate <= end) {
                            users[late.userId].lates++;
                            totalLates++;
                        }
                    }
                });

                // Update stats
                document.getElementById('reportTotalTrips').textContent = totalTrips;
                document.getElementById('reportTotalLates').textContent = totalLates;
                document.getElementById('reportTotalPeople').textContent = Object.keys(users).length;

                // Sort by name
                const sortedUsers = Object.entries(users).sort((a, b) => 
                    a[1].name.localeCompare(b[1].name, 'th')
                );

                // Generate table
                let html = `
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                        <h3 style="font-size: 1.3rem; font-weight: 600; margin-bottom: 8px;">🚗⏰ รายงานการไปราชการและเข้าสาย</h3>
                        <p style="opacity: 0.95; font-size: 0.95rem;">${new Date(startDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top: 20px;">
                            <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; text-align: center;">
                                <div style="font-size: 2rem; font-weight: 700;">${Object.keys(users).length}</div>
                                <div style="font-size: 0.9rem; opacity: 0.95;">บุคลากรทั้งหมด</div>
                            </div>
                            <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; text-align: center;">
                                <div style="font-size: 2rem; font-weight: 700;">${totalTrips}</div>
                                <div style="font-size: 0.9rem; opacity: 0.95;">ครั้งไปราชการ</div>
                            </div>
                            <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; text-align: center;">
                                <div style="font-size: 2rem; font-weight: 700;">${totalLates}</div>
                                <div style="font-size: 0.9rem; opacity: 0.95;">ครั้งเข้าสาย</div>
                            </div>
                        </div>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">
                                    <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--text); border-bottom: 2px solid var(--border); position: sticky; left: 0; background: inherit; z-index: 10;">ลำดับ</th>
                                    <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--text); border-bottom: 2px solid var(--border); position: sticky; left: 60px; background: inherit; z-index: 10; min-width: 200px;">ชื่อ-นามสกุล</th>
                                    <th style="padding: 15px; text-align: left; font-weight: 600; color: var(--text); border-bottom: 2px solid var(--border); position: sticky; left: 280px; background: inherit; z-index: 10; min-width: 180px;">ตำแหน่ง</th>
                                    <th style="padding: 15px; text-align: center; font-weight: 600; color: var(--text); border-bottom: 2px solid var(--border);">🚗 ไปราชการ (ครั้ง)</th>
                                    <th style="padding: 15px; text-align: center; font-weight: 600; color: var(--text); border-bottom: 2px solid var(--border);">⏰ เข้าสาย (ครั้ง)</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                sortedUsers.forEach(([userId, user], index) => {
                    const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                    html += `
                        <tr style="background: ${rowBg}; transition: background 0.2s ease;">
                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border); position: sticky; left: 0; background: ${rowBg}; font-weight: 500;">${index + 1}</td>
                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border); position: sticky; left: 60px; background: ${rowBg}; font-weight: 500;">${user.name}</td>
                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border); position: sticky; left: 280px; background: ${rowBg}; color: var(--text-light);">${user.position}</td>
                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border); text-align: center; font-weight: 600; color: ${user.trips > 0 ? '#10b981' : 'var(--text-light)'};">${user.trips}</td>
                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border); text-align: center; font-weight: 600; color: ${user.lates > 0 ? '#f59e0b' : 'var(--text-light)'};">${user.lates}</td>
                        </tr>
                    `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                `;

                container.innerHTML = html;

                // Store data for export
                window.individualReportData = {
                    dateRange: `${new Date(startDate).toLocaleDateString('th-TH')} - ${new Date(endDate).toLocaleDateString('th-TH')}`,
                    users: sortedUsers.map(([userId, user]) => ({
                        name: user.name,
                        position: user.position,
                        trips: user.trips,
                        lates: user.lates
                    })),
                    totals: {
                        trips: totalTrips,
                        lates: totalLates
                    }
                };

            } catch (error) {
                console.error('Error loading individual report:', error);
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--danger);">
                        <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
                        <div>เกิดข้อผิดพลาดในการโหลดรายงาน</div>
                    </div>
                `;
            }
        };

        // Export individual report to Excel
        window.exportIndividualReport = function() {
            // Check if XLSX library is loaded
            if (typeof XLSX === 'undefined') {
                alert('กรุณารอสักครู่ให้ระบบโหลดเสร็จ แล้วลองอีกครั้ง');
                return;
            }

            if (!window.individualReportData || !window.individualReportData.users || window.individualReportData.users.length === 0) {
                alert('กรุณาแสดงรายงานก่อนส่งออก Excel');
                return;
            }

            try {
                // Create workbook
                const wb = XLSX.utils.book_new();

                // Prepare data
                const data = [
                    ['รายงานการไปราชการและเข้าสาย (รายบุคคล)'],
                    [`ช่วงเวลา: ${window.individualReportData.dateRange}`],
                    [],
                    ['ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'ไปราชการ (ครั้ง)', 'เข้าสาย (ครั้ง)']
                ];

                window.individualReportData.users.forEach((user, index) => {
                    data.push([
                        index + 1,
                        user.name,
                        user.position,
                        user.trips,
                        user.lates
                    ]);
                });

                // Add summary
                data.push([]);
                data.push(['รวม', '', '', window.individualReportData.totals.trips, window.individualReportData.totals.lates]);

                // Create worksheet
                const ws = XLSX.utils.aoa_to_sheet(data);

                // Set column widths
                ws['!cols'] = [
                    { wch: 8 },   // ลำดับ
                    { wch: 30 },  // ชื่อ
                    { wch: 25 },  // ตำแหน่ง
                    { wch: 15 },  // ไปราชการ
                    { wch: 12 }   // เข้าสาย
                ];

                // Add worksheet to workbook
                XLSX.utils.book_append_sheet(wb, ws, 'รายงานไปราชการและเข้าสาย');

                // Generate filename
                const startDate = document.getElementById('individualStartDate').value;
                const endDate = document.getElementById('individualEndDate').value;
                const filename = `รายงานไปราชการและเข้าสาย_${startDate}_${endDate}.xlsx`;

                // Save file
                XLSX.writeFile(wb, filename);
                
                console.log('Excel file exported successfully');
            } catch (error) {
                console.error('Error exporting Excel:', error);
                alert('เกิดข้อผิดพลาดในการส่งออก Excel: ' + error.message);
            }
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
