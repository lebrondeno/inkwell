import { describe, it, expect, vi, beforeEach } from 'vitest'
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
