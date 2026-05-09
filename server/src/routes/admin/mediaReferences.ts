/**
 * Cascade helpers for media library file operations.
 *
 * When files in the R2 media library are deleted or renamed, any persistent
 * references stored in Firestore (gallery additional images, hidden image lists,
 * etc.) must be updated accordingly.
 *
 * Share URL format used throughout:  /api/public/s/{shareId}
 * Share links collection:            shared_links/{shareId} → { key: string, ... }
 *
 * On DELETE: share link docs are removed → cascade to gallery-settings
 * On RENAME/MOVE: share link docs' `key` is updated → URLs stay valid, no content update needed
 */

import { getFirestore } from "../admin.js"

interface GallerySettings {
  hiddenImages: string [ ]
  additionalImages: Record<string, string [ ]>
}

/**
 * Given a list of S3 keys that were deleted, removes all references from
 * Firestore content that stores media library URLs.
 * Called AFTER the share link docs have already been removed from Firestore.
 */
export const onFilesDeleted = async ( deletedKeys: string [ ] ): Promise<void> => {
  if ( deletedKeys.length === 0 ) return
  const db = getFirestore ( )

  // Find all share IDs for the deleted keys (they may already be deleted,
  // so we must query before the deletion batch, or accept that we check by key pattern).
  // Since the share links are deleted before this is called in the existing delete
  // flow, we instead check gallery-settings for URLs that match dead share IDs.
  // Strategy: find share links for these keys while they still exist.
  // (Called BEFORE the share links are deleted in the updated flow.)

  const shareUrlPaths: string [ ] = [ ]

  for ( const key of deletedKeys ) {
    const snapshot = await db.collection ( "shared_links" ).where ( "key", "==", key ).get ( )
    snapshot.forEach ( doc => {
      shareUrlPaths.push ( `/api/public/s/${doc.id}` )
    } )
  }

  if ( shareUrlPaths.length === 0 ) return

  await cascadeRemoveUrls ( shareUrlPaths )
}

/**
 * Given an old S3 key that was renamed/moved to a new key, updates all share
 * link documents so that their permanent URLs continue to work.
 */
export const onFileRenamed = async ( oldKey: string, newKey: string ): Promise<void> => {
  const db = getFirestore ( )
  const snapshot = await db.collection ( "shared_links" ).where ( "key", "==", oldKey ).get ( )

  if ( snapshot.empty ) return

  const batch = db.batch ( )
  snapshot.forEach ( doc => {
    batch.update ( doc.ref, { key: newKey } )
  } )
  await batch.commit ( )
}

/**
 * Given an old S3 folder prefix that was renamed/moved, updates all share link
 * documents whose keys fall under that prefix.
 */
export const onFolderRenamed = async ( oldPrefix: string, newPrefix: string ): Promise<void> => {
  const db = getFirestore ( )

  // Firestore doesn't support "starts with" queries natively, but we can use range query
  const snapshot = await db.collection ( "shared_links" )
    .where ( "key", ">=", oldPrefix )
    .where ( "key", "<", oldPrefix + "\uffff" )
    .get ( )

  if ( snapshot.empty ) return

  const batch = db.batch ( )
  snapshot.forEach ( doc => {
    const data = doc.data ( )
    if ( data [ "key" ] && typeof data [ "key" ] === "string" ) {
      const updatedKey = ( data [ "key" ] as string ).replace ( oldPrefix, newPrefix )
      batch.update ( doc.ref, { key: updatedKey } )
    }
  } )
  await batch.commit ( )
}

/**
 * Removes the given share URL paths from all known Firestore content collections.
 * Currently handles: site_content/gallery-settings
 */
const cascadeRemoveUrls = async ( shareUrlPaths: string [ ] ): Promise<void> => {
  const db = getFirestore ( )
  const pathSet = new Set ( shareUrlPaths )

  const docRef = db.collection ( "site_content" ).doc ( "gallery-settings" )
  const snap = await docRef.get ( )

  if ( !snap.exists ) return

  const data = snap.data ( ) as GallerySettings
  let changed = false

  if ( data.hiddenImages ) {
    const filtered = data.hiddenImages.filter ( url => !pathSet.has ( url ) )
    if ( filtered.length !== data.hiddenImages.length ) {
      data.hiddenImages = filtered
      changed = true
    }
  }

  if ( data.additionalImages ) {
    for ( const album of Object.keys ( data.additionalImages ) ) {
      const filtered = data.additionalImages [ album ].filter ( url => !pathSet.has ( url ) )
      if ( filtered.length !== data.additionalImages [ album ].length ) {
        data.additionalImages [ album ] = filtered
        changed = true
      }
    }
  }

  if ( changed ) {
    await docRef.set ( data )
  }
}
