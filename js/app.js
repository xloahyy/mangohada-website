/* =========================================
   MANGOHADA APP — app.js
   =========================================

   [Supabase 설정 필요 사항]
   Supabase 대시보드에서 아래 SQL을 실행해주세요:

   -- 1. profiles 테이블
   create table if not exists profiles (
     id uuid references auth.users(id) primary key,
     name text not null,
     created_at timestamptz default now()
   );
   alter table profiles enable row level security;
   create policy "본인 프로필만 접근" on profiles for all using (auth.uid() = id);

   -- 2. wills 테이블
   create table if not exists wills (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users(id) on delete cascade not null,
     title text not null,
     content text,
     type text not null check (type in ('text', 'image', 'video')),
     recipient text,
     file_url text,
     created_at timestamptz default now()
   );
   alter table wills enable row level security;
   create policy "본인 유언만 접근" on wills for all using (auth.uid() = user_id);

   -- 3. Storage: 'wills' 버킷 (public) 생성 (사진/영상 업로드용)
*/

/* ========================
   SUPABASE 초기화
======================== */
const SUPABASE_URL = 'https://kwifydqdmyorsuqnvygh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aWZ5ZHFkbXlvcnN1cW52eWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk1OTIsImV4cCI6MjA5NzI5NTU5Mn0.8lBEN0YSWZ5IeDY9Jf8nOJLaW4EBdeS2ZG2G6sEYOmw';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ========================
   앱 상태
======================== */
let currentUser = null;
let allWills = [];
let allArticles = [];
let currentWillFilter = 'all';
let currentWillId = null;
let currentWillType = 'text';
let currentArticleTag = '';
let freeConsultUsed = false;

/* ========================
   정적 데이터
======================== */
const EXPERTS = [
  {
    title: '변호사',
    desc: '공증 및 집행대리, 법률자문',
    icon: 'solar:diploma-linear',
    bg: 'bg-blue-50',
    color: 'text-blue-400',
    emoji: '⚖️',
  },
  {
    title: '장례준비',
    desc: '장례준비, 장례진행관리',
    icon: 'solar:flower-linear',
    bg: 'bg-purple-50',
    color: 'text-purple-400',
    emoji: '🕯️',
  },
  {
    title: '재무설계',
    desc: '유산정리, 재산분할',
    icon: 'solar:chart-2-linear',
    bg: 'bg-green-50',
    color: 'text-green-500',
    emoji: '💰',
  },
  {
    title: '보험',
    desc: '보험 관리',
    icon: 'solar:shield-bold-duotone',
    bg: 'bg-orange-50',
    color: 'text-orange-400',
    emoji: '📋',
  },
  {
    title: '타로/사주 전문가',
    desc: '타로/사주 전문가',
    icon: 'solar:star-shine-linear',
    bg: 'bg-yellow-50',
    color: 'text-yellow-500',
    emoji: '🔮',
  },
  {
    title: '심리상담',
    desc: '마음을 위로해 줄 수 있는 상담사를 연결해 드려요',
    icon: 'solar:heart-shine-linear',
    bg: 'bg-pink-50',
    color: 'text-pink-400',
    emoji: '❤️',
  },
];

const CATEGORY_STYLE = {
  '유언장 작성': { bg: 'bg-blue-50',   emoji: '⚖️' },
  '장례 절차':   { bg: 'bg-green-50',  emoji: '🌸' },
  '상속 문제':   { bg: 'bg-red-50',    emoji: '🏠' },
  '웰다잉':      { bg: 'bg-yellow-50', emoji: '🌅' },
  '재무계획':    { bg: 'bg-purple-50', emoji: '💰' },
  '심리치유':    { bg: 'bg-pink-50',   emoji: '🧠' },
};

/* ========================
   인증 초기화
======================== */
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await enterApp(session.user);
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await enterApp(session.user);
    } else if (event === 'SIGNED_OUT') {
      exitApp();
    }
  });
}

async function enterApp(user) {
  currentUser = user;

  // 프로필 이름 가져오기
  const { data: profile } = await sb
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  const name = profile?.name
    || user.user_metadata?.name
    || user.email.split('@')[0];

  document.getElementById('welcomeName').textContent = name;
  document.getElementById('sidebarUserName').textContent = name;

  // 화면 전환
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  // 데이터 로드 및 렌더
  await Promise.all([loadWills(), loadHappiness(), loadArticles(), checkFreeConsult()]);
  renderExperts();
  switchTab('home');
}

function exitApp() {
  currentUser = null;
  allWills = [];
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}

/* ========================
   인증 탭 전환
======================== */
function switchAuthTab(tab) {
  const isLogin = tab === 'login';

  document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
  document.getElementById('signupForm').classList.toggle('hidden', isLogin);

  const activeClass = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all bg-white text-[#1A1A1A] shadow-sm';
  const inactiveClass = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all text-gray-400';

  document.getElementById('loginTabBtn').className = isLogin ? activeClass : inactiveClass;
  document.getElementById('signupTabBtn').className = isLogin ? inactiveClass : activeClass;
}

/* ========================
   로그인
======================== */
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');

  if (!email || !password) {
    showMsg(errEl, '이메일과 비밀번호를 입력해주세요');
    return;
  }

  const btn = document.querySelector('#loginForm button[onclick="handleLogin()"]');
  setLoading(btn, true, '로그인 중...');

  const { error } = await sb.auth.signInWithPassword({ email, password });

  setLoading(btn, false, '로그인');

  if (error) {
    showMsg(errEl, '이메일 또는 비밀번호가 올바르지 않습니다');
  }
}

/* ========================
   회원가입
======================== */
async function handleSignup() {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errEl = document.getElementById('signupError');

  if (!name || !email || !password) {
    showMsg(errEl, '모든 항목을 입력해주세요');
    return;
  }
  if (password.length < 8) {
    showMsg(errEl, '비밀번호는 8자 이상이어야 합니다');
    return;
  }

  const btn = document.querySelector('#signupForm button[onclick="handleSignup()"]');
  setLoading(btn, true, '가입 중...');

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  setLoading(btn, false, '가입하기');

  if (error) {
    showMsg(errEl, error.message);
    return;
  }

  // 프로필 저장
  if (data.user) {
    await sb.from('profiles').upsert({ id: data.user.id, name });
  }

  showMsg(errEl, '✅ 가입 완료! 이메일 확인 후 로그인하세요', true);
  setTimeout(() => switchAuthTab('login'), 2500);
}

/* ========================
   로그아웃
======================== */
async function handleLogout() {
  await sb.auth.signOut();
}

/* ========================
   탭 전환
======================== */
const TAB_ICONS = {
  home:    { active: 'solar:home-2-bold',                  inactive: 'solar:home-2-linear' },
  will:    { active: 'solar:document-text-bold',           inactive: 'solar:document-text-linear' },
  expert:  { active: 'solar:users-group-rounded-bold',     inactive: 'solar:users-group-rounded-linear' },
  article: { active: 'solar:book-2-bold',                  inactive: 'solar:book-2-linear' },
};

function switchTab(tab) {
  const allTabs = ['home', 'will', 'expert', 'article', 'happiness'];
  allTabs.forEach(t => {
    const content = document.getElementById(`tab${capitalize(t)}`);
    if (content) content.classList.toggle('hidden', t !== tab);
  });

  ['home', 'will', 'expert', 'article'].forEach(t => {
    const nav = document.getElementById(`nav${capitalize(t)}`);
    if (!nav) return;
    const icon = nav.querySelector('iconify-icon');
    const isActive = t === tab;
    nav.classList.toggle('active', isActive);
    if (icon && TAB_ICONS[t]) icon.setAttribute('icon', isActive ? TAB_ICONS[t].active : TAB_ICONS[t].inactive);
  });
}

function openHappiness() {
  switchTab('happiness');
}

/* ========================
   행복저금
======================== */
let allHappiness = [];

async function loadHappiness() {
  if (!currentUser) return;
  const { data } = await sb
    .from('happiness')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  allHappiness = data || [];
  document.getElementById('happinessCount').textContent = allHappiness.length;
  renderHappiness();
}

function renderHappiness() {
  const listEl = document.getElementById('happinessList');
  const emptyEl = document.getElementById('happinessEmpty');
  document.getElementById('happinessTotal').textContent = allHappiness.length;

  if (allHappiness.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = allHappiness.map(h => `
    <div class="card flex items-start gap-4 group">
      <div class="w-10 h-10 bg-[#FFF8EC] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        <iconify-icon icon="solar:heart-shine-bold" width="18" class="text-[#F5A623]"></iconify-icon>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-[#1A1A1A] font-medium leading-relaxed">${escapeHtml(h.content)}</p>
        <p class="text-xs text-gray-300 mt-2">${formatDate(h.created_at)}</p>
      </div>
      <button onclick="deleteHappiness('${h.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <iconify-icon icon="solar:trash-bin-trash-linear" width="14" class="text-red-400"></iconify-icon>
      </button>
    </div>
  `).join('');
}

function openHappinessModal() {
  document.getElementById('happinessContent').value = '';
  document.getElementById('happinessCharCount').textContent = '0';
  document.getElementById('happinessError').classList.add('hidden');
  document.getElementById('happinessModal').classList.remove('hidden');
}

function closeHappinessModal() {
  document.getElementById('happinessModal').classList.add('hidden');
}

function updateHappinessCount() {
  const len = document.getElementById('happinessContent').value.length;
  document.getElementById('happinessCharCount').textContent = len;
}

async function saveHappiness() {
  const content = document.getElementById('happinessContent').value.trim();
  const errEl = document.getElementById('happinessError');
  if (!content) {
    errEl.textContent = '내용을 입력해주세요';
    errEl.classList.remove('hidden');
    return;
  }
  const btn = document.getElementById('saveHappinessBtn');
  setLoading(btn, true, '저금 중...');
  const { error } = await sb.from('happiness').insert([{ user_id: currentUser.id, content }]);
  setLoading(btn, false, '저금하기');
  if (error) {
    errEl.textContent = '저장에 실패했습니다';
    errEl.classList.remove('hidden');
    return;
  }
  closeHappinessModal();
  await loadHappiness();
}

async function deleteHappiness(id) {
  if (!confirm('삭제하시겠어요?')) return;
  await sb.from('happiness').delete().eq('id', id).eq('user_id', currentUser.id);
  await loadHappiness();
}

/* ========================
   상담 신청
======================== */
let currentExpertType = '';

async function checkFreeConsult() {
  if (!currentUser) return;
  const { count } = await sb
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id);
  freeConsultUsed = (count || 0) > 0;
}

function openConsultModal(expertTitle) {
  currentExpertType = expertTitle;
  document.getElementById('consultExpertTitle').textContent = expertTitle;
  document.getElementById('consultContent').value = '';
  document.getElementById('consultCharCount').textContent = '0';
  document.getElementById('consultError').classList.add('hidden');
  document.getElementById('consultSuccess').classList.add('hidden');

  const isFree = !freeConsultUsed;
  document.getElementById('consultFreeNotice').classList.toggle('hidden', !isFree);
  document.getElementById('consultPaidNotice').classList.toggle('hidden', isFree);
  document.getElementById('submitConsultBtn').textContent = isFree ? '1회 무료 상담 신청하기' : '신청하기';

  document.getElementById('consultModal').classList.remove('hidden');
}

function closeConsultModal() {
  document.getElementById('consultModal').classList.add('hidden');
}

function updateConsultCount() {
  document.getElementById('consultCharCount').textContent =
    document.getElementById('consultContent').value.length;
}

async function submitConsult() {
  const content = document.getElementById('consultContent').value.trim();
  const errEl = document.getElementById('consultError');
  const successEl = document.getElementById('consultSuccess');

  if (!content) {
    errEl.textContent = '상담 내용을 입력해주세요';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('submitConsultBtn');
  setLoading(btn, true, '신청 중...');

  const { data: profile } = await sb.from('profiles').select('name').eq('id', currentUser.id).single();
  const userName = profile?.name || currentUser.email.split('@')[0];

  const { error } = await sb.from('consultations').insert([{
    user_id: currentUser.id,
    user_name: userName,
    expert_type: currentExpertType,
    content,
  }]);

  setLoading(btn, false, '1회 무료 상담 신청하기');

  if (error) {
    errEl.textContent = '신청 중 오류가 발생했습니다';
    errEl.classList.remove('hidden');
    return;
  }

  freeConsultUsed = true;
  errEl.classList.add('hidden');
  successEl.classList.remove('hidden');
  setTimeout(() => closeConsultModal(), 2000);
}

async function openMyConsultations() {
  document.getElementById('myConsultModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const listEl = document.getElementById('myConsultList');
  listEl.innerHTML = '<p class="text-sm text-gray-300 text-center py-6">불러오는 중...</p>';

  const { data } = await sb
    .from('consultations')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (!data || !data.length) {
    listEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">신청 내역이 없습니다</p>';
    return;
  }

  const statusLabel = { pending: '대기', confirmed: '확인', done: '완료' };
  const statusClass = { pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-green-100 text-green-700', done: 'bg-blue-100 text-blue-700' };

  listEl.innerHTML = data.map(c => `
    <div class="bg-gray-50 rounded-2xl p-4 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold text-[#1A1A1A]">${esc(c.expert_type)}</span>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${statusClass[c.status] || statusClass.pending}">
            ${statusLabel[c.status] || '대기'}
          </span>
          ${c.status === 'pending' ? `
          <button onclick="deleteMyConsult('${c.id}')"
            class="w-6 h-6 bg-red-50 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors">
            <iconify-icon icon="solar:trash-bin-trash-linear" width="12" class="text-red-400"></iconify-icon>
          </button>` : ''}
        </div>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">${esc(c.content)}</p>
      <p class="text-xs text-gray-300">${formatDate(c.created_at)}</p>
    </div>
  `).join('');
}

function closeMyConsultations() {
  document.getElementById('myConsultModal').classList.add('hidden');
  document.body.style.overflow = '';
}

async function deleteMyConsult(id) {
  if (!confirm('상담 신청을 취소하시겠습니까?')) return;
  const { error } = await sb
    .from('consultations')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id)
    .eq('status', 'pending');
  if (error) { alert('삭제에 실패했습니다: ' + error.message); return; }
  await checkFreeConsult();
  await openMyConsultations();
}

function openRandomModal() {
  document.getElementById('randomResult').innerHTML = '<p class="text-gray-300 text-sm">버튼을 눌러 다른 유저의 행복을 확인해보세요</p>';
  document.getElementById('randomModal').classList.remove('hidden');
}

function closeRandomModal() {
  document.getElementById('randomModal').classList.add('hidden');
}

async function drawRandom() {
  const btn = document.getElementById('drawBtn');
  setLoading(btn, true, '뽑는 중...');

  const { data } = await sb
    .from('happiness')
    .select('content, created_at')
    .neq('user_id', currentUser.id)
    .limit(100);

  setLoading(btn, false, '랜덤 뽑기');

  if (!data || data.length === 0) {
    document.getElementById('randomResult').innerHTML = '<p class="text-gray-400 text-sm">아직 다른 유저의 행복저금이 없어요 🌱</p>';
    return;
  }

  const item = data[Math.floor(Math.random() * data.length)];
  document.getElementById('randomResult').innerHTML = `
    <div class="bg-[#FFF8EC] rounded-2xl p-6 text-left w-full">
      <iconify-icon icon="solar:heart-shine-bold" width="24" class="text-[#F5A623] mb-3 block"></iconify-icon>
      <p class="text-base text-[#1A1A1A] font-medium leading-relaxed">${escapeHtml(item.content)}</p>
      <p class="text-xs text-gray-300 mt-3">${formatDate(item.created_at)}</p>
    </div>
  `;
}

/* ========================
   유언 로드
======================== */
async function loadWills() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from('wills')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('유언 로드 실패:', error);
    return;
  }

  allWills = data || [];
  renderWills();
}

/* ========================
   유언 렌더링
======================== */
const TYPE_CONFIG = {
  text:  { icon: 'solar:document-text-bold',             bg: 'bg-blue-50',   color: 'text-blue-400',   label: '글' },
  image: { icon: 'solar:gallery-bold',                   bg: 'bg-pink-50',   color: 'text-pink-400',   label: '사진' },
  video: { icon: 'solar:video-frame-play-vertical-bold', bg: 'bg-purple-50', color: 'text-purple-400', label: '영상' },
};

function renderWills() {
  const sort = document.getElementById('willSortSelect').value;
  let list = currentWillFilter === 'all'
    ? [...allWills]
    : allWills.filter(w => w.type === currentWillFilter);

  list.sort((a, b) => {
    const da = new Date(a.created_at), db = new Date(b.created_at);
    return sort === 'oldest' ? da - db : db - da;
  });

  document.getElementById('willCountLabel').textContent = `총 ${list.length}개`;

  const gridEl  = document.getElementById('willGrid');
  const emptyEl = document.getElementById('willEmpty');

  if (list.length === 0) {
    gridEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  // 연도별 그룹핑
  const grouped = {};
  list.forEach(w => {
    const yr = new Date(w.created_at).getFullYear();
    (grouped[yr] = grouped[yr] || []).push(w);
  });

  let html = '';
  Object.keys(grouped)
    .sort((a, b) => b - a)
    .forEach(year => {
      html += `<div class="will-year-label">${year}</div>`;
      grouped[year].forEach(w => {
        const d = new Date(w.created_at);
        const dateStr = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
        const tc = TYPE_CONFIG[w.type] || TYPE_CONFIG.text;
        html += `
          <div onclick="openWillDetail('${w.id}')" class="will-card">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 ${tc.bg} rounded-xl flex items-center justify-center flex-shrink-0">
                  <iconify-icon icon="${tc.icon}" width="18" class="${tc.color}"></iconify-icon>
                </div>
                <span class="text-xs font-bold text-gray-400">${tc.label}</span>
              </div>
              <span class="text-xs text-gray-300 font-medium">${dateStr}</span>
            </div>
            <div>
              <p class="text-base font-bold text-[#1A1A1A] leading-snug mb-1">${esc(w.title)}</p>
              ${w.recipient ? `<p class="text-xs text-gray-400">→ ${esc(w.recipient)}</p>` : ''}
            </div>
            ${w.type === 'text' && w.content
              ? `<p class="text-sm text-gray-400 line-clamp-2 leading-relaxed">${esc(w.content)}</p>`
              : ''}
          </div>`;
      });
    });

  gridEl.innerHTML = html;
}

/* ========================
   유언 필터
======================== */
function filterWills(type) {
  currentWillFilter = type;

  document.querySelectorAll('.will-filter').forEach(btn => {
    const btnType = btn.id.replace('filter', '').toLowerCase();
    const isActive = btnType === type || (type === 'all' && btnType === 'all');
    btn.classList.toggle('active', isActive);
  });

  renderWills();
}

/* ========================
   유언 상세
======================== */
function openWillDetail(id) {
  const will = allWills.find(w => w.id === id);
  if (!will) return;

  currentWillId = id;
  const typeLabel = { text: '글 유언', image: '사진 유언', video: '영상 유언' };

  document.getElementById('detailType').textContent = typeLabel[will.type] || '유언';
  document.getElementById('detailTitle').textContent = will.title;
  document.getElementById('detailRecipient').textContent = will.recipient ? `→ ${will.recipient}` : '';

  const d = new Date(will.created_at);
  document.getElementById('detailDate').textContent =
    `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 작성`;

  let body = '';
  if (will.type === 'text') {
    body = `<p class="whitespace-pre-wrap">${esc(will.content || '')}</p>`;
  } else if (will.type === 'image' && will.file_url) {
    let urls = [];
    try { urls = JSON.parse(will.file_url); } catch { urls = [will.file_url]; }
    body = urls.map(url => `<img src="${url}" class="w-full rounded-2xl mb-3 object-cover">`).join('');
    if (will.content) body += `<p class="whitespace-pre-wrap mt-2">${esc(will.content)}</p>`;
  } else if (will.type === 'video' && will.file_url) {
    body = `<video controls class="w-full rounded-2xl mb-3"><source src="${will.file_url}"></video>`;
    if (will.content) body += `<p class="whitespace-pre-wrap">${esc(will.content)}</p>`;
  } else {
    body = `<p class="text-gray-400 text-sm">첨부 파일이 없습니다.</p>`;
  }

  document.getElementById('detailContent').innerHTML = body;
  document.getElementById('willDetailModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeWillDetail() {
  document.getElementById('willDetailModal').classList.add('hidden');
  document.body.style.overflow = '';
  currentWillId = null;
}

async function deleteWillConfirm() {
  if (!currentWillId || !confirm('이 유언을 영구 삭제하시겠습니까?')) return;

  const { error } = await sb.from('wills').delete().eq('id', currentWillId);
  if (!error) {
    allWills = allWills.filter(w => w.id !== currentWillId);
    renderWills();
    closeWillDetail();
  }
}

/* ========================
   유언 작성 모달
======================== */
let willImageFiles = [];

function openWillModal() {
  setWillType('text');
  ['willTitle', 'willRecipient', 'willContent', 'willImageText', 'willVideoText'].forEach(id => {
    document.getElementById(id).value = '';
  });
  ['imageTextCount', 'videoTextCount'].forEach(id => {
    document.getElementById(id).textContent = '0';
  });
  willImageFiles = [];
  renderImagePreviewGrid();
  resetUploadZone('videoPreview', 'solar:video-frame-play-vertical-linear', '영상을 클릭하여 첨부하세요', 'MP4, MOV · 1분 이내');
  document.getElementById('willVideoInput').value = '';
  document.getElementById('willError').classList.add('hidden');

  document.getElementById('willModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeWillModal() {
  document.getElementById('willModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function setWillType(type) {
  currentWillType = type;

  ['text', 'image', 'video'].forEach(t => {
    const btn = document.getElementById(`willType${capitalize(t)}`);
    btn.classList.toggle('active', t === type);
  });

  document.getElementById('willTextArea').classList.toggle('hidden', type !== 'text');
  document.getElementById('willImageArea').classList.toggle('hidden', type !== 'image');
  document.getElementById('willVideoArea').classList.toggle('hidden', type !== 'video');
}

function addImageFiles(e) {
  const newFiles = Array.from(e.target.files);
  const remaining = 5 - willImageFiles.length;
  willImageFiles.push(...newFiles.slice(0, remaining));
  e.target.value = '';
  renderImagePreviewGrid();
}

function removeImageFile(index) {
  willImageFiles.splice(index, 1);
  renderImagePreviewGrid();
}

function renderImagePreviewGrid() {
  const grid = document.getElementById('imagePreviewGrid');
  document.getElementById('imageCount').textContent = willImageFiles.length;
  let html = willImageFiles.map((file, i) => {
    const url = URL.createObjectURL(file);
    return `
      <div class="relative" style="aspect-ratio:1">
        <img src="${url}" class="w-full h-full object-cover rounded-xl">
        <button type="button" onclick="removeImageFile(${i})"
          class="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center shadow">
          ×
        </button>
      </div>`;
  }).join('');
  if (willImageFiles.length < 5) {
    html += `
      <label class="flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-all" style="aspect-ratio:1">
        <iconify-icon icon="solar:gallery-add-linear" width="24" class="text-gray-300 mb-1"></iconify-icon>
        <span class="text-xs text-gray-400">추가</span>
        <input type="file" accept="image/*" multiple class="hidden" onchange="addImageFiles(event)">
      </label>`;
  }
  grid.innerHTML = html;
}

function updateImageTextCount() {
  document.getElementById('imageTextCount').textContent = document.getElementById('willImageText').value.length;
}

function updateVideoTextCount() {
  document.getElementById('videoTextCount').textContent = document.getElementById('willVideoText').value.length;
}

function previewVideo(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    alert('영상 파일은 100MB 이하만 업로드 가능합니다.');
    e.target.value = '';
    return;
  }
  const vid = document.createElement('video');
  vid.preload = 'metadata';
  vid.onloadedmetadata = () => {
    URL.revokeObjectURL(vid.src);
    if (vid.duration > 60) {
      alert('영상은 1분(60초) 이내만 업로드 가능합니다.');
      e.target.value = '';
      resetUploadZone('videoPreview', 'solar:video-frame-play-vertical-linear', '영상을 클릭하여 첨부하세요', 'MP4, MOV · 1분 이내');
      return;
    }
    document.getElementById('videoPreview').innerHTML = `
      <iconify-icon icon="solar:video-frame-play-vertical-bold" width="36" class="text-[#F5A623] mb-2"></iconify-icon>
      <p class="text-sm font-bold text-[#1A1A1A] px-4 text-center truncate">${esc(file.name)}</p>
      <p class="text-xs text-gray-400 mt-1">${(file.size / 1024 / 1024).toFixed(1)}MB · ${Math.round(vid.duration)}초</p>
    `;
  };
  vid.src = URL.createObjectURL(file);
}

async function saveWill() {
  const title     = document.getElementById('willTitle').value.trim();
  const recipient = document.getElementById('willRecipient').value.trim();
  const errEl     = document.getElementById('willError');
  const btn       = document.getElementById('saveWillBtn');

  if (!title) { showMsg(errEl, '제목을 입력해주세요'); return; }

  const textContent  = document.getElementById('willContent').value.trim();
  const imageText    = document.getElementById('willImageText').value.trim();
  const videoText    = document.getElementById('willVideoText').value.trim();
  const vidFile      = document.getElementById('willVideoInput').files[0];

  if (currentWillType === 'text'  && !textContent)          { showMsg(errEl, '내용을 입력해주세요'); return; }
  if (currentWillType === 'image' && !willImageFiles.length) { showMsg(errEl, '사진을 최소 1장 첨부해주세요'); return; }
  if (currentWillType === 'video' && !vidFile)               { showMsg(errEl, '영상을 첨부해주세요'); return; }

  setLoading(btn, true, '저장 중...');
  errEl.classList.add('hidden');

  try {
    let fileUrl = null;
    let content = null;

    if (currentWillType === 'text') {
      content = textContent;

    } else if (currentWillType === 'image') {
      const urls = [];
      for (let i = 0; i < willImageFiles.length; i++) {
        const file = willImageFiles[i];
        const ext  = file.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/${Date.now()}_${i}.${ext}`;
        const { error: upErr } = await sb.storage.from('wills').upload(path, file, { upsert: true });
        if (upErr) throw new Error(`사진 업로드에 실패했습니다: ${upErr.message}`);
        const { data: { publicUrl } } = sb.storage.from('wills').getPublicUrl(path);
        urls.push(publicUrl);
      }
      fileUrl  = JSON.stringify(urls);
      content  = imageText || null;

    } else if (currentWillType === 'video') {
      const ext  = vidFile.name.split('.').pop().toLowerCase();
      const path = `${currentUser.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('wills').upload(path, vidFile, { upsert: true });
      if (upErr) throw new Error(`영상 업로드에 실패했습니다: ${upErr.message}`);
      const { data: { publicUrl } } = sb.storage.from('wills').getPublicUrl(path);
      fileUrl = publicUrl;
      content = videoText || null;
    }

    const { data: inserted, error: dbErr } = await sb
      .from('wills')
      .insert([{ user_id: currentUser.id, title, content, type: currentWillType, recipient: recipient || null, file_url: fileUrl }])
      .select()
      .single();

    if (dbErr) throw new Error(dbErr.message);

    allWills.unshift(inserted);
    renderWills();
    closeWillModal();
    switchTab('will');

  } catch (err) {
    console.error(err);
    showMsg(errEl, err.message || '저장 중 오류가 발생했습니다.');
  } finally {
    setLoading(btn, false, '저장하기');
  }
}

/* ========================
   전문가 렌더링
======================== */
function renderExperts() {
  document.getElementById('expertGrid').innerHTML = EXPERTS.map(e => `
    <button onclick="openConsultModal('${e.title}')"
      class="text-left bg-white rounded-2xl p-6 hover:shadow-lg hover:border-[#F5A623]/40 transition-all active:scale-[0.98]"
      style="border: 1.5px solid #F3F4F6;">
      <h4 class="text-base font-black text-[#1A1A1A] mb-1">${e.title}</h4>
      <p class="text-sm text-gray-400 leading-relaxed mb-5">${e.desc}</p>
      <div class="flex items-end justify-between">
        <div class="flex items-center gap-1.5 text-[#F5A623]">
          <span class="text-xs font-bold">상담 신청</span>
          <iconify-icon icon="solar:arrow-right-linear" width="12"></iconify-icon>
        </div>
        <span class="text-4xl">${e.emoji}</span>
      </div>
    </button>
  `).join('');
}

/* ========================
   아티클 로드 및 렌더링
======================== */
async function loadArticles() {
  const { data } = await sb
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });
  allArticles = data || [];
  renderArticles();
  renderHomeArticles();
}

function renderHomeArticles() {
  const list = allArticles.slice(0, 2);
  const el = document.getElementById('homeArticles');
  if (!list.length) {
    el.innerHTML = '<p class="text-xs text-gray-300 text-center py-2">등록된 아티클이 없습니다</p>';
    return;
  }
  el.innerHTML = list.map(a => {
    const style = CATEGORY_STYLE[a.category] || { bg: 'bg-gray-50', emoji: '📄' };
    return `
      <button onclick="openArticleDetail('${a.id}')"
        class="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-gray-50
               hover:border-[#F5A623]/30 hover:bg-[#FFFBF0] transition-all text-left">
        <div class="w-12 h-12 ${style.bg} rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
          ${style.emoji}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-[#1A1A1A] leading-tight truncate">${esc(a.title)}</p>
          <span class="inline-block text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 mt-1">
            ${esc(a.category || '')}
          </span>
        </div>
      </button>`;
  }).join('');
}

function renderArticles() {
  filterArticles();
}

function setArticleTag(tag) {
  currentArticleTag = tag;
  document.querySelectorAll('.article-tag').forEach(btn => {
    const match = btn.getAttribute('onclick')?.match(/'([^']*)'/)?.[1] ?? '';
    btn.classList.toggle('active', match === tag);
  });
  filterArticles();
}

function filterArticles() {
  const query = (document.getElementById('articleSearch').value || '').toLowerCase();

  const filtered = allArticles.filter(a => {
    const matchTag = !currentArticleTag || a.category === currentArticleTag;
    const matchSearch = !query ||
      a.title.toLowerCase().includes(query) ||
      (a.description || '').toLowerCase().includes(query);
    return matchTag && matchSearch;
  });

  const el = document.getElementById('articleList');

  if (filtered.length === 0) {
    el.innerHTML = `
      <div class="py-16 text-center">
        <p class="text-sm text-gray-400 font-medium">검색 결과가 없습니다</p>
      </div>`;
    return;
  }

  el.innerHTML = filtered.map(a => {
    const style = CATEGORY_STYLE[a.category] || { bg: 'bg-gray-50', emoji: '📄' };
    return `
      <div onclick="openArticleDetail('${a.id}')"
        class="flex gap-4 p-5 bg-white rounded-2xl border hover:border-[#F5A623]/40
               hover:shadow-md transition-all cursor-pointer" style="border: 1.5px solid #F3F4F6;">
        <div class="flex-1 min-w-0">
          <span class="inline-block text-[11px] font-bold text-[#F5A623] bg-[#FFF8E6] rounded-full px-3 py-1 mb-3">
            ${esc(a.category || '')}
          </span>
          <h4 class="text-base font-bold text-[#1A1A1A] leading-snug mb-2">${esc(a.title)}</h4>
          <p class="text-sm text-gray-400 leading-relaxed line-clamp-2">${esc(a.description || '')}</p>
        </div>
        <div class="w-20 h-20 ${style.bg} rounded-2xl flex items-center justify-center text-4xl flex-shrink-0">
          ${style.emoji}
        </div>
      </div>`;
  }).join('');
}

/* ========================
   아티클 상세
======================== */
function openArticleDetail(id) {
  const article = allArticles.find(a => a.id === id);
  if (!article) return;

  document.getElementById('articleDetailCategory').textContent = article.category || '';
  document.getElementById('articleDetailTitle').textContent    = article.title;
  document.getElementById('articleDetailDate').textContent     = formatDate(article.created_at);
  document.getElementById('articleDetailBody').innerHTML       = renderArticleBlocks(article.blocks || []);

  document.getElementById('articleDetailModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeArticleDetail() {
  document.getElementById('articleDetailModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function renderArticleBlocks(blocks) {
  if (!blocks.length) return '<p class="text-gray-400 text-sm">내용이 없습니다</p>';
  return blocks.map(b => {
    if (b.type === 'text') {
      return `<p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-5">${esc(b.value)}</p>`;
    } else if (b.type === 'image') {
      return `<img src="${b.url}" class="w-full rounded-2xl mb-5 object-cover">`;
    }
    return '';
  }).join('');
}

/* ========================
   유틸리티
======================== */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function showMsg(el, msg, isSuccess = false) {
  el.textContent = msg;
  el.className = `text-xs ${isSuccess ? 'text-green-500' : 'text-red-400'}`;
  el.classList.remove('hidden');
}

function setLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.textContent = label;
  btn.style.opacity = loading ? '0.7' : '1';
}

function resetUploadZone(zoneId, icon, text, subtext) {
  document.getElementById(zoneId).innerHTML = `
    <iconify-icon icon="${icon}" width="36" class="text-gray-300 mb-2"></iconify-icon>
    <p class="text-sm text-gray-400 font-medium">${text}</p>
    <p class="text-xs text-gray-300 mt-1">${subtext}</p>
  `;
}

/* ========================
   엔터키 지원
======================== */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const authScreen = document.getElementById('authScreen');
    if (!authScreen.classList.contains('hidden')) {
      const signupForm = document.getElementById('signupForm');
      if (signupForm.classList.contains('hidden')) {
        handleLogin();
      } else {
        handleSignup();
      }
    }
  }
  if (e.key === 'Escape') {
    closeWillModal();
    closeWillDetail();
  }
});

/* ========================
   시작
======================== */
initAuth();
