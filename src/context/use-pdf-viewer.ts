import { createContext, useContext } from "react";
import { PDFViewerApp } from "../pdf";

export const Context = createContext<PDFViewerApp | null>(null);

export function usePDFViewer(): PDFViewerApp | null {
  return useContext(Context);
}
