import re

# Read JS
with open("src/App.jsx", "r", encoding="utf-8") as f:
    js = f.read()

# 1. Add USER_GALLERY_IMAGES after SUGGESTION_CHIPS
gallery = """const SUGGESTION_CHIPS = [
  { prompt: 'Post de comida, 4 donuts, sin texto, buena iluminación, mesa vista desde el cielo, mesa de madera', emoji: '🍩', label: 'Post de comida' },
  { prompt: 'Modelo de fotografía poniendo su mano vacía a su costado, con la palma extendida y mirando a la cámara, mientras sonríe', emoji: '📸', label: 'Modelo fotografía' },
  { prompt: 'Logo moderno para restaurant chileno, colores naranjas y dorados, estilo minimalista', emoji: '🎨', label: 'Logo restaurant' },
  { prompt: 'Banner para Instagram de una tienda de ropa, fondo degradado púrpura, estilo lifestyle', emoji: '📱', label: 'Banner Instagram' },
  { prompt: 'Mockup de producto cosmetico en mesa de mármol blanco, iluminación natural suave', emoji: '✨', label: 'Mockup cosmético' },
  { prompt: 'Foto de producto café specialty en taza blanca, vapor rising, fondo de madera oscura', emoji: '☕', label: 'Café specialty' },
]

const USER_GALLERY_IMAGES = [
  { url: 'https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/10147bbe-808d-46d7-9d8d-ef4df2d3c300/width=400,height=400,fit=cover,gravity=top,quality=85,format=auto', prompt: 'Logo moderno minimalista' },
  { url: 'https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/30ebe785-2def-4ce4-960d-17b4c08d4d00/width=400,height=400,fit=cover,gravity=top,quality=85,format=auto', prompt: 'Banner Instagram comida' },
  { url: 'https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/93473259-b88d-4d2c-dd3b-8f136bc6f300/width=400,height=400,fit=cover,gravity=top,quality=85,format=auto', prompt: 'Mockup cosmético premium' },
  { url: 'https://images.unsplash.com/photo-1558655146-364adaf1fcc8?w=400&h=400&fit=crop', prompt: 'Fotografía producto café' },
  { url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=400&fit=crop', prompt: 'Diseño botella cosmética' },
  { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', prompt: 'Mockup reloj minimalista' },
  { url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop', prompt: 'Caja regalo elegante' },
  { url: 'https://images.unsplash.com/photo-1607082350899-7e105aa886ae?w=400&h=400&fit=crop', prompt: 'Perfume botella premium' },
]

function getWaTime() {"""
js = re.sub(
    r"const SUGGESTION_CHIPS = \[.*?\]\s*\n\nfunction getWaTime\(\) \{",
    gallery,
    js,
    flags=re.DOTALL,
)

# 2. Rate limit state
js = js.replace(
    """  const [cooldown, setCooldown] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const lastGeneratedRef = useRef(0)
  const cooldownTimerRef = useRef(null)""",
    """  const [cooldown, setCooldown] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const lastGeneratedRef = useRef(0)
  const cooldownTimerRef = useRef(null)
  const [clientIP, setClientIP] = useState(null)
  const [rateLimitInfo, setRateLimitInfo] = useState({ allowed: true, remaining: GENERATION_LIMIT, resetTime: null })""",
)

# 3. IP check useEffect
old_ip = """  useEffect(() => {
    if (!open) {
      setPrompt('')
      setResult(null)
      setError(null)
      setLoading(false)
    }
  }, [open])"""
new_ip = """  useEffect(() => {
    if (!open) {
      setPrompt('')
      setResult(null)
      setError(null)
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    if (open && !clientIP) {
      getClientIP().then(ip => {
        setClientIP(ip)
        const limit = checkRateLimit(ip)
        setRateLimitInfo(limit)
      })
    }
  }, [open, clientIP])"""
js = js.replace(old_ip, new_ip)

# 4. Rate limit check in handleGenerate
js = js.replace(
    """  const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (!canGenerate()) return""",
    """  const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (!canGenerate()) return
    if (!rateLimitInfo.allowed) return""",
)

# 5. MiniMax success record
js = js.replace(
    """        const result = await generateWithMinimax(prompt, size, style)
          setResult({ url: result.url, prompt })
          setLoading(false)
          return""",
    """        const result = await generateWithMinimax(prompt, size, style)
          setResult({ url: result.url, prompt })
          if (clientIP) {
            recordGeneration(clientIP)
            setRateLimitInfo(checkRateLimit(clientIP))
          }
          setLoading(false)
          return""",
)

# 6. Pollinations success record
js = re.sub(
    r"""(      setResult\(\{ url: imageUrl, prompt \}\)).*?(\n    \} catch \(err\) \{)""",
    r"""\1
      if (clientIP) {
        recordGeneration(clientIP)
        setRateLimitInfo(checkRateLimit(clientIP))
      }\2""",
    js,
    flags=re.DOTALL,
)

# 7. Credits and disabled button
js = js.replace(
    """        <div className="img-gen-credits">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            <span>5 generaciones gratis al día</span>
          </div>
          <button
            className="img-gen-submit"
            onClick={handleGenerate}
            disabled={!canSubmit}""",
    """        <div className="img-gen-credits">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            {!rateLimitInfo.allowed ? (
              <span style={{ color: '#ef4444' }}>Límite alcanzado · Resetea en {rateLimitInfo.resetTime}</span>
            ) : (
              <span>{rateLimitInfo.remaining} de {GENERATION_LIMIT} generaciones · Resetea en 10h</span>
            )}
          </div>
          <button
            className="img-gen-submit"
            onClick={handleGenerate}
            disabled={!canSubmit || !rateLimitInfo.allowed}""",
)

# 8. Cooldown text
js = js.replace(
    """) : cooldown ? (
              <span style={{ fontSize: '0.8125rem' }}>Cooldown: {Math.ceil(cooldownRemaining / 1000)}s</span>
            ) : (""",
    """) : cooldown ? (
              <span style={{ fontSize: '0.8125rem' }}>Espera {Math.ceil(cooldownRemaining / 1000)}s</span>
            ) : !rateLimitInfo.allowed ? (
              <span style={{ fontSize: '0.8125rem' }}>Límite alcanzado</span>
            ) : (""",
)

# 9. Split modal
js = js.replace(
    """      <div className="img-gen-container">
        {/* Header */}
        <div className="img-gen-header">""",
    """      <div className="img-gen-container">
        <div className="img-gen-main">
          {/* Header */}
          <div className="img-gen-header">""",
)

js = js.replace(
    """        {/* Error */}
        {error && (
          <div className="img-gen-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
        )}
      </div>""",
    """        {/* Error */}
        {error && (
          <div className="img-gen-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="img-gen-gallery">
        <div className="img-gen-gallery-header">
          <h4 className="img-gen-gallery-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
            Galería de usuarios
          </h4>
          <span className="img-gen-gallery-sub">Fotos generadas hoy</span>
        </div>
        <div className="img-gen-gallery-grid">
          {USER_GALLERY_IMAGES.map((img, i) => (
            <div key={i} className="img-gen-gallery-item">
              <img src={img.url} alt={img.prompt} loading="lazy" />
              <div className="img-gen-gallery-overlay">
                <span className="img-gen-gallery-prompt">{img.prompt}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="img-gen-gallery-footer">
          <button className="img-gen-gallery-btn" onClick={() => handleRegenerate()} disabled={loading || !prompt.trim()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            Nueva variación
          </button>
        </div>
      </div>
    </div>""",
)

# 10. CSS
with open("src/App.css", "r", encoding="utf-8") as f:
    css = f.read()
css = css.replace(
    ".img-gen-container { position: relative; width: min(520px, calc(100% - 1rem)); max-height: calc(100vh - 2rem); background: #1a1a1a; border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.1); overflow-y: auto; animation: bubble-in 0.3s ease; }",
    ".img-gen-container { display: flex; width: min(820px, calc(100% - 1rem)); max-height: calc(100vh - 2rem); background: #1a1a1a; border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.1); animation: bubble-in 0.3s ease; }",
)
css += """
.img-gen-main { flex: 1; overflow-y: auto; max-height: calc(100vh - 2rem); }
.img-gen-gallery { width: 240px; flex-shrink: 0; border-left: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); }
.img-gen-gallery-header { padding: 1rem 1rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
.img-gen-gallery-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; }
.img-gen-gallery-sub { font-size: 0.625rem; color: rgba(255,255,255,0.4); margin-top: 0.125rem; }
.img-gen-gallery-grid { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; max-height: calc(100vh - 320px); }
.img-gen-gallery-grid::-webkit-scrollbar { width: 4px; }
.img-gen-gallery-grid::-webkit-scrollbar-track { background: transparent; }
.img-gen-gallery-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
.img-gen-gallery-item { position: relative; border-radius: 0.5rem; overflow: hidden; background: #111; border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.2s ease; aspect-ratio: 1; }
.img-gen-gallery-item:hover { border-color: rgba(99,102,241,0.4); transform: scale(1.02); }
.img-gen-gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.img-gen-gallery-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent 50%); opacity: 0; transition: opacity 0.2s ease; display: flex; align-items: flex-end; padding: 0.5rem; }
.img-gen-gallery-item:hover .img-gen-gallery-overlay { opacity: 1; }
.img-gen-gallery-prompt { font-size: 0.55rem; line-height: 1.3; color: rgba(255,255,255,0.85); }
.img-gen-gallery-footer { padding: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); }
.img-gen-gallery-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.5rem; border-radius: 0.5rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); font-size: 0.6875rem; font-weight: 500; color: rgba(255,255,255,0.7); transition: all 0.2s ease; }
.img-gen-gallery-btn:hover:not(:disabled) { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.3); color: #a5b4fc; }
.img-gen-gallery-btn:disabled { opacity: 0.4; cursor: not-allowed; }
@media (max-width: 768px) {
  .img-gen-container { flex-direction: column; }
  .img-gen-gallery { width: 100%; border-left: none; border-top: 1px solid rgba(255,255,255,0.08); max-height: 220px; }
  .img-gen-gallery-grid { flex-direction: row; max-height: none; max-width: 100vw; overflow-x: auto; overflow-y: hidden; padding: 0.5rem 0.5rem 0; }
  .img-gen-gallery-item { min-width: 100px; }
  .img-gen-gallery-overlay { display: none; }
}
@media (max-width: 480px) {
  .img-gen-gallery-item { min-width: 80px; }
}
"""
with open("src/App.css", "w", encoding="utf-8") as f:
    f.write(css)

# 11. Replace static rider
js = js.replace(
    """        <div className="rider-bike-wrapper">
          <div className="rider-bg-glow"></div>
          <div className="rider-bike-container">
            <div className="rider-bike-sprite" id="riderBikeSprite"></div>
            <div className="rider-shadow"></div>
            <div className="speed-lines" id="speedLines">
              <div className="speed-line"></div>
              <div className="speed-line"></div>
              <div className="speed-line"></div>
            </div>
            <div className="eco-badge-float">🌿 Entregas sustentables</div>
          </div>
        </div>""",
    """        <RiderAnimation />""",
)

# 12. Add RIDER_FRAMES and RiderAnimation
rider = """\nconst TOTAL_RIDER_FRAMES = 154
const RIDER_FRAME_BASE = '/ezgif-frame-'
const RIDER_FRAME_EXT = '.png'

const RIDER_FRAMES = Array.from(
  { length: TOTAL_RIDER_FRAMES },
  (_, i) => `${RIDER_FRAME_BASE}${String(i + 1).padStart(3, '0')}${RIDER_FRAME_EXT}`
)

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
"""

if "const TOTAL_RIDER_FRAMES = 154" not in js:
    idx = js.find("// Rider Section")
    if idx > 0:
        js = js[:idx] + rider + js[idx:]

with open("src/App.jsx", "w", encoding="utf-8") as f:
    f.write(js)

print("All changes applied successfully!")
