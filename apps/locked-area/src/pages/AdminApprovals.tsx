import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'

const HYGRAPH_ENDPOINT = import.meta.env.VITE_HYGRAPH_URL
const HYGRAPH_TOKEN = import.meta.env.VITE_HYGRAPH_TOKEN_LOCKED

interface PendingUser {
  id: string
  name: string
  email: string
  isVerified: boolean
  isApproved: boolean
}

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

export default function AdminApprovals() {
  const { isAdmin } = useAuth()
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPending = async () => {
    setLoading(true)
    // Show ALL users who are not approved (regardless of verification status)
    const { data, errors } = await hygraphFetch(
      `query GetPendingUsers {
        members(where: { isApproved: false, isVerified: true }) {
          id
          name
          email
          isVerified
          isApproved
        }
      }`
    )
    setLoading(false)
    if (errors) {
      setError('Kunde inte hÃ¤mta användare.')
      console.error(errors)
    } else {
      setPendingUsers(data?.members || [])
    }
  }

  const verifyEmail = async (id: string) => {
    try {
      const response = await hygraphFetch(
        `mutation {
          updateMember(where: { id: "${id}" }, data: { isVerified: true, verificationToken: null }) {
            id
            isVerified
          }
        }`
      )

      if (response.errors) {
        alert('âŒ Error: ' + JSON.stringify(response.errors, null, 2))
        return
      }

      // Publish
      await hygraphFetch(
        `mutation PublishMember($id: ID!) {
          publishMember(where: { id: $id }) {
            id
          }
        }`,
        { id }
      )

      await fetchPending()
      alert('âœ… E-post verifierad!')
    } catch (error) {
      console.error('Verify error:', error)
      alert('Something went wrong')
    }
  }

  const approveUser = async (id: string) => {
    console.log('âœ… Approve button clicked for ID:', id)

    setPendingUsers((prev) => prev.filter((user) => user.id !== id))

    try {
      const response = await hygraphFetch(
        `mutation {
          updateMember(where: { id: "${id}" }, data: { isApproved: true }) {
            id
            isApproved
          }
        }`
      )

      console.log('ðŸ“¦ Update response:', response)

      if (response.errors) {
        alert('âŒ Error: ' + JSON.stringify(response.errors, null, 2))
        await fetchPending()
        return
      }

      if (response.data?.updateMember) {
        await hygraphFetch(
          `mutation PublishMember($id: ID!) {
            publishMember(where: { id: $id }) {
              id
            }
          }`,
          { id }
        )

        await fetchPending()
        alert('âœ… User approved!')
      } else {
        alert('âš ï¸ No data returned.')
        await fetchPending()
      }
    } catch (error) {
      console.error('ðŸ”¥ Approve error:', error)
      alert('Something went wrong')
      await fetchPending()
    }
  }

  const denyUser = async (id: string) => {
    console.log('âŒ Deny button clicked for ID:', id)
    const confirmed = window.confirm('Ã„r du sÃ¤ker pÃ¥ att du vill neka denna användare?')
    if (!confirmed) return

    setPendingUsers((prev) => prev.filter((user) => user.id !== id))

    try {
      const response = await hygraphFetch(
        `mutation {
          deleteMember(where: { id: "${id}" }) {
            id
          }
        }`
      )
      console.log('ðŸ“¦ Deny response:', response)
      if (response.errors) {
        alert('âŒ Error: ' + JSON.stringify(response.errors, null, 2))
        await fetchPending()
      } else if (response.data?.deleteMember) {
        await fetchPending()
        alert('âŒ User denied and deleted.')
      }
    } catch (error) {
      console.error('ðŸ”¥ Deny error:', error)
      alert('Something went wrong')
      await fetchPending()
    }
  }

  useEffect(() => {
    fetchPending()
  }, [])

  if (!isAdmin) {
    return <div className="p-4">Du har inte behÃ¶righet att se denna sida.</div>
  }

  if (loading) return <div className="p-4">Laddar...</div>
  if (error) return <div className="p-4 text-red-500">{error}</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">GodkÃ¤nn nya användare</h1>
      {pendingUsers.length === 0 ? (
        <p>Inga användare väntar pÃ¥ godkännande.</p>
      ) : (
        <ul className="space-y-4">
          {pendingUsers.map((user) => (
            <li key={user.id} className="border p-4 rounded flex justify-between items-center">
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
                <p className="text-xs mt-1">
                  {user.isVerified ? (
                    <span className="text-green-600">âœ… E-post verifierad</span>
                  ) : (
                    <span className="text-red-600">âŒ E-post ej verifierad</span>
                  )}
                </p>
              </div>
              <div className="space-x-2">
                {!user.isVerified && (
                  <button
                    onClick={() => verifyEmail(user.id)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Verifiera e-post
                  </button>
                )}
                <button
                  onClick={() => approveUser(user.id)}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  disabled={!user.isVerified}
                >
                  GodkÃ¤nn
                </button>
                <button
                  onClick={() => denyUser(user.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Neka
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
