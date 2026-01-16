/**
 * Test script for incoming webhook
 * Usage: npx ts-node scripts/test-webhook.ts
 * Or: npx tsx scripts/test-webhook.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_WEBHOOK_SECRET = process.env.TEST_WEBHOOK_SECRET || "f686a0741a441bca72121eeb3f7dcab56b871f08df435ca7162a725e24d3e5e1"
interface WebhookPayload {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  secret: string;
}

async function sendTestEmail(payload: WebhookPayload) {
  const url = `${BASE_URL}/api/webhooks/incoming`;

  console.log("Sending test email to webhook...");
  console.log("URL:", url);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("\n✓ Success!");
      console.log("Response:", JSON.stringify(data, null, 2));
    } else {
      console.log("\n✗ Failed!");
      console.log("Status:", response.status);
      console.log("Error:", JSON.stringify(data, null, 2));
    }

    return data;
  } catch (error) {
    console.error("\n✗ Request failed:", error);
    throw error;
  }
}

// Example usage - modify these values as needed
const testPayload: WebhookPayload = {
  to: "test@example.com",        // Change to your mailbox address
  from: "sender@external.com",
  subject: "Test Email via Webhook",
  text: "This is a plain text test email sent via webhook.",
  html: "<h1>Test Email</h1><p>This is an <strong>HTML</strong> test email sent via webhook.</p>",
  secret: TEST_WEBHOOK_SECRET, // Change to your webhook secret key
};

// Run the test
sendTestEmail(testPayload);
