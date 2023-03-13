import {run} from '../src/main'
import * as reactEmote from '../src/functions/react-emote'
import * as validPermissions from '../src/functions/valid-permissions'
import * as lock from '../src/functions/lock'
import * as unlock from '../src/functions/unlock'
import * as check from '../src/functions/check'
import * as environmentTargets from '../src/functions/environment-targets'
// import * as actionStatus from '../src/functions/action-status'
import * as github from '@actions/github'
import * as core from '@actions/core'
import {expect} from '@jest/globals'

const setOutputMock = jest.spyOn(core, 'setOutput')
// const saveStateMock = jest.spyOn(core, 'saveState')
// const setFailedMock = jest.spyOn(core, 'setFailed')
const debugMock = jest.spyOn(core, 'debug')

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(core, 'setOutput').mockImplementation(() => {})
  jest.spyOn(core, 'setFailed').mockImplementation(() => {})
  jest.spyOn(core, 'saveState').mockImplementation(() => {})
  jest.spyOn(core, 'info').mockImplementation(() => {})
  jest.spyOn(core, 'debug').mockImplementation(() => {})
  jest.spyOn(core, 'warning').mockImplementation(() => {})
  jest.spyOn(core, 'error').mockImplementation(() => {})
  process.env.INPUT_MODE = null
  process.env.INPUT_GITHUB_TOKEN = 'faketoken'
  process.env.INPUT_LOCK_TRIGGER = '.lock'
  process.env.INPUT_UNLOCK_TRIGGER = '.unlock'
  process.env.INPUT_REACTION = 'eyes'
  process.env.INPUT_PREFIX_ONLY = 'true'
  process.env.INPUT_LOCK_TRIGGER = '.lock'
  process.env.INPUT_UNLOCK_TRIGGER = '.unlock'
  process.env.INPUT_LOCK_INFO_ALIAS = '.wcid'
  process.env.GITHUB_REPOSITORY = 'corp/test'
  process.env.INPUT_ENVIRONMENT = 'production'
  github.context.payload = {
    issue: {
      number: 123
    },
    comment: {
      body: '.lock',
      id: 123,
      user: {
        login: 'monalisa'
      }
    }
  }

  jest.spyOn(github, 'getOctokit').mockImplementation(() => {
    return {
      rest: {
        issues: {
          createComment: jest.fn().mockReturnValueOnce({
            data: {}
          })
        },
        pulls: {
          get: jest.fn().mockImplementation(() => {
            return {data: {head: {ref: 'test-ref'}}, status: 200}
          })
        },
        reactions: {
          createForIssueComment: jest.fn().mockReturnValueOnce({
            data: {}
          }),
          deleteForIssueComment: jest.fn().mockReturnValueOnce({
            data: {}
          })
        }
      }
    }
  })
  jest.spyOn(lock, 'lock').mockImplementation(() => {
    return true
  })
  jest.spyOn(unlock, 'unlock').mockImplementation(() => {
    return true
  })
  jest.spyOn(check, 'check').mockImplementation(() => {
    return true
  })
  jest.spyOn(reactEmote, 'reactEmote').mockImplementation(() => {
    return {data: {id: '123'}}
  })
  jest.spyOn(validPermissions, 'validPermissions').mockImplementation(() => {
    return true
  })
  jest
    .spyOn(environmentTargets, 'environmentTargets')
    .mockImplementation(() => {
      return true
    })
})

test('runs successfully in lock mode', async () => {
  process.env.INPUT_MODE = 'lock'
  expect(await run()).toBe('success - headless')
})

test('runs successfully in unlock mode', async () => {
  process.env.INPUT_MODE = 'unlock'
  expect(await run()).toBe('success - headless')
})

test('runs successfully in check mode', async () => {
  process.env.INPUT_MODE = 'check'
  expect(await run()).toBe('success - headless')
})

test('successfully runs in lock mode from a comment', async () => {
  expect(await run()).toBe('safe-exit')
  expect(setOutputMock).toHaveBeenCalledWith('type', 'lock')
})

test('successfully runs in unlock mode from a comment', async () => {
  github.context.payload.comment.body = '.unlock'
  expect(await run()).toBe('safe-exit')
  expect(setOutputMock).toHaveBeenCalledWith('type', 'unlock')
})

test('successfully runs in lock info mode from a comment', async () => {
  github.context.payload.comment.body = '.wcid'
  jest.spyOn(lock, 'lock').mockImplementation(() => {
    return {
      status: 'details-only',
      lockData: {
        branch: 'octocats-everywhere',
        created_at: '2022-06-14T21:12:14.041Z',
        created_by: 'octocat',
        environment: 'production',
        global: false,
        link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
        reason: 'Testing my new feature with lots of cats',
        sticky: true,
        unlock_command: '.unlock production'
      }
    }
  })
  expect(await run()).toBe('safe-exit')
})

test('successfully runs in lock info mode from a comment for a global lock and does not find one', async () => {
  github.context.payload.comment.body = '.wcid --global'
  jest.spyOn(lock, 'lock').mockImplementation(() => {
    return {
      status: null,
      environment: null,
      global: true,
      lockData: null
    }
  })
  expect(await run()).toBe('safe-exit')
})

test('successfully runs in lock info mode from a comment for a global lock and does find one', async () => {
  github.context.payload.comment.body = '.wcid --global'
  jest.spyOn(lock, 'lock').mockImplementation(() => {
    return {
      status: 'details-only',
      environment: null,
      global: true,
      lockData: {
        branch: 'octocats-everywhere',
        created_at: '2022-06-14T21:12:14.041Z',
        created_by: 'octocat',
        environment: null,
        global: true,
        link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
        reason: 'Testing my new feature with lots of cats',
        sticky: true,
        unlock_command: '.unlock --global'
      }
    }
  })
  expect(await run()).toBe('safe-exit')
})

test('successfully runs in lock info mode from a comment and finds no lock', async () => {
  github.context.payload.comment.body = '.wcid'
  jest.spyOn(lock, 'lock').mockImplementation(() => {
    return {status: null}
  })
  expect(await run()).toBe('safe-exit')
})

test('successfully runs in lock mode from a comment and fails permissions', async () => {
  jest.spyOn(validPermissions, 'validPermissions').mockImplementation(() => {
    return false
  })
  expect(await run()).toBe('failure')
  expect(setOutputMock).toHaveBeenCalledWith('type', 'lock')
})

test('successfully runs in lock mode from a comment and fails due to a bad env', async () => {
  jest
    .spyOn(environmentTargets, 'environmentTargets')
    .mockImplementation(() => {
      return false
    })
  expect(await run()).toBe('failure')
  expect(setOutputMock).toHaveBeenCalledWith('type', 'lock')
})

test('fails due to no trigger being found', async () => {
  github.context.payload.comment.body = '.shipit'
  process.env.INPUT_TRIGGER = '.shipit'
  expect(await run()).toBe('safe-exit')
  expect(debugMock).toHaveBeenCalledWith('No trigger found')
})

test('it handles an error', async () => {
  github.context.payload = {}
  try {
    await run()
  } catch (e) {
    expect(e.message).toBe(
      "Cannot read properties of undefined (reading 'body')"
    )
  }
})
