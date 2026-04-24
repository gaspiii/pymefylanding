import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const KLAVIYO_CONFIG = {
  provider: 'klaviyo',
  klaviyoCompanyId: import.meta.env.VITE_KLAVIYO_COMPANY_ID || 'RZFzAr',
  klaviyoRevision: '2026-04-15',
  lists: {
    riders: { listId: 'Y2Mqac', sourceLabel: 'Pymefy Riders Landing', roleInterest: 'repartidor' },
    earlyAccess: { listId: 'XwZS5Q', sourceLabel: 'Pymefy Acceso Anticipado', roleInterest: 'acceso_anticipado' }
  }
}

const IMAGE_COOLDOWN_MS = 5000

// MiniMax API Configuration
const MINIMAX_API_KEY = import.meta.env.VITE_MINIMAX_API_KEY || ''
const MINIMAX_API_BASE = 'https://api.minimax.chat/v1'

// Generate image using MiniMax API
async function generateWithMinimax(prompt, size = '1:1', style = 'Natural') {
  const sizeMap = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
    '3:4': { width: 768, height: 1024 },
  }
  const styleMap = {
    'Natural': 'realistic photography, natural lighting, high quality',
    'Vibrant': 'vibrant colors, vivid saturation, high contrast, high quality',
    'Anime': 'anime style, illustrated, detailed anime artwork, high quality',
    'Photography': 'professional photography, DSLR, sharp focus, studio lighting, high quality'
  }

  const dimensions = sizeMap[size] || sizeMap['1:1']
  const enhancedPrompt = `${prompt}, ${styleMap[style] || styleMap['Natural']}`

  const response = await fetch(`${MINIMAX_API_BASE}/image_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt: enhancedPrompt,
      number: 1,
      width: dimensions.width,
      height: dimensions.height,
      response_image_type: 'png'
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Error de MiniMax (${response.status})`)
  }

  const data = await response.json()
  if (data.data?.[0]?.image_url) {
    return { url: data.data[0].image_url, base64: data.data[0].base64 || null }
  }
  throw new Error('No se recibió imagen de MiniMax')
}

// Fallback: Pollinations AI
function getPollinationsUrl(prompt, size, style) {
  const styleMap = {
    'Natural': 'natural, realistic, high quality',
    'Vibrant': 'vibrant colors, vivid, saturated, high quality',
    'Anime': 'anime style, illustrated, detailed, high quality',
    'Photography': 'professional photography, DSLR, sharp focus, high quality'
  }
  const fullPrompt = `${prompt}, ${styleMap[style] || 'high quality'}`
  const sizeParams = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
    '3:4': { width: 768, height: 1024 },
  }
  const { width, height } = sizeParams[size] || sizeParams['1:1']
  const seed = Math.floor(Math.random() * 999999)
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`
}

const WA_SCENARIOS = [
  {
    messages: [
      { out: true, text: 'Hola Agente, ¿quién tiene hora mañana a las 10?' },
      { out: false, text: '📅 Mañana a las 10:00 AM tiene hora:\n\n👤 *María González*\nServicio: Corte + Tinte\n\n¿Quieres que le envíe un recordatorio?' },
      { out: true, text: 'Sí, envíale el recordatorio' },
      { out: false, text: '✅ Recordatorio enviado a María González.\n\n_"Hola María 👋 Te recordamos tu hora mañana a las 10:00 AM."_' },
    ]
  },
  {
    messages: [
      { out: true, text: 'Envía mensaje a todos los clientes del mes pasado' },
      { out: false, text: '📨 Detecté *24 clientes* del mes anterior.\n\n¿Qué mensaje quieres enviarles?' },
      { out: true, text: 'Diles que tenemos 20% de descuento esta semana' },
      { out: false, text: '🎉 Enviando a 24 clientes:\n\n_"Hola! 🌟 Esta semana tienes 20% de descuento. ¡No te lo pierdas!"_\n\n✅ Campaña enviada.' },
    ]
  },
  {
    messages: [
      { out: true, text: '¿Cuánto vendí hoy?' },
      { out: false, text: '📊 *Resumen de hoy:*\n\n💰 Ventas totales: $148.500\n👥 Clientes atendidos: 6\n📈 +23% vs. semana pasada' },
      { out: true, text: '¿Quién tiene deuda pendiente?' },
      { out: false, text: '⚠️ *Clientes con pago pendiente:*\n\n• Carlos Muñoz — $25.000\n• Ana Pérez — $18.500\n\n¿Envío recordatorios de cobro?' },
    ]
  },
  {
    messages: [
      { out: true, text: 'Agrega un servicio nuevo: Keratina $45.000' },
      { out: false, text: '✅ Servicio agregado:\n\n💇 *Keratina*\nPrecio: $45.000\n\n¿Quieres publicarlo en tu sitio web?' },
      { out: true, text: 'Sí, publícalo en el sitio' },
      { out: false, text: '🚀 ¡Publicado! El servicio *Keratina $45.000* ya está visible en tu sitio.' },
    ]
  }
]

const SUGGESTION_CHIPS = [
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

function getWaTime() {
  const now = new Date()
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim())
}

async function subscribeKlaviyo(email, listKey) {
  const { klaviyoCompanyId, klaviyoRevision, lists } = KLAVIYO_CONFIG
  const listCfg = lists[listKey]
  if (!klaviyoCompanyId || !listCfg?.listId) throw new Error('Configura Klaviyo.')
  const payload = {
    data: {
      type: 'subscription',
      attributes: {
        custom_source: listCfg.sourceLabel,
        profile: {
          data: {
            type: 'profile',
            attributes: {
              email,
              subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } },
              properties: { source: listKey === 'riders' ? 'Riders' : 'Acceso', role_interest: listCfg.roleInterest, page: window.location.href }
            }
          }
        }
      },
      relationships: { list: { data: { type: 'list', id: listCfg.listId } } }
    }
  }
  const resp = await fetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(klaviyoCompanyId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', revision: klaviyoRevision },
    body: JSON.stringify(payload)
  })
  if (!resp.ok && resp.status !== 202) throw new Error('No fue posible guardar tu correo.')
}

// Icons as components
const Icon = ({ d, width = 24, height = 24, viewBox = '0 0 24 24', fill = 'none', stroke = 'currentColor', strokeWidth = 2, strokeLinecap = 'round', strokeLinejoin = 'round' }) => (
  <svg width={width} height={height} viewBox={viewBox} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin}>{d}</svg>
)

const Icons = {
  check: <Icon d={<><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></>} />,
  shield: <Icon d={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>} />,
  star: <Icon d={<><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></>} />,
  zap: <Icon d={<><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></>} />,
  loader: <Icon d={<path d="M21 12a9 9 0 1 1-6.219-8.56"/>} />,
  x: <Icon d={<><path d="M18 6 6 18M6 6l12 12"/></>} />,
  download: <Icon d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></>} />,
  refresh: <Icon d={<><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></>} />,
  menu: <Icon d={<><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>} />,
  arrowRight: <Icon d={<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>} />,
  chevronDown: <Icon d={<path d="m6 9 6 6 6-6"/>} />,
  whatsapp: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  rocket: <Icon d={<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></>} />,
  send: <Icon d={<><path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/></>} />,
  alertTriangle: <Icon d={<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>} />,
  gift: <Icon d={<><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>} />,
}

// Navbar
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <button className="mobile-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú">
            {Icons.menu}
          </button>
        </div>
        <div className="navbar-center">
          <nav className="navbar-nav" aria-label="Principal">
            <a href="#who" className="navbar-link">Qué es</a>
            <a href="#templates" className="navbar-link">Plantillas</a>
            <a href="#erp" className="navbar-link">ERP</a>
            <a href="#agente" className="navbar-link">IA Agente</a>
            <a href="#marketplace" className="navbar-link">Marketplace</a>
            <a href="#plans" className="navbar-link">Planes</a>
          </nav>
        </div>
        <div className="navbar-right">
          <a href="#signup" className="btn-primary">Inscribirse</a>
        </div>
      </div>
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} id="mobileMenu">
        <a href="#who">Qué es</a>
        <a href="#templates">Plantillas</a>
        <a href="#erp">ERP</a>
        <a href="#agente">IA Agente</a>
        <a href="#marketplace">Marketplace</a>
        <a href="#plans">Planes</a>
        <a href="#signup" className="btn-primary" style={{ marginTop: '0.75rem', borderRadius: '1.25rem', justifyContent: 'center' }}>Inscribirse →</a>
      </div>
    </header>
  )
}

// WhatsApp Chat Animation
function WhatsAppChat({ activeScenario }) {
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const scenario = WA_SCENARIOS[activeScenario] || WA_SCENARIOS[0]

    setMessages([])
    setIsTyping(false)

    async function play() {
      for (const msg of scenario.messages) {
        if (cancelled) return
        if (!msg.out) {
          setIsTyping(true)
          await new Promise(r => setTimeout(r, 1000))
          if (cancelled) return
          setIsTyping(false)
        }
        setMessages(m => [...m, { ...msg, time: getWaTime() }])
        await new Promise(r => setTimeout(r, msg.out ? 300 : 50))
      }
    }

    play()
    return () => { cancelled = true }
  }, [activeScenario])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const formatText = (text) => {
    return text.replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
  }

  return (
    <div className="wa-body" ref={bodyRef}>
      <div className="wa-date-chip">Hoy</div>
      {messages.map((msg, i) => (
        <div key={i} className={`wa-bubble ${msg.out ? 'out' : 'in'}`}>
          <span dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
          <div className="wa-bubble-time">{msg.time}</div>
        </div>
      ))}
      {isTyping && (
        <div className="wa-typing show">
          <span></span><span></span><span></span>
        </div>
      )}
    </div>
  )
}

// Agent Particles
function AgentParticles() {
  const [particles, setParticles] = useState([])
  useEffect(() => {
    const colors = ['#25d366', '#128c7e', 'rgba(37,211,102,0.4)', '#bb4d00']
    const ps = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      bottom: Math.random() * 30,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 4 + 2,
      delay: Math.random() * 3,
      duration: Math.random() * 3 + 3
    }))
    setParticles(ps)
  }, [])
  return (
    <div className="agent-particles">
      {particles.map(p => (
        <div key={p.id} className="agent-particle" style={{
          left: `${p.left}%`, bottom: `${p.bottom}%`, background: p.color,
          width: `${p.size}px`, height: `${p.size}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`
        }} />
      ))}
    </div>
  )
}

// Hero Slider
function HeroSlider({ onOpenImgGen }) {
  const [current, setCurrent] = useState(0)
  const [waScenario, setWaScenario] = useState(0)
  const [titleOption, setTitleOption] = useState(1)
  const [leaving, setLeaving] = useState(null)
  const [entering, setEntering] = useState(null)
  const [studioIconRotating, setStudioIconRotating] = useState(false)
  const TOTAL = 4

  useEffect(() => {
    const timer = setInterval(() => {
      goTo((current + 1) % TOTAL)
    }, 15000)
    return () => clearInterval(timer)
  }, [current])

  useEffect(() => {
    let cancelled = false
    let cycleTimer
    async function playScenario(idx) {
      setWaScenario(idx)
    }
    playScenario(waScenario)
    cycleTimer = setTimeout(() => {
      if (!cancelled) setWaScenario((waScenario + 1) % WA_SCENARIOS.length)
    }, 7000)
    return () => { cancelled = true; clearTimeout(cycleTimer) }
  }, [waScenario])

  useEffect(() => {
    let timer
    if (current === 3) {
      timer = setInterval(() => {
        setTitleOption(t => t === 1 ? 2 : 1)
      }, 5000)
    }
    return () => clearInterval(timer)
  }, [current])

  const goTo = useCallback((idx) => {
    if (idx === current) return
    setLeaving(current)
    setEntering(idx)
    setTimeout(() => {
      setLeaving(null)
      setEntering(null)
      setCurrent(idx)
    }, 650)
  }, [current])

  const next = () => goTo((current + 1) % TOTAL)
  const prev = () => goTo((current - 1 + TOTAL) % TOTAL)

  const handleFeatureClick = (idx) => {
    setWaScenario(idx)
  }

  const switchTitleOption = (opt) => {
    if (opt === titleOption) return
    setStudioIconRotating(true)
    setTimeout(() => setStudioIconRotating(false), 500)
    setTitleOption(opt)
  }

  const renderSlideClass = (i) => {
    let cls = `hero-slide ${['slide-1', 'slide-2', 'slide-3', 'slide-4'][i]}`
    if (i === current) cls += ' active'
    if (i === leaving) cls += ' leaving'
    if (i === entering) cls += ' entering'
    return cls
  }

  return (
    <div className="hero-slider" id="heroSlider">
      {/* SLIDE 1 */}
      <section className={renderSlideClass(0)} data-slide="0">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-badge anim-badge">
                <div className="hero-badge-dot">
                  <div className="hero-badge-dot-core"></div>
                  <div className="hero-badge-dot-ping"></div>
                </div>
                <span className="hero-badge-text">Tu pyme hoy cambia</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              </div>
              <h1 className="hero-title">
                <span className="anim-line1" style={{ display: 'block' }}>De emprendedor,</span>
                <span className="anim-line2 shimmer-text" style={{ display: 'block' }}>a digital.</span>
              </h1>
              <p className="hero-subtitle anim-sub">La plataforma para digitalizar, formalizar y hacer crecer tu negocio chileno.</p>
              <div className="hero-ctas anim-cta">
                <a href="#signup" className="btn-primary pulse">Inscribirse por tiempo limitado {Icons.arrowRight}</a>
                <a href="#plans" className="btn-secondary">Ver planes {Icons.chevronDown}</a>
              </div>
              <div className="hero-trust anim-trust">
                <div className="hero-trust-item"><div className="hero-trust-icon">{Icons.check}</div><span>100% chileno</span></div>
                <div className="hero-trust-item"><div className="hero-trust-icon">{Icons.check}</div><span>15 min setup</span></div>
                <div className="hero-trust-item"><div className="hero-trust-icon">{Icons.check}</div><span>SII integrado</span></div>
              </div>
            </div>
            <div className="showcase">
              <div className="showcase-glow"></div>
              <div className="showcase-img center">
                <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/10147bbe-808d-46d7-9d8d-ef4df2d3c300/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Sitio web landing" loading="eager" />
                <div className="showcase-overlay"></div>
                <div className="showcase-badge"><span className="showcase-badge-dot"></span>Plantilla Landing</div>
              </div>
              <div className="showcase-img left">
                <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/30ebe785-2def-4ce4-960d-17b4c08d4d00/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Sitio ecommerce" loading="eager" />
                <div className="showcase-overlay"></div>
                <div className="showcase-badge"><span className="showcase-badge-dot"></span>Commerce</div>
              </div>
              <div className="showcase-img right">
                <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/93473259-b88d-4d2c-dd3b-8f136bc6f300/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Sitio editorial" loading="eager" />
                <div className="showcase-overlay"></div>
                <div className="showcase-badge"><span className="showcase-badge-dot"></span>Editorial</div>
              </div>
            </div>
          </div>
        </div>
        <div className="slider-nav slide-1-nav" id="sliderNav1">
          <button className="slider-arrow" onClick={prev} aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
          <div className="slider-dots">
            {[0, 1, 2, 3].map(i => (
              <button key={i} className={`slider-dot ${i === current ? 'active' : ''}`} onClick={() => goTo(i)} aria-label={`Ir a slide ${i + 1}`} />
            ))}
          </div>
          <button className="slider-arrow" onClick={next} aria-label="Siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </section>

      {/* SLIDE 2 — AGENTE IA */}
      <section className={renderSlideClass(1)} id="agente" data-slide="1">
        <AgentParticles />
        <div className="container">
          <div className="agent-grid-hero">
            <div>
              <div className="agent-eyebrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>
                IA Propia de Pymefy
              </div>
              <h2 className="agent-title-hero">Tu Agente Personal<br /><span>Financiero IA</span></h2>
              <div className="agent-features">
                {[
                  { icon: '📅', title: 'Confirma citas automáticamente', text: 'El agente escribe a tus clientes, confirma la hora y envía recordatorios.', scenario: 0 },
                  { icon: '💬', title: 'Envía mensajes a clientes', text: 'Campañas, cobros y seguimiento post-servicio, orquestado por IA.', scenario: 1 },
                  { icon: '📊', title: 'Control total por WhatsApp', text: 'Pregúntale "¿cuánto vendí hoy?" y recibe un reporte al instante.', scenario: 2 },
                  { icon: '🚀', title: 'Gestiona sin entrar al dashboard', text: 'Agrega productos, cierra ventas o revisa tu agenda hablándole al agente.', scenario: 3 },
                ].map((feat, i) => (
                  <div key={i} className={`agent-feat ${waScenario === feat.scenario ? 'active' : ''}`} onClick={() => handleFeatureClick(feat.scenario)}>
                    <div className="agent-feat-icon">{feat.icon}</div>
                    <div>
                      <p className="agent-feat-title">{feat.title}</p>
                      <p className="agent-feat-text">{feat.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="agent-hero-ctas">
                <a href="#signup" className="btn-wa">{Icons.whatsapp} Probar el Agente IA</a>
                <a href="#signup" className="btn-ghost-light">Ver planes {Icons.chevronDown}</a>
              </div>
            </div>
            <div className="agent-visual-hero">
              <div className="agent-glow-orb"></div>
              <div className="agent-badge-float abf-1">🔔 24/7 activo</div>
              <div className="agent-badge-float abf-2">✓ Respuesta en segundos</div>
              <div className="agent-badge-float abf-3">📈 +40% retención</div>
              <div className="agent-phone-wrap">
                <div className="agent-phone">
                  <div className="phone-notch"><div className="phone-notch-pill"></div></div>
                  <div className="wa-header">
                    <div className="wa-avatar">🤖</div>
                    <div><p className="wa-name">Agente Pymefy IA</p><div className="wa-status"><span className="wa-status-dot"></span>En línea</div></div>
                  </div>
                  <WhatsAppChat activeScenario={waScenario} />
                  <div className="wa-input-bar">
                    <div className="wa-fake-input">Escribe un mensaje...</div>
                    <div className="wa-send-btn">
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="agent-robot-wrap">
                <svg viewBox="0 0 260 380" xmlns="http://www.w3.org/2000/svg" fill="none">
                  <defs>
                    <linearGradient id="bodyGrad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2a2a2a"/><stop offset="100%" stopColor="#1a1a1a"/></linearGradient>
                    <linearGradient id="headGrad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#333"/><stop offset="100%" stopColor="#1f1f1f"/></linearGradient>
                    <filter id="glow2"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <ellipse cx="130" cy="370" rx="70" ry="10" fill="rgba(37,211,102,0.08)"/>
                  <rect x="90" y="280" width="28" height="70" rx="14" fill="url(#bodyGrad2)"/>
                  <rect x="142" y="280" width="28" height="70" rx="14" fill="url(#bodyGrad2)"/>
                  <rect x="82" y="336" width="44" height="18" rx="9" fill="#222"/>
                  <rect x="134" y="336" width="44" height="18" rx="9" fill="#222"/>
                  <rect x="68" y="160" width="124" height="130" rx="24" fill="url(#bodyGrad2)"/>
                  <rect x="84" y="178" width="92" height="4" rx="2" fill="rgba(37,211,102,0.2)"/>
                  <rect x="86" y="206" width="88" height="54" rx="12" fill="#0b141a" stroke="rgba(37,211,102,0.3)" strokeWidth="1.5"/>
                  <rect x="96" y="216" width="14" height="14" rx="7" fill="#25d366" opacity="0.9"/>
                  <rect x="116" y="218" width="32" height="4" rx="2" fill="rgba(255,255,255,0.6)"/>
                  <rect x="116" y="226" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.3)"/>
                  <rect x="96" y="236" width="68" height="3" rx="1.5" fill="rgba(37,211,102,0.4)"/>
                  <rect x="96" y="243" width="50" height="3" rx="1.5" fill="rgba(37,211,102,0.25)"/>
                  <circle cx="130" cy="276" r="6" fill="rgba(37,211,102,0.2)" stroke="rgba(37,211,102,0.4)" strokeWidth="1"/>
                  <rect x="36" y="168" width="36" height="22" rx="11" fill="url(#bodyGrad2)"/>
                  <circle cx="36" cy="179" r="14" fill="#2a2a2a" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                  <rect x="190" y="150" width="36" height="22" rx="11" fill="url(#bodyGrad2)" transform="rotate(-20 208 161)"/>
                  <g transform="translate(195,108) rotate(8)">
                    <rect x="0" y="0" width="42" height="68" rx="7" fill="#111" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
                    <rect x="3" y="8" width="36" height="55" rx="4" fill="#075e54"/>
                    <circle cx="21" cy="30" r="10" fill="rgba(255,255,255,0.15)"/>
                    <rect x="7" y="45" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"/>
                    <rect x="14" y="2" width="14" height="4" rx="2" fill="#0a0a0a"/>
                  </g>
                  <rect x="112" y="136" width="36" height="28" rx="10" fill="#252525"/>
                  <rect x="62" y="60" width="136" height="88" rx="28" fill="url(#headGrad2)" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                  <rect x="60" y="82" width="6" height="20" rx="3" fill="#222"/>
                  <circle cx="63" cy="80" r="5" fill="#25d366" filter="url(#glow2)"/>
                  <rect x="194" y="82" width="6" height="20" rx="3" fill="#222"/>
                  <circle cx="197" cy="80" r="5" fill="#25d366" filter="url(#glow2)"/>
                  <rect x="127" y="38" width="6" height="26" rx="3" fill="#333"/>
                  <circle cx="130" cy="36" r="7" fill="#bb4d00" filter="url(#glow2)"/>
                  <circle cx="130" cy="36" r="4" fill="#e8720a"/>
                  <rect x="84" y="88" width="36" height="24" rx="10" fill="#0b141a"/>
                  <rect x="140" y="88" width="36" height="24" rx="10" fill="#0b141a"/>
                  <rect x="88" y="92" width="28" height="16" rx="7" fill="#25d366" opacity="0.85"/>
                  <rect x="144" y="92" width="28" height="16" rx="7" fill="#25d366" opacity="0.85"/>
                  <circle cx="102" cy="100" r="5" fill="#064e3b"/>
                  <circle cx="158" cy="100" r="5" fill="#064e3b"/>
                  <circle cx="104" cy="98" r="2" fill="rgba(255,255,255,0.6)"/>
                  <circle cx="160" cy="98" r="2" fill="rgba(255,255,255,0.6)"/>
                  <rect x="96" y="124" width="68" height="10" rx="5" fill="#0b141a"/>
                  <rect x="108" y="127" width="44" height="4" rx="2" fill="#25d366" opacity="0.7"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="slider-nav">
          <button className="slider-arrow" onClick={prev} aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="m15 18-6-6 6-6"/></svg></button>
          <div className="slider-dots">
            {[0, 1, 2, 3].map(i => (
              <button key={i} className={`slider-dot ${i === current ? 'active' : ''}`} onClick={() => goTo(i)} />
            ))}
          </div>
          <button className="slider-arrow" onClick={next} aria-label="Siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </section>

      {/* SLIDE 3 — MARKETPLACE */}
      <section className={renderSlideClass(2)} id="marketplace" data-slide="2">
        <div className="container mp-inner">
          <div className="mp-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div className="mp-hero-tag"><span className="mp-coming-dot"></span>Próximamente</div>
                <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>En desarrollo</span>
              </div>
              <h2 className="mp-hero-title">
                Tu marketplace<br />
                <span className="mp-hero-gradient">de confianza.</span>
              </h2>
              <p className="mp-hero-subtitle">Conecta proveedores verificados, negocia en tiempo real y recibe todo en tu negocio sin intermediarios.</p>
             
              <div className="mp-hero-ctas">
                <button className="btn-indigo" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Unirse a lista de espera
                </button>
              </div>
              <div className="mp-hero-stats">
                <div><div className="mp-stat-num" style={{ background: 'linear-gradient(120deg, #a78bfa, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>240+</div><div className="mp-stat-lbl">Proveedores</div></div>
                <div><div className="mp-stat-num" style={{ background: 'linear-gradient(120deg, #a78bfa, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>18K</div><div className="mp-stat-lbl">Productos</div></div>
                <div><div className="mp-stat-num" style={{ background: 'linear-gradient(120deg, #a78bfa, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>99.8%</div><div className="mp-stat-lbl">Uptime</div></div>
              </div>
              <div className="mp-supplier-types">
                {[
                  { color: '#059669', label: 'Restaurantes' },
                  { color: '#6366f1', label: 'Vestuario' },
                  { color: '#d97706', label: 'Tecnología' },
                  { color: '#db2777', label: 'Belleza' },
                ].map((t, i) => (
                  <div key={i} className="mp-type-pill">
                    <span className="mp-type-dot" style={{ background: t.color }}></span>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="mp-hero-visual">
              <div className="mp-orbit-center">
                <div className="mp-orbit-ring"></div>
                <div className="mp-orbit-ring"></div>
                <div className="mp-orbit-ring"></div>
                <div className="mp-core-logo">🏪</div>
                <div className="mp-orbit-card mp-card-a"><span>🏭</span> Abastecimiento</div>
                <div className="mp-orbit-card mp-card-b"><span>📦</span> Logística</div>
                <div className="mp-orbit-card mp-card-c"><span>💳</span> Pagos</div>
                <div className="mp-orbit-card mp-card-d"><span>🔄</span> Reabastecimiento</div>
              </div>
             
              <div className="mp-countdown-pill">
                <span className="mp-countdown-dot"></span>
                Lanzamiento: Q3 2026
              </div>
            </div>
          </div>
        </div>
        <div className="slider-nav">
          <button className="slider-arrow" onClick={prev} aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="m15 18-6-6 6-6"/></svg></button>
          <div className="slider-dots">
            {[0, 1, 2, 3].map(i => (
              <button key={i} className={`slider-dot ${i === current ? 'active' : ''}`} onClick={() => goTo(i)} />
            ))}
          </div>
          <button className="slider-arrow" onClick={next} aria-label="Siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </section>

      {/* SLIDE 4 — STUDIO / CONSTRUCTOR */}
      <section className={renderSlideClass(3)} data-slide="3">
        <div className="studio-bg-effects">
          <div className="studio-orb studio-orb-1"></div>
          <div className="studio-orb studio-orb-2"></div>
          <div className="studio-orb studio-orb-3"></div>
          <div className="studio-grid-lines"></div>
        </div>
        <div className="container studio-container">
          <div className="studio-layout">
            <div className="studio-info-col">
              <div className="studio-eyebrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>
                Nuevo en Pymefy
              </div>
              <div className="studio-title-wrap">
                <h2 className="studio-title" id="studioTitleOption1" style={{ display: titleOption === 1 ? 'block' : 'none' }}>
                  Crea imágenes<br />
                  <span className="studio-gradient-text">con inteligencia artificial</span>
                </h2>
                <h2 className="studio-title" id="studioTitleOption2" style={{ display: titleOption === 2 ? 'block' : 'none' }}>
                  Construye tu web<br />
                  <span className="studio-gradient-text-cyan">sin escribir código</span>
                </h2>
              </div>
              <p className="studio-subtitle" id="studioSubtitle1" style={{ display: titleOption === 1 ? 'block' : 'none' }}>
                Genera fotos de producto, banners, logos y más en segundos. Solo describe lo que necesitas.
              </p>
              <p className="studio-subtitle" id="studioSubtitle2" style={{ display: titleOption === 2 ? 'block' : 'none' }}>
                Arrastra, suelta y publica. Tu página lista en minutos, sin esperar a un desarrollador.
              </p>
              <div className="studio-pills">
                {['Foto producto', 'Banner RRSS', 'Logo marca', 'Mockup 3D', 'Pin Pinterest'].map((p, i) => (
                  <div key={i} className="studio-pill"><span className="studio-pill-dot" style={{ background: ['#a78bfa', '#38bdf8', '#4ade80', '#fb923c', '#f472b6'][i] }}></span>{p}</div>
                ))}
              </div>
              
              <div className="studio-left-cta">
                <div className="studio-left-cta-label">Herramientas disponibles</div>
                <div className="studio-cta-btns">
                  <button className="btn-studio" onClick={onOpenImgGen}>
                    <span id="studioTitleIcon" className={`studio-title-icon ${studioIconRotating ? 'switching' : ''}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                    </span>
                    Generar imagen
                  </button>
                  <button className="btn-constructor">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    Constructor web
                  </button>
                </div>
              </div>
              <div className="studio-title-indicator">
                <button className={`indicator-dot ${titleOption === 1 ? 'active' : ''}`} onClick={() => switchTitleOption(1)} />
                <button className={`indicator-dot ${titleOption === 2 ? 'active' : ''}`} onClick={() => switchTitleOption(2)} />
              </div>
            </div>
            <div className="studio-cards-col">
              <div className="">
                <div className="studio-card-top">
                  <div className="panel-icon">🎨</div>
                  <div className="panel-title-area">
                    <h3 className="panel-title">Pymefy Studio</h3>
                    <p className="panel-subtitle">Generación de imágenes con IA</p>
                  </div>
                  <div className="panel-badge badge-purple">IA</div>
                </div>
                <div className="studio-card-body">
                  <div className="studio-img-pane">
                    <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/93473259-b88d-4d2c-dd3b-8f136bc6f300/width=400,height=250,fit=cover,gravity=top,quality=85,format=auto" alt="Studio" />
                    <div className="studio-img-pane-overlay"></div>
                    <div className="img-chip chip-purple"><span className="img-chip-dot"></span> En vivo</div>
                  </div>
                  <div className="feat-list">
                    {['Genera en segundos', '6 estilos artísticos', 'Alta resolución', 'Sin watermark'].map((f, i) => (
                      <div key={i} className="feat-row">
                        <div className="feat-check check-purple">✓</div>
                        <div className="feat-text-wrap">
                          <p className="feat-title">{f}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
              </div>
              <div className="">
                <div className="studio-card-top">
                  <div className="panel-icon">🔧</div>
                  <div className="panel-title-area">
                    <h3 className="panel-title">Constructor Web</h3>
                    <p className="panel-subtitle">Sitios sin código</p>
                  </div>
                  <div className="panel-badge badge-cyan">Nuevo</div>
                </div>
                <div className="studio-card-body">
                  <div className="studio-img-pane">
                    <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/30ebe785-2def-4ce4-960d-17b4c08d4d00/width=400,height=250,fit=cover,gravity=top,quality=85,format=auto" alt="Constructor" />
                    <div className="studio-img-pane-overlay"></div>
                    <div className="img-chip chip-cyan"><span className="img-chip-dot"></span> Beta</div>
                  </div>
                  <div className="feat-list">
                    {['Arrastra y suelta', '50+ plantillas', 'SEO incluido', 'Móvil-first'].map((f, i) => (
                      <div key={i} className="feat-row">
                        <div className="feat-check check-cyan">✓</div>
                        <div className="feat-text-wrap">
                          <p className="feat-title">{f}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
        <div className="slider-nav studio-nav">
          <button className="slider-arrow" onClick={prev} aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="m15 18-6-6 6-6"/></svg></button>
          <div className="slider-dots">
            {[0, 1, 2, 3].map(i => (
              <button key={i} className={`slider-dot ${i === current ? 'active' : ''}`} onClick={() => goTo(i)} />
            ))}
          </div>
          <button className="slider-arrow" onClick={next} aria-label="Siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </section>
    </div>
  )
}

// Trust Strip
function TrustStrip() {
  return (
    <div className="trust-strip">
      <div className="trust-strip-inner">
        {[
          { icon: Icons.shield, label: 'Datos 100% seguros' },
          { icon: Icons.star, label: '+3.500 empresas activas' },
          { icon: Icons.zap, label: 'Setup en 15 minutos' },
          { icon: Icons.check, label: 'Soporte en Chile' },
        ].map((t, i) => (
          <div key={i} className="trust-item">
            <div className="trust-icon">{t.icon}</div>
            <span className="trust-label">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Stats
function Stats() {
  const stats = [
    { value: '3.500+', label: 'PyMEs activas', color: 'var(--primary)' },
    { value: '98%', label: 'Satisfacción', color: 'var(--success)' },
    { value: '12M+', label: 'Transacciones', color: 'var(--accent)' },
    { value: '24/7', label: 'Disponibilidad', color: '#6366f1' },
  ]
  return (
    <section className="section">
      <div className="container">
        <div className="stats-grid">
          {stats.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// What is section
function WhatIs() {
  return (
    <section className="section" id="who">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 1rem' }}>
          <p className="section-eyebrow">¿Qué es Pymefy?</p>
          <h2 className="section-title">Tu negocio digital,<br />sin complicaciones.</h2>
        </div>
        <div className="cards-grid">
          {[
            { icon: '🚀', title: 'Digitaliza en minutos', text: 'Crea tu sitio web, agenda citas y cobra online sin necesidad de conocimientos técnicos. Todo en una sola plataforma.' },
            { icon: '📊', title: 'Gestiona desde cualquier lugar', text: 'Administra ventas, inventario y clientes desde tu celular. Con reportes claros para tomar mejores decisiones.' },
            { icon: '🤝', title: 'Conecta con tu comunidad', text: 'Llega a más clientes через redes sociales, WhatsApp y email. Herramientas de marketing incluidas para hacer crecer tu base.' },
          ].map((c, i) => (
            <div key={i} className="info-card">
              <div className="card-icon-wrap">{c.icon}</div>
              <div className="card-header">
                <h3 className="card-title">{c.title}</h3>
              </div>
              <p className="card-text">{c.text}</p>
            </div>
          ))}
        </div>
        <div className="not-divider">
          <div className="not-line"></div>
          <div className="not-badge">No es Wix, Shopify ni WordPress</div>
          <div className="not-line"></div>
        </div>
        <div className="cards-grid" style={{ marginTop: '2rem' }}>
          {[
            { icon: '💸', title: 'No cobramos por transacción', text: 'Mantén el 100% de tus ventas. Sin comisiones ocultas ni cortes por cada venta que haces.' },
            { icon: '🎯', title: 'Hecho para Chile', text: 'Facturación SII, medios de pago locales y soporte en español. Adaptado a la realidad pyme.' },
            { icon: '⚡', title: 'Rápido y eficiente', text: 'Tu sitio carga en menos de 2 segundos. Optimizado para móviles, el dispositivo que usan tus clientes.' },
          ].map((c, i) => (
            <div key={i} className="not-card">
              <div className="card-icon-wrap muted">{c.icon}</div>
              <div className="card-header">
                <h3 className="card-title">{c.title}</h3>
              </div>
              <p className="card-text">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Templates
function Templates() {
  const [activeTag, setActiveTag] = useState(0)
  const tags = ['Todos', 'Restaurantes', 'Retail', 'Servicios', 'Salud']
  return (
    <section className="section templates-wrap" id="templates">
      <div className="container">
        <div style={{ textAlign: 'center' }}>
          <p className="section-eyebrow">Plantillas</p>
          <h2 className="section-title">Elige el diseño perfecto<br />para tu negocio.</h2>
        </div>
        <div className="template-tags">
          {tags.map((t, i) => (
            <button key={i} className={`tag ${activeTag === i ? 'active' : ''}`} onClick={() => setActiveTag(i)}>{t}</button>
          ))}
        </div>
        <div className="templates-fan-wrap">
          <div className="fan-img f-center" style={{ transform: 'translateX(-50%)' }}>
            <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/10147bbe-808d-46d7-9d8d-ef4df2d3c300/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Center" />
          </div>
          <div className="fan-img f-left1">
            <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/30ebe785-2def-4ce4-960d-17b4c08d4d00/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Left1" />
          </div>
          <div className="fan-img f-right1">
            <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/93473259-b88d-4d2c-dd3b-8f136bc6f300/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Right1" />
          </div>
          <div className="fan-img f-left2">
            <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/10147bbe-808d-46d7-9d8d-ef4df2d3c300/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Left2" />
          </div>
          <div className="fan-img f-right2">
            <img src="https://imagedelivery.net/JG2b3u-FulEpwbFCirpjnw/30ebe785-2def-4ce4-960d-17b4c08d4d00/width=500,height=750,fit=cover,gravity=top,quality=85,format=auto" alt="Right2" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ERP Section
function ERPSection() {
  return (
    <section className="section" id="erp">
      <div className="container">
        <div className="erp-grid">
          <div className="dark-card">
            <p className="dark-eyebrow">ERP · Gestiona todo</p>
            <h2 className="dark-title">Tu negocio controlado<br />desde cualquier lugar.</h2>
            <p className="dark-text">Ventas, inventario, clientes y reportes. Todo integrado para que tomes mejores decisiones.</p>
            <div className="dark-items">
              {[
                { icon: '📦', text: 'Inventario en tiempo real', bar: '#059669' },
                { icon: '💰', text: 'Control de caja y cierres', bar: '#d97706' },
                { icon: '📈', text: 'Reportes de ventas', bar: '#6366f1' },
                { icon: '👥', text: 'Gestión de clientes', bar: '#db2777' },
                { icon: '📅', text: 'Agenda y calendario', bar: '#bb4d00' },
                { icon: '🧾', text: 'Facturación SII', bar: '#059669' },
              ].map((d, i) => (
                <div key={i} className="dark-item">
                  <div className="dark-item-icon">{d.icon}</div>
                  <div className="dark-item-text">{d.text}</div>
                  <div className="dark-item-bar" style={{ background: d.bar }}></div>
                </div>
              ))}
            </div>
          </div>
          <div className="light-card">
            <h3 className="light-title">Empieza en 3 pasos</h3>
            <div className="steps-list">
              {[
                { num: '1', title: 'Conecta tus canales', text: 'Instagram, WhatsApp, Google, Facebook. Todo en un solo lugar.' },
                { num: '2', title: 'Agrega tus productos', text: 'Sube tu inventario, define precios y variantes en minutos.' },
                { num: '3', title: 'Empieza a vender', text: 'Recibe pagos, confirma pedidos y entrega sin complicaciones.' },
              ].map((s, i) => (
                <div key={i} className="step-item">
                  <div className="step-num">{s.num}</div>
                  <div>
                    <div className="step-title">{s.title}</div>
                    <div className="step-text">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-ctas">
              <a href="#signup" className="btn-primary">Comenzar gratis {Icons.arrowRight}</a>
              <a href="#plans" className="btn-secondary">Ver planes</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Free CTA
function FreeCTA() {
  return (
    <section className="section">
      <div className="container">
        <div className="free-cta">
          <div className="free-cta-glow1"></div>
          <div className="free-cta-glow2"></div>
          <div className="free-cta-grid">
            <div>
              <div className="free-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                Oferta especial
              </div>
              <h2 className="free-title">Plan gratuito永久.</h2>
              <p className="free-text">Sin límite de tiempo. Sin tarjeta de crédito. Empieza hoy y crece sin costos fijos.</p>
              <div className="free-features">
                {['Sitio web básico', 'Agenda 30 reservas/mes', '5 productos', '报告会 mensual'].map((f, i) => (
                  <div key={i} className="free-feat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <a href="#signup" className="btn-success">
              {Icons.gift} Empezar gratis
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// Plans
function Plans() {
  const plans = [
    { name: 'Gratuito', price: '$0', period: 'para siempre', features: ['1 sitio web', '30 reservas/mes', '5 productos', '报告会 básico', 'Soporte email'], color: '#059669', btnClass: 'green', dot: '#059669', eyebrow: 'rgba(5,150,105,0.1)', eyebrowText: '#064e3b' },
    { name: 'Básico', price: '$14.990', period: '/mes', features: ['1 sitio web pro', 'Reservas ilimitadas', '20 productos', '报告会 avanzado', 'Dominio propio', 'Sin ads Pymefy'], color: '#d97706', btnClass: 'amber', dot: '#d97706', eyebrow: 'rgba(217,119,6,0.1)', eyebrowText: '#78350f', spotlight: true },
    { name: 'Avanzado', price: '$29.990', period: '/mes', features: ['3 sitios web', 'Reservas + citas', '100 productos', 'Integración RRSS', 'Auto-marketing', '优先支持'], color: '#1d4ed8', btnClass: 'blue', dot: '#1d4ed8', eyebrow: 'rgba(29,78,216,0.1)', eyebrowText: '#1e3a8a' },
    { name: 'Emprendedor', price: '$49.990', period: '/mes', features: ['5 sitios web', 'Herramientas IA', '500 productos', 'ERP completo', 'API acceso', '优先支持 24/7'], color: '#7c3aed', btnClass: 'blue', dot: '#7c3aed', eyebrow: 'rgba(124,58,237,0.1)', eyebrowText: '#5b21b6' },
    { name: 'Corporativo', price: '$99.990', period: '/mes', features: ['Sitios ilimitados', 'Multi-usuario', 'Integraciones custom', 'SLA garantizado', 'Onboarding dedicado'], color: '#db2777', btnClass: 'blue', dot: '#db2777', eyebrow: 'rgba(219,39,119,0.1)', eyebrowText: '#9d174d' },
  ]
  return (
    <section className="section" id="plans">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
          <p className="section-eyebrow">Planes</p>
          <h2 className="section-title">Elige el plan ideal<br />para tu negocio.</h2>
        </div>
        <div className="plans-wrap">
          <div className="plans-cards">
            {plans.map((p, i) => (
              <div key={i} className={`plan-card ${p.spotlight ? 'spotlight' : ''}`}>
                {p.spotlight && <div className="plan-popular"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>Más popular</div>}
                <div className="plan-header">
                  <div className="plan-dot" style={{ background: p.dot }}></div>
                  <div style={{ display: 'inline-flex', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: p.eyebrow, color: p.eyebrowText }}>{p.name}</div>
                </div>
                <div className="plan-name">{p.name}</div>
                <div className="plan-sub">Para comenzar</div>
                <div className="plan-price">{p.price}<span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-light)' }}>{p.period}</span></div>
                <div className="plan-price-note">Sin costos ocultos</div>
                <button className={`plan-btn ${p.btnClass}`} style={{ background: p.color }}>
                  {p.name === 'Gratuito' ? 'Empezar gratis' : 'Elegir plan'}
                </button>
                <div className="plan-features">
                  {p.features.map((f, j) => (
                    <div key={j} className="plan-feat">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <div className="plan-note">{p.name === 'Gratuito' ? 'Renovable mes a mes. Cancela cuando quieras.' : 'Factura anual disponible. Soporte incluido.'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// Signup Section
function SignupSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [msg, setMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValidEmail(email)) { setMsg('Ingresa un correo válido.'); setStatus('error'); return }
    setStatus('loading')
    setMsg('Guardando tu correo...')
    try {
      await subscribeKlaviyo(email, 'earlyAccess')
      setStatus('success')
      setMsg('¡Listo! Tu correo quedó registrado.')
      setEmail('')
    } catch (err) {
      setStatus('error')
      setMsg(err.message || 'Error al guardar.')
    }
  }

  return (
    <section className="section" id="signup">
      <div className="container">
        <div className="signup-inner">
          <div className="signup-glow1"></div>
          <div className="signup-glow2"></div>
          <div className="signup-grid">
            <div>
              <div className="signup-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                Acceso anticipado
              </div>
              <h2 className="signup-title">Tu negocio merece<br />estar en internet.</h2>
              <div className="signup-perks">
                {['Sin compromiso', 'Soporte incluido', 'Setup en 15 min', 'Dominio propio'].map((p, i) => (
                  <div key={i} className="signup-perk">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                    {p}
                  </div>
                ))}
              </div>
            </div>
            <div className="form-box">
              <p className="form-highlight">Primer mes gratis en plan Avanzado</p>
              <form className="form-fields" onSubmit={handleSubmit}>
                <div className="field-label">
                  <span className="field-label-text">Tu correo electrónico</span>
                  <input
                    type="email"
                    className="field-input"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className={`submit-btn ${status === 'loading' ? 'spin' : ''} ${status === 'success' ? 'ok' : ''}`} disabled={status === 'loading'}>
                  {status === 'loading' ? <><svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando...</> : status === 'success' ? '¡Listo!' : <>Inscribirme ahora {Icons.arrowRight}</>}
                </button>
              </form>
              <div className={`form-msg ${status === 'error' ? 'err' : status === 'success' ? 'ok' : 'info'}`}>{msg}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


const TOTAL_RIDER_FRAMES = 154
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
// Rider Section
function RiderSection() {
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [msg, setMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValidEmail(email)) return
    setStatus('loading')
    try {
      await subscribeKlaviyo(email, 'riders')
      setStatus('success')
      setMsg('¡Postulación recibida! Te contactaremos pronto.')
    } catch (err) {
      setStatus('error')
      setMsg(err.message || 'Error al guardar.')
    }
  }

  return (
    <section className="rider-section" id="rider">
      <div className="container">
        <div className="rider-header">
          <div className="rider-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            Trabajando con Pymefy
          </div>
          <h2 className="rider-title">Repartidores independientes,<br />libertad total.</h2>
          <p className="rider-subtitle">Genera ingresos extras entregando con tu moto, bicicleta o auto. Tú eliges tus horarios.</p>
        </div>
        <div className="rider-cards-row">
          {[
            { icon: '💰', title: 'Gana más', text: 'Comisiones competitivas y propinas integradas' },
            { icon: '🕐', title: 'Tú decides', text: 'Activo cuando quieras, cero mínimo obligatorio' },
            { icon: '📱', title: 'Sencillo', text: 'Recibe pedidos, navega y entrega. Todo en una app' },
            { icon: '💳', title: 'Pagos rápidos', text: 'Cobra diaria o semanal, sin esperas' },
          ].map((c, i) => (
            <div key={i} className="rider-card">
              <div className="rider-card-icon">{c.icon}</div>
              <div>
                <div className="rider-card-title">{c.title}</div>
                <div className="rider-card-text">{c.text}</div>
              </div>
            </div>
          ))}
        </div>
        <RiderAnimation />
        <div className="rider-cta-area">
          <div className="rider-capture-shell" id="riderCaptureShell" style={{}}>
            <button className="rider-cta-btn" id="riderCtaBtn" onClick={() => setExpanded(true)}>
              Postular como repartidor
            </button>
            <div className="rider-form-container">
              <form className="rider-form" onSubmit={handleSubmit}>
                <div className="form-header">
                  <span className="form-header-title">Ingresa tu correo</span>
                  <button type="button" className="form-close" onClick={() => setExpanded(false)}>✕</button>
                </div>
                <div className="form-row">
                  <input
                    type="email"
                    className="rider-input"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="rider-submit-btn" disabled={status === 'loading'}>
                    {status === 'loading' ? 'Enviando...' : status === 'success' ? '✓' : 'Enviar'}
                  </button>
                </div>
                {msg && <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.875rem', color: status === 'success' ? '#059669' : '#ef4444' }}>{msg}</div>}
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Image Generator Modal
function ImageGeneratorModal({ open, onClose }) {
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1:1')
  const [style, setStyle] = useState('Natural')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const lastGeneratedRef = useRef(0)
  const cooldownTimerRef = useRef(null)
  const [clientIP, setClientIP] = useState(null)
  const [rateLimitInfo, setRateLimitInfo] = useState({ allowed: true, remaining: GENERATION_LIMIT, resetTime: null })

  useEffect(() => {
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
  }, [open, clientIP])

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    }
  }, [])

  const startCooldown = () => {
    const now = Date.now()
    lastGeneratedRef.current = now
    setCooldown(true)
    setCooldownRemaining(IMAGE_COOLDOWN_MS)

    cooldownTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - now
      const remaining = Math.max(0, IMAGE_COOLDOWN_MS - elapsed)
      setCooldownRemaining(remaining)
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current)
        setCooldown(false)
      }
    }, 100)
  }

  const canGenerate = () => {
    const elapsed = Date.now() - lastGeneratedRef.current
    return elapsed >= IMAGE_COOLDOWN_MS
  }

   const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (!canGenerate()) return
    if (!rateLimitInfo.allowed) return

    setLoading(true)
    setError(null)
    setResult(null)
    startCooldown()

    const styleMap = {
      'Natural': 'natural, realistic, high quality',
      'Vibrant': 'vibrant colors, vivid, saturated, high quality',
      'Anime': 'anime style, illustrated, detailed, high quality',
      'Photography': 'professional photography, DSLR, sharp focus, studio lighting, high quality'
    }

    const fullPrompt = `${prompt}, ${styleMap[style] || 'high quality'}`
    const sizeParams = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '3:4': { width: 768, height: 1024 },
    }
    const { width, height } = sizeParams[size] || sizeParams['1:1']

    try {
      // Try MiniMax first if API key is configured
      if (MINIMAX_API_KEY) {
        try {
          const result = await generateWithMinimax(prompt, size, style)
          setResult({ url: result.url, prompt })
          if (clientIP) {
            recordGeneration(clientIP)
            setRateLimitInfo(checkRateLimit(clientIP))
          }
          setLoading(false)
          return
        } catch (minimaxError) {
          console.warn('MiniMax failed, falling back to Pollinations:', minimaxError)
          // Fall through to Pollinations fallback
        }
      }

      // Fallback to Pollinations.ai
      const seed = Math.floor(Math.random() * 999999)
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`

      await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = () => reject(new Error('No se pudo generar la imagen.'))
        img.src = imageUrl
      })
      setResult({ url: imageUrl, prompt })
      if (clientIP) {
        recordGeneration(clientIP)
        setRateLimitInfo(checkRateLimit(clientIP))
      }
    } catch (err) {
      setError(err.message || 'Error al generar. Intenta con otro prompt.')
    } finally {
      setLoading(false)
     }
   }

   const handleDownload = async () => {
    if (!result?.url) return
    try {
      const resp = await fetch(result.url)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pymefy-studio-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(result.url, '_blank')
    }
  }

  const handleRegenerate = () => {
    if (prompt) handleGenerate()
  }

  const handleChip = (chipPrompt) => {
    setPrompt(chipPrompt)
  }

  if (!open) return null

  const charCount = prompt.length
  const canSubmit = prompt.trim().length >= 3 && !loading && !cooldown

  return (
    <div className="img-gen-modal">
      <div className="img-gen-overlay" onClick={onClose}></div>
      <div className="img-gen-container">
        <div className="img-gen-main">
          {/* Header */}
          <div className="img-gen-header">
          <div className="img-gen-title-wrap">
            <div className="img-gen-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
            </div>
            <div>
              <h3 className="img-gen-title">Generador de imágenes</h3>
              <p className="img-gen-subtitle">Pymefy Studio AI · Pruebalo gratis</p>
            </div>
          </div>
          <button className="img-gen-close" onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Suggestions */}
        <div className="img-gen-suggestions">
          <p className="img-gen-suggestions-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Sugerencias rápidas
          </p>
          <div className="img-gen-suggestion-chips">
            {SUGGESTION_CHIPS.map((chip, i) => (
              <button key={i} className="suggestion-chip" onClick={() => handleChip(chip.prompt)}>
                {chip.emoji} {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="img-gen-prompt-area">
          <div className="img-gen-input-wrap">
            <textarea
              className="img-gen-textarea"
              placeholder="Describe la imagen que quieres generar... (ej: 'Logo para una cafetería moderna con estilo minimalista en tonos café')"
              rows="3"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <div className="img-gen-input-actions">
              <div className={`img-gen-char-count ${charCount > 450 ? 'warning' : ''} ${charCount > 500 ? 'error' : ''}`}>
                <span>{charCount}</span> / 500
              </div>
              <button className="img-gen-clear-btn" onClick={() => setPrompt('')} title="Limpiar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="img-gen-options">
            <div className="img-gen-option-group">
              <label className="img-gen-option-label">Tamaño</label>
              <div className="img-gen-option-btns">
                {['1:1', '16:9', '9:16', '3:4'].map(s => (
                  <button key={s} className={`img-gen-opt-btn ${size === s ? 'active' : ''}`} data-size={s} onClick={() => setSize(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="img-gen-option-group">
              <label className="img-gen-option-label">Estilo</label>
              <div className="img-gen-option-btns">
                {['Natural', 'Vibrant', 'Anime', 'Photography'].map(st => (
                  <button key={st} className={`img-gen-opt-btn style-btn ${style === st ? 'active' : ''}`} onClick={() => setStyle(st)}>
                    {st === 'Natural' ? '🌿' : st === 'Vibrant' ? '🎨' : st === 'Anime' ? '✨' : '📷'} {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="img-gen-actions">
          <div className="img-gen-credits">
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
            disabled={!canSubmit || !rateLimitInfo.allowed}
          >
            {loading ? (
              <span className="img-gen-submit-loading">
                <svg className="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Generando...
              </span>
            ) : cooldown ? (
              <span style={{ fontSize: '0.8125rem' }}>Espera {Math.ceil(cooldownRemaining / 1000)}s</span>
            ) : !rateLimitInfo.allowed ? (
              <span style={{ fontSize: '0.8125rem' }}>Límite alcanzado</span>
            ) : (
              <span className="img-gen-submit-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>
                Generar imagen
              </span>
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="img-gen-results">
            <div className="img-gen-results-header">
              <h4 className="img-gen-results-title">Resultado</h4>
              <div className="img-gen-results-actions">
                <button className="img-gen-action-btn" onClick={handleDownload}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  Descargar
                </button>
                <button className="img-gen-action-btn" onClick={handleRegenerate} disabled={loading || cooldown}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  Regenerar
                </button>
              </div>
            </div>
            <div className="img-gen-image-wrap">
              <img src={result.url} alt="Imagen generada" className="img-gen-image" />
              <div className="img-gen-image-overlay">
                <div className="img-gen-image-prompt">{result.prompt}</div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
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
    </div>
    </div>
  )
}

// Footer
function Footer() {
  return (
    <footer style={{ padding: '0 1.5rem 3rem' }}>
      <div className="container" style={{ padding: 0 }}>
        <div className="footer-inner">
          <div className="footer-bottom">
            <span>© 2026 Pymefy. Todos los derechos reservados.</span>
            <span>Hecho con ❤️ en Chile</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Main App
export default function App() {
  const [imgGenOpen, setImgGenOpen] = useState(false)

  useEffect(() => {
    window.openImageGenerator = () => setImgGenOpen(true)
  }, [])

  return (
    <>
      <Navbar />
      <HeroSlider onOpenImgGen={() => setImgGenOpen(true)} />
      <TrustStrip />
      <Stats />
      <WhatIs />
      <Templates />
      <ERPSection />
      <FreeCTA />
      <Plans />
      <SignupSection />
      <RiderSection />
      <Footer />
      <ImageGeneratorModal open={imgGenOpen} onClose={() => setImgGenOpen(false)} />
    </>
  )
}