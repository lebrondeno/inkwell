import { useState } from 'react'
import { supabase, upsertProfile } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import styles from './Profile.module.css'

export default function Profile() {
  const { user, showToast } = useApp()
  const [name, setName] = useState(user?.user_metadata?.full_name || '')
  const [bio, setBio] = useState(user?.user_metadata?.bio || '')
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const displayName = name || user?.email?.split('@')[0] || 'Writer'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const saveProfile = async () => {
    setSaving(true)
    // Update auth metadata
    const { error } = await supabase.auth.updateUser({ data: { full_name: name, bio } })
    // Also upsert into writer_profiles so it's publicly readable
    if (!error && user) {
      await upsertProfile(user.id, name, bio)
    }
    setSaving(false)
    if (error) showToast(error.message, 'error')
    else showToast('Profile updated successfully')
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
        {/* Left — avatar & identity */}
        <div className={styles.leftCol}>
          <div className={styles.avatarCard}>
            <div className={styles.avatar}>{initials}</div>
            <h2>{displayName}</h2>
            <p>{user?.email}</p>
            {bio && <p className={styles.bio}>{bio}</p>}
            <div className={styles.badge}>
              <span>✦</span>
              <span>Inkwell Writer</span>
            </div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Member since</span>
              <span className={styles.infoValue}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Plan</span>
              <span className={styles.infoValue} style={{ color: 'var(--accent)' }}>Free — All Features</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Public Profile</span>
              <span className={styles.infoValue} style={{ color: 'var(--green)', fontSize: '12px' }}>Visible to all readers</span>
            </div>
          </div>
        </div>

        {/* Right — forms */}
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
                <label>Bio <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(shown on your public profile)</span></label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell readers a little about yourself…"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <h3>Change Password</h3>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
            </div>
            <button className="btn btn-ghost" onClick={changePassword} disabled={changingPw || !newPassword}>
              {changingPw ? 'Updating…' : 'Update Password'}
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
