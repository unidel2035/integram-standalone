/**
 * Touch Gestures Composable
 * Provides touch gesture detection for mobile optimization
 */

import { ref, onMounted, onUnmounted } from 'vue'

export function useTouchGestures(elementRef, options = {}) {
  const {
    onSwipeLeft = null,
    onSwipeRight = null,
    onSwipeUp = null,
    onSwipeDown = null,
    onPullToRefresh = null,
    threshold = 50, // Minimum distance for swipe
    pullThreshold = 100, // Pull to refresh threshold
  } = options

  const touchStartX = ref(0)
  const touchStartY = ref(0)
  const touchEndX = ref(0)
  const touchEndY = ref(0)
  const isPulling = ref(false)
  const pullDistance = ref(0)

  const handleTouchStart = (e) => {
    touchStartX.value = e.touches[0].clientX
    touchStartY.value = e.touches[0].clientY
  }

  const handleTouchMove = (e) => {
    touchEndX.value = e.touches[0].clientX
    touchEndY.value = e.touches[0].clientY

    // Check for pull to refresh (only at top of page)
    if (onPullToRefresh && window.scrollY === 0) {
      const deltaY = touchEndY.value - touchStartY.value
      if (deltaY > 0) {
        isPulling.value = true
        pullDistance.value = deltaY
        // Prevent default scroll behavior when pulling
        if (deltaY > 10) {
          e.preventDefault()
        }
      }
    }
  }

  const handleTouchEnd = () => {
    const deltaX = touchEndX.value - touchStartX.value
    const deltaY = touchEndY.value - touchStartY.value

    // Check pull to refresh
    if (isPulling.value && pullDistance.value > pullThreshold && onPullToRefresh) {
      onPullToRefresh()
    }
    isPulling.value = false
    pullDistance.value = 0

    // Determine swipe direction
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    // Horizontal swipe
    if (absX > absY && absX > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight()
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft()
      }
    }

    // Vertical swipe
    if (absY > absX && absY > threshold) {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown()
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp()
      }
    }

    // Reset values
    touchStartX.value = 0
    touchStartY.value = 0
    touchEndX.value = 0
    touchEndY.value = 0
  }

  onMounted(() => {
    if (!elementRef?.value) return

    const element = elementRef.value

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    if (!elementRef?.value) return

    const element = elementRef.value

    element.removeEventListener('touchstart', handleTouchStart)
    element.removeEventListener('touchmove', handleTouchMove)
    element.removeEventListener('touchend', handleTouchEnd)
  })

  return {
    isPulling,
    pullDistance,
  }
}

/**
 * Mobile Detection Composable
 */
export function useMobileDetection() {
  const isMobile = ref(false)
  const isTablet = ref(false)
  const isTouchDevice = ref(false)
  const screenSize = ref({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  const checkDevice = () => {
    const ua = navigator.userAgent
    isMobile.value = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    isTablet.value = /iPad|Android(?!.*Mobile)/i.test(ua)
    isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  const updateScreenSize = () => {
    screenSize.value = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }

  onMounted(() => {
    checkDevice()
    window.addEventListener('resize', updateScreenSize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateScreenSize)
  })

  return {
    isMobile,
    isTablet,
    isTouchDevice,
    screenSize,
  }
}

/**
 * Haptic Feedback for mobile devices
 */
export function useHapticFeedback() {
  const vibrate = (pattern = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }

  const lightTap = () => vibrate(10)
  const mediumTap = () => vibrate(20)
  const heavyTap = () => vibrate(30)
  const doubleTap = () => vibrate([10, 50, 10])
  const success = () => vibrate([10, 50, 10, 50, 10])
  const error = () => vibrate([50, 100, 50])

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    doubleTap,
    success,
    error,
  }
}
