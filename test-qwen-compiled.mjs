import { QwenWebClient } from "./dist/providers/qwen-web-client.js"; // Requires esbuild

// Captured manually from earlier or from existing options
const mockCookie =
  "b-user-id=test-utdid-1234; tongyi_sso_ticket=dummy-ticket; tongyi_sso_ticket_hash=dummy-hash; XSRF-TOKEN=dummy-xsrf";
const mockXsrf = "dummy-xsrf";
const mockUt = "test-utdid-1234"; // Our extraction logic from auth should have pulled this

const client = new QwenWebClient({
  cookie: mockCookie,
  xsrfToken: mockXsrf,
  ut: mockUt,
});

console.log("=== Testing Mocked QwenWebClient ===");
client
  .chatCompletions({
    sessionId: "test-session",
    message: "Hello!",
    model: "Qwen3.5-Plus",
  })
  .catch((e) => {
    // We expect a FetchError or 401/403 since it's dummy data, but WE WANT THE LOGS
    console.log("Caught expected error:", e.message);
  });
