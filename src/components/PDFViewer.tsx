import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { PDFViewerApp, PDFViewerConfig } from "../pdf";
import { Context } from "../context/use-pdf-viewer";
import { PDFDocumentProxy } from "pdfjs-dist";
import "./PDFViewer.css";

export type PDFViewerProps = PropsWithChildren<{
  config: PDFViewerConfig;
  document: PDFDocumentProxy | null;
}>;

export function PDFViewer({ children, document, config }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const [viewer, setViewer] = useState<PDFViewerApp | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const viewer = viewerRef.current;
    if (!container || !viewer) return;

    const pdfViewer = new PDFViewerApp(container, viewer, config);
    setViewer(pdfViewer);

    return () => {
      pdfViewer.destroy();
      setViewer(null);
    };
  }, [setViewer, config]);

  useEffect(() => {
    if (!viewer || !document) return;

    viewer.setDocument(document);
  }, [viewer, document]);

  return (
    <>
      <div ref={containerRef} id="pdfViewerContainer">
        <div className="pdfViewer" ref={viewerRef}></div>
      </div>

      <Context.Provider value={viewer}>{children}</Context.Provider>
    </>
  );
}
