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
const GENERATION_LIMIT = 3
const COOLDOWN_HOURS = 10

// MiniMax API Configuration
const MINIMAX_API_KEY = import.meta.env.VITE_MINIMAX_API_KEY || ''
const MINIMAX_API_BASE = 'https://api.minimax.io/v1'

// IP-based rate limiting for MiniMax - 3 generations every 10 hours
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip || 'unknown-ip'
  } catch {
    return 'unknown-ip'
  }
}

function getGenerationStorageKey(ip) {
  return `minimax_gen_${ip}`
}

function getGenerationData(ip) {
  const key = getGenerationStorageKey(ip)
  const stored = localStorage.getItem(key)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function checkRateLimit(ip) {
  const data = getGenerationData(ip)
  const now = Date.now()
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000

  if (!data) {
    return { allowed: true, remaining: GENERATION_LIMIT, resetTime: null }
  }

  if (data.firstGeneration) {
    const elapsed = now - data.firstGeneration
    if (elapsed >= cooldownMs) {
      return { allowed: true, remaining: GENERATION_LIMIT, resetTime: null }
    }
    const remainingTime = cooldownMs - elapsed
    const hours = Math.floor(remainingTime / (60 * 60 * 1000))
    const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000))
    return {
      allowed: false,
      remaining: 0,
      cooldownMs: remainingTime,
      resetTime: `${hours}h ${minutes}m`
    }
  }

  if (data.count >= GENERATION_LIMIT) {
    return { allowed: false, remaining: 0, resetTime: '10 horas' }
  }

  return { allowed: true, remaining: GENERATION_LIMIT - data.count, resetTime: null }
}

function recordGeneration(ip) {
  const key = getGenerationStorageKey(ip)
  const now = Date.now()
  let data = getGenerationData(ip)

  if (!data) {
    data = { count: 0, firstGeneration: now }
  }

  data.count += 1
  data.lastGeneration = now

  if (!getGenerationData(ip)?.firstGeneration) {
    data.firstGeneration = now
  }

  localStorage.setItem(key, JSON.stringify(data))
  return data
}

// Generate image using MiniMax API
async function generateWithMinimax(prompt, size = '1:1', style = 'Natural') {
  const styleMap = {
    'Natural': 'realistic photography, natural lighting, high quality',
    'Vibrant': 'vibrant colors, vivid saturation, high contrast, high quality',
    'Anime': 'anime style, illustrated, detailed anime artwork, high quality',
    'Photography': 'professional photography, DSLR, sharp focus, studio lighting, high quality'
  }

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
      n: 1,
      aspect_ratio: size,
      response_format: 'url',
      prompt_optimizer: true
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const baseResp = errorData?.base_resp
    const errorMsg = baseResp?.status_msg || errorData?.message || `Error de MiniMax (${response.status})`
    throw new Error(errorMsg)
  }
  
  const data = await response.json()
  const baseResp = data.base_resp
  
  if (baseResp?.status_code !== undefined && baseResp.status_code !== 0) {
    throw new Error(`MiniMax error: ${baseResp.status_msg || 'Error desconocido'}`)
  }
  
  const urls = data.data?.image_urls || []
  if (urls.length === 0) {
    throw new Error('No se recibió imagen de MiniMax')
  }
  
  return { url: urls[0], base64: null }
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
      { out: true, text: 'Sí, envíele el recordatorio' },
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
      { out: false, text: '✅ Servicio agregado:\n\n💇 *Keratina*\nPrecio: $45.000\n\n¿Quieres que lo publique en tu sitio web?' },
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

// User gallery images - sample generated images from users
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