import { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import '../../styles/PDFViewer.css';

// Configure PDF.js worker (required)
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PDFViewer({ pdfUrl }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfError, setPdfError] = useState(null);
  const [isValidPdf, setIsValidPdf] = useState(false);

  // Verify PDF URL before rendering
  useEffect(() => {
    const verifyPdf = async () => {
      try {
        const response = await fetch(pdfUrl, { method: 'HEAD' });
        
        if (!response.ok) {
          throw new Error('PDF not found');
        }

        const contentType = response.headers.get('content-type');
        if (contentType !== 'application/pdf') {
          throw new Error('URL does not point to a PDF file');
        }

        setIsValidPdf(true);
      } catch (err) {
        setPdfError(err.message);
        setIsValidPdf(false);
      }
    };

    if (pdfUrl) {
      verifyPdf();
    }
  }, [pdfUrl]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPdfError(null);
  }

  function onDocumentLoadError(error) {
    console.error('PDF load error:', error);
    setPdfError('Failed to load PDF. Please check the URL or authentication.');
  }

  // PDF loading options with auth headers if needed
  const pdfOptions = {
    httpHeaders: {
      Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`
    }
  };

  // ✅ Memoize file prop to avoid unnecessary re-renders
  const memoizedFile = useMemo(() => ({
    url: pdfUrl,
    ...pdfOptions
  }), [pdfUrl]);

  if (pdfError) {
    return (
      <div className="pdf-error-container">
        <h3>PDF Viewer Error</h3>
        <p>{pdfError}</p>
        {pdfUrl && (
          <p className="pdf-url">URL: <code>{pdfUrl}</code></p>
        )}
      </div>
    );
  }

  if (!isValidPdf) {
    return <div className="pdf-loading">Verifying PDF...</div>;
  }

  return (
    <div className="pdf-viewer-container">
      <Document
        file={memoizedFile}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={<div className="pdf-loading">Loading PDF document...</div>}
        error={<div className="pdf-error">Error loading PDF document</div>}
      >
        <Page 
          pageNumber={pageNumber}
          width={600}
          loading={<div className="page-loading">Loading page {pageNumber}...</div>}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>

      {numPages && (
        <div className="pdf-navigation">
          <button
            onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
            disabled={pageNumber <= 1}
          >
            ← Previous
          </button>
          <span className="page-counter">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
            disabled={pageNumber >= numPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
