/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

import { getRootPath } from '@dropins/tools/lib/aem/configs.js';
import { decorateMain } from '../../scripts/scripts.js';
import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {Promise<HTMLElement>} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    const root = getRootPath().replace(/\/$/, '');
    const url = `${root}${path}.plain.html`;
    const resp = await fetch(url);
    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      // Some environments (notably the AEM author instance that backs the
      // Universal Editor) return a full HTML document from `.plain.html`
      // instead of just the body fragment the published pipeline serves. In
      // that case the real section content is wrapped in an inner <main> and
      // preceded by stray <head> nodes (title/meta/link/…). Unwrap to that
      // inner <main> so only genuine sections are decorated — otherwise the
      // sections stay nested and undecorated, and the fragment's blocks (hero,
      // cards, …) never load where the fragment is referenced.
      const innerMain = main.querySelector('main');
      if (innerMain) {
        main.replaceChildren(...innerMain.childNodes);
      }

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}

/**
 * Returns a section's author-chosen style classes, i.e. the classes left after
 * removing the ones added structurally by the decoration pipeline (`section`
 * itself and every `<block>-container`). These are the classes contributed by
 * the section's Section Metadata "style" field (e.g. `hero-banner`).
 * @param {Element} section A decorated `.section` element
 * @returns {string[]} The style class names
 */
function getSectionStyles(section) {
  return [...section.classList].filter((cls) => cls !== 'section' && !cls.endsWith('-container'));
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) {
    // A fragment's block styling is driven by its section-level style (chosen
    // via Section Metadata, e.g. "hero-banner" → `.hero-banner .hero { ... }`).
    // When inlined here, that style lives on the fragment's own nested section,
    // which is not reliably preserved in every environment — most notably the
    // Universal Editor authoring canvas, where the host section is what wraps
    // the block content. Copy each fragment section's style classes onto the
    // host section so section-scoped CSS matches regardless of environment.
    // This works generically for any fragment/style (hero, cards, …), not just
    // the hero block.
    const hostSection = block.closest('.section');
    if (hostSection) {
      fragment.querySelectorAll(':scope > .section').forEach((section) => {
        getSectionStyles(section).forEach((cls) => hostSection.classList.add(cls));
      });
    }
    block.replaceChildren(...fragment.childNodes);
  }
}
