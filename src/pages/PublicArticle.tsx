import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  supabase, getWriterProfile, incrementView,
  getReactionCount, getUserReaction, toggleReaction,
  getComments, addComment, deleteComment,
  isBookmarked, toggleBookmark,
  isFollowingWriter, followWriter, unfollowWriter, toggleFollowDigest,
  getSeriesArticles
} from '../lib/supabase'
import Footer from '../components/Footer'
import { useApp } from '../context/AppContext'
import type { Article, Comment } from '../lib/supabase'
import styles from './PublicArticle.module.css'
import BibleVerseBlock from '../components/BibleVerseBlock'

export default function PublicArticle() {
  const { slug } = useParams<{ slug: string }>()
  const navigate  = useNavigate()
  const { theme, toggleTheme, user, showToast, getThemeAwareUrl } = useApp()

  const [article,        setArticle]        = useState<Article | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [copied,         setCopied]         = useState(false)

  // Author
  const [authorName,     setAuthorName]     = useState('Anonymous')
  const [authorBio,      setAuthorBio]      = useState('')
  const [authorAvatar,   setAuthorAvatar]   = useState('')
  const [authorInitials, setAuthorInitials] = useState('?')

  // Following & Digest
  const [isFollowing,    setIsFollowing]    = useState(false)
  const [digestEnabled,  setDigestEnabled]  = useState(true)
  const [followLoading,  setFollowLoading]  = useState(false)

  // Series
  const [seriesArticles, setSeriesArticles] = useState<Article[]>([])

  // Reactions
  const [likeCount,      setLikeCount]      = useState(0)
  const [liked,          setLiked]          = useState(false)
  const [liking,         setLiking]         = useState(false)

  // Comments
  const [comments,       setComments]       = useState<Comment[]>([])
  const [commentText,    setCommentText]    = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [commentError,   setCommentError]   = useState('')

  // Bookmarks
  const [bookmarked,     setBookmarked]     = useState(false)
  const [bookmarking,    setBookmarking]    = useState(false)

  const loadAll = useCallback(async () => {
    if (!slug) return
    try {
      const { data, error: err } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single()

      if (err || !data) { setError('not_found'); setLoading(false); return }

      setArticle(data)
      incrementView(slug)

      // Series articles if part of a collection
      if (data.series_id) {
        getSeriesArticles(data.series_id).then(setSeriesArticles).catch(() => {})
      }

      // Author Profile
      const profile = await getWriterProfile(data.user_id)
      if (profile?.full_name) {
        const name = profile.full_name
        setAuthorName(name)
        setAuthorBio(profile.bio || '')
        setAuthorAvatar(profile.avatar_url || '')
        setAuthorInitials(name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '✦')
      }

      // Reactions & Comments
      const [count, comms] = await Promise.all([
        getReactionCount(data.id),
        getComments(data.id),
      ])
      setLikeCount(count)
      setComments(comms)

      // User-specific states (liked, bookmarked, following)
      if (user) {
        const [userLiked, userBookmarked, userFollowing] = await Promise.all([
          getUserReaction(data.id, user.id),
          isBookmarked(data.id, user.id),
          isFollowingWriter(user.id, data.user_id)
        ])
        setLiked(userLiked)
        setBookmarked(userBookmarked)
        setIsFollowing(userFollowing)
      }
    } catch {
      setError('error')
    } finally {
      setLoading(false)
    }
  }, [slug, user])

  useEffect(() => { loadAll() }, [loadAll])

  const copyLink = () => {
    const themeAwareUrl = getThemeAwareUrl(window.location.origin + window.location.pathname)
    navigator.clipboard.writeText(themeAwareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleLike = async () => {
    if (!user) { showToast('Sign in to like articles', 'error'); return }
    if (!article || liking) return
    setLiking(true)
    const nowLiked = await toggleReaction(article.id, user.id)
    setLiked(nowLiked)
    setLikeCount(prev => nowLiked ? prev + 1 : Math.max(0, prev - 1))
    setLiking(false)
  }

  const handleBookmark = async () => {
    if (!user) { showToast('Sign in to save articles to your reading list', 'error'); return }
    if (!article || bookmarking) return
    setBookmarking(true)
    const now = await toggleBookmark(article.id, user.id)
    setBookmarked(now)
    showToast(now ? '🔖 Saved to Reading List!' : 'Removed from Reading List')
    setBookmarking(false)
  }

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { showToast('Sign in to follow writers', 'error'); return }
    if (!article || user.id === article.user_id || followLoading) return

    setFollowLoading(true)
    try {
      if (isFollowing) {
        await unfollowWriter(user.id, article.user_id)
        setIsFollowing(false)
        showToast(`Unfollowed ${authorName}`)
      } else {
        await followWriter(user.id, article.user_id)
        setIsFollowing(true)
        showToast(`Now following ${authorName}!`)
      }
    } finally {
      setFollowLoading(false)
    }
  }

  const handleToggleDigest = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || !article) return
    const nextState = !digestEnabled
    await toggleFollowDigest(user.id, article.user_id, nextState)
    setDigestEnabled(nextState)
    showToast(nextState ? '✉️ Email digest enabled' : 'Email digest disabled')
  }

  const handleComment = async () => {
    if (!user) { showToast('Sign in to comment', 'error'); return }
    if (!article || !commentText.trim()) return
    if (commentText.trim().length < 2) { setCommentError('Comment too short'); return }
    setSubmitting(true)
    setCommentError('')

    const result = await addComment(article.id, user.id, commentText)
    if (result.error) {
      setCommentError(`Failed to post: ${result.error}`)
      setSubmitting(false)
      return
    }

    setCommentText('')
    setSubmitting(false)
    const refreshed = await getComments(article.id)
    setComments(refreshed)
    showToast('Comment posted')
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return
    await deleteComment(commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
    showToast('Comment deleted')
  }

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.fullscreen}>
          <div className={styles.loadSpinner}>✦</div>
          <p className={styles.loadText}>Loading article…</p>
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className={styles.wrapper}>
        <nav className={styles.topNav}>
          <Link to="/discover" className={styles.backBtn}>← Discover</Link>
          <span className={styles.navLogo}>✦ Inkwell</span>
          <button className={styles.themeBtn} onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
        </nav>
        <div className={styles.fullscreen}>
          <div className={styles.errorEmoji}>📄</div>
          <h2 className={styles.errorTitle}>Article not found</h2>
          <p className={styles.errorSub}>
            {error === 'not_found'
              ? 'This article may not be published or the link is incorrect.'
              : 'Something went wrong loading this article.'}
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/discover')}>← Back to Discover</button>
        </div>
        <Footer />
      </div>
    )
  }

  const publishedDate = new Date(article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const isOwnArticle = user?.id === article.user_id

  return (
    <div className={styles.wrapper}>
      {/* ── Top Nav ── */}
      <nav className={styles.topNav}>
        <Link to="/discover" className={styles.backBtn}>← Discover</Link>
        <span className={styles.navLogo}>✦ Inkwell</span>
        <div className={styles.navActions}>
          <button
            className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarked : ''}`}
            onClick={handleBookmark}
            title={bookmarked ? 'Remove from Reading List' : 'Save to Reading List'}
          >
            {bookmarked ? '🔖' : '🏷️'}
          </button>
          <button className={styles.themeBtn} onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
          <button className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ''}`} onClick={copyLink}>
            {copied ? '✓ Copied!' : '🔗 Share'}
          </button>
        </div>
      </nav>

      <div className={styles.container}>
        <article className={styles.article}>

          {/* ── Hero ── */}
          <div className={styles.hero}>
            <span className={styles.emoji}>{article.cover_emoji || '✦'}</span>
            <h1 className={styles.title}>{article.title}</h1>
          </div>

          {/* ── Author + Follow Row ── */}
          <div className={styles.authorRow}>
            <Link to={`/writer/${article.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, textDecoration: 'none' }}>
              {authorAvatar ? (
                <img src={authorAvatar} alt={authorName} className={styles.authorAvatarImage} />
              ) : (
                <div className={styles.authorAvatar}>{authorInitials}</div>
              )}
              <div className={styles.authorMeta}>
                <span className={styles.authorName}>{authorName}</span>
                <span className={styles.authorSub}>
                  {publishedDate}
                  {article.reading_time ? ` · ${article.reading_time} min read` : ''}
                  {(article.view_count || 0) > 0 ? ` · ${article.view_count?.toLocaleString()} views` : ''}
                </span>
              </div>
            </Link>

            {!isOwnArticle && (
              <div className={styles.authorActions}>
                <button
                  className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                >
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </button>
                {isFollowing && (
                  <button
                    className={`${styles.digestBtn} ${digestEnabled ? styles.digestActive : ''}`}
                    onClick={handleToggleDigest}
                    title={digestEnabled ? 'Email digest enabled' : 'Enable email digest'}
                  >
                    ✉️
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Series Navigation Card (if part of a series) ── */}
          {seriesArticles.length > 0 && (
            <div className={styles.seriesCard}>
              <div className={styles.seriesHeader}>
                <span className={styles.seriesBadge}>Part of Series</span>
                <span className={styles.seriesTitle}>Collection ({seriesArticles.length} Parts)</span>
              </div>
              <ul className={styles.seriesList}>
                {seriesArticles.map((sArt, index) => {
                  const isCurrent = sArt.id === article.id
                  return (
                    <li key={sArt.id}>
                      {isCurrent ? (
                        <div className={`${styles.seriesItem} ${styles.seriesCurrent}`}>
                          <span>
                            <span className={styles.seriesPartNum}>Part {index + 1}:</span>
                            {sArt.title || 'Untitled'} (Current)
                          </span>
                          <span>✦</span>
                        </div>
                      ) : (
                        <Link to={`/articles/${sArt.slug}`} className={styles.seriesItem}>
                          <span>
                            <span className={styles.seriesPartNum}>Part {index + 1}:</span>
                            {sArt.title || 'Untitled'}
                          </span>
                          <span>→</span>
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* ── Tags ── */}
          {article.tags && article.tags.length > 0 && (
            <div className={styles.tags}>
              {article.tags.map((tag: string) => <span key={tag} className={styles.tag}>{tag}</span>)}
            </div>
          )}

          <div className={styles.divider} />

          {/* ── Bible verse ── */}
          {article.bible_verse && (
            <BibleVerseBlock reference={article.bible_verse} />
          )}

          {/* ── Body ── */}
          <div
            className={`${styles.body} ${styles.richContent}`}
            dangerouslySetInnerHTML={{
              __html: article.content?.trimStart().startsWith('<')
                ? article.content
                : (article.content || '')
                    .split('\n')
                    .map(line => line.trim() ? `<p>${line}</p>` : '<br/>')
                    .join('')
            }}
          />

          {/* ── Reactions & Engagement bar ── */}
          <div className={styles.reactBar}>
            <button
              className={`${styles.likeBtn} ${liked ? styles.liked : ''}`}
              onClick={handleLike}
              disabled={liking}
            >
              <span className={styles.likeHeart}>{liked ? '❤️' : '🤍'}</span>
              <span className={styles.likeCount}>{likeCount > 0 ? likeCount : ''}</span>
              <span className={styles.likeLabel}>{liked ? 'Liked' : 'Like'}</span>
            </button>

            <div className={styles.reactStats}>
              {(article.view_count || 0) > 0 && (
                <span className={styles.reactStat}>👁 {article.view_count?.toLocaleString()} views</span>
              )}
              {comments.length > 0 && (
                <span className={styles.reactStat}>💬 {comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            <button
              className={`${styles.bookmarkBarBtn} ${bookmarked ? styles.bookmarked : ''}`}
              onClick={handleBookmark}
            >
              {bookmarked ? '🔖 In Reading List' : '🏷️ Save to Reading List'}
            </button>
          </div>

          {/* ── Share card ── */}
          <div className={styles.shareCard}>
            <div className={styles.shareCardTop}>
              <span className={styles.shareCardTitle}>📋 Share this article</span>
              <button className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`} onClick={copyLink}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <input readOnly value={window.location.href} className={styles.linkInput} onFocus={e => { e.target.select(); copyLink() }} />
          </div>

          {/* ── Author Bio Card ── */}
          <div className={styles.authorCard}>
            <Link to={`/writer/${article.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, textDecoration: 'none' }}>
              {authorAvatar ? (
                <img src={authorAvatar} alt={authorName} className={styles.authorCardAvatarImage} />
              ) : (
                <div className={styles.authorCardAvatar}>{authorInitials}</div>
              )}
              <div className={styles.authorCardInfo}>
                <p className={styles.authorCardName}>{authorName}</p>
                <p className={styles.authorCardBio}>{authorBio || 'Inkwell writer'}</p>
              </div>
            </Link>

            {!isOwnArticle && (
              <div className={styles.authorActions}>
                <button
                  className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                >
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </button>
                {isFollowing && (
                  <button
                    className={`${styles.digestBtn} ${digestEnabled ? styles.digestActive : ''}`}
                    onClick={handleToggleDigest}
                    title={digestEnabled ? 'Email digest enabled' : 'Enable email digest'}
                  >
                    ✉️
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Comments ── */}
          <div className={styles.commentsSection}>
            <h3 className={styles.commentsTitle}>
              💬 {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
            </h3>

            {user ? (
              <div className={styles.commentForm}>
                <textarea
                  className={styles.commentInput}
                  placeholder="Share your thoughts…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                {commentError && <p className={styles.commentErr}>{commentError}</p>}
                <div className={styles.commentFormFooter}>
                  <span className={styles.charCount}>{commentText.length}/1000</span>
                  <button
                    className="btn btn-primary"
                    onClick={handleComment}
                    disabled={submitting || !commentText.trim()}
                    style={{ fontSize: '12px', padding: '7px 16px' }}
                  >
                    {submitting ? 'Posting…' : 'Post Comment'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.commentSignIn}>
                <p>Sign in to leave a comment</p>
                <button className="btn btn-primary" onClick={() => navigate('/')} style={{ fontSize: '12px', padding: '7px 16px' }}>
                  Sign In
                </button>
              </div>
            )}

            {comments.length > 0 && (
              <div className={styles.commentList}>
                {comments.map(comment => {
                  const cname = comment.profile?.full_name || 'Writer'
                  const cavatar = comment.profile?.avatar_url || ''
                  const cinit = cname.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                  const isOwn = user?.id === comment.user_id
                  return (
                    <div key={comment.id} className={styles.commentItem}>
                      {cavatar ? (
                        <img src={cavatar} alt={cname} className={styles.commentAvatarImage} />
                      ) : (
                        <div className={styles.commentAvatar}>{cinit}</div>
                      )}
                      <div className={styles.commentBody}>
                        <div className={styles.commentHeader}>
                          <span className={styles.commentAuthor}>{cname}</span>
                          <span className={styles.commentTime}>
                            {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {isOwn && (
                            <button className={styles.deleteCommentBtn} onClick={() => handleDeleteComment(comment.id)} title="Delete">✕</button>
                          )}
                        </div>
                        <p className={styles.commentText}>{comment.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </article>
      </div>

      <Footer />
    </div>
  )
}
