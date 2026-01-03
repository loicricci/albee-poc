// ADD THIS SNIPPET TO: /Users/loicricci/gabee-poc/frontend/src/app/(app)/my-agents/[handle]/page.tsx

// 1. ADD IMPORT at top of file (line ~21):
import { ReferenceImageUpload } from "@/components/ReferenceImageUpload";

// 2. ADD STATE VARIABLES (around line 108, after Twitter state):
// Reference images for OpenAI Image Edits
const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
const [referenceMaskUrl, setReferenceMaskUrl] = useState<string | null>(null);
const [imageEditInstructions, setImageEditInstructions] = useState<string | null>(null);
const [showReferenceSection, setShowReferenceSection] = useState(false);

// 3. UPDATE load() function (around line 130, after Twitter settings load):
setReferenceImageUrl(data?.reference_image_url || null);
setReferenceMaskUrl(data?.reference_image_mask_url || null);
setImageEditInstructions(data?.image_edit_instructions || null);

// 4. ADD THIS SECTION IN THE RENDER (after Twitter Settings card, search for the Twitter card and add after it):

{/* Reference Images for AutoPost (OpenAI Image Edits) */}
<div className="overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white shadow-sm">
  <div className="flex items-start sm:items-center justify-between border-b border-gray-200 bg-gray-50 px-4 sm:px-6 py-4">
    <div className="flex items-start sm:items-center gap-3">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-purple-600 shrink-0">
        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm sm:text-base font-semibold text-[#0B0B0C]">📸 Reference Images for AutoPost</h2>
        <p className="mt-1 text-xs sm:text-sm text-[#2E3A59]/70">
          Upload images for OpenAI Image Edits mode
          {referenceImageUrl && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Uploaded
          </span>}
        </p>
      </div>
    </div>
    <button
      onClick={() => setShowReferenceSection(!showReferenceSection)}
      className="rounded-lg p-2 transition-colors hover:bg-gray-200 shrink-0 ml-2"
    >
      <svg
        className={`h-5 w-5 text-[#2E3A59] transition-transform ${showReferenceSection ? "rotate-180" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>

  {showReferenceSection && (
    <div className="p-4 sm:p-6">
      <ReferenceImageUpload
        agentId={agent.id}
        agentHandle={handle}
        initialReferenceUrl={referenceImageUrl}
        initialMaskUrl={referenceMaskUrl}
        initialInstructions={imageEditInstructions}
        onUploadSuccess={() => {
          load(); // Reload agent data
        }}
      />
    </div>
  )}
</div>

// 5. ADD CSS to globals.css:
.bg-checkered {
  background-image: 
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}



