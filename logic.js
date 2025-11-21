import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBk1eBJBmtP1mVRa1a7N6XeOnCOS3ENXGI",
    authDomain: "uni-league-58c00.firebaseapp.com",
    projectId: "uni-league-58c00",
    storageBucket: "uni-league-58c00.firebasestorage.app",
    messagingSenderId: "339550534504",
    appId: "1:339550534504:web:acdff633f1b2336cd1b4dd",
    measurementId: "G-PFRH7T4P5X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 상태 관리 ---
let currentUser = null;
let myTeamId = null;
let myTeamData = null;
let matchesData = []; 
let roster = []; 
let isEditMode = false;
let writeState = { type: '9man', gender: 'mixed' }; 
let isAuthChecked = false;
let currentMatchIdForModal = null;

const USE_MOCK_DATA = false; 

// --- UI Helper ---
function toggleLoading(show) {
    const el = document.getElementById('loading-overlay');
    if(show) el.classList.remove('hidden'); else el.classList.add('hidden');
}

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = () => document.querySelectorAll('[id^="modal-"]').forEach(el => el.classList.add('hidden'));

function router(page) {
    const targetId = page.startsWith('page-') ? page : `page-${page}`;
    const publicPages = ['page-login', 'page-register-email', 'page-team-setup'];

    if (isAuthChecked && !currentUser && !publicPages.includes(targetId)) {
        return router('page-login');
    }
    if (isAuthChecked && currentUser && publicPages.includes(targetId) && targetId !== 'page-team-setup') {
        return router('home');
    }

    document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');

    const tabBar = document.querySelector('nav.glass-nav');
    const headerActions = document.getElementById('header-actions');

    if(page === 'home' || page === 'locker') {
        tabBar.classList.remove('hidden');
        headerActions.classList.remove('hidden');
    } else {
        tabBar.classList.add('hidden');
        headerActions.classList.add('hidden');
    }

    const updateTab = (id, active) => {
        const el = document.getElementById(id);
        if(el) el.className = active ? 'flex flex-col items-center text-indigo-600 transition transform active:scale-90' : 'flex flex-col items-center text-gray-400 hover:text-indigo-600 transition transform active:scale-90';
    };
    updateTab('nav-home', page === 'home');
    updateTab('nav-locker', page === 'locker');
    window.scrollTo(0,0);
}

window.switchLockerTab = (tab) => {
    const teamView = document.getElementById('locker-team-view');
    const matchView = document.getElementById('locker-matches-view');
    const btnTeam = document.getElementById('tab-team');
    const btnMatch = document.getElementById('tab-matches');

    if (tab === 'team') {
        teamView.classList.remove('hidden');
        matchView.classList.add('hidden');
        btnTeam.className = "bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold transition";
        btnMatch.className = "bg-white text-slate-500 border border-slate-200 px-3 py-1 rounded-full text-xs font-bold transition";
    } else {
        teamView.classList.add('hidden');
        matchView.classList.remove('hidden');
        btnTeam.className = "bg-white text-slate-500 border border-slate-200 px-3 py-1 rounded-full text-xs font-bold transition";
        btnMatch.className = "bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold transition";
        loadMyMatchStatus(); 
    }
};

// --- Auth ---
onAuthStateChanged(auth, async (user) => {
    isAuthChecked = true;
    if (user) {
        currentUser = user;
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                myTeamId = userData.teamId;
                router('home');
                loadMatches(); 
                loadMyTeam();
                loadRankings();
            } else {
                router('page-team-setup');
            }
        } catch (e) { alert("오류 발생"); } finally { toggleLoading(false); }
    } else {
        currentUser = null;
        myTeamId = null;
        router('page-login');
        toggleLoading(false);
    }
});

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pw = document.getElementById('login-password').value;
    
    if(!email || !pw) return alert("이메일과 비밀번호를 입력해주세요.");
    
    toggleLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, pw);
    } catch (error) {
        toggleLoading(false);
        alert("로그인 실패: " + error.message);
    }
}

async function handleLogout() {
    if(confirm("로그아웃 하시겠습니까?")) {
        toggleLoading(true);
        await signOut(auth);
    }
}

async function handleRegisterStep1() {
    const email = document.getElementById('reg-email').value;
    const pw = document.getElementById('reg-password').value;

    if(!email.includes('@')) return alert("올바른 이메일을 입력해주세요.");
    if(pw.length < 6) return alert("비밀번호는 6자리 이상이어야 합니다.");

    toggleLoading(true);
    try {
        await createUserWithEmailAndPassword(auth, email, pw);
        toggleLoading(false);
        router('page-team-setup');
    } catch (error) {
        toggleLoading(false);
        alert("가입 실패: " + error.message);
    }
}

// [중요] 회원가입 시 카톡 ID 저장 로직 추가
async function handleRegisterStep2() {
    const teamName = document.getElementById('team-name').value;
    const nickname = document.getElementById('team-nickname').value;
    const level = document.getElementById('team-level').value;
    const kakaoId = document.getElementById('team-kakao').value; // 카톡 ID 가져오기
    const user = auth.currentUser;

    if(!teamName || !nickname || !kakaoId) return alert("모든 정보를 입력해주세요.");

    toggleLoading(true);
    try {
        const newTeamRef = doc(collection(db, "teams")); 
        await setDoc(newTeamRef, {
            name: teamName,
            level: level,
            captainId: user.uid,
            wins: 0,
            losses: 0,
            roster: [] 
        });

        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            nickname: nickname,
            teamId: newTeamRef.id,
            role: 'Captain',
            kakaoId: kakaoId // 유저 정보에 연락처 저장
        });

        toggleLoading(false);
        alert("팀 등록이 완료되었습니다!");
        myTeamId = newTeamRef.id;
        router('home');
        loadMyTeam();
        loadMatches();
        loadRankings();
    } catch (error) {
        toggleLoading(false);
        alert("팀 등록 오류: " + error.message);
    }
}

// --- Data Logic ---

// [수정] 매칭 로드 방식 변경 (색인 에러 방지)
// 기존: where("status", "==", "recruiting") 사용 -> 색인 필요 -> 에러 발생 가능성 높음
// 변경: orderBy("createdAt") 만 사용 -> 데이터 다 가져온 뒤 JS에서 필터링
function loadMatches() {
    // 쿼리 단순화: 최신순 정렬만 수행
    const q = query(collection(db, "matches"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        matchesData = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // JS에서 '모집 중(recruiting)'인 것만 필터링해서 담기
            if (data.status === 'recruiting') {
                matchesData.push({ id: doc.id, ...data });
            }
        });
        renderMatches('all'); 
    });
}

function renderMatches(filterType) {
    const container = document.getElementById('match-list-container');
    container.innerHTML = ''; 
    const filtered = matchesData.filter(m => filterType === 'all' || m.type === filterType || m.gender === filterType);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm">현재 모집 중인 매칭이 없습니다.</div>`;
        return;
    }

    filtered.forEach(m => {
        const genderLabel = m.gender === 'male' ? '남자' : (m.gender === 'female' ? '여자' : '혼성');
        const typeLabel = m.type === '9man' ? '9인제' : '6인제';
        const badgeColor = m.badgeColor || 'bg-indigo-100 text-indigo-600';
        const badge = m.badge || '모집중';
        
        const div = document.createElement('div');
        div.className = "bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition active:scale-[0.98] cursor-pointer";
        div.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex space-x-1">
                    <span class="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">${typeLabel}</span>
                    <span class="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">${genderLabel}</span>
                </div>
                <span class="${badgeColor} text-[10px] font-bold px-2 py-1 rounded-full">${badge}</span>
            </div>
            <h3 class="font-bold text-lg text-slate-800 mb-1">${m.team}</h3>
            <div class="flex items-center text-xs text-slate-500 mt-2 space-x-3">
                <span><i class="fa-regular fa-clock mr-1"></i> ${m.time}</span>
                <span><i class="fa-solid fa-location-dot mr-1"></i> ${m.loc}</span>
            </div>
        `;
        div.onclick = () => openMatchDetail(m.id);
        container.appendChild(div);
    });
}

window.openMatchDetail = async (id) => {
    let m = matchesData.find(item => item.id === id);
    if (!m) {
        const docSnap = await getDoc(doc(db, "matches", id));
        if (docSnap.exists()) m = { id: docSnap.id, ...docSnap.data() };
    }
    if(!m) return alert("존재하지 않는 매칭입니다.");

    document.getElementById('detail-title').innerText = m.team;
    document.getElementById('detail-time').innerText = m.time;
    document.getElementById('detail-location-header').innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i> ${m.loc}`;
    document.getElementById('detail-remark').innerText = m.remark;
    document.getElementById('detail-badge-type').innerText = m.type === '9man' ? '9인제' : '6인제';
    document.getElementById('detail-badge-gender').innerText = m.gender === 'male' ? '남자' : (m.gender === 'female' ? '여자' : '혼성');

    // 연락처 표시 로직
    const contactSection = document.getElementById('detail-contact-section');
    if (m.status === 'matched' && (m.teamId === myTeamId || m.guestId === myTeamId)) {
        contactSection.classList.remove('hidden');
        const contactToShow = m.teamId === myTeamId ? m.guestContact : m.hostContact;
        document.getElementById('detail-contact-id').innerText = contactToShow || "정보 없음";
    } else {
        contactSection.classList.add('hidden');
    }

    const actionsDiv = document.getElementById('detail-actions');
    actionsDiv.innerHTML = '';

    if (m.teamId === myTeamId) {
        if (m.status === 'recruiting') {
            actionsDiv.innerHTML = `<button onclick="deletePost('${m.id}')" class="w-full bg-red-100 text-red-600 font-bold py-4 rounded-2xl">공고 삭제하기</button>`;
        } else if (m.status === 'matched') {
            actionsDiv.innerHTML = `<button class="w-full bg-gray-200 text-gray-500 font-bold py-4 rounded-2xl" disabled>매칭 완료됨</button>`;
        }
    } else {
        if (m.applicants && m.applicants.includes(myTeamId)) {
            actionsDiv.innerHTML = `<button class="w-full bg-gray-200 text-gray-500 font-bold py-4 rounded-2xl" disabled>신청 완료 (대기중)</button>`;
        } else if (m.status === 'matched') {
            actionsDiv.innerHTML = `<button class="w-full bg-gray-200 text-gray-500 font-bold py-4 rounded-2xl" disabled>이미 마감된 경기</button>`;
        } else {
            actionsDiv.innerHTML = `<button onclick="applyMatch('${m.id}')" class="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg">매칭 지원하기</button>`;
        }
    }

    router('match-detail');
};

window.applyMatch = async (matchId) => {
    if (!confirm("이 경기에 매칭 신청하시겠습니까?")) return;
    toggleLoading(true);
    try {
        const matchRef = doc(db, "matches", matchId);
        const matchSnap = await getDoc(matchRef);
        const currentApplicants = matchSnap.data().applicants || [];
        
        await updateDoc(matchRef, {
            applicants: [...currentApplicants, myTeamId]
        });
        alert("신청되었습니다! 호스트가 수락하면 알림이 옵니다.");
        router('home');
    } catch (e) {
        alert("신청 실패: " + e.message);
    } finally { toggleLoading(false); }
};

window.deletePost = async (matchId) => {
    if(!confirm("정말 삭제하시겠습니까?")) return;
    await deleteDoc(doc(db, "matches", matchId));
    alert("삭제되었습니다.");
    router('home');
};

async function loadMyMatchStatus() {
    const hostQ = query(collection(db, "matches"), where("teamId", "==", myTeamId), orderBy("createdAt", "desc"));
    
    const hostSnap = await getDocs(hostQ);
    const hostListDiv = document.getElementById('my-hosting-list');
    hostListDiv.innerHTML = '';

    if (hostSnap.empty) hostListDiv.innerHTML = '<div class="text-xs text-slate-400">등록한 공고가 없습니다.</div>';

    hostSnap.forEach(doc => {
        const m = { id: doc.id, ...doc.data() };
        let actionHtml = '';
        if (m.status === 'recruiting') {
            const applicantCount = m.applicants ? m.applicants.length : 0;
            if (applicantCount > 0) {
                actionHtml = `<button onclick="showApplicants('${m.id}')" class="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold">신청자 ${applicantCount}명 확인</button>`;
            } else {
                actionHtml = `<span class="text-slate-400 text-xs">신청 대기중</span>`;
            }
        } else if (m.status === 'matched') {
            if (m.result && m.result.status === 'verified') {
                actionHtml = `<span class="text-green-500 text-xs font-bold">경기 종료 (기록완료)</span>`;
            } else if (m.result && m.result.status === 'waiting') {
                actionHtml = `<span class="text-orange-500 text-xs font-bold">상대 승인 대기중</span>`;
            } else {
                actionHtml = `<button onclick="openResultModal('${m.id}')" class="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold">결과 입력</button>`;
            }
        }
        const html = `
            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                <div onclick="openMatchDetail('${m.id}')">
                    <p class="font-bold text-sm text-slate-700">${m.time}</p>
                    <p class="text-xs text-slate-500">${m.loc}</p>
                </div>
                ${actionHtml}
            </div>`;
        hostListDiv.innerHTML += html;
    });

    const guestQ = query(collection(db, "matches"), where("guestId", "==", myTeamId));
    const guestSnap = await getDocs(guestQ);
    const guestListDiv = document.getElementById('my-confirmed-list');
    guestListDiv.innerHTML = '';

    if (guestSnap.empty) guestListDiv.innerHTML = '<div class="text-xs text-slate-400">매칭된 경기가 없습니다.</div>';

    guestSnap.forEach(doc => {
        const m = { id: doc.id, ...doc.data() };
        let statusHtml = '';
        if (m.result && m.result.status === 'waiting') {
            statusHtml = `<button onclick="approveResult('${m.id}')" class="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-bold animate-pulse">결과 승인 요청옴</button>`;
        } else if (m.result && m.result.status === 'verified') {
            statusHtml = `<span class="text-green-500 text-xs font-bold">경기 종료</span>`;
        } else {
            statusHtml = `<span class="text-indigo-500 text-xs font-bold">경기 예정</span>`;
        }
        const html = `
            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                <div onclick="openMatchDetail('${m.id}')">
                    <p class="font-bold text-sm text-slate-700">vs ${m.team}</p>
                    <p class="text-xs text-slate-500">${m.time}</p>
                </div>
                ${statusHtml}
            </div>`;
        guestListDiv.innerHTML += html;
    });
}

window.showApplicants = async (matchId) => {
    const matchSnap = await getDoc(doc(db, "matches", matchId));
    const m = matchSnap.data();
    const applicants = m.applicants || [];
    const listDiv = document.getElementById('applicant-list');
    listDiv.innerHTML = '';

    for (const teamId of applicants) {
        const teamSnap = await getDoc(doc(db, "teams", teamId));
        const team = teamSnap.data();
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-slate-50 p-3 rounded-xl";
        div.innerHTML = `
            <div>
                <p class="font-bold text-sm text-slate-700">${team.name}</p>
                <p class="text-xs text-slate-500">등급: ${team.level}</p>
            </div>
            <button onclick="acceptApplicant('${matchId}', '${teamId}')" class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold">수락</button>
        `;
        listDiv.appendChild(div);
    }
    window.openModal('modal-applicants');
};

// [중요] 매칭 수락 시 연락처 교환 로직 포함
window.acceptApplicant = async (matchId, guestTeamId) => {
    if(!confirm("이 팀과 매칭을 확정하시겠습니까?")) return;
    toggleLoading(true);
    
    try {
        // 1. 게스트(신청자)의 카톡 ID 조회 (users 컬렉션에서 팀ID로 조회)
        const guestUserQ = query(collection(db, "users"), where("teamId", "==", guestTeamId), where("role", "==", "Captain"));
        const guestUserSnap = await getDocs(guestUserQ);
        let guestContact = "연락처 미등록";
        if (!guestUserSnap.empty) {
            guestContact = guestUserSnap.docs[0].data().kakaoId;
        }

        // 2. 호스트(나)의 카톡 ID 조회
        const hostUserDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const hostContact = hostUserDoc.data().kakaoId || "연락처 미등록";
        
        // 3. 매칭 정보 업데이트 (연락처 서로 교환 저장)
        await updateDoc(doc(db, "matches", matchId), {
            status: 'matched',
            guestId: guestTeamId,
            hostContact: hostContact, 
            guestContact: guestContact 
        });
        
        alert("매칭이 확정되었습니다! 라커룸 또는 매칭 상세에서 상대방 연락처를 확인하세요.");
        window.closeModal();
        loadMyMatchStatus();
        router('home'); // 리스트에서 사라지는 것 확인을 위해 홈으로 이동
    } catch(e) { alert("수락 실패: " + e.message); }
    finally { toggleLoading(false); }
};

window.openResultModal = (matchId) => {
    currentMatchIdForModal = matchId;
    window.openModal('modal-result-input');
};

window.submitGameResult = async () => {
    const homeScore = document.getElementById('score-home').value;
    const awayScore = document.getElementById('score-away').value;
    if(!homeScore || !awayScore) return alert("점수를 입력하세요.");
    
    toggleLoading(true);
    try {
        await updateDoc(doc(db, "matches", currentMatchIdForModal), {
            result: {
                homeScore: parseInt(homeScore),
                awayScore: parseInt(awayScore),
                status: 'waiting'
            }
        });
        alert("상대 팀에게 승인 요청을 보냈습니다.");
        window.closeModal();
        loadMyMatchStatus();
    } catch(e) { alert("전송 실패: " + e.message); }
    finally { toggleLoading(false); }
};

window.approveResult = async (matchId) => {
    if(!confirm("경기 결과를 승인하시겠습니까? 승인 즉시 전적에 반영됩니다.")) return;
    toggleLoading(true);
    try {
        const matchSnap = await getDoc(doc(db, "matches", matchId));
        const m = matchSnap.data();
        const result = m.result;
        let hostWin = result.homeScore > result.awayScore;
        let draw = result.homeScore == result.awayScore;
        
        const hostTeamRef = doc(db, "teams", m.teamId);
        const hostTeamSnap = await getDoc(hostTeamRef);
        const hData = hostTeamSnap.data();
        await updateDoc(hostTeamRef, {
            wins: hData.wins + (hostWin ? 1 : 0),
            losses: hData.losses + (!hostWin && !draw ? 1 : 0)
        });

        const guestTeamRef = doc(db, "teams", myTeamId);
        const gData = (await getDoc(guestTeamRef)).data();
        await updateDoc(guestTeamRef, {
            wins: gData.wins + (!hostWin && !draw ? 1 : 0),
            losses: gData.losses + (hostWin ? 1 : 0)
        });

        await updateDoc(doc(db, "matches", matchId), {
            "result.status": 'verified',
            status: 'finished'
        });

        alert("결과가 승인되고 전적이 반영되었습니다!");
        loadMyMatchStatus();
        loadRankings();
    } catch(e) { alert("승인 실패: " + e.message); }
    finally { toggleLoading(false); }
};

window.openTeamDetail = async (teamId) => {
    const teamSnap = await getDoc(doc(db, "teams", teamId));
    const t = teamSnap.data();
    document.getElementById('modal-team-name').innerText = t.name;
    document.getElementById('modal-team-games').innerText = t.wins + t.losses;
    document.getElementById('modal-team-wins').innerText = t.wins;
    const rate = (t.wins + t.losses) === 0 ? 0 : (t.wins / (t.wins + t.losses)) * 100;
    document.getElementById('modal-team-rate').innerText = rate.toFixed(0) + '%';
    
    const rosterDiv = document.getElementById('modal-team-roster');
    rosterDiv.innerHTML = '';
    if(t.roster) {
        t.roster.forEach(p => {
            rosterDiv.innerHTML += `<div class="text-xs text-slate-600 p-2 bg-slate-50 rounded flex justify-between"><span>${p.name}</span><span class="font-bold">${p.pos}</span></div>`;
        });
    }
    window.openModal('modal-team-detail');
};

async function loadMyTeam() {
    if(!myTeamId) return;
    onSnapshot(doc(db, "teams", myTeamId), (doc) => {
        if (doc.exists()) {
            myTeamData = doc.data();
            document.getElementById('my-team-name').innerText = myTeamData.name;
            document.getElementById('my-team-stats-win').innerText = myTeamData.wins;
            document.getElementById('my-team-games').innerText = myTeamData.wins + myTeamData.losses;
            const rate = (myTeamData.wins + myTeamData.losses) === 0 ? 0 : (myTeamData.wins / (myTeamData.wins + myTeamData.losses)) * 100;
            document.getElementById('my-team-rate').innerText = rate.toFixed(0) + '%';
            roster = myTeamData.roster || [];
            renderRoster();
        }
    });
}

window.submitPost = async () => {
    const loc = document.getElementById('write-location').value;
    const timeInput = document.getElementById('write-time').value;
    const note = document.getElementById('write-note').value;
    const type = writeState.type; 
    const gender = writeState.gender;

    if(!loc || !timeInput) return alert('장소와 시간을 입력해주세요.');

    const dateObj = new Date(timeInput);
    const formattedTime = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

    toggleLoading(true);
    try {
        await addDoc(collection(db, "matches"), {
            team: myTeamData.name,
            teamId: myTeamId,
            type: type,
            gender: gender,
            time: formattedTime,
            loc: loc,
            remark: note || '특이사항 없음',
            badge: '모집중',
            badgeColor: 'bg-indigo-100 text-indigo-600',
            status: 'recruiting', 
            applicants: [],
            createdAt: new Date().toISOString()
        });
        alert('매칭 공고가 등록되었습니다!');
        router('home');
    } catch (error) { alert("등록 실패"); } 
    finally { toggleLoading(false); }
};

function loadRankings() {
    const q = query(collection(db, "teams")); 
    onSnapshot(q, (snapshot) => {
        const teams = [];
        snapshot.forEach((doc) => {
            teams.push({ id: doc.id, ...doc.data() });
        });
        
        const container = document.getElementById('ranking-list');
        container.innerHTML = '';
        const eligibleTeams = teams.filter(t => (t.wins + t.losses) >= 3);
        const rankedTeams = eligibleTeams.map(t => {
            const total = t.wins + t.losses;
            const rate = total === 0 ? 0 : (t.wins / total) * 100;
            return { ...t, winRate: rate, totalGames: total };
        });
        rankedTeams.sort((a, b) => {
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.totalGames - b.totalGames; 
        });

        rankedTeams.forEach((t, index) => {
            let rankColor = 'text-slate-400';
            let rankIcon = index + 1;
            if (index === 0) rankColor = 'text-yellow-500';
            else if (index === 1) rankColor = 'text-slate-400';
            else if (index === 2) rankColor = 'text-amber-700';

            const html = `
                <tr onclick="openTeamDetail('${t.id}')" class="hover:bg-slate-50 transition cursor-pointer">
                    <td class="p-3 font-bold ${rankColor} w-8 text-center text-lg italic">${rankIcon}</td>
                    <td class="font-bold text-slate-700 text-sm">
                        ${t.name}
                        <span class="text-[10px] font-normal text-gray-400 ml-1">(${t.wins}승 ${t.losses}패)</span>
                    </td>
                    <td class="text-right p-3 font-bold text-indigo-600 text-sm">${t.winRate.toFixed(0)}%</td>
                </tr>`;
            container.innerHTML += html;
        });
    });
}

// --- 이벤트 리스너 ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login')?.addEventListener('click', handleLogin);
    document.getElementById('btn-go-register')?.addEventListener('click', () => router('page-register-email'));
    document.getElementById('btn-back-login')?.addEventListener('click', () => router('page-login'));
    document.getElementById('btn-reg-step1')?.addEventListener('click', handleRegisterStep1);
    document.getElementById('btn-reg-step2')?.addEventListener('click', handleRegisterStep2);
    document.getElementById('btn-go-write')?.addEventListener('click', () => router('write-post'));
    document.getElementById('btn-submit-post')?.addEventListener('click', submitPost);
    document.getElementById('btn-back-home')?.addEventListener('click', () => router('home'));
    document.getElementById('btn-detail-back')?.addEventListener('click', () => router('home'));
    document.getElementById('btn-send-challenge')?.addEventListener('click', () => {
        // 이 버튼은 상세화면 진입 시 로직에 따라 동적으로 생성/변경되므로 여기서는 기본 동작만
    });

    document.getElementById('nav-home')?.addEventListener('click', () => router('home'));
    document.getElementById('nav-locker')?.addEventListener('click', () => router('locker'));
    document.getElementById('nav-logout')?.addEventListener('click', handleLogout);
    document.getElementById('header-logo')?.addEventListener('click', () => router('home'));

    document.getElementById('edit-toggle-btn')?.addEventListener('click', toggleEditMode);
    document.getElementById('btn-add-player')?.addEventListener('click', addPlayer);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => { b.classList.remove('bg-indigo-600', 'text-white'); b.classList.add('bg-white', 'text-slate-500'); });
            e.target.classList.remove('bg-white', 'text-slate-500'); e.target.classList.add('bg-indigo-600', 'text-white');
            renderMatches(e.target.dataset.filter);
        });
    });

    const setupOptionBtns = (category) => {
        const btns = document.querySelectorAll(`.write-opt-${category}`);
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btns.forEach(b => b.className = `write-opt-${category} p-4 rounded-2xl bg-white text-slate-400 border border-slate-200 font-medium transition`);
                e.target.className = `write-opt-${category} p-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 transition`;
                writeState[category] = e.target.dataset.value;
            });
        });
    };
    setupOptionBtns('type');
    setupOptionBtns('gender');
});

window.renderRoster = renderRoster;
window.addPlayer = addPlayer;
window.toggleEditMode = toggleEditMode;

function renderRoster() {
    const container = document.getElementById('roster-list');
    document.getElementById('roster-count').innerText = roster.length;
    container.innerHTML = '';
    roster.forEach(p => {
        let deleteBtn = isEditMode ? `<button onclick="event.stopPropagation(); deletePlayerFromDB(${p.id})" class="text-red-500 ml-3 text-sm w-8 h-8 flex items-center justify-center bg-red-50 rounded-full"><i class="fa-solid fa-minus"></i></button>` : '';
        const roleBadge = p.role === 'Captain' ? '<i class="fa-solid fa-crown text-yellow-500 ml-1 text-xs"></i>' : '';
        let posColorClass = p.pos === 'MB' ? 'bg-red-100 text-red-800' : (p.pos === 'S' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'); 
        container.innerHTML += `
            <div class="flex items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${posColorClass}">${p.pos}</div>
                <div class="ml-3 flex-1"><p class="text-sm font-bold text-slate-800">${p.name} ${roleBadge}</p></div>
                ${deleteBtn}
            </div>`;
    });
}
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('edit-toggle-btn');
    const indicator = btn.querySelector('div');
    const form = document.getElementById('add-player-form');
    if (isEditMode) {
        btn.classList.replace('bg-slate-200', 'bg-indigo-500');
        indicator.classList.replace('left-0', 'translate-x-4');
        form.classList.remove('hidden');
    } else {
        btn.classList.replace('bg-indigo-500', 'bg-slate-200');
        indicator.classList.remove('translate-x-4');
        indicator.classList.add('left-0');
        form.classList.add('hidden');
    }
    renderRoster();
}
function addPlayer() {
    const name = document.getElementById('new-player-name').value;
    const pos = document.getElementById('new-player-pos').value;
    if (!name) return alert('이름을 입력해주세요.');
    addPlayerToDB(name, pos);
    document.getElementById('new-player-name').value = '';
}
async function addPlayerToDB(name, pos) {
    if(!myTeamId) return;
    const newRoster = [...roster, { id: Date.now(), name: name, pos: pos, role: '' }];
    try { await updateDoc(doc(db, "teams", myTeamId), { roster: newRoster }); } catch (e) { alert("실패"); }
}
async function deletePlayerFromDB(id) {
    if(!myTeamId || !confirm('삭제?')) return;
    const newRoster = roster.filter(p => p.id !== id);
    try { await updateDoc(doc(db, "teams", myTeamId), { roster: newRoster }); } catch (e) { alert("실패"); }
}
