import type { StructuredData } from '../../types/crawl';
import type { AddressInfo, ContactInfo, EmailInfo, HoursInfo, PhoneInfo, SocialLink } from '../../types/ssm';
import type { Page } from 'puppeteer';

const SOCIAL_PLATFORMS: Record<string, RegExp> = {
  facebook: /facebook\.com/i,
  twitter: /twitter\.com|x\.com/i,
  instagram: /instagram\.com/i,
  linkedin: /linkedin\.com/i,
  youtube: /youtube\.com/i,
  tiktok: /tiktok\.com/i,
  pinterest: /pinterest\.com/i,
  yelp: /yelp\.com/i,
};

export interface RawContactData {
  telLinks: string[];
  mailtoLinks: string[];
  socialLinks: string[];
  addressText: string | null;
}

/**
 * Safely convert unknown to string (only if primitive)
 */
function safeString(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return void 0;
}

// patterns for placeholder/garbage emails
const GARBAGE_EMAIL_PATTERNS = [
  /^#$/,
  /yourwebsite/i,
  /yourdomain/i,
  /example\.com/i,
  /test@test/i,
  /email@email/i,
  /your-?email/i,
  /info@info/i,
  /sample/i,
  /placeholder/i,
];

/**
 * Check if an email is a valid, non-placeholder address
 */
function isValidEmail(email: string): boolean {
  // basic format check
  if (!email.includes('@') || email.length < 5) return false;

  // check for garbage patterns
  return !GARBAGE_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

/**
 * Extract contact information from page DOM
 */
export async function extractContactFromPage(page: Page): Promise<RawContactData> {
  return page.evaluate(() => {
    const telLinks: string[] = [];
    const mailtoLinks: string[] = [];
    const socialLinks: string[] = [];

    // extract tel: and mailto: links
    const links = document.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      if (href.startsWith('tel:')) {
        telLinks.push(href.replace('tel:', '').trim());
      } else if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        if (email) mailtoLinks.push(email.trim());
      } else if (
        href.includes('facebook.com') ||
        href.includes('twitter.com') ||
        href.includes('x.com') ||
        href.includes('instagram.com') ||
        href.includes('linkedin.com') ||
        href.includes('youtube.com') ||
        href.includes('tiktok.com') ||
        href.includes('pinterest.com') ||
        href.includes('yelp.com')
      ) {
        socialLinks.push(href);
      }
    }

    // extract address text
    const addressEl = document.querySelector('address') ?? document.querySelector('[itemprop="address"]');
    const addressText = addressEl ? addressEl.textContent.trim() : null;

    return { telLinks, mailtoLinks, socialLinks, addressText };
  });
}

/**
 * Extract contact info from JSON-LD structured data
 */
export function extractContactFromJsonLd(structuredData?: StructuredData): Partial<ContactInfo> {
  if (!structuredData?.jsonLd) return {};

  const phones: PhoneInfo[] = [];
  const emails: EmailInfo[] = [];
  const addresses: AddressInfo[] = [];
  const hours: HoursInfo[] = [];

  for (const item of structuredData.jsonLd) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    // extract phone
    const telephone = safeString(obj.telephone);
    if (telephone) {
      phones.push({ number: telephone });
    }

    // extract email
    const email = safeString(obj.email);
    if (email) {
      emails.push({ address: email });
    }

    // extract address
    if (obj.address && typeof obj.address === 'object') {
      const addr = obj.address as Record<string, unknown>;
      const street = safeString(addr.streetAddress);
      const city = safeString(addr.addressLocality);
      const state = safeString(addr.addressRegion);
      const zip = safeString(addr.postalCode);
      const country = safeString(addr.addressCountry);

      addresses.push({
        formatted: [street, city, state, zip].filter(Boolean).join(', '),
        street,
        city,
        state,
        zip,
        country,
      });
    }

    // extract opening hours
    if (Array.isArray(obj.openingHoursSpecification)) {
      for (const spec of obj.openingHoursSpecification) {
        if (spec && typeof spec === 'object') {
          const s = spec as Record<string, unknown>;
          const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek];
          for (const day of days) {
            const dayStr = safeString(day);
            const opens = safeString(s.opens);
            const closes = safeString(s.closes);
            if (dayStr && opens && closes) {
              hours.push({
                day: dayStr.replace('http://schema.org/', ''),
                open: opens,
                close: closes,
              });
            }
          }
        }
      }
    }

    // extract from ContactPoint
    if (Array.isArray(obj.contactPoint)) {
      for (const cp of obj.contactPoint) {
        if (cp && typeof cp === 'object') {
          const contact = cp as Record<string, unknown>;
          const cpPhone = safeString(contact.telephone);
          const cpEmail = safeString(contact.email);
          const cpType = safeString(contact.contactType);

          if (cpPhone) {
            phones.push({ number: cpPhone, type: cpType });
          }
          if (cpEmail) {
            emails.push({ address: cpEmail, type: cpType });
          }
        }
      }
    }
  }

  return {
    ...(phones.length > 0 && { phones }),
    ...(emails.length > 0 && { emails }),
    ...(addresses.length > 0 && { addresses }),
    ...(hours.length > 0 && { hours }),
  };
}

// patterns that indicate share buttons, not actual social profiles
const SHARE_BUTTON_PATTERNS = [
  /sharer\.php/i,
  /\/share\?/i,
  /\/share$/i,
  /pin\/create/i,
  /shareArticle/i,
  /intent\/tweet/i,
  /\/hashtag\//i,
  /\/status\//i,
];

/**
 * Check if a URL is a share button rather than a social profile
 */
function isShareButtonUrl(url: string): boolean {
  return SHARE_BUTTON_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if a social URL has a meaningful profile path
 * Filters out generic domain-only links like "http://facebook.com"
 */
function hasProfilePath(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return path.length > 0 && path !== '/';
  } catch {
    return false;
  }
}

/**
 * Parse social links into platform-identified objects
 */
function parseSocialLinks(urls: string[]): SocialLink[] {
  const social: SocialLink[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);

    // skip share buttons, hashtag links, status/tweet links, and generic domain-only links
    if (isShareButtonUrl(url) || !hasProfilePath(url)) continue;

    for (const [platform, pattern] of Object.entries(SOCIAL_PLATFORMS)) {
      if (pattern.test(url)) {
        social.push({ platform, url });
        break;
      }
    }
  }

  return social;
}

/**
 * Aggregate contact info from multiple pages
 */
export function aggregateContactInfo(
  pageContacts: RawContactData[],
  jsonLdContact: Partial<ContactInfo>,
): ContactInfo | undefined {
  const phones = new Map<string, PhoneInfo>();
  const emails = new Map<string, EmailInfo>();
  const social = new Map<string, SocialLink>();

  // add JSON-LD data first (higher priority)
  for (const phone of jsonLdContact.phones ?? []) {
    phones.set(phone.number, phone);
  }
  for (const email of jsonLdContact.emails ?? []) {
    if (isValidEmail(email.address)) {
      emails.set(email.address, email);
    }
  }

  // aggregate from page extractions
  for (const page of pageContacts) {
    for (const num of page.telLinks) {
      if (!phones.has(num)) {
        phones.set(num, { number: num });
      }
    }
    for (const addr of page.mailtoLinks) {
      if (!emails.has(addr) && isValidEmail(addr)) {
        emails.set(addr, { address: addr });
      }
    }
    for (const link of parseSocialLinks(page.socialLinks)) {
      if (!social.has(link.url)) {
        social.set(link.url, link);
      }
    }
  }

  const result: ContactInfo = {
    ...(phones.size > 0 && { phones: Array.from(phones.values()) }),
    ...(emails.size > 0 && { emails: Array.from(emails.values()) }),
    ...(jsonLdContact.addresses && { addresses: jsonLdContact.addresses }),
    ...(jsonLdContact.hours && { hours: jsonLdContact.hours }),
    ...(social.size > 0 && { social: Array.from(social.values()) }),
  };

  // return undefined if empty
  if (Object.keys(result).length === 0) {
    return void 0;
  }

  return result;
}
