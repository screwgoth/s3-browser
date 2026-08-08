# Folder Creation, File Move, and Delete — Design

Date: 2026-08-08
Branch: `feature/folder-move-delete`

## Summary

Add three object-management capabilities to the S3 browser:

1. **Create folder** — bucket-creator, uploader, and admin roles.
2. **Move files between folders** — bucket-creator, uploader, and admin roles.
3. **Delete objects and folders** — admin role only.

All three are mutating operations, so they introduce a server-side authorization
layer that the existing S3 actions do not have.

## Motivating Constraint

The existing Server Actions in `src/actions/s3.ts` accept a full bucket config —
including AWS credentials — as an argument from the client
(`src/context/BucketContext.tsx` maps `access_key_id` / `secret_access_key` into
the client-side `Bucket` object). None of them verify the caller's role;
`uploadObject` relies entirely on the client hiding the upload button.

That posture is tolerable for upload. It is not tolerable for delete, where any
caller able to invoke the action could destroy data regardless of role, using
credentials of their choosing.

The new actions therefore take a **bucket ID**, not a config object, and resolve
credentials server-side. Existing actions are left unchanged (see Out of Scope).

## Architecture

New files:

- `src/lib/s3-authz.ts` — authorization and key-safety primitives.
- `src/actions/s3-mutations.ts` — the three Server Actions.
- `src/components/new-folder-dialog.tsx`
- `src/components/move-dialog.tsx`
- `src/components/delete-dialog.tsx`

Modified files:

- `src/hooks/use-permission.ts` — add `canCreateFolder()`, `canMove()`.
- `src/lib/scan-status.ts` — add `moveScanStatus()`, `clearScanStatusForKeys()`.
- `src/components/s3-browser.tsx` — wire up the three controls.

The new operations live in their own action module rather than being appended to
`s3.ts` (already 422 lines, mixing listing, downloads, zipping, upload, and
malware scanning). The new module's defining concern — server-resolved
authorization — is absent from the existing file, and colocating them would
invite future actions to copy the client-config pattern.

## Component 1: Authorization Layer (`src/lib/s3-authz.ts`)

### `resolveBucketForMutation(bucketId, op)`

```ts
type MutationOp = 'create-folder' | 'move' | 'delete';
```

Behaviour:

1. `getCurrentUser()` for the session-backed user.
2. Map `op` to allowed global roles:
   - `create-folder`: `uploader`, `bucket-creator`, `admin`
   - `move`: `uploader`, `bucket-creator`, `admin`
   - `delete`: `admin`
3. Reject if the user's role is not in the allowed set.
4. `getBucketById(Number(bucketId), user.id, user.role === 'admin')`, which
   returns `null` unless the user owns or is assigned the bucket, and which
   returns decrypted credentials.
5. Return `{ user, bucket, s3Config }`.

Failures throw, and write an audit log with `status: 'failure'` first.

Authorization is by **global role plus bucket access**. The per-bucket
`bucket_assignments.permission` value (`read` / `write` / `admin`) is
deliberately not consulted, matching the existing `canUploadToBucket()`
behaviour in `BucketContext.tsx`, which also ignores it. Changing that would
alter the meaning of existing shares.

### `assertWithinRoot(bucket, key)`

Normalizes and validates an object key, throwing on violation:

- Rejects `..` path segments, leading `/`, empty segments, and control
  characters.
- Rejects any key that does not start with the bucket's configured
  `root_folder` (normalized to end with `/`; a bucket with no root folder is
  confined only to the bucket itself).

Every key handled by every mutating action passes through this function before
reaching an AWS call.

## Component 2: Create Folder

**Action:** `createFolder(bucketId: string, prefix: string, name: string)`

S3 has no directories. An empty folder is represented as a zero-byte object
whose key ends in `/` — the standard representation used by the AWS console and
other S3 tools. The action constructs `${prefix}${name}/`, validates it via
`assertWithinRoot`, and issues a `PutObject` with an empty body.

**Name validation** (enforced client-side for feedback, server-side for
authority):

- Non-empty after trimming.
- No `/` characters.
- Not `.` or `..`.
- No control characters.
- Maximum 255 characters.
- Leading/trailing whitespace is trimmed rather than rejected.

**Collision handling:** before writing, `ListObjectsV2` with
`Prefix: newKey, MaxKeys: 1`. If anything exists, return
`{ success: false, message: 'A folder named … already exists here.' }`.

This check is racy under concurrent creation. The failure mode is benign: two
concurrent creates produce the same empty marker object.

**Audit:** action `folder.create`, `resource_type` `s3_object`, `resource_id`
the new key.

**UI:** a "New Folder" button in the `S3Browser` header beside Upload, gated on
`canCreateFolder()`. Opens a dialog with a single name input. On success, refetch
the current prefix.

**Interaction with existing code:** `listObjects` already skips objects with
`Size === 0` (`s3.ts:69`), so folder markers do not appear as spurious files —
they surface as folders via `CommonPrefixes`. The ZIP builders likewise skip
zero-byte objects, so an empty folder will not appear inside a downloaded ZIP.
This is accepted rather than adding folder-entry support to the zip builder.

## Component 3: Move Files

**Action:** `moveObjects(bucketId: string, keys: string[], destinationPrefix: string)`

S3 has no rename. Each file is copied (`CopyObject`, source
`${bucket}/${key}`) and then the source is deleted (`DeleteObject`). **The
delete happens only after the copy succeeds**, so a mid-operation failure leaves
the file at its source — never lost.

Files only. Folder keys passed to this action are rejected.

Per-key handling, all server-side:

- Source and destination keys both pass `assertWithinRoot`.
- Destination key is `${destinationPrefix}${basename(key)}`.
- A move whose destination equals its source is a no-op success.
- If an object already exists at the destination, the move is **skipped, not
  overwritten**, and reported as skipped.

Keys are processed sequentially. The action returns:

```ts
{ moved: string[], skipped: { key, reason }[], failed: { key, error }[] }
```

Partial success is the realistic outcome, so the dialog reports it explicitly
("3 moved, 1 skipped — already exists") rather than collapsing to a single
success/failure.

**Scan-status bookkeeping:** the `unscanned_objects` and
`scanned_clean_objects` tables are keyed by `(bucket_id, object_key)`. A new
`moveScanStatus(bucketId, fromKey, toKey)` helper in `scan-status.ts` moves any
row to the new key. Without it, a moved file would silently lose its
"scanned clean" badge, or retain an "unscanned" warning bound to a key that no
longer exists.

**Audit:** one `file.move` entry per successful key with `{ from, to }`, plus a
single `file.move.batch` summary carrying the counts.

**UI:** when files are selected and `canMove()` is true, a "Move Selected (n)"
button appears beside "Download Selected". The dialog presents a folder tree
rooted at the bucket's visible root, lazily listing child prefixes through the
existing `listObjects` action as nodes are expanded — no new listing action is
required. The current folder is preselected; the Move button is disabled while
the destination equals the current prefix. Any folders in the current selection
are excluded from the move, with a note in the dialog explaining that v1 moves
files only.

**Permission note:** a move deletes the source object. That is intrinsic to how
S3 implements a move, not a grant of delete permission — an uploader gets no
ability to remove an object except as the second half of a successful copy.

`canMove()` allows `uploader`, `bucket-creator`, and `admin` — the same set as
folder creation.

## Component 4: Delete (Admin Only)

**Action:** `deleteItems(bucketId: string, items: { key: string, type: 'file' | 'folder' }[])`

- **Files** are collected into `DeleteObjects` batches of 1000 (the S3 API
  limit).
- **Folders** are fully enumerated using the existing paginated listing pattern;
  all resulting keys — including the zero-byte folder marker itself — join the
  same batched deletes.

Guards:

- Every key passes `assertWithinRoot` before entering a batch.
- An empty prefix, or a prefix equal to the bucket's root, is rejected outright,
  so "delete folder" can never degenerate into "empty the bucket".

Returns `{ deletedCount, failed: { key, error }[] }`. S3's `DeleteObjects`
reports per-key errors rather than failing the whole batch, so partial failures
are surfaced rather than swallowed.

**Scan-status bookkeeping:** `clearScanStatusForKeys(bucketId, keys)` removes
rows for deleted keys, so a later upload to the same key does not inherit a
stale badge.

**Audit:** `file.delete` per file, `folder.delete` per prefix including the
object count, and a `file.delete.batch` summary. These are the
highest-consequence actions in the application, so `details` carries the full
key list.

**Preflight and confirmation:** a read-only action
`previewDelete(bucketId, items)` returns the object count and total bytes for
the selection, recursing into folders. It resolves through
`resolveBucketForMutation(bucketId, 'delete')` exactly as `deleteItems` does, so
a non-admin cannot use it to enumerate bucket contents. The dialog shows that
summary. Because a
folder delete is unbounded and irreversible, deleting a folder requires the
admin to **type the exact folder name** to enable the Delete button. A
files-only selection gets a plain Delete/Cancel confirmation.

**Versioning caveat:** if the S3 bucket has versioning enabled, these deletes
write delete markers and objects remain recoverable; if versioning is off,
deletion is permanent. The application does not know or record which applies.
Version-awareness is out of scope, so the confirmation dialog states "This
cannot be undone from this app" rather than promising permanence it cannot
guarantee.

**UI:** a destructive "Delete Selected (n)" button appears beside Move when the
user is an admin. On completion the list refetches and the selection clears.

## Error Handling

- Actions return result objects rather than throwing across the server/client
  boundary.
- AWS errors are caught, logged server-side with full detail, and returned to
  the client as messages that do not leak bucket ARNs or credentials.
- Authorization failures return a generic "Not authorized" — identical text
  whether the role was insufficient or the bucket is inaccessible, so responses
  cannot be used to probe which buckets exist.

## Testing

**Unit (Vitest — new to this repo, added as `npm run test`).** The genuinely
risky logic is pure and S3-free, and shipping traversal guards untested would be
the weakest point of this design. Covered:

- `assertWithinRoot`: traversal rejection, root confinement, control characters,
  leading slashes, empty segments.
- Folder-name validation rules.
- Destination-key computation for moves, including same-location no-op.
- The "prefix must not equal bucket root" delete guard.

**E2E (Playwright).** The existing suite never connects to S3 (`e2e/fixtures.ts`
uses dummy credentials), and these tests do not need it:

- Role gating in the UI: a viewer sees none of the three controls; an uploader
  sees New Folder and Move but not Delete; an admin sees all three.
- Server-side enforcement: invoking each action as an under-privileged user is
  rejected. No AWS round-trip occurs, because the role check fails first.

**Manual.** The S3 round-trips themselves — `CopyObject` ordering, batched
`DeleteObjects`, pagination over large prefixes — are verified manually against
a real bucket. No mock would meaningfully prove the copy-then-delete ordering.

## Out of Scope

- Moving or renaming folders.
- Drag-and-drop move.
- Undo / trash / soft delete.
- S3 versioning awareness.
- Migrating `listObjects`, `uploadObject`, and the download actions off
  client-supplied credentials. This is a real pre-existing weakness; the new
  actions do not share it, but fixing it belongs in its own change.
