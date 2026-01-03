"""
Timing Utilities for Performance Monitoring

Provides helper functions to track execution time of operations
with millisecond precision for performance diagnostics.
"""

import time
from typing import Optional, Dict, Any
from datetime import datetime
from contextlib import contextmanager


class Timer:
    """
    Simple timer class for tracking execution time.
    """
    
    def __init__(self, name: str = "operation"):
        self.name = name
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.duration: Optional[float] = None
    
    def start(self):
        """Start the timer"""
        self.start_time = time.time()
        return self
    
    def stop(self) -> float:
        """Stop the timer and return duration in seconds"""
        self.end_time = time.time()
        if self.start_time is None:
            raise ValueError("Timer was never started")
        self.duration = self.end_time - self.start_time
        return self.duration
    
    def elapsed(self) -> float:
        """Get elapsed time without stopping the timer"""
        if self.start_time is None:
            raise ValueError("Timer was never started")
        return time.time() - self.start_time
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, *args):
        self.stop()


@contextmanager
def time_operation(operation_name: str, verbose: bool = True):
    """
    Context manager to time an operation and print results.
    
    Usage:
        with time_operation("API Call"):
            result = api_call()
    """
    start = time.time()
    start_str = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    
    if verbose:
        print(f"[{start_str}] Starting: {operation_name}")
    
    try:
        yield
    finally:
        duration = time.time() - start
        end_str = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        
        if verbose:
            print(f"[{end_str}] Completed: {operation_name} ({format_duration(duration)})")


def format_duration(seconds: float) -> str:
    """
    Format duration in a human-readable way.
    
    Args:
        seconds: Duration in seconds
    
    Returns:
        Formatted string (e.g., "1.23s", "45.6ms", "2m 30s")
    """
    if seconds < 0.001:
        return f"{seconds * 1000000:.1f}µs"
    elif seconds < 1:
        return f"{seconds * 1000:.1f}ms"
    elif seconds < 60:
        return f"{seconds:.2f}s"
    else:
        minutes = int(seconds // 60)
        remaining_seconds = seconds % 60
        return f"{minutes}m {remaining_seconds:.1f}s"


class PerformanceTracker:
    """
    Tracks performance metrics for a multi-step operation.
    """
    
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.steps: Dict[str, Dict[str, Any]] = {}
        self.overall_start: Optional[float] = None
        self.overall_end: Optional[float] = None
        self.current_step: Optional[str] = None
        self.current_step_start: Optional[float] = None
    
    def start(self):
        """Start tracking the overall operation"""
        self.overall_start = time.time()
        print("\n" + "=" * 80)
        print(f"⏱️  PERFORMANCE TRACKING: {self.operation_name}")
        print("=" * 80)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
        print("=" * 80 + "\n")
    
    def start_step(self, step_name: str, description: str = ""):
        """Start tracking a step"""
        if self.current_step is not None:
            # Auto-stop previous step
            self.stop_step()
        
        self.current_step = step_name
        self.current_step_start = time.time()
        
        display_name = f"{step_name}: {description}" if description else step_name
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        print(f"[{timestamp}] ▶️  {display_name}")
    
    def stop_step(self, metadata: Optional[Dict[str, Any]] = None):
        """Stop tracking the current step"""
        if self.current_step is None or self.current_step_start is None:
            return
        
        duration = time.time() - self.current_step_start
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        
        self.steps[self.current_step] = {
            "duration": duration,
            "timestamp": timestamp,
            "metadata": metadata or {}
        }
        
        print(f"[{timestamp}] ✅ {self.current_step} completed in {format_duration(duration)}")
        
        self.current_step = None
        self.current_step_start = None
    
    def finish(self):
        """Finish tracking and print summary"""
        if self.current_step is not None:
            self.stop_step()
        
        self.overall_end = time.time()
        total_duration = self.overall_end - self.overall_start if self.overall_start else 0
        
        print("\n" + "=" * 80)
        print("📊 PERFORMANCE SUMMARY")
        print("=" * 80)
        
        # Print each step
        step_total = 0
        for i, (step_name, data) in enumerate(self.steps.items(), 1):
            duration = data["duration"]
            step_total += duration
            percentage = (duration / total_duration * 100) if total_duration > 0 else 0
            
            print(f"{i}. {step_name:40s} {format_duration(duration):>12s}  ({percentage:5.1f}%)")
        
        # Calculate overhead
        overhead = total_duration - step_total
        overhead_pct = (overhead / total_duration * 100) if total_duration > 0 else 0
        
        print("-" * 80)
        print(f"{'Total tracked time:':40s} {format_duration(step_total):>12s}")
        print(f"{'Overhead (logging, etc.):':40s} {format_duration(overhead):>12s}  ({overhead_pct:5.1f}%)")
        print(f"{'TOTAL DURATION:':40s} {format_duration(total_duration):>12s}")
        print("=" * 80)
        
        # Find slowest step
        if self.steps:
            slowest = max(self.steps.items(), key=lambda x: x[1]["duration"])
            slowest_pct = (slowest[1]["duration"] / total_duration * 100) if total_duration > 0 else 0
            print(f"\n🔴 BOTTLENECK: {slowest[0]}")
            print(f"   Duration: {format_duration(slowest[1]['duration'])} ({slowest_pct:.1f}% of total)")
        
        print("=" * 80 + "\n")
        
        return {
            "total_duration": total_duration,
            "steps": self.steps,
            "bottleneck": slowest[0] if self.steps else None
        }





