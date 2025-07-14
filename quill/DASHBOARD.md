# Quill RAG Dashboard

The Quill RAG Dashboard provides a search-first interface for finding and exploring your research documents directly within VS Code. The dashboard prioritizes search functionality to help you quickly locate relevant papers.

## How to Access the Dashboard

### 1. Activity Bar View (Recommended)
- Look for the **book icon (📖)** in the VS Code activity bar (left sidebar)
- Click on the "Quill RAG" activity bar item
- The dashboard will open as a persistent side panel

### 2. Command Palette
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
- Type "Quill: Open Dashboard" and press Enter
- This will focus the activity bar view

### 3. Status Bar Button
- Look for the "Quill RAG" button in the bottom status bar
- Shows authentication status with colored indicators:
  - ✅ Green checkmark: Authenticated and ready
  - ❌ Red X: Not authenticated (need to login)
  - ⚠️ Yellow alert: Connection error
- Click the status bar button to open the dashboard

## Dashboard Features

### Search Interface (Top Priority)
- **Large Search Box**: Prominent search input with placeholder "Search your research papers..."
- **Search Icon**: 🔍 Magnifying glass icon inside the search box for easy access
- **Real-time Search**: Search results update as you type (300ms debounce)
- **Smart Matching**: Searches document titles and metadata for relevance

### Results Section (When Searching)
- **Top 3 Matches**: Most relevant documents highlighted in "Results" section
- **Relevance Ranking**: Documents sorted by search term position in title
- **Visual Highlighting**: Results shown with distinct styling and left border
- **Quick Access**: Click search icon or press Enter to search

### Library Section (Always Visible)
- **All Documents**: Complete list of uploaded documents below results
- **Status Indicators**: Tiny colored circles showing document state
  - 🟢 Green: Successfully processed and ready
  - 🟡 Yellow: Currently processing
  - 🔴 Red: Processing failed
- **Smart Titles**: Shows first few words of document names for quick recognition
- **Lowlight Effect**: Library documents appear dimmed when search results are shown
- **Hover Actions**: Delete button (×) appears when hovering over documents

### Document Management
- **Upload PDFs**: Use VS Code's context menu (right-click PDF files → "Upload to RAG")
- **Delete Documents**: Hover over any document and click the × button
- **Clear Library**: Use command palette → "Quill: Clear Document Library"

### Authentication Status (Bottom, Sticky)
- **Compact Status Bar**: Small, unobtrusive indicator at bottom
- **Visual Status**: Tiny colored dot showing login state
- **Quick Actions**: Login/logout button always accessible
- **Persistent**: Stays visible while scrolling through documents

### Search Behavior
- **Empty Search**: Shows all documents normally in library
- **Active Search**: Top 3 results highlighted, remaining documents lowlighted
- **Clear Search**: Delete search text to return to normal view
- **Minimum Length**: Search activates after typing 2+ characters

## Keyboard Shortcuts

- **Query Search**: Press `Enter` in the search box to submit queries
- **Dashboard Access**: Set up custom keybindings in VS Code settings

## Integration with Existing Commands

The dashboard integrates seamlessly with existing Quill commands:
- Login/logout operations update the dashboard automatically
- PDF uploads from context menu appear in the dashboard
- All authentication state changes are reflected immediately

## Tips for Best Experience

1. **Keep Dashboard Open**: Pin the activity bar view for quick access
2. **Monitor Status Bar**: Check authentication status at a glance
3. **Batch Operations**: Upload multiple documents before querying
4. **Use Clear Queries**: Be specific in your research questions
5. **Regular Cleanup**: Use "Clear Library" for fresh starts

## Troubleshooting

- **Dashboard Not Loading**: Check if the Quill extension is enabled
- **Authentication Issues**: Use the login button in the dashboard
- **Upload Failures**: Ensure PDF files are under 50MB
- **Connection Errors**: Check RAG server configuration in settings

The dashboard provides a modern, intuitive interface that consolidates all Quill RAG functionality in one place, making it easier to manage your research workflow within VS Code.