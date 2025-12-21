"use client";

import React, { useMemo, useState } from "react";

type Props = {
  label: string;
  valueUrl?: string | null;
  onFileSelected: (file: File) => Promise<void>;
};

export default function ImageDropzone({ label, valueUrl, onFileSelected }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = "image/png,image/jpeg,image/webp";

  const preview = useMemo(() => valueUrl || null, [valueUrl]);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      await onFileSelected(file);
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="text-sm font-medium mb-2">{label}</div>

      <label
        className={[
          "block w-full rounded-xl border p-4 cursor-pointer select-none",
          isDragging ? "border-black" : "border-gray-300",
          isUploading ? "opacity-60" : "",
        ].join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
          disabled={isUploading}
        />

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-gray-500">No image</span>
            )}
          </div>

          <div className="flex-1">
            <div className="text-sm">
              {isUploading ? "Uploading..." : "Drop an image here, or click to upload"}
            </div>
            <div className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP. Max 5MB.</div>
            {error ? <div className="text-xs text-red-600 mt-2">{error}</div> : null}
          </div>
        </div>
      </label>
    </div>
  );
}
