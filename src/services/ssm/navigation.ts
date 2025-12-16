import type { NavItem, Navigation } from '../../types/ssm';
import type { Page } from 'puppeteer';

interface RawNavItem {
  text: string;
  href: string;
  children: RawNavItem[];
}

/**
 * Extract navigation structure from page
 */
export async function extractNavigation(page: Page, baseUrl: URL): Promise<Navigation | undefined> {
  try {
    const raw = await page.evaluate(() => {
      const extractLinks = (container: Element): RawNavItem[] => {
        const items: RawNavItem[] = [];
        const seen = new Set<string>();

        // find direct link children or links in list items
        const links = container.querySelectorAll(':scope > a, :scope > ul > li > a, :scope > li > a');

        for (const link of links) {
          const anchor = link as HTMLAnchorElement;
          const href = anchor.href;
          const text = (anchor.textContent || '').trim();

          if (!href || !text || seen.has(href)) continue;
          seen.add(href);

          // check for nested navigation (dropdowns)
          const parent = anchor.parentElement;
          const children: RawNavItem[] = [];

          if (parent) {
            const submenu = parent.querySelector('ul, [role="menu"]');
            if (submenu) {
              children.push(...extractLinks(submenu));
            }
          }

          items.push({ text, href, children });
        }

        return items;
      };

      // find primary navigation
      const primaryNav =
        document.querySelector('nav[aria-label*="main" i]') ??
        document.querySelector('nav[aria-label*="primary" i]') ??
        document.querySelector('header nav') ??
        document.querySelector('[role="navigation"]') ??
        document.querySelector('nav');

      // find footer navigation
      const footerNav =
        document.querySelector('footer nav') ??
        document.querySelector('footer [role="navigation"]') ??
        document.querySelector('footer');

      const primary = primaryNav ? extractLinks(primaryNav) : [];

      // for footer, extract links differently (usually flat structure)
      const footer: RawNavItem[] = [];
      if (footerNav && footerNav !== primaryNav) {
        const footerLinks = footerNav.querySelectorAll('a');
        const seen = new Set<string>();

        for (const link of footerLinks) {
          const href = link.href;
          const text = (link.textContent || '').trim();

          if (!href || !text || seen.has(href)) continue;
          // skip if already in primary nav
          if (primary.some((p) => p.href === href)) continue;
          seen.add(href);

          footer.push({ text, href, children: [] });
        }
      }

      return { primary, footer };
    });

    // filter to internal links only and normalize
    const filterInternal = (items: RawNavItem[]): NavItem[] => {
      return items
        .filter((item) => {
          try {
            const url = new URL(item.href);
            return url.hostname === baseUrl.hostname;
          } catch {
            return false;
          }
        })
        .map((item) => ({
          text: item.text,
          url: item.href,
          ...(item.children.length > 0 && { children: filterInternal(item.children) }),
        }));
    };

    const primary = filterInternal(raw.primary);
    const footer = filterInternal(raw.footer);

    if (primary.length === 0 && footer.length === 0) {
      return void 0;
    }

    return {
      ...(primary.length > 0 && { primary }),
      ...(footer.length > 0 && { footer }),
    };
  } catch {
    return void 0;
  }
}
