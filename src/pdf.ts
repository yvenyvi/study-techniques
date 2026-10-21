import { GlobalWorkerOptions, getDocument as loadDocument } from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = worker;
export const getDocument = (options: Parameters<typeof loadDocument>[0]) =>
  loadDocument({
    ...(options as object),
    cMapUrl: "/pdf-assets/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdf-assets/standard_fonts/",
  });
