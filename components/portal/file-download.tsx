'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/portal/icons';

type SignedUrlAction = (documentId: string) => Promise<{ url: string } | { error: string }>;

/**
 * Download button for a client document. On click it asks the server to mint a
 * short-lived signed URL (the `client-files` bucket is private — there is no
 * direct link) and opens it in a new tab. The signed-URL action is injected so
 * the same button works for staff (any client's file) and members (their own).
 * Failures surface as a small inline message rather than a dead button.
 */
export function FileDownload({ documentId, action }: { documentId: string; action: SignedUrlAction }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleClick() {
    setError('');
    startTransition(async () => {
      const result = await action(documentId);
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
