# Jira Webhooks Integration Guide

## What are Jira Webhooks?
Jira webhooks are HTTP callbacks that provide real-time notifications when specific events occur in Jira. Instead of polling for changes, webhooks push notifications to our service when changes happen.

## Webhook Events
Jira supports the following webhook events:

1. **Issue Related**
```json
{
    "webhookEvent": "jira:issue_updated",
    "issue": {
        "id": "10002",
        "key": "PROJECT-123",
        "fields": {
            "summary": "Task summary",
            "status": {
                "name": "In Progress"
            },
            "assignee": {
                "displayName": "John Doe"
            }
            // ... other fields
        }
    },
    "changelog": {
        "items": [
            {
                "field": "status",
                "fromString": "To Do",
                "toString": "In Progress"
            }
        ]
    }
}
```

2. **Common Event Types**
   - `jira:issue_created`
   - `jira:issue_updated`
   - `jira:issue_deleted`
   - `jira:worklog_updated`
   - `comment_created`
   - `comment_updated`
   - `comment_deleted`

## Implementation Architecture

### 1. Backend Webhook Handler
```python:backend/webhook_handler.py
from fastapi import FastAPI, Request, HTTPException
import hmac
import hashlib

app = FastAPI()

class WebhookHandler:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key

    async def verify_signature(self, request: Request) -> bool:
        signature = request.headers.get('X-Jira-Webhook-Signature')
        payload = await request.body()
        
        expected_signature = hmac.new(
            self.secret_key.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)

    @app.post("/webhook/jira")
    async def handle_webhook(self, request: Request):
        if not await self.verify_signature(request):
            raise HTTPException(status_code=401, detail="Invalid signature")

        payload = await request.json()
        await self.process_webhook_event(payload)

    async def process_webhook_event(self, payload: dict):
        event_type = payload.get('webhookEvent')
        issue = payload.get('issue')
        
        if not event_type or not issue:
            raise HTTPException(status_code=400, detail="Invalid payload")

        # Process different event types
        handlers = {
            'jira:issue_created': self.handle_issue_created,
            'jira:issue_updated': self.handle_issue_updated,
            'jira:issue_deleted': self.handle_issue_deleted
        }

        handler = handlers.get(event_type)
        if handler:
            await handler(issue, payload.get('changelog'))
```

### 2. WebSocket Notification System
```python:backend/websocket_manager.py
from fastapi import WebSocket
from typing import Dict, Set

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, task_id: str, websocket: WebSocket):
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = set()
        self.active_connections[task_id].add(websocket)

    async def disconnect(self, task_id: str, websocket: WebSocket):
        self.active_connections[task_id].remove(websocket)
        if not self.active_connections[task_id]:
            del self.active_connections[task_id]

    async def broadcast_update(self, task_id: str, message: dict):
        if task_id in self.active_connections:
            for connection in self.active_connections[task_id]:
                await connection.send_json(message)
```

### 3. Chrome Extension Integration
```javascript:background/webhook-client.js
class WebhookClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        this.ws = new WebSocket('wss://your-backend/ws');
        
        this.ws.onmessage = (event) => {
            const update = JSON.parse(event.data);
            this.handleUpdate(update);
        };

        this.ws.onclose = () => {
            this.handleDisconnect();
        };
    }

    handleUpdate(update) {
        // Process the update based on type
        switch (update.type) {
            case 'issue_updated':
                this.processIssueUpdate(update.data);
                break;
            case 'issue_deleted':
                this.processIssueDeletion(update.data);
                break;
            // ... handle other update types
        }
    }

    async processIssueUpdate(data) {
        // Update local storage
        await chrome.storage.local.set({
            [`task_${data.key}`]: data
        });

        // Notify user if needed
        if (this.shouldNotifyUser(data)) {
            this.showNotification(data);
        }
    }
}
```

## Setting Up Jira Webhooks

### 1. Jira Configuration
1. Navigate to Jira Settings → System → WebHooks
2. Click "Create WebHook"
3. Configure:
```json
{
    "name": "Task Tracker Webhook",
    "url": "https://your-backend/webhook/jira",
    "events": [
        "jira:issue_created",
        "jira:issue_updated",
        "jira:issue_deleted"
    ],
    "filters": {
        "issue-related-events-section": "true"
    }
}
```

### 2. Security Considerations

1. **Authentication**
```python:backend/auth.py
def generate_webhook_secret():
    return secrets.token_hex(32)

def validate_webhook_request(request, secret):
    // Implement HMAC validation
    received_signature = request.headers.get('X-Jira-Webhook-Signature')
    computed_signature = compute_hmac(request.body, secret)
    return hmac.compare_digest(received_signature, computed_signature)
```

2. **Rate Limiting**
```python:backend/rate_limiter.py
from fastapi import HTTPException
from redis import Redis
import time

class RateLimiter:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.rate_limit = 100  // requests per minute

    async def check_rate_limit(self, ip: str):
        current = int(time.time())
        key = f"rate_limit:{ip}:{current // 60}"
        
        count = self.redis.incr(key)
        self.redis.expire(key, 60)
        
        if count > self.rate_limit:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

### 3. Error Handling

```python:backend/error_handler.py
class WebhookErrorHandler:
    def __init__(self):
        self.error_counts = {}
        self.error_threshold = 5

    async def handle_error(self, webhook_id: str, error: Exception):
        if webhook_id not in self.error_counts:
            self.error_counts[webhook_id] = {
                'count': 0,
                'first_error': time.time()
            }

        self.error_counts[webhook_id]['count'] += 1

        if self.should_disable_webhook(webhook_id):
            await self.disable_webhook(webhook_id)
            await self.notify_admin(webhook_id, error)
```

## Benefits of Using Webhooks

1. **Real-time Updates**
   - Immediate notification of changes
   - No polling overhead
   - Reduced server load

2. **Efficiency**
   - Only process actual changes
   - Minimal latency
   - Better resource utilization

3. **Scalability**
   - Handles multiple tasks efficiently
   - Easy to add new event types
   - Distributed processing capability

## Potential Challenges and Solutions

1. **Webhook Reliability**
   - Implement retry mechanism
   - Store failed webhooks in queue
   - Monitor webhook health

2. **Data Consistency**
   - Implement idempotency
   - Version tracking
   - Periodic full sync

3. **Performance**
   - Queue system for high load
   - Batch processing
   - Caching layer

Would you like me to elaborate on any specific aspect of Jira webhooks or provide more implementation details? 