import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchBox } from '../../src/components/SearchBox'

const results = {
  module: 'search',
  data: {
    results: [
      {
        geonameId: 1,
        name: 'Springfield',
        admin1: 'Illinois',
        country: 'United States',
        countryCode: 'US',
        lat: 1,
        lon: 1,
        population: 100000,
      },
      {
        geonameId: 2,
        name: 'Springfield',
        admin1: 'Missouri',
        country: 'United States',
        countryCode: 'US',
        lat: 1,
        lon: 1,
        population: 50000,
      },
    ],
  },
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(results) }),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('search box', () => {
  it('waits 300 ms and 3 characters, then shows disambiguated candidates', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <MemoryRouter>
        <SearchBox />
      </MemoryRouter>,
    )
    const input = screen.getByRole('combobox')
    await user.type(input, 'Sp')
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(fetch).not.toHaveBeenCalled()
    await user.type(input, 'r')
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(fetch).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0].textContent).toContain('Illinois')
    expect(options[1].textContent).toContain('Missouri')
  })
  it('debounces rapid typing into one request', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <MemoryRouter>
        <SearchBox />
      </MemoryRouter>,
    )
    await user.type(screen.getByRole('combobox'), 'Spring')
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('supports keyboard navigation and Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <MemoryRouter>
        <SearchBox />
      </MemoryRouter>,
    )
    const input = screen.getByRole('combobox')
    await user.type(input, 'Spring')
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    await screen.findAllByRole('option')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Escape}')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
