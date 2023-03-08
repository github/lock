import * as core from '@actions/core'
import {triggerCheck} from './functions/trigger-check'
import {reactEmote} from './functions/react-emote'
import {actionStatus} from './functions/action-status'
import {validPermissions} from './functions/valid-permissions'
import {lock} from './functions/lock'
import {unlock} from './functions/unlock'
import {check} from './functions/check'
import {timeDiff} from './functions/time-diff'
import * as github from '@actions/github'
import {context} from '@actions/github'
import dedent from 'dedent-js'

// Lock constants
const LOCK_BRANCH = 'branch-deploy-lock'
const LOCK_FILE = 'lock.json'
const BASE_URL = 'https://github.com'

// Lock info flags
const LOCK_INFO_FLAGS = ['--info', '--i', '-i', '-d', '--details', '--d']

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

    // Get variables from the event context
    const {owner, repo} = context.repo

    // Create an octokit client
    const octokit = github.getOctokit(token)

    // Check to see if a headless lock mode was used
    if (lock_mode === 'lock') {
      await lock(octokit, context, null, null, null, false, true)
      return 'success - headless'
    } else if (lock_mode === 'unlock') {
      await unlock(octokit, context, null, true)
      return 'success - headless'
    } else if (lock_mode === 'check') {
      await check(octokit, context)
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

    // If the lock request is only for details
    if (
      LOCK_INFO_FLAGS.some(substring => body.includes(substring) === true) ||
      isLockInfoAlias === true
    ) {
      // Get the lock details from the lock file
      const lockData = await lock(
        octokit,
        context,
        null,
        reactRes.data.id,
        null,
        true
      )

      // If a lock was found when getting the lock details
      if (lockData !== null) {
        // Find the total time since the lock was created
        const totalTime = await timeDiff(
          lockData.created_at,
          new Date().toISOString()
        )

        // Format the lock details message
        const lockMessage = dedent(`
            ### Lock Details 🔒

            The deployment lock is currently claimed by __${lockData.created_by}__
        
            - __Reason__: \`${lockData.reason}\`
            - __Branch__: \`${lockData.branch}\`
            - __Created At__: \`${lockData.created_at}\`
            - __Created By__: \`${lockData.created_by}\`
            - __Sticky__: \`${lockData.sticky}\`
            - __Lock Set Link__: [click here](${lockData.link})
            - __Lock Link__: [click here](${BASE_URL}/${owner}/${repo}/blob/${LOCK_BRANCH}/${LOCK_FILE})
        
            The current lock has been active for \`${totalTime}\`
        
            > If you need to release the lock, please comment \`${unlock_trigger}\`
            `)

        // Update the issue comment with the lock details
        await actionStatus(
          context,
          octokit,
          reactRes.data.id,
          // eslint-disable-next-line no-regex-spaces
          lockMessage.replace(new RegExp('    ', 'g'), ''),
          true,
          true
        )
        core.info(
          `the deployment lock is currently claimed by __${lockData.created_by}__`
        )
        // If no lock was found when getting the lock details
      } else if (lockData === null) {
        const lockMessage = dedent(`
            ### Lock Details 🔒
        
            No active deployment locks found for the \`${owner}/${repo}\` repository
        
            > If you need to create a lock, please comment \`${lock_trigger}\`
            `)

        await actionStatus(
          context,
          octokit,
          reactRes.data.id,
          // eslint-disable-next-line no-regex-spaces
          lockMessage.replace(new RegExp('    ', 'g'), ''),
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
      const sticky = true
      await lock(octokit, context, pr.data.head.ref, reactRes.data.id, sticky)
      return 'safe-exit'
    }

    // If the request is an unlock request, attempt to release the lock
    if (isUnlock) {
      await unlock(octokit, context, reactRes.data.id)
      return 'safe-exit'
    }

    return 'success'
  } catch (error) {
    core.saveState('bypass', 'true')
    core.error(error.stack)
    core.setFailed(error.message)
    return 'failure'
  }
}

/* istanbul ignore next */
if (process.env.CI === 'true') {
  run()
}
