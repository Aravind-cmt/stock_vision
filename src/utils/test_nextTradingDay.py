"""
TEST SUITE: Next Trading Day Calculator

Run this file to verify all functions work correctly:
    python src/utils/test_nextTradingDay.py
"""

import sys
from datetime import datetime
from nextTradingDay import (
    next_trading_day_simple,
    next_trading_day_with_holidays,
    is_trading_day,
    get_next_n_trading_days,
    NSE_HOLIDAYS_2024_2026
)


class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add(self, test_name, condition, details=""):
        status = "✓ PASS" if condition else "✗ FAIL"
        self.tests.append((status, test_name, details))
        if condition:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print("\n" + "="*80)
        print("TEST RESULTS")
        print("="*80)
        for status, test_name, details in self.tests:
            print(f"{status}: {test_name}")
            if details:
                print(f"        {details}")
        
        print("\n" + "="*80)
        print(f"Total: {self.passed} passed, {self.failed} failed")
        print("="*80 + "\n")
        
        return self.failed == 0


def test_simple_version():
    """Test VERSION 1: Simple (Weekend Only)"""
    print("\n" + "="*80)
    print("TEST 1: SIMPLE VERSION (Weekend Only)")
    print("="*80)
    
    results = TestResults()
    
    # Test: Friday should go to Monday
    result = next_trading_day_simple("2024-12-13")
    results.add(
        "Friday → Monday",
        result == "2024-12-16",
        f"Input: 2024-12-13 (Fri) → Output: {result}"
    )
    
    # Test: Saturday should go to Monday
    result = next_trading_day_simple("2024-12-14")
    results.add(
        "Saturday → Monday",
        result == "2024-12-16",
        f"Input: 2024-12-14 (Sat) → Output: {result}"
    )
    
    # Test: Sunday should go to Monday
    result = next_trading_day_simple("2024-12-15")
    results.add(
        "Sunday → Monday",
        result == "2024-12-16",
        f"Input: 2024-12-15 (Sun) → Output: {result}"
    )
    
    # Test: Monday should stay Monday
    result = next_trading_day_simple("2024-12-16")
    results.add(
        "Monday → Tuesday",
        result == "2024-12-17",
        f"Input: 2024-12-16 (Mon) → Output: {result}"
    )
    
    # Test: Weekday should return next weekday
    result = next_trading_day_simple("2024-12-17")
    results.add(
        "Wednesday → Thursday",
        result == "2024-12-18",
        f"Input: 2024-12-17 (Wed) → Output: {result}"
    )
    
    return results


def test_with_holidays():
    """Test VERSION 2: With NSE Holidays"""
    print("\n" + "="*80)
    print("TEST 2: WITH HOLIDAYS VERSION (NSE Calendar)")
    print("="*80)
    
    results = TestResults()
    
    # Test: Good Friday (holiday) should skip to Monday
    result = next_trading_day_with_holidays("2024-03-29")
    results.add(
        "Good Friday (holiday) → Monday",
        result == "2024-04-01",
        f"Input: 2024-03-29 (Good Friday) → Output: {result}"
    )
    
    # Test: Before Independence Day
    result = next_trading_day_with_holidays("2024-08-14")
    results.add(
        "Before Independence Day → Skip holiday",
        result == "2024-08-16",
        f"Input: 2024-08-14 (Wed, before holiday) → Output: {result}"
    )
    
    # Test: Maha Shivaratri
    result = next_trading_day_with_holidays("2024-03-08")
    results.add(
        "Maha Shivaratri (holiday) → Next trading day",
        result == "2024-03-11",
        f"Input: 2024-03-08 (Fri, holiday) → Output: {result}"
    )
    
    # Test: Before Diwali
    result = next_trading_day_with_holidays("2024-10-31")
    results.add(
        "Diwali Day 1 (holiday) → Next trading day",
        result == "2024-11-04",
        f"Input: 2024-10-31 (Thu, holiday) → Output: {result}"
    )
    
    # Test: Christmas
    result = next_trading_day_with_holidays("2024-12-24")
    results.add(
        "Before Christmas → Skip holiday",
        result == "2024-12-26",
        f"Input: 2024-12-24 (Tue) → Output: {result}"
    )
    
    # Test: Regular Friday (no holiday)
    result = next_trading_day_with_holidays("2024-12-13")
    results.add(
        "Regular Friday → Monday (no special holiday)",
        result == "2024-12-16",
        f"Input: 2024-12-13 (Fri, no holiday) → Output: {result}"
    )
    
    return results


def test_is_trading_day():
    """Test is_trading_day() function"""
    print("\n" + "="*80)
    print("TEST 3: IS_TRADING_DAY() FUNCTION")
    print("="*80)
    
    results = TestResults()
    
    # Test: Monday is trading day
    result = is_trading_day("2024-12-16")
    results.add(
        "Monday is trading day",
        result == True,
        f"2024-12-16 (Monday): {result}"
    )
    
    # Test: Saturday is NOT trading day
    result = is_trading_day("2024-12-14")
    results.add(
        "Saturday is NOT trading day",
        result == False,
        f"2024-12-14 (Saturday): {result}"
    )
    
    # Test: Sunday is NOT trading day
    result = is_trading_day("2024-12-15")
    results.add(
        "Sunday is NOT trading day",
        result == False,
        f"2024-12-15 (Sunday): {result}"
    )
    
    # Test: Good Friday (holiday) is NOT trading day
    result = is_trading_day("2024-03-29")
    results.add(
        "Good Friday (holiday) is NOT trading day",
        result == False,
        f"2024-03-29 (Good Friday): {result}"
    )
    
    # Test: Regular Wednesday is trading day
    result = is_trading_day("2024-12-18")
    results.add(
        "Wednesday is trading day",
        result == True,
        f"2024-12-18 (Wednesday): {result}"
    )
    
    return results


def test_get_next_n_trading_days():
    """Test get_next_n_trading_days() function"""
    print("\n" + "="*80)
    print("TEST 4: GET_NEXT_N_TRADING_DAYS() FUNCTION")
    print("="*80)
    
    results = TestResults()
    
    # Test: Get next 5 trading days from Friday
    result = get_next_n_trading_days("2024-12-13", n=5)
    expected = ["2024-12-16", "2024-12-17", "2024-12-18", "2024-12-19", "2024-12-20"]
    results.add(
        "Get next 5 trading days from Friday",
        result == expected,
        f"Output: {result}"
    )
    
    # Test: All returned dates are weekdays
    all_weekdays = all(
        datetime.strptime(d, "%Y-%m-%d").weekday() < 5
        for d in result
    )
    results.add(
        "All returned dates are weekdays",
        all_weekdays,
        f"Verified {len(result)} dates are Mon-Fri"
    )
    
    # Test: Get 10 trading days (longer sequence)
    result = get_next_n_trading_days("2024-12-13", n=10)
    results.add(
        "Get 10 trading days",
        len(result) == 10,
        f"Got {len(result)} dates"
    )
    
    return results


def test_edge_cases():
    """Test edge cases and error handling"""
    print("\n" + "="*80)
    print("TEST 5: EDGE CASES & ERROR HANDLING")
    print("="*80)
    
    results = TestResults()
    
    # Test: Datetime object input (not just string)
    from datetime import datetime as dt
    date_obj = dt(2024, 12, 13)
    result = next_trading_day_with_holidays(date_obj)
    results.add(
        "Accept datetime object as input",
        result == "2024-12-16",
        f"Input: datetime(2024, 12, 13) → Output: {result}"
    )
    
    # Test: Holiday at month boundary
    result = next_trading_day_with_holidays("2024-03-29")
    results.add(
        "Holiday at month/year boundary",
        result == "2024-04-01",
        f"March 29 → April 1 (skips weekend)"
    )
    
    # Test: Multiple holidays in sequence
    # (There shouldn't be continuous holidays, but test the loop)
    result = next_trading_day_with_holidays("2024-12-20")
    is_valid = datetime.strptime(result, "%Y-%m-%d").weekday() < 5
    results.add(
        "Handles potential multi-day gaps",
        is_valid,
        f"Result {result} is a weekday"
    )
    
    # Test: Holiday list is not empty
    results.add(
        "NSE holidays loaded",
        len(NSE_HOLIDAYS_2024_2026) > 0,
        f"Loaded {len(NSE_HOLIDAYS_2024_2026)} holidays"
    )
    
    return results


def run_all_tests():
    """Run all test suites"""
    print("\n")
    print("╔" + "="*78 + "╗")
    print("║" + " "*20 + "NEXT TRADING DAY - TEST SUITE" + " "*30 + "║")
    print("╚" + "="*78 + "╝")
    
    all_results = [
        test_simple_version(),
        test_with_holidays(),
        test_is_trading_day(),
        test_get_next_n_trading_days(),
        test_edge_cases()
    ]
    
    total_passed = sum(r.passed for r in all_results)
    total_failed = sum(r.failed for r in all_results)
    
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    print(f"✓ Total Passed: {total_passed}")
    print(f"✗ Total Failed: {total_failed}")
    print("="*80 + "\n")
    
    if total_failed == 0:
        print("🎉 ALL TESTS PASSED! Your trading day calculator is ready to use.\n")
        return True
    else:
        print(f"⚠️  {total_failed} test(s) failed. Please review the output above.\n")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
