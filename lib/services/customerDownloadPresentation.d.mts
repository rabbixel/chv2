import type { CustomerDownloadItem } from "@/lib/types";

export type CustomerDownloadPresentation = {
  state: "available" | "unavailable" | "no-files";
  message: string;
};

export function getCustomerDownloadPresentation(item: CustomerDownloadItem): CustomerDownloadPresentation;
