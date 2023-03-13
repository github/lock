import {environmentTargets} from '../../src/functions/environment-targets'
import * as actionStatus from '../../src/functions/action-status'
import * as core from '@actions/core'
// import dedent from 'dedent-js'

const debugMock = jest.spyOn(core, 'debug').mockImplementation(() => {})
// const warningMock = jest.spyOn(core, 'warning').mockImplementation(() => {})
// const saveStateMock = jest.spyOn(core, 'saveState')

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(actionStatus, 'actionStatus').mockImplementation(() => {
    return undefined
  })
  jest.spyOn(core, 'warning').mockImplementation(() => {})
  process.env.INPUT_ENVIRONMENT_TARGETS = 'production,development,staging'
  process.env.INPUT_GLOBAL_LOCK_FLAG = '--global'
  process.env.INPUT_LOCK_INFO_ALIAS = '.wcid'
})

const environment = 'production'

test('checks the comment body on a lock request and uses the default environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.lock', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('production')
  expect(debugMock).toHaveBeenCalledWith(
    'Using default environment for lock request'
  )
})

test('checks the comment body on an unlock request and uses the default environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.unlock', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('production')
  expect(debugMock).toHaveBeenCalledWith(
    'Using default environment for unlock request'
  )
})

test('checks the comment body on a lock info alias request and uses the default environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.wcid', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('production')
  expect(debugMock).toHaveBeenCalledWith(
    'Using default environment for lock info request'
  )
})

test('checks the comment body on a lock request and uses the production environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.lock production', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('production')
  expect(debugMock).toHaveBeenCalledWith(
    'Found environment target for lock request: production'
  )
})

test('checks the comment body on an unlock request and uses the development environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.unlock development', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('development')
  expect(debugMock).toHaveBeenCalledWith(
    'Found environment target for unlock request: development'
  )
})

test('checks the comment body on a lock info alias request and uses the development environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.wcid development', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('development')
  expect(debugMock).toHaveBeenCalledWith(
    'Found environment target for lock info request: development'
  )
})

test('checks the comment body on a lock info request and uses the development environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.lock --info development', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('development')
  expect(debugMock).toHaveBeenCalledWith(
    'Found environment target for lock request: development'
  )
})

test('checks the comment body on a lock info request and uses the global environment', async () => {
  expect(
    await environmentTargets(
      environment,
      '.lock --info --global', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('global')
  expect(debugMock).toHaveBeenCalledWith(
    'Global lock flag found in environment target check'
  )
})

test('checks the comment body on a lock info request and uses the development environment (using -d)', async () => {
  expect(
    await environmentTargets(
      environment,
      '.lock -d development', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe('development')
  expect(debugMock).toHaveBeenCalledWith(
    'Found environment target for lock request: development'
  )
})

test('checks the comment body on a lock info request and finds no matching environment', async () => {
  const actionStatusSpy = jest.spyOn(actionStatus, 'actionStatus')
  expect(
    await environmentTargets(
      environment,
      '.lock -d potato', // comment body
      '.lock', // lock trigger
      '.unlock', // unlock trigger
      null, // context
      null, // octokit
      null // reaction_id
    )
  ).toBe(false)
  expect(actionStatusSpy).toHaveBeenCalledWith(
    null,
    null,
    null,
    expect.stringContaining('No matching environment target found')
  )
})
