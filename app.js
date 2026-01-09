// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, getDocs, updateDoc, query, where, orderBy, Timestamp, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
console.log('🔥 กำลังเชื่อมต่อ Firebase...');
console.log('📁 Project ID:', firebaseConfig.projectId);

let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('✅ Firebase เชื่อมต่อสำเร็จ!');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('ไม่สามารถเชื่อมต่อ Firebase ได้: ' + error.message + '\n\nกรุณาตรวจสอบ:\n1. เปิดใช้งาน Authentication (Email/Password)\n2. สร้าง Firestore Database\n3. อัพโหลด Security Rules');
}

// Global variables
let currentUser = null;
let currentUserData = null;

// Leave type names in Thai
const leaveTypeNames = {
    annual: 'ลาพักผ่อน',
    sick: 'ลาป่วย',
    personal: 'ลากิจ',
    maternity: 'ลาคลอด'
};

// Leave balance according to civil servant regulations
const defaultLeaveBalance = {
    annual: 10,  // ลาพักผ่อน 10 วัน/ปี
    sick: 30,    // ลาป่วย 30 วัน/ปี
    personal: 60, // ลากิจ 60 วัน/ปี
    maternity: 90 // ลาคลอด 90 วัน
};

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const toast = document.getElementById('toast');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 เริ่มต้นแอปพลิเคชัน');
    
    setupEventListeners();
    
    // Set timeout to hide loading screen if Firebase doesn't respond
    const loadingTimeout = setTimeout(() => {
        console.error('⏰ Firebase ไม่ตอบสนองภายใน 10 วินาที');
        hideLoading();
        showLogin();
        showToast('กรุณารอสักครู่แล้วลองใหม่อีกครั้ง', 'warning');
    }, 10000); // 10 seconds timeout
    
    // Monitor auth state
    onAuthStateChanged(auth, async (user) => {
        clearTimeout(loadingTimeout);
        console.log('✅ Firebase Auth พร้อมใช้งาน');
        
        if (user) {
            console.log('👤 ผู้ใช้: ', user.email);
            currentUser = user;
            try {
                await loadUserData();
                showApp();
            } catch (error) {
                console.error('❌ Error loading user data:', error);
                showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
                await signOut(auth);
                showLogin();
            }
        } else {
            console.log('👤 ไม่มีผู้ใช้ล็อกอิน (ปกติ)');
            showLogin();
        }
        hideLoading();
    }, (error) => {
        clearTimeout(loadingTimeout);
        console.error('❌ Firebase Auth Error:', error);
        hideLoading();
        showLogin();
        
        if (error.code === 'auth/api-key-not-valid') {
            showToast('Firebase API Key ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ', 'error');
        } else {
            showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
    });
});

// Setup event listeners
function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Leave request form
    document.getElementById('leaveRequestForm').addEventListener('submit', handleLeaveRequest);
    document.getElementById('resetForm').addEventListener('click', resetLeaveForm);
    document.getElementById('startDate').addEventListener('change', calculateDays);
    document.getElementById('endDate').addEventListener('change', calculateDays);

    // Status filter
    document.getElementById('statusFilter').addEventListener('change', loadMyRequests);

    // Import users
    document.getElementById('selectFile').addEventListener('click', () => {
        document.getElementById('csvFile').click();
    });
    document.getElementById('csvFile').addEventListener('change', handleFileSelect);
    document.getElementById('importUsers').addEventListener('click', handleImportUsers);
    document.getElementById('downloadTemplate').addEventListener('click', downloadTemplate);

    // Modal
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('approveBtn').addEventListener('click', () => handleApproval('approved'));
    document.getElementById('rejectBtn').addEventListener('click', () => handleApproval('rejected'));
}

// Authentication handlers
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        showLoading();
        await signInWithEmailAndPassword(auth, email, password);
        showToast('เข้าสู่ระบบสำเร็จ', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showToast('เข้าสู่ระบบไม่สำเร็จ: ' + error.message, 'error');
        hideLoading();
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showToast('ออกจากระบบสำเร็จ', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
}

// Load user data
async function loadUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            currentUserData = { id: userDoc.id, ...userDoc.data() };
            updateUIWithUserData();
            await loadLeaveBalance();
            await loadMyRequests();
            
            // Show manager tabs if user is manager
            if (currentUserData.role === 'manager' || currentUserData.role === 'admin') {
                document.getElementById('approvalsTab').style.display = 'block';
                await loadPendingApprovals();
            }
            
            // Show import tab if admin
            if (currentUserData.role === 'admin') {
                document.getElementById('importTab').style.display = 'block';
            }
        } else {
            showToast('ไม่พบข้อมูลผู้ใช้', 'error');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    }
}

function updateUIWithUserData() {
    document.getElementById('userName').textContent = currentUserData.name;
    const roleBadge = document.getElementById('userRole');
    
    if (currentUserData.role === 'admin') {
        roleBadge.textContent = 'ผู้ดูแลระบบ';
        roleBadge.style.backgroundColor = '#ef4444';
    } else if (currentUserData.role === 'manager') {
        roleBadge.textContent = 'ผู้จัดการ';
        roleBadge.style.backgroundColor = '#f59e0b';
    } else {
        roleBadge.textContent = 'ครู';
        roleBadge.style.backgroundColor = '#2563eb';
    }
    
    document.getElementById('currentYear').textContent = new Date().getFullYear() + 543;
}

// Load leave balance
async function loadLeaveBalance() {
    const balance = currentUserData.leaveBalance || defaultLeaveBalance;
    
    document.getElementById('annualBalance').textContent = balance.annual || 0;
    document.getElementById('sickBalance').textContent = balance.sick || 0;
    document.getElementById('personalBalance').textContent = balance.personal || 0;
    document.getElementById('maternityBalance').textContent = balance.maternity || 90;
    
    // Calculate summary
    await calculateLeaveSummary();
}

async function calculateLeaveSummary() {
    try {
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31);
        
        const q = query(
            collection(db, 'leaveRequests'),
            where('userId', '==', currentUser.uid),
            where('createdAt', '>=', Timestamp.fromDate(startOfYear)),
            where('createdAt', '<=', Timestamp.fromDate(endOfYear))
        );
        
        const snapshot = await getDocs(q);
        let totalUsed = 0;
        let totalPending = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'approved') {
                totalUsed += data.days || 0;
            } else if (data.status === 'pending') {
                totalPending += data.days || 0;
            }
        });
        
        document.getElementById('totalUsed').textContent = totalUsed + ' วัน';
        document.getElementById('totalPending').textContent = totalPending + ' วัน';
    } catch (error) {
        console.error('Error calculating summary:', error);
    }
}

// Leave request handlers
function calculateDays() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('totalDays').value = diffDays;
    }
}

async function handleLeaveRequest(e) {
    e.preventDefault();
    
    const leaveType = document.getElementById('leaveType').value;
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    const days = parseInt(document.getElementById('totalDays').value);
    const reason = document.getElementById('reason').value;
    const contact = document.getElementById('contactDuringLeave').value;
    
    // Validation
    if (!validateLeaveRequest(leaveType, startDate, days)) {
        return;
    }
    
    try {
        showLoading();
        
        // Find manager
        const managersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'manager')
        );
        const managersSnapshot = await getDocs(managersQuery);
        let managerId = null;
        let managerName = '';
        
        if (!managersSnapshot.empty) {
            const managerDoc = managersSnapshot.docs[0];
            managerId = managerDoc.id;
            managerName = managerDoc.data().name;
        }
        
        // Create leave request
        await addDoc(collection(db, 'leaveRequests'), {
            userId: currentUser.uid,
            employeeName: currentUserData.name,
            department: currentUserData.department || '',
            position: currentUserData.position || 'ครู',
            leaveType: leaveType,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            days: days,
            reason: reason,
            contactDuringLeave: contact,
            status: 'pending',
            managerId: managerId,
            managerName: managerName,
            reviewedAt: null,
            reviewComment: '',
            createdAt: Timestamp.now()
        });
        
        showToast('ยื่นคำขอลาสำเร็จ', 'success');
        resetLeaveForm();
        await loadMyRequests();
        switchTab('my-requests');
        hideLoading();
    } catch (error) {
        console.error('Error submitting leave request:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        hideLoading();
    }
}

function validateLeaveRequest(leaveType, startDate, days) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentHour = now.getHours();
    
    // Check for personal leave (must be at least 3 days in advance)
    if (leaveType === 'personal') {
        const diffTime = startDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 3) {
            showToast('การลากิจต้องยื่นคำขอล่วงหน้าอย่างน้อย 3 วัน กรุณาติดต่อเจ้าหน้าที่โดยตรง', 'error');
            return false;
        }
    }
    
    // Check for sick leave (must be before 8:00 AM of the day)
    if (leaveType === 'sick') {
        const isToday = startDate.toDateString() === today.toDateString();
        
        if (isToday && currentHour >= 8) {
            showToast('การลาป่วยต้องแจ้งก่อน 08:00 น. ของวันนั้น กรุณาติดต่อเจ้าหน้าที่โดยตรง', 'error');
            return false;
        }
    }
    
    // Check leave balance
    const balance = currentUserData.leaveBalance || defaultLeaveBalance;
    if (balance[leaveType] < days) {
        showToast('วันลาคงเหลือไม่เพียงพอ', 'error');
        return false;
    }
    
    return true;
}

function resetLeaveForm() {
    document.getElementById('leaveRequestForm').reset();
    document.getElementById('totalDays').value = 0;
}

// Load my requests
async function loadMyRequests() {
    const statusFilter = document.getElementById('statusFilter').value;
    const requestsList = document.getElementById('requestsList');
    
    try {
        let q = query(
            collection(db, 'leaveRequests'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            requestsList.innerHTML = '<div class="empty-state"><p>ไม่มีคำขอลา</p></div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Apply filter
            if (statusFilter !== 'all' && data.status !== statusFilter) {
                return;
            }
            
            const startDate = data.startDate.toDate().toLocaleDateString('th-TH');
            const endDate = data.endDate.toDate().toLocaleDateString('th-TH');
            
            html += `
                <div class="request-card ${data.status}">
                    <div class="request-header">
                        <div class="request-type">${leaveTypeNames[data.leaveType]}</div>
                        <span class="status-badge ${data.status}">${getStatusText(data.status)}</span>
                    </div>
                    <div class="request-details">
                        <div class="request-detail-item">
                            <label>ระยะเวลา</label>
                            <span>${startDate} - ${endDate}</span>
                        </div>
                        <div class="request-detail-item">
                            <label>จำนวนวัน</label>
                            <span>${data.days} วัน</span>
                        </div>
                        <div class="request-detail-item">
                            <label>เหตุผล</label>
                            <span>${data.reason}</span>
                        </div>
                        ${data.reviewComment ? `
                        <div class="request-detail-item">
                            <label>หมายเหตุจากผู้อนุมัติ</label>
                            <span>${data.reviewComment}</span>
                        </div>
                        ` : ''}
                    </div>
                    ${data.status === 'pending' ? `
                    <div class="request-actions">
                        <button class="btn btn-danger" onclick="cancelRequest('${doc.id}')">ยกเลิกคำขอ</button>
                    </div>
                    ` : ''}
                </div>
            `;
        });
        
        requestsList.innerHTML = html || '<div class="empty-state"><p>ไม่มีคำขอลา</p></div>';
    } catch (error) {
        console.error('Error loading requests:', error);
        requestsList.innerHTML = '<div class="empty-state"><p>เกิดข้อผิดพลาด</p></div>';
    }
}

// Load pending approvals (for managers)
async function loadPendingApprovals() {
    const pendingList = document.getElementById('pendingList');
    
    try {
        const q = query(
            collection(db, 'leaveRequests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            pendingList.innerHTML = '<div class="empty-state"><p>ไม่มีคำขอที่รอพิจารณา</p></div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const startDate = data.startDate.toDate().toLocaleDateString('th-TH');
            const endDate = data.endDate.toDate().toLocaleDateString('th-TH');
            const createdDate = data.createdAt.toDate().toLocaleDateString('th-TH');
            
            html += `
                <div class="request-card pending">
                    <div class="request-header">
                        <div>
                            <div class="request-type">${leaveTypeNames[data.leaveType]}</div>
                            <small>ยื่นโดย: ${data.employeeName} (${data.position || 'ครู'})</small>
                        </div>
                        <span class="status-badge pending">รอพิจารณา</span>
                    </div>
                    <div class="request-details">
                        <div class="request-detail-item">
                            <label>แผนก</label>
                            <span>${data.department || '-'}</span>
                        </div>
                        <div class="request-detail-item">
                            <label>ระยะเวลา</label>
                            <span>${startDate} - ${endDate}</span>
                        </div>
                        <div class="request-detail-item">
                            <label>จำนวนวัน</label>
                            <span>${data.days} วัน</span>
                        </div>
                        <div class="request-detail-item">
                            <label>เหตุผล</label>
                            <span>${data.reason}</span>
                        </div>
                        ${data.contactDuringLeave ? `
                        <div class="request-detail-item">
                            <label>ติดต่อได้ที่</label>
                            <span>${data.contactDuringLeave}</span>
                        </div>
                        ` : ''}
                        <div class="request-detail-item">
                            <label>วันที่ยื่นคำขอ</label>
                            <span>${createdDate}</span>
                        </div>
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-primary" onclick="openApprovalModal('${doc.id}')">พิจารณา</button>
                    </div>
                </div>
            `;
        });
        
        pendingList.innerHTML = html;
    } catch (error) {
        console.error('Error loading pending approvals:', error);
        pendingList.innerHTML = '<div class="empty-state"><p>เกิดข้อผิดพลาด</p></div>';
    }
}

// Approval modal
let currentApprovalId = null;

window.openApprovalModal = async function(requestId) {
    currentApprovalId = requestId;
    const modal = document.getElementById('approvalModal');
    const details = document.getElementById('modalRequestDetails');
    
    try {
        const docRef = doc(db, 'leaveRequests', requestId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const startDate = data.startDate.toDate().toLocaleDateString('th-TH');
            const endDate = data.endDate.toDate().toLocaleDateString('th-TH');
            
            details.innerHTML = `
                <p><strong>ชื่อ:</strong> ${data.employeeName}</p>
                <p><strong>ตำแหน่ง:</strong> ${data.position || 'ครู'}</p>
                <p><strong>แผนก:</strong> ${data.department || '-'}</p>
                <p><strong>ประเภท:</strong> ${leaveTypeNames[data.leaveType]}</p>
                <p><strong>ระยะเวลา:</strong> ${startDate} - ${endDate}</p>
                <p><strong>จำนวนวัน:</strong> ${data.days} วัน</p>
                <p><strong>เหตุผล:</strong> ${data.reason}</p>
                ${data.contactDuringLeave ? `<p><strong>ติดต่อได้ที่:</strong> ${data.contactDuringLeave}</p>` : ''}
            `;
            
            modal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading request:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
    }
};

function closeModal() {
    document.getElementById('approvalModal').style.display = 'none';
    document.getElementById('reviewComment').value = '';
    currentApprovalId = null;
}

async function handleApproval(status) {
    if (!currentApprovalId) return;
    
    const comment = document.getElementById('reviewComment').value;
    
    // Require comment for rejection
    if (status === 'rejected' && !comment) {
        showToast('กรุณาระบุเหตุผลที่ไม่อนุมัติ', 'error');
        return;
    }
    
    try {
        showLoading();
        const docRef = doc(db, 'leaveRequests', currentApprovalId);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        
        // Update request
        await updateDoc(docRef, {
            status: status,
            reviewedAt: Timestamp.now(),
            reviewComment: comment,
            reviewedBy: currentUser.uid,
            reviewerName: currentUserData.name
        });
        
        // Update user leave balance if approved
        if (status === 'approved') {
            const userRef = doc(db, 'users', data.userId);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            const currentBalance = userData.leaveBalance || defaultLeaveBalance;
            
            await updateDoc(userRef, {
                [`leaveBalance.${data.leaveType}`]: currentBalance[data.leaveType] - data.days
            });
        }
        
        showToast(status === 'approved' ? 'อนุมัติเรียบร้อย' : 'ไม่อนุมัติเรียบร้อย', 'success');
        closeModal();
        await loadPendingApprovals();
        hideLoading();
    } catch (error) {
        console.error('Error processing approval:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        hideLoading();
    }
}

// Cancel request
window.cancelRequest = async function(requestId) {
    if (!confirm('ต้องการยกเลิกคำขอนี้หรือไม่?')) return;
    
    try {
        showLoading();
        await updateDoc(doc(db, 'leaveRequests', requestId), {
            status: 'cancelled',
            cancelledAt: Timestamp.now()
        });
        
        showToast('ยกเลิกคำขอเรียบร้อย', 'success');
        await loadMyRequests();
        hideLoading();
    } catch (error) {
        console.error('Error cancelling request:', error);
        showToast('เกิดข้อผิดพลาด', 'error');
        hideLoading();
    }
};

// Import users functions
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('importUsers').disabled = false;
    }
}

async function handleImportUsers() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('กรุณาเลือกไฟล์', 'error');
        return;
    }
    
    try {
        showLoading();
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header
        const dataLines = lines.slice(1);
        
        const results = document.getElementById('importResults');
        results.innerHTML = '<h3>ผลการนำเข้า:</h3>';
        
        const batch = writeBatch(db);
        let successCount = 0;
        let errorCount = 0;
        
        for (const line of dataLines) {
            const [name, email, password, position, department] = line.split(',').map(s => s.trim());
            
            if (!name || !email || !password) {
                results.innerHTML += `<div class="result-item error">ข้อมูลไม่ครบถ้วน: ${line}</div>`;
                errorCount++;
                continue;
            }
            
            try {
                // Create user in Firebase Auth would require Admin SDK
                // For now, we'll just create the user document
                const userId = email.replace(/[^a-zA-Z0-9]/g, '_');
                const userRef = doc(db, 'users', userId);
                
                batch.set(userRef, {
                    name: name,
                    email: email,
                    position: position || 'ครู',
                    department: department || '',
                    role: 'employee',
                    leaveBalance: { ...defaultLeaveBalance },
                    createdAt: Timestamp.now()
                });
                
                results.innerHTML += `<div class="result-item success">✓ ${name} (${email})</div>`;
                successCount++;
            } catch (error) {
                results.innerHTML += `<div class="result-item error">✗ ${name}: ${error.message}</div>`;
                errorCount++;
            }
        }
        
        await batch.commit();
        
        results.innerHTML += `<div class="summary-item"><p><strong>สำเร็จ: ${successCount} รายการ</strong></p><p><strong>ล้มเหลว: ${errorCount} รายการ</strong></p></div>`;
        results.innerHTML += `<p style="margin-top: 20px; color: var(--warning-color);"><strong>หมายเหตุ:</strong> ผู้ใช้ต้องสร้างบัญชี Firebase Authentication ด้วยตนเองโดยใช้อีเมลที่นำเข้า</p>`;
        
        showToast('นำเข้าข้อมูลเสร็จสิ้น', 'success');
        
        // Reset form
        fileInput.value = '';
        document.getElementById('fileName').textContent = '';
        document.getElementById('importUsers').disabled = true;
        
        hideLoading();
    } catch (error) {
        console.error('Error importing users:', error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        hideLoading();
    }
}

function downloadTemplate() {
    const csv = 'name,email,password,position,department\nสมชาย ใจดี,somchai@school.ac.th,password123,ครู,ภาษาไทย\nสมหญิง รักดี,somying@school.ac.th,password456,ครู,คณิตศาสตร์';
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_import_teachers.csv';
    link.click();
}

// Utility functions
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Reload data if needed
    if (tabName === 'my-requests') {
        loadMyRequests();
    } else if (tabName === 'pending-approvals') {
        loadPendingApprovals();
    }
}

function getStatusText(status) {
    const statusMap = {
        pending: 'รอพิจารณา',
        approved: 'อนุมัติ',
        rejected: 'ไม่อนุมัติ',
        cancelled: 'ยกเลิก'
    };
    return statusMap[status] || status;
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    loadingScreen.style.display = 'flex';
}

function hideLoading() {
    loadingScreen.style.display = 'none';
}

function showLogin() {
    loginScreen.style.display = 'block';
    appScreen.style.display = 'none';
}

function showApp() {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
}
