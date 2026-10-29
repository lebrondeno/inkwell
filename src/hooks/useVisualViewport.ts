import { useState, useEffect, useCallback, useRef } from 'react'

export interface VisualViewportState {
  keyboardOffset: number
  isKeyboardOpen: boolean
  isFocused: boolean
  isMobile: boolean
  setIsFocused: (focused: boolean) => void
}

function getInitialViewport() {
  if (typeof window === 'undefined') {
    return { keyboardOffset: 0, isMobile: false }
  }
  const isMobile = window.innerWidth <= 768
  if (!isMobile) {
    return { keyboardOffset: 0, isMobile: false }
  }
  const vv = window.visualViewport
  const keyboardOffset = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0
  return { keyboardOffset, isMobile }
}

/**
 * Tracks mobile software keyboard using window.visualViewport.
 * Calculates keyboardOffset and manages document.body[data-keyboard-open="true"].
 */
export function useVisualViewport(editorElementRef?: React.RefObject<HTMLElement | null>): VisualViewportState {
  const [viewport, setViewport] = useState(getInitialViewport)
  const [isFocused, setIsFocusedState] = useState(false)
  const isFocusedRef = useRef(false)

  const isKeyboardOpen = viewport.isMobile && (isFocused || viewport.keyboardOffset > 80)

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isKeyboardOpen) {
      document.body.setAttribute('data-keyboard-open', 'true')
    } else {
      document.body.removeAttribute('data-keyboard-open')
    }
  }, [isKeyboardOpen])

  const setIsFocused = useCallback((focused: boolean) => {
    isFocusedRef.current = focused
    setIsFocusedState(focused)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResizeOrScroll = () => {
      const isMobile = window.innerWidth <= 768
      if (!isMobile) {
        setViewport({ keyboardOffset: 0, isMobile: false })
        return
      }
      const vv = window.visualViewport
      const offset = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0
      setViewport({ keyboardOffset: offset, isMobile: true })
    }

    const vv = window.visualViewport
    vv?.addEventListener('resize', handleResizeOrScroll)
    vv?.addEventListener('scroll', handleResizeOrScroll)
    window.addEventListener('resize', handleResizeOrScroll)

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      const isEditorTarget =
        target?.closest('.ProseMirror') ||
        Boolean(editorElementRef?.current && target && editorElementRef.current.contains(target))
      if (isEditorTarget) {
        setIsFocused(true)
      }
    }

    const handleFocusOut = (e: FocusEvent) => {
      const related = e.relatedTarget as HTMLElement | null
      const isStillInEditor =
        related?.closest('.ProseMirror') ||
        Boolean(editorElementRef?.current && related && editorElementRef.current.contains(related))
      if (!isStillInEditor) {
        setIsFocused(false)
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      vv?.removeEventListener('resize', handleResizeOrScroll)
      vv?.removeEventListener('scroll', handleResizeOrScroll)
      window.removeEventListener('resize', handleResizeOrScroll)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      document.body.removeAttribute('data-keyboard-open')
    }
  }, [editorElementRef, setIsFocused])

  return {
    keyboardOffset: viewport.keyboardOffset,
    isKeyboardOpen,
    isFocused,
    isMobile: viewport.isMobile,
    setIsFocused,
  }
}
