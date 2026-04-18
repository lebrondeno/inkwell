import { useState, useRef } from 'react'
import { supabase, upsertProfile } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './Profile.module.css'

export default function Profile() {
  const { user, showToast } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName]           = useState(user?.user_metadata?.full_name || '')
  const [bio, setBio]             = useState(user?.user_metadata?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '')
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [changingPw, setChangingPw]   = useState(false)

  const displayName = name || user?.email?.split('@')[0] || 'Writer'
  const initials    = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return }

    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) { showToast(uploadError.message, 'error'); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const urlWithCache = `${publicUrl}?t=${Date.now()}`

    // Save to auth metadata + writer_profiles
    await supabase.auth.updateUser({ data: { avatar_url: urlWithCache } })
    await upsertProfile(user.id, name, bio, urlWithCache)

    setAvatarUrl(urlWithCache)
    showToast('Profile picture updated ✦')
    setUploading(false)
  }

  const saveProfile = async () => {
    if (!user) return
    setSaving(true)
    await Promise.all([
      supabase.auth.updateUser({ data: { full_name: name, bio } }),
      upsertProfile(user.id, name, bio, avatarUrl),
    ])
    setSaving(false)
    showToast('Profile saved')
  }

  const changePassword = async () => {
    if (newPassword.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
    setChangingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPw(false)
    if (error) showToast(error.message, 'error')
    else { showToast('Password updated'); setNewPassword('') }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Profile</h1>
        <p>Manage your writer identity</p>
      </div>

      <div className={styles.layout}>
        {/* Left column */}
        <div className={styles.leftCol}>
          <div className={styles.avatarCard}>
            {/* Avatar */}
            <div className={styles.avatarWrap} onClick={() => fileRef.current?.click()}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className={styles.avatarImg} />
                : <div className={styles.avatarInitials}>{initials}</div>
              }
              <div className={styles.avatarOverlay}>
                {uploading ? '...' : '📷'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={uploadAvatar} />
            <p className={styles.avatarHint}>Click photo to change · Max 2MB</p>

            <h2>{displayName}</h2>
            <p className={styles.email}>{user?.email}</p>
            {bio && <p className={styles.bio}>{bio}</p>}
            <div className={styles.badge}><span>✦</span><span>Inkwell Writer</span></div>
          </div>

          <div className={styles.infoCard}>
            {[
              { label: 'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—' },
              { label: 'Plan', value: 'Free — All Features', accent: true },
              { label: 'AI Engine', value: 'Gemini 2.0 Flash' },
            ].map(r => (
              <div key={r.label} className={styles.infoRow}>
                <span className={styles.infoLabel}>{r.label}</span>
                <span className={styles.infoValue} style={r.accent ? { color: 'var(--accent)' } : {}}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className={styles.rightCol}>
          <div className={styles.section}>
            <h3>Personal Information</h3>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className={styles.field}>
                <label>Email</label>
                <input value={user?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
              </div>
              <div className={styles.field}>
                <label>Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="A short bio for your public profile..." rows={3} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <h3>Change Password</h3>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
            </div>
            <button className="btn btn-ghost" onClick={changePassword} disabled={changingPw || !newPassword}>
              {changingPw ? 'Updating...' : 'Update Password'}
            </button>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <h3 style={{ color: 'var(--red)' }}>Danger Zone</h3>
            <p className={styles.dangerDesc}>Signing out will end your current session. Your articles are safely stored.</p>
            <button className="btn btn-danger" onClick={() => supabase.auth.signOut()}>Sign Out</button>
          </div>
        </div>
      </div>
    </div>
  )
}
