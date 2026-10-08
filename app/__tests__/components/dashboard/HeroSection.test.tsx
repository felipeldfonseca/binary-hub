import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HeroSection from '@/components/dashboard/HeroSection'

// Mock the hooks
const mockPush = jest.fn()

// Auth user in the shape the Supabase auth context provides
type MockAuthUser = {
  id: string
  email?: string
  user_metadata: { full_name?: string }
}

const defaultUser: MockAuthUser = {
  id: 'test-uid',
  email: 'john.doe@example.com',
  user_metadata: { full_name: 'John Doe' },
}

const mockUseAuth: { user: MockAuthUser } = { user: defaultUser }

const setUser = ({ fullName, email }: { fullName?: string; email?: string }) => {
  mockUseAuth.user = { id: 'test-uid', email, user_metadata: { full_name: fullName } }
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/dashboard',
    query: {},
    asPath: '/dashboard',
  }),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('HeroSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.user = defaultUser
  })

  it('renders with user display name', () => {
    render(<HeroSection />)

    expect(screen.getByText('Hey, John!')).toBeInTheDocument()
    expect(screen.getByText('Have you traded today?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add new trades' })).toBeInTheDocument()
  })

  it('renders with email username when no display name', () => {
    setUser({ email: 'jane.smith@example.com' })

    render(<HeroSection />)

    expect(screen.getByText('Hey, Jane.smith!')).toBeInTheDocument()
  })

  it('renders with first name only when display name has multiple words', () => {
    setUser({ fullName: 'John Michael Doe', email: 'john.doe@example.com' })

    render(<HeroSection />)

    expect(screen.getByText('Hey, John!')).toBeInTheDocument()
  })

  it('renders default name when no user info available', () => {
    setUser({})

    render(<HeroSection />)

    expect(screen.getByText('Hey, Trader!')).toBeInTheDocument()
  })

  it('capitalizes first letter of name', () => {
    setUser({ fullName: 'john', email: 'john.doe@example.com' })

    render(<HeroSection />)

    expect(screen.getByText('Hey, John!')).toBeInTheDocument()
  })

  it('handles lowercase email usernames', () => {
    setUser({ email: 'jane.doe@example.com' })

    render(<HeroSection />)

    expect(screen.getByText('Hey, Jane.doe!')).toBeInTheDocument()
  })

  it('navigates to trades page when button is clicked', async () => {
    const user = userEvent.setup()
    render(<HeroSection />)

    const addTradesButton = screen.getByRole('button', { name: 'Add new trades' })
    await user.click(addTradesButton)

    expect(mockPush).toHaveBeenCalledWith('/trades')
  })

  it('has proper button styling and hover effects', () => {
    render(<HeroSection />)

    const button = screen.getByRole('button', { name: 'Add new trades' })
    expect(button).toHaveClass(
      'btn-primary',
      'font-comfortaa',
      'font-bold',
      'transition-all',
      'duration-300',
      'hover:scale-105'
    )
  })

  it('has responsive design classes', () => {
    render(<HeroSection />)

    const section = screen.getByRole('heading', { level: 1 }).closest('section')
    expect(section).toHaveClass('w-full', 'pt-4', 'sm:pt-6', 'pb-4', 'sm:pb-8')
  })

  it('has proper text hierarchy', () => {
    render(<HeroSection />)

    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toHaveClass('hero-title', 'font-poly')

    const userName = screen.getByText('Hey, John!')
    expect(userName).toHaveClass('text-primary')

    const description = screen.getByText('Have you traded today?')
    expect(description).toHaveClass('text-white')
  })

  it('handles edge case with empty string display name', () => {
    setUser({ fullName: '', email: 'test@example.com' })

    render(<HeroSection />)

    expect(screen.getByText('Hey, Test!')).toBeInTheDocument()
  })

  it('handles edge case with whitespace-only display name', () => {
    setUser({ fullName: '   ', email: 'user@example.com' })

    render(<HeroSection />)

    expect(screen.getByText('Hey, User!')).toBeInTheDocument()
  })
})
