import {
  copyFile,
  readFile,
  writeFile,
  readdir,
  stat,
  unlink,
  access,
  constants,
  mkdir,
  rename
} from "fs/promises"
import { config } from "dotenv"
import { resolve, join } from "path"

const envPath = resolve ( process.cwd ( ), ".env" )
const lockPath = resolve ( process.cwd ( ), ".env.lock" )

const backupDir = resolve ( process.cwd ( ), "env_backups" )
const lockTimeout = 30000

const CLEANUP_INTERVAL = 86400000 // 24 hours in milliseconds

// Load .env variables into process.env
let loadEnvPromise: Promise<void> | null = null
const loadEnv = async ( ) => {
  if ( loadEnvPromise ) {
    await loadEnv
  }

  loadEnvPromise = ( async ( ) => {
    if ( ! ( await fileExists ( envPath ) ) ) {
      await writeFile ( envPath, "" )
    }

    const result = config ( {
      quiet: true,
      path: envPath
    } )

    if ( result.error ) {
      console.error ( "Error Loading .env File", result.error )
      throw result.error
    }
  } ) ( )

  return loadEnvPromise
}

const createBackup = async ( ) => {
  try {
    if ( ! ( await fileExists ( backupDir ) ) ) {
      await mkdir ( backupDir )
    }

    const timestamp = new Date ( ).toISOString ( ).replace ( /[:.]/g, "-" )
    const backupPath = join ( backupDir, `env_backup_${timestamp}.env` )
    await copyFile ( envPath, backupPath )
  } catch ( e: any ) {
    console.error ( "Error Creating Backup", e )
  }
}

const restoreBackup = async ( backupPath: string ) => {
  try {
    if ( await fileExists ( backupPath ) ) {
      await copyFile ( backupPath, envPath )
    }
  } catch ( e: any ) {
    console.error ( "Error Restoring Backup", e )
  }
}

const fileExists = async ( path: string ) => {
  try {
    await access ( path, constants.F_OK )
    return true
  } catch {
    return false
  }
}

const aquireLock = async ( ) => {
  try {
    // Try to access the lock file, if it exists, another process is updating the file
    await access ( lockPath, constants.F_OK )

    // Lock file exists, check if it's stale
    await removeStaleLock ( )

    // If not, throw an error to prevent concurrent updates
    throw new Error ( "Lock file already exists. Another promise is currently updating the lock file." )
  } catch {
    await writeFile ( lockPath, `locked=${Date.now ( )}` )
  }

  // Set a timeout to release the lock automatically, if the process takes too long
  setTimeout ( releaseLock, lockTimeout )
}

const releaseLock = async ( ) => {
  try {
    if ( await fileExists ( lockPath ) ) {
      await unlink ( lockPath )
    }
  } catch {
    console.error ( "Error Releasing .env Lock" )
  }
}

// Remove a stale lock file if the process takes too long
const removeStaleLock = async ( ) => {
  try {
    const lockStats = await stat ( lockPath )
    const now = Date.now ( )
    const age = now - lockStats.mtimeMs

    if ( age > lockTimeout ) {
      await unlink ( lockPath )
    }
  } catch {
    // If the lock file doesn't exist, do nothing
  }
}

// Validates the key and value for the .env file format
const validateEnvEntry = ( key: string, value: string ) => {
  if ( !/^[A-Za-z_][A-Za-z0-9_]*$/.test ( key ) ) {
    throw new Error ( `Invalid key: ${key}` )
  }

  if ( typeof value !== "string" || /[^=\n]+%/.test ( value ) ) {
    throw new Error ( `Invalid Value for ${key}: ${value}` )
  }
}

// Preserves the format of the .env file (including comments and empty lines) while updating variables
const updateEnvContent = ( content: string, updates: Record<string, string> ) => {
  const lines = content.split ( "\n" )
  const newLines = [ ]

  // Process each line in the file, updating variables or keeping the original format
  for ( const line of lines ) {
    const trimmedLine = line.trim ( )

    // Skip empty lines and comments
    if ( !trimmedLine || trimmedLine.startsWith ( "#" ) ) {
      newLines.push ( line )
      continue
    }

    const [ key ] = trimmedLine.split ( "=" )

    if ( updates [ key ] ) {
      validateEnvEntry ( key, updates [ key ] )
      newLines.push ( `${key}=${updates [ key ]}` )
      delete updates [ key ] // Remove processed updates
    } else {
      newLines.push ( line )
    }
  }

  // Add any remaining updates for variables that were not found in the file
  for ( const [ key, value ] of Object.entries ( updates ) ) {
    validateEnvEntry ( key, value )
    newLines.push ( `${key}=${value}` )
  }

  return newLines.join ( "\n" )
}

// Update the .env file with new variables
const updateEnv = async ( updates: Record<string, string> ) => {
  try {
    // Aquire the lock to ensure no other process is updating the file concurrently
    await aquireLock ( )

    // Backup the current .env file before making changes
    await createBackup ( )

    // Read the current .env file content
    const envContent = await fileExists ( envPath ) ?
      await readFile ( envPath, "utf8" ) :
      ""

    // Preserve existing formatting and update specific variables
    const newEnvContent = updateEnvContent ( envContent, updates )

    // Write the updated content to a temporary file
    const tempPath = `${envPath}.tmp`
    await writeFile ( tempPath, newEnvContent )

    if ( !( await fileExists ( tempPath ) ) ) {
      throw new Error ( `Temporary file ${tempPath} does not exist.` )
    }
    // Replace the original .env file atomically by renaming the temp file
    try {
      console.log ( `Renaming ${tempPath} to ${envPath}` )
      await rename ( tempPath, envPath )
    } catch ( e ) {
      console.error ( "Failed to rename temporary file:", e )
    }

    // Reload the updated environment variables
    await loadEnv ( )
  } catch ( e: any ) {
    console.error ( "Error Updating .env File", e )

    // In case of error, restore the last backup
    const backupFiles = ( await readdir ( backupDir ) ).sort ( ).reverse ( )
    if ( backupFiles.length > 0 ) {
      await restoreBackup ( join ( backupDir, backupFiles [ 0 ] ) )
    }

    throw e
  } finally {
    // Release the lock after updating the file
    await releaseLock ( )
  }
}

// Manual cleanup: Delete backups older than 30 days
const cleanupOldBackups = async ( ) => {
  if ( ! ( await fileExists ( backupDir ) ) ) {
    return
  }

  const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
  const files = await readdir ( backupDir )
  const now = Date.now ( )

  for ( const file of files ) {
    const filePath = join ( backupDir, file )
    const stats = await stat ( filePath )
    const age = now - stats.mtimeMs

    if ( age > maxAge ) {
      await unlink ( filePath )
    }
  }
}

const runAutomaticCleanup = async ( ) => {
  await cleanupOldBackups ( )
}

// Run the auomatic cleanup every 24 hours
runAutomaticCleanup ( )
setInterval ( runAutomaticCleanup, CLEANUP_INTERVAL )

loadEnv ( )

export { updateEnv, loadEnv }