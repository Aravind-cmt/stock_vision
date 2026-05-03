"""
Next Trading Day Calculator for Stock Prediction App
Handles weekends and stock market holidays (NSE - Indian Stock Market)

Problem with current logic (last_date + 1 day):
- Ignores weekends: Friday + 1 = Saturday (invalid trading day)
- Ignores market holidays: Before holiday + 1 = Holiday (invalid trading day)
- Results in invalid prediction dates that confuse users

Solution:
- Skip weekends automatically (Saturday=5, Sunday=6)
- Check against NSE holiday calendar
- Ensure next prediction is always a valid trading day
"""

from datetime import datetime, timedelta
from typing import Union, List, Tuple
import os

# ============================================================================
# VERSION 1: SIMPLE (Weekend Handling Only)
# ============================================================================

def next_trading_day_simple(last_date: Union[str, datetime]) -> str:
    """
    Calculate next trading day, skipping weekends only.
    
    Args:
        last_date: Last available market date (str: "YYYY-MM-DD" or datetime)
    
    Returns:
        Next valid trading day as string "YYYY-MM-DD"
    
    Example:
        >>> next_trading_day_simple("2025-12-12")  # Friday
        "2025-12-15"  # Monday (skips weekend)
        
        >>> next_trading_day_simple("2025-12-14")  # Sunday
        "2025-12-15"  # Monday
    """
    # Convert to datetime if string
    if isinstance(last_date, str):
        date = datetime.strptime(last_date, "%Y-%m-%d")
    else:
        date = last_date
    
    # Add 1 day as starting point
    next_day = date + timedelta(days=1)
    
    # Skip weekends: 5=Saturday, 6=Sunday
    while next_day.weekday() in [5, 6]:
        next_day += timedelta(days=1)
    
    return next_day.strftime("%Y-%m-%d")


# ============================================================================
# VERSION 2: With NSE Holidays (Hardcoded)
# ============================================================================

# NSE Market Holidays for 2024-2026 (Republic Day, Independence Day, etc.)
NSE_HOLIDAYS_2024_2026 = {
    # 2024
    "2024-01-26",  # Republic Day
    "2024-03-08",  # Maha Shivaratri
    "2024-03-25",  # Holi
    "2024-03-29",  # Good Friday
    "2024-04-11",  # Eid-ul-Fitr
    "2024-04-17",  # Ram Navami
    "2024-04-21",  # Mahavir Jayanti
    "2024-05-23",  # Buddha Purnima
    "2024-06-17",  # Eid-ul-Adha
    "2024-07-17",  # Muharram
    "2024-08-15",  # Independence Day
    "2024-08-26",  # Janmashtami
    "2024-09-16",  # Milad-un-Nabi
    "2024-10-02",  # Gandhi Jayanti
    "2024-10-12",  # Dussehra
    "2024-10-31",  # Diwali (Day 1)
    "2024-11-01",  # Diwali (Day 2)
    "2024-11-15",  # Guru Nanak Jayanti
    "2024-12-25",  # Christmas
    
    # 2025
    "2025-01-26",  # Republic Day
    "2025-03-14",  # Holi
    "2025-04-18",  # Good Friday
    "2025-04-21",  # Eid-ul-Fitr (tentative)
    "2025-05-23",  # Buddha Purnima
    "2025-06-10",  # Eid-ul-Adha (tentative)
    "2025-07-07",  # Muharram
    "2025-08-15",  # Independence Day
    "2025-08-27",  # Janmashtami
    "2025-10-02",  # Gandhi Jayanti
    "2025-10-13",  # Dussehra
    "2025-11-01",  # Diwali
    "2025-11-15",  # Guru Nanak Jayanti
    "2025-12-25",  # Christmas
    
    # 2026
    "2026-01-26",  # Republic Day
    "2026-03-06",  # Holi
    "2026-04-10",  # Good Friday
    "2026-05-14",  # Buddha Purnima
    "2026-07-28",  # Muharram
    "2026-08-15",  # Independence Day
    "2026-09-16",  # Milad-un-Nabi
    "2026-10-02",  # Gandhi Jayanti
    "2026-10-23",  # Dussehra
    "2026-11-05",  # Diwali
    "2026-12-25",  # Christmas
}


def next_trading_day_with_holidays(
    last_date: Union[str, datetime],
    holidays: set = None
) -> str:
    """
    Calculate next trading day, skipping weekends AND NSE holidays.
    
    Args:
        last_date: Last available market date (str: "YYYY-MM-DD" or datetime)
        holidays: Set of holiday dates as strings "YYYY-MM-DD". 
                  Defaults to NSE_HOLIDAYS_2024_2026
    
    Returns:
        Next valid trading day as string "YYYY-MM-DD"
    
    Example:
        >>> next_trading_day_with_holidays("2024-03-29")  # Good Friday
        "2024-04-01"  # Skips weekend AND holiday
        
        >>> next_trading_day_with_holidays("2024-08-14")  # Before Independence Day
        "2024-08-16"  # Skips holiday on 15th
    """
    if holidays is None:
        holidays = NSE_HOLIDAYS_2024_2026
    
    # Convert to datetime if string
    if isinstance(last_date, str):
        date = datetime.strptime(last_date, "%Y-%m-%d")
    else:
        date = last_date
    
    # Add 1 day as starting point
    next_day = date + timedelta(days=1)
    
    # Skip weekends and holidays
    max_iterations = 50  # Prevent infinite loop (max gap is ~4 days usually)
    iterations = 0
    
    while iterations < max_iterations:
        # Check if weekend or holiday
        is_weekend = next_day.weekday() in [5, 6]
        is_holiday = next_day.strftime("%Y-%m-%d") in holidays
        
        if not is_weekend and not is_holiday:
            break
        
        next_day += timedelta(days=1)
        iterations += 1
    
    return next_day.strftime("%Y-%m-%d")


# ============================================================================
# VERSION 3: Using pandas_market_calendars (RECOMMENDED FOR PRODUCTION)
# ============================================================================

def next_trading_day_with_calendar(
    last_date: Union[str, datetime],
    market: str = "NSE"
) -> str:
    """
    Calculate next trading day using pandas_market_calendars.
    REQUIRES: pip install pandas-market-calendars
    
    This is the most accurate method as it uses real NSE calendar data.
    
    Args:
        last_date: Last available market date (str: "YYYY-MM-DD" or datetime)
        market: Market code. Use "NSE" for Indian markets
    
    Returns:
        Next valid trading day as string "YYYY-MM-DD"
    
    Example:
        >>> next_trading_day_with_calendar("2024-03-29")
        "2024-04-01"
    """
    try:
        import pandas_market_calendars as mcal
    except ImportError:
        raise ImportError(
            "pandas_market_calendars not installed. "
            "Install with: pip install pandas-market-calendars"
        )
    
    # Convert to datetime if string
    if isinstance(last_date, str):
        date = datetime.strptime(last_date, "%Y-%m-%d")
    else:
        date = last_date
    
    # Get the market calendar
    calendar = mcal.get_calendar(market)
    
    # Get next valid session
    next_session = calendar.next_open(date)
    
    return next_session.strftime("%Y-%m-%d")


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def is_trading_day(
    date: Union[str, datetime],
    holidays: set = None
) -> bool:
    """
    Check if a given date is a valid trading day.
    
    Args:
        date: Date to check
        holidays: Set of holiday dates (defaults to NSE_HOLIDAYS_2024_2026)
    
    Returns:
        True if valid trading day, False otherwise
    """
    if holidays is None:
        holidays = NSE_HOLIDAYS_2024_2026
    
    if isinstance(date, str):
        date = datetime.strptime(date, "%Y-%m-%d")
    
    # Check weekend
    if date.weekday() in [5, 6]:
        return False
    
    # Check holiday
    if date.strftime("%Y-%m-%d") in holidays:
        return False
    
    return True


def get_next_n_trading_days(
    start_date: Union[str, datetime],
    n: int = 5,
    holidays: set = None
) -> List[str]:
    """
    Get the next N trading days from a start date.
    
    Args:
        start_date: Starting date
        n: Number of trading days to return
        holidays: Set of holiday dates
    
    Returns:
        List of next N trading days as strings
    
    Example:
        >>> get_next_n_trading_days("2024-12-13", n=5)
        ["2024-12-16", "2024-12-17", "2024-12-18", "2024-12-19", "2024-12-20"]
    """
    if holidays is None:
        holidays = NSE_HOLIDAYS_2024_2026
    
    if isinstance(start_date, str):
        current_date = datetime.strptime(start_date, "%Y-%m-%d")
    else:
        current_date = start_date
    
    trading_days = []
    
    while len(trading_days) < n:
        next_day = next_trading_day_with_holidays(current_date, holidays)
        trading_days.append(next_day)
        current_date = datetime.strptime(next_day, "%Y-%m-%d")
    
    return trading_days


# ============================================================================
# TEST CASES & EXAMPLES
# ============================================================================

def run_examples():
    """Run example cases showing all three implementations."""
    
    print("=" * 70)
    print("NEXT TRADING DAY CALCULATOR - EXAMPLES")
    print("=" * 70)
    
    test_cases = [
        ("2024-12-13", "Friday", "Weekend Case"),
        ("2024-03-29", "Good Friday", "Holiday Case"),
        ("2024-08-14", "Before Independence Day", "Holiday Edge Case"),
        ("2024-03-08", "Maha Shivaratri (Holiday)", "Day After Holiday"),
        ("2025-12-24", "Before Christmas", "Multi-day Holiday Gap"),
    ]
    
    print("\n" + "="*70)
    print("VERSION 1: SIMPLE (Weekend Only)")
    print("="*70)
    for date, day_info, case_name in test_cases:
        result = next_trading_day_simple(date)
        print(f"\n{case_name}")
        print(f"  Input:  {date} ({day_info})")
        print(f"  Output: {result}")
    
    print("\n\n" + "="*70)
    print("VERSION 2: WITH HOLIDAYS (Recommended for this app)")
    print("="*70)
    for date, day_info, case_name in test_cases:
        result = next_trading_day_with_holidays(date)
        print(f"\n{case_name}")
        print(f"  Input:  {date} ({day_info})")
        print(f"  Output: {result}")
    
    print("\n\n" + "="*70)
    print("UTILITY: Get Next 5 Trading Days")
    print("="*70)
    dates = get_next_n_trading_days("2024-12-13", n=5)
    print(f"\nStarting from: 2024-12-13 (Friday)")
    print(f"Next 5 trading days: {dates}")
    
    print("\n\n" + "="*70)
    print("UTILITY: Check if Date is Trading Day")
    print("="*70)
    check_dates = ["2024-12-16", "2024-12-14", "2024-03-29"]
    for check_date in check_dates:
        is_valid = is_trading_day(check_date)
        print(f"  {check_date}: {'✓ Trading Day' if is_valid else '✗ Not Trading Day'}")


if __name__ == "__main__":
    run_examples()
