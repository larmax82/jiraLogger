# Jira Task Tracker - System Design Document

## Overview
A Google Cloud Run application that monitors Jira tasks through XML endpoints, extracts configurable data points using XPath, and stores the information in BigQuery. The system provides both API endpoints and a web interface for management.

## System Architecture

### Components
1. **Cloud Run Service**
   - Main application service
   - Handles both scheduled monitoring and user interfaces
   - Authenticates with Jira using API tokens
   - Uses Google Cloud authentication for web/API access

2. **BigQuery Database**
   - Tables:
     * `xpath_configs`: Stores XPath expressions for data extraction
     * `monitored_tasks`: Tracks Jira tasks being monitored
     * `extracted_data`: Stores the actual data points extracted from tasks

3. **Cloud Scheduler**
   - Triggers the monitoring function every 15 minutes
   - Runs 24/7

4. **Web Interface & API**
   - Protected by Google Cloud authentication
   - Manages:
     * XPath configurations
     * Task monitoring list
     * Data viewing and management

## Data Flow
1. **Task Monitoring**
   - Cloud Scheduler triggers monitoring function
   - Function fetches XML for each active task
   - Applies configured XPath expressions
   - Compares with previous data
   - Updates BigQuery if changes detected

2. **Task Lifecycle**
   - New tasks added via API or web interface
   - Regular monitoring until "deployed PD" status
   - Tasks marked as completed but retained in database

## Database Schema

### xpath_configs
- xpath_id: STRING
- description: STRING
- xpath_expression: STRING
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

### monitored_tasks
- task_id: STRING
- jira_key: STRING
- status: STRING
- is_completed: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

### extracted_data
- data_id: STRING
- task_id: STRING
- xpath_id: STRING
- value: STRING
- timestamp: TIMESTAMP

## Error Handling
- All errors logged for monitoring
- Retry mechanism for temporary Jira API issues
- Validation for XPath expressions
- Error notifications for critical issues

## Security
- Google Cloud authentication for web/API access
- Secure storage of Jira API credentials
- Role-based access control through Google Cloud IAM

## Implementation Phases

### Phase 1: Core Infrastructure
- Set up Google Cloud project
- Create BigQuery tables
- Basic Cloud Run service with Jira integration

### Phase 2: Monitoring System
- XML fetching and parsing
- XPath extraction implementation
- Data comparison logic
- BigQuery integration

### Phase 3: Management Interface
- API endpoints implementation
- Web interface development
- Authentication integration

### Phase 4: Testing & Deployment
- Error handling implementation
- Performance testing
- Security testing
- Production deployment