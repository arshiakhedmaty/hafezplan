export interface ImageExtractionResult {
  text: string;
  method: "browser" | "service";
}

interface TextDetection {
  rawValue?: string;
}

interface TextDetectorInstance {
  detect(source: ImageBitmap): Promise<TextDetection[]>;
}

interface TextDetectorConstructor {
  new (): TextDetectorInstance;
}

/**
 * Extracts text from a screenshot without coupling scheduling to AI. A
 * deployment may provide a server-side endpoint; otherwise Chromium's local
 * Shape Detection API is used when available.
 */
export async function extractTextFromImage(file: File): Promise<ImageExtractionResult> {
  if (!file.type.startsWith("image/")) throw new Error("not_an_image");

  const endpoint = import.meta.env["VITE_IMAGE_EXTRACTION_ENDPOINT"] as string | undefined;
  if (endpoint) {
    const form = new FormData();
    form.append("image", file);
    const response = await fetch(endpoint, { method: "POST", body: form });
    if (!response.ok) throw new Error("image_extraction_failed");
    const body = (await response.json()) as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim()) throw new Error("image_has_no_text");
    return { text: body.text, method: "service" };
  }

  const Detector = (globalThis as typeof globalThis & { TextDetector?: TextDetectorConstructor })
    .TextDetector;
  if (!Detector) throw new Error("image_extraction_unavailable");

  const bitmap = await createImageBitmap(file);
  try {
    const detections = await new Detector().detect(bitmap);
    const text = detections
      .map((detection) => detection.rawValue?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
    if (!text) throw new Error("image_has_no_text");
    return { text, method: "browser" };
  } finally {
    bitmap.close();
  }
}
