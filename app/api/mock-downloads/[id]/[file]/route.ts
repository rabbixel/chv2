import { getDownloadService } from "@/lib/services";

interface MockDownloadRouteParams {
  params: Promise<{ id: string; file: string }>;
}

/**
 * Mock-mode placeholder file (scaffold only). Production serves the real
 * bytes from a short-lived backend-signed S3 URL — this route exists so
 * the `requestDownloadUrl()` flow is clickable end to end in mock mode.
 * No credentials of any kind live here.
 */
export async function GET(
  _request: Request,
  { params }: MockDownloadRouteParams,
) {
  if (process.env.USE_MOCK_API === "false") {
    return new Response("Not found", { status: 404 });
  }
  const { id, file } = await params;
  const downloads = await getDownloadService().listDownloads();
  const download = downloads.find(
    (entry) => entry.id === id && entry.fileName === file,
  );
  if (!download) {
    return new Response("Not found", { status: 404 });
  }
  const body = [
    "Creative Hatti — mock download placeholder.",
    "",
    `Product: ${download.productTitle}`,
    `File: ${download.fileName}`,
    `Order: ${download.orderId}`,
    "",
    "The backend serves the real file through a short-lived signed URL.",
    "This placeholder only exists so the download flow works in mock mode.",
    "",
  ].join("\n");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${download.fileName}.mock.txt"`,
    },
  });
}
