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
        toast.textContent = message;
    
        container.appendChild(toast);
    
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
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
                showToast("Password reset successful!", "success");
    
                setTimeout(() => {
                    window.location.href = '/logon.html';
                }, 2000);
    
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