import * as vscode from 'vscode';
import { DocumentService } from '../services/documentService';
import { FileUtils } from '../utils/fileUtils';

export class UploadCommand {
    private documentService: DocumentService;

    constructor(context: vscode.ExtensionContext) {
        this.documentService = new DocumentService(context);
    }

    async execute(uri?: vscode.Uri) {
        let filePath: string;

        if (uri) {
            // Called from context menu
            filePath = uri.fsPath;
        } else {
            // Called from command palette - show file picker
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'PDF Files': ['pdf']
                },
                openLabel: 'Select PDF to Upload'
            });

            if (!fileUri || fileUri.length === 0) {
                return;
            }

            filePath = fileUri[0].fsPath;
        }

        // Validate file
        const validation = FileUtils.validateFile(filePath);
        if (!validation.isValid) {
            vscode.window.showErrorMessage(`Upload failed: ${validation.error}`);
            return;
        }

        // Get file info for display
        const fileInfo = FileUtils.getFileInfo(filePath);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const relativePath = FileUtils.getRelativePath(filePath, workspaceRoot);

        // Show confirmation dialog
        const confirm = await vscode.window.showInformationMessage(
            `Upload "${relativePath}" (${fileInfo.sizeFormatted}) to RAG?`,
            { modal: true },
            'Upload',
            'Cancel'
        );

        if (confirm !== 'Upload') {
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Uploading PDF to RAG',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: `Uploading ${fileInfo.name}...` });

                const document = await this.documentService.uploadDocument(filePath);

                progress.report({ message: 'Processing document...', increment: 50 });

                // Wait a moment to show processing message
                await new Promise(resolve => setTimeout(resolve, 1000));

                progress.report({ message: 'Upload complete!', increment: 50 });

                // Show success message with options
                const action = await vscode.window.showInformationMessage(
                    `PDF uploaded successfully! Document: "${document.title}"`,
                    'View Documents',
                    'Query RAG'
                );

                if (action === 'View Documents') {
                    await this.showDocuments();
                } else if (action === 'Query RAG') {
                    await vscode.commands.executeCommand('quill.query');
                }

            } catch (error: any) {
                const errorMessage = error.message || 'Unknown error occurred';
                vscode.window.showErrorMessage(`Upload failed: ${errorMessage}`);
            }
        });
    }

    private async showDocuments() {
        try {
            const documents = await this.documentService.getDocuments();
            
            if (documents.length === 0) {
                vscode.window.showInformationMessage('No documents found.');
                return;
            }

            // Create a quick pick with document list
            const items = documents.map(doc => ({
                label: doc.title,
                description: `${doc.status} • ${doc.filename}`,
                detail: `Uploaded: ${new Date(doc.upload_date).toLocaleDateString()} • Size: ${FileUtils.formatFileSize(doc.file_size)}`,
                document: doc
            }));

            const selected = await vscode.window.showQuickPick(items, {
                title: 'Your Documents',
                placeHolder: 'Select a document to view details'
            });

            if (selected) {
                const doc = selected.document;
                const info = [
                    `Title: ${doc.title}`,
                    `Status: ${doc.status}`,
                    `File: ${doc.filename}`,
                    `Size: ${FileUtils.formatFileSize(doc.file_size)}`,
                    `Uploaded: ${new Date(doc.upload_date).toLocaleString()}`,
                    doc.processed_date ? `Processed: ${new Date(doc.processed_date).toLocaleString()}` : 'Processing...'
                ].join('\n');

                vscode.window.showInformationMessage(info, { modal: true });
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to retrieve documents: ${error.message}`);
        }
    }
}