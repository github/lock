import * as core from '@actions/core'
import dedent from 'dedent-js'
import {actionStatus} from './action-status'
import {timeDiff} from './time-diff'
import {LOCK_METADATA} from './lock-metadata'

// Constants for the lock file
const LOCK_BRANCH = LOCK_METADATA.lockBranchSuffix
const LOCK_FILE = LOCK_METADATA.lockFile
const LOCK_COMMIT_MSG = LOCK_METADATA.lockCommitMsg
const BASE_URL = process.env.GITHUB_SERVER_URL

// Helper function for creating a lock file for branch-deployment locks
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param ref: The branch which requested the lock / deployment
// :param reason: The reason for the deployment lock
// :param sticky: A bool indicating whether the lock is sticky or not (should persist forever)
// :param environment: The environment to which the lock applies
// :param global: A bool indicating whether the lock is global or not
// :param headless: A bool indicating whether the lock is being claimed from a headless run or not
// :returns: The result of the createOrUpdateFileContents API call
async function createLock(
  octokit,
  context,
  ref,
  reason,
  sticky,
  environment,
  global,
  reactionId,
  headless
) {
  // Deconstruct the context to obtain the owner and repo
  const {owner, repo} = context.repo

  var link
  var branch
  if (headless) {
    sticky = true
    link = `${process.env.GITHUB_SERVER_URL}/${context.repo.owner}/${context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}`
    branch = 'headless mode'
  } else {
    link = `${BASE_URL}/${owner}/${repo}/pull/${context.issue.number}#issuecomment-${context.payload.comment.id}`
    branch = ref
  }

  // Construct the file contents for the lock file
  // Use the 'sticky' flag to determine whether the lock is sticky or not
  // Sticky locks will persist forever
  // Non-sticky locks will be removed if the branch that claimed the lock is deleted / merged
  const lockData = {
    reason: reason,
    branch: branch,
    created_at: new Date().toISOString(),
    created_by: context.actor,
    sticky: sticky,
    environment: environment,
    global: global,
    unlock_command: await constructUnlockCommand(environment, global),
    link: link
  }

  // Create the lock file
  const result = await octokit.rest.repos.createOrUpdateFileContents({
    ...context.repo,
    path: LOCK_FILE,
    message: LOCK_COMMIT_MSG,
    content: Buffer.from(JSON.stringify(lockData)).toString('base64'),
    branch: LOCK_BRANCH
  })

  // Write a log message stating the lock has been claimed
  core.info('deployment lock obtained')
  // If the lock is sticky, always leave a comment
  if (sticky) {
    core.info('deployment lock is sticky')

    const comment = dedent(`
    ### 🔒 Deployment Lock Claimed

    You are now the only user that can trigger deployments until the deployment lock is removed

    > This lock is _sticky_ and will persist until someone runs \`.unlock\`
    `)

    // If headless, exit here
    if (headless) {
      core.info(comment)
      return 'obtained lock - headless'
    }

    // If the lock is sticky, this means that it was invoked with `.lock` and not from a deployment
    // In this case, we update the actionStatus as we are about to exit
    await actionStatus(context, octokit, reactionId, comment, true, true)
  }

  // Return the result of the lock file creation
  return result
}

// Helper function to construct the unlock command
// :param environment: The name of the environment
// :param global: A bool indicating whether the lock is global or not
// :returns: The unlock command (String)
async function constructUnlockCommand(environment, global) {
  // fetch the unlock trigger
  const unlockTrigger = core.getInput('unlock_trigger').trim()
  // fetch the global lock flag
  const globalFlag = core.getInput('global_lock_flag').trim()

  // If the lock is global, return the global lock branch name
  if (global === true) {
    return `${unlockTrigger} ${globalFlag}`
  }

  // If the lock is not global, return the environment-specific lock branch name
  return `${unlockTrigger} ${environment}`
}

// Helper function to find a --reason flag in the comment body for a lock request
// :param context: The GitHub Actions event context
// :param sticky: A bool indicating whether the lock is sticky or not (should persist forever) - non-sticky locks are inherent from deployments
// :returns: The reason for the lock request - either a string of text or null if no reason was provided
async function findReason(context, sticky) {
  // If if not sticky, return deployment as the reason
  if (sticky === false) {
    return 'deployment'
  }

  // Get the body of the comment
  const body = context.payload.comment.body.trim()

  // Check if --reason was provided
  if (body.includes('--reason') === false) {
    // If no reason was provided, return null
    return null
  }

  // Find the --reason flag in the body
  const reasonRaw = body.split('--reason')[1]

  // Remove whitespace
  const reason = reasonRaw.trim()

  // If the reason is empty, return null
  if (reason === '') {
    return null
  }

  // Return the reason for the lock request
  return reason
}

// Helper function to create a lock branch
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param branchName: The name of the branch to create
async function createBranch(octokit, context, branchName) {
  // Determine the default branch for the repo
  const repoData = await octokit.rest.repos.get({
    ...context.repo
  })

  // Fetch the base branch's to use its SHA as the parent
  const baseBranch = await octokit.rest.repos.getBranch({
    ...context.repo,
    branch: repoData.data.default_branch
  })

  // Create the lock branch
  await octokit.rest.git.createRef({
    ...context.repo,
    ref: `refs/heads/${branchName}`,
    sha: baseBranch.data.commit.sha
  })

  core.info(`Created lock branch: ${branchName}`)
}

// Helper function to check the lock owner
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param lockData: The lock file contents
// :param sticky: A bool indicating whether the lock is sticky or not (should persist forever) - non-sticky locks are inherent from deployments
// :param reactionId: The ID of the reaction that triggered the lock request
// :return: true if the lock owner is the requestor, false if not
async function checkLockOwner(octokit, context, lockData, sticky, reactionId) {
  // If the requestor is the one who owns the lock, return 'owner'
  if (lockData.created_by === context.actor) {
    core.info(`${context.actor} is the owner of the lock`)

    // If this is a .lock (sticky) command, update with actionStatus as we are about to exit
    if (sticky) {
      // Find the total time since the lock was created
      const totalTime = await timeDiff(
        lockData.created_at,
        new Date().toISOString()
      )

      let lockMsg
      var lockBranch
      if (lockData.global === true) {
        lockMsg = 'global'
        lockBranch = LOCK_METADATA.globalLockBranch
      } else {
        lockMsg = `\`${lockData.environment}\` environment`
        lockBranch = `${lockData.environment}-${LOCK_METADATA.lockBranchSuffix}`
      }

      const youOwnItComment = dedent(`
        ### 🔒 Deployment Lock Information

        __${context.actor}__, you are already the owner of the current ${lockMsg} deployment lock

        The current lock has been active for \`${totalTime}\`

        > If you need to release the lock, please comment \`${lockData.unlock_command}\`
        `)

      await actionStatus(
        context,
        octokit,
        reactionId,
        youOwnItComment,
        true,
        true
      )
    }

    return true
  }

  // Deconstruct the context to obtain the owner and repo
  const {owner, repo} = context.repo

  // Find the total time since the lock was created
  const totalTime = await timeDiff(
    lockData.created_at,
    new Date().toISOString()
  )

  // Set the header if it is sticky or not (aka a deployment or a direct invoke of .lock)
  var header = ''
  if (sticky === true) {
    header = 'claim deployment lock'
  } else if (sticky === false) {
    header = 'proceed with deployment'
  }

  // dynamic reason text
  let reasonText = ''
  if (lockData.reason) {
    reasonText = `- __Reason__: \`${lockData.reason}\``
  }

  // dynamic lock text
  let lockText = ''
  let environmentText = ''
  if (lockData.global === true) {
    lockText = dedent(
      `the \`global\` deployment lock is currently claimed by __${lockData.created_by}__
      
      A \`global\` deployment lock prevents all other users from deploying to any environment except for the owner of the lock
      `
    )
  } else {
    lockText = `the \`${lockData.environment}\` environment deployment lock is currently claimed by __${lockData.created_by}__`
    environmentText = `- __Environment__: \`${lockData.environment}\``
  }

  // Construct the comment to add to the issue, alerting that the lock is already claimed
  const comment = dedent(`
  ### ⚠️ Cannot ${header}

  Sorry __${context.actor}__, ${lockText}

  #### Lock Details 🔒

  ${reasonText}
  ${environmentText}
  - __Branch__: \`${lockData.branch}\`
  - __Created At__: \`${lockData.created_at}\`
  - __Created By__: \`${lockData.created_by}\`
  - __Sticky__: \`${lockData.sticky}\`
  - __Global__: \`${lockData.global}\`
  - __Comment Link__: [click here](${lockData.link})
  - __Lock Link__: [click here](${process.env.GITHUB_SERVER_URL}/${owner}/${repo}/blob/${lockBranch}/${LOCK_FILE})

  The current lock has been active for \`${totalTime}\`

  > If you need to release the lock, please comment \`${lockData.unlock_command}\`
  `)

  // Set the action status with the comment
  await actionStatus(context, octokit, reactionId, comment)

  // Set the bypass state to true so that the post run logic will not run
  core.saveState('bypass', 'true')
  core.setFailed(comment)

  // Return false to indicate that the lock was not claimed
  return false
}

// Helper function to check if a lock file exists and decodes it if it does
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param branchName: The name of the branch to check
// :return: The lock file contents if it exists, false if not
async function checkLockFile(octokit, context, branchName) {
  // If the lock branch exists, check if a lock file exists
  try {
    // Get the lock file contents
    const response = await octokit.rest.repos.getContent({
      ...context.repo,
      path: LOCK_FILE,
      ref: branchName
    })

    // decode the file contents to json
    const lockData = JSON.parse(
      Buffer.from(response.data.content, 'base64').toString()
    )

    return lockData
  } catch (error) {
    // If the lock file doesn't exist, return false
    if (error.status === 404) {
      return false
    }

    // If some other error occurred, throw it
    throw new Error(error)
  }
}

// Helper function to check if a given branch exists
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param branchName: The name of the branch to check
// :return: true if the branch exists, false if not
async function checkBranch(octokit, context, branchName) {
  // Check if the lock branch already exists
  try {
    await octokit.rest.repos.getBranch({
      ...context.repo,
      branch: branchName
    })

    return true
  } catch (error) {
    // Create the lock branch if it doesn't exist
    if (error.status === 404) {
      return false
    } else {
      throw new Error(error)
    }
  }
}

// Helper function for claiming a deployment lock
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param ref: The branch which requested the lock / deployment
// :param reactionId: The ID of the reaction to add to the issue comment (use if the lock is already claimed or if we claimed it with 'sticky')
// :param sticky: A bool indicating whether the lock is sticky or not (should persist forever)
// :param environment: The environment to lock
// :param detailsOnly: A bool indicating whether to only return the details of the lock and not alter its state
// :param headless: A bool indicating whether the lock is being claimed from a headless run or not
// :returns: A lock repsponse object
// Example:
// {
//   status: 'owner' | false | true | null | 'details-only',
//   lockData: Object,
//   globalFlag: String (--global for example),
//   environment: String (production for example)
//   global: Boolean (true if the request is for a global lock)
// }
// status: 'owner' - the lock was already claimed by the requestor
// status: false - the lock was not claimed
// status: true - the lock was claimed
// status: null - no lock exists
// status: 'details-only' - the lock details were returned, but the lock was not claimed
export async function lock(
  octokit,
  context,
  ref,
  reactionId,
  sticky,
  environment,
  detailsOnly = false,
  headless = false
) {
  // check if the environment is for the global lock
  var global = false
  if (environment === 'global') {
    global = true
  }

  // find the global flag for returning
  const globalFlag = core.getInput('global_lock_flag').trim()

  // construct the lock branch name
  const branchName = `${environment}-${LOCK_BRANCH}`

  // lock debug info
  core.debug(`detected lock env: ${environment}`)
  core.debug(`detected lock global: ${global}`)
  core.debug(`constructed lock branch: ${branchName}`)

  // Attempt to obtain a reason from the context for the lock - either a string or null
  var reason
  if (headless) {
    core.setOutput('headless', 'true')
    reason = core.getInput('reason')
    if (reason === '' || reason === null || reason === undefined) {
      reason = null
    }
  } else {
    core.setOutput('headless', 'false')
    reason = await findReason(context, sticky)
  }

  // Before we can process THIS lock request, we must first check for a global lock
  // If there is a global lock, we must check if the requestor is the owner of the lock
  // We can only proceed here if there is NO global lock or if the requestor is the owner of the global lock
  // We can just jump directly to checking the lock file
  const globalLockData = await checkLockFile(
    octokit,
    context,
    LOCK_METADATA.globalLockBranch
  )

  if (globalLockData === false && detailsOnly === true && global === true) {
    // If the global lock file doesn't exist and this is a detailsOnly request for the global lock return null
    return {
      status: 'details-only',
      lockData: null,
      globalFlag,
      environment,
      global
    }
  } else if (globalLockData && detailsOnly === true) {
    // If the lock file exists and this is a detailsOnly request for the global lock, return the lock data
    return {
      status: 'details-only',
      lockData: globalLockData,
      globalFlag,
      environment,
      global
    }
  }

  // If the global lock exists, check if the requestor is the owner
  if (globalLockData) {
    // Check if the requestor is the owner of the global lock
    const globalLockOwner = await checkLockOwner(
      octokit,
      context,
      globalLockData,
      sticky,
      reactionId
    )
    if (globalLockOwner === false) {
      // If the requestor is not the owner of the global lock, return false
      return {status: false, lockData: globalLockData, globalFlag, environment, global}
    } else {
      core.info('requestor is the owner of the global lock - continuing checks')
    }
  }

  // Check if the lock branch exists
  const branchExists = await checkBranch(octokit, context, branchName)

  if (branchExists === false && detailsOnly === true) {
    // If the lock branch doesn't exist and this is a detailsOnly request, return null
    return {status: null, lockData: null, globalFlag, environment, global}
  }

  if (branchExists) {
    // Check if the lock file exists
    const lockData = await checkLockFile(octokit, context, branchName)

    if (lockData === false && detailsOnly === true) {
      // If the lock file doesn't exist and this is a detailsOnly request, return null
      return {status: null, lockData: null, globalFlag, environment, global}
    } else if (lockData && detailsOnly) {
      // If the lock file exists and this is a detailsOnly request, return the lock data
      return {
        status: 'details-only',
        lockData: lockData,
        globalFlag,
        environment,
        global
      }
    }

    if (lockData === false) {
      // If the lock files doesn't exist, we can create it here
      // Create the lock file
      await createLock(
        octokit,
        context,
        ref,
        reason,
        sticky,
        environment,
        global,
        reactionId,
        headless
      )
      return {status: true, lockData: null, globalFlag, environment, global}
    } else {
      // If the lock file exists, check if the requestor is the one who owns the lock
      const lockOwner = await checkLockOwner(
        octokit,
        context,
        lockData,
        sticky,
        reactionId
      )
      if (lockOwner === true) {
        // If the requestor is the one who owns the lock, return 'owner'
        return {
          status: headless ? 'owner-headless' : 'owner',
          lockData: lockData,
          globalFlag,
          environment,
          global
        }
      } else {
        // If the requestor is not the one who owns the lock, return false
        return {
          status: false,
          lockData: lockData,
          globalFlag,
          environment,
          global
        }
      }
    }
  }

  // If we get here, the lock branch does not exist and the detailsOnly flag is not set
  // We can now safely create the lock branch and the lock file

  // Create the lock branch if it doesn't exist
  await createBranch(octokit, context, branchName)

  // Create the lock file
  await createLock(
    octokit,
    context,
    ref,
    reason,
    sticky,
    environment,
    global,
    reactionId,
    headless
  )
  return {status: true, lockData: null, globalFlag, environment, global}
}
