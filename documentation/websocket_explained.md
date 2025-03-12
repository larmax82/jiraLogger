# Understanding WebSocket Connections in Jira Task Tracker

## What are WebSockets? 🤔

Think of WebSockets like a phone call between your Chrome extension and the server:
- Regular HTTP is like sending letters back and forth (polling every 15 minutes)
- WebSocket is like having an open phone line where both sides can talk instantly

### Visual Comparison
```mermaid
graph TD
    subgraph "Old Way: Polling"
        A1[Extension] -->|"Are there updates?"| B1[Server]
        B1 -->|"No updates"| A1
        A1 -->|"Are there updates?"| B1
        B1 -->|"Yes, here's an update!"| A1
    end
```

```mermaid
graph LR
    subgraph "New Way: WebSocket"
        A2[Extension] <-->|"Open Connection"| B2[Server]
        B2 -->|"Instant update!"| A2
    end
``` 