/* global acquireVsCodeApi, document */
const vscode = acquireVsCodeApi();

function getFormData() {
    const emailField = document.querySelector('vscode-text-field[placeholder="Email"]');
    const passwordField = document.querySelector('vscode-text-field[placeholder="Password"]');
    
    return {
        email: emailField.value.trim(),
        password: passwordField.value
    };
}

function validateForm(email, password) {
    if (!email) {
        vscode.postMessage({
            command: 'showError',
            message: 'Email is required'
        });
        return false;
    }
    
    if (!password) {
        vscode.postMessage({
            command: 'showError',
            message: 'Password is required'
        });
        return false;
    }
    
    if (password.length < 6) {
        vscode.postMessage({
            command: 'showError',
            message: 'Password must be at least 6 characters long'
        });
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        vscode.postMessage({
            command: 'showError',
            message: 'Please enter a valid email address'
        });
        return false;
    }
    
    return true;
}

document.getElementById('signup-btn').addEventListener('click', () => {
    const { email, password } = getFormData();
    
    if (validateForm(email, password)) {
        vscode.postMessage({
            command: 'signupWithEmail',
            email: email,
            password: password
        });
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const { email, password } = getFormData();
    
    if (validateForm(email, password)) {
        vscode.postMessage({
            command: 'loginWithEmail',
            email: email,
            password: password
        });
    }
});

document.getElementById('signup-google-btn').addEventListener('click', () => {
    vscode.postMessage({
        command: 'signup'
    });
});