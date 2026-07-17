/**
 * ZAMAM Cloudflare R2 Upload Service
 * Relays file uploads through a secure Cloudflare Worker to avoid exposing R2 credentials.
 * 
 * Cloudflare Worker Code to Deploy (Free Plan):
 * ----------------------------------------------------
 * export default {
 *   async fetch(request, env) {
 *     // Handle CORS preflight options
 *     if (request.method === "OPTIONS") {
 *       return new Response(null, {
 *         headers: {
 *           "Access-Control-Allow-Origin": "*",
 *           "Access-Control-Allow-Methods": "POST, OPTIONS",
 *           "Access-Control-Allow-Headers": "Content-Type",
 *         }
 *       });
 *     }
 * 
 *     // Route for file upload
 *     if (request.method === "POST" && request.url.endsWith("/upload")) {
 *       try {
 *         const formData = await request.formData();
 *         const file = formData.get("file");
 *         const taskId = formData.get("taskId") || "general";
 * 
 *         if (!file || typeof file === "string") {
 *           return new Response(JSON.stringify({ success: false, error: "No file uploaded" }), {
 *             status: 400,
 *             headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
 *           });
 *         }
 * 
 *         // Create a unique filepath
 *         const filename = `tasks/${taskId}/${Date.now()}_${file.name}`;
 *         
 *         // Upload file to the R2 bucket (ZAMAM_BUCKET is the R2 binding name)
 *         await env.ZAMAM_BUCKET.put(filename, file.stream(), {
 *           httpMetadata: { contentType: file.type }
 *         });
 * 
 *         // The public URL to access the uploaded file
 *         // (Replace pub-XXXXXXXX.r2.dev with your R2 Public Bucket Domain or Custom Domain)
 *         const publicUrl = `https://pub-XXXXXXXX.r2.dev/${filename}`;
 * 
 *         return new Response(JSON.stringify({ success: true, url: publicUrl }), {
 *           headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
 *         });
 *       } catch (error) {
 *         return new Response(JSON.stringify({ success: false, error: error.toString() }), {
 *           status: 500,
 *           headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
 *         });
 *       }
 *     }
 * 
 *     return new Response("Not Found", { status: 404 });
 *   }
 * };
 * ----------------------------------------------------
 */
export const R2Service = {
  // Replace this with your deployed Cloudflare Worker URL
  uploadUrl: "https://r2-relay.XXXXXXXX.workers.dev",

  /**
   * Uploads a file to Cloudflare R2 using the Worker relay endpoint.
   */
  async uploadFile(file: File, taskId: string): Promise<{ success: boolean; url?: string; name?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskId', taskId);

      const response = await fetch(`${this.uploadUrl}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload HTTP error: ${response.statusText}`);
      }

      const result = await response.json();
      if (result && result.success) {
        return {
          success: true,
          url: result.url,
          name: file.name
        };
      }
      return { success: false };
    } catch (error) {
      console.error("R2 upload error:", error);
      return { success: false };
    }
  }
};
