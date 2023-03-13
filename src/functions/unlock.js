import * as core from '@actions/core'
import {actionStatus} from './action-status'
import {LOCK_METADATA} from './lock-metadata'
import dedent from 'dedent-js'

// Constants for the lock file
const LOCK_BRANCH = LOCK_METADATA.lockBranchSuffix

// Helper function for releasing a deployment lock
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param environment: The environment to release the lock for
// :param reactionId: The ID of the reaction to add to the issue comment (only used if the lock is successfully released) (Integer)
// :param headless: A bool indicating whether or not it is a headless run (Boolean)
// :returns: true if the lock was successfully released, a string with some details if silent was used, false otherwise
export async function unlock(
  octokit,
  context,
  environment,
  reactionId,
  headless = false
) {
  try {
    if (headless) {
      core.setOutput('headless', 'true')
    } else {
      core.setOutput('headless', 'false')
    }

    var global = false
    if (environment === 'global') {
      global = true
    }

    // Delete the lock branch
    const result = await octokit.rest.git.deleteRef({
      ...context.repo,
      ref: `heads/${environment}-${LOCK_BRANCH}`
    })

    // If the lock was successfully released, return true
    if (result.status === 204) {
      core.info(`successfully removed lock`)

      // If a global lock was successfully released, set the output
      if (global === true) {
        core.setOutput('global_lock_released', 'true')
      }

      // construct the branch name and success message text
      const branchName = `${environment}-${LOCK_BRANCH}`
      var successText = ''
      if (global === true) {
        successText = '`global`'
      } else {
        successText = `\`${environment}\``
      }

      // Construct the message to add to the issue comment
      const comment = dedent(`
      ### 🔓 Deployment Lock Removed

      The ${successText} deployment lock has been successfully removed
      `)

      // If headless, exit here
      if (headless) {
        core.info(`removed lock: ${branchName}`)
        return 'removed lock - headless'
      }

      // Set the action status with the comment
      await actionStatus(context, octokit, reactionId, comment, true, true)

      // Return true
      return true
    } else {
      // If the lock was not successfully released, return false and log the HTTP code
      const comment = `failed to delete lock branch: ${environment}-${LOCK_BRANCH} - HTTP: ${result.status}`
      core.info(comment)

      // If headless, exit here
      if (headless) {
        throw new Error(comment)
      }

      await actionStatus(context, octokit, reactionId, comment, false)
      throw new Error(comment)
    }
  } catch (error) {
    // The the error caught was a 422 - Reference does not exist, this is OK - It means the lock branch does not exist
    if (error.status === 422 && error.message === 'Reference does not exist') {
      // If headless, exit here
      if (headless) {
        core.info('no deployment lock currently set - headless')
        return 'no deployment lock currently set - headless'
      }

      // Format the comment
      var noLockMsg
      if (global === true) {
        noLockMsg = '🔓 There is currently no `global` deployment lock set'
      } else {
        noLockMsg = `🔓 There is currently no \`${environment}\` deployment lock set`
      }

      // Leave a comment letting the user know there is no lock to release
      await actionStatus(context, octokit, reactionId, noLockMsg, true, true)

      // Return true since there is no lock to release
      return true
    }

    // If headless, exit here
    if (headless) {
      throw new Error(error)
    }

    // Update the PR with the error
    await actionStatus(context, octokit, reactionId, error.message, false)

    throw new Error(error)
  }
}
