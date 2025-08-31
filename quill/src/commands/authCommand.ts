import * as vscode from 'vscode';
import { AuthService } from '../services/authService';
import { Logger } from '../utils/logger';

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
        Logger.info('Starting user registration flow...');
        
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'user@example.com'
        });

        if (!email) {
            Logger.info('Registration cancelled - no email provided');
            return;
        }

        const firstName = await vscode.window.showInputBox({
            prompt: 'Enter your first name',
            placeHolder: 'John'
        });

        if (!firstName) {
            Logger.info('Registration cancelled - no first name provided');
            return;
        }

        const lastName = await vscode.window.showInputBox({
            prompt: 'Enter your last name',
            placeHolder: 'Doe'
        });

        if (!lastName) {
            Logger.info('Registration cancelled - no last name provided');
            return;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true
        });

        if (!password) {
            Logger.info('Registration cancelled - no password provided');
            return;
        }

        try {
            Logger.info(`Attempting to register user: ${email}`);
            const { user } = await this.authService.register(email, password, firstName, lastName);
            Logger.info(`Registration successful for user: ${user.first_name} ${user.last_name}`);
            vscode.window.showInformationMessage(`Welcome, ${user.first_name}! Your account has been created.`);
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
            Logger.error(`Registration failed for ${email}`, error);
            Logger.error(`Error details: ${JSON.stringify(error.response?.data || error.message)}`);
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