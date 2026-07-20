import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ExecuteButton } from './ExecuteButton';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ExecuteButton', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with execute text', () => {
    render(<ExecuteButton bookPath="test/path" actionType="test-action" />);

    expect(screen.getByRole('button', { name: /执行/ })).toBeInTheDocument();
  });

  it('shows loading state when executing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, output: 'done' }),
    });

    render(<ExecuteButton bookPath="test/path" actionType="test-action" />);

    const button = screen.getByRole('button', { name: /执行/ });
    button.click();

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(screen.getByText('执行中...')).toBeInTheDocument();
    });
  });

  it('calls onSuccess callback on successful execution', async () => {
    const onSuccess = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, output: 'done' }),
    });

    render(<ExecuteButton bookPath="test/path" actionType="test-action" onSuccess={onSuccess} />);

    const button = screen.getByRole('button', { name: /执行/ });
    button.click();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message on failed execution', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, output: '', error: '脚本错误' }),
    });

    render(<ExecuteButton bookPath="test/path" actionType="test-action" />);

    const button = screen.getByRole('button', { name: /执行/ });
    button.click();

    await waitFor(() => {
      expect(screen.getByText('脚本错误')).toBeInTheDocument();
    });
  });

  it('shows error message on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('网络错误'));

    render(<ExecuteButton bookPath="test/path" actionType="test-action" />);

    const button = screen.getByRole('button', { name: /执行/ });
    button.click();

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });
  });

  it('button is enabled after execution completes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, output: 'done' }),
    });

    render(<ExecuteButton bookPath="test/path" actionType="test-action" />);

    const button = screen.getByRole('button', { name: /执行/ });
    button.click();

    await waitFor(() => {
      expect(button).toBeEnabled();
    });
  });
});
