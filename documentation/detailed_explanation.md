# Detailed Explanation of Jira Task Tracker Components 🔍

## 1. Polling Manager Deep Dive 🕒

The Polling Manager is our "smart brain" that decides when to check for updates.

```javascript:extension/polling-manager.js
class PollingManager {
    constructor() {
        // Store tasks we're monitoring
        this.tasks = new Map();
        
        // Base polling interval (30 seconds)
        this.pollingInterval = 30000;
        
        // Track when each task was last updated
        this.lastUpdateTimes = new Map();
        
        // Track consecutive errors
        this.errorCounts = new Map();
    }

    getTaskInterval(taskId) {
        const lastUpdate = this.lastUpdateTimes.get(taskId);
        const now = Date.now();
        const errorCount = this.errorCounts.get(taskId) || 0;

        // If there are errors, back off exponentially
        if (errorCount > 0) {
            return Math.min(
                this.pollingInterval * Math.pow(2, errorCount),
                900000 // Max 15 minutes
            );
        }

        // No last update? Use base interval
        if (!lastUpdate) return this.pollingInterval;

        const timeSinceUpdate = now - lastUpdate;
        
        // Task activity levels:
        if (timeSinceUpdate < 3600000) { // Last hour - Active
            return 30000; // Check every 30 seconds
        } else if (timeSinceUpdate < 86400000) { // Last 24 hours - Normal
            return 300000; // Check every 5 minutes
        } else { // Inactive
            return 900000; // Check every 15 minutes
        }
    }
}
```

### How It Works:
1. **Smart Intervals**: 
   - Recently updated tasks are checked more frequently
   - Quiet tasks are checked less often
   - Errors cause gradual slowdown

2. **Error Handling**:
   - Tracks consecutive errors
   - Implements exponential backoff
   - Prevents overwhelming the server

## 2. XML Manager Explained 📄

The XML Manager handles fetching and parsing Jira's XML data.

```javascript:extension/xml-manager.js
class XMLManager {
    constructor() {
        // Cache previous XML data to detect changes
        this.cache = new Map();
        
        // Track failed requests
        this.failedRequests = new Map();
    }

    async fetchTaskXML(taskUrl) {
        const xmlUrl = this.convertToXmlUrl(taskUrl);
        
        try {
            const response = await fetch(xmlUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const xmlText = await response.text();
            
            // Clear any previous errors
            this.failedRequests.delete(taskUrl);
            
            return this.processXMLData(xmlText, taskUrl);
            
        } catch (error) {
            this.handleFetchError(taskUrl, error);
            throw error;
        }
    }

    processXMLData(xmlText, taskUrl) {
        const taskData = this.parseXML(xmlText);
        const previousData = this.cache.get(taskUrl);
        
        // Detect what changed
        const changes = this.detectChanges(previousData, taskData);
        
        // Update cache if there are changes
        if (changes.hasChanges) {
            this.cache.set(taskUrl, taskData);
        }

        return {
            changed: changes.hasChanges,
            changes: changes.details,
            data: taskData
        };
    }

    detectChanges(oldData, newData) {
        if (!oldData) return { hasChanges: true, details: { isNew: true } };

        const changes = {
            hasChanges: false,
            details: {}
        };

        // Check each field for changes
        ['status', 'assignee', 'priority', 'resolution'].forEach(field => {
            if (oldData[field] !== newData[field]) {
                changes.hasChanges = true;
                changes.details[field] = {
                    from: oldData[field],
                    to: newData[field]
                };
            }
        });

        // Check for new comments
        if (newData.comments.length > oldData.comments.length) {
            changes.hasChanges = true;
            changes.details.newComments = newData.comments.slice(oldData.comments.length);
        }

        return changes;
    }
}
```

### How It Works:
1. **URL Conversion**:
   - Takes regular Jira URL
   - Converts to XML endpoint URL
   - Example: 
     ```
     From: https://jira.company.com/browse/PROJECT-123
     To: https://jira.company.com/si/jira.issueviews:issue-xml/PROJECT-123/PROJECT-123.xml
     ```

2. **Change Detection**:
   - Caches previous XML data
   - Compares with new data
   - Identifies specific changes

## 3. Notification System Deep Dive 🔔

Handles user notifications about task changes.

```javascript:extension/notification-manager.js
class NotificationManager {
    constructor() {
        // Queue to prevent notification spam
        this.notificationQueue = [];
        
        // Track if we're showing notifications
        this.isProcessing = false;
        
        // Store user preferences
        this.preferences = {
            enabled: true,
            sound: false,
            grouping: true
        };
    }

    async addNotification(update) {
        // Create notification object
        const notification = this.createNotification(update);

        // Try to group similar notifications
        if (this.preferences.grouping) {
            const grouped = this.tryGroupNotification(notification);
            if (grouped) return;
        }

        this.notificationQueue.push(notification);
        
        // Start processing if not already running
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    createNotification(update) {
        return {
            id: Date.now(),
            taskKey: update.taskKey,
            title: this.createTitle(update),
            message: this.createMessage(update),
            type: update.changes.type,
            timestamp: new Date(),
            groupId: update.taskKey
        };
    }

    tryGroupNotification(notification) {
        // Look for recent similar notifications
        const similar = this.notificationQueue.find(n => 
            n.groupId === notification.groupId &&
            (notification.timestamp - n.timestamp) < 300000 // 5 minutes
        );

        if (similar) {
            // Update existing notification
            similar.message = this.createGroupMessage(similar, notification);
            return true;
        }

        return false;
    }

    async processQueue() {
        if (!this.preferences.enabled) return;

        this.isProcessing = true;

        while (this.notificationQueue.length > 0) {
            const notification = this.notificationQueue.shift();
            
            await this.showNotification(notification);
            
            // Wait between notifications
            await new Promise(resolve => 
                setTimeout(resolve, 3000)
            );
        }

        this.isProcessing = false;
    }
}
```

### How It Works:
1. **Queue Management**:
   - Prevents notification overflow
   - Groups related notifications
   - Spaces out notifications

2. **Smart Grouping**:
   - Combines updates from same task
   - Reduces notification fatigue
   - Shows summary of changes

## 4. Task Manager Integration 🔄

Coordinates all components together.

```javascript:extension/task-manager.js
class TaskManager {
    constructor() {
        this.pollingManager = new PollingManager();
        this.xmlManager = new XMLManager();
        this.notificationManager = new NotificationManager();
        this.storageManager = new StorageManager();
        
        // Track active tasks
        this.activeTasks = new Map();
        
        // Initialize from storage
        this.initialize();
    }

    async initialize() {
        // Load saved tasks
        const saved = await this.storageManager.loadTasks();
        
        // Restart monitoring for each task
        for (const [taskId, taskData] of Object.entries(saved)) {
            await this.resumeTask(taskId, taskData);
        }
    }

    async addTask(taskUrl) {
        const taskId = this.extractTaskId(taskUrl);
        
        // Validate task exists
        await this.validateTask(taskUrl);
        
        // Create task object
        const task = {
            url: taskUrl,
            added: Date.now(),
            lastCheck: null,
            status: 'active'
        };

        // Save to storage
        await this.storageManager.saveTask(taskId, task);
        
        // Start monitoring
        await this.startMonitoring(taskId, task);
        
        return taskId;
    }

    async startMonitoring(taskId, task) {
        const monitor = async () => {
            try {
                const result = await this.xmlManager.fetchTaskXML(task.url);
                
                if (result.changed) {
                    await this.handleChanges(taskId, result);
                }

                // Schedule next check
                const nextInterval = this.pollingManager.getTaskInterval(taskId);
                setTimeout(monitor, nextInterval);
                
            } catch (error) {
                this.handleError(taskId, error);
            }
        };

        // Start initial monitoring
        monitor();
    }
}
```

### How It Works:
1. **Task Lifecycle**:
   - Adds new tasks
   - Resumes saved tasks
   - Handles task updates

2. **Error Recovery**:
   - Retries failed requests
   - Saves task state
   - Maintains monitoring

Would you like me to explain any specific part in more detail? 😊 