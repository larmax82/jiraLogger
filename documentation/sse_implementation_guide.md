# Server-Sent Events (SSE) Implementation Guide 🚀

## What are Server-Sent Events? 🤔
Think of SSE as a one-way newsfeed:
- Server acts like a news broadcaster
- Browser acts like a TV receiving updates
- Perfect for real-time Jira task updates
- Simpler than WebSockets (one-way communication)

## 1. Backend Implementation 🖥️

### 1.1 Simple Express Server
```javascript:server/app.js
const express = require('express');
const app = express();

// Store connected clients
const clients = new Set();

// Handle client connections
app.get('/jira-updates', (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send initial connection message
    res.write('data: {"type": "connected"}\n\n');

    // Add client to connected clients
    clients.add(res);

    // Remove client when connection closes
    req.on('close', () => {
        clients.delete(res);
        console.log('Client disconnected');
    });
});

// Start server
app.listen(3000, () => {
    console.log('SSE Server running on port 3000');
});
```

### 1.2 Sending Updates to Clients
```javascript:server/update-sender.js
class UpdateSender {
    static sendUpdate(update) {
        clients.forEach(client => {
            client.write(`data: ${JSON.stringify(update)}\n\n`);
        });
    }
}

// Example: Handle Jira webhook
app.post('/jira-webhook', (req, res) => {
    const update = {
        type: 'jira-update',
        taskId: req.body.taskId,
        change: req.body.change,
        timestamp: new Date()
    };

    // Send to all connected clients
    UpdateSender.sendUpdate(update);
    res.status(200).send('Update received');
});
```

## 2. Chrome Extension Implementation 🧩

### 2.1 Create SSE Connection Manager
```javascript:extension/sse-manager.js
class SSEManager {
    constructor() {
        this.eventSource = null;
        this.isConnected = false;
        this.retryAttempts = 0;
        this.maxRetries = 5;
    }

    connect() {
        try {
            // Create EventSource connection
            this.eventSource = new EventSource('http://your-server:3000/jira-updates');

            // Connection opened
            this.eventSource.onopen = () => {
                this.isConnected = true;
                this.retryAttempts = 0;
                this.updateStatus('Connected 🟢');
            };

            // Handle incoming messages
            this.eventSource.onmessage = (event) => {
                const update = JSON.parse(event.data);
                this.handleUpdate(update);
            };

            // Handle errors
            this.eventSource.onerror = () => {
                this.handleError();
            };

        } catch (error) {
            console.error('SSE Connection failed:', error);
            this.handleError();
        }
    }

    handleUpdate(update) {
        switch (update.type) {
            case 'connected':
                console.log('Successfully connected to SSE');
                break;
            case 'jira-update':
                this.showNotification(update);
                break;
        }
    }

    showNotification(update) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: `Update in ${update.taskId}`,
            message: this.createMessage(update)
        });
    }

    createMessage(update) {
        const messages = {
            status: 'Status changed to',
            comment: 'New comment added by',
            assignment: 'Task assigned to'
        };
        return `${messages[update.change.type]} ${update.change.value}`;
    }

    handleError() {
        this.isConnected = false;
        this.updateStatus('Disconnected 🔴');

        if (this.retryAttempts < this.maxRetries) {
            this.retryAttempts++;
            setTimeout(() => {
                this.connect();
            }, 5000 * this.retryAttempts);
        }
    }

    updateStatus(status) {
        chrome.action.setBadgeText({ 
            text: this.isConnected ? '✓' : '!'
        });
    }
}
```

### 2.2 Create Update Handler
```javascript:extension/update-handler.js
class UpdateHandler {
    constructor() {
        this.updates = [];
        this.maxUpdates = 100;
    }

    addUpdate(update) {
        // Add new update
        this.updates.unshift({
            ...update,
            id: Date.now(),
            read: false
        });

        // Keep only recent updates
        if (this.updates.length > this.maxUpdates) {
            this.updates.pop();
        }

        // Save updates
        this.saveUpdates();
        
        // Update badge
        this.updateBadge();
    }

    saveUpdates() {
        chrome.storage.local.set({
            'jiraUpdates': this.updates
        });
    }

    updateBadge() {
        const unread = this.updates.filter(u => !u.read).length;
        if (unread > 0) {
            chrome.action.setBadgeText({ text: unread.toString() });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    }
}
```

### 2.3 Create Popup UI
```javascript:extension/popup.js
class PopupUI {
    constructor() {
        this.updateList = document.getElementById('updates');
    }

    initialize() {
        this.loadUpdates();
        this.setupRefresh();
    }

    async loadUpdates() {
        const data = await chrome.storage.local.get('jiraUpdates');
        const updates = data.jiraUpdates || [];

        this.updateList.innerHTML = updates.map(update => `
            <div class="update-item ${update.read ? 'read' : 'unread'}">
                <div class="update-header">
                    <span class="task-id">${update.taskId}</span>
                    <span class="timestamp">
                        ${this.formatTime(update.timestamp)}
                    </span>
                </div>
                <div class="update-content">
                    ${this.formatUpdate(update)}
                </div>
            </div>
        `).join('');
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) {
            const minutes = Math.floor(diff/60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        if (diff < 86400000) {
            const hours = Math.floor(diff/3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        return date.toLocaleDateString();
    }

    formatUpdate(update) {
        const templates = {
            status: (u) => `Status changed to <b>${u.change.value}</b>`,
            comment: (u) => `New comment by <b>${u.change.author}</b>`,
            assignment: (u) => `Assigned to <b>${u.change.assignee}</b>`
        };
        return templates[update.change.type](update);
    }
}
```

## 3. Usage Example 🎯

### 3.1 Initialize Extension
```javascript:extension/background.js
class JiraTracker {
    constructor() {
        this.sseManager = new SSEManager();
        this.updateHandler = new UpdateHandler();
        this.initialize();
    }

    initialize() {
        // Start SSE connection
        this.sseManager.connect();

        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, reply) => {
            this.handleMessage(message, sender, reply);
        });
    }

    handleMessage(message, sender, reply) {
        switch (message.type) {
            case 'getUpdates':
                reply({ updates: this.updateHandler.updates });
                break;
            case 'markAsRead':
                this.updateHandler.markAsRead(message.updateId);
                break;
        }
    }
}

// Start the tracker
const tracker = new JiraTracker();
```

## Benefits of SSE vs WebSocket 🌟

1. **Simpler Implementation**
   - No need for complex connection management
   - Browser handles reconnection automatically
   - Less code to maintain

2. **Resource Efficient**
   - Lighter than WebSocket
   - Perfect for one-way updates
   - Better battery life

3. **Reliable**
   - Automatic reconnection
   - Built-in error handling
   - Native browser support

## Common Issues and Solutions 🔧

### 1. Connection Timeout
```javascript
// Add keepalive ping
setInterval(() => {
    clients.forEach(client => {
        client.write(':\n\n'); // Send comment to keep connection alive
    });
}, 30000); // Every 30 seconds
```

### 2. Memory Management
```javascript
// Clean up old updates
class UpdateCleaner {
    static cleanup() {
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        this.updates = this.updates.filter(update => 
            (now - update.timestamp) < ONE_DAY
        );
    }
}
```

### 3. Error Recovery
```javascript
// Add to SSEManager
reconnect() {
    if (this.eventSource) {
        this.eventSource.close();
    }
    setTimeout(() => {
        this.connect();
    }, 5000);
}
```

Need help with any specific part of the SSE implementation? Let me know! 😊 