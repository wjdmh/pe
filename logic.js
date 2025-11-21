// 1. Firebase 라이브러리 임포트
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBk1eBJBmtP1mVRa1a7N6XeOnCOS3ENXGI",
    authDomain: "uni-league-58c00.firebaseapp.com",
    projectId: "uni-league-58c00",
    storageBucket: "uni-league-58c00.firebasestorage.app",
    messagingSenderId: "339550534504",
    appId: "1:339550534504:web:acdff633f1b2336cd1b4dd",
    measurementId: "G-PFRH7T4P5X"
};

// 3. Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -----------------------------------------------------------
// 전역 상태 관리
// -----------------------------------------------------------
let currentUser = null;
let myTeamId = null;
let matchesData = []; // 매칭 데이터 캐시
let roster = []; // 내 팀 로스터 캐시
let isEditMode = false;
let writeState = { type: '9man', gender: 'mixed' }; // 글쓰기 상태

// -----------------------------------------------------------
// UI 제어 함수
// -----------------------------------------------------------

function toggleLoading(show) {
    const el = document.getElementById('loading-overlay');
    if(show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

function router(page) {
    const pages = ['page-login', 'page-register-email', 'page-team-setup', 'home', 'locker', 'write-post', 'match-detail'];
    
    pages.forEach(p => {
        const el = document.getElementById(p.startsWith('page-') ? p : `page-${p}`);
        if(el) el.classList.add('hidden');
    });

    const targetId = page.startsWith('page-') ? page : `page-${page}`;
    document.getElementById(targetId).classList.remove('hidden');

    // 헤더 & 탭바 제어
    const headerActions = document.getElementById('header-actions');
    const tabBar = document.querySelector('nav.glass-nav'); // 탭바 선택자 수정

    if(page === 'home' || page === 'locker') {
        headerActions.classList.remove('hidden');
        tabBar.classList.remove('hidden');
    } else {
        headerActions.classList.add('hidden');
        // 로그인/가입/글쓰기 화면에선 탭바 숨김
        if(page.includes('login') || page.includes('register') || page.includes('write') || page.includes('detail') || page.includes('setup')) {
            tabBar.classList.add('hidden');
        } else {
            tabBar.classList.remove('hidden');
        }
    }

    // 탭 활성화 UI
    const updateTab = (id, active) => {
        const el = document.getElementById(id);
        if(!el) return;
        if(active) el.className = 'flex flex-col items-center text-indigo-600 transition transform active:scale-90';
        else el.className = 'flex flex-col items-center text-gray-400 hover:text-indigo-600 transition transform active:scale-90';
    };
    updateTab('nav-home', page === 'home');
    updateTab('nav-locker', page === 'locker');
    
    window.scrollTo(0,0);
}

// -----------------------------------------------------------
// 인증 (Auth) 로직
// -----------------------------------------------------------

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("로그인 됨:", user.email);
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                myTeamId = userData.teamId;
                
                router('home');
                loadMatches(); 
                loadMyTeam();  
            } else {
                router('page-team-setup');
            }
        } catch (e) {
            console.error("유저 정보 로드 실패", e);
        }
    } else {
        console.log("로그아웃 됨");
        currentUser = null;
        myTeamId = null;
        router('page-login'); 
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
        await signOut(auth);
        router('page-login');
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

async function handleRegisterStep2() {
    const teamName = document.getElementById('team-name').value;
    const nickname = document.getElementById('team-nickname').value;
    const level = document.getElementById('team-level').value;
    const user = auth.currentUser;

    if(!teamName || !nickname) return alert("모든 정보를 입력해주세요.");

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
            role: 'Captain'
        });

        toggleLoading(false);
        alert("팀 등록이 완료되었습니다!");
        myTeamId = newTeamRef.id;
        router('home');
        loadMyTeam();
        loadMatches();
    } catch (error) {
        toggleLoading(false);
        alert("팀 등록 오류: " + error.message);
    }
}

// -----------------------------------------------------------
// 데이터 (Data) 로직
// -----------------------------------------------------------

// 매칭 로드 및 렌더링
function loadMatches() {
    const q = query(collection(db, "matches"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        matchesData = [];
        snapshot.forEach((doc) => {
            matchesData.push({ id: doc.id, ...doc.data() });
        });
        renderMatches('all'); 
    });
}

function renderMatches(filterType = 'all') {
    const container = document.getElementById('match-list-container');
    container.innerHTML = ''; 

    const filtered = matchesData.filter(m => {
        if (filterType === 'all') return true;
        if (filterType === 'male') return m.gender === 'male';
        if (filterType === 'female') return m.gender === 'female';
        if (filterType === 'mixed') return m.gender === 'mixed';
        return m.type === filterType;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm">조건에 맞는 매칭이 없습니다.</div>`;
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

function openMatchDetail(id) {
    const m = matchesData.find(item => item.id === id);
    if(!m) return;

    document.getElementById('detail-title').innerText = m.team;
    document.getElementById('detail-time').innerText = m.time;
    document.getElementById('detail-location-header').innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i> ${m.loc}`;
    document.getElementById('detail-remark').innerText = m.remark;
    document.getElementById('detail-badge-type').innerText = m.type === '9man' ? '9인제' : '6인제';
    document.getElementById('detail-badge-gender').innerText = m.gender === 'male' ? '남자' : (m.gender === 'female' ? '여자' : '혼성');

    router('match-detail');
}

// 매칭 공고 등록
async function submitPost() {
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
        const teamDoc = await getDoc(doc(db, "teams", myTeamId));
        const teamName = teamDoc.data().name;

        await addDoc(collection(db, "matches"), {
            team: teamName,
            teamId: myTeamId,
            type: type,
            gender: gender,
            time: formattedTime,
            loc: loc,
            remark: note || '특이사항 없음',
            badge: '모집중',
            badgeColor: 'bg-indigo-100 text-indigo-600',
            createdAt: new Date().toISOString()
        });

        toggleLoading(false);
        alert('매칭 공고가 등록되었습니다!');
        
        document.getElementById('write-location').value = '';
        document.getElementById('write-time').value = '';
        document.getElementById('write-note').value = '';
        router('home');

    } catch (error) {
        toggleLoading(false);
        alert("공고 등록 실패: " + error.message);
    }
}

// 팀 정보 로드 및 렌더링
async function loadMyTeam() {
    if(!myTeamId) return;
    
    onSnapshot(doc(db, "teams", myTeamId), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            document.getElementById('my-team-name').innerText = data.name;
            document.getElementById('my-team-stats-win').innerText = data.wins;
            roster = data.roster || [];
            renderRoster();
        }
    });
}

function renderRoster() {
    const container = document.getElementById('roster-list');
    document.getElementById('roster-count').innerText = roster.length;
    container.innerHTML = '';

    roster.forEach(p => {
        const roleBadge = p.role === 'Captain' ? '<i class="fa-solid fa-crown text-yellow-500 ml-1 text-xs"></i>' : '';
        
        let posColorClass = '';
        switch(p.pos) {
            case 'MB': posColorClass = 'bg-red-100 text-red-800'; break;
            case 'S': posColorClass = 'bg-yellow-100 text-yellow-800'; break;
            case 'OH': posColorClass = 'bg-blue-100 text-blue-800'; break;
            case 'L': posColorClass = 'bg-green-100 text-green-800'; break;
            case 'OP': posColorClass = 'bg-purple-100 text-purple-800'; break;
            default: posColorClass = 'bg-gray-100 text-gray-800';
        }

        const div = document.createElement('div');
        div.className = "flex items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm";
        
        let deleteBtnHtml = '';
        if (isEditMode) {
            deleteBtnHtml = `<button class="btn-delete-player text-red-500 ml-3 text-sm w-8 h-8 flex items-center justify-center bg-red-50 rounded-full"><i class="fa-solid fa-minus"></i></button>`;
        }

        div.innerHTML = `
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${posColorClass}">${p.pos}</div>
            <div class="ml-3 flex-1">
                <p class="text-sm font-bold text-slate-800">${p.name} ${roleBadge}</p>
            </div>
            ${deleteBtnHtml}
        `;

        // 동적으로 생성된 버튼에 이벤트 리스너 추가 (버그 방지)
        if (isEditMode) {
            const delBtn = div.querySelector('.btn-delete-player');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePlayerFromDB(p.id);
            });
        }

        container.appendChild(div);
    });
}

async function addPlayerToDB(name, pos) {
    if(!myTeamId) return;
    const newPlayer = { id: Date.now(), name: name, pos: pos, role: '' };
    const newRoster = [...roster, newPlayer];

    try {
        await updateDoc(doc(db, "teams", myTeamId), { roster: newRoster });
    } catch (e) {
        alert("선수 추가 실패: " + e.message);
    }
}

async function deletePlayerFromDB(id) {
    if(!myTeamId) return;
    if(!confirm('정말 삭제하시겠습니까?')) return;

    const newRoster = roster.filter(p => p.id !== id);
    try {
        await updateDoc(doc(db, "teams", myTeamId), { roster: newRoster });
    } catch (e) {
        alert("선수 삭제 실패: " + e.message);
    }
}

// -----------------------------------------------------------
// 이벤트 리스너 연결 (DOM이 로드된 후 실행)
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    
    // 버튼 이벤트 연결
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
        if(confirm('상대 팀 주장에게 교류전 제안을 보내시겠습니까?')) {
            alert('🚀 매칭 지원이 완료되었습니다!');
            router('home');
        }
    });

    // 탭바
    document.getElementById('nav-home')?.addEventListener('click', () => router('home'));
    document.getElementById('nav-locker')?.addEventListener('click', () => router('locker'));
    document.getElementById('nav-logout')?.addEventListener('click', handleLogout);
    document.getElementById('header-logo')?.addEventListener('click', () => router('home'));

    // 팀 관리
    document.getElementById('edit-toggle-btn')?.addEventListener('click', () => {
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
    });

    document.getElementById('btn-add-player')?.addEventListener('click', () => {
        const name = document.getElementById('new-player-name').value;
        const pos = document.getElementById('new-player-pos').value;
        if (!name) return alert('이름을 입력해주세요.');
        addPlayerToDB(name, pos);
        document.getElementById('new-player-name').value = '';
    });

    // 필터 버튼
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('bg-indigo-600', 'text-white');
                b.classList.add('bg-white', 'text-slate-500');
            });
            e.target.classList.remove('bg-white', 'text-slate-500');
            e.target.classList.add('bg-indigo-600', 'text-white');
            renderMatches(e.target.dataset.filter);
        });
    });

    // 글쓰기 옵션 버튼
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
