/* global acquireVsCodeApi, document */
const vscode = acquireVsCodeApi();

// Listen for messages from the extension
window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'setUser':
            const emailElement = document.getElementById('user-email');
            if (emailElement && message.user) {
                emailElement.textContent = message.user.email;
            }
            break;
    }
});

// Request user data on load
vscode.postMessage({
    command: 'requestUserData'
});
