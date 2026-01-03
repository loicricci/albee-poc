"""
Performance monitoring utilities for tracking API and database performance.
Logs query times and provides metrics for optimization.
"""

import time
import logging
from functools import wraps
from typing import Callable, Any
from contextlib import contextmanager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Performance thresholds (milliseconds)
SLOW_QUERY_THRESHOLD_MS = 1000  # 1 second
WARN_QUERY_THRESHOLD_MS = 500   # 500ms


def log_performance(operation: str):
    """
    Decorator to log performance of functions/endpoints.
    Usage: @log_performance("endpoint_name")
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.time() - start) * 1000
                
                if duration_ms > SLOW_QUERY_THRESHOLD_MS:
                    logger.warning(f"⚠️  SLOW {operation}: {duration_ms:.2f}ms")
                elif duration_ms > WARN_QUERY_THRESHOLD_MS:
                    logger.info(f"⏱️  {operation}: {duration_ms:.2f}ms")
                else:
                    logger.debug(f"✅ {operation}: {duration_ms:.2f}ms")
                
                return result
            except Exception as e:
                duration_ms = (time.time() - start) * 1000
                logger.error(f"❌ {operation} failed after {duration_ms:.2f}ms: {e}")
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            start = time.time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start) * 1000
                
                if duration_ms > SLOW_QUERY_THRESHOLD_MS:
                    logger.warning(f"⚠️  SLOW {operation}: {duration_ms:.2f}ms")
                elif duration_ms > WARN_QUERY_THRESHOLD_MS:
                    logger.info(f"⏱️  {operation}: {duration_ms:.2f}ms")
                else:
                    logger.debug(f"✅ {operation}: {duration_ms:.2f}ms")
                
                return result
            except Exception as e:
                duration_ms = (time.time() - start) * 1000
                logger.error(f"❌ {operation} failed after {duration_ms:.2f}ms: {e}")
                raise
        
        # Return async or sync wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


@contextmanager
def track_query(query_name: str):
    """
    Context manager to track database query performance.
    Usage:
        with track_query("fetch_profile"):
            result = db.query(Profile).filter(...).first()
    """
    start = time.time()
    try:
        yield
        duration_ms = (time.time() - start) * 1000
        
        if duration_ms > SLOW_QUERY_THRESHOLD_MS:
            logger.warning(f"⚠️  SLOW QUERY {query_name}: {duration_ms:.2f}ms")
        elif duration_ms > WARN_QUERY_THRESHOLD_MS:
            logger.info(f"⏱️  QUERY {query_name}: {duration_ms:.2f}ms")
        else:
            logger.debug(f"✅ QUERY {query_name}: {duration_ms:.2f}ms")
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        logger.error(f"❌ QUERY {query_name} failed after {duration_ms:.2f}ms: {e}")
        raise


class PerformanceMetrics:
    """
    In-memory storage for performance metrics.
    For production, use a proper APM tool like New Relic, DataDog, etc.
    """
    def __init__(self):
        self.endpoint_times = {}
        self.query_times = {}
        self.call_counts = {}
    
    def record_endpoint(self, endpoint: str, duration_ms: float):
        """Record endpoint performance"""
        if endpoint not in self.endpoint_times:
            self.endpoint_times[endpoint] = []
            self.call_counts[endpoint] = 0
        
        self.endpoint_times[endpoint].append(duration_ms)
        self.call_counts[endpoint] += 1
        
        # Keep only last 100 measurements per endpoint
        if len(self.endpoint_times[endpoint]) > 100:
            self.endpoint_times[endpoint] = self.endpoint_times[endpoint][-100:]
    
    def record_query(self, query_name: str, duration_ms: float):
        """Record query performance"""
        if query_name not in self.query_times:
            self.query_times[query_name] = []
        
        self.query_times[query_name].append(duration_ms)
        
        # Keep only last 100 measurements per query
        if len(self.query_times[query_name]) > 100:
            self.query_times[query_name] = self.query_times[query_name][-100:]
    
    def get_stats(self, name: str, measurements: list) -> dict:
        """Calculate statistics for measurements"""
        if not measurements:
            return None
        
        sorted_times = sorted(measurements)
        count = len(sorted_times)
        
        return {
            "name": name,
            "count": count,
            "avg": sum(sorted_times) / count,
            "min": sorted_times[0],
            "max": sorted_times[-1],
            "p50": sorted_times[int(count * 0.5)],
            "p95": sorted_times[int(count * 0.95)] if count > 1 else sorted_times[0],
            "p99": sorted_times[int(count * 0.99)] if count > 1 else sorted_times[0],
        }
    
    def get_endpoint_stats(self):
        """Get all endpoint statistics"""
        return [
            self.get_stats(endpoint, times)
            for endpoint, times in self.endpoint_times.items()
            if times
        ]
    
    def get_query_stats(self):
        """Get all query statistics"""
        return [
            self.get_stats(query, times)
            for query, times in self.query_times.items()
            if times
        ]
    
    def get_slowest_endpoints(self, limit: int = 10):
        """Get slowest endpoints by P95"""
        stats = self.get_endpoint_stats()
        return sorted(stats, key=lambda x: x["p95"], reverse=True)[:limit]
    
    def get_slowest_queries(self, limit: int = 10):
        """Get slowest queries by P95"""
        stats = self.get_query_stats()
        return sorted(stats, key=lambda x: x["p95"], reverse=True)[:limit]


# Global metrics instance
metrics = PerformanceMetrics()


def print_performance_summary():
    """Print performance summary (for debugging/monitoring)"""
    logger.info("=" * 60)
    logger.info("PERFORMANCE SUMMARY")
    logger.info("=" * 60)
    
    logger.info("\n🔥 Slowest Endpoints (by P95):")
    for stat in metrics.get_slowest_endpoints(5):
        logger.info(f"  {stat['name']}: P95={stat['p95']:.0f}ms, Avg={stat['avg']:.0f}ms, Count={stat['count']}")
    
    logger.info("\n🔥 Slowest Queries (by P95):")
    for stat in metrics.get_slowest_queries(5):
        logger.info(f"  {stat['name']}: P95={stat['p95']:.0f}ms, Avg={stat['avg']:.0f}ms, Count={stat['count']}")
    
    logger.info("=" * 60)






