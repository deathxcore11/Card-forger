// Planeswalk in the app: no web fonts (it falls back to Georgia and the system font offline), and
// native-planeswalk.js for the sideways full-screen mode, phone haptics and Back.
export function transformNativePlaneswalk(text) {
  const out = text.replace(/<link\b[^>]*href="https?:\/\/[^>]*>\s*/g, '');
  if (out.split('</head>').length !== 2) throw Error('Unexpected Planeswalk page shape; review the native adapter.');
  return out.replace('</head>', '<script src="native-planeswalk.js"></script>\n</head>');
}
