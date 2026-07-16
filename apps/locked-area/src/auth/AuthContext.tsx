import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Member {
  id: string
  name: string
  email: string
  isVerified: boolean
  isApproved: boolean
  user: 'USER' | 'ADMIN'
}

interface AuthContextValue {
  user: Member | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; verificationUrl?: string }>
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

// â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const AuthContext = createContext<AuthContextValue | null>(null)

const HYGRAPH_ENDPOINT = import.meta.env.VITE_HYGRAPH_URL
const HYGRAPH_TOKEN = import.meta.env.VITE_HYGRAPH_TOKEN_LOCKED

// â”€â”€ Provider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Member | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // â”€â”€ ONE-TIME CLEANUP: Remove old vulnerable fcr_user key â”€â”€
  useEffect(() => {
    const oldUser = localStorage.getItem('fcr_user')
    if (oldUser) {
      localStorage.removeItem('fcr_user')
      console.log('Cleared old vulnerable fcr_user data')
    }
  }, [])

  // â”€â”€ Secure: Validate credentials against Hygraph on every load â”€â”€
  const validateSession = useCallback(async () => {
    const sessionEmail = localStorage.getItem('fcr_session_email')
    const sessionHash = localStorage.getItem('fcr_session_hash')

    if (!sessionEmail || !sessionHash) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch(HYGRAPH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HYGRAPH_TOKEN}`,
        },
        body: JSON.stringify({
          query: `
            query GetMemberByEmail($email: String!) {
              members(where: { email: $email }) {
                id
                name
                email
                password
                isVerified
                isApproved
                user
              }
            }
          `,
          variables: { email: sessionEmail },
        }),
      })

      const { data } = await res.json()
      const members = data?.members

      if (!members || members.length === 0) {
        localStorage.removeItem('fcr_session_email')
        localStorage.removeItem('fcr_session_hash')
        setUser(null)
        setIsLoading(false)
        return
      }

      const found = members[0]

      if (found.password !== sessionHash) {
        localStorage.removeItem('fcr_session_email')
        localStorage.removeItem('fcr_session_hash')
        setUser(null)
        setIsLoading(false)
        return
      }

      if (!found.isVerified) {
        localStorage.removeItem('fcr_session_email')
        localStorage.removeItem('fcr_session_hash')
        setUser(null)
        setIsLoading(false)
        return
      }

      const memberData: Member = {
        id: found.id,
        name: found.name,
        email: found.email,
        isVerified: found.isVerified,
        isApproved: found.isApproved,
        user: found.user,
      }

      setUser(memberData)
    } catch (err) {
      console.error('Session validation error:', err)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    validateSession()
  }, [validateSession])

  useEffect(() => {
    const handleFocus = () => validateSession()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [validateSession])

  const hygraphFetch = async (query: string, variables?: Record<string, unknown>) => {
    const res = await fetch(HYGRAPH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HYGRAPH_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
    })
    return res.json()
  }

  const hashPassword = (password: string): string => {
    let hash = 0
    const str = password + 'fcr-salt-2026'
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & 0xFFFFFFFF
    }
    const hex = (hash >>> 0).toString(16).padStart(16, '0')
    return hex.repeat(4)
  }

  const generateToken = (): string => {
    const array = new Uint8Array(32)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array)
    } else {
      for (let i = 0; i < 32; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  // â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const login = async (email: string, password: string) => {
    try {
      const hashedPassword = hashPassword(password)

      const { data, errors } = await hygraphFetch(
        `query GetMemberByEmail($email: String!) {
          members(where: { email: $email }) {
            id
            name
            email
            password
            isVerified
            isApproved
            user 
          }
        }`,
        { email }
      )

      if (errors) {
        console.error('GraphQL errors:', JSON.stringify(errors, null, 2))
        return { success: false, error: errors[0]?.message || 'Databasfel. FörsÃ¶k igen.' }
      }

      const members = data?.members
      if (!members || members.length === 0) {
        return { success: false, error: 'Felaktig e-post eller lösenord' }
      }

      const found = members[0]

      if (found.password !== hashedPassword) {
        return { success: false, error: 'Felaktig e-post eller lösenord' }
      }

      if (!found.isVerified) {
        return { success: false, error: 'Ditt konto Ã¤r inte verifierat. Kontrollera din e-post och klicka pÃ¥ verifieringslÃ¤nken.' }
      }

      if (!found.isApproved) {
        return { success: false, error: 'Ditt konto väntar pÃ¥ godkännande frÃ¥n administratÃ¶ren.' }
      }

      const memberData: Member = {
        id: found.id,
        name: found.name,
        email: found.email,
        isVerified: found.isVerified,
        isApproved: found.isApproved,
        user: found.user,
      }

      localStorage.setItem('fcr_session_email', memberData.email)
      localStorage.setItem('fcr_session_hash', found.password)

      setUser(memberData)
      return { success: true }
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, error: 'Ett fel uppstod. FörsÃ¶k igen.' }
    }
  }

  // â”€â”€ Register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const register = async (name: string, email: string, password: string) => {
    try {
      const { data: existing } = await hygraphFetch(
        `query CheckEmail($email: String!) {
          members(where: { email: $email }) { id }
        }`,
        { email }
      )

      if (existing?.members?.length > 0) {
        return { success: false, error: 'E-postadressen Ã¤r redan registrerad' }
      }

      const hashedPassword = hashPassword(password)
      const verificationToken = generateToken()

      const { data, errors } = await hygraphFetch(
        `mutation CreateMember($name: String!, $email: String!, $password: String!, $verificationToken: String!) {
          createMember(data: {
            name: $name
            email: $email
            password: $password
            verificationToken: $verificationToken
            isVerified: false
            isApproved: false
            user: ADMIN
          }) {
            id
            email
          }
        }`,
        { name, email, password: hashedPassword, verificationToken }
      )

      if (errors) {
        console.error('GraphQL errors:', JSON.stringify(errors, null, 2))
        return { success: false, error: 'Kunde inte skapa konto. FörsÃ¶k igen.' }
      }

      if (!data?.createMember) {
        return { success: false, error: 'Kunde inte skapa konto. FörsÃ¶k igen.' }
      }

      const memberId = data.createMember.id
      const verificationUrl = `${window.location.origin}/verify-email?token=${verificationToken}`

      // â”€â”€ Send verification email via Pages Function â”€â”€
      try {
        console.log('ðŸ“§ Sending verification email to:', email)

        const res = await fetch('/send-verification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            name: name,
            verificationUrl: verificationUrl,
          }),
        })

        if (!res.ok) {
          const errorText = await res.text()
          console.error('âŒ Email API error:', res.status, errorText)
        } else {
          console.log('âœ… Verification email sent via Pages Function')
        }
      } catch (err) {
        console.error('âŒ Failed to send verification email:', err)
      }

      // â”€â”€ Publish the member â”€â”€
      await hygraphFetch(
        `mutation PublishMember($id: ID!) {
          publishMember(where: { id: $id }) {
            id
          }
        }`,
        { id: memberId }
      )

      return { success: true, verificationUrl }

    } catch (err) {
      console.error('Register error:', err)
      return { success: false, error: 'Ett fel uppstod. FörsÃ¶k igen.' }
    }
  }

  // â”€â”€ Verify Email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const verifyEmail = async (token: string) => {
    try {
      const { data } = await hygraphFetch(
        `query GetMemberByVerificationToken($token: String!) {
          members(where: { verificationToken: $token }) {
            id
            name
            email
            verificationToken
            isVerified
          }
        }`,
        { token }
      )

      const members = data?.members
      if (!members || members.length === 0) {
        return { success: false, error: 'Ogiltig eller utgÃ¥ngen verifieringslÃ¤nk.' }
      }

      const found = members[0]

      if (found.isVerified) {
        return { success: true }
      }

      await hygraphFetch(
        `mutation VerifyMember($id: ID!) {
          updateMember(where: { id: $id }, data: {
            isVerified: true
            verificationToken: null
          }) {
            id
          }
        }`,
        { id: found.id }
      )

      await hygraphFetch(
        `mutation PublishMember($id: ID!) {
          publishMember(where: { id: $id }) {
            id
          }
        }`,
        { id: found.id }
      )
      // -- Send admin notification --
      try {
        const adminRes = await fetch('/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'moh17670s@gmail.com',
            name: 'Admin',
            subject: 'Ny användare verifierad - väntar på godkännande',
            html: '<div><h2>Ny användare verifierad</h2><p><strong>Namn:</strong> ' + found.name + '</p><p><strong>E-post:</strong> ' + found.email + '</p><p>Användaren har verifierat sin e-post och väntar på godkännande.</p><p><a href=' + window.location.origin + '/admin/approvals>Godkänn användare</a></p></div>',
          }),
        })
        if (!adminRes.ok) {
          console.error('Admin notification error:', adminRes.status)
        } else {
          console.log('Admin notification sent')
        }
      } catch (err) {
        console.error('Failed to send admin notification:', err)
      }


      return { success: true }
    } catch (err) {
      console.error('Verify email error:', err)
      return { success: false, error: 'Ett fel uppstod vid verifiering.' }
    }
  }

  // â”€â”€ Request Password Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const requestPasswordReset = async (email: string) => {
    try {
      const { data } = await hygraphFetch(
        `query GetMemberByEmail($email: String!) {
          members(where: { email: $email }) {
            id
            name
            email
          }
        }`,
        { email }
      )

      const members = data?.members
      if (!members || members.length === 0) {
        return { success: true }
      }

      const found = members[0]
      const token = generateToken()
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      await hygraphFetch(
        `mutation UpdateMemberResetToken($id: ID!, $token: String!, $expiry: DateTime!) {
          updateMember(where: { id: $id }, data: {
            resetToken: $token
            resetTokenExpiry: $expiry
          }) {
            id
          }
        }`,
        { id: found.id, token, expiry }
      )

      await hygraphFetch(
        `mutation PublishMember($id: ID!) {
          publishMember(where: { id: $id }) {
            id
          }
        }`,
        { id: found.id }
      )

      const resetUrl = `${window.location.origin}/reset-password?token=${token}`

      // â”€â”€ Send password reset email via Pages Function â”€â”€
      try {
        console.log('ðŸ“§ Sending password reset email to:', found.email)

        const res = await fetch('/send-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: found.email,
            name: found.name,
            resetUrl: resetUrl,
          }),
        })

        if (!res.ok) {
          const errorText = await res.text()
          console.error('âŒ Password reset email error:', res.status, errorText)
        } else {
          console.log('âœ… Password reset email sent via Pages Function')
        }
      } catch (err) {
        console.error('âŒ Failed to send password reset email:', err)
      }

      return { success: true }
    } catch (err) {
      console.error('Password reset request error:', err)
      return { success: false, error: 'Kunde inte skicka återstÃ¤llningslÃ¤nk.' }
    }
  }

  // â”€â”€ Reset Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      const { data } = await hygraphFetch(
        `query GetMemberByResetToken($token: String!) {
          members(where: { resetToken: $token }) {
            id
            email
            resetToken
            resetTokenExpiry
          }
        }`,
        { token }
      )

      const members = data?.members
      if (!members || members.length === 0) {
        return { success: false, error: 'Ogiltig eller utgÃ¥ngen lÃ¤nk.' }
      }

      const found = members[0]
      const now = new Date()
      const expiry = new Date(found.resetTokenExpiry)

      if (now > expiry) {
        return { success: false, error: 'LÃ¤nken har utgått. BegÃ¤r en ny återstÃ¤llning.' }
      }

      const hashedPassword = hashPassword(newPassword)

      await hygraphFetch(
        `mutation UpdatePassword($id: ID!, $password: String!) {
          updateMember(where: { id: $id }, data: {
            password: $password
            resetToken: null
            resetTokenExpiry: null
          }) {
            id
          }
        }`,
        { id: found.id, password: hashedPassword }
      )

      await hygraphFetch(
        `mutation PublishMember($id: ID!) {
          publishMember(where: { id: $id }) {
            id
          }
        }`,
        { id: found.id }
      )

      return { success: true }
    } catch (err) {
      console.error('Reset password error:', err)
      return { success: false, error: 'Ett fel uppstod.' }
    }
  }

  // â”€â”€ Logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const logout = () => {
    setUser(null)
    localStorage.removeItem('fcr_session_email')
    localStorage.removeItem('fcr_session_hash')
    localStorage.removeItem('fcr_user')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.email === 'moh17670s@gmail.com',
        isLoading,
        login,
        register,
        verifyEmail,
        requestPasswordReset,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}



