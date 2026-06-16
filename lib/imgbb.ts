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

async function resizeImageToDataUrl(file: File, maxSize: number, quality: number) {
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
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };
    image.src = objectUrl;
  });
}

export async function uploadProfileImage(file: File, options?: { maxSize?: number }) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }

  const dataUrl = await resizeImageToDataUrl(file, options?.maxSize ?? 640, 0.82);
  const uploadFile = dataUrlToFile(dataUrl, file.name.replace(/\.[^.]+$/, ".jpg"));

  try {
    return { url: await uploadImageToImgBB(uploadFile), storedRemotely: true };
  } catch {
    return { url: dataUrl, storedRemotely: false };
  }
}
