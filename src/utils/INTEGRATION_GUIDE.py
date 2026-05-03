"""
INTEGRATION GUIDE: Using Next Trading Day in Your Stock Prediction App

This file shows how to integrate the nextTradingDay functions into your
ML prediction pipeline.
"""

# ============================================================================
# SETUP INSTRUCTIONS
# ============================================================================

"""
1. Copy nextTradingDay.py to: src/utils/nextTradingDay.py ✓ (Already done)

2. For production, install pandas_market_calendars:
   pip install pandas-market-calendars

3. Update your ML prediction model to use the new function
"""


# ============================================================================
# EXAMPLE 1: Simple Integration in Python Backend
# ============================================================================

from datetime import datetime
from nextTradingDay import next_trading_day_with_holidays

def generate_prediction(stock_data, last_market_date):
    """
    Generate ML prediction with correct next trading day.
    
    Args:
        stock_data: Historical OHLC data
        last_market_date: Last date with available market data (str: "YYYY-MM-DD")
    
    Returns:
        Prediction with correct next trading day
    """
    # Your ML model prediction logic here
    predicted_price = your_ml_model.predict(stock_data)
    
    # GET THE CORRECT NEXT TRADING DAY
    next_trading_day = next_trading_day_with_holidays(last_market_date)
    
    return {
        "prediction_date": next_trading_day,  # NOW CORRECT! ✓
        "predicted_price": predicted_price,
        "confidence": calculate_confidence(stock_data),
        "last_market_date": last_market_date
    }


# ============================================================================
# EXAMPLE 2: Integration with FastAPI/Flask Backend
# ============================================================================

from fastapi import FastAPI
from nextTradingDay import next_trading_day_with_holidays, is_trading_day

app = FastAPI()

@app.post("/predict")
def predict_endpoint(last_date: str):
    """
    Endpoint to get next prediction date and forecast.
    
    Request:
        POST /predict?last_date=2024-12-13
    
    Response:
        {
            "last_market_date": "2024-12-13",
            "next_trading_day": "2024-12-16",
            "predicted_change": +2.5,
            "prediction_timestamp": "2024-12-13T15:30:00Z"
        }
    """
    try:
        # Validate input date is a trading day
        if not is_trading_day(last_date):
            return {
                "error": f"{last_date} is not a trading day",
                "suggestion": f"Use trading day instead"
            }
        
        # Get next trading day for prediction
        next_day = next_trading_day_with_holidays(last_date)
        
        # Your prediction logic
        prediction = run_ml_prediction(last_date)
        
        return {
            "last_market_date": last_date,
            "next_trading_day": next_day,
            "predicted_change_percent": prediction["change"],
            "direction": "UP" if prediction["change"] > 0 else "DOWN",
            "confidence_score": prediction["confidence"]
        }
    except Exception as e:
        return {"error": str(e)}


# ============================================================================
# EXAMPLE 3: Integration with React Frontend
# ============================================================================

"""
If you want to do this client-side in React, use a JavaScript port:

Create: src/utils/nextTradingDay.js

export function nextTradingDaySimple(lastDate) {
  const date = new Date(lastDate);
  let nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Skip weekends
  while ([0, 6].includes(nextDay.getDay())) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay.toISOString().split('T')[0];
}

export function nextTradingDayWithHolidays(lastDate, holidays = NSE_HOLIDAYS) {
  const date = new Date(lastDate);
  let nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const dateStr = nextDay.toISOString().split('T')[0];
  
  // Skip weekends and holidays
  while ([0, 6].includes(nextDay.getDay()) || holidays.includes(dateStr)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay.toISOString().split('T')[0];
}
"""


# ============================================================================
# EXAMPLE 4: Real-World Use Case - Dashboard Update
# ============================================================================

def update_prediction_dashboard(ticker_symbol, last_data_date):
    """
    Update dashboard with ML prediction for next trading day.
    
    Before (WRONG):
        Last data: 2024-12-13 (Friday)
        Next prediction shows: 2024-12-14 (Saturday) ✗ INVALID!
    
    After (CORRECT):
        Last data: 2024-12-13 (Friday)
        Next prediction shows: 2024-12-16 (Monday) ✓ VALID!
    """
    from nextTradingDay import next_trading_day_with_holidays, get_next_n_trading_days
    
    # Get the CORRECT next trading day
    next_prediction_date = next_trading_day_with_holidays(last_data_date)
    
    # Get multiple forecasts for upcoming trading days
    forecast_dates = get_next_n_trading_days(last_data_date, n=5)
    
    # Run predictions for each date
    forecasts = []
    for pred_date in forecast_dates:
        pred = {
            "date": pred_date,
            "predicted_price": your_model.predict_for_date(pred_date),
            "confidence": calculate_confidence(pred_date),
            "day_of_week": get_day_name(pred_date)
        }
        forecasts.append(pred)
    
    dashboard_data = {
        "ticker": ticker_symbol,
        "last_market_data_date": last_data_date,
        "next_trading_day": next_prediction_date,
        "forecast_5days": forecasts,
        "generated_at": datetime.now().isoformat()
    }
    
    return dashboard_data


# ============================================================================
# EXAMPLE 5: Error Handling & Edge Cases
# ============================================================================

from nextTradingDay import (
    next_trading_day_with_holidays,
    is_trading_day,
    NSE_HOLIDAYS_2024_2026
)

def safe_get_next_trading_day(date_str):
    """Safely handle various date formats and edge cases."""
    
    try:
        # Edge Case 1: Date is None or empty
        if not date_str:
            from datetime import datetime
            date_str = datetime.now().strftime("%Y-%m-%d")
        
        # Edge Case 2: Date format is wrong
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD")
        
        # Edge Case 3: Date is already a holiday/weekend
        if not is_trading_day(date_str):
            print(f"⚠️  {date_str} is not a trading day. Finding next trading day...")
        
        next_day = next_trading_day_with_holidays(date_str)
        
        return {
            "input_date": date_str,
            "next_trading_day": next_day,
            "status": "success"
        }
    
    except Exception as e:
        return {
            "input_date": date_str,
            "error": str(e),
            "status": "error"
        }


# ============================================================================
# COMPARISON: BEFORE vs AFTER
# ============================================================================

"""
BEFORE (Incorrect):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last Market Data:    2024-12-13 (Friday)
Code:                next_day = last_date + timedelta(days=1)
Prediction Date:     2024-12-14 (SATURDAY) ✗ WRONG!

Last Market Data:    2024-03-29 (Good Friday - Holiday)
Code:                next_day = last_date + timedelta(days=1)
Prediction Date:     2024-03-30 (SATURDAY, also closed) ✗ WRONG!

User sees:           "Prediction for 2024-12-14" (but market is closed!)
Result:              Confusion, invalid analysis


AFTER (Correct):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last Market Data:    2024-12-13 (Friday)
Code:                next_day = next_trading_day_with_holidays(last_date)
Prediction Date:     2024-12-16 (MONDAY) ✓ CORRECT!

Last Market Data:    2024-03-29 (Good Friday - Holiday)
Code:                next_day = next_trading_day_with_holidays(last_date)
Prediction Date:     2024-04-01 (MONDAY, market open) ✓ CORRECT!

User sees:           "Prediction for 2024-12-16" (market WILL be open)
Result:              Accurate, trustworthy predictions
"""


# ============================================================================
# QUICK REFERENCE: Choose Your Approach
# ============================================================================

"""
USE THIS:                           WHEN:
────────────────────────────────────────────────────────────────────────

next_trading_day_simple()           • Testing/prototyping
                                    • Don't care about holidays
                                    • Just need weekday logic

next_trading_day_with_holidays()    • Production app (RECOMMENDED)
                                    • Accuracy matters
                                    • NSE holiday calendar included
                                    • No external dependencies

next_trading_day_with_calendar()    • Maximum accuracy needed
                                    • Real-time NSE data
                                    • Can install pandas_market_calendars
                                    • Building for enterprise
"""


# ============================================================================
# TESTING YOUR INTEGRATION
# ============================================================================

def test_integration():
    """Run these tests after integrating into your app."""
    
    test_cases = [
        # (input_date, expected_output, reason)
        ("2024-12-13", "2024-12-16", "Friday → skip weekend"),
        ("2024-12-14", "2024-12-16", "Saturday → Monday"),
        ("2024-03-29", "2024-04-01", "Good Friday → Monday"),
        ("2024-08-14", "2024-08-16", "Before Independence Day"),
        ("2024-03-08", "2024-03-11", "Maha Shivaratri holiday"),
    ]
    
    print("Running integration tests...\n")
    passed = 0
    failed = 0
    
    for input_date, expected, reason in test_cases:
        result = next_trading_day_with_holidays(input_date)
        status = "✓" if result == expected else "✗"
        
        if result == expected:
            passed += 1
        else:
            failed += 1
        
        print(f"{status} {input_date} → {result} (expected {expected})")
        print(f"   Reason: {reason}\n")
    
    print(f"Tests passed: {passed}/{len(test_cases)}")
    return failed == 0


if __name__ == "__main__":
    test_integration()
