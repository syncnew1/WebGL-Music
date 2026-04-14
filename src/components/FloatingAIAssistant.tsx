import React from 'react'
import { MdSmartToy, MdClose, MdSend, MdAutoAwesome, MdStop } from 'react-icons/md'
import { usePlayer } from '../providers/PlayerProvider'
import { streamGLMChatCompletion, type GLMChatMessage } from '../lib/glmClient'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
}

type ModelMode = 'auto' | 'fast' | 'slow'

const CONTEXT_WINDOW = 8
const FAST_MODEL = import.meta.env.VITE_GLM_FAST_MODEL ?? 'glm-4-flash'
const SLOW_MODEL = import.meta.env.VITE_GLM_SLOW_MODEL ?? import.meta.env.VITE_GLM_MODEL ?? 'glm-4.6v'
const LONG_INPUT_THRESHOLD = 90

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function pickRecentContext(history: ChatMessage[]) {
  return history
    .filter(m => m.content.trim().length > 0)
    .slice(-CONTEXT_WINDOW)
    .map(m => ({ role: m.role, content: m.content }))
}

function shouldUseSlowModel(userContent: string) {
  const text = userContent.trim().toLowerCase()
  if (text.length >= LONG_INPUT_THRESHOLD) return true
  return /(深度|详细|分析|对比|解读|风格|情绪|编曲|歌词|专业|why|compare|analy)/.test(text)
}

function resolveModel(mode: ModelMode, userContent: string) {
  if (mode === 'fast') return FAST_MODEL
  if (mode === 'slow') return SLOW_MODEL
  return shouldUseSlowModel(userContent) ? SLOW_MODEL : FAST_MODEL
}

export default function FloatingAIAssistant() {
  const { current } = usePlayer()
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [activeModel, setActiveModel] = React.useState<string>('')
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: uid(),
      role: 'assistant',
      content: '你好，我是音乐 AI 助手。你可以让我分析当前歌曲风格，或点击“智能推荐”获取相似歌曲。',
    },
  ])

  const listRef = React.useRef<HTMLDivElement | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  const stopGenerating = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
    setActiveModel('')
  }

  const requestLLM = async (history: ChatMessage[], userContent: string, mode: ModelMode = 'auto') => {
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: userContent }
    const assistantId = uid()

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setSending(true)

    const controller = new AbortController()
    abortRef.current = controller

    const model = resolveModel(mode, userContent)
    setActiveModel(model)

    try {
      const promptMessages: GLMChatMessage[] = [
        {
          role: 'system',
          content:
            '你是专业音乐推荐与情感分析助手。回答需简洁、直接、可执行。优先编号列表，避免冗长铺垫。',
        },
        ...pickRecentContext(history),
        { role: 'user', content: userContent },
      ]

      let pending = ''
      let lastFlush = performance.now()
      const flush = () => {
        if (!pending) return
        const chunk = pending
        pending = ''
        setMessages(prev =>
          prev.map(m => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        )
      }

      for await (const chunk of streamGLMChatCompletion({
        model,
        messages: promptMessages,
        temperature: model === FAST_MODEL ? 0.4 : 0.5,
        maxTokens: model === FAST_MODEL ? 320 : 520,
        signal: controller.signal,
      })) {
        pending += chunk
        const now = performance.now()
        if (now - lastFlush > 45) {
          flush()
          lastFlush = now
        }
      }

      flush()
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: err?.message ? `请求失败：${err.message}` : '请求失败，请稍后重试。' }
            : m
        )
      )
    } finally {
      setSending(false)
      abortRef.current = null
      setActiveModel('')
    }
  }

  const sendManual = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    await requestLLM(messages, text, 'auto')
  }

  const smartRecommend = async () => {
    if (sending) return
    const artist = current?.artist?.trim() || '未知歌手'
    const title = current?.title?.trim() || '未知歌曲'

    const prompt = `当前正在播放：${artist} 的《${title}》。请推荐 3 首相似歌曲，并给出每首一句推荐理由；最后补充一个适合聆听场景。`
    await requestLLM(messages, prompt, 'fast')
  }

  return (
    <>
      {!open && (
        <button
          className="fixed right-6 bottom-28 z-[70] rounded-full p-3 shadow-xl border"
          style={{
            background: 'linear-gradient(135deg, rgba(49,194,124,0.95), rgba(78,110,242,0.9))',
            borderColor: 'rgba(255,255,255,0.28)',
            color: '#04150f',
          }}
          onClick={() => setOpen(true)}
          aria-label="打开 AI 助手"
        >
          <MdSmartToy size={24} />
        </button>
      )}

      {open && (
        <div
          className="fixed right-5 bottom-24 z-[70] w-[360px] max-w-[calc(100vw-20px)] rounded-2xl border overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(17,25,42,0.96) 0%, rgba(10,14,24,0.96) 100%)',
            borderColor: 'rgba(120,170,255,0.35)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(120,170,255,0.24)' }}>
            <div className="flex items-center gap-2">
              <MdSmartToy size={18} />
              <div className="text-sm font-semibold">AI 音乐助手</div>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-80 hover:opacity-100">
              <MdClose size={18} />
            </button>
          </div>

          <div className="px-3 pt-2 text-[11px] flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
            <span>上下文记忆窗口：最近 {CONTEXT_WINDOW} 条消息</span>
            {sending && activeModel && <span>模型：{activeModel}</span>}
          </div>

          <div ref={listRef} className="h-72 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map(m => (
              <div
                key={m.id}
                className="max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-5"
                style={
                  m.role === 'assistant'
                    ? {
                        background: 'rgba(120,170,255,0.16)',
                        border: '1px solid rgba(120,170,255,0.28)',
                      }
                    : {
                        marginLeft: 'auto',
                        background: 'rgba(49,194,124,0.18)',
                        border: '1px solid rgba(49,194,124,0.32)',
                      }
                }
              >
                {m.content || (sending && m.role === 'assistant' ? '思考中…' : '')}
              </div>
            ))}
          </div>

          <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: 'rgba(120,170,255,0.24)' }}>
            <div className="mb-2">
              <button
                onClick={smartRecommend}
                disabled={sending}
                className="w-full rounded-lg px-3 py-2 text-sm font-medium flex items-center justify-center gap-1 border"
                style={{
                  borderColor: 'rgba(120,170,255,0.4)',
                  background: 'rgba(120,170,255,0.14)',
                  color: 'var(--text)',
                  opacity: sending ? 0.7 : 1,
                }}
              >
                <MdAutoAwesome />
                智能推荐
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (sending) {
                      stopGenerating()
                    } else {
                      void sendManual()
                    }
                  }
                }}
                placeholder="输入你想问的内容…"
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none border"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: 'rgba(120,170,255,0.28)',
                  color: 'var(--text)',
                }}
              />
              <button
                onClick={() => {
                  if (sending) {
                    stopGenerating()
                  } else {
                    void sendManual()
                  }
                }}
                disabled={!sending && !input.trim()}
                className="rounded-lg p-2 border"
                style={{
                  borderColor: sending ? 'rgba(255,133,133,0.4)' : 'rgba(49,194,124,0.4)',
                  background: sending ? 'rgba(255,115,115,0.12)' : 'rgba(49,194,124,0.18)',
                  opacity: !sending && !input.trim() ? 0.6 : 1,
                }}
                aria-label={sending ? '停止生成' : '发送'}
                title={sending ? '停止生成' : '发送'}
              >
                {sending ? <MdStop size={18} /> : <MdSend size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
