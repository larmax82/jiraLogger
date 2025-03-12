// Configuration
const CONFIG = {
  PROJECT_ID: 'your-project-id',
  DATASET_ID: 'url_saver',
  TABLE_ID: 'saved_urls',
  MAX_RETRY_ATTEMPTS: 3
};

// Simple event-based service
class BigQueryService {
  constructor() {
    this.setupMessageListeners();
  }

  // Set up listeners for user actions
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'saveCurrentUrl':
          this.handleSaveUrl(sendResponse);
          break;
        case 'getRecentUrls':
          this.handleGetRecentUrls(sendResponse);
          break;
      }
      return true; // Keep channel open for async response
    });
  }

  // Handle save URL request
  async handleSaveUrl(sendResponse) {
    try {
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const urlData = {
        url: tab.url,
        title: tab.title,
        saved_timestamp: new Date().toISOString(),
        user_id: 'default_user' // Or implement user identification
      };

      // Save to BigQuery
      await this.saveUrlToBigQuery(urlData);
      sendResponse({ success: true, message: 'URL saved successfully' });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  // Handle get recent URLs request
  async handleGetRecentUrls(sendResponse) {
    try {
      const urls = await this.queryRecentUrls();
      sendResponse({ success: true, data: urls });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  // BigQuery operations
  async saveUrlToBigQuery(urlData) {
    const accessToken = await this.getAccessToken();
    const endpoint = `https://bigquery.googleapis.com/bigquery/v2/projects/${CONFIG.PROJECT_ID}/datasets/${CONFIG.DATASET_ID}/tables/${CONFIG.TABLE_ID}/insertAll`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rows: [{ json: urlData }]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save URL to BigQuery');
    }
  }

  async queryRecentUrls() {
    const accessToken = await this.getAccessToken();
    const query = `
      SELECT url, title, saved_timestamp
      FROM \`${CONFIG.PROJECT_ID}.${CONFIG.DATASET_ID}.${CONFIG.TABLE_ID}\`
      ORDER BY saved_timestamp DESC
      LIMIT 10
    `;

    // Execute BigQuery query
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${CONFIG.PROJECT_ID}/queries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch recent URLs');
    }

    const result = await response.json();
    return result.rows || [];
  }

  // Simple token management
  async getAccessToken() {
    const credentials = await chrome.storage.local.get('bigquery_credentials');
    if (!credentials.bigquery_credentials) {
      throw new Error('BigQuery credentials not found');
    }
    return credentials.bigquery_credentials.access_token;
  }
}

// Initialize service when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  new BigQueryService();
}); 