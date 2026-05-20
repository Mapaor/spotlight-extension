const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_SETTINGS = {
	mode: "blur",
	blur: 10,
	opacity: 0.92,
	radius: 12
};

const getActiveTab = () => new Promise((resolve) => {
	if (!api.tabs?.query) {
		resolve(null);
		return;
	}
	api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		resolve(tabs?.[0] || null);
	});
});

const sendToActiveTab = async (message) => {
	const tab = await getActiveTab();
	if (!tab?.id || !api.tabs?.sendMessage) {
		return;
	}
	api.tabs.sendMessage(tab.id, message);
};

const loadSettings = () => {
	if (!api.storage?.local) {
		return Promise.resolve({ ...DEFAULT_SETTINGS });
	}
	return api.storage.local.get("spotlightSettings").then((data) => ({
		...DEFAULT_SETTINGS,
		...(data?.spotlightSettings || {})
	}));
};

const saveSettings = (settings) => {
	if (!api.storage?.local) {
		return Promise.resolve();
	}
	return api.storage.local.set({ spotlightSettings: settings });
};

const blurRange = document.querySelector("#blur");
const blurValue = document.querySelector("#blur-value");
const opacityRange = document.querySelector("#opacity");
const opacityValue = document.querySelector("#opacity-value");
const radiusRange = document.querySelector("#radius");
const radiusValue = document.querySelector("#radius-value");
const startButton = document.querySelector("#start");
const clearButton = document.querySelector("#clear");
const openPdfButton = document.querySelector("#open-pdf");

const setValueText = (el, value) => {
	if (el) {
		el.textContent = value;
	}
};

const updateUI = (settings) => {
	if (blurRange) {
		blurRange.value = settings.blur;
		setValueText(blurValue, `${settings.blur}px`);
	}
	if (opacityRange) {
		opacityRange.value = Math.round(settings.opacity * 100);
		setValueText(opacityValue, `${Math.round(settings.opacity * 100)}%`);
	}
	if (radiusRange) {
		radiusRange.value = settings.radius;
		setValueText(radiusValue, `${settings.radius}px`);
	}
};

const readSettingsFromUI = () => ({
	blur: Number(blurRange?.value || DEFAULT_SETTINGS.blur),
	opacity: Number(opacityRange?.value || DEFAULT_SETTINGS.opacity * 100) / 100,
	radius: Number(radiusRange?.value || DEFAULT_SETTINGS.radius)
});

const handleSettingsChange = async () => {
	const newSettings = readSettingsFromUI();
	updateUI(newSettings);
	await saveSettings(newSettings);
	sendToActiveTab({
		type: "SPOTLIGHT_UPDATE_SETTINGS",
		payload: { settings: newSettings }
	});
};

startButton?.addEventListener("click", async () => {
	const settings = readSettingsFromUI();
	await saveSettings(settings);
	sendToActiveTab({
		type: "SPOTLIGHT_START",
		payload: { settings }
	});
});

clearButton?.addEventListener("click", () => {
	sendToActiveTab({ type: "SPOTLIGHT_CLEAR" });
});

openPdfButton?.addEventListener("click", () => {
	if (!api.tabs?.create || !api.runtime?.getURL) {
		return;
	}
	api.tabs.create({ url: api.runtime.getURL("pdf.html") });
});

blurRange?.addEventListener("input", handleSettingsChange);
opacityRange?.addEventListener("input", handleSettingsChange);
radiusRange?.addEventListener("input", handleSettingsChange);

loadSettings().then(updateUI);
