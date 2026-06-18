/* =========================================
   MANGOHADA — main.js
   ========================================= */

/* ========================
   SUPABASE 설정
======================== */
const SUPABASE_URL  = 'https://kwifydqdmyorsuqnvygh.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aWZ5ZHFkbXlvcnN1cW52eWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk1OTIsImV4cCI6MjA5NzI5NTU5Mn0.8lBEN0YSWZ5IeDY9Jf8nOJLaW4EBdeS2ZG2G6sEYOmw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ========================
   EMAILJS 설정 (선택)
======================== */
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const ADMIN_EMAIL         = 'seungah0226@naver.com';

const EMAILJS_READY = EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';
if (EMAILJS_READY) emailjs.init(EMAILJS_PUBLIC_KEY);

/* ========================
   HEADER — scroll + mobile
======================== */
const header    = document.getElementById('header');
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

window.addEventListener('scroll', () => {
  header.classList.toggle('shadow-sm', window.scrollY > 20);
}, { passive: true });

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('hidden') === false;
    hamburger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
    });
  });
}

/* ========================
   ACTIVE NAV on scroll
======================== */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav__link[href^="#"]');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
    });
  });
}, { rootMargin: '-50% 0px -50% 0px' });

sections.forEach(s => navObserver.observe(s));

/* ========================
   FADE-UP SCROLL ANIMATION
======================== */
const fadeTargets = document.querySelectorAll(
  '.svc-card, .news-card, .intro__stats, .hero__inner'
);

fadeTargets.forEach(el => el.classList.add('fade-up'));

const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

fadeTargets.forEach(el => fadeObserver.observe(el));

/* ========================
   PRIVACY TOGGLE
======================== */
const privacyToggle = document.getElementById('privacyToggle');
const privacyBox    = document.getElementById('privacyBox');

privacyToggle.addEventListener('click', () => {
  const open = privacyBox.classList.toggle('is-open');
  privacyToggle.textContent = open ? '접기' : '내용 보기';
});

/* ========================
   FORM VALIDATION
======================== */
const form = document.getElementById('contactForm');

function setError(inputId, errId, msg) {
  const el  = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (msg) {
    el.classList.add('is-err');
    err.textContent = msg;
  } else {
    el.classList.remove('is-err');
    err.textContent = '';
  }
  return !msg;
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(v) {
  return /^[0-9]{2,4}-?[0-9]{3,4}-?[0-9]{4}$/.test(v.trim());
}

function validateAll() {
  let ok = true;

  const name = document.getElementById('name').value.trim();
  ok = setError('name', 'nameErr', name ? '' : '이름을 입력해주세요') && ok;

  const phone = document.getElementById('phone').value.trim();
  if (!phone) {
    ok = setError('phone', 'phoneErr', '연락처를 입력해주세요') && ok;
  } else if (!isValidPhone(phone)) {
    ok = setError('phone', 'phoneErr', '올바른 연락처 형식을 입력해주세요 (예: 010-1234-5678)') && ok;
  } else {
    setError('phone', 'phoneErr', '');
  }

  const email = document.getElementById('email').value.trim();
  if (!email) {
    ok = setError('email', 'emailErr', '이메일을 입력해주세요') && ok;
  } else if (!isValidEmail(email)) {
    ok = setError('email', 'emailErr', '올바른 이메일 형식을 입력해주세요') && ok;
  } else {
    setError('email', 'emailErr', '');
  }

  const type = document.getElementById('type').value;
  ok = setError('type', 'typeErr', type ? '' : '문의 유형을 선택해주세요') && ok;

  const message = document.getElementById('message').value.trim();
  ok = setError('message', 'messageErr', message ? '' : '문의 내용을 입력해주세요') && ok;

  const privacy = document.getElementById('privacy').checked;
  const privacyErr = document.getElementById('privacyErr');
  if (!privacy) {
    privacyErr.textContent = '개인정보 수집 및 이용에 동의해주세요';
    ok = false;
  } else {
    privacyErr.textContent = '';
  }

  return ok;
}

// Clear error on input
['name', 'phone', 'email', 'type', 'message'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.getElementById(id).classList.remove('is-err');
    document.getElementById(id).style.borderColor = '';
  });
});

// 체크박스 시각적 동작 (Tailwind 기반)
const privacyCheckbox = document.getElementById('privacy');
const checkmarkEl = document.getElementById('checkmark');
if (privacyCheckbox && checkmarkEl) {
  privacyCheckbox.addEventListener('change', () => {
    if (privacyCheckbox.checked) {
      checkmarkEl.style.background = '#F5A623';
      checkmarkEl.style.borderColor = '#F5A623';
      checkmarkEl.innerHTML = '<svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l4 4 8-8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
      checkmarkEl.style.background = 'white';
      checkmarkEl.style.borderColor = '';
      checkmarkEl.innerHTML = '';
    }
    document.getElementById('privacyErr').textContent = '';
  });
}

/* ========================
   FORM SUBMIT
======================== */
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateAll()) return;

  submitBtn.textContent = '전송 중...';
  submitBtn.disabled = true;

  const data = {
    name:    document.getElementById('name').value.trim(),
    email:   document.getElementById('email').value.trim(),
    phone:   document.getElementById('phone').value.trim(),
    type:    document.getElementById('type').value,
    message: document.getElementById('message').value.trim(),
  };

  try {
    // Supabase에 저장
    const { error } = await supabase
      .from('contact_submissions')
      .insert([data]);

    if (error) throw error;

    // EmailJS 이메일 알림 (설정된 경우)
    if (EMAILJS_READY) {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email:     ADMIN_EMAIL,
        from_name:    data.name,
        from_email:   data.email,
        phone:        data.phone,
        inquiry_type: data.type,
        message:      data.message,
      });
    }

    openModal();
    form.reset();
    if (checkmarkEl) {
      checkmarkEl.style.background = 'white';
      checkmarkEl.style.borderColor = '';
      checkmarkEl.innerHTML = '';
    }

  } catch (err) {
    console.error('문의 저장 실패:', err);
    alert('문의 전송 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
  } finally {
    submitBtn.textContent = '제출하기';
    submitBtn.disabled = false;
  }
});

/* ========================
   MODAL
======================== */
const modal        = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose   = document.getElementById('modalClose');

function openModal() {
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

function closeModal() {
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
});
