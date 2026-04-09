document.addEventListener('DOMContentLoaded', () => {

    console.log("Reset JS loaded");
    
    const form = document.getElementById('reset-password-form');
    const messageEl = document.getElementById('message');
    
    const btn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    
    // Rules
    const ruleLength = document.getElementById('rule-length');
    const ruleUpper = document.getElementById('rule-uppercase');
    const ruleNumber = document.getElementById('rule-number');
    const ruleSpecial = document.getElementById('rule-special');
    
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    const toggleNew = document.getElementById('toggle-new');
    const toggleConfirm = document.getElementById('toggle-confirm');
    const matchText = document.getElementById('match-text');

    function checkPasswordMatch() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!confirmPassword) {
            matchText.textContent = '';
            return;
        }

        if (newPassword === confirmPassword) {
            matchText.textContent = "Passwords match";
            matchText.className = "match";
        } else {
            matchText.textContent = "Passwords do not match";
            matchText.className = "no-match";
        }
    }

newPasswordInput.addEventListener('input', checkPasswordMatch);
confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    if (toggleNew) {
        toggleNew.addEventListener('click', () => {
            newPasswordInput.type =
                newPasswordInput.type === 'password' ? 'text' : 'password';
        });
    }
    
    if (toggleConfirm) {
        toggleConfirm.addEventListener('click', () => {
            confirmPasswordInput.type =
                confirmPasswordInput.type === 'password' ? 'text' : 'password';
        });
    }
    
    // Password validation
    newPasswordInput.addEventListener('input', () => {
        const val = newPasswordInput.value;
    
        const hasLength = val.length >= 8;
        const hasUpper = /[A-Z]/.test(val);
        const hasNumber = /[0-9]/.test(val);
        const hasSpecial = /[^A-Za-z0-9]/.test(val);
    
        toggleRule(ruleLength, hasLength);
        toggleRule(ruleUpper, hasUpper);
        toggleRule(ruleNumber, hasNumber);
        toggleRule(ruleSpecial, hasSpecial);
    
        let score = [hasLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    
        let width = (score / 4) * 100;
        let color = score <= 1 ? 'red' : score === 2 ? 'orange' : score === 3 ? '#FFC107' : 'green';
    
        strengthFill.style.width = width + '%';
        strengthFill.style.backgroundColor = color;
    
        strengthText.textContent =
            score <= 1 ? "Weak" :
            score === 2 ? "Fair" :
            score === 3 ? "Good" : "Strong";
    });
    
    function toggleRule(el, isValid) {
        el.classList.toggle('valid', isValid);
    }
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
    
        const toast = document.createElement("div");
        toast.classList.add("toast", type);
    
        const icon = type === "success" ? "✔" : "⚠";
    
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span>${message}</span>
        `;
    
        container.appendChild(toast);
    
        setTimeout(() => toast.classList.add("show"), 10);
    
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    function toggleSubmitButton() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
    
        const isValid = newPassword &&
                        confirmPassword &&
                        newPassword === confirmPassword;
    
        btn.disabled = !isValid;
    }
    function launchConfetti() {
        const colors = ['#FFC107', '#8C1D40', '#4CAF50', '#2196F3'];
    
        for (let i = 0; i < 60; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '6px';
            confetti.style.height = '6px';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.top = '0px';
            confetti.style.left = Math.random() * window.innerWidth + 'px';
            confetti.style.opacity = Math.random();
            confetti.style.zIndex = '9999';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    
            document.body.appendChild(confetti);
    
            const fall = confetti.animate([
                { transform: `translateY(0)` },
                { transform: `translateY(${window.innerHeight}px)` }
            ], {
                duration: 1500 + Math.random() * 1000,
                easing: 'ease-out'
            });
    
            fall.onfinish = () => confetti.remove();
        }
    }
    
    newPasswordInput.addEventListener('input', toggleSubmitButton);
    confirmPasswordInput.addEventListener('input', toggleSubmitButton);
    confirmPasswordInput.addEventListener('input', () => {
        if (confirmPasswordInput.value && newPasswordInput.value !== confirmPasswordInput.value) {
            confirmPasswordInput.style.border = "1px solid red";
        } else {
            confirmPasswordInput.style.border = "";
        }
    });
    
    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
    
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
    
        // PASSWORD MATCH CHECK
        if (newPassword !== confirmPassword) {
            showToast("Passwords do not match", "error");
        
            form.classList.add("shake");
        
            setTimeout(() => {
                form.classList.remove("shake");
            }, 300);
        
            return;
        }
    
        if (!token) {
            showToast("Invalid reset link", "error");
            return;
        }
    
        btn.disabled = true;
        spinner.classList.remove('hidden');
        btnText.textContent = "Processing...";
    
        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
    
            const result = await response.json();
    
            if (response.ok) {
                launchConfetti();

                showToast("Password reset successful!", "success");

                // Redirect UI state
                btn.disabled = true;
                btnText.textContent = "Redirecting...";
                spinner.classList.remove('hidden');

                // Fade out page
                setTimeout(() => {
                    document.body.classList.add('fade-out');
                }, 1200);

                // Redirect after fade
                setTimeout(() => {
                    window.location.href = '/logon.html';
                }, 1800);
    
            } else {
                showToast(result.message || "Reset failed", "error");
            }
    
        } catch (err) {
            console.error(err);
            showToast("Reset failed", "error");
        }
    
        btn.disabled = false;
        spinner.classList.add('hidden');
        btnText.textContent = "Reset Password";
    });
    
    });