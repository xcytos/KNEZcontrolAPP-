import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemPanel } from './SystemPanel';

// Mock Tauri shell command
const mockSpawn = vi.fn();
const mockOn = vi.fn();

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: {
    create: vi.fn(() => ({
      spawn: mockSpawn,
      on: mockOn,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    })),
  },
}));

describe('SystemPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to Tauri context
    Object.defineProperty(window, '__TAURI__', { value: {}, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, '__TAURI__', { value: undefined, writable: true });
  });

  it('renders Start Local Stack button', () => {
    render(<SystemPanel />);
    expect(screen.getByText('Start Local Stack')).toBeDefined();
  });

  it('blocks execution in web context (non-Tauri)', async () => {
    // Simulate web context
    Object.defineProperty(window, '__TAURI__', { value: undefined, writable: true });
    
    render(<SystemPanel />);
    const button = screen.getByText('Start Local Stack');
    fireEvent.click(button);
    
    expect(screen.getByText(/Shell unavailable in web mode/i)).toBeDefined();
    
    const { Command } = await import('@tauri-apps/plugin-shell');
    expect(Command.create).not.toHaveBeenCalled();
  });

  it('initiates stack startup when button is clicked in Tauri context', async () => {
    render(<SystemPanel />);
    const button = screen.getByText('Start Local Stack');
    
    fireEvent.click(button);
    
    expect(screen.getByText('starting')).toBeDefined();
    // Verify Command.create was called
    const { Command } = await import('@tauri-apps/plugin-shell');
    expect(Command.create).toHaveBeenCalledWith('powershell', ['-File', 'scripts/start_local_stack.ps1']);
  });
});
