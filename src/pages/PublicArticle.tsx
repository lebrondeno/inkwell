import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  supabase, getWriterProfile, incrementView,
  getReactionCount, getUserReaction, toggleReaction,
  getComments, addComment, deleteComment,
  isBookmarked, toggleBookmark,
} from '../lib/supabase'
import Footer from '../components/Footer'
import { useApp } from '../context/AppContext'
import type { Article, Comment } from '../lib/supabase'
import styles from './PublicArticle.module.css'
import BibleVerseBlock from '../components/BibleVerseBlock'

export default function PublicArticle() {
  const { slug } = useParams<{ slug: string }>()
  const navigate  = useNavigate()
  const { theme, toggleTheme, user, showToast } = useApp()

  const [article,       setArticle]       = useState<Article | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [copied,        setCopied]        = useState(false)

  // Author
  const [authorName,    setAuthorName]    = useState('Anonymous')
  const [authorBio,     setAuthorBio]     = useState('')
  const [authorAvatar,  setAuthorAvatar]  = useState('')
  const [authorInitials,setAuthorInitials]= useState('?')

  // Reactions
  const [likeCount,     setLikeCount]     = useState(0)
  const [liked,         setLiked]         = useState(false)
  const [liking,        setLiking]        = useState(false)

  // Comments
  const [comments,      setComments]      = useState<Comment[]>([])
  const [commentText,   setCommentText]   = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [commentError,  setCommentError]  = useState('')

  // Bookmarks
  const [bookmarked,    setBookmarked]    = useState(false)
  const [bookmarking,   setBookmarking]   = useState(false)

  useEffect(() => { if (slug) loadAll() }, [slug])

  const loadAll = async () => {
    try {
      const { data, error: err } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single()

      if (err || !data) { setError('not_found'); setLoading(false); return }

      setArticle(data)
      if (slug) incrementView(slug)

      // Author
      const profile = await getWriterProfile(data.user_id)
      if (profile?.full_name) {
        const name = profile.full_name
        setAuthorName(name)
        setAuthorBio(profile.bio || '')
        setAuthorAvatar(profile.avatar_url || '')
        setAuthorInitials(name.split(' ').filter(Boolean).map((n:string)=>n[0]).join('').toUpperCase().slice(0,2) || '✦')
      }

      // Reactions
      const [count, comments] = await Promise.all([
        getReactionCount(data.id),
        getComments(data.id),
      ])
      setLikeCount(count)
      setComments(comments)

      // User-specific: liked + bookmarked
      if (user) {
        const [userLiked, userBookmarked] = await Promise.all([
          getUserReaction(data.id, user.id),
          isBookmarked(data.id, user.id),
        ])
        setLiked(userLiked)
        setBookmarked(userBookmarked)
      }
    } catch { setError('error') }
    finally  { setLoading(false) }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
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
    if (!user) { showToast('Sign in to bookmark articles', 'error'); return }
    if (!article || bookmarking) return
    setBookmarking(true)
    const now = await toggleBookmark(article.id, user.id)
    setBookmarked(now)
    showToast(now ? '🔖 Bookmarked!' : 'Bookmark removed')
    setBookmarking(false)
  }

  const handleComment = async () => {
    if (!user) { showToast('Sign in to comment', 'error'); return }
    if (!article || !commentText.trim()) return
    if (commentText.trim().length < 2) { setCommentError('Comment too short'); return }
    setSubmitting(true)
    setCommentError('')
    
    console.log('Attempting to save comment:', { articleId: article.id, userId: user.id, commentText })
    
    const result = await addComment(article.id, user.id, commentText)
    console.log('Comment save result:', result)
    
    if (result.error) { 
      console.error('Comment error:', result.error)
      setCommentError(`Failed to post: ${result.error}`); 
      setSubmitting(false); 
      return 
    }
    
    setCommentText('')
    const fresh = await getComments(article.id)
    setComments(fresh)
    setSubmitting(false)
    showToast('Comment posted!', 'success')
  }

  const handleDeleteComment = async (id: string) => {
    await deleteComment(id)
    setComments(prev => prev.filter(c => c.id !== id))
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
          <p className={styles.errorHint}>
            💡 <strong>If you're the author:</strong> run <code>supabase-schema.sql</code> in your Supabase SQL Editor to enable public reads of published articles.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/discover')}>← Back to Discover</button>
        </div>
        <Footer />
      </div>
    )
  }

  const publishedDate = new Date(article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className={styles.wrapper}>
      {/* ── Top Nav ── */}
      <nav className={styles.topNav}>
        <Link to="/discover" className={styles.backBtn}>← Discover</Link>
        <span className={styles.navLogo}>✦ Inkwell</span>
        <div className={styles.navActions}>
          <button className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarked : ''}`} onClick={handleBookmark} title={bookmarked ? 'Remove bookmark' : 'Bookmark'}>
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

          {/* ── Author + meta ── */}
          <Link to={`/writer/${article.user_id}`} className={styles.authorRow}>
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
            <span className={styles.profilePill}>View profile →</span>
          </Link>

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
          <div className={styles.body}>
            {article.content?.split('\n').map((para, idx) =>
              para.trim()
                ? <p key={idx} className={styles.paragraph}>{para}</p>
                : <div key={idx} style={{ height: '12px' }} />
            )}
          </div>

          {/* ── Reactions bar ── */}
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
              {bookmarked ? '🔖 Saved' : '🏷️ Save'}
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

          {/* ── Author card ── */}
          <Link to={`/writer/${article.user_id}`} className={styles.authorCard}>
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className={styles.authorCardAvatarImage} />
            ) : (
              <div className={styles.authorCardAvatar}>{authorInitials}</div>
            )}
            <div className={styles.authorCardInfo}>
              <p className={styles.authorCardName}>{authorName}</p>
              <p className={styles.authorCardBio}>{authorBio || 'Inkwell writer'}</p>
            </div>
            <span className={styles.authorCardArrow}>→</span>
          </Link>

          {/* ── Comments ── */}
          <div className={styles.commentsSection}>
            <h3 className={styles.commentsTitle}>
              💬 {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
            </h3>

            {/* Comment input */}
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

            {/* Comment list */}
            {comments.length > 0 && (
              <div className={styles.commentList}>
                {comments.map(comment => {
                  const cname = (comment.profile as any)?.full_name || 'Writer'
                  const cavatar = (comment.profile as any)?.avatar_url || ''
                  const cinit = cname.split(' ').map((n:string)=>n[0]).join('').toUpperCase().slice(0,2)
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
