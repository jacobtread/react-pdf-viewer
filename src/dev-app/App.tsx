import * as pdfjsLib from "pdfjs-dist";
globalThis.pdfjsLib = pdfjsLib;

import { useEffect, useState } from "react";
import { PDFViewer } from "../components/PDFViewer";
import { PDFViewerConfig } from "../pdf";
import { getDocument, PDFDocumentProxy } from "pdfjs-dist";

import "pdfjs-dist/build/pdf.worker.mjs";

const config: PDFViewerConfig = { enableHWA: true };

function App() {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    (async () => {
      // Loading document.
      const loadingTask = getDocument({
        url: "/sample.pdf",

        withCredentials: true,
      });

      // loadingTask.onPassword = (updateCallback, reason) => {};

      const pdfDocument = await loadingTask.promise;
      setDocument(pdfDocument);
    })();
  }, [setDocument]);

  return (
    <>
      <div style={{ width: "100%", height: "100vh", position: "relative" }}>
        <PDFViewer config={config} document={document} />
      </div>
    </>
  );
}

export default App;
