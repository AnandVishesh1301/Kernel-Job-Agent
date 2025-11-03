// Kernel app entrypoint: registers the 'fill_job_form' action and runs a minimal autofill via Playwright
import Kernel, { type KernelContext } from '@onkernel/sdk';
import { chromium, Page } from 'playwright';

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
  if (u.includes('greenhouse.io') || u.includes('gh_jid=')) return 'greenhouse';
  if (u.includes('lever.co')) return 'lever';
  if (u.includes('myworkdayjobs.com') || u.includes('workday')) return 'workday';
  return 'generic';
}

async function tryFill(page: Page, selectors: string[], value?: string | null, notes?: string[]) {
  if (!value) return;
  for (const sel of selectors) {
      const el = await page.$(sel);
    if (el) {
      try { await el.fill(value); notes && notes.push(`Filled ${sel}`); return; } catch {}
    }
  }
}

async function genericStrategy(page: Page, input: Input, notes: string[]): Promise<void> {
  try {
    await tryFill(page, ['input[placeholder*="Name" i]', 'input[name*="name" i]'], input.profile.name, notes);
    await tryFill(page, ['input[type="email"]', 'input[name*="email" i]'], input.profile.email, notes);
    await tryFill(page, ['input[type="tel"]', 'input[name*="phone" i]'], input.profile.phone, notes);
  } catch (e) {
    notes.push(`Field fill error: ${String(e)}`);
  }
  if (input.r2Assets?.resumeUrl) {
    notes.push(`Resume available at: ${input.r2Assets.resumeUrl}`);
  }
}

async function greenhouseStrategy(page: Page, input: Input, notes: string[]): Promise<void> {
  // Click an Apply button/link then fill standard GH fields
  try {
    // Common Apply triggers
    const applySelectors = [
      'a:has-text("Apply")',
      'button:has-text("Apply")',
      'a:has-text("Apply for this job")',
      'button:has-text("Apply for this job")'
    ];
    for (const sel of applySelectors) {
      const el = await page.$(sel);
      if (el) { await el.click(); notes.push(`Clicked ${sel}`); break; }
    }
    // Wait for potential iframe/modal load
    await page.waitForTimeout(1000);

    // Fill common Greenhouse fields
    await tryFill(page, ['input[name="first_name"]', 'input#first_name'], input.profile.name?.split(' ')[0] || input.profile.name, notes);
    await tryFill(page, ['input[name="last_name"]', 'input#last_name'], input.profile.name?.split(' ').slice(1).join(' '), notes);
    await tryFill(page, ['input[name="email"]', 'input#email', 'input[type="email"]'], input.profile.email, notes);
    await tryFill(page, ['input[name="phone"]', 'input#phone', 'input[type="tel"]'], input.profile.phone, notes);

    // Resume upload placeholders (real upload requires signed PUT->file path mapping)
    if (input.r2Assets?.resumeUrl) {
      notes.push(`Resume available at: ${input.r2Assets.resumeUrl}`);
    }
  } catch (e) {
    notes.push(`Greenhouse flow error: ${String(e)}`);
  }
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
    let ats = detectAts(input.url);

    // Heuristic: detect Greenhouse embeds by script URLs/text on page
    const content = await page.content();
    if (content.includes('greenhouse.io') || content.includes('boards.greenhouse.io')) {
      ats = 'greenhouse';
    }
    notes.push(`Detected ATS: ${ats}`);

    if (ats === 'greenhouse') {
      await greenhouseStrategy(page, input, notes);
    } else {
      await genericStrategy(page, input, notes);
    }

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


