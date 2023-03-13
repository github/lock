import * as core from '@actions/core'
import {unlock} from '../../src/functions/unlock'
import * as actionStatus from '../../src/functions/action-status'

class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.status = 422
  }
}

const setOutputMock = jest.spyOn(core, 'setOutput')

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(actionStatus, 'actionStatus').mockImplementation(() => {
    return undefined
  })
  jest.spyOn(core, 'info').mockImplementation(() => {})
  jest.spyOn(core, 'debug').mockImplementation(() => {})
  jest.spyOn(core, 'setOutput').mockImplementation(() => {})
})

const environment = 'production'

const context = {
  repo: {
    owner: 'corp',
    repo: 'test'
  },
  issue: {
    number: 1
  }
}

const octokit = {
  rest: {
    git: {
      deleteRef: jest.fn().mockReturnValue({status: 204})
    }
  }
}

test('successfully releases a deployment lock with the unlock function', async () => {
  expect(await unlock(octokit, context, environment, 123)).toBe(true)
  expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith({
    owner: 'corp',
    repo: 'test',
    ref: 'heads/production-branch-deploy-lock'
  })
})

test('successfully releases a GLOBAL deployment lock with the unlock function', async () => {
  expect(await unlock(octokit, context, 'global', 123)).toBe(true)
  expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith({
    owner: 'corp',
    repo: 'test',
    ref: 'heads/global-branch-deploy-lock'
  })
  expect(setOutputMock).toHaveBeenCalledWith('global_lock_released', 'true')
})

test('successfully releases a deployment lock with the unlock function - headless mode', async () => {
  expect(await unlock(octokit, context, environment, 123, true)).toBe(
    'removed lock - headless'
  )
  expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith({
    owner: 'corp',
    repo: 'test',
    ref: 'heads/production-branch-deploy-lock'
  })
})

test('fails to release a deployment lock due to a bad HTTP code from the GitHub API - headless mode', async () => {
  octokit.rest.git.deleteRef = jest.fn().mockReturnValue({status: 500})

  await expect(
    unlock(octokit, context, environment, 123, true)
  ).rejects.toThrow(
    'Error: failed to delete lock branch: production-branch-deploy-lock - HTTP: 500'
  )

  expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith({
    owner: 'corp',
    repo: 'test',
    ref: 'heads/production-branch-deploy-lock'
  })

  expect(setOutputMock).toHaveBeenCalledWith('headless', 'true')
})

test('throws an error if an unhandled exception occurs - headless mode', async () => {
  octokit.rest.git.deleteRef = jest.fn().mockRejectedValue(new Error('oh no'))
  try {
    await unlock(octokit, context, environment, 123, true)
  } catch (e) {
    expect(e.message).toBe('Error: oh no')
  }
})

test('Does not find a deployment lock branch so it lets the user know - headless mode', async () => {
  octokit.rest.git.deleteRef = jest
    .fn()
    .mockRejectedValue(new NotFoundError('Reference does not exist'))
  expect(await unlock(octokit, context, environment, 123, true)).toBe(
    'no deployment lock currently set - headless'
  )
})

test('fails to release a deployment lock due to a bad HTTP code from the GitHub API - headless', async () => {
  octokit.rest.git.deleteRef = jest.fn().mockReturnValue({status: 500})

  await expect(
    unlock(octokit, context, environment, 123, true)
  ).rejects.toThrow(
    'Error: failed to delete lock branch: production-branch-deploy-lock - HTTP: 500'
  )

  expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith({
    owner: 'corp',
    repo: 'test',
    ref: 'heads/production-branch-deploy-lock'
  })

  expect(setOutputMock).toHaveBeenCalledWith('headless', 'true')
})

test('fails to release a deployment lock due to a bad HTTP code from the GitHub API', async () => {
  octokit.rest.git.deleteRef = jest.fn().mockReturnValue({status: 500})
  const actionStatusSpy = jest
    .spyOn(actionStatus, 'actionStatus')
    .mockImplementation(() => {
      return undefined
    })

  await expect(
    unlock(octokit, context, environment, 123, false)
  ).rejects.toThrow(
    'Error: failed to delete lock branch: production-branch-deploy-lock - HTTP: 500'
  )

  expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith({
    owner: 'corp',
    repo: 'test',
    ref: 'heads/production-branch-deploy-lock'
  })

  expect(setOutputMock).toHaveBeenCalledWith('headless', 'false')
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    'failed to delete lock branch: production-branch-deploy-lock - HTTP: 500',
    false
  )
})

test('Does not find a deployment lock branch so it lets the user know', async () => {
  const actionStatusSpy = jest
    .spyOn(actionStatus, 'actionStatus')
    .mockImplementation(() => {
      return undefined
    })
  octokit.rest.git.deleteRef = jest
    .fn()
    .mockRejectedValue(new NotFoundError('Reference does not exist'))
  expect(await unlock(octokit, context, environment, 123)).toBe(true)
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    '🔓 There is currently no `production` deployment lock set',
    true,
    true
  )
})

test('Does not find a GLOBAL deployment lock branch so it lets the user know', async () => {
  const actionStatusSpy = jest
    .spyOn(actionStatus, 'actionStatus')
    .mockImplementation(() => {
      return undefined
    })
  octokit.rest.git.deleteRef = jest
    .fn()
    .mockRejectedValue(new NotFoundError('Reference does not exist'))
  expect(await unlock(octokit, context, 'global', 123)).toBe(true)
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    '🔓 There is currently no `global` deployment lock set',
    true,
    true
  )
})

test('throws an error if an unhandled exception occurs', async () => {
  octokit.rest.git.deleteRef = jest.fn().mockRejectedValue(new Error('oh no'))
  try {
    await unlock(octokit, context, environment, 123)
  } catch (e) {
    expect(e.message).toBe('Error: oh no')
  }
})
