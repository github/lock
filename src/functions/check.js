import * as core from '@actions/core'
import {LOCK_METADATA} from './lock-metadata'
import {checkLockFile} from './checkLockFile'

// Helper function for checking if a deployment lock exists
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param environment: The environment to check for a lock
// :returns: true if the lock exists, false if it does not
export async function check(octokit, context, environment) {
  // check is always a headless run
  core.setOutput('headless', 'true')

  // first, check if a global lock exists
  const globalLockExists = await checkLockFile(
    octokit,
    context,
    LOCK_METADATA.globalLockBranch
  )
  if (globalLockExists) {
    core.info('global lock exists')
    core.setOutput('locked', 'true')
    core.setOutput('lock_environment', 'global')
    return true
  } else {
    core.info('global lock does not exist')

    // if this is request only for the global lock, return
    if (environment === 'global') {
      core.info('no global lock exists')
      core.setOutput('locked', 'false')
      return false
    }
  }

  // if a global lock does not exist, check if a lock exists for the environment
  const lockBranch = `${environment}-${LOCK_METADATA.lockBranchSuffix}`
  const environmentLockExists = await checkLockFile(
    octokit,
    context,
    lockBranch
  )
  if (environmentLockExists) {
    core.info(`${environment} lock exists`)
    core.setOutput('locked', 'true')
    core.setOutput('lock_environment', environment)
    return true
  } else {
    core.info(`${environment} lock does not exist`)
    core.setOutput('locked', 'false')
    return false
  }
}
