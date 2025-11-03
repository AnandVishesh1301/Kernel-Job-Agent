// Kernel app entrypoint: registers the 'fill_job_form' action and runs a minimal autofill via Playwright
import Kernel, { type KernelContext } from '@onkernel/sdk';
import { chromium } from 'playwright';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import type { Page, Frame } from 'playwright';

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

function splitName(full?: string | null): { first: string; last: string } {
  const f = (full || '').trim();
  if (!f) return { first: '', last: '' };
  const parts = f.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function deriveAddressParts(address?: string | null): { city?: string; state?: string; postal?: string; country?: string } {
  const out: { city?: string; state?: string; postal?: string; country?: string } = {};
  if (!address) return out;
  const parts = address.split(',').map(s => s.trim());
  if (parts.length >= 1) out.city = parts[0];
  if (parts.length >= 2) out.state = parts[1];
  if (parts.length >= 3) out.postal = parts[2].match(/[A-Za-z0-9\-\s]+/)?.[0]?.trim();
  return out;
}

async function smartAutofill(target: Page | Frame, input: Input, notes: string[]): Promise<void> {
  try {
    const { first, last } = splitName(input.profile.name);
    const links = Array.isArray(input.profile.links) ? (input.profile.links as string[]) : [];
    const linkedin = links.find(u => /linkedin\.com/i.test(u));
    const github = links.find(u => /github\.com/i.test(u));
    const website = links.find(u => !/linkedin|github/i.test(u));
    const addrParts = deriveAddressParts(input.profile.address);
    const edu = Array.isArray(input.profile.education) && input.profile.education.length > 0 ? input.profile.education[0] : undefined;
    const exp = Array.isArray(input.profile.experience) && input.profile.experience.length > 0 ? input.profile.experience[0] : undefined;

    const valueByKeyword: Record<string, string | undefined> = {
      'first name': first,
      'firstname': first,
      'given': first,
      'last name': last,
      'lastname': last,
      'surname': last,
      'family name': last,
      'full name': input.profile.name || undefined,
      'name': input.profile.name || undefined,
      'email': input.profile.email || undefined,
      'phone': input.profile.phone || undefined,
      'mobile': input.profile.phone || undefined,
      'telephone': input.profile.phone || undefined,
      'linkedin': linkedin,
      'github': github,
      'portfolio': website,
      'website': website,
      'url': website,
      'address': input.profile.address || undefined,
      'street': input.profile.address || undefined,
      'city': addrParts.city,
      'town': addrParts.city,
      'state': addrParts.state,
      'province': addrParts.state,
      'zip': addrParts.postal,
      'postal': addrParts.postal,
      'country': (input.prefs as any)?.country || undefined,
      'school': edu?.school,
      'university': edu?.school,
      'college': edu?.school,
      'degree': edu?.degree,
      'company': exp?.company,
      'employer': exp?.company,
      'title': exp?.title,
      'position': exp?.title,
    };

    const elements = await (target as any).$$('input, textarea, select');
    for (const el of elements as any[]) {
      try {
        const visible = await el.isVisible?.();
        const disabled = await el.isDisabled?.();
        if (visible === false || disabled === true) continue;
        const tag = (await el.evaluate((e: any) => e.tagName.toLowerCase())) as string;
        if (tag === 'input') {
          const type = (await el.getAttribute('type')) || 'text';
          if (['submit', 'button', 'hidden'].includes(type)) continue;
          if (type === 'file') continue; // handled elsewhere
        }
        const nameAttr = (await el.getAttribute('name')) || '';
        const idAttr = (await el.getAttribute('id')) || '';
        const placeholder = (await el.getAttribute('placeholder')) || '';
        const aria = (await el.getAttribute('aria-label')) || '';
        const labelText = await el.evaluate((e: any) => {
          // get <label for=id> text or closest label ancestor
          const id = e.getAttribute('id');
          if (id) {
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) return (lbl as HTMLElement).innerText;
          }
          let parent: any = e.parentElement;
          while (parent) {
            if (parent.tagName && parent.tagName.toLowerCase() === 'label') return parent.innerText;
            parent = parent.parentElement;
          }
          return '';
        });
        const haystack = `${nameAttr} ${idAttr} ${placeholder} ${aria} ${labelText}`.toLowerCase();

        // date handling
        const dateValue = (key: 'start' | 'end') => {
          const raw = key === 'start' ? exp?.start || edu?.start : exp?.end || edu?.end;
          if (!raw) return undefined;
          const m = String(raw).match(/\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4}/);
          return m ? m[0] : String(raw);
        };

        let filled = false;
        for (const [k, v] of Object.entries(valueByKeyword)) {
          if (!v) continue;
          if (haystack.includes(k)) {
            if (tag === 'select') {
              await el.selectOption({ label: v }).catch(async () => {
                await el.selectOption(v).catch(() => {});
              });
            } else {
              await el.fill(v).catch(() => {});
            }
            notes.push(`Smart filled ${k}`);
            filled = true;
            break;
          }
        }

        if (!filled) {
          // Generic date start/end
          if (/start date|start|from/.test(haystack)) {
            const v = dateValue('start');
            if (v) { await el.fill(v).catch(() => {}); notes.push('Filled start date'); continue; }
          }
          if (/end date|end|to/.test(haystack)) {
            const v = dateValue('end');
            if (v) { await el.fill(v).catch(() => {}); notes.push('Filled end date'); continue; }
          }
        }

        // Yes/No radios from prefs
        if (tag !== 'select' && /work authorization|sponsorship|work auth|require sponsorship/.test(haystack)) {
          const want = (input.prefs as any)?.work_auth || input.profile.work_auth || 'No';
          const lbl = await (target as any).$(`label:has-text("${String(want)}")`);
          await lbl?.click().catch(() => {});
        }
      } catch {}
    }
  } catch (e) {
    notes.push(`Smart autofill error: ${String(e)}`);
  }
}

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
      try { await el.fill(value); notes?.push(`Filled ${sel}`); return; } catch {}
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
    await page.waitForTimeout(1500);

    // Many Greenhouse forms are embedded in an iframe (boards.greenhouse.io)
    // Try to target the iframe if present, otherwise fall back to the main page
    const ghFrame = page.frames().find(f => /greenhouse\.io|boards\.greenhouse\.io/i.test(f.url()));
    const target = ghFrame ?? page;
    if (ghFrame) notes.push(`Detected Greenhouse iframe: ${ghFrame.url()}`);

    const firstName = input.profile.name?.split(' ')[0] || input.profile.name || '';
    const lastName = (input.profile.name?.split(' ').slice(1).join(' ') || '').trim();

    // Fill common Greenhouse fields inside frame or page
    try {
      await target.fill?.('input[name="first_name"], #first_name', firstName).catch(() => {});
      if (firstName) notes.push('Filled first_name');
    } catch {}
    try {
      if (lastName) {
        await target.fill?.('input[name="last_name"], #last_name', lastName).catch(() => {});
        notes.push('Filled last_name');
      }
    } catch {}
    try {
      if (input.profile.email) {
        await target.fill?.('input[name="email"], #email, input[type="email"]', input.profile.email).catch(() => {});
        notes.push('Filled email');
      }
    } catch {}
    try {
      if (input.profile.phone) {
        await target.fill?.('input[name="phone"], #phone, input[type="tel"]', input.profile.phone).catch(() => {});
        notes.push('Filled phone');
      }
    } catch {}

    // Heuristic mapping for common additional fields
    const links = Array.isArray(input.profile.links) ? input.profile.links as string[] : [];
    const linkedin = links.find(u => /linkedin\.com/i.test(u));
    const github = links.find(u => /github\.com/i.test(u));
    const website = links.find(u => !/linkedin|github/i.test(u));

    async function fillByLabel(texts: string[], value?: string) {
      if (!value) return false;
      for (const t of texts) {
        try {
          // Try associated input/textarea/select under label
          const lbl = await target.$(`label:has-text("${t}")`);
          if (lbl) {
            const forAttr = await lbl.getAttribute('for');
            if (forAttr) {
              const inp = await target.$(`#${forAttr}`);
              if (inp) {
                await inp.fill(value);
                notes.push(`Filled by label ${t}`);
                return true;
              }
            }
            const nested = await lbl.$('input, textarea, select');
            if (nested) {
              const tag = await nested.evaluate(el => el.tagName.toLowerCase());
              if (tag === 'select') {
                await (nested as any).selectOption({ label: value }).catch(async () => (nested as any).selectOption(value).catch(() => {}));
              } else {
                await (nested as any).fill(value);
              }
              notes.push(`Filled by nested label ${t}`);
              return true;
            }
          }
        } catch {}
      }
      return false;
    }

    // Fill common link fields
    await fillByLabel(['LinkedIn', 'LinkedIn Profile'], linkedin);
    await fillByLabel(['GitHub', 'Github'], github);
    await fillByLabel(['Website', 'Portfolio', 'Personal Website'], website);

    // Address and location-like fields
    await fillByLabel(['Address', 'Street'], input.profile.address);
    // If parsed profile had city/state/zip, add here when available

    // Education and Experience (best-effort, single-line)
    const edu = Array.isArray(input.profile.education) && input.profile.education.length > 0 ? input.profile.education[0] : undefined;
    const exp = Array.isArray(input.profile.experience) && input.profile.experience.length > 0 ? input.profile.experience[0] : undefined;
    await fillByLabel(['School', 'University', 'College'], edu?.school);
    await fillByLabel(['Degree', 'Qualification'], edu?.degree);
    await fillByLabel(['Company', 'Employer'], exp?.company);
    await fillByLabel(['Title', 'Job Title', 'Position'], exp?.title);

    // Preferences (EEO-like) best-effort based on provided prefs
    if (input.prefs && typeof input.prefs === 'object') {
      const prefs = input.prefs as Record<string, any>;
      async function selectRadioByLabel(questionLabels: string[], answerText?: string) {
        if (!answerText) return;
        for (const q of questionLabels) {
          try {
            const qEl = await target.$(`text=${q}`);
            if (qEl) {
              const opt = await target.$(`label:has-text("${answerText}")`);
              if (opt) { await opt.click().catch(() => {}); notes.push(`Selected ${answerText} for ${q}`); return; }
            }
          } catch {}
        }
      }
      await selectRadioByLabel(['Gender', 'Sex'], prefs['gender'] as string);
      await selectRadioByLabel(['Veteran'], prefs['veteran'] as string);
      await selectRadioByLabel(['Disability'], prefs['disability'] as string);
      await selectRadioByLabel(['Work Authorization', 'Work authorisation'], prefs['work_auth'] as string || (input.profile.work_auth as string | undefined));
    }

    // Run smart autofill across remaining fields
    await smartAutofill(target, input, notes);

    // Resume upload (download to temp file and attach to file input inside GH iframe)
    if (input.r2Assets?.resumeUrl) {
      try {
        const res = await fetch(input.r2Assets.resumeUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const tmp = path.join(os.tmpdir(), `resume-${Date.now()}.pdf`);
        await fs.writeFile(tmp, buf);
        const fileInput = await target.$('input[type="file"]');
        if (fileInput) {
          // setInputFiles via Playwright element handle
          await (fileInput as any).setInputFiles(tmp);
          notes.push('Uploaded resume from R2');
        } else {
          notes.push('No file input found for resume upload');
        }
      } catch (e) {
        notes.push(`Resume upload failed: ${String(e)}`);
      }
    }

    // Try to submit the application if a submit button is visible
    try {
      const submitBtn = await target.$('button[type="submit"], button:has-text("Submit Application"), input[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        notes.push('Clicked submit');
      }
    } catch {}

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

app.action('fill_job_form', async (ctx: KernelContext, payload?: Input): Promise<Output> => {
  const notes: string[] = [];
  
  if (!payload) {
    return {
      status: 'failed',
      summary: 'Missing required input payload',
      screenshots: [],
      notes: ['No input provided'],
    };
  }
  
  const input = payload;

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


