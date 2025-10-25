const vscode = require('vscode');

/**
 * ChatService - Minimal service to manage chat editor panels
 */
class ChatService {
  constructor(context) {
    this.context = context;
    this.activeEditors = new Map(); // conversationId -> panel
  }

  /**
   * Register an active chat editor panel
   */
  registerEditor(conversationId, panel) {
    this.activeEditors.set(conversationId, panel);

    panel.onDidDispose(() => {
      this.activeEditors.delete(conversationId);
    });
  }

  /**
   * Get active editor for a conversation
   */
  getEditor(conversationId) {
    return this.activeEditors.get(conversationId);
  }

  /**
   * Check if a conversation has an open editor
   */
  hasOpenEditor(conversationId) {
    return this.activeEditors.has(conversationId);
  }
}

module.exports = ChatService;
