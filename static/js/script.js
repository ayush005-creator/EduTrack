// ══════════════════════════════════════════════
//  EduTrack  –  Signup Page (Django Backend)
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // ── Helper: get CSRF token from cookie ──
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

    // ── Course → Branch Mapping ──
    const courseSelect = document.getElementById('course');
    const branchSelect = document.getElementById('branch');
    const branches = {
        btech: ['Computer Science (CSE)', 'Information Tech (IT)', 'Mechanical (ME)', 'Civil (CE)', 'Electrical (EE)'],
        mba: ['Finance', 'Marketing', 'Human Resources', 'Operations'],
        mca: ['Software Engineering', 'Cloud Computing', 'Data Science']
    };

    courseSelect.addEventListener('change', function () {
        branchSelect.innerHTML = '<option value="" disabled selected>Select Branch</option>';
        branchSelect.disabled = false;
        (branches[this.value] || []).forEach(branch => {
            const opt = document.createElement('option');
            opt.value = branch.toLowerCase().replace(/ /g, '_');
            opt.textContent = branch;
            branchSelect.appendChild(opt);
        });
    });

    // ── Age Calculation ──
    const dobInput = document.getElementById('dob');
    const ageDisplay = document.getElementById('age-display');
    const dobError = document.getElementById('dob-error');

    dobInput.addEventListener('change', function () {
        const dobDate = new Date(this.value);
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
        if (isNaN(age)) return;
        ageDisplay.textContent = `Calculated Age: ${age} years`;
        if (age < 18) {
            dobError.textContent = 'You must be at least 18 years old.';
            this.setCustomValidity('Too young');
            ageDisplay.style.color = 'var(--error-color)';
        } else if (age > 24) {
            dobError.textContent = 'Age must not exceed 24 years.';
            this.setCustomValidity('Too old');
            ageDisplay.style.color = 'var(--error-color)';
        } else {
            dobError.textContent = '';
            this.setCustomValidity('');
            ageDisplay.style.color = 'var(--success-color)';
        }
    });

    // ── College / Geolocation ──
    const collegeSelect = document.getElementById('college');
    const detectBtn = document.getElementById('detect-btn');
    const localColleges = [
        'IIT Indore', 'SGSITS Indore', 'DAVV University',
        'Acropolis Institute of Tech', 'Medicaps University'
    ];

    function loadColleges(city = 'Local Area') {
        collegeSelect.innerHTML = `<option value="" disabled selected>Select College in ${city}</option>`;
        localColleges.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col.toLowerCase().replace(/ /g, '_');
            opt.textContent = col;
            collegeSelect.appendChild(opt);
        });
    }

    detectBtn.addEventListener('click', () => {
        collegeSelect.innerHTML = '<option value="" disabled selected>Locating...</option>';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                () => { setTimeout(() => loadColleges('Your Area'), 800); },
                () => { alert('Location access denied. Loading default list.'); loadColleges(); }
            );
        } else { loadColleges(); }
    });
    loadColleges();

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

    // ── Password Strength ──
    const passInput = document.getElementById('password');
    const strengthBar = document.getElementById('strength-bar');
    passInput.addEventListener('input', function () {
        const val = this.value;
        let score = 0;
        if (val.length > 5) score++;
        if (val.length > 8) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        let width = '0%', color = 'transparent';
        if (score > 0 && score <= 2) { width = '33%'; color = '#e74c3c'; }
        else if (score > 2 && score <= 4) { width = '66%'; color = '#f1c40f'; }
        else if (score === 5) { width = '100%'; color = '#2ecc71'; }
        strengthBar.style.width = width;
        strengthBar.style.backgroundColor = color;
    });

    // ── Confirm Password ──
    const confirmPass = document.getElementById('confirm-password');
    const confirmPassErr = document.getElementById('confirm-password-error');
    confirmPass.addEventListener('input', function () {
        if (this.value !== passInput.value) {
            confirmPassErr.textContent = 'Passwords do not match!';
            this.setCustomValidity('Mismatch');
        } else {
            confirmPassErr.textContent = '';
            this.setCustomValidity('');
        }
    });

    // ── Form Submit → POST /api/signup/ ──
    const form = document.getElementById('signup-form');
    const submitBtn = document.getElementById('submit-btn');
    const modal = document.getElementById('success-modal');
    const errorBanner = document.getElementById('error-banner');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        if (confirmPass.value !== passInput.value) return;

        errorBanner.style.display = 'none';
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        const payload = {
            fullname: document.getElementById('fullname').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            password: document.getElementById('password').value,
            dob: document.getElementById('dob').value,
            gender: document.getElementById('gender').value,
            address: document.getElementById('address').value.trim(),
            course: document.getElementById('course').value,
            branch: document.getElementById('branch').value,
            college: document.getElementById('college').value,
        };

        try {
            const res = await fetch('/api/signup/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;

            if (!res.ok) {
                errorBanner.textContent = data.error || 'Signup failed. Please try again.';
                errorBanner.style.display = 'block';
                // Highlight relevant field errors
                if (data.error && data.error.toLowerCase().includes('email')) {
                    document.getElementById('email-error').textContent = data.error;
                }
                return;
            }

            // Success → show modal, redirect to dashboard
            modal.style.display = 'flex';
            setTimeout(() => { window.location.href = '/dashboard/'; }, 1800);

        } catch (err) {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            errorBanner.textContent = 'Network error. Please check your connection.';
            errorBanner.style.display = 'block';
        }
    });
});
