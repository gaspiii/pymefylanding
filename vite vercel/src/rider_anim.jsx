// Rider Animation component to be inserted
function RiderAnimation() {
  const containerRef = useRef(null)
  const spriteRef = useRef(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (RIDER_FRAMES.length === 0) {
      setLoaded(true)
      return
    }
    let mounted = true
    const checkFrames = async () => {
      try {
        const firstFrame = new Image()
        await new Promise((resolve, reject) => {
          firstFrame.onload = resolve
          firstFrame.onerror = reject
          firstFrame.src = RIDER_FRAMES[0]
        })
        if (mounted) setLoaded(true)
      } catch {
        if (mounted) setLoaded(true)
      }
    }
    checkFrames()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting)
        })
      },
      { threshold: 0, rootMargin: '-10% 0px -10% 0px' }
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || RIDER_FRAMES.length === 0) {
      if (spriteRef.current && RIDER_FRAMES.length > 0) {
        spriteRef.current.style.backgroundImage = `url('${RIDER_FRAMES[0]}')`
      }
      return
    }
    const handleScroll = () => {
      const container = containerRef.current
      if (!container || RIDER_FRAMES.length === 0) return
      const rect = container.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const enterPoint = viewportHeight * 0.7
      const exitPoint = viewportHeight * 0.2
      const travelDistance = enterPoint - exitPoint
      let progress = (enterPoint - rect.top) / travelDistance
      progress = Math.max(0, Math.min(1, progress))
      const frameIndex = Math.floor(progress * (RIDER_FRAMES.length - 1))
      const clampedFrame = Math.max(0, Math.min(RIDER_FRAMES.length - 1, frameIndex))
      setCurrentFrame(clampedFrame)
      if (spriteRef.current && RIDER_FRAMES[clampedFrame]) {
        spriteRef.current.style.backgroundImage = `url('${RIDER_FRAMES[clampedFrame]}')`
      }
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isVisible])

  return (
    <div className="rider-bike-wrapper" ref={containerRef}>
      <div className="rider-bg-glow"></div>
      <div className="rider-bike-container">
        <div
          className="rider-bike-sprite"
          ref={spriteRef}
          style={{
            width: '200px',
            height: '200px',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundImage: RIDER_FRAMES.length > 0 ? `url('${RIDER_FRAMES[0]}')` : 'none'
          }}
        >
          {!loaded && RIDER_FRAMES.length === 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              textAlign: 'center'
            }}>
              Animación del repartidor
            </div>
          )}
        </div>
        <div className="rider-shadow"></div>
        <div className="speed-lines" id="speedLines">
          <div className="speed-line"></div>
          <div className="speed-line"></div>
          <div className="speed-line"></div>
        </div>
        <div className="eco-badge-float">🌿 Entregas sustentables</div>
      </div>
    </div>
  )
}