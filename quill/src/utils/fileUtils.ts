import * as fs from 'fs';
import * as path from 'path';

export class FileUtils {
    static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    static readonly ALLOWED_EXTENSIONS = ['.pdf'];

    static validateFile(filePath: string): { isValid: boolean; error?: string } {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return { isValid: false, error: 'File does not exist' };
        }

        // Check file extension
        const ext = path.extname(filePath).toLowerCase();
        if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
            return { isValid: false, error: 'Only PDF files are allowed' };
        }

        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size > this.MAX_FILE_SIZE) {
            return { isValid: false, error: 'File too large. Maximum size is 50MB' };
        }

        // Check if file is readable
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
        } catch (error) {
            return { isValid: false, error: 'File is not readable' };
        }

        return { isValid: true };
    }

    static getFileInfo(filePath: string): { name: string; size: number; sizeFormatted: string } {
        const stats = fs.statSync(filePath);
        const name = path.basename(filePath);
        const size = stats.size;
        const sizeFormatted = this.formatFileSize(size);

        return { name, size, sizeFormatted };
    }

    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static getRelativePath(filePath: string, workspaceRoot?: string): string {
        if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
            return path.relative(workspaceRoot, filePath);
        }
        return path.basename(filePath);
    }
}