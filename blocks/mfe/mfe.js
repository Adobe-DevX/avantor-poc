import { loadCSS } from '../../scripts/aem.js';

const DEFAULT_ROOT_MARGIN = '200px';

// Must match the field order in _mfe.json's "mfe" model exactly. AEM's xwalk block renderer
// emits one row per model field in declaration order, but doesn't reliably expose the field
// name on the row: a plain "text" field whose value is a URL gets auto-linkified server-side
// and loses its data-aue-prop attribute in the process, so rows can't be keyed off labels
// (readBlockConfig()'s [label, value] table assumption doesn't hold for xwalk-rendered content
// at all — every row here is a single cell). Positional order is the one thing that's reliable.
const FIELD_ORDER = ['tagName', 'scriptUrl', 'polyfillsUrl', 'styleUrl', 'loading', 'rootMargin', 'minHeight'];

function cellValue(row) {
  const link = row.querySelector('a');
  return (link ? link.href : row.textContent).trim();
}

function readConfig(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const config = {};
  FIELD_ORDER.forEach((name, i) => {
    if (rows[i]) config[name] = cellValue(rows[i]);
  });
  return config;
}

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
    tagName,
    scriptUrl,
    polyfillsUrl,
    styleUrl,
    loading = 'lazy',
    rootMargin = DEFAULT_ROOT_MARGIN,
    minHeight,
  } = readConfig(block);

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
