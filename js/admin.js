const SUPABASE_URL = 'https://kwifydqdmyorsuqnvygh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aWZ5ZHFkbXlvcnN1cW52eWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk1OTIsImV4cCI6MjA5NzI5NTU5Mn0.8lBEN0YSWZ5IeDY9Jf8nOJLaW4EBdeS2ZG2G6sEYOmw';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAIL = 'admin@admin.com.com';

let allConsultations = [];
let currentFilter = 'all';

const ALL_SECTIONS = ['dashboard', 'wills', 'happiness', 'consultations', 'articles', 'users'];

/* ── 초기화 ── */
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const ok = await checkAdmin();
    if (ok) enterAdmin();
  }
})();

async function checkAdmin() {
  const { data } = await sb.rpc('check_is_admin');
  return data === true;
}

/* ── 로그인 ── */
async function adminLogin() {
  const id  = document.getElementById('adminId').value.trim();
  const pw  = document.getElementById('adminPw').value;
  const err = document.getElementById('loginErr');
  const btn = document.getElementById('loginBtn');

  if (!id || !pw) { showErr(err, '아이디와 비밀번호를 입력해주세요'); return; }

  const email = id === 'admin' ? ADMIN_EMAIL : id;

  btn.textContent = '로그인 중...'; btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  btn.textContent = '로그인'; btn.disabled = false;

  if (error) { showErr(err, '아이디 또는 비밀번호가 올바르지 않습니다'); return; }

  const ok = await checkAdmin();
  if (!ok) { await sb.auth.signOut(); showErr(err, '어드민 권한이 없습니다'); return; }

  enterAdmin();
}

async function adminLogout() {
  await sb.auth.signOut();
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ── 앱 진입 ── */
async function enterAdmin() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  await loadAll();
  showSection('dashboard');
}

async function loadAll() {
  await Promise.all([
    loadStats(),
    loadConsultations(),
    loadUsers(),
    loadAdminWills(),
    loadAdminHappiness(),
    loadArticles(),
  ]);
}

/* ── 섹션 전환 ── */
function showSection(name) {
  ALL_SECTIONS.forEach(s => {
    document.getElementById(`sec-${s}`).classList.toggle('hidden', s !== name);
    const nav = document.getElementById(`nav-${s}`);
    if (nav) nav.classList.toggle('active', s === name);
  });
}

/* ── 통계 ── */
async function loadStats() {
  const [users, consult, happiness, wills] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('consultations').select('id', { count: 'exact', head: true }),
    sb.from('happiness').select('id', { count: 'exact', head: true }),
    sb.from('wills').select('id', { count: 'exact', head: true }),
  ]);
  document.getElementById('statUsers').textContent     = users.count ?? 0;
  document.getElementById('statConsult').textContent   = consult.count ?? 0;
  document.getElementById('statHappiness').textContent = happiness.count ?? 0;
  document.getElementById('statWills').textContent     = wills.count ?? 0;
}

/* ── 상담 신청 ── */
async function loadConsultations() {
  const { data } = await sb
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false });
  allConsultations = data || [];
  renderConsultations(allConsultations.slice(0, 5), 'recentConsult', true);
  renderConsultations(allConsultations, 'consultTable', false);
}

function filterConsult(filter) {
  currentFilter = filter;
  ['all','pending','confirmed','done'].forEach(f => {
    document.getElementById(`cf-${f}`).className =
      `px-4 py-2 rounded-xl text-xs font-bold ${f === filter ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-500'}`;
  });
  const list = filter === 'all' ? allConsultations : allConsultations.filter(c => c.status === filter);
  renderConsultations(list, 'consultTable', false);
}

function renderConsultations(list, targetId, compact) {
  const el = document.getElementById(targetId);
  if (!list.length) {
    el.innerHTML = '<p class="text-center text-sm text-gray-400 py-12">신청 내역이 없습니다</p>';
    return;
  }
  el.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <th class="text-left px-6 py-3">신청자</th>
          <th class="text-left px-6 py-3">전문가 분야</th>
          ${compact ? '' : '<th class="text-left px-6 py-3">상담 내용</th>'}
          <th class="text-left px-6 py-3">신청일</th>
          <th class="text-left px-6 py-3">상태</th>
          ${compact ? '' : '<th class="text-left px-6 py-3">변경</th>'}
        </tr>
      </thead>
      <tbody>
        ${list.map(c => `
          <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 font-medium text-[#1A1A1A]">${esc(c.user_name || '-')}</td>
            <td class="px-6 py-4 text-gray-600">${esc(c.expert_type)}</td>
            ${compact ? '' : `<td class="px-6 py-4 text-gray-500 max-w-xs"><p class="truncate">${esc(c.content)}</p></td>`}
            <td class="px-6 py-4 text-gray-400">${fmtDate(c.created_at)}</td>
            <td class="px-6 py-4">
              <span class="px-2.5 py-1 rounded-full text-xs font-bold ${statusClass(c.status)}">
                ${statusLabel(c.status)}
              </span>
            </td>
            ${compact ? '' : `
            <td class="px-6 py-4">
              <select onchange="updateStatus('${c.id}', this.value)"
                class="text-xs font-bold bg-gray-100 rounded-lg px-2 py-1.5 outline-none cursor-pointer">
                <option value="pending"   ${c.status==='pending'   ? 'selected':''}>대기</option>
                <option value="confirmed" ${c.status==='confirmed' ? 'selected':''}>확인</option>
                <option value="done"      ${c.status==='done'      ? 'selected':''}>완료</option>
              </select>
            </td>`}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function updateStatus(id, status) {
  await sb.from('consultations').update({ status }).eq('id', id);
  await loadConsultations();
  filterConsult(currentFilter);
}

function statusClass(s) {
  if (s === 'confirmed') return 'badge-confirmed';
  if (s === 'done')      return 'badge-done';
  return 'badge-pending';
}
function statusLabel(s) {
  if (s === 'confirmed') return '확인';
  if (s === 'done')      return '완료';
  return '대기';
}

/* ── 유언 작성 ── */
async function loadAdminWills() {
  const { data } = await sb
    .from('wills')
    .select('id, content, created_at, updated_at, user_id')
    .order('updated_at', { ascending: false });

  const list = data || [];
  const el = document.getElementById('willTable');

  if (!list.length) {
    el.innerHTML = '<p class="text-center text-sm text-gray-400 py-12">작성된 유언이 없습니다</p>';
    return;
  }

  el.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <th class="text-left px-6 py-3">내용 미리보기</th>
          <th class="text-left px-6 py-3">글자 수</th>
          <th class="text-left px-6 py-3">최종 수정일</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(w => `
          <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-gray-600 max-w-sm"><p class="truncate">${esc(w.content || '')}</p></td>
            <td class="px-6 py-4 text-gray-400">${(w.content || '').length}자</td>
            <td class="px-6 py-4 text-gray-400">${fmtDate(w.updated_at || w.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ── 행복저금 ── */
async function loadAdminHappiness() {
  const { data } = await sb
    .from('happiness')
    .select('id, content, created_at')
    .order('created_at', { ascending: false });

  const list = data || [];
  const el = document.getElementById('happinessTable');

  if (!list.length) {
    el.innerHTML = '<p class="text-center text-sm text-gray-400 py-12">작성된 행복저금이 없습니다</p>';
    return;
  }

  el.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <th class="text-left px-6 py-3">내용 미리보기</th>
          <th class="text-left px-6 py-3">글자 수</th>
          <th class="text-left px-6 py-3">작성일</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(h => `
          <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-gray-600 max-w-sm"><p class="truncate">${esc(h.content || '')}</p></td>
            <td class="px-6 py-4 text-gray-400">${(h.content || '').length}자</td>
            <td class="px-6 py-4 text-gray-400">${fmtDate(h.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ── 아티클 관리 ── */
let editingArticleId = null;

async function loadArticles() {
  const { data } = await sb
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  const list = data || [];
  const el = document.getElementById('articleTable');

  if (!list.length) {
    el.innerHTML = '<p class="text-center text-sm text-gray-400 py-12">등록된 아티클이 없습니다</p>';
    return;
  }

  el.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <th class="text-left px-6 py-3">제목</th>
          <th class="text-left px-6 py-3">내용 미리보기</th>
          <th class="text-left px-6 py-3">등록일</th>
          <th class="text-left px-6 py-3">관리</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(a => `
          <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 font-bold text-[#1A1A1A] max-w-[180px]"><p class="truncate">${esc(a.title)}</p></td>
            <td class="px-6 py-4 text-gray-500 max-w-xs"><p class="truncate">${esc(a.content)}</p></td>
            <td class="px-6 py-4 text-gray-400 whitespace-nowrap">${fmtDate(a.created_at)}</td>
            <td class="px-6 py-4">
              <div class="flex gap-2">
                <button onclick="editArticle('${a.id}')"
                  class="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-all">수정</button>
                <button onclick="deleteArticle('${a.id}')"
                  class="px-3 py-1.5 rounded-lg bg-red-50 text-xs font-bold text-red-400 hover:bg-red-100 transition-all">삭제</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openArticleModal(article = null) {
  editingArticleId = article ? article.id : null;
  document.getElementById('modalTitle').textContent = article ? '아티클 수정' : '아티클 등록';
  document.getElementById('articleTitleInput').value   = article ? article.title   : '';
  document.getElementById('articleContentInput').value = article ? article.content : '';
  document.getElementById('articleErr').classList.add('hidden');
  document.getElementById('articleModal').classList.remove('hidden');
}

function closeArticleModal() {
  document.getElementById('articleModal').classList.add('hidden');
  editingArticleId = null;
}

async function saveArticle() {
  const title   = document.getElementById('articleTitleInput').value.trim();
  const content = document.getElementById('articleContentInput').value.trim();
  const err     = document.getElementById('articleErr');
  const btn     = document.getElementById('articleSaveBtn');

  if (!title)   { err.textContent = '제목을 입력해주세요'; err.classList.remove('hidden'); return; }
  if (!content) { err.textContent = '내용을 입력해주세요'; err.classList.remove('hidden'); return; }

  btn.textContent = '저장 중...'; btn.disabled = true;

  let error;
  if (editingArticleId) {
    ({ error } = await sb.from('articles').update({ title, content, updated_at: new Date().toISOString() }).eq('id', editingArticleId));
  } else {
    ({ error } = await sb.from('articles').insert({ title, content }));
  }

  btn.textContent = '저장하기'; btn.disabled = false;

  if (error) { err.textContent = '저장에 실패했습니다'; err.classList.remove('hidden'); return; }

  closeArticleModal();
  await loadArticles();
}

async function editArticle(id) {
  const { data } = await sb.from('articles').select('*').eq('id', id).single();
  if (data) openArticleModal(data);
}

async function deleteArticle(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await sb.from('articles').delete().eq('id', id);
  await loadArticles();
}

/* ── 회원 목록 ── */
async function loadUsers() {
  const { data } = await sb
    .from('profiles')
    .select('id, name, is_admin, created_at')
    .order('created_at', { ascending: false });

  const users = data || [];
  const el = document.getElementById('userTable');

  if (!users.length) {
    el.innerHTML = '<p class="text-center text-sm text-gray-400 py-12">회원이 없습니다</p>';
    return;
  }

  el.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <th class="text-left px-6 py-3">이름</th>
          <th class="text-left px-6 py-3">권한</th>
          <th class="text-left px-6 py-3">가입일</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 font-medium text-[#1A1A1A]">${esc(u.name || '-')}</td>
            <td class="px-6 py-4">
              ${u.is_admin
                ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FFF8EC] text-[#F5A623]">어드민</span>'
                : '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-400">일반</span>'}
            </td>
            <td class="px-6 py-4 text-gray-400">${fmtDate(u.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ── 유틸 ── */
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
