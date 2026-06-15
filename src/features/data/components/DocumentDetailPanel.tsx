import React from 'react';
import { Document } from './DocumentList';
import { DocumentViewer } from './DocumentViewer';

interface DocumentDetailPanelProps {
  document: Document;
  onClose: () => void;
}

/**
 * Document Detail Panel - Wrapper for DocumentViewer
 * Maintained for backward compatibility
 */
export const DocumentDetailPanel: React.FC<DocumentDetailPanelProps> = ({
  document,
  onClose,
}) => {
  return <DocumentViewer document={document} onClose={onClose} showMetadataByDefault={false} />;
};

