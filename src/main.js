import * as core from '@actions/core'
import {triggerCheck} from './functions/trigger-check'
import {reactEmote} from './functions/react-emote'
import {actionStatus} from './functions/action-status'
import {validPermissions} from './functions/valid-permissions'
import {lock} from './functions/lock'
import {unlock} from './functions/unlock'
import {check} from './functions/check'
import {timeDiff} from './functions/time-diff'
import {LOCK_METADATA} from './functions/lock-metadata'
import {environmentTargets} from './functions/environment-targets'
import * as github from '@actions/github'
import {context} from '@actions/github'
import dedent from 'dedent-js'

// :returns: 'success', 'success - noop', 'failure', 'safe-exit', or raises an error
export async function run() {
  try {
    // Get the inputs for the branch-deploy Action
    const reaction = core.getInput('reaction')
    const prefixOnly = core.getInput('prefix_only') === 'true' // if a string of 'true' gets set to a boolean of true
    const token = core.getInput('github_token', {required: true})
    const lock_trigger = core.getInput('lock_trigger')
    const unlock_trigger = core.getInput('unlock_trigger')
    const lock_info_alias = core.getInput('lock_info_alias')
    const lock_mode = core.getInput('mode')
    const environment = core.getInput('environment') // the env to lock/unlock/check

    // Get variables from the event context
    const {owner, repo} = context.repo

    // Create an octokit client
    const octokit = github.getOctokit(token)

    // Check to see if a headless lock mode was used
    if (lock_mode === 'lock') {
      await lock(
        octokit, // octokit client
        context, // context object
        null, // ref
        null, // reactionId
        false, // sticky
        environment, // environment
        false, // detailsOnly
        true // headless
      )
      return 'success - headless'
    } else if (lock_mode === 'unlock') {
      await unlock(
        octokit, // octokit client
        context, // context object
        environment, // environment
        null, // reactionId
        true // headless
      )
      return 'success - headless'
    } else if (lock_mode === 'check') {
      await check(octokit, context, environment)
      return 'success - headless'
    }

    // Get the body of the IssueOps command
    const body = context.payload.comment.body.trim()

    // Check if the comment is a trigger and what type of trigger it is
    const isLock = await triggerCheck(prefixOnly, body, lock_trigger)
    const isUnlock = await triggerCheck(prefixOnly, body, unlock_trigger)
    const isLockInfoAlias = await triggerCheck(
      prefixOnly,
      body,
      lock_info_alias
    )

    // Check what type of trigger the comment is
    if (isLock) {
      core.setOutput('type', 'lock')
    } else if (isUnlock) {
      core.setOutput('type', 'unlock')
    } else if (isLockInfoAlias) {
      core.setOutput('type', 'lock-info-alias')
    } else {
      core.debug('No trigger found')
      core.setOutput('triggered', 'false')
      return 'safe-exit'
    }

    // If we made it this far, the action has been triggered in one manner or another
    core.setOutput('triggered', 'true')

    // Add the reaction to the issue_comment which triggered the Action
    const reactRes = await reactEmote(reaction, context, octokit)
    core.setOutput('comment_id', context.payload.comment.id)
    core.saveState('comment_id', context.payload.comment.id)
    core.saveState('reaction_id', reactRes.data.id)

    // Check to ensure the user has valid permissions
    const validPermissionsRes = await validPermissions(octokit, context)
    // If the user doesn't have valid permissions, return an error
    if (validPermissionsRes !== true) {
      await actionStatus(
        context,
        octokit,
        reactRes.data.id,
        validPermissionsRes
      )
      core.setFailed(validPermissionsRes)
      return 'failure'
    }

    // if we get here, this is a flow from an issue comment and we need to determine the environment from the comment body
    const environmentTarget = await environmentTargets(
      environment,
      body,
      lock_trigger,
      unlock_trigger,
      context,
      octokit,
      reactRes.data.id
    )

    // if no environment was found, return a failure
    if (!environmentTarget) {
      return 'failure'
    }

    // If the lock request is only for details
    if (
      LOCK_METADATA.lockInfoFlags.some(
        substring => body.includes(substring) === true
      ) ||
      isLockInfoAlias === true
    ) {
      // Get the lock details from the lock file
      const lockResponse = await lock(
        octokit, // octokit client
        context, // context object
        null, // ref
        reactRes.data.id, // reactionId
        false, // sticky
        environmentTarget, // environment
        true, // detailsOnly
        false // headless
      )

      // extract values from the lock response
      const lockData = lockResponse.lockData
      const lockStatus = lockResponse.status

      // If a lock was found when getting the lock details
      if (lockStatus !== null) {
        // Find the total time since the lock was created
        const totalTime = await timeDiff(
          lockData.created_at,
          new Date().toISOString()
        )

        // special comment for global deploy locks
        let globalMsg = ''
        let environmentMsg = `- __Environment__: \`${lockData.environment}\``
        let lockBranchName = `${lockData.environment}-${LOCK_METADATA.lockBranchSuffix}`
        if (lockData.global === true) {
          globalMsg = dedent(`

          This is a **global** deploy lock - All environments are currently locked

          `)
          environmentMsg = dedent(`
          - __Environments__: \`all\`
          - __Global__: \`true\`
          `)
          core.info('there is a global deployment lock on this repository')
          lockBranchName = LOCK_METADATA.globalLockBranch
        }

        // Format the lock details message
        const lockMessage = dedent(`
        ### Lock Details 🔒

        The deployment lock is currently claimed by __${lockData.created_by}__${globalMsg}

        - __Reason__: \`${lockData.reason}\`
        - __Branch__: \`${lockData.branch}\`
        - __Created At__: \`${lockData.created_at}\`
        - __Created By__: \`${lockData.created_by}\`
        - __Sticky__: \`${lockData.sticky}\`
        ${environmentMsg}
        - __Comment Link__: [click here](${lockData.link})
        - __Lock Link__: [click here](${process.env.GITHUB_SERVER_URL}/${owner}/${repo}/blob/${lockBranchName}/${LOCK_METADATA.lockFile})

        The current lock has been active for \`${totalTime}\`

        > If you need to release the lock, please comment \`${lockData.unlock_command}\`
        `)

        // Update the issue comment with the lock details
        await actionStatus(
          context,
          octokit,
          reactRes.data.id,
          lockMessage,
          true,
          true
        )
        core.info(
          `the deployment lock is currently claimed by __${lockData.created_by}__`
        )
        // If no lock was found when getting the lock details
      } else if (lockStatus === null) {
        // format the lock details message
        var lockCommand
        var lockTarget
        if (lockResponse.global) {
          lockTarget = 'global'
          lockCommand = `${lock_trigger} ${lockResponse.globalFlag}`
        } else {
          lockTarget = lockResponse.environment
          lockCommand = `${lock_trigger} ${lockTarget}`
        }

        const lockMessage = dedent(`
        ### Lock Details 🔒

        No active \`${lockTarget}\` deployment locks found for the \`${owner}/${repo}\` repository

        > If you need to create a \`${lockTarget}\` lock, please comment \`${lockCommand}\`
        `)

        await actionStatus(
          context,
          octokit,
          reactRes.data.id,
          lockMessage,
          true,
          true
        )
        core.info('no active deployment locks found')
      }

      // Exit the action since we are done after obtaining only the lock details with --details
      return 'safe-exit'
    }

    // Get the ref to use with the lock request
    const pr = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: context.issue.number
    })

    // If the request is a lock request, attempt to claim the lock with a sticky request with the logic below
    if (isLock) {
      // Send the lock request
      await lock(
        octokit, // octokit client
        context, // context object
        pr.data.head.ref, // ref
        reactRes.data.id, // reactionId
        true, // sticky
        environmentTarget, // environment
        false, // detailsOnly
        false // headless
      )
      return 'safe-exit'
    }

    // If the request is an unlock request, attempt to release the lock
    if (isUnlock) {
      await unlock(
        octokit, // octokit client
        context, // context object
        environmentTarget, // environment
        reactRes.data.id, // reactionId
        false // headless
      )
      return 'safe-exit'
    }

    /* istanbul ignore next */
    return 'success'
  } catch (error) {
    core.saveState('bypass', 'true')
    core.error(error.stack)
    core.setFailed(error.message)
    throw error
  }
}

/* istanbul ignore next */
if (process.env.CI === 'true') {
  run()
}
