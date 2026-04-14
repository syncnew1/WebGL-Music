export type GLMRole = 'system' | 'user' | 'assistant'

export type GLMChatMessage = {
  role: GLMRole
  content: string
}

type StreamGLMParams = {
  messages: GLMChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  apiKey?: string
  baseUrl?: string
  signal?: AbortSignal
}

function readContentDelta(payload: any): string {
  const delta = payload?.choices?.[0]?.delta?.content
  if (typeof delta === 'string') return delta

  if (Array.isArray(delta)) {
    return delta
      .map((item: any) => (typeof item === 'string' ? item : item?.text ?? ''))
      .join('')
  }

  return ''
}

export async function* streamGLMChatCompletion(params: StreamGLMParams): AsyncGenerator<string> {
  const apiKey = params.apiKey ?? import.meta.env.VITE_GLM_API_KEY
  const baseUrl = (params.baseUrl ?? import.meta.env.VITE_GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '')

  if (!apiKey) {
    throw new Error('缺少 GLM API Key，请在环境变量中配置 VITE_GLM_API_KEY')
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: params.model ?? 'glm-4.6v',
      stream: true,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 700,
      messages: params.messages,
    }),
    signal: params.signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GLM 请求失败（${res.status}）：${text}`)
  }

  if (!res.body) {
    throw new Error('GLM 返回为空流')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || !line.startsWith('data:')) continue

      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue

      try {
        const json = JSON.parse(data)
        const text = readContentDelta(json)
        if (text) yield text
      } catch {
        // 忽略非 JSON 的数据片段
      }
    }
  }
}
