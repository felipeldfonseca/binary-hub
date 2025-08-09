import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthForm from '@/components/auth/AuthForm'

// Mock the hooks and contexts
const mockUseAuth = {
  register: jest.fn(),
  login: jest.fn(),
  error: null,
  loading: false,
  clearError: jest.fn(),
}

let mockUseLanguage = {
  isPortuguese: false,
}

const mockUseSessionStorage = jest.fn(() => [null, jest.fn(), jest.fn(), true])

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
}))

jest.mock('@/lib/contexts/LanguageContext', () => ({
  useLanguage: () => mockUseLanguage,
}))

jest.mock('@/lib/hooks/useSessionStorage', () => ({
  useSessionStorage: () => mockUseSessionStorage(),
}))

describe('AuthForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    mode: 'signin' as const,
    onModeChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.register.mockResolvedValue({ success: true })
    mockUseAuth.login.mockResolvedValue({ success: true })
    mockUseAuth.error = null
    mockUseAuth.loading = false
    mockUseLanguage.isPortuguese = false
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AuthForm {...defaultProps} isOpen={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders signin form by default', () => {
    render(<AuthForm {...defaultProps} />)
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    expect(screen.getByText('Email Address')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
  })

  it('renders signup form when mode is signup', () => {
    render(<AuthForm {...defaultProps} mode="signup" />)
    
    expect(screen.getByText('Create Account')).toBeInTheDocument()
    expect(screen.getByText('Full Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your full name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument()
  })

  it('validates required fields on signin', async () => {
    const user = userEvent.setup()
    render(<AuthForm {...defaultProps} />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
    
    expect(mockUseAuth.login).not.toHaveBeenCalled()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<AuthForm {...defaultProps} />)
    
    const emailInput = screen.getByPlaceholderText('Enter your email')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'invalid-email')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument()
    })
  })

  it('submits valid signin form', async () => {
    const user = userEvent.setup()
    render(<AuthForm {...defaultProps} />)
    
    const emailInput = screen.getByPlaceholderText('Enter your email')
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockUseAuth.login).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('closes form after successful login', async () => {
    const user = userEvent.setup()
    const onCloseMock = jest.fn()
    render(<AuthForm {...defaultProps} onClose={onCloseMock} />)
    
    const emailInput = screen.getByPlaceholderText('Enter your email')
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled()
    })
  })

  it('shows loading state during authentication', () => {
    mockUseAuth.loading = true
    render(<AuthForm {...defaultProps} />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    expect(submitButton).toBeDisabled()
    expect(submitButton.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('switches between signin and signup modes', async () => {
    const user = userEvent.setup()
    const onModeChangeMock = jest.fn()
    render(<AuthForm {...defaultProps} onModeChange={onModeChangeMock} />)
    
    const switchButton = screen.getByRole('button', { name: /sign up/i })
    await user.click(switchButton)
    
    expect(onModeChangeMock).toHaveBeenCalledWith('signup')
  })
})