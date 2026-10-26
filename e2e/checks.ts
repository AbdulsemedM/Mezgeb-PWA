import { expect, type Page } from '@playwright/test';

/** MOB-002 §2: every tap target at least 56×56 CSS px. */
export async function expectBigTapTargets(page: Page): Promise<void> {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      'button, a[href], input, [role="radio"], [role="button"]',
    )) {
      if (el.closest('[aria-hidden="true"], dialog:not([open])')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // The quiet text link ("Continue in the browser") is 48px tall by design.
      const min = el.classList.contains('big-button--quiet') ? 48 : 56;
      if (r.height < min || r.width < 56) {
        out.push(
          `${el.tagName} "${el.textContent?.trim() || el.getAttribute('aria-label')}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
      }
    }
    return out;
  });
  expect(small, 'tap targets smaller than 56px').toEqual([]);
}

/** MOB-002 §2: at 200% text nothing overflows sideways (we scroll down instead of clipping). */
export async function expectNoSidewaysOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
}

/** The phone's font size at 200%. */
export async function setTextScale(page: Page, percent: number): Promise<void> {
  await page.addStyleTag({ content: `html { font-size: ${percent}% !important; }` });
}
