# Spotlight Focus
A Firefox and Chrome extension to spotlight a part of a website page. Also works with PDFs.

## How to use it
Screenshot a region of the website and choose the opacity and blur of the rest of the page. You can also drag and drop the spotlighted region to pin it wherever you need to.

## Use cases
- Focus the statement of an exercise hiding the solution or other distracting information (useful for studying)
- Highlight a set of paragraphs you find rellevant in an article 
- Organize a set of useful formula equations you find in different parts of a PDF
- Highlight a button, form field or section of a page to take a screenshot of it. For example while creating guides or articles explaining how to use certain websites/platforms.

## Example usage video
https://github.com/user-attachments/assets/0513ab3e-5f0d-43a4-b792-64e84eebc111



## Local testing
This repository is meant to be very simple to locally test both in Firefox and Chrome. There is no build step, simply two different manifests but the source code stays the same (thanks to the polyfill library).

### For Firefox
1. Rename the `manifest.firefox.json` to `manifest.json`.
2. Go to the URL `about:debugging` and in the 'This Firefox' tab click the 'Load temporary addon' button and select the `manifest.json` file.

### For Chrome
1. Rename the `manifest.chrome.json` to `manifest.json`.
2. Go to the URL `chrome://extensions` and click 'Load unpacked' top-left button and select the folder where you have this repository.


## How it works technically
- The content script (`content.js`) provides the functionality of drawing the selection (the dashed rectangle), and generating the masked overlay (using css).
- The actual screenshot (spotlighted area) is done in the background script (`background.js`). We obtain the pixels using the `tabs.captureVisibleTab` API and then we crop for device pixel ratio.
- The data is passed to the content script via a URL that contains the PNG data.
- Because Firefox’s and Chrome's built-in PDF viewer ([pdf.js](https://github.com/mozilla/pdf.js)) prevents content scripts from running, we need an extension's own page (`pdf.html`) that acts as a wrapper over the PDF (using the `iframe` tag), which accepts both local `blob:` files (loaded using a file picker) or external PDFs (loaded via URL fetching).
- The manifest only needs `storage`, `tabs`, and `activeTab` permissions.
- The extension manifest explicitally sets the CSP (Content Security Policy) to allow local PDF blobs to be embedded in the extension's own page.

## Features to implement
- [X] Add sliders to customize the spotlight effect (opacity, blur and border-radius)
- [X] Add PDF support (using an extension page that loads the PDF inside an iframe or embed tag) 
- [x] Make the spotlighted region draggable across the viewport
- [X] Add multi-region support
- [X] Add Chrome support

## License
[MIT](./LICENSE)
