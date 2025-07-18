import ProtectedRoute from '@/components/auth/ProtectedRoute'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-background">
      {children}
    </div>
    </ProtectedRoute>
  )
} 