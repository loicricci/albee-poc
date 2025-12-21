import { supabase } from "@/lib/supabaseClient";

function getExt(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName) return fromName.toLowerCase();
  // fallback by mime
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadImageToBucket(params: {
  bucket: "avatars" | "avee-avatars";
  folder: string; // userId or aveeId
  file: File;
}) {
  const { bucket, folder, file } = params;

  // basic validation
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }
  const maxMb = 5;
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Image too large. Max ${maxMb}MB.`);
  }

  const ext = getExt(file);
  const path = `${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (error) throw new Error(error.message);

  // public bucket
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not get public URL.");

  return { publicUrl: data.publicUrl, path };
}
    