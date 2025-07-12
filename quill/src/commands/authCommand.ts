import * as vscode from 'vscode';
import { AuthService } from '../services/authService';

export class AuthCommand {
    private authService: AuthService;

    constructor(context: vscode.ExtensionContext) {
        this.authService = new AuthService(context);
    }

    async login(): Promise<void> {
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'user@example.com'
        });

        if (!email) return;

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true
        });

        if (!password) return;

        try {
            const { user } = await this.authService.login(email, password);
            vscode.window.showInformationMessage(`Welcome back, ${user.first_name}!`);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message || 'Login failed';
            vscode.window.showErrorMessage(`Login failed: ${errorMessage}`);
        }
    }

    async register(): Promise<void> {
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'user@example.com'
        });

        if (!email) return;

        const firstName = await vscode.window.showInputBox({
            prompt: 'Enter your first name',
            placeHolder: 'John'
        });

        if (!firstName) return;

        const lastName = await vscode.window.showInputBox({
            prompt: 'Enter your last name',
            placeHolder: 'Doe'
        });

        if (!lastName) return;

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true
        });

        if (!password) return;

        try {
            const { user } = await this.authService.register(email, password, firstName, lastName);
            vscode.window.showInformationMessage(`Welcome, ${user.first_name}! Your account has been created.`);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
            vscode.window.showErrorMessage(`Registration failed: ${errorMessage}`);
        }
    }

    async logout(): Promise<void> {
        await this.authService.logout();
        vscode.window.showInformationMessage('You have been logged out.');
    }

    async checkAuthStatus(): Promise<void> {
        const isAuthenticated = await this.authService.isAuthenticated();
        
        if (isAuthenticated) {
            const user = await this.authService.getStoredUser();
            if (user) {
                vscode.window.showInformationMessage(`Logged in as: ${user.first_name} ${user.last_name} (${user.email})`);
            }
        } else {
            vscode.window.showInformationMessage('Not logged in');
        }
    }
}