# Spotlight Focus
A Firefox extension to spotlight a part of a website page. Also works with PDFs.

## How to use it
Screenshot a region of the website and choose the opacity and blur of the rest of the page. You can also drag and drop the spotlighted region to pin it wherever you need to.

## How it works technically
This extension injects a content script (`content.js`) into normal pages and the extension helper page to provide the rectangle selection UI, render the masked overlay, and display a pinned snapshot of the selected region without altering the original page. Screen capture works thanks to `background.js` which uses the privileged `tabs.captureVisibleTab` API, crops for device pixel ratio, and returns a PNG data URL to the content script — this keeps privileged actions out of page context. Firefox’s built-in PDF viewer prevents content scripts from running, so we include a small helper page (`pdf.html`) that embeds PDFs (or accepts local `blob:` files) where the same content script can operate. The manifest only needs `storage`, `tabs`, and `activeTab` permissions; the extension pages CSP permits `blob:` to allow local PDF blobs to be embedded using a file picker.

## TO-DO
Allow up to 10 spotlighted regions.

## License
MIT