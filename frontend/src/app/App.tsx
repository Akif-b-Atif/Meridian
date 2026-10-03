import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Landing, NotFound } from '../routes/Landing'
import { PreferencesProvider } from '../state/preferences'
import { Layout } from './Layout'

const client = new QueryClient()
const City = lazy(() => import('../routes/City').then((m) => ({ default: m.City })))

export function App() {
  return (
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Landing />} />
              <Route
                path="city/:geonameId/:slug"
                element={
                  <Suspense fallback={<p>Loading...</p>}>
                    <City />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PreferencesProvider>
    </QueryClientProvider>
  )
}
