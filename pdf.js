(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_SETTINGS = {
  mode: "blur",
  blur: 10,
  opacity: 0.92
};

const urlInput = document.querySelector("#pdf-url");
const loadButton = document.querySelector("#load");
const startButton = document.querySelector("#start");
const clearButton = document.querySelector("#clear");
const loadLocalButton = document.querySelector("#load-local");
let pdfEmbed = document.querySelector("#pdf-embed");
let localObjectUrl = "";

const loadSettings = () => {
  if (!api.storage?.local) {
    return Promise.resolve({ ...DEFAULT_SETTINGS });
  }
  return api.storage.local.get(["spotlightSettings", "spotlightPdfUrl"]).then((data) => ({
    settings: { ...DEFAULT_SETTINGS, ...(data?.spotlightSettings || {}) },
    pdfUrl: data?.spotlightPdfUrl || ""
  }));
};

const savePdfUrl = (pdfUrl) => {
  if (!api.storage?.local) {
    return Promise.resolve();
  }
  return api.storage.local.set({ spotlightPdfUrl: pdfUrl });
};

const getUrlFromQuery = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("url") || "";
};

const replacePdfEmbed = (url) => {
  if (!pdfEmbed) {
    return;
  }
  const next = pdfEmbed.cloneNode(false);
  next.src = url;
  pdfEmbed.replaceWith(next);
  pdfEmbed = next;
};

const setPdfSource = (url) => {
  if (!pdfEmbed || !url) {
    return;
  }
  if (pdfEmbed.src === url) {
    return;
  }
  replacePdfEmbed("about:blank");
  requestAnimationFrame(() => {
    replacePdfEmbed(url);
  });
};

const setLocalPdfSource = (file) => {
  if (!file) {
    return;
  }
  if (localObjectUrl) {
    URL.revokeObjectURL(localObjectUrl);
  }
  localObjectUrl = URL.createObjectURL(file);
  setPdfSource(localObjectUrl);
};

const startSpotlight = (settings) => {
  if (window.__spotlightControls?.start) {
    window.__spotlightControls.start(settings);
  }
};

const clearSpotlight = () => {
  if (window.__spotlightControls?.clear) {
    window.__spotlightControls.clear();
  }
};

const handleLoad = async () => {
  const url = urlInput?.value?.trim();
  if (!url) {
    return;
  }
  setPdfSource(url);
  await savePdfUrl(url);
};

loadButton?.addEventListener("click", handleLoad);

loadLocalButton?.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      setLocalPdfSource(file);
    }
  });
  input.click();
});

urlInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleLoad();
  }
});

startButton?.addEventListener("click", async () => {
  const { settings } = await loadSettings();
  startSpotlight(settings);
});

clearButton?.addEventListener("click", clearSpotlight);

  loadSettings().then(({ pdfUrl }) => {
    const queryUrl = getUrlFromQuery();
    const initialUrl = queryUrl || pdfUrl;
    if (urlInput) {
      urlInput.value = initialUrl;
    }
    if (initialUrl) {
      setPdfSource(initialUrl);
    }
  });
})();
