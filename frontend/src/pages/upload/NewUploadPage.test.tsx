import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CreateUploadForm } from '@/pages/upload/NewUploadPage'

const mockCreateMutate = vi.fn()

vi.mock('@/api/hooks/disks', () => ({
  useDisks: () => ({ data: [{ id: 1, label: 'Disco A' }] }),
  useBrowseDisk: () => ({
    data: { entries: [{ name: 'Movie.2024.1080p.WEB.mkv', is_dir: false, size: 123 }] },
    isPending: false,
    isError: false,
  }),
  useMkdir: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/api/hooks/trackers', () => ({
  useTrackers: () => ({ data: [{ id: 1, label: 'Tracker A' }] }),
}))

vi.mock('@/api/hooks/uploads', () => ({
  useCreateUpload: () => ({ mutate: mockCreateMutate, isPending: false }),
}))

describe('CreateUploadForm', () => {
  it('keeps "Create draft" disabled until tracker, disk and file are all chosen', async () => {
    const user = userEvent.setup()
    render(<CreateUploadForm onCreated={() => {}} />)

    const submit = screen.getByRole('button', { name: 'Create draft' })
    expect(submit).toBeDisabled()

    await user.click(screen.getByText('Choose a tracker…'))
    await user.click(await screen.findByRole('option', { name: 'Tracker A' }))
    expect(submit).toBeDisabled()

    await user.click(screen.getByText('Choose a disk…'))
    await user.click(await screen.findByRole('option', { name: 'Disco A' }))
    expect(submit).toBeDisabled()

    await user.click(screen.getByText('Choose a file…'))
    await user.click(await screen.findByText('Movie.2024.1080p.WEB.mkv'))
    expect(submit).toBeEnabled()

    await user.click(submit)
    expect(mockCreateMutate).toHaveBeenCalledWith(
      { disk_id: 1, relative_path: 'Movie.2024.1080p.WEB.mkv', tracker_id: 1 },
      expect.anything(),
    )
  })
})
