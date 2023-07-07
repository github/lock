import * as core from '@actions/core'
import {LOCK_METADATA} from './lock-metadata'

// Helper function to check if a lock branch + lock file exists
// :param octokit: The authenticated octokit instance
// :param context: The github context
// :param branch: The branch to check for a lock file
// :returns: True if the lock file exists, false otherwise
export async function checkLockFile(octokit, context, branch) {
  try {
    // try to get the lock branch
    await octokit.rest.repos.getBranch({
      ...context.repo,
      branch: branch
    })
  } catch (error) {
    // If the lock file doesn't exist, return
    if (error.status === 404) {
      return false
    }
  }

  // If the lock branch exists, check if a lock file exists
  try {
    // Get the lock file contents
    const response = await octokit.rest.repos.getContent({
      ...context.repo,
      path: LOCK_METADATA.lockFile,
      ref: branch
    })

    // Decode the file contents to json
    var lockData
    try {
      lockData = JSON.parse(
        Buffer.from(response.data.content, 'base64').toString()
      )
    } catch (error) {
      core.warning(error.toString())
      core.warning(
        'lock file exists, but cannot be decoded - setting locked to false'
      )
      return false
    }

    if (Object.prototype.hasOwnProperty.call(lockData, 'branch')) {
      core.setOutput('branch', lockData['branch'])
    }

    if (Object.prototype.hasOwnProperty.call(lockData, 'created_by')) {
      core.setOutput('created_by', lockData['created_by'])
    }

    if (Object.prototype.hasOwnProperty.call(lockData, 'created_at')) {
      core.setOutput('created_at', lockData['created_at'])
    }

    if (Object.prototype.hasOwnProperty.call(lockData, 'reason')) {
      core.setOutput('reason', lockData['reason'])
    }

    if (Object.prototype.hasOwnProperty.call(lockData, 'link')) {
      core.setOutput('link', lockData['link'])
    }

    return true
  } catch (error) {
    // If the lock file doesn't exist, return false
    if (error.status === 404) {
      return false
    }

    // If some other error occurred, throw it
    throw new Error(error)
  }
}
