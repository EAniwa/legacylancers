import { useState } from 'react'
import { BookingDashboard } from './pages/booking/BookingDashboard'
import './App.css'

function App() {
  // Mock user data - in a real app, this would come from authentication
  const [currentUser] = useState({
    id: 'user-123',
    role: 'client' as 'client' | 'retiree',
    name: 'John Doe'
  })

  const [selectedRetireeId] = useState('retiree-456')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                LegacyLancers
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {currentUser.name}
              </span>
              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                {currentUser.role === 'client' ? 'Client' : 'Retiree'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main>
        <BookingDashboard
          userId={currentUser.id}
          userRole={currentUser.role}
          selectedRetireeId={selectedRetireeId}
        />
      </main>
    </div>
  )
}

export default App
