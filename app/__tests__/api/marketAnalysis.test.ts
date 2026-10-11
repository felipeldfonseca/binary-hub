/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/market/analysis/route'

const mockFinalMessage = jest.fn()
const mockStream = jest.fn((..._args: unknown[]) => ({ finalMessage: mockFinalMessage }))

jest.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status?: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  // The route builds its client at import time, so reach the mock lazily
  const Anthropic = jest.fn(() => ({
    messages: { stream: (...args: unknown[]) => mockStream(...args) },
  }))
  return { __esModule: true, default: Object.assign(Anthropic, { APIError }) }
})

const analysis = {
  conviction_score: 62,
  conviction_label: 'Favorable / Moderate Edge',
  ai_overview: 'Quiet calendar, modest gap up.',
}

const textBlock = (text: string) => ({ type: 'text', text })
const message = (stop_reason: string, content: unknown[]) => ({
  stop_reason,
  content,
  usage: { input_tokens: 10, output_tokens: 20 },
})

const callRoute = () =>
  POST(
    new NextRequest('http://localhost/api/market/analysis', {
      method: 'POST',
      body: JSON.stringify({ asset: 'ES' }),
    })
  )

describe('POST /api/market/analysis', () => {
  beforeEach(() => {
    mockStream.mockClear()
    mockFinalMessage.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns the analysis the model wrote', async () => {
    mockFinalMessage.mockResolvedValue(message('end_turn', [textBlock(JSON.stringify(analysis))]))

    const response = await callRoute()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(analysis)
  })

  it('ignores remarks the model adds around the JSON', async () => {
    mockFinalMessage.mockResolvedValue(
      message('end_turn', [
        textBlock('Checking the overnight session first.'),
        { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} },
        textBlock(`Here is the analysis:\n${JSON.stringify(analysis)}\nLet me know if you need more.`),
      ])
    )

    const response = await callRoute()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(analysis)
  })

  it('resumes a turn the API paused mid-search', async () => {
    const pausedContent = [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} }]
    mockFinalMessage
      .mockResolvedValueOnce(message('pause_turn', pausedContent))
      .mockResolvedValueOnce(message('end_turn', [textBlock(JSON.stringify(analysis))]))

    const response = await callRoute()

    expect(mockStream).toHaveBeenCalledTimes(2)
    const resumed = mockStream.mock.calls[1][0] as { messages: Array<{ role: string; content: unknown }> }
    expect(resumed.messages).toHaveLength(2)
    expect(resumed.messages[1]).toEqual({ role: 'assistant', content: pausedContent })
    expect(await response.json()).toEqual(analysis)
  })

  it('reports a refusal instead of trying to parse it', async () => {
    mockFinalMessage.mockResolvedValue(message('refusal', []))

    const response = await callRoute()

    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe('Analysis declined')
  })

  it('reports an answer that was cut off', async () => {
    mockFinalMessage.mockResolvedValue(message('max_tokens', [textBlock('{"conviction_score": 6')]))

    const response = await callRoute()

    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe('Incomplete analysis')
  })

  it('passes API errors through with their status', async () => {
    const { default: Anthropic } = jest.requireMock('@anthropic-ai/sdk')
    mockFinalMessage.mockRejectedValue(new Anthropic.APIError(404, 'model: not found'))

    const response = await callRoute()

    expect(response.status).toBe(404)
    expect((await response.json()).message).toBe('model: not found')
  })
})
