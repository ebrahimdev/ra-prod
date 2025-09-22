const vscode = acquireVsCodeApi();

document.getElementById('signup-google-btn').addEventListener('click', () => {
    vscode.postMessage({
        command: 'signup'
    });
});