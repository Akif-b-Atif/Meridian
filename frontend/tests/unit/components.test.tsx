import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Chapter, Curious, Legend, Takeaway } from '../../src/components/Chapter'
import { Term } from '../../src/components/Term'
import { Rail } from '../../src/components/Rail'
import { PreferencesProvider, usePrefs } from '../../src/state/preferences'

beforeEach(() => {
  localStorage.clear()
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never
})

describe('Term', () => {
  it('opens a definition on click and closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Term id="solstice">solstice</Term>)
    await user.click(screen.getByRole('button', { name: 'solstice' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('sun is at its highest')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
  it('renders plain text for an unknown term', () => {
    render(<Term id="nope">word</Term>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('word')).toBeInTheDocument()
  })
})

function Toggle() {
  const { setMode } = usePrefs()
  return <button onClick={() => setMode('detail')}>detailed</button>
}

describe('Chapter pieces', () => {
  it('shows the question, stats and takeaway', () => {
    render(
      <PreferencesProvider>
        <Chapter
          id="x"
          num={3}
          title="Warming"
          question="Is it warming?"
          stats={[{ value: 'M6.1', label: 'strongest' }]}
        >
          <Takeaway>It is.</Takeaway>
        </Chapter>
      </PreferencesProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Warming' })).toBeInTheDocument()
    expect(screen.getByText('Is it warming?')).toBeInTheDocument()
    expect(screen.getByText('M6.1')).toBeInTheDocument()
    expect(screen.getByText('What this shows')).toBeInTheDocument()
    expect(screen.getByText('03')).toBeInTheDocument()
  })
  it('keeps technical detail closed in plain mode and opens it in detailed mode', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <PreferencesProvider>
        <Toggle />
        <Curious>
          <p>method</p>
        </Curious>
      </PreferencesProvider>,
    )
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    await user.click(screen.getByText('detailed'))
    expect(container.querySelector('details')).toHaveAttribute('open')
    expect(localStorage.getItem('meridian.mode')).toBe('detail')
  })
  it('labels every legend entry', () => {
    render(
      <Legend
        items={[
          { label: 'Rain', kind: 'box' },
          { label: 'Average', kind: 'line' },
        ]}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('Rail', () => {
  it('lists the chapters as links and marks one as current', () => {
    render(
      <Rail
        items={[
          { id: 'a', title: 'Alpha' },
          { id: 'b', title: 'Beta' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: /Alpha/ })).toHaveAttribute('href', '#a')
    expect(screen.getByRole('link', { name: /Beta/ })).toHaveAttribute('href', '#b')
    expect(
      screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'location'),
    ).toHaveLength(1)
  })
})
