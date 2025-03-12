# Chrome Extension Plan: URL to BigQuery Saver

## Overview
A Chrome extension that saves the current tab's URL to BigQuery database and displays the last 10 saved entries.

## 1. Extension Structure Setup
- `manifest.json` (extension configuration)
- `popup.html` (UI for the extension)
- `popup.js` (main logic)
- `background.js` (background processes)
- `styles.css` (styling)

## 2. Required Permissions
- Tabs access (for current URL)
- Storage (for API credentials)
- Google Cloud Platform project setup
- BigQuery API access

## 3. Implementation Steps

### A. Initial Setup

#### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "url-saver-extension")
5. Click "Create"
6. Wait for the project to be created and select it as your current project

#### 2. Enable BigQuery API
1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "BigQuery API"
3. Click on "BigQuery API" in the results
4. Click "Enable"
5. Wait for the API to be enabled

#### 3. Create Service Account & Get Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: "url-saver-bigquery"
   - Description: "Service account for Chrome extension to access BigQuery"
4. Click "Create and Continue"
5. Add roles:
   - Select "BigQuery" > "BigQuery Data Editor"
   - Select "BigQuery" > "BigQuery Job User"
6. Click "Continue" and then "Done"
7. In the service accounts list, click on your new service account
8. Go to the "Keys" tab
9. Click "Add Key" > "Create new key"
10. Choose "JSON" format
11. Click "Create" - this will download your key file
12. Store this file securely - you'll need it for the extension
13. Import the JSON key file in your extension:
    - Add an option in the extension settings to import credentials
    - Use the importServiceAccountKey function to process and store the key
    - Implement secure storage using chrome.storage.local
14. Test authentication:
    - Verify token generation
    - Verify BigQuery API access
    - Test token refresh flow

#### 4. Create BigQuery Dataset and Table
1. Go to the [BigQuery Console](https://console.cloud.google.com/bigquery)
2. In the Explorer panel, click on your project name
3. Click "Create Dataset"
4. Configure the dataset:
   ```
   Dataset ID: url_saver
   Data location: Choose your preferred location
   ```
5. Click "Create Dataset"
6. Select your new dataset
7. Click "Create Table"
8. Configure the table:
   ```
   Table name: saved_urls
   Schema:
   - url (STRING, REQUIRED)
   - title (STRING, REQUIRED)
   - saved_timestamp (TIMESTAMP, REQUIRED)
   - user_id (STRING, REQUIRED)
   ```
9. Create the table using this SQL query in the BigQuery console:
   ```sql
   CREATE TABLE `your-project-id.url_saver.saved_urls` (
     url STRING NOT NULL,
     title STRING NOT NULL,
     saved_timestamp TIMESTAMP NOT NULL,
     user_id STRING NOT NULL
   );
   ```

#### 5. Security Setup
1. Create a `.gitignore` file in your extension project to exclude sensitive files:
   ```
   # Sensitive files
   credentials.json
   .env
   ```
2. Create a secure location in your extension to store the credentials
3. Set up environment variables for development

#### 6. Initial Testing
1. Test BigQuery access using the BigQuery console:
   ```sql
   -- Test insert
   INSERT INTO `your-project-id.url_saver.saved_urls`
   (url, title, saved_timestamp, user_id)
   VALUES
   ('https://example.com', 'Test Title', CURRENT_TIMESTAMP(), 'test_user');

   -- Test query
   SELECT * FROM `your-project-id.url_saver.saved_urls`
   ORDER BY saved_timestamp DESC
   LIMIT 1;
   ```

### B. Extension Components

#### manifest.json configuration
```json
{
  "manifest_version": 3,
  "name": "URL to BigQuery Saver",
  "version": "1.0",
  "permissions": [
    "tabs",
    "storage"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  }
}
```

#### Popup UI (popup.html)
- Save button
- List of recent URLs
- Loading indicator
- Error messages area

#### Background Service (background.js)

The background service handles communication between the popup UI and BigQuery API, operating on user-triggered events only.

##### 1. Service Structure
**Purpose:**
- Handles user-triggered operations
- Manages configuration settings
- Provides BigQuery API access

**How it works:**
- Responds to user actions (button clicks)
- Performs one-time operations
- No continuous background processes

**Important considerations:**
- Minimal memory usage
- Clean up after each operation
- Simple configuration management

```javascript
// Configuration
const CONFIG = {
  PROJECT_ID: 'your-project-id',
  DATASET_ID: 'url_saver',
  TABLE_ID: 'saved_urls',
  MAX_RETRY_ATTEMPTS: 3
};
```

##### 2. Authentication Management
**Purpose:**
- Securely stores BigQuery credentials
- Provides authenticated access to BigQuery API

**How it works:**
- Uses Chrome's storage API for secure credential storage
- Simple token management
- No automatic refresh (manual re-authentication if needed)

**Important considerations:**
- Secure credential storage
- Clear error messages for authentication issues
- Simple re-authentication process

##### 3. BigQuery API Integration
**Purpose:**
- Handles direct communication with BigQuery
- Manages data operations (insert/query)

**How it works:**
- REST API calls to BigQuery
- Direct response handling
- Simple error management

**Important considerations:**
- Validate data before sending
- Handle API errors gracefully
- Clear user feedback

##### 4. Message Handling
**Purpose:**
- Manages communication between popup and background service
- Handles two main actions: save URL and get recent URLs

**How it works:**
- Listens for specific user actions
- Processes requests synchronously
- Returns results immediately

**Important considerations:**
- Clear message structure
- Proper error handling
- Simple response format

```javascript
// Example message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'saveCurrentUrl':
      handleSaveUrl(sendResponse);
      break;
    case 'getRecentUrls':
      handleGetRecentUrls(sendResponse);
      break;
  }
  return true; // Keep channel open for async response
});
```

##### 5. Error Handling
**Purpose:**
- Manages operation failures
- Provides clear user feedback

**How it works:**
- Simple error categorization
- Direct error reporting
- Basic retry for network issues

**Important considerations:**
- Clear error messages
- Simple retry strategy
- User-friendly feedback

## 4. Main Features Implementation

### A. URL Saving Process
- Get current tab URL and title
- Format data for BigQuery
- Send to BigQuery using REST API
- Show success/error notification

### B. URL Retrieval Process
- Query BigQuery for last 10 entries
- Cache results locally
- Update UI with results
- Implement refresh mechanism

## 5. Security Considerations
- Secure storage of API credentials
- Rate limiting for API calls
- Error handling
- Data validation

## 6. User Experience
- Loading indicators
- Error messages
- Smooth animations
- Responsive design

## 7. Testing Plan
- Unit tests for core functions
- Integration tests with BigQuery
- UI/UX testing
- Error scenario testing

## 8. Deployment Steps
- Package extension
- Test in Chrome
- Upload to Chrome Web Store
- Documentation

## Requirements
- Google Cloud Platform account
- BigQuery enabled project
- Service account with appropriate permissions
- Chrome browser for development and testing 