# Spotlight Focus
A Firefox and Chrome extension to spotlight a part of a website page. Also works with PDFs.

## Firefox vs Chrome
This repository is meant to be directly pluggable to Firefox, simply load the `manifest.json` inside the `about:debugging` URL (in the 'This Firefox' tab).

This is also quite straightforward with Chrome. Simply do the following rename of files:
-  `manifest.json` to `manifest.firefox.json`
-  `manifest.chrome.json` to `manifest.json`
And load the whole folder unpacked.

## How to use it
Screenshot a region of the website and choose the opacity and blur of the rest of the page. You can also drag and drop the spotlighted region to pin it wherever you need to.

## Use cases
- Focus the statement of an exercise hiding the solution or other distracting information (useful for studying)
- Highlight a set of paragraphs you find rellevant in an article 
- Organize a set of useful formula equations you find in different parts of a PDF
- Highlight a button, form field or section of a page to take a screenshot of it. For example while creating guides or articles explaining how to use certain websites/platforms.

## How it works technically
This extension injects a content script (`content.js`) into normal pages and the extension helper page to provide the rectangle selection UI, render the masked overlay, and display a pinned snapshot of the selected region without altering the original page. Screen capture works thanks to `background.js` which uses the privileged `tabs.captureVisibleTab` API, crops for device pixel ratio, and returns a PNG data URL to the content script — this keeps privileged actions out of page context. Firefox’s built-in PDF viewer prevents content scripts from running, so we include a small helper page (`pdf.html`) that embeds PDFs (or accepts local `blob:` files) where the same content script can operate. The manifest only needs `storage`, `tabs`, and `activeTab` permissions; the extension pages CSP permits `blob:` to allow local PDF blobs to be embedded using a file picker.

## TO-DO
Allow up to 10 spotlighted regions.

## License
MIT