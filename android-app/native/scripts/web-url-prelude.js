// The browser's URL and URLSearchParams for the QuickJS bundles (QuickJS has neither): core-js's WHATWG
// implementation (scripts/js-tools), so the site's link checks (community-feed.js safeCommunityUrl and the news
// source rules) parse a link exactly as a browser does. Injected before deck-engine-prelude.js's fallback stub.
import 'core-js/actual/url';
import 'core-js/actual/url-search-params';
