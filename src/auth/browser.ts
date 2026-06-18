import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface CaptureResult {
  token: string;
  expiresAt?: Date;
}

export interface CaptureOptions {
  studioUrl: string;
  env: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const COOKIE_NAME = "access-token";

function getProfileDir(env: string): string {
  const safe = env.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = join(homedir(), ".prisme-ai-mcp", `browser-profile-${safe}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Open a Chromium window with a persistent profile, navigate to the studio,
 * and poll for the `access-token` cookie. Returns the token value once present.
 *
 * Throws descriptive errors when Playwright is missing, when the Chromium
 * binary is not installed, or when no display is available.
 */
export async function captureAccessToken(
  opts: CaptureOptions
): Promise<CaptureResult> {
  const {
    studioUrl,
    env,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = opts;

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run `npm install` inside the MCP project, then `npx playwright install chromium`."
    );
  }

  const { chromium } = playwright;
  const profileDir = getProfileDir(env);

  let context: import("playwright").BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1200, height: 800 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Executable doesn't exist|browserType.launchPersistentContext/i.test(msg)) {
      throw new Error(
        "Chromium browser is not installed. Run `npx playwright install chromium`."
      );
    }
    if (/DISPLAY|no display|cannot open display/i.test(msg)) {
      throw new Error(
        "Cannot open a browser window — no display available. Run setup.sh manually to update the JWT instead."
      );
    }
    throw err;
  }

  let contextClosed = false;
  context.on("close", () => {
    contextClosed = true;
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(studioUrl, { waitUntil: "domcontentloaded" }).catch(() => {
      // Navigation may be interrupted by redirects (e.g., to auth provider).
      // We keep polling cookies regardless.
    });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (contextClosed) {
        throw new Error("Browser closed before authentication completed.");
      }
      const cookies = await context.cookies();
      const tok = cookies.find(
        (c) => c.name === COOKIE_NAME && c.value && c.value.length > 20
      );
      if (tok) {
        const expiresAt =
          tok.expires && tok.expires > 0
            ? new Date(tok.expires * 1000)
            : undefined;
        return { token: tok.value, expiresAt };
      }
      if (context.pages().length === 0) {
        throw new Error("Browser closed before authentication completed.");
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(
      `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the access-token cookie. Did you complete the login flow?`
    );
  } finally {
    if (!contextClosed) {
      await context.close().catch(() => {});
    }
  }
}
