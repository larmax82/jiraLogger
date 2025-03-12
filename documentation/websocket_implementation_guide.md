# How to Implement WebSockets in Jira Task Tracker 🚀

## Step 1: Setting Up the Backend Server 🖥️

### 1.1 Create a Simple Server (Using Node.js)
```javascript:server/index.js
// Install required packages:
// npm install express ws

const express = require('express');
const WebSocket = require('ws');
const app = express();

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Track connected clients
const clients = new Map();

// Handle new connections
wss.on('connection', (ws) => {
    console.log('New client connected! 🎉');
    
    // Store client connection
    const clientId = generateClientId();
    clients.set(clientId, ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Jira Task Tracker!'
    }));
    
    // Handle client disconnect
    ws.on('close', () => {
        clients.delete(clientId);
        console.log('Client disconnected 👋');
    });
});
```

### 1.2 Add Jira Webhook Handler
```javascript:server/webhook-handler.js
app.post('/jira-webhook', (req, res) => {
    const update = req.body;
    
    // Send update to all connected clients
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'jira-update',
                data: update
            }));
        }
    });
    
    res.status(200).send('Update received');
});
```

## Step 2: Chrome Extension Implementation 🧩

### 2.1 Create Connection Manager
```javascript:extension/connection.js
class ConnectionManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
    }

    // Connect to WebSocket server
    connect() {
        try {
            this.ws = new WebSocket('ws://your-server:8080');
            
            // When connection opens
            this.ws.onopen = () => {
                this.isConnected = true;
                this.retryCount = 0;
                this.showStatus('Connected! 🟢');
            };

            // Handle incoming messages
            this.ws.onmessage = (event) => {
                const update = JSON.parse(event.data);
                this.handleUpdate(update);
            };

            // Handle disconnection
            this.ws.onclose = () => {
                this.isConnected = false;
                this.showStatus('Disconnected 🔴');
                this.retryConnection();
            };

        } catch (error) {
            console.error('Connection failed:', error);
            this.retryConnection();
        }
    }

    // Show connection status in extension
    showStatus(message) {
        chrome.action.setBadgeText({ 
            text: this.isConnected ? '✓' : '!'
        });
        chrome.action.setBadgeBackgroundColor({ 
            color: this.isConnected ? '#4CAF50' : '#F44336'
        });
    }

    // Retry connection if disconnected
    retryConnection() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => {
                this.connect();
            }, 5000 * this.retryCount); // Increase delay with each retry
        }
    }
}
```

### 2.2 Create Update Handler
```javascript:extension/update-handler.js
class UpdateHandler {
    constructor() {
        this.notifications = [];
    }

    // Handle incoming updates
    handleUpdate(update) {
        switch (update.type) {
            case 'jira-update':
                this.handleJiraUpdate(update.data);
                break;
            case 'connection':
                this.handleConnectionMessage(update);
                break;
        }
    }

    // Handle Jira updates
    handleJiraUpdate(data) {
        // Create user-friendly notification
        const notification = {
            title: `Update in ${data.taskKey}`,
            message: this.createFriendlyMessage(data),
            timestamp: new Date()
        };

        // Show desktop notification
        this.showNotification(notification);
        
        // Store for history
        this.notifications.push(notification);
        
        // Update extension badge
        this.updateBadge();
    }

    // Create friendly message from update
    createFriendlyMessage(data) {
        const messages = {
            statusChange: (data) => 
                `Status changed to "${data.newStatus}"`,
            comment: (data) => 
                `New comment from ${data.author}`,
            assignment: (data) => 
                `Assigned to ${data.assignee}`
        };

        return messages[data.updateType](data);
    }

    // Show desktop notification
    showNotification(notification) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: notification.title,
            message: notification.message
        });
    }
}
```

### 2.3 Create User Interface
```javascript:extension/popup.js
class PopupUI {
    constructor() {
        this.updateList = document.getElementById('updates');
        this.statusIndicator = document.getElementById('status');
    }

    // Initialize popup
    initialize() {
        this.loadUpdates();
        this.setupEventListeners();
    }

    // Load recent updates
    loadUpdates() {
        const updates = this.getStoredUpdates();
        updates.forEach(update => {
            this.addUpdateToList(update);
        });
    }

    // Add update to list
    addUpdateToList(update) {
        const updateElement = document.createElement('div');
        updateElement.className = 'update-item';
        updateElement.innerHTML = `
            <div class="update-title">${update.title}</div>
            <div class="update-message">${update.message}</div>
            <div class="update-time">
                ${this.formatTime(update.timestamp)}
            </div>
        `;
        this.updateList.appendChild(updateElement);
    }

    // Format timestamp
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff/60000)} minutes ago`;
        if (diff < 86400000) return `${Math.floor(diff/3600000)} hours ago`;
        return date.toLocaleDateString();
    }
}
```

## Step 3: Put It All Together 🎯

### 3.1 Initialize Extension
```javascript:extension/background.js
// Create main controller
class JiraTracker {
    constructor() {
        this.connection = new ConnectionManager();
        this.updateHandler = new UpdateHandler();
        this.initialize();
    }

    initialize() {
        // Start connection
        this.connection.connect();
        
        // Set up message listeners
        chrome.runtime.onMessage.addListener((message, sender, reply) => {
            this.handleMessage(message, sender, reply);
        });
    }
}

// Start the tracker
const tracker = new JiraTracker();
```

### 3.2 Create Simple Settings Page
```html:extension/options.html
<div class="settings-container">
    <h2>Jira Task Tracker Settings</h2>
    
    <div class="setting-item">
        <label>
            <input type="checkbox" id="enableNotifications">
            Enable Desktop Notifications
        </label>
    </div>

    <div class="setting-item">
        <label>
            <input type="checkbox" id="showBadge">
            Show Update Badge
        </label>
    </div>

    <div class="setting-item">
        <label>Update Types to Track:</label>
        <div class="update-types">
            <label>
                <input type="checkbox" name="updateType" value="status">
                Status Changes
            </label>
            <label>
                <input type="checkbox" name="updateType" value="comments">
                Comments
            </label>
            <label>
                <input type="checkbox" name="updateType" value="assignments">
                Assignments
            </label>
        </div>
    </div>

    <button id="saveSettings">Save Settings</button>
</div>
```

## Testing Your Implementation 🧪

1. **Start the Server**
```bash
node server/index.js
```

2. **Load the Extension**
- Open Chrome
- Go to `chrome://extensions/`
- Enable Developer mode
- Click "Load unpacked"
- Select your extension folder

3. **Test the Connection**
- Click the extension icon
- Check connection status
- Make a change in Jira
- Verify real-time update appears

## Common Issues and Solutions 🔧

1. **Connection Issues**
```javascript
// Add this to ConnectionManager
checkConnection() {
    if (!this.isConnected) {
        this.connect();
    }
}
```

2. **Missing Updates**
```javascript
// Add this to UpdateHandler
verifyUpdate(update) {
    if (this.isDuplicate(update)) {
        return false;
    }
    return true;
}
```

3. **Performance Issues**
```javascript
// Add this to UpdateHandler
cleanOldUpdates() {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    this.notifications = this.notifications.filter(n => 
        (new Date() - new Date(n.timestamp)) < ONE_DAY
    );
}
```

Need help with any specific part of the implementation? Let me know! 😊 