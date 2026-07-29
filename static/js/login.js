// ══════════════════════════════════════════════
//  EduTrack  –  Login Page (Django Backend)
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            document.cookie.split(';').forEach(cookie => {
                const c = cookie.trim();
                if (c.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(c.slice(name.length + 1));
                }
            });
        }
        return cookieValue;
    }

    // ── Theme Toggle ──
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
    });

    // ── Password Show/Hide ──
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function () {
            const target = document.getElementById(this.getAttribute('data-target'));
            if (target.type === 'password') {
                target.type = 'text';
                this.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                target.type = 'password';
                this.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // ── Form References ──
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const loginIdInput = document.getElementById('login-id');
    const passwordInput = document.getElementById('login-password');
    const idError = document.getElementById('login-id-error');
    const passError = document.getElementById('login-password-error');
    const successModal = document.getElementById('login-success-modal');

    // ── Form Submit → POST /api/login/ ──
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        idError.textContent = '';
        passError.textContent = '';

        if (!loginForm.checkValidity()) { loginForm.reportValidity(); return; }

        loginBtn.classList.add('loading');
        loginBtn.disabled = true;

        try {
            const res = await fetch('/api/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    login_id: loginIdInput.value.trim(),
                    password: passwordInput.value,
                }),
            });

            const data = await res.json();
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;

            if (!res.ok) {
                const msg = data.error || 'Login failed.';
                if (msg.toLowerCase().includes('password')) {
                    passError.textContent = msg;
                } else {
                    idError.textContent = msg;
                }
                return;
            }

            // Success
            successModal.style.display = 'flex';
            setTimeout(() => { window.location.href = '/dashboard/'; }, 1800);

        } catch (err) {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
            idError.textContent = 'Network error. Please try again.';
        }
    });

    loginIdInput.addEventListener('input', () => { idError.textContent = ''; });
    passwordInput.addEventListener('input', () => { passError.textContent = ''; });
});
