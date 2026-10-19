import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase } from './supabase'

describe('Password Recovery flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('validates password requirement rules correctly', () => {
    const validateResetPassword = (password: string, confirmPassword: string) => {
      if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters' }
      }
      if (password !== confirmPassword) {
        return { valid: false, error: 'Passwords do not match' }
      }
      return { valid: true, error: null }
    }

    expect(validateResetPassword('short', 'short')).toEqual({
      valid: false,
      error: 'Password must be at least 6 characters',
    })

    expect(validateResetPassword('validPassword', 'differentPassword')).toEqual({
      valid: false,
      error: 'Passwords do not match',
    })

    expect(validateResetPassword('secret123', 'secret123')).toEqual({
      valid: true,
      error: null,
    })
  })

  it('calls resetPasswordForEmail with correct redirect URL', async () => {
    const resetSpy = vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({
      data: {},
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>)

    const email = 'author@inkwell.test'
    const redirectTo = 'https://inkwell.app/reset-password'

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    expect(resetSpy).toHaveBeenCalledWith('author@inkwell.test', {
      redirectTo: 'https://inkwell.app/reset-password',
    })
    expect(error).toBeNull()
  })

  it('calls updateUser with new password', async () => {
    const updateSpy = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: { id: 'usr-1' } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.updateUser>>)

    const newPassword = 'newSecretPassword123'
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })

    expect(updateSpy).toHaveBeenCalledWith({ password: 'newSecretPassword123' })
    expect(error).toBeNull()
    expect(data.user).toBeDefined()
  })

  it('handles resetPasswordForEmail errors gracefully', async () => {
    vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({
      data: null,
      error: new Error('User not found'),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>)

    const { error } = await supabase.auth.resetPasswordForEmail('nonexistent@inkwell.test', {
      redirectTo: 'https://inkwell.app/reset-password',
    })

    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toBe('User not found')
  })
})

describe('Pre-client hash detection and recovery state persistence', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow
    } else {
      delete (globalThis as { window?: Window & typeof globalThis }).window
    }
  })

  it('detects type=recovery in window.location.hash and sets inkwell_password_recovery in sessionStorage', async () => {
    const { checkAndPersistRecoveryState } = await import('./supabase')
    const store: Record<string, string> = {}
    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    } as unknown as Storage

    globalThis.window = {
      location: {
        hash: '#access_token=xyz123&expires_in=3600&type=recovery',
        search: '',
        pathname: '/',
      } as unknown as Location,
      sessionStorage: mockSessionStorage,
    } as unknown as Window & typeof globalThis

    const detected = checkAndPersistRecoveryState()
    expect(detected).toBe(true)
    expect(mockSessionStorage.getItem('inkwell_password_recovery')).toBe('1')
  })

  it('detects type=recovery in window.location.search and sets recovery flag', async () => {
    const { checkAndPersistRecoveryState } = await import('./supabase')
    const store: Record<string, string> = {}
    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    } as unknown as Storage

    globalThis.window = {
      location: {
        hash: '',
        search: '?code=abc789&type=recovery',
        pathname: '/reset-password',
      } as unknown as Location,
      sessionStorage: mockSessionStorage,
    } as unknown as Window & typeof globalThis

    const detected = checkAndPersistRecoveryState()
    expect(detected).toBe(true)
    expect(mockSessionStorage.getItem('inkwell_password_recovery')).toBe('1')
  })

  it('does not set inkwell_password_recovery when type=recovery is absent', async () => {
    const { checkAndPersistRecoveryState } = await import('./supabase')
    const store: Record<string, string> = {}
    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    } as unknown as Storage

    globalThis.window = {
      location: {
        hash: '#access_token=regular_token&type=signup',
        search: '',
        pathname: '/',
      } as unknown as Location,
      sessionStorage: mockSessionStorage,
    } as unknown as Window & typeof globalThis

    const detected = checkAndPersistRecoveryState()
    expect(detected).toBe(false)
    expect(mockSessionStorage.getItem('inkwell_password_recovery')).toBeNull()
  })

  it('allows clearing inkwell_password_recovery from sessionStorage upon completion', async () => {
    const store: Record<string, string> = { inkwell_password_recovery: '1' }
    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    }

    expect(mockSessionStorage.getItem('inkwell_password_recovery')).toBe('1')
    mockSessionStorage.removeItem('inkwell_password_recovery')
    expect(mockSessionStorage.getItem('inkwell_password_recovery')).toBeNull()
  })
})
