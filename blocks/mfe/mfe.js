import { readBlockConfig, loadCSS } from '../../scripts/aem.js';

const DEFAULT_ROOT_MARGIN = '200px';

// Module-scope cache so the same remote module URL is only ever imported once,
// even if this block is used multiple times on a page for the same MFE.
const modulePromises = new Map();

function importOnce(src) {
  if (!modulePromises.has(src)) {
    modulePromises.set(src, import(src));
  }
  return modulePromises.get(src);
}

async function mountRemoteApp(block, placeholder, config) {
  const {
    tagName, scriptUrl, polyfillsUrl, styleUrl,
  } = config;

  try {
    const stylesLoaded = styleUrl ? loadCSS(styleUrl) : Promise.resolve();
    const scriptsLoaded = polyfillsUrl
      ? importOnce(polyfillsUrl).then(() => importOnce(scriptUrl))
      : importOnce(scriptUrl);

    await Promise.all([stylesLoaded, scriptsLoaded]);

    if (placeholder?.isConnected) {
      placeholder.remove();
    }
    block.append(document.createElement(tagName));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`mfe block: failed to load remote app "${tagName}" from ${scriptUrl}`, error);
  }
}

export default function decorate(block) {
  const {
    'tag-name': tagName,
    'script-url': scriptUrl,
    'polyfills-url': polyfillsUrl,
    'style-url': styleUrl,
    loading = 'lazy',
    'root-margin': rootMargin = DEFAULT_ROOT_MARGIN,
    'min-height': minHeight,
  } = readBlockConfig(block);

  block.innerHTML = '';

  if (!tagName || !scriptUrl) {
    // eslint-disable-next-line no-console
    console.warn('mfe block: "Tag Name" and "Script URL" are required, block will not render', block);
    return;
  }

  let placeholder;
  if (minHeight) {
    placeholder = document.createElement('div');
    placeholder.className = 'mfe-placeholder';
    placeholder.style.minHeight = minHeight;
    block.append(placeholder);
  }

  const config = {
    tagName, scriptUrl, polyfillsUrl, styleUrl,
  };

  if (loading === 'eager') {
    mountRemoteApp(block, placeholder, config);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      mountRemoteApp(block, placeholder, config);
    }
  }, { rootMargin });
  observer.observe(block);
}
