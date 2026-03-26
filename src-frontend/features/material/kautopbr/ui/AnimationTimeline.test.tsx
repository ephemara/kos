import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnimationTimeline } from './AnimationTimeline';

describe('AnimationTimeline', () => {
  it('renders with default props', () => {
    render(<AnimationTimeline />);
    
    // Check for play button
    const playButton = screen.getByTitle('Play');
    expect(playButton).toBeDefined();
    
    // Check for stop button
    const stopButton = screen.getByTitle('Stop');
    expect(stopButton).toBeDefined();
  });

  it('displays current time and duration', () => {
    render(<AnimationTimeline currentTime={2.5} duration={10} />);
    
    // Should show formatted time
    expect(screen.getByText('0:02.5')).toBeDefined();
    expect(screen.getByText('0:10.0')).toBeDefined();
  });

  it('calls onPlayStateChange when play button is clicked', () => {
    const handlePlayStateChange = vi.fn();
    render(<AnimationTimeline onPlayStateChange={handlePlayStateChange} />);
    
    const playButton = screen.getByTitle('Play');
    fireEvent.click(playButton);
    
    expect(handlePlayStateChange).toHaveBeenCalledWith(true);
  });

  it('calls onStop when stop button is clicked', () => {
    const handleStop = vi.fn();
    const handleTimeChange = vi.fn();
    render(<AnimationTimeline onStop={handleStop} onTimeChange={handleTimeChange} />);
    
    const stopButton = screen.getByTitle('Stop');
    fireEvent.click(stopButton);
    
    expect(handleStop).toHaveBeenCalled();
    expect(handleTimeChange).toHaveBeenCalledWith(0);
  });

  it('displays loop mode selector', () => {
    render(<AnimationTimeline loopMode="Loop" />);
    
    // Loop mode selector should be present
    const loopSelector = screen.getByRole('combobox');
    expect(loopSelector).toBeDefined();
  });

  it('formats time correctly', () => {
    const { rerender } = render(<AnimationTimeline currentTime={0} duration={10} />);
    expect(screen.getByText('0:00.0')).toBeDefined();
    
    rerender(<AnimationTimeline currentTime={65.7} duration={120} />);
    expect(screen.getByText('1:05.7')).toBeDefined();
  });

  it('generates time markers based on duration', () => {
    const { container } = render(<AnimationTimeline duration={10} />);
    
    // Should have markers at 0s, 1s, 2s, etc. for short durations
    expect(screen.getByText('0s')).toBeDefined();
    expect(screen.getByText('1s')).toBeDefined();
  });

  it('shows playing state', () => {
    render(<AnimationTimeline isPlaying={true} />);
    
    expect(screen.getByText('Playing')).toBeDefined();
  });

  it('shows paused state', () => {
    render(<AnimationTimeline isPlaying={false} />);
    
    expect(screen.getByText('Paused')).toBeDefined();
  });
});
