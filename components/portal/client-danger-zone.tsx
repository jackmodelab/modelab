'use client';

import { useState } from 'react';
import { archiveClient, reactivateClient, deleteClient, resendInvite } from '@/lib/portal/actions';

/**
 * Staff-only client lifecycle controls on the client detail page.
 *  - Resend invite (active + not signed up yet): re-email the set-password link.
 *  - Archive (active) / Reactivate (archived): retain data, toggle access.
 *  - Delete: permanent, gated behind typing the client's exact name.
 */
export function ClientDangerZone({
  clientId,
  clientName,
  archived,
  pendingInvite,
  nameError,
}: {
  clientId: string;
  clientName: string;
  archived: boolean;
  pendingInvite?: boolean;
  nameError?: boolean;
}) {
  const [confirm, setConfirm] = useState('');
  const expected = (clientName || '').trim();
  // With no name on file there's nothing to type — block delete to avoid an
  // un-typeable confirmation (staff can still archive).
  const canDelete = expected.length > 0 && confirm.trim().toLowerCase() === expected.toLowerCase();

  return (
    <section className="surface" style={{ marginTop: 20, borderColor: 'var(--danger-soft)' }}>
      <div className="surface-head">
        <h2>Manage client</h2>
        <span className={`pill ${archived ? '' : 'pill--ok'}`}>{archived ? 'Archived' : 'Active'}</span>
      </div>
      <div className="surface-body--pad" style={{ display: 'grid', gap: 18 }}>
        {/* Resend invite — only useful while they haven't set up access yet */}
        {pendingInvite && !archived && (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Resend invite</div>
            <p style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.5, maxWidth: '60ch' }}>
              This client hasn’t set up their account yet. Resend the email with a fresh link to set
              their password and access the member portal.
            </p>
            <form action={resendInvite} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={clientId} />
              <button className="btn btn--mini" type="submit">Resend invite email</button>
            </form>
          </div>
        )}

        {/* Archive / Reactivate */}
        <div>
          {archived ? (
            <>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Reactivate client</div>
              <p style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.5, maxWidth: '60ch' }}>
                Restores portal access and emails them a fresh sign-in link.
              </p>
              <form action={reactivateClient} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={clientId} />
                <button className="btn btn--mini" type="submit">Reactivate &amp; email link</button>
              </form>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Archive client</div>
              <p style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.5, maxWidth: '60ch' }}>
                Keeps all their history but removes them from active lists and signs them out of the
                member portal. You can reactivate them at any time.
              </p>
              <form action={archiveClient} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={clientId} />
                <button className="btn btn--mini btn--ghost" type="submit">Archive</button>
              </form>
            </>
          )}
        </div>

        {/* Permanent delete */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4, color: 'var(--danger)' }}>
            Delete permanently
          </div>
          <p style={{ color: 'var(--slate)', fontSize: 13, lineHeight: 1.5, maxWidth: '60ch' }}>
            Erases this client and all their bookings, packages and files from the database. This cannot
            be undone. Type <strong>{expected || 'their name'}</strong> to confirm.
          </p>
          {nameError && (
            <p className="file-download-error" role="status" style={{ marginTop: 8 }}>
              That name didn’t match — nothing was deleted.
            </p>
          )}
          <form action={deleteClient} style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="hidden" name="id" value={clientId} />
            <input
              name="confirm_name"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={expected || 'No name on file'}
              autoComplete="off"
              disabled={expected.length === 0}
              style={{ maxWidth: 280 }}
            />
            <button className="btn btn--mini btn--danger" type="submit" disabled={!canDelete}>
              Delete client
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
