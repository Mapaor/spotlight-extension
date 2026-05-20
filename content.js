const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_SETTINGS = {
	mode: "blur",
	blur: 10,
	opacity: 0.92
};

const MAX_REGIONS = 10;

let selectionLayer = null;
let selectionRect = null;
let overlayLayer = null;
let maskEl = null;
let clearButton = null;
let addButton = null;
let toolbarEl = null;
let isSelecting = false;
let startPoint = null;
let settings = { ...DEFAULT_SETTINGS };
let dragState = null;
let dragMoveHandler = null;
let dragEndHandler = null;
let dragHintTimeouts = new Map();
let regions = [];
let zIndexCounter = 1;

const sendMessage = (payload) => {
	if (api.runtime?.sendMessage) {
		const result = api.runtime.sendMessage(payload);
		if (result && typeof result.then === "function") {
			return result;
		}
		return new Promise((resolve) => {
			api.runtime.sendMessage(payload, resolve);
		});
	}
	return Promise.resolve({ ok: false, error: "Messaging unavailable" });
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

const applySettings = () => {
	if (!overlayLayer) {
		return;
	}
	const maskAlpha = Math.min(0.98, Math.max(0.6, settings.opacity));
	const blurValue = settings.mode === "white"
		? 0
		: Math.min(24, Math.max(0, settings.blur));
	const background = `rgba(255, 255, 255, ${maskAlpha})`;

	overlayLayer.style.setProperty("--spotlight-mask", background);
	overlayLayer.style.setProperty("--spotlight-blur", `${blurValue}px`);
};

const clearSelectionLayer = () => {
	if (selectionLayer) {
		selectionLayer.remove();
		selectionLayer = null;
		selectionRect = null;
	}
	isSelecting = false;
	startPoint = null;
	if (overlayLayer) {
		overlayLayer.classList.remove("spotlight-selecting");
		overlayLayer.classList.remove("spotlight-hidden");
	}
};

const clearOverlay = () => {
	for (const timeoutId of dragHintTimeouts.values()) {
		clearTimeout(timeoutId);
	}
	dragHintTimeouts.clear();
	if (dragMoveHandler) {
		window.removeEventListener("mousemove", dragMoveHandler);
		dragMoveHandler = null;
	}
	if (dragEndHandler) {
		window.removeEventListener("mouseup", dragEndHandler);
		dragEndHandler = null;
	}
	if (overlayLayer) {
		overlayLayer.remove();
	}
	overlayLayer = null;
	maskEl = null;
	if (clearButton) {
		clearButton.remove();
	}
	clearButton = null;
	if (addButton) {
		addButton.remove();
	}
	addButton = null;
	if (toolbarEl) {
		toolbarEl.remove();
	}
	toolbarEl = null;
	dragState = null;
	regions = [];
	zIndexCounter = 1;
};

const ensureOverlayLayer = () => {
	if (overlayLayer) {
		return;
	}
	overlayLayer = document.createElement("div");
	overlayLayer.id = "spotlight-overlay-layer";

	maskEl = document.createElement("div");
	maskEl.id = "spotlight-mask";
	overlayLayer.appendChild(maskEl);

	toolbarEl = document.createElement("div");
	toolbarEl.id = "spotlight-toolbar";

	addButton = document.createElement("button");
	addButton.id = "spotlight-add-button";
	addButton.textContent = "Add new area";
	addButton.addEventListener("click", () => startSelection(settings));

	clearButton = document.createElement("button");
	clearButton.id = "spotlight-clear-button";
	clearButton.textContent = "Clear spotlight";
	clearButton.addEventListener("click", clearOverlay);

	toolbarEl.appendChild(addButton);
	toolbarEl.appendChild(clearButton);

	document.documentElement.appendChild(overlayLayer);
	document.documentElement.appendChild(toolbarEl);
};

const clampRect = (rect) => {
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const x = Math.max(0, Math.min(rect.x, viewportWidth - 1));
	const y = Math.max(0, Math.min(rect.y, viewportHeight - 1));
	const width = Math.max(1, Math.min(rect.width, viewportWidth - x));
	const height = Math.max(1, Math.min(rect.height, viewportHeight - y));
	return { x, y, width, height };
};

const createSelectionLayer = () => {
	clearSelectionLayer();
	selectionLayer = document.createElement("div");
	selectionLayer.id = "spotlight-selection-layer";
	selectionRect = document.createElement("div");
	selectionRect.id = "spotlight-selection-rect";
	selectionLayer.appendChild(selectionRect);
	document.documentElement.appendChild(selectionLayer);
};

const updateSelectionRect = (currentPoint) => {
	if (!selectionRect || !startPoint) {
		return;
	}
	const x = Math.min(startPoint.x, currentPoint.x);
	const y = Math.min(startPoint.y, currentPoint.y);
	const width = Math.abs(startPoint.x - currentPoint.x);
	const height = Math.abs(startPoint.y - currentPoint.y);

	selectionRect.style.left = `${x}px`;
	selectionRect.style.top = `${y}px`;
	selectionRect.style.width = `${width}px`;
	selectionRect.style.height = `${height}px`;
};

const startSelection = async (incomingSettings) => {
	if (isSelecting) {
		return;
	}
	settings = { ...DEFAULT_SETTINGS, ...(incomingSettings || {}) };
	if (regions.length >= MAX_REGIONS) {
		return;
	}
	createSelectionLayer();
	if (overlayLayer) {
		overlayLayer.classList.add("spotlight-selecting");
		overlayLayer.classList.add("spotlight-hidden");
	}
	isSelecting = true;

	const onMouseDown = (event) => {
		event.preventDefault();
		startPoint = { x: event.clientX, y: event.clientY };
		updateSelectionRect(startPoint);
	};

	const onMouseMove = (event) => {
		if (!startPoint) {
			return;
		}
		updateSelectionRect({ x: event.clientX, y: event.clientY });
	};

	const onMouseUp = async (event) => {
		if (!startPoint) {
			return;
		}
		const endPoint = { x: event.clientX, y: event.clientY };
		const rawRect = {
			x: Math.min(startPoint.x, endPoint.x),
			y: Math.min(startPoint.y, endPoint.y),
			width: Math.abs(startPoint.x - endPoint.x),
			height: Math.abs(startPoint.y - endPoint.y)
		};
		const rect = clampRect(rawRect);
		clearSelectionLayer();

		if (rect.width < 20 || rect.height < 20) {
			return;
		}

		if (overlayLayer) {
			overlayLayer.classList.add("spotlight-hidden");
		}
		const response = await sendMessage({
			type: "SPOTLIGHT_CAPTURE",
			payload: { rect, dpr: window.devicePixelRatio || 1 }
		});
		if (overlayLayer) {
			overlayLayer.classList.remove("spotlight-hidden");
		}

		if (!response || !response.ok) {
			return;
		}

		addRegion(rect, response.dataUrl);
	};

	const onKeyDown = (event) => {
		if (event.key === "Escape") {
			clearSelectionLayer();
		}
	};

	selectionLayer.addEventListener("mousedown", onMouseDown, { once: true });
	selectionLayer.addEventListener("mousemove", onMouseMove);
	selectionLayer.addEventListener("mouseup", onMouseUp, { once: true });
	window.addEventListener("keydown", onKeyDown, { once: true });
};

const createDragIcon = () => {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("aria-hidden", "true");

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute(
		"d",
		"M11.5 12.5H4.625l1.985 1.979q.146.146.155.35t-.156.369t-.359.165t-.36-.165l-2.632-2.633q-.131-.13-.184-.267T3.021 12t.053-.298t.184-.268L5.89 8.802q.146-.146.347-.156t.366.156t.165.357t-.165.356L4.619 11.5H11.5V4.62L9.51 6.61q-.147.146-.345.153q-.198.006-.363-.16q-.165-.164-.165-.356t.165-.356l2.633-2.633q.13-.131.267-.184T12 3.021t.298.053t.268.184l2.638 2.638q.146.146.155.345t-.155.363t-.357.165t-.357-.165L12.5 4.619V11.5h6.875l-1.984-1.979q-.147-.146-.156-.35t.156-.369t.359-.165t.36.165l2.632 2.633q.131.13.184.267t.053.298t-.053.298t-.184.268l-2.638 2.638q-.146.146-.344.153t-.364-.159t-.165-.357t.165-.356l1.985-1.985H12.5v6.875l1.979-1.984q.146-.147.35-.156t.369.156t.165.359t-.165.36l-2.633 2.632q-.13.131-.267.184t-.298.053t-.298-.053t-.268-.184l-2.638-2.638q-.146-.146-.153-.347t.159-.367t.357-.165t.356.165l1.985 1.99z"
	);

	svg.appendChild(path);
	return svg;
};

const createRemoveIcon = () => {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("aria-hidden", "true");

	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute("d", "M6.4 6.4a.85.85 0 0 1 1.2 0L12 10.8l4.4-4.4a.85.85 0 1 1 1.2 1.2L13.2 12l4.4 4.4a.85.85 0 0 1-1.2 1.2L12 13.2l-4.4 4.4a.85.85 0 1 1-1.2-1.2L10.8 12 6.4 7.6a.85.85 0 0 1 0-1.2");

	svg.appendChild(path);
	return svg;
};

const scheduleHint = (button) => {
	button.classList.add("spotlight-hint");
	const timeoutId = window.setTimeout(() => {
		button.classList.remove("spotlight-hint");
		dragHintTimeouts.delete(button);
	}, 1000);
	dragHintTimeouts.set(button, timeoutId);
};

const addRegion = (rect, dataUrl) => {
	ensureOverlayLayer();
	applySettings();
	overlayLayer.classList.remove("spotlight-selecting");

	const regionEl = document.createElement("div");
	regionEl.className = "spotlight-region";
	regionEl.style.left = `${rect.x}px`;
	regionEl.style.top = `${rect.y}px`;
	regionEl.style.width = `${rect.width}px`;
	regionEl.style.height = `${rect.height}px`;
	regionEl.style.zIndex = String(zIndexCounter++);

	const img = document.createElement("img");
	img.src = dataUrl;
	img.alt = "Spotlight";
	regionEl.appendChild(img);

	const dragHandle = document.createElement("button");
	dragHandle.className = "spotlight-drag-handle";
	dragHandle.type = "button";
	dragHandle.setAttribute("aria-label", "Drag spotlight");
	dragHandle.appendChild(createDragIcon());

	const removeButton = document.createElement("button");
	removeButton.className = "spotlight-remove-button";
	removeButton.type = "button";
	removeButton.setAttribute("aria-label", "Remove spotlight");
	removeButton.appendChild(createRemoveIcon());

	const region = { element: regionEl, dragHandle, removeButton };
	regions.push(region);

	dragHandle.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
		const rectSnapshot = regionEl.getBoundingClientRect();
		regionEl.style.zIndex = String(zIndexCounter++);
		dragState = {
			element: regionEl,
			offsetX: event.clientX - rectSnapshot.left,
			offsetY: event.clientY - rectSnapshot.top,
			width: rectSnapshot.width,
			height: rectSnapshot.height
		};
	});

	removeButton.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		regionEl.remove();
		regions = regions.filter((entry) => entry !== region);
		const dragTimeout = dragHintTimeouts.get(dragHandle);
		if (dragTimeout) {
			clearTimeout(dragTimeout);
			dragHintTimeouts.delete(dragHandle);
		}
		const removeTimeout = dragHintTimeouts.get(removeButton);
		if (removeTimeout) {
			clearTimeout(removeTimeout);
			dragHintTimeouts.delete(removeButton);
		}
		if (regions.length === 0) {
			clearOverlay();
		}
	});

	regionEl.appendChild(dragHandle);
	regionEl.appendChild(removeButton);

	overlayLayer.appendChild(regionEl);

	scheduleHint(dragHandle);
	scheduleHint(removeButton);

	if (!dragMoveHandler) {
		dragMoveHandler = (event) => {
			if (!dragState || !dragState.element) {
				return;
			}
			const maxLeft = Math.max(0, window.innerWidth - dragState.width);
			const maxTop = Math.max(0, window.innerHeight - dragState.height);
			const nextLeft = Math.min(Math.max(0, event.clientX - dragState.offsetX), maxLeft);
			const nextTop = Math.min(Math.max(0, event.clientY - dragState.offsetY), maxTop);
			dragState.element.style.left = `${nextLeft}px`;
			dragState.element.style.top = `${nextTop}px`;
		};
		window.addEventListener("mousemove", dragMoveHandler);
	}

	if (!dragEndHandler) {
		dragEndHandler = () => {
			dragState = null;
		};
		window.addEventListener("mouseup", dragEndHandler);
	}
};

api.runtime.onMessage.addListener((message) => {
	if (!message) {
		return undefined;
	}

	if (message.type === "SPOTLIGHT_START") {
		startSelection(message.payload?.settings);
	}

	if (message.type === "SPOTLIGHT_CLEAR") {
		clearOverlay();
		clearSelectionLayer();
	}

	return undefined;
});

loadSettings().then((stored) => {
	settings = { ...stored };
});

if (!window.__spotlightControls) {
	window.__spotlightControls = {
		start: (incomingSettings) => startSelection(incomingSettings),
		clear: () => {
			clearOverlay();
			clearSelectionLayer();
		},
		update: (incomingSettings) => {
			settings = { ...settings, ...(incomingSettings || {}) };
			applySettings();
		}
	};
}
