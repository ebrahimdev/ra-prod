import * as vscode from 'vscode';
import { DocumentService } from '../services/documentService';

export class ClearLibraryCommand {
    private documentService: DocumentService;

    constructor(context: vscode.ExtensionContext) {
        this.documentService = new DocumentService(context);
    }

    async execute() {
        try {
            // First, get all user's documents to show them what will be deleted
            const documents = await this.documentService.getDocuments();
            
            if (documents.length === 0) {
                vscode.window.showInformationMessage('Your document library is already empty.');
                return;
            }

            // Show warning with document count
            const warningMessage = `⚠️ This will permanently delete all ${documents.length} document(s) from your RAG library. This action cannot be undone.`;
            
            // Show detailed confirmation with document list
            const documentList = documents.map(doc => `• ${doc.title} (${doc.filename})`).join('\n');
            const fullMessage = `${warningMessage}\n\nDocuments to be deleted:\n${documentList}\n\nAre you sure you want to proceed?`;

            const action = await vscode.window.showWarningMessage(
                fullMessage,
                { 
                    modal: true,
                    detail: 'This will remove all documents, chunks, and embeddings from your personal library.'
                },
                'Delete All Documents',
                'Cancel'
            );

            if (action !== 'Delete All Documents') {
                return;
            }

            // Additional confirmation for safety
            const finalConfirmation = await vscode.window.showWarningMessage(
                '🚨 Final confirmation: Delete ALL documents?',
                { modal: true },
                'Yes, Delete Everything',
                'Cancel'
            );

            if (finalConfirmation !== 'Yes, Delete Everything') {
                return;
            }

            // Show progress while deleting
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Clearing Document Library',
                cancellable: false
            }, async (progress) => {
                try {
                    progress.report({ message: 'Deleting all documents...', increment: 25 });

                    // Call the bulk delete API
                    const result = await this.documentService.clearAllDocuments();
                    
                    progress.report({ message: 'Processing deletions...', increment: 75 });
                    
                    // Small delay for user feedback
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    progress.report({ message: 'Library cleared successfully!', increment: 100 });

                    // Show detailed success message
                    let message = `✅ Successfully deleted ${result.deleted_count}/${result.total_documents} document(s). Your RAG library has been reset.`;
                    
                    if (result.failed_documents && result.failed_documents.length > 0) {
                        message += `\n⚠️ Warning: ${result.failed_documents.length} document(s) could not be deleted.`;
                    }

                    const action = await vscode.window.showInformationMessage(
                        message,
                        'View Library Status',
                        'Upload New Document'
                    );

                    if (action === 'View Library Status') {
                        await this.showEmptyLibraryStatus();
                    } else if (action === 'Upload New Document') {
                        await vscode.commands.executeCommand('quill.uploadPdf');
                    }

                } catch (error: any) {
                    throw error;
                }
            });

        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to clear library: ${errorMessage}`);
        }
    }

    private async showEmptyLibraryStatus() {
        try {
            const documents = await this.documentService.getDocuments();
            const message = documents.length === 0 
                ? '📚 Your document library is now empty and ready for new uploads.'
                : `⚠️ Library clearing incomplete. ${documents.length} document(s) remain.`;
            
            vscode.window.showInformationMessage(message);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Could not verify library status: ${error.message}`);
        }
    }
}