import { useState } from 'react'
import { BookingDashboard } from './pages/booking/BookingDashboard'
import { GigMarketplace } from './pages/marketplace/GigMarketplace'
import './App.css'

type AppView = 'bookings' | 'marketplace';

function App() {
  // Mock user data - in a real app, this would come from authentication
  const [currentUser] = useState({
    id: 'user-123',
    role: 'client' as 'client' | 'retiree',
    name: 'John Doe'
  })

  const [currentView, setCurrentView] = useState<AppView>('bookings');
  const [selectedRetireeId] = useState('retiree-456')

  const navigationItems = [
    { key: 'bookings' as AppView, label: 'Direct Bookings', icon: '📅' },
    { key: 'marketplace' as AppView, label: 'Gig Marketplace', icon: '🏪' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">
                LegacyLancers
              </h1>
              
              {/* Navigation */}
              <nav className="flex space-x-4">
                {navigationItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setCurrentView(item.key)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      currentView === item.key
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
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
        {currentView === 'bookings' && (
          <BookingDashboard
            userId={currentUser.id}
            userRole={currentUser.role}
            selectedRetireeId={selectedRetireeId}
          />
        )}
        
        {currentView === 'marketplace' && (
          <GigMarketplace
            userId={currentUser.id}
            userRole={currentUser.role}
          />
        )}
      </main>
    </div>
  )
}

export default App
