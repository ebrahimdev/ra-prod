// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ReactWebviewProvider = require('./src/providers/reactWebviewProvider');
const EmailAuthService = require('./src/services/emailAuthService');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function loadConfig() {
	const isDevelopment = process.env.NODE_ENV !== 'production' || vscode.env.appName.includes('Dev');
	const configFile = isDevelopment ? 'local.json' : 'production.json';
	const configPath = path.join(__dirname, 'config', configFile);

	try {
		const configData = fs.readFileSync(configPath, 'utf8');
		return JSON.parse(configData);
	} catch (error) {
		console.error(`Failed to load config from ${configPath}:`, error);
		// Fallback to defaults
		return {
			authServerUrl: 'http://localhost:8001',
			ragServerUrl: 'http://localhost:8000'
		};
	}
}

function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "texgpt" is now active!');

	// Handle URI callback from auth server
	vscode.window.registerUriHandler({
		handleUri(uri) {
			if (uri.path === '/auth') {
				const params = new URLSearchParams(uri.query);
				const accessToken = params.get('access_token');
				const refreshToken = params.get('refresh_token');
				const userEmail = params.get('user_email');
				const userFirstName = params.get('user_first_name');
				const userLastName = params.get('user_last_name');
				const userId = params.get('user_id');

				if (accessToken && refreshToken) {
					// Store tokens securely
					context.globalState.update('texgpt.accessToken', accessToken);
					context.globalState.update('texgpt.refreshToken', refreshToken);
					context.globalState.update('texgpt.userEmail', userEmail);
					context.globalState.update('texgpt.userFirstName', userFirstName);
					context.globalState.update('texgpt.userLastName', userLastName);
					context.globalState.update('texgpt.userId', userId);

					vscode.window.showInformationMessage(`Welcome to TeXGPT, ${userFirstName}! You are now signed in.`);
				} else {
					vscode.window.showErrorMessage('Sign-up failed: Invalid response from auth server.');
				}
			}
		}
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('texgpt.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from TeXGPT!');
	});

	// Register the signup command
	const signupDisposable = vscode.commands.registerCommand('texgpt.signup', async function () {
		try {
			// Load environment-based configuration
			const config = loadConfig();
			const authServerUrl = config.authServerUrl;

			// Request Google OAuth URL from auth server
			const response = await axios.get(`${authServerUrl}/api/auth/google/login`);
			const { authorization_url } = response.data;

			// Open the authorization URL in the default browser
			await vscode.env.openExternal(vscode.Uri.parse(authorization_url));

			vscode.window.showInformationMessage('Please complete the Google sign-up in your browser. You will be redirected back to VS Code when done.');

		} catch (error) {
			console.error('Error during signup:', error);
			vscode.window.showErrorMessage(`Sign-up failed: ${error.message}`);
		}
	});

	// Initialize email auth service
	const emailAuthService = new EmailAuthService(context);

	// Register email signup command
	const signupEmailDisposable = vscode.commands.registerCommand('texgpt.signupWithEmail', async function (email, password) {
		try {
			vscode.window.showInformationMessage('Creating your account...');

			const result = await emailAuthService.register(email, password);

			if (result.success) {
				const userName = result.user.first_name || result.user.email.split('@')[0];
				vscode.window.showInformationMessage(`Welcome to TeXGPT, ${userName}! Your account has been created successfully.`);

				// Reload window to switch to dashboard view
				vscode.commands.executeCommand('workbench.action.reloadWindow');
			} else {
				vscode.window.showErrorMessage(`Signup failed: ${result.error}`);
			}
		} catch (error) {
			console.error('Error during email signup:', error);
			vscode.window.showErrorMessage(`Signup failed: ${error.message}`);
		}
	});

	// Register email login command
	const loginEmailDisposable = vscode.commands.registerCommand('texgpt.loginWithEmail', async function (email, password) {
		try {
			vscode.window.showInformationMessage('Signing you in...');

			const result = await emailAuthService.login(email, password);

			if (result.success) {
				const userName = result.user.first_name || result.user.email.split('@')[0];
				vscode.window.showInformationMessage(`Welcome back, ${userName}!`);

				// Reload window to switch to dashboard view
				vscode.commands.executeCommand('workbench.action.reloadWindow');
			} else {
				vscode.window.showErrorMessage(`Login failed: ${result.error}`);
			}
		} catch (error) {
			console.error('Error during email login:', error);
			vscode.window.showErrorMessage(`Login failed: ${error.message}`);
		}
	});

	// Register logout command
	const logoutDisposable = vscode.commands.registerCommand('texgpt.logout', async function () {
		try {
			await emailAuthService.clearStoredData();
			vscode.window.showInformationMessage('You have been logged out successfully.');

			// Reload window to switch back to auth view
			vscode.commands.executeCommand('workbench.action.reloadWindow');
		} catch (error) {
			console.error('Error during logout:', error);
			vscode.window.showErrorMessage(`Logout failed: ${error.message}`);
		}
	});

	// Register the unified React webview provider
	const reactWebviewProvider = new ReactWebviewProvider(context, emailAuthService);
	const viewProviderDisposable = vscode.window.registerWebviewViewProvider('texgpt.view', reactWebviewProvider);
	context.subscriptions.push(viewProviderDisposable);

	context.subscriptions.push(disposable, signupDisposable, signupEmailDisposable, loginEmailDisposable, logoutDisposable);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
