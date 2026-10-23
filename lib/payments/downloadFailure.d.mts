export type DownloadFailureKind = "authorization" | "temporary";
export function downloadFailureKind(status: number | undefined): DownloadFailureKind;
export function downloadFailureMessage(kind: DownloadFailureKind): string;
