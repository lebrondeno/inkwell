import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, getCommunity, getCommunityPosts, getCommunityMembers,
  getUserCommunityRole, joinCommunity, leaveCommunity, reviewCommunityPost,
  promoteToAdmin, updateCommunity, deleteCommunity, deleteCommunityPost } from '../../lib/supabase'
import type { Community, CommunityPost } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import VerseOfDay from '../../components/VerseOfDay'
import PublicNav from '../../components/PublicNav'
import styles from './CommunityPage.module.css'
import { formatDistanceToNow } from 'date-fns'

type Tab = 'feed' | 'members' | 'queue'

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, showToast } = useApp()

  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts]         = useState<CommunityPost[]>([])
  const [pending, setPending]     = useState<CommunityPost[]>([])
  const [members, setMembers]     = useState<any[]>([])
  const [role, setRole]           = useState<'admin' | 'member' | null>(null)
  const [tab, setTab]             = useState<Tab>('feed')
  const [loading, setLoading]     = useState(true)
  const [memberCount, setMemberCount] = useState(0)

  // Submit article modal
  const [showSubmit, setShowSubmit] = useState(false)
  const [myArticles, setMyArticles] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Edit community modal
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', emoji: '', category: '' })
  const [updating, setUpdating] = useState(false)

  const postCardRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => { if (slug) load() }, [slug, user])

  useEffect(() => {
    if (!loading && tab === 'feed') {
      postCardRefs.current.forEach((el, i) => {
        if (!el) return
        setTimeout(() => { el.classList.add(styles.visible) }, i * 60)
      })
    }
  }, [loading, posts, tab])

  const load = async () => {
    const c = await getCommunity(slug!)
    if (!c) { navigate('/communities'); return }
    setCommunity(c)

    const [approvedPosts, allMembers, { count: mc }] = await Promise.all([
      getCommunityPosts(c.id, 'approved'),
      getCommunityMembers(c.id),
      supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', c.id),
    ])
    setPosts(approvedPosts)
    setMembers(allMembers)
    setMemberCount(mc || 0)

    if (user) {
      const r = await getUserCommunityRole(c.id, user.id)
      setRole(r as "member" | "admin" | null)
      if (r === 'admin') {
        const pendingPosts = await getCommunityPosts(c.id, 'pending')
        setPending(pendingPosts)
      }
    }
    setLoading(false)
  }

  const handleJoin = async () => {
    if (!user) { navigate('/'); return }
    await joinCommunity(community!.id, user.id)
    setRole('member')
    setMemberCount(m => m + 1)
    showToast('Joined community!')
  }

  const handleLeave = async () => {
    if (role === 'admin') { showToast('Admins cannot leave — transfer admin first', 'error'); return }
    await leaveCommunity(community!.id, user!.id)
    setRole(null)
    setMemberCount(m => m - 1)
    showToast('Left community')
  }

  const handleReview = async (postId: string, status: 'approved' | 'rejected') => {
    await reviewCommunityPost(postId, status)
    // Always remove from pending queue immediately
    setPending(p => p.filter(x => x.id !== postId))
    if (status === 'approved') {
      // Fetch just the newly approved post and prepend to feed
      const fresh = await getCommunityPosts(community!.id, 'approved')
      setPosts(fresh)
      showToast('Article approved and published ✦')
    } else {
      showToast('Article rejected')
    }
  }

  const handlePromote = async (memberId: string, memberName: string) => {
    if (!confirm(`Make ${memberName} an admin?`)) return
    const { error } = await promoteToAdmin(community!.id, memberId)
    if (error) {
      showToast(`Failed to promote: ${error.message}`, 'error')
    } else {
      showToast(`${memberName} is now an admin`)
      load()
    }
  }

  const openSubmit = async () => {
    if (!user) { navigate('/'); return }
    const { data } = await supabase.from('articles').select('id, title, cover_emoji, status')
      .eq('user_id', user.id).eq('status', 'published').order('updated_at', { ascending: false })
    setMyArticles(data || [])
    setShowSubmit(true)
  }

  const submitArticle = async (articleId: string) => {
    setSubmitting(true)
    const isAdmin = role === 'admin'
    const { error } = await supabase.from('community_posts').insert({
      community_id: community!.id,
      article_id: articleId,
      submitted_by: user!.id,
      status: isAdmin ? 'approved' : 'pending'
    })
    if (error) {
      if (error.code === '23505') showToast('Already submitted to this community', 'error')
      else showToast(error.message, 'error')
    } else {
      showToast(isAdmin ? 'Article published to community ✦' : 'Submitted for admin review ✦')
      setShowSubmit(false)
      load()
    }
    setSubmitting(false)
  }

  const openEdit = () => {
    setEditForm({
      name: community!.name,
      description: community!.description || '',
      emoji: community!.emoji || '🏛️',
      category: community!.category || 'General'
    })
    setShowEdit(true)
  }

  const handleUpdateCommunity = async () => {
    setUpdating(true)
    const { error } = await updateCommunity(community!.id, editForm)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Community updated ✦')
      setShowEdit(false)
      load()
    }
    setUpdating(false)
  }

  const handleDeleteCommunity = async () => {
    if (!confirm(`Delete "${community!.name}"? This cannot be undone. All posts and members will be removed.`)) return
    const { error } = await deleteCommunity(community!.id)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Community deleted')
      navigate('/communities')
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Remove this article from the community?')) return
    const { error } = await deleteCommunityPost(postId)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Article removed')
      load()
    }
  }

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonBody} />
    </div>
  )

  if (!community) return null

  return (
    <>
    <PublicNav />
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.heroEmoji}>{community.emoji}</span>
          <div>
            <span className={styles.heroCategory}>{community.category}</span>
            <h1 className={styles.heroName}>{community.name}</h1>
            {community.description && <p className={styles.heroDesc}>{community.description}</p>}
            <div className={styles.heroMeta}>
              <span>👥 {memberCount} members</span>
              <span>·</span>
              <span>📄 {posts.length} articles</span>
            </div>
          </div>
        </div>
        <div className={styles.heroActions}>
          {user ? (
            role ? (
              <>
                <button className="btn btn-primary" onClick={openSubmit}>✦ Submit Article</button>
                {role !== 'admin' && <button className="btn btn-ghost" onClick={handleLeave}>Leave</button>}
                {role === 'admin' && (
                  <>
                    <button className="btn btn-ghost" onClick={openEdit}>Edit Community</button>
                    <button className="btn btn-danger" onClick={handleDeleteCommunity}>Delete</button>
                    <span className={styles.adminBadge}>⭐ Admin</span>
                  </>
                )}
              </>
            ) : (
              <button className="btn btn-primary" onClick={handleJoin}>Join Community</button>
            )
          ) : (
            <Link to="/" className="btn btn-primary">Sign in to Join</Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'feed' ? styles.active : ''}`} onClick={() => setTab('feed')}>
          Feed <span>{posts.length}</span>
        </button>
        <button className={`${styles.tab} ${tab === 'members' ? styles.active : ''}`} onClick={() => setTab('members')}>
          Members <span>{memberCount}</span>
        </button>
        {role === 'admin' && (
          <button className={`${styles.tab} ${tab === 'queue' ? styles.active : ''}`} onClick={() => setTab('queue')}>
            Review Queue {pending.length > 0 && <span className={styles.badge}>{pending.length}</span>}
          </button>
        )}
      </div>

      {/* Feed tab */}
      {tab === 'feed' && (
        <div className={styles.feed}>
          <VerseOfDay communityId={community.id} />
          {posts.filter(p => p.article).length === 0 ? (
            <div className={styles.empty}>
              <span>📄</span>
              <h3>No articles yet</h3>
              <p>{role ? 'Submit your first article to this community.' : 'Join to submit articles.'}</p>
            </div>
          ) : posts.filter(p => p.article).map((post, i) => (
            <article key={post.id} className={styles.postCard} ref={el => { postCardRefs.current[i] = el }}>
              <div className={styles.postEmoji}>{post.article?.cover_emoji || '✦'}</div>
              <div className={styles.postBody}>
                <Link to={`/articles/${post.article?.slug}`} className={styles.postTitle}>
                  {post.article?.title || 'Untitled'}
                </Link>
                <p className={styles.postExcerpt}>
                  {post.article?.summary || post.article?.content?.substring(0, 120)}
                </p>
                <div className={styles.postMeta}>
                  <div className={styles.postAuthor}>
                    {post.submitter?.avatar_url
                      ? <img src={post.submitter.avatar_url} alt="" className={styles.postAuthorAvatar} />
                      : <span className={styles.postAuthorInitial}>{(post.submitter?.full_name || 'A')[0].toUpperCase()}</span>
                    }
                    <span>{post.submitter?.full_name || 'Anonymous'}</span>
                  </div>
                  <span>·</span>
                  <span>{post.article?.reading_time || 1} min read</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  {role === 'admin' && (
                    <>
                      <span>·</span>
                      <button 
                        className={styles.deletePostBtn}
                        onClick={() => handleDeletePost(post.id)}
                        title="Remove from community"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className={styles.membersList}>
          {members.length === 0 ? (
            <div className={styles.empty}>
              <span>👥</span>
              <h3>No members yet</h3>
              <p>Be the first to join this community.</p>
            </div>
          ) : members.map(m => (
            <div key={m.user_id} className={styles.memberRow}>
              <div className={styles.memberAvatar}>
                {m.profile?.avatar_url
                  ? <img src={m.profile.avatar_url} alt="" className={styles.memberAvatarImg} />
                  : <span>{(m.profile?.full_name || 'U')[0].toUpperCase()}</span>
                }
              </div>
              <div className={styles.memberInfo}>
                <div>
                  <span className={styles.memberName}>{m.profile?.full_name || 'Writer'}</span>
                </div>
                <span className={styles.memberJoined}>Joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</span>
              </div>
              <div className={styles.memberRight}>
                {m.role === 'admin' && <span className={styles.roleBadge}>⭐ Admin</span>}
                {role === 'admin' && m.role !== 'admin' && m.user_id !== user?.id && (
                  <button className={styles.promoteBtn} onClick={() => handlePromote(m.user_id, m.profile?.full_name || 'this user')}>
                    Make Admin
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin review queue */}
      {tab === 'queue' && role === 'admin' && (
        <div className={styles.queue}>
          {pending.length === 0 ? (
            <div className={styles.empty}>
              <span>✓</span>
              <h3>Queue is clear</h3>
              <p>No articles waiting for review.</p>
            </div>
          ) : pending.map(post => (
            <div key={post.id} className={styles.queueCard}>
              <div className={styles.queueEmoji}>{post.article?.cover_emoji || '✦'}</div>
              <div className={styles.queueInfo}>
                <h4>{post.article?.title || 'Untitled'}</h4>
                <p>By {post.submitter?.full_name || 'Unknown'} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
                <p className={styles.queueExcerpt}>{post.article?.content?.substring(0, 100)}...</p>
              </div>
              <div className={styles.queueActions}>
                <button className="btn btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}
                  onClick={() => handleReview(post.id, 'approved')}>Approve</button>
                <button className="btn btn-danger" style={{ fontSize: '12px', padding: '7px 14px' }}
                  onClick={() => handleReview(post.id, 'rejected')}>Reject</button>
                <Link to={`/articles/${post.article?.slug}`} target="_blank" className="btn btn-ghost" style={{ fontSize: '12px', padding: '7px 14px' }}>
                  Read →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit article modal */}
      {showSubmit && (
        <div className={styles.overlay} onClick={() => setShowSubmit(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Submit an Article</h2>
              <button className={styles.closeBtn} onClick={() => setShowSubmit(false)}>✕</button>
            </div>
            {role !== 'admin' && (
              <p className={styles.submitNote}>Admin will review before it appears in the community feed.</p>
            )}
            {myArticles.length === 0 ? (
              <div className={styles.noArticles}>
                <p>You have no published articles yet.</p>
                <button className="btn btn-primary" onClick={() => { setShowSubmit(false); navigate('/app/write') }}>
                  Write an Article
                </button>
              </div>
            ) : (
              <div className={styles.articlePicker}>
                {myArticles.map(a => (
                  <button key={a.id} className={styles.articleOption} onClick={() => submitArticle(a.id)} disabled={submitting}>
                    <span>{a.cover_emoji || '✦'}</span>
                    <span>{a.title || 'Untitled'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit community modal */}
      {showEdit && (
        <div className={styles.overlay} onClick={() => setShowEdit(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit Community</h2>
              <button className={styles.closeBtn} onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <div className={styles.editForm}>
              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  maxLength={50}
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  maxLength={200}
                  rows={3}
                />
              </label>
              <label>
                <span>Emoji</span>
                <input
                  type="text"
                  value={editForm.emoji}
                  onChange={e => setEditForm({ ...editForm, emoji: e.target.value })}
                  maxLength={2}
                  placeholder="🏛️"
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                >
                  <option value="General">General</option>
                  <option value="Theology">Theology</option>
                  <option value="Devotional">Devotional</option>
                  <option value="Ministry">Ministry</option>
                  <option value="Bible Study">Bible Study</option>
                  <option value="Prayer">Prayer</option>
                  <option value="Testimony">Testimony</option>
                  <option value="Youth">Youth</option>
                  <option value="Worship">Worship</option>
                </select>
              </label>
              <div className={styles.editActions}>
                <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleUpdateCommunity} disabled={updating || !editForm.name}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
