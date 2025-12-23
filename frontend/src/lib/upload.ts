import { supabase } from "@/lib/supabaseClient";

function getExt(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName) return fromName.toLowerCase();
  // fallback by mime
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "audio/mpeg") return "mp3";
  if (file.type === "audio/mp4") return "m4a";
  if (file.type === "audio/wav") return "wav";
  if (file.type === "audio/webm") return "webm";
  if (file.type === "audio/ogg") return "ogg";
  return "jpg";
}

export async function uploadImageToBucket(params: {
  bucket: "avatars" | "avee-avatars" | "app-images";
  folder: string; // userId or agentId or app config key
  file: File;
}) {
  const { bucket, folder, file } = params;

  // basic validation
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }
  const maxMb = bucket === "app-images" ? 10 : 5; // 10MB for app images, 5MB for avatars
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


/**
 * Upload audio file to Supabase storage
 * Used for voice recordings before sending to backend for transcription
 */
export async function uploadAudioToBucket(params: {
  bucket: "voice-recordings";
  folder: string; // userId or aveeId
  file: File;
}) {
  const { bucket, folder, file } = params;

  // basic validation
  if (!file.type.startsWith("audio/")) {
    throw new Error("Please upload an audio file.");
  }
  
  const maxMb = 25; // OpenAI Whisper limit
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Audio file too large. Max ${maxMb}MB.`);
  }

  const allowedTypes = [
    "audio/mpeg",
    "audio/mp4", 
    "audio/wav",
    "audio/webm",
    "audio/ogg",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      "Invalid audio format. Supported: MP3, M4A, WAV, WebM, OGG"
    );
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

  // Return storage path (not public URL, since this is for processing)
  return { path };
}


/**
 * Send audio file directly to backend for transcription
 * Bypasses Supabase storage and sends file directly to FastAPI
 */
export async function transcribeAudio(
  audioFile: File,
  accessToken: string
): Promise<{
  transcription: string;
  language: string;
  duration: number | null;
}> {
  const formData = new FormData();
  formData.append("audio", audioFile);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE}/voice/transcribe`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to transcribe audio");
  }

  const data = await response.json();
  return {
    transcription: data.transcription,
    language: data.language,
    duration: data.duration,
  };
}


/**
 * Generate Avee profile from voice recording
 * Transcribes audio and uses GPT-4o to create persona, bio, display name
 */
export async function generateProfileFromVoice(
  audioFile: File,
  accessToken: string
): Promise<{
  transcript: string;
  language: string;
  profile: {
    persona: string;
    bio: string;
    display_name: string;
    suggested_handle: string;
  };
}> {
  const formData = new FormData();
  formData.append("audio", audioFile);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE}/voice/generate-profile`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to generate profile");
  }

  const data = await response.json();
  return {
    transcript: data.transcript,
    language: data.language,
    profile: data.profile,
  };
}


/**
 * Update existing Avee profile from voice recording
 */
export async function updateAveeProfileFromVoice(
  aveeId: string,
  audioFile: File,
  accessToken: string
): Promise<{
  transcript: string;
  language: string;
  updated_fields: {
    persona: string;
    bio: string;
    display_name: string;
  };
  suggested_handle: string;
}> {
  const formData = new FormData();
  formData.append("audio", audioFile);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE}/avees/${aveeId}/generate-profile-from-voice`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to update profile from voice");
  }

  return await response.json();
}


/**
 * Convert text to speech
 * Returns audio blob that can be played in browser
 */
export async function textToSpeech(
  text: string,
  options: {
    voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    hd?: boolean;
  },
  accessToken: string
): Promise<Blob> {
  const params = new URLSearchParams({
    text,
    voice: options?.voice || "alloy",
    hd: options?.hd ? "true" : "false",
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE}/chat/tts?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to convert text to speech");
  }

  return await response.blob();
}


/**
 * Convert a conversation message to speech
 */
export async function messageToSpeech(
  conversationId: string,
  messageId: string,
  accessToken: string,
  options?: {
    voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    hd?: boolean;
  }
): Promise<Blob> {
  const params = new URLSearchParams({
    message_id: messageId,
    voice: options?.voice || "alloy",
    hd: options?.hd ? "true" : "false",
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE}/chat/${conversationId}/tts?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to convert message to speech");
  }

  return await response.blob();
}
    