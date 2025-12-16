import { describe, expect, it } from 'vitest';

import { aggregateContactInfo, extractContactFromJsonLd } from '../../../src/services/ssm/contact';

import type { StructuredData } from '../../../src/types/crawl';
import type { ContactInfo } from '../../../src/types/ssm';

describe('extractContactFromJsonLd', () => {
  it('should extract phone from LocalBusiness', () => {
    const structuredData: StructuredData = {
      jsonLd: [{ '@type': 'LocalBusiness', telephone: '+1-555-123-4567' }],
      microdata: [],
    };
    const result = extractContactFromJsonLd(structuredData);
    expect(result.phones).toHaveLength(1);
    expect(result.phones![0]!.number).toBe('+1-555-123-4567');
  });

  it('should extract email from Organization', () => {
    const structuredData: StructuredData = {
      jsonLd: [{ '@type': 'Organization', email: 'contact@example.com' }],
      microdata: [],
    };
    const result = extractContactFromJsonLd(structuredData);
    expect(result.emails).toHaveLength(1);
    expect(result.emails![0]!.address).toBe('contact@example.com');
  });

  it('should extract address from LocalBusiness', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'LocalBusiness',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '123 Main St',
            addressLocality: 'Springfield',
            addressRegion: 'IL',
            postalCode: '62701',
            addressCountry: 'US',
          },
        },
      ],
      microdata: [],
    };
    const result = extractContactFromJsonLd(structuredData);
    expect(result.addresses).toHaveLength(1);
    expect(result.addresses![0]!.street).toBe('123 Main St');
    expect(result.addresses![0]!.city).toBe('Springfield');
    expect(result.addresses![0]!.state).toBe('IL');
    expect(result.addresses![0]!.zip).toBe('62701');
    expect(result.addresses![0]!.country).toBe('US');
  });

  it('should extract opening hours', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'LocalBusiness',
          openingHoursSpecification: [
            { dayOfWeek: 'Monday', opens: '09:00', closes: '17:00' },
            { dayOfWeek: 'Tuesday', opens: '09:00', closes: '17:00' },
          ],
        },
      ],
      microdata: [],
    };
    const result = extractContactFromJsonLd(structuredData);
    expect(result.hours).toHaveLength(2);
    expect(result.hours![0]!.day).toBe('Monday');
    expect(result.hours![0]!.open).toBe('09:00');
    expect(result.hours![0]!.close).toBe('17:00');
  });

  it('should extract from ContactPoint array', () => {
    const structuredData: StructuredData = {
      jsonLd: [
        {
          '@type': 'Organization',
          contactPoint: [
            { telephone: '+1-555-111-1111', contactType: 'sales' },
            { email: 'support@example.com', contactType: 'customer support' },
          ],
        },
      ],
      microdata: [],
    };
    const result = extractContactFromJsonLd(structuredData);
    expect(result.phones).toHaveLength(1);
    expect(result.phones![0]!.number).toBe('+1-555-111-1111');
    expect(result.phones![0]!.type).toBe('sales');
    expect(result.emails).toHaveLength(1);
    expect(result.emails![0]!.address).toBe('support@example.com');
    expect(result.emails![0]!.type).toBe('customer support');
  });

  it('should return empty object for no data', () => {
    const result = extractContactFromJsonLd(void 0);
    expect(result).toEqual({});
  });

  it('should ignore non-string values', () => {
    const structuredData: StructuredData = {
      jsonLd: [{ '@type': 'LocalBusiness', telephone: { nested: 'object' } }],
      microdata: [],
    };
    const result = extractContactFromJsonLd(structuredData);
    expect(result.phones).toBeUndefined();
  });
});

describe('aggregateContactInfo', () => {
  it('should aggregate phones from multiple pages', () => {
    const pageContacts = [
      { telLinks: ['+1-555-111-1111'], mailtoLinks: [], socialLinks: [], addressText: null },
      { telLinks: ['+1-555-222-2222'], mailtoLinks: [], socialLinks: [], addressText: null },
    ];
    const result = aggregateContactInfo(pageContacts, {});
    expect(result?.phones).toHaveLength(2);
  });

  it('should deduplicate phones', () => {
    const pageContacts = [
      { telLinks: ['+1-555-111-1111'], mailtoLinks: [], socialLinks: [], addressText: null },
      { telLinks: ['+1-555-111-1111'], mailtoLinks: [], socialLinks: [], addressText: null },
    ];
    const result = aggregateContactInfo(pageContacts, {});
    expect(result?.phones).toHaveLength(1);
  });

  it('should aggregate emails from multiple pages', () => {
    const pageContacts = [
      { telLinks: [], mailtoLinks: ['a@example.com'], socialLinks: [], addressText: null },
      { telLinks: [], mailtoLinks: ['b@example.com'], socialLinks: [], addressText: null },
    ];
    const result = aggregateContactInfo(pageContacts, {});
    expect(result?.emails).toHaveLength(2);
  });

  it('should parse social links by platform', () => {
    const pageContacts = [
      {
        telLinks: [],
        mailtoLinks: [],
        socialLinks: ['https://facebook.com/example', 'https://twitter.com/example'],
        addressText: null,
      },
    ];
    const result = aggregateContactInfo(pageContacts, {});
    expect(result?.social).toHaveLength(2);
    expect(result!.social![0]!.platform).toBe('facebook');
    expect(result!.social![1]!.platform).toBe('twitter');
  });

  it('should prioritize JSON-LD data', () => {
    const pageContacts = [{ telLinks: ['+1-555-111-1111'], mailtoLinks: [], socialLinks: [], addressText: null }];
    const jsonLdContact: Partial<ContactInfo> = {
      phones: [{ number: '+1-555-111-1111', type: 'main' }],
    };
    const result = aggregateContactInfo(pageContacts, jsonLdContact);
    expect(result?.phones).toHaveLength(1);
    expect(result!.phones![0]!.type).toBe('main');
  });

  it('should include JSON-LD addresses and hours', () => {
    const pageContacts = [{ telLinks: [], mailtoLinks: [], socialLinks: [], addressText: null }];
    const jsonLdContact: Partial<ContactInfo> = {
      addresses: [{ formatted: '123 Main St', street: '123 Main St' }],
      hours: [{ day: 'Monday', open: '09:00', close: '17:00' }],
    };
    const result = aggregateContactInfo(pageContacts, jsonLdContact);
    expect(result?.addresses).toHaveLength(1);
    expect(result?.hours).toHaveLength(1);
  });

  it('should return undefined for empty data', () => {
    const pageContacts = [{ telLinks: [], mailtoLinks: [], socialLinks: [], addressText: null }];
    const result = aggregateContactInfo(pageContacts, {});
    expect(result).toBeUndefined();
  });
});
