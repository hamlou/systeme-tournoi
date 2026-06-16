// Helper to upload an image to ImgBB and return the hosted URL.
// https://api.imgbb.com/

const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY ?? "6a0d0dc865c29c4bf414f81371d602ad";
const IMGBB_ENDPOINT = "https://api.imgbb.com/1/upload";

export async function uploadImageToImgBB(file: File): Promise<string> {
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
