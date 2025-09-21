const vscode = acquireVsCodeApi();

document.getElementById('signup-btn').addEventListener('click', () => {
    vscode.postMessage({
        command: 'signup'
    });
});