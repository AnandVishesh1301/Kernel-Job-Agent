// Kernel app entrypoint: registers the 'fill_job_form' action and runs a minimal autofill via Playwright
import Kernel, { type KernelContext } from '@onkernel/sdk';
import { chromium } from 'playwright';

type Profile = {
  name?: string;
  email?: string;
  phone?: string;
  links?: string[];
  education?: Array<{ school?: string; degree?: string; start?: string | null; end?: string | null }>;
  experience?: Array<{ company?: string; title?: string; start?: string | null; end?: string | null; location?: string; bullets?: string[] }>;
  skills?: string[];
  address?: string;
  work_auth?: string | null;
};

type Preferences = Record<string, unknown>;

type Input = {
  url: string;
  profile: Profile;
  prefs?: Preferences;
  r2Assets?: { resumeUrl: string; coverLetterUrl?: string };
  persistenceId?: string;
  steps?: string[];
  takeProofScreenshots?: boolean;
};

type Output = {
  status: 'succeeded' | 'failed';
  summary: string;
  liveViewUrl?: string;
  screenshots?: string[]; // URLs or notes (for now we return notes)
  notes?: string[];
};

function detectAts(url: string): 'greenhouse' | 'lever' | 'workday' | 'generic' {
  const u = url.toLowerCase();
  if (u.includes('greenhouse.io')) return 'greenhouse';
  if (u.includes('lever.co')) return 'lever';
  if (u.includes('myworkdayjobs.com') || u.includes('workday')) return 'workday';
  return 'generic';
}

async function genericStrategy(page: any, input: Input): Promise<string[]> {
  const notes: string[] = [];
  // Best-effort simple selectors; sites vary widely.
  // We keep this intentionally minimal; domain-specific flows should go in dedicated strategies.
  try {
    // Name/email/phone fields (common placeholders)
    if (input.profile.name) {
      const sel = 'input[placeholder*="Name" i], input[name*="name" i]';
      const el = await page.$(sel);
      if (el) { await el.fill(input.profile.name); notes.push('Filled name'); }
    }
    if (input.profile.email) {
      const sel = 'input[type="email"], input[name*="email" i]';
      const el = await page.$(sel);
      if (el) { await el.fill(input.profile.email); notes.push('Filled email'); }
    }
    if (input.profile.phone) {
      const sel = 'input[type="tel"], input[name*="phone" i]';
      const el = await page.$(sel);
      if (el) { await el.fill(input.profile.phone); notes.push('Filled phone'); }
    }
  } catch (e) {
    notes.push(`Field fill error: ${String(e)}`);
  }
  // Resume upload: this requires a file path normally; with a URL we need a signed upload flow.
  // For the MVP, leave as a note; backend will evolve to pass signed PUT/GET URLs.
  if (input.r2Assets?.resumeUrl) {
    notes.push(`Resume available at: ${input.r2Assets.resumeUrl}`);
  }
  return notes;
}

const kernel = new Kernel();
const app = kernel.app('kernel-job-agent');

app.action('fill_job_form', async (ctx: KernelContext, input: Input): Promise<Output> => {
  const notes: string[] = [];

  // Create cloud browser and connect over CDP with Playwright
  const kBrowser = await kernel.browsers.create({
    invocation_id: ctx.invocation_id,
    stealth: true,
  });

  const browser = await chromium.connectOverCDP(kBrowser.cdp_ws_url);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(input.url, { waitUntil: 'domcontentloaded' });
    const ats = detectAts(input.url);
    notes.push(`Detected ATS: ${ats}`);

    await genericStrategy(page, input);

    if (input.takeProofScreenshots) {
      notes.push('Screenshot step available (upload wiring later)');
    }

    return {
      status: 'succeeded',
      summary: 'Navigation and basic autofill completed',
      liveViewUrl: kBrowser.browser_live_view_url,
      screenshots: [],
      notes,
    };
  } catch (e) {
    notes.push(`Error: ${String(e)}`);
    return {
      status: 'failed',
      summary: 'Failed to fill job form',
      liveViewUrl: kBrowser.browser_live_view_url,
      screenshots: [],
      notes,
    };
  } finally {
    try { await browser.close(); } catch {}
  }
});


