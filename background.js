const api = typeof browser !== "undefined" ? browser : chrome;

const toBase64 = (buffer) => {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
};

const captureAndCrop = async (rect, dpr) => {
	const dataUrl = await api.tabs.captureVisibleTab(null, { format: "png" });
	const sourceBlob = await (await fetch(dataUrl)).blob();
	const bitmap = await createImageBitmap(sourceBlob);

	const sx = Math.max(0, Math.floor(rect.x * dpr));
	const sy = Math.max(0, Math.floor(rect.y * dpr));
	const sw = Math.max(1, Math.floor(rect.width * dpr));
	const sh = Math.max(1, Math.floor(rect.height * dpr));

	const canvas = new OffscreenCanvas(sw, sh);
	const ctx = canvas.getContext("2d", { alpha: false });
	ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

	const outBlob = await canvas.convertToBlob({ type: "image/png" });
	const buffer = await outBlob.arrayBuffer();
	return `data:image/png;base64,${toBase64(buffer)}`;
};

api.runtime.onMessage.addListener((message, sender) => {
	if (!message || message.type !== "SPOTLIGHT_CAPTURE") {
		return undefined;
	}

	const { rect, dpr } = message.payload || {};
	return captureAndCrop(rect, dpr).then(
		(dataUrl) => ({ ok: true, dataUrl }),
		(error) => ({ ok: false, error: String(error) })
	);
});
