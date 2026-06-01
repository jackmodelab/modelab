'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/portal/icons';
import { getDocumentSignedUrl } from '@/lib/portal/actions';

/**
 * Download button for a client document. On click it asks the server to mint a
 * short-lived signed URL (the `client-files` bucket is private — there is no
 * direct link) and opens it in a new tab. On dummy data the storage object may
 * not exist yet, so failures surface as a small inline message rather than a
 * dead button.
 */
export function FileDownload({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleClick() {
    setError('');
    startTransition(async () => {
      const result = await getDocumentSignedUrl(documentId);
      if ('url' in result) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="file-download">
      <button
        className="btn btn--mini btn--ghost"
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Download file"
      >
        <Icon.download /> {pending ? 'Preparing…' : 'Download'}
      </button>
      {error && (
        <span className="file-download-error" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
