'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiSearch, FiUpload, FiTrash2, FiFile, FiGlobe, FiClock, FiUser, FiPhoneCall, FiArrowUp, FiArrowDown, FiX, FiChevronRight, FiActivity, FiBarChart2, FiBook, FiHome, FiList } from 'react-icons/fi'
import { useRAGKnowledgeBase } from '@/lib/ragKnowledgeBase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// Helper to convert Int16Array to base64 safely (avoids stack overflow with large arrays)
function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ============================
// CONSTANTS
// ============================

const RAG_ID = '699e082bb45a5c2df18fab39'
const VOICE_AGENT_ID = '699e084251690e37c3337a15'

// ============================
// TYPES
// ============================

interface CallEntry {
  id: string
  callerName: string
  phoneNumber: string
  timestamp: string
  duration: string
  intent: string
  summary: string
  status: string
  transcript: { role: string; text: string }[]
  appointmentDetails?: { date: string; time: string; purpose: string }
  orderDetails?: { items: string; quantity: string; notes: string }
  routedTo?: string
}

interface TranscriptEntry {
  role: string
  text: string
}

// ============================
// MOCK DATA
// ============================

const MOCK_CALLS: CallEntry[] = [
  {
    id: '1',
    callerName: 'Sarah Johnson',
    phoneNumber: '+1 (555) 234-5678',
    timestamp: '2026-02-24T09:15:00',
    duration: '3:42',
    intent: 'appointment',
    summary: 'Caller requested to schedule a dental cleaning appointment for next Tuesday afternoon.',
    status: 'completed',
    transcript: [
      { role: 'ai', text: 'Thank you for calling Heritage Dental. How can I help you today?' },
      { role: 'caller', text: 'Hi, I would like to schedule a dental cleaning appointment.' },
      { role: 'ai', text: 'I would be happy to help you schedule that. Do you have a preferred date and time?' },
      { role: 'caller', text: 'Next Tuesday afternoon would work best for me.' },
      { role: 'ai', text: 'I have availability next Tuesday at 2:00 PM and 3:30 PM. Which works better for you?' },
      { role: 'caller', text: 'The 2 PM slot, please.' },
      { role: 'ai', text: 'Your dental cleaning is scheduled for Tuesday at 2:00 PM. Is there anything else I can help with?' },
      { role: 'caller', text: 'No, that is all. Thank you!' },
    ],
    appointmentDetails: { date: 'Next Tuesday', time: '2:00 PM', purpose: 'Dental Cleaning' },
  },
  {
    id: '2',
    callerName: 'Michael Rivera',
    phoneNumber: '+1 (555) 876-1234',
    timestamp: '2026-02-24T10:02:00',
    duration: '1:58',
    intent: 'faq',
    summary: 'Caller inquired about office hours and accepted insurance providers.',
    status: 'completed',
    transcript: [
      { role: 'ai', text: 'Thank you for calling. How can I assist you?' },
      { role: 'caller', text: 'What are your office hours?' },
      { role: 'ai', text: 'We are open Monday through Friday from 8 AM to 6 PM, and Saturday from 9 AM to 1 PM.' },
      { role: 'caller', text: 'Do you accept Blue Cross insurance?' },
      { role: 'ai', text: 'Yes, we accept Blue Cross Blue Shield along with most major insurance providers.' },
      { role: 'caller', text: 'Great, thanks!' },
    ],
  },
  {
    id: '3',
    callerName: 'Emily Chen',
    phoneNumber: '+1 (555) 345-6789',
    timestamp: '2026-02-24T10:30:00',
    duration: '2:15',
    intent: 'order',
    summary: 'Caller placed an order for custom dental trays for teeth whitening.',
    status: 'completed',
    transcript: [
      { role: 'ai', text: 'Good morning! How can I help you today?' },
      { role: 'caller', text: 'I need to order custom whitening trays.' },
      { role: 'ai', text: 'I can help with that. Would you like the standard or premium whitening kit?' },
      { role: 'caller', text: 'The premium kit please, with two sets of trays.' },
      { role: 'ai', text: 'I have placed your order for a premium whitening kit with two sets of trays. You can pick them up within 3-5 business days.' },
    ],
    orderDetails: { items: 'Premium Whitening Kit', quantity: '2 sets', notes: 'Pick up in 3-5 business days' },
  },
  {
    id: '4',
    callerName: 'James Morton',
    phoneNumber: '+1 (555) 567-8901',
    timestamp: '2026-02-24T11:10:00',
    duration: '0:45',
    intent: 'routing',
    summary: 'Caller requested to speak with Dr. Patel regarding a surgical consultation. Transferred to extension 204.',
    status: 'routed',
    transcript: [
      { role: 'ai', text: 'How can I direct your call today?' },
      { role: 'caller', text: 'I need to speak with Dr. Patel about my upcoming surgery.' },
      { role: 'ai', text: 'Let me transfer you to Dr. Patel on extension 204. Please hold.' },
    ],
    routedTo: 'Dr. Patel - Ext. 204',
  },
  {
    id: '5',
    callerName: 'Unknown Caller',
    phoneNumber: '+1 (555) 111-2222',
    timestamp: '2026-02-24T11:45:00',
    duration: '0:00',
    intent: 'general_inquiry',
    summary: 'Missed call. No voicemail left.',
    status: 'missed',
    transcript: [],
  },
  {
    id: '6',
    callerName: 'Linda Tran',
    phoneNumber: '+1 (555) 444-5555',
    timestamp: '2026-02-24T12:20:00',
    duration: '4:12',
    intent: 'appointment',
    summary: 'Caller rescheduled an existing root canal appointment from Thursday to next Monday morning.',
    status: 'completed',
    transcript: [
      { role: 'ai', text: 'Thank you for calling. How may I help you?' },
      { role: 'caller', text: 'Hi, I need to reschedule my appointment this Thursday.' },
      { role: 'ai', text: 'I can help with that. What name is the appointment under?' },
      { role: 'caller', text: 'Linda Tran. It is a root canal appointment at 10 AM.' },
      { role: 'ai', text: 'I found your appointment. When would you like to reschedule to?' },
      { role: 'caller', text: 'Next Monday morning if possible.' },
      { role: 'ai', text: 'I have an opening at 9:30 AM on Monday. Would that work?' },
      { role: 'caller', text: 'That is perfect, thank you.' },
    ],
    appointmentDetails: { date: 'Next Monday', time: '9:30 AM', purpose: 'Root Canal (Rescheduled)' },
  },
  {
    id: '7',
    callerName: 'Robert Park',
    phoneNumber: '+1 (555) 777-8888',
    timestamp: '2026-02-24T13:05:00',
    duration: '1:30',
    intent: 'faq',
    summary: 'Caller asked about parking availability and directions to the clinic.',
    status: 'completed',
    transcript: [
      { role: 'ai', text: 'How can I help you today?' },
      { role: 'caller', text: 'Where is your office located and is there parking?' },
      { role: 'ai', text: 'We are located at 450 Heritage Boulevard, Suite 200. We have a free parking garage on the west side of the building with validated parking for all patients.' },
      { role: 'caller', text: 'Thank you, that is helpful.' },
    ],
  },
  {
    id: '8',
    callerName: 'Angela Davis',
    phoneNumber: '+1 (555) 999-0000',
    timestamp: '2026-02-24T14:00:00',
    duration: '2:50',
    intent: 'general_inquiry',
    summary: 'Caller left a voicemail asking about cosmetic dentistry services and pricing for veneers.',
    status: 'voicemail',
    transcript: [
      { role: 'caller', text: 'Hi, I am calling to ask about cosmetic dentistry options. Specifically, I am interested in getting veneers on my front teeth. Could someone please call me back with pricing information? My number is 555-999-0000. Thank you.' },
    ],
  },
]

// ============================
// HELPER: Intent badge color
// ============================

function getIntentColor(intent: string): string {
  switch (intent) {
    case 'appointment': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'faq': return 'bg-green-100 text-green-800 border-green-200'
    case 'order': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'routing': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'general_inquiry': return 'bg-gray-100 text-gray-800 border-gray-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'missed': return 'bg-red-100 text-red-800 border-red-200'
    case 'routed': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'voicemail': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function formatIntentLabel(intent: string): string {
  return intent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch (_e) {
    return ts
  }
}

function formatDateFull(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch (_e) {
    return ts
  }
}

// ============================
// ERROR BOUNDARY
// ============================

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ============================
// SIDEBAR
// ============================

function Sidebar({ activeScreen, onNavigate }: { activeScreen: string; onNavigate: (screen: string) => void }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FiHome },
    { id: 'call-logs', label: 'Call Logs', icon: FiList },
    { id: 'knowledge-base', label: 'Knowledge Base', icon: FiBook },
  ]

  return (
    <div className="w-60 min-h-screen border-r border-border flex flex-col" style={{ backgroundColor: 'hsl(35, 25%, 90%)' }}>
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <FiPhone className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-wide text-foreground leading-tight">VoiceDesk AI</h1>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-sans">AI Receptionist</p>
          </div>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = activeScreen === item.id
          const IconComp = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-secondary'}`}
            >
              <IconComp className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground font-sans">Voice Agent Online</span>
        </div>
      </div>
    </div>
  )
}

// ============================
// VOICE CALL PANEL
// ============================

function VoiceCallPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [callDuration, setCallDuration] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const nextPlayTimeRef = useRef(0)
  const sampleRateRef = useRef(24000)
  const isMutedRef = useRef(false)
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcript])

  useEffect(() => {
    return () => {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCall = useCallback(async () => {
    setIsConnecting(true)
    setErrorMsg('')
    setTranscript([])
    setCallDuration(0)

    try {
      const res = await fetch('https://voice-sip.studio.lyzr.ai/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: VOICE_AGENT_ID }),
      })
      const data = await res.json()
      sampleRateRef.current = data?.audioConfig?.sampleRate || 24000

      const audioContext = new AudioContext({ sampleRate: sampleRateRef.current })
      audioContextRef.current = audioContext
      nextPlayTimeRef.current = audioContext.currentTime

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: sampleRateRef.current, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      mediaStreamRef.current = stream

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      silentGain.connect(audioContext.destination)
      source.connect(processor)
      processor.connect(silentGain)

      const ws = new WebSocket(data.wsUrl)
      wsRef.current = ws

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !isMutedRef.current) {
          const pcmData = e.inputBuffer.getChannelData(0)
          const int16 = new Int16Array(pcmData.length)
          for (let i = 0; i < pcmData.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, Math.floor(pcmData[i] * 32768)))
          }
          const base64 = int16ToBase64(int16)
          ws.send(JSON.stringify({ type: 'audio', audio: base64, sampleRate: sampleRateRef.current }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'audio' && msg.audio) {
            playAudioChunk(msg.audio)
          } else if (msg.type === 'transcript') {
            setTranscript(prev => [...prev, { role: msg.role || 'assistant', text: msg.text || msg.content || '' }])
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message || 'Voice agent error')
          }
        } catch (_e) {
          // non-JSON message, ignore
        }
      }

      ws.onopen = () => {
        setIsCallActive(true)
        setIsConnecting(false)
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)
      }

      ws.onclose = () => {
        cleanupCall()
      }

      ws.onerror = () => {
        setErrorMsg('Connection error. Please try again.')
        setIsConnecting(false)
      }
    } catch (err) {
      setErrorMsg('Failed to start call. Please check microphone permissions.')
      setIsConnecting(false)
    }
  }, [])

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current) return
    const audioCtx = audioContextRef.current
    try {
      const binaryStr = atob(base64Audio)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      const int16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

      const buffer = audioCtx.createBuffer(1, float32.length, sampleRateRef.current)
      buffer.copyToChannel(float32, 0)

      const sourceNode = audioCtx.createBufferSource()
      sourceNode.buffer = buffer
      sourceNode.connect(audioCtx.destination)

      const now = audioCtx.currentTime
      const startTime = Math.max(now, nextPlayTimeRef.current)
      sourceNode.start(startTime)
      nextPlayTimeRef.current = startTime + buffer.duration
    } catch (_e) {
      // audio decode error, skip chunk
    }
  }, [])

  const cleanupCall = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    wsRef.current?.close()
    processorRef.current?.disconnect()
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    try { audioContextRef.current?.close() } catch (_e) { /* ignore */ }
    wsRef.current = null
    processorRef.current = null
    mediaStreamRef.current = null
    audioContextRef.current = null
    nextPlayTimeRef.current = 0
    setIsCallActive(false)
    setIsConnecting(false)
  }, [])

  const endCall = useCallback(() => {
    cleanupCall()
  }, [cleanupCall])

  const handleClose = useCallback(() => {
    endCall()
    onClose()
  }, [endCall, onClose])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-card shadow-2xl border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif tracking-wide text-lg">Test Voice Call</CardTitle>
              <CardDescription className="font-sans text-sm">Speak with the AI Receptionist</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
              <FiX className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5 space-y-4">
          {/* Status Section */}
          <div className="text-center space-y-3">
            {isCallActive && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-sans font-medium text-foreground">Call Active</span>
                </div>
                <span className="text-2xl font-mono font-semibold text-foreground">{formatDuration(callDuration)}</span>
                {/* Voice waveform indicator */}
                <div className="flex items-center gap-1 h-8">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="w-1 bg-primary rounded-full animate-pulse" style={{ height: `${12 + Math.sin(i * 0.8) * 10}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
            )}
            {isConnecting && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-sm font-sans text-muted-foreground">Connecting...</span>
              </div>
            )}
            {!isCallActive && !isConnecting && (
              <div className="py-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <FiPhone className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground font-sans">Click the button below to start a test call with your AI receptionist.</p>
              </div>
            )}
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-sans">{errorMsg}</div>
          )}

          {/* Transcript */}
          {(Array.isArray(transcript) && transcript.length > 0) && (
            <div className="border border-border rounded-lg">
              <div className="px-3 py-2 border-b border-border">
                <span className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wider">Live Transcript</span>
              </div>
              <ScrollArea className="h-48 px-3 py-2">
                <div className="space-y-2">
                  {transcript.map((entry, i) => (
                    <div key={i} className={`flex gap-2 ${entry.role === 'assistant' || entry.role === 'ai' ? '' : 'flex-row-reverse'}`}>
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${entry.role === 'assistant' || entry.role === 'ai' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                        {entry.role === 'assistant' || entry.role === 'ai' ? 'AI' : 'U'}
                      </div>
                      <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-sm font-sans ${entry.role === 'assistant' || entry.role === 'ai' ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-foreground'}`}>
                        {entry.text}
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 pt-2">
            {isCallActive ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`rounded-full w-12 h-12 p-0 ${isMuted ? 'bg-amber-100 border-amber-300 text-amber-700' : ''}`}
                >
                  {isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                </Button>
                <Button
                  variant="destructive"
                  onClick={endCall}
                  className="rounded-full w-14 h-14 p-0"
                >
                  <FiPhoneOff className="w-6 h-6" />
                </Button>
              </>
            ) : (
              <Button
                onClick={startCall}
                disabled={isConnecting}
                className="rounded-full px-8 py-3 text-sm font-sans font-medium"
              >
                {isConnecting ? 'Connecting...' : 'Start Call'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================
// DASHBOARD SCREEN
// ============================

function DashboardScreen({ showSample, onTestCall }: { showSample: boolean; onTestCall: () => void }) {
  const calls = showSample ? MOCK_CALLS : []
  const totalCalls = calls.length
  const missedCalls = calls.filter(c => c.status === 'missed' || c.status === 'routed').length
  const topIntent = showSample ? 'Appointment' : '--'

  const avgDurationSeconds = showSample ? (() => {
    const durations = calls.filter(c => c.duration !== '0:00').map(c => {
      const parts = c.duration.split(':')
      return parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0')
    })
    if (durations.length === 0) return 0
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  })() : 0

  const avgMinutes = Math.floor(avgDurationSeconds / 60)
  const avgSecs = avgDurationSeconds % 60

  const [timeFilter, setTimeFilter] = useState('today')

  const stats = [
    { label: 'Total Calls', value: showSample ? totalCalls.toString() : '0', icon: FiPhoneCall, trend: showSample ? '+12%' : '', trendUp: true },
    { label: 'Avg Duration', value: showSample ? `${avgMinutes}:${avgSecs.toString().padStart(2, '0')}` : '--:--', icon: FiClock, trend: showSample ? '-8%' : '', trendUp: false },
    { label: 'Top Intent', value: topIntent, icon: FiActivity, trend: showSample ? '38%' : '', trendUp: true },
    { label: 'Missed/Routed', value: showSample ? missedCalls.toString() : '0', icon: FiPhoneOff, trend: showSample ? '-5%' : '', trendUp: false },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-wide text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground font-sans mt-0.5">Overview of your AI receptionist performance</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          {['today', 'week', 'month'].map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${timeFilter === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const StatIcon = stat.icon
          return (
          <Card key={idx} className="bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StatIcon className="w-5 h-5 text-primary" />
                </div>
                {stat.trend && (
                  <div className={`flex items-center gap-0.5 text-xs font-sans font-medium ${stat.trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {stat.trendUp ? <FiArrowUp className="w-3 h-3" /> : <FiArrowDown className="w-3 h-3" />}
                    {stat.trend}
                  </div>
                )}
              </div>
              <p className="text-2xl font-serif font-semibold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
          )
        })}
      </div>

      {/* Two Column: Recent Calls + Test Call */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Calls */}
        <Card className="lg:col-span-2 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-base tracking-wide">Recent Calls</CardTitle>
              <Badge variant="secondary" className="font-sans text-xs">{showSample ? `${calls.length} calls` : 'No data'}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {showSample ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-sans text-xs pl-5">Caller</TableHead>
                    <TableHead className="font-sans text-xs">Time</TableHead>
                    <TableHead className="font-sans text-xs">Duration</TableHead>
                    <TableHead className="font-sans text-xs">Intent</TableHead>
                    <TableHead className="font-sans text-xs pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.slice(0, 6).map(call => (
                    <TableRow key={call.id} className="hover:bg-secondary/50 transition-colors">
                      <TableCell className="font-sans text-sm pl-5">
                        <div>
                          <span className="font-medium text-foreground">{call.callerName}</span>
                          <p className="text-xs text-muted-foreground">{call.phoneNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-sans text-sm text-muted-foreground">{formatTimestamp(call.timestamp)}</TableCell>
                      <TableCell className="font-sans text-sm text-muted-foreground">{call.duration}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-sans font-medium border ${getIntentColor(call.intent)}`}>
                          {formatIntentLabel(call.intent)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-sans font-medium border ${getStatusColor(call.status)}`}>
                          {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-10 text-center">
                <FiBarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-sans">No call data yet. Enable Sample Data to see demo calls.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Call Card */}
        <Card className="bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base tracking-wide">Test Call</CardTitle>
            <CardDescription className="font-sans text-sm">Try the AI receptionist live</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center space-y-4 pt-2">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <FiPhone className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-sans leading-relaxed">Start a voice conversation with your AI receptionist to test responses, tone, and knowledge.</p>
            <Button onClick={onTestCall} className="w-full font-sans font-medium">
              <FiPhoneCall className="w-4 h-4 mr-2" />
              Start Test Call
            </Button>
          </CardContent>

          {/* Agent Info */}
          <Separator className="mx-5" />
          <CardContent className="pt-3 pb-4">
            <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground mb-2">Agent Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-sans text-foreground font-medium">Voice Receptionist Agent</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-sans mt-1 pl-4">ID: {VOICE_AGENT_ID.slice(0, 12)}...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================
// CALL LOGS SCREEN
// ============================

function CallLogsScreen({ showSample }: { showSample: boolean }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [intentFilter, setIntentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCall, setSelectedCall] = useState<CallEntry | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const calls = showSample ? MOCK_CALLS : []

  const filteredCalls = calls.filter(call => {
    const matchesSearch = searchQuery === '' ||
      call.callerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.phoneNumber.includes(searchQuery) ||
      call.summary.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesIntent = intentFilter === 'all' || call.intent === intentFilter
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter
    return matchesSearch && matchesIntent && matchesStatus
  })

  const handleRowClick = useCallback((call: CallEntry) => {
    setSelectedCall(call)
    setSheetOpen(true)
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-wide text-foreground">Call Logs</h2>
        <p className="text-sm text-muted-foreground font-sans mt-0.5">Browse and search your complete call history</p>
      </div>

      {/* Filter Bar */}
      <Card className="bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 font-sans text-sm bg-background"
              />
            </div>
            <Select value={intentFilter} onValueChange={setIntentFilter}>
              <SelectTrigger className="w-[160px] font-sans text-sm bg-background">
                <SelectValue placeholder="Intent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Intents</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="routing">Routing</SelectItem>
                <SelectItem value="general_inquiry">General Inquiry</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] font-sans text-sm bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="routed">Routed</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || intentFilter !== 'all' || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchQuery(''); setIntentFilter('all'); setStatusFilter('all') }}
                className="text-xs font-sans"
              >
                <FiX className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Call Table */}
      <Card className="bg-card shadow-sm">
        <CardContent className="p-0">
          {showSample && filteredCalls.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-sans text-xs pl-5">Caller</TableHead>
                  <TableHead className="font-sans text-xs">Phone Number</TableHead>
                  <TableHead className="font-sans text-xs">Date/Time</TableHead>
                  <TableHead className="font-sans text-xs">Duration</TableHead>
                  <TableHead className="font-sans text-xs">Intent</TableHead>
                  <TableHead className="font-sans text-xs">Summary</TableHead>
                  <TableHead className="font-sans text-xs pr-5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map(call => (
                  <TableRow
                    key={call.id}
                    className="hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(call)}
                  >
                    <TableCell className="font-sans text-sm font-medium pl-5">{call.callerName}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{call.phoneNumber}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground whitespace-nowrap">{formatTimestamp(call.timestamp)}</TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground">{call.duration}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-sans font-medium border ${getIntentColor(call.intent)}`}>
                        {formatIntentLabel(call.intent)}
                      </span>
                    </TableCell>
                    <TableCell className="font-sans text-sm text-muted-foreground max-w-[200px] truncate">{call.summary}</TableCell>
                    <TableCell className="pr-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-sans font-medium border ${getStatusColor(call.status)}`}>
                        {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : showSample && filteredCalls.length === 0 ? (
            <div className="p-10 text-center">
              <FiSearch className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-sans">No calls match your filters. Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="p-10 text-center">
              <FiList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-sans">No call logs available. Enable Sample Data to see demo entries.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Count indicator */}
      {showSample && (
        <p className="text-xs text-muted-foreground font-sans">Showing {filteredCalls.length} of {calls.length} calls</p>
      )}

      {/* Slide-out Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg bg-card overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle className="font-serif tracking-wide">Call Details</SheetTitle>
            <SheetDescription className="font-sans text-sm">
              {selectedCall ? `${selectedCall.callerName} - ${formatDateFull(selectedCall.timestamp)}` : ''}
            </SheetDescription>
          </SheetHeader>

          {selectedCall && (
            <div className="space-y-5 mt-4">
              {/* Summary Card */}
              <Card className="bg-secondary/50 border-border shadow-none">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiUser className="w-4 h-4 text-muted-foreground" />
                      <span className="font-sans text-sm font-medium">{selectedCall.callerName}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-sans font-medium border ${getStatusColor(selectedCall.status)}`}>
                      {selectedCall.status.charAt(0).toUpperCase() + selectedCall.status.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-sans">
                    <div>
                      <span className="text-muted-foreground">Phone</span>
                      <p className="font-medium text-foreground">{selectedCall.phoneNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration</span>
                      <p className="font-medium text-foreground">{selectedCall.duration}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-sans">Summary</span>
                    <p className="text-sm font-sans text-foreground mt-0.5 leading-relaxed">{selectedCall.summary}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Intent */}
              <div>
                <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-2">Intent Classification</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-sans font-medium border ${getIntentColor(selectedCall.intent)}`}>
                  <FiActivity className="w-3 h-3 mr-1.5" />
                  {formatIntentLabel(selectedCall.intent)}
                </span>
              </div>

              {/* Extracted Details */}
              {selectedCall.appointmentDetails && (
                <div>
                  <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-2">Appointment Details</p>
                  <Card className="bg-blue-50/50 border-blue-200 shadow-none">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex justify-between text-xs font-sans">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium text-foreground">{selectedCall.appointmentDetails.date}</span>
                      </div>
                      <div className="flex justify-between text-xs font-sans">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium text-foreground">{selectedCall.appointmentDetails.time}</span>
                      </div>
                      <div className="flex justify-between text-xs font-sans">
                        <span className="text-muted-foreground">Purpose</span>
                        <span className="font-medium text-foreground">{selectedCall.appointmentDetails.purpose}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedCall.orderDetails && (
                <div>
                  <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-2">Order Details</p>
                  <Card className="bg-purple-50/50 border-purple-200 shadow-none">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex justify-between text-xs font-sans">
                        <span className="text-muted-foreground">Items</span>
                        <span className="font-medium text-foreground">{selectedCall.orderDetails.items}</span>
                      </div>
                      <div className="flex justify-between text-xs font-sans">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="font-medium text-foreground">{selectedCall.orderDetails.quantity}</span>
                      </div>
                      <div className="flex justify-between text-xs font-sans">
                        <span className="text-muted-foreground">Notes</span>
                        <span className="font-medium text-foreground">{selectedCall.orderDetails.notes}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedCall.routedTo && (
                <div>
                  <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-2">Routed To</p>
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-50/50 border border-orange-200 rounded-lg">
                    <FiChevronRight className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-sans font-medium text-foreground">{selectedCall.routedTo}</span>
                  </div>
                </div>
              )}

              {/* Transcript */}
              <div>
                <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-2">Full Transcript</p>
                {Array.isArray(selectedCall.transcript) && selectedCall.transcript.length > 0 ? (
                  <div className="space-y-2 bg-background rounded-lg p-3 border border-border">
                    {selectedCall.transcript.map((entry, i) => (
                      <div key={i} className="flex gap-2.5">
                        <div className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${entry.role === 'ai' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                          {entry.role === 'ai' ? 'AI' : 'C'}
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                            {entry.role === 'ai' ? 'AI Receptionist' : 'Caller'}
                          </span>
                          <p className="text-sm font-sans text-foreground leading-relaxed">{entry.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-sans italic">No transcript available for this call.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ============================
// KNOWLEDGE BASE SCREEN
// ============================

function KnowledgeBaseScreen() {
  const { documents, loading, error, fetchDocuments, uploadDocument, removeDocuments, crawlSite } = useRAGKnowledgeBase()
  const [crawlUrl, setCrawlUrl] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [crawlStatus, setCrawlStatus] = useState('')
  const [deleteStatus, setDeleteStatus] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetchDocuments(RAG_ID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadStatus('Uploading...')
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file) {
        const result = await uploadDocument(RAG_ID, file)
        if (!result.success) {
          setUploadStatus(`Error: ${result.error || 'Upload failed'}`)
          return
        }
      }
    }
    setUploadStatus('Upload complete! Document is being processed.')
    setTimeout(() => setUploadStatus(''), 4000)
  }, [uploadDocument])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleCrawl = useCallback(async () => {
    if (!crawlUrl.trim()) return
    setCrawlStatus('Crawling...')
    const result = await crawlSite(RAG_ID, crawlUrl.trim())
    if (result.success) {
      setCrawlStatus('Website crawled successfully!')
      setCrawlUrl('')
      await fetchDocuments(RAG_ID)
    } else {
      setCrawlStatus(`Error: ${result.error || 'Crawl failed'}`)
    }
    setTimeout(() => setCrawlStatus(''), 4000)
  }, [crawlUrl, crawlSite, fetchDocuments])

  const handleDelete = useCallback(async (fileName: string) => {
    setDeleteStatus(`Deleting ${fileName}...`)
    const result = await removeDocuments(RAG_ID, [fileName])
    if (result.success) {
      setDeleteStatus('Document deleted.')
    } else {
      setDeleteStatus(`Error: ${result.error || 'Delete failed'}`)
    }
    setTimeout(() => setDeleteStatus(''), 3000)
  }, [removeDocuments])

  const getFileIcon = (_fileType: string) => {
    return <FiFile className="w-4 h-4" />
  }

  const docList = Array.isArray(documents) ? documents : []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-wide text-foreground">Knowledge Base</h2>
        <p className="text-sm text-muted-foreground font-sans mt-0.5">Manage documents that power your AI receptionist</p>
      </div>

      {/* Upload Zone */}
      <Card className="bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base tracking-wide">Upload Documents</CardTitle>
          <CardDescription className="font-sans text-sm">Supported formats: PDF, DOCX, TXT</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/30'}`}
          >
            <FiUpload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-sans font-medium text-foreground">
              {isDragging ? 'Drop files here' : 'Drag and drop files here, or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground font-sans mt-1">PDF, DOCX, TXT up to 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>

          {uploadStatus && (
            <div className={`text-sm font-sans p-3 rounded-lg ${uploadStatus.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {uploadStatus}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Website Crawl */}
      <Card className="bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base tracking-wide">Crawl Website</CardTitle>
          <CardDescription className="font-sans text-sm">Add content from a web page to your knowledge base</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="https://example.com"
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
                className="pl-9 font-sans text-sm bg-background"
              />
            </div>
            <Button onClick={handleCrawl} disabled={loading || !crawlUrl.trim()} className="font-sans text-sm">
              {loading ? 'Crawling...' : 'Crawl'}
            </Button>
          </div>
          {crawlStatus && (
            <div className={`text-sm font-sans p-3 rounded-lg ${crawlStatus.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {crawlStatus}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-sans">{error}</div>
      )}

      {/* Delete status */}
      {deleteStatus && (
        <div className={`text-sm font-sans p-3 rounded-lg ${deleteStatus.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {deleteStatus}
        </div>
      )}

      {/* Documents List */}
      <Card className="bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-base tracking-wide">Documents</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => fetchDocuments(RAG_ID)} disabled={loading} className="text-xs font-sans">
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && docList.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : docList.length > 0 ? (
            <div className="space-y-2">
              {docList.map((doc, i) => (
                <div
                  key={doc?.id || i}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(doc?.fileType || '')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-sans font-medium text-foreground truncate">{doc?.fileName || 'Unknown'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-sans text-muted-foreground uppercase">{doc?.fileType || 'file'}</span>
                        {doc?.uploadedAt && (
                          <>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-[10px] font-sans text-muted-foreground">{doc.uploadedAt}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {doc?.status && (
                      <Badge variant={doc.status === 'active' ? 'default' : doc.status === 'processing' ? 'secondary' : 'destructive'} className="text-[10px] font-sans">
                        {doc.status}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { if (doc?.fileName) handleDelete(doc.fileName) }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <FiBook className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-sans font-medium text-foreground mb-1">No documents yet</p>
              <p className="text-xs text-muted-foreground font-sans">Upload documents or crawl a website to build your knowledge base. This helps the AI receptionist answer questions accurately.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================
// MAIN PAGE
// ============================

export default function Page() {
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [showSample, setShowSample] = useState(false)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Sidebar */}
        <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          {/* Top Bar */}
          <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-sm font-semibold tracking-wide text-foreground capitalize">
                {activeScreen === 'dashboard' ? 'Dashboard' : activeScreen === 'call-logs' ? 'Call Logs' : 'Knowledge Base'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="sample-toggle" className="text-xs font-sans text-muted-foreground cursor-pointer">Sample Data</Label>
              <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
            </div>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-6 max-w-[1200px]">
              {activeScreen === 'dashboard' && (
                <DashboardScreen showSample={showSample} onTestCall={() => setVoiceCallOpen(true)} />
              )}
              {activeScreen === 'call-logs' && (
                <CallLogsScreen showSample={showSample} />
              )}
              {activeScreen === 'knowledge-base' && (
                <KnowledgeBaseScreen />
              )}
            </div>
          </ScrollArea>

          {/* Bottom Agent Status Bar */}
          <div className="border-t border-border bg-card px-6 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-sans text-muted-foreground">Voice Receptionist Agent</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-[10px] font-sans text-muted-foreground">ID: {VOICE_AGENT_ID}</span>
            </div>
            <span className="text-[10px] font-sans text-muted-foreground">Knowledge Base: {RAG_ID.slice(0, 12)}...</span>
          </div>
        </div>

        {/* Voice Call Panel */}
        <VoiceCallPanel isOpen={voiceCallOpen} onClose={() => setVoiceCallOpen(false)} />
      </div>
    </PageErrorBoundary>
  )
}
