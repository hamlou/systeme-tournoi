// Helper to upload an image to ImgBB and return the hosted URL.
// https://api.imgbb.com/

const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY ?? "6a0d0dc865c29c4bf414f81371d602ad";
const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

export async function uploadImageToImgBB(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${IMGBB_ENDPOINT}?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`ImgBB upload failed with status ${response.status}`);
  }

  const json = await response.json();
  if (!json?.success || !json?.data?.url) {
    throw new Error(json?.error?.message ?? "ImgBB upload failed");
  }

  return json.data.url as string;
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [metadata, base64] = dataUrl.split(",");
  const mime = metadata.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

async function removeImageBackground(file: File) {
  const loadModule = new Function("return import('https://esm.sh/@imgly/background-removal@1.7.0')");
  const imgly = await loadModule() as {
    default?: (image: File, configuration?: unknown) => Promise<Blob>;
    removeBackground?: (image: File, configuration?: unknown) => Promise<Blob>;
  };
  const removeBackground = imgly.removeBackground ?? imgly.default;
  if (!removeBackground) throw new Error("Background remover could not be loaded");
  const blob = await removeBackground(file, {
    model: "isnet_quint8",
    output: {
      format: "image/png",
      quality: 0.9,
    },
  });
  return new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" });
}

async function resizeImageToDataUrl(file: File, maxSize: number, quality: number, format: "image/jpeg" | "image/png" = "image/jpeg") {
  if (file.type === "image/svg+xml") return fileToDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not prepare image"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL(format, quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };
    image.src = objectUrl;
  });
}

export async function uploadProfileImage(file: File, options?: { maxSize?: number; removeBackground?: boolean }) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }

  let sourceFile = file;
  let backgroundRemoved = false;
  if (options?.removeBackground) {
    try {
      sourceFile = await removeImageBackground(file);
      backgroundRemoved = true;
    } catch (error) {
      console.warn("[background-removal] Falling back to original athlete photo", error);
    }
  }

  const outputFormat = backgroundRemoved ? "image/png" : "image/jpeg";
  const dataUrl = await resizeImageToDataUrl(sourceFile, options?.maxSize ?? 640, 0.82, outputFormat);
  const uploadFile = dataUrlToFile(dataUrl, sourceFile.name.replace(/\.[^.]+$/, backgroundRemoved ? ".png" : ".jpg"));

  try {
    return { url: await uploadImageToImgBB(uploadFile), storedRemotely: true, backgroundRemoved };
  } catch {
    return { url: dataUrl, storedRemotely: false, backgroundRemoved };
  }
}
