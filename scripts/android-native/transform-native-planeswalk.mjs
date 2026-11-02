// Planeswalk in the app: no web fonts (it falls back to Georgia and the system font offline), and
// native-planeswalk.js for the sideways full-screen mode, phone haptics and Back.
import { compatColorMixHtml } from './transform-native-compat-css.mjs';

export function transformNativePlaneswalk(text) {
  // color-mix fallbacks for older WebViews (transform-native-compat-css.mjs); current ones ignore them.
  const out = compatColorMixHtml(text).replace(/<link\b[^>]*href="https?:\/\/[^>]*>\s*/g, '');
  if (out.split('</head>').length !== 2) throw Error('Unexpected Planeswalk page shape; review the native adapter.');
  // native-planeswalk-compat.css only speaks to older Android WebViews (see the file); current ones skip it.
  return out.replace('</head>', '<link rel="stylesheet" href="native-planeswalk-compat.css">\n<script src="native-planeswalk.js"></script>\n</head>');
}
