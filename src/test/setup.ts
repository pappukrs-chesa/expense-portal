// Runs before every test file.
// Adds jest-dom matchers (toBeInTheDocument, etc.) and auto-cleans the DOM after each test.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
