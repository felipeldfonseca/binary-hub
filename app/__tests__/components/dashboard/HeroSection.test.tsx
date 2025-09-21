import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HeroSection from '@/components/dashboard/HeroSection'

// Mock the hooks
const mockPush = jest.fn()
const mockUseAuth = {
  user: {
    displayName: 'John Doe',
    email: 'john.doe@example.com',
    uid: 'test-uid',
  },
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

describe('HeroSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with user display name', () => {
    render(<HeroSection />)
    
    expect(screen.getByText('Hey, John!')).toBeInTheDocument()
    expect(screen.getByText('Have you traded today?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add new trades' })).toBeInTheDocument()
  })

  it('renders with email username when no display name', () => {
    mockUseAuth.user = {
      ...mockUseAuth.user,
      displayName: null,
      email: 'jane.smith@example.com',
    }

    render(<HeroSection />)
    
    expect(screen.getByText('Hey, Jane.smith!')).toBeInTheDocument()
  })

  it('renders with first name only when display name has multiple words', () => {
    mockUseAuth.user = {
      ...mockUseAuth.user,
      displayName: 'John Michael Doe',
    }

    render(<HeroSection />)
    
    expect(screen.getByText('Hey, John!')).toBeInTheDocument()
  })

  it('renders default name when no user info available', () => {
    mockUseAuth.user = {
      ...mockUseAuth.user,
      displayName: null,
      email: null,
    }

    render(<HeroSection />)
    
    expect(screen.getByText('Hey, Trader!')).toBeInTheDocument()
  })

  it('capitalizes first letter of name', () => {
    mockUseAuth.user = {
      ...mockUseAuth.user,
      displayName: 'john',
    }

    render(<HeroSection />)
    
    expect(screen.getByText('Hey, John!')).toBeInTheDocument()
  })

  it('handles lowercase email usernames', () => {
    mockUseAuth.user = {
      ...mockUseAuth.user,
      displayName: null,
      email: 'jane.doe@example.com',
    }

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
    
    const section = screen.getByRole('region', { hidden: true }) || screen.getByText('Hey, John!').closest('section')
    expect(section).toHaveClass('min-h-[40vh]', 'pt-24', 'sm:pt-28', 'lg:pt-32')
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
    mockUseAuth.user = {
      ...mockUseAuth.user,
      displayName: '',
      email: 'test@example.com',
    }

    render(<HeroSection />)
    
    expect(screen.getByText('Hey, Test!')).toBeInTheDocument()
  })

  it('handles edge case with whitespace-only display name', () => {
    mockUseAuth.user = {
      ...mockUseAuth.user,
      displayName: '   ',
      email: 'user@example.com',
    }

    render(<HeroSection />)
    
    expect(screen.getByText('Hey, User!')).toBeInTheDocument()
  })
})