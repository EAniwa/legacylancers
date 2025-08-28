import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GigPostForm } from '../components/gig/GigPostForm'
import { GigCard } from '../components/gig/GigCard'
import { GigFilters } from '../components/marketplace/GigFilters'
import { GigSearch } from '../components/marketplace/GigSearch'
import { BidForm } from '../components/bidding/BidForm'
import type { Gig, GigSearchFilters } from '../services/gigApi'

// Mock the gig API
vi.mock('../services/gigApi', () => ({
  gigApi: {
    createGig: vi.fn(),
    getGigs: vi.fn(),
    createBid: vi.fn(),
    getBids: vi.fn(),
    getMyBids: vi.fn(),
  }
}))

describe('Gig Marketplace Components', () => {
  const mockGig: Gig = {
    id: '1',
    clientId: 'client-1',
    title: 'Senior React Developer for Code Review',
    description: 'Looking for an experienced React developer to review our codebase and provide recommendations for improvement. The project involves reviewing 10,000+ lines of React code.',
    category: 'Software Development',
    budget: {
      type: 'fixed',
      min: 2500,
    },
    skills: ['React', 'JavaScript', 'Code Review'],
    deadline: '2025-09-15T00:00:00Z',
    status: 'open',
    location: 'Remote',
    isRemote: true,
    experienceLevel: 'expert',
    createdAt: '2025-08-28T15:00:00Z',
    applicantCount: 3,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GigPostForm', () => {
    it('renders all form fields correctly', () => {
      const mockSubmit = vi.fn()
      
      render(
        <GigPostForm
          clientId="client-1"
          onSubmit={mockSubmit}
        />
      )

      expect(screen.getByLabelText(/gig title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
      expect(screen.getByText(/required skills/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/remote work allowed/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /post gig/i })).toBeInTheDocument()
    })

    it('validates required fields', async () => {
      const mockSubmit = vi.fn()
      
      render(
        <GigPostForm
          clientId="client-1"
          onSubmit={mockSubmit}
        />
      )

      const submitButton = screen.getByRole('button', { name: /post gig/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
        expect(screen.getByText(/description is required/i)).toBeInTheDocument()
        expect(screen.getByText(/category is required/i)).toBeInTheDocument()
      })

      expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('handles skill selection', () => {
      const mockSubmit = vi.fn()
      
      render(
        <GigPostForm
          clientId="client-1"
          onSubmit={mockSubmit}
        />
      )

      // Find and click a skill checkbox
      const reactSkill = screen.getByLabelText(/software engineering/i)
      fireEvent.click(reactSkill)

      expect(reactSkill).toBeChecked()
      expect(screen.getByText(/selected: software engineering/i)).toBeInTheDocument()
    })

    it('submits form with valid data', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined)
      
      render(
        <GigPostForm
          clientId="client-1"
          onSubmit={mockSubmit}
        />
      )

      // Fill out required fields
      fireEvent.change(screen.getByLabelText(/gig title/i), {
        target: { value: 'React Code Review Project' }
      })
      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'Looking for an experienced React developer to review our codebase and provide recommendations for improvement.' }
      })
      fireEvent.change(screen.getByLabelText(/category/i), {
        target: { value: 'Software Development' }
      })

      const submitButton = screen.getByRole('button', { name: /post gig/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 'client-1',
            title: 'React Code Review Project',
            category: 'Software Development',
            isRemote: true,
            experienceLevel: 'any',
          })
        )
      })
    })
  })

  describe('GigCard', () => {
    it('renders gig information correctly', () => {
      render(
        <GigCard
          gig={mockGig}
          userRole="retiree"
          userId="retiree-1"
        />
      )

      expect(screen.getByText('Senior React Developer for Code Review')).toBeInTheDocument()
      expect(screen.getByText(/code review/i)).toBeInTheDocument()
      expect(screen.getByText('OPEN')).toBeInTheDocument()
      expect(screen.getByText('Software Development')).toBeInTheDocument()
      expect(screen.getByText('Budget: $2,500')).toBeInTheDocument()
      expect(screen.getByText('3 applicants')).toBeInTheDocument()
    })

    it('shows submit proposal button for retirees when not already bid', () => {
      render(
        <GigCard
          gig={mockGig}
          userRole="retiree"
          userId="retiree-1"
          hasUserBid={false}
          onBid={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument()
    })

    it('shows proposal submitted status when user has already bid', () => {
      render(
        <GigCard
          gig={mockGig}
          userRole="retiree"
          userId="retiree-1"
          hasUserBid={true}
        />
      )

      expect(screen.getByText(/proposal submitted/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /submit proposal/i })).not.toBeInTheDocument()
    })

    it('shows view proposals button for gig owner', () => {
      const mockViewBids = vi.fn()
      
      render(
        <GigCard
          gig={mockGig}
          userRole="client"
          userId="client-1"
          onViewBids={mockViewBids}
        />
      )

      expect(screen.getByRole('button', { name: /view proposals \(3\)/i })).toBeInTheDocument()
    })
  })

  describe('GigSearch', () => {
    it('renders search input and button', () => {
      render(<GigSearch onSearch={vi.fn()} />)

      expect(screen.getByPlaceholderText(/search gigs/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    })

    it('calls onSearch when form is submitted', () => {
      const mockSearch = vi.fn()
      
      render(<GigSearch onSearch={mockSearch} />)

      const searchInput = screen.getByPlaceholderText(/search gigs/i)
      fireEvent.change(searchInput, { target: { value: 'React developer' } })
      fireEvent.submit(screen.getByRole('searchbox'))

      expect(mockSearch).toHaveBeenCalledWith('React developer')
    })

    it('shows clear button when there is a query', () => {
      render(<GigSearch onSearch={vi.fn()} />)

      const searchInput = screen.getByPlaceholderText(/search gigs/i)
      fireEvent.change(searchInput, { target: { value: 'test query' } })

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })
  })

  describe('GigFilters', () => {
    const mockFilters: GigSearchFilters = {
      category: 'Software Development',
      minBudget: 1000,
      skills: ['React'],
      sortBy: 'newest',
    }

    it('renders all filter options', () => {
      render(
        <GigFilters
          filters={mockFilters}
          onFiltersChange={vi.fn()}
          onClearFilters={vi.fn()}
          hasActiveFilters={true}
        />
      )

      expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/min budget/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/max budget/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/experience level/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/remote work only/i)).toBeInTheDocument()
      expect(screen.getByText(/required skills/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument()
    })

    it('shows clear all button when filters are active', () => {
      render(
        <GigFilters
          filters={mockFilters}
          onFiltersChange={vi.fn()}
          onClearFilters={vi.fn()}
          hasActiveFilters={true}
        />
      )

      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
    })

    it('calls onFiltersChange when filters are updated', () => {
      const mockFiltersChange = vi.fn()
      
      render(
        <GigFilters
          filters={{}}
          onFiltersChange={mockFiltersChange}
          onClearFilters={vi.fn()}
          hasActiveFilters={false}
        />
      )

      const categorySelect = screen.getByLabelText(/category/i)
      fireEvent.change(categorySelect, { target: { value: 'Consulting' } })

      expect(mockFiltersChange).toHaveBeenCalledWith({ category: 'Consulting' })
    })
  })

  describe('BidForm', () => {
    it('renders all bid form fields', () => {
      const mockSubmit = vi.fn()
      
      render(
        <BidForm
          gig={mockGig}
          retireeId="retiree-1"
          onSubmit={mockSubmit}
        />
      )

      expect(screen.getByLabelText(/your proposal/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/your rate\/budget/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/estimated hours/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/delivery date/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument()
    })

    it('shows gig requirements summary', () => {
      const mockSubmit = vi.fn()
      
      render(
        <BidForm
          gig={mockGig}
          retireeId="retiree-1"
          onSubmit={mockSubmit}
        />
      )

      expect(screen.getByText('Gig Requirements')).toBeInTheDocument()
      expect(screen.getByText('Category: Software Development')).toBeInTheDocument()
      expect(screen.getByText('Experience: expert')).toBeInTheDocument()
      expect(screen.getByText('Location: Remote')).toBeInTheDocument()
      expect(screen.getByText('Skills: React, JavaScript, Code Review')).toBeInTheDocument()
    })

    it('validates proposal length', async () => {
      const mockSubmit = vi.fn()
      
      render(
        <BidForm
          gig={mockGig}
          retireeId="retiree-1"
          onSubmit={mockSubmit}
        />
      )

      const proposalTextarea = screen.getByLabelText(/your proposal/i)
      fireEvent.change(proposalTextarea, { target: { value: 'Short proposal' } })

      const submitButton = screen.getByRole('button', { name: /submit proposal/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/proposal must be at least 100 characters/i)).toBeInTheDocument()
      })

      expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('submits bid with valid data', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined)
      
      render(
        <BidForm
          gig={mockGig}
          retireeId="retiree-1"
          onSubmit={mockSubmit}
        />
      )

      // Fill out required proposal
      const longProposal = 'I am an experienced React developer with 15+ years in the industry. I have extensive experience in code review and have worked with teams of all sizes. My approach involves systematic analysis of code quality, performance, security, and maintainability. I can provide detailed documentation and recommendations for improvement.'
      
      fireEvent.change(screen.getByLabelText(/your proposal/i), {
        target: { value: longProposal }
      })

      const submitButton = screen.getByRole('button', { name: /submit proposal/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          gigId: '1',
          retireeId: 'retiree-1',
          proposal: longProposal,
        })
      })
    })
  })

  describe('GigSearch', () => {
    it('performs search on form submission', () => {
      const mockSearch = vi.fn()
      
      render(<GigSearch onSearch={mockSearch} />)

      const searchInput = screen.getByPlaceholderText(/search gigs/i)
      const searchButton = screen.getByRole('button', { name: /search/i })

      fireEvent.change(searchInput, { target: { value: 'React' } })
      fireEvent.click(searchButton)

      expect(mockSearch).toHaveBeenCalledWith('React')
    })

    it('clears search when clear button is clicked', () => {
      const mockSearch = vi.fn()
      
      render(<GigSearch onSearch={mockSearch} />)

      const searchInput = screen.getByPlaceholderText(/search gigs/i)
      fireEvent.change(searchInput, { target: { value: 'React' } })

      const clearButton = screen.getByRole('button', { name: /clear/i })
      fireEvent.click(clearButton)

      expect(searchInput).toHaveValue('')
      expect(mockSearch).toHaveBeenCalledWith('')
    })
  })

  describe('GigFilters', () => {
    it('updates category filter', () => {
      const mockFiltersChange = vi.fn()
      
      render(
        <GigFilters
          filters={{}}
          onFiltersChange={mockFiltersChange}
          onClearFilters={vi.fn()}
          hasActiveFilters={false}
        />
      )

      const categorySelect = screen.getByLabelText(/category/i)
      fireEvent.change(categorySelect, { target: { value: 'Consulting' } })

      expect(mockFiltersChange).toHaveBeenCalledWith({ category: 'Consulting' })
    })

    it('handles skill selection', () => {
      const mockFiltersChange = vi.fn()
      
      render(
        <GigFilters
          filters={{ skills: [] }}
          onFiltersChange={mockFiltersChange}
          onClearFilters={vi.fn()}
          hasActiveFilters={false}
        />
      )

      const softwareEngineeringSkill = screen.getByLabelText(/software engineering/i)
      fireEvent.click(softwareEngineeringSkill)

      expect(mockFiltersChange).toHaveBeenCalledWith({ 
        skills: ['Software Engineering'] 
      })
    })

    it('clears all filters when clear button is clicked', () => {
      const mockClearFilters = vi.fn()
      
      render(
        <GigFilters
          filters={{ category: 'Consulting' }}
          onFiltersChange={vi.fn()}
          onClearFilters={mockClearFilters}
          hasActiveFilters={true}
        />
      )

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      fireEvent.click(clearButton)

      expect(mockClearFilters).toHaveBeenCalled()
    })
  })
})