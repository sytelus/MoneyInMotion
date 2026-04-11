# MoneyInMotion - High Priority TODO Items

## Critical: Modernization

### P0 - Must Do for Continued Use

1. **Fix git:// Protocol URLs in bower.json**
   - GitHub disabled unencrypted git:// protocol in 2022
   - Change all `git://github.com/...` to `https://github.com/...` in `MoneyAI.JS/bower.json`
   - Affected packages: knockoutjs, buckets, jquery.ba-bbq, jquery.hotkeys, typeahead-less

2. **Update Node.js Compatibility**
   - Current `package.json` specifies `node >= 0.8.0` (ancient)
   - Grunt plugins from 2013 may not work with Node.js 20+
   - Test with Node.js 16 LTS as a compatibility baseline
   - Consider updating grunt and plugins to latest versions

3. **Fix Hardcoded User Identity**
   - `MoneyAI.WebApi/Controllers/TransactionsController.cs` hardcodes user as `"sytelus"`
   - `MoneyAI.JS/js/userProfile.js` hardcodes user as `"test@gmail.com"`
   - Implement proper user authentication or configuration

4. **Migrate from Bower to npm**
   - Bower has been deprecated since 2017
   - Move all bower dependencies to npm packages or include as vendored files
   - Update RequireJS paths configuration accordingly

### P1 - Should Do Soon

5. **Upgrade .NET Framework Target**
   - Current: .NET Framework 4.5 (end-of-life since April 2022)
   - Recommended: Migrate to .NET 6+ or .NET 8 (LTS)
   - This would require migrating from ASP.NET Web API to ASP.NET Core
   - The domain layer (MoneyAI) has minimal framework dependencies and should port easily

6. **Update NuGet Package Versions**
   - Newtonsoft.Json 5.0.8 -> 13.x (many bug fixes and security patches)
   - RestSharp 104.4.0 -> 110.x (complete rewrite, breaking API changes)
   - ASP.NET packages 5.0.0 -> latest compatible versions (or migrate to ASP.NET Core)

7. **Update JavaScript Library Versions**
   - jQuery 1.10.2 -> 3.x (security fixes, performance improvements)
   - Bootstrap 3.x -> 5.x (major UI improvements, no jQuery dependency)
   - lodash 2.2.1 -> 4.x (breaking changes in API)
   - moment.js -> dayjs or Luxon (moment.js is in maintenance mode)

8. **Add Proper Error Handling to Web API**
   - Current error handling is minimal
   - Add global exception handler
   - Return proper HTTP status codes
   - Add request validation

---

## Feature Gaps (from FeaturesToDo.html)

### P1 - High Priority Features

9. **Search Functionality**
   - No search capability exists in the web UI
   - Users need to find specific transactions by name, amount, or date
   - Should support full-text search across entity names and notes

10. **Support New Amex CSV Format**
    - American Express has changed their CSV export format
    - Current parser may not handle the new column layout
    - File extension `.newcsv` was planned

11. **Category Editor UI**
    - No dedicated UI for managing the category hierarchy
    - Users can only set categories through transaction edits
    - Need ability to rename, merge, and reorganize categories

12. **Rules/Edits Editor UI**
    - No way to view, edit, or delete existing edit rules
    - Users cannot see which rules are applied to which transactions
    - Need a dedicated rules management interface

13. **Transaction Splitting**
    - No ability to split a single transaction into multiple categories
    - Common need: grocery trip with both food and household items
    - Requires creating child transactions that sum to parent amount

### P2 - Medium Priority Features

14. **Budgeting System**
    - Set spending limits by category or entity
    - Track actual vs. budget by month/quarter/year
    - Alert when approaching or exceeding budget

15. **Column Sorting and Filtering**
    - Transaction columns are not sortable
    - No filter capability on the transaction list
    - Standard data grid features expected by users

16. **Show Total Deficit/Savings**
    - Display running totals for month, quarter, and year
    - Show savings rate (income - expenses / income)
    - Historical trend visualization

17. **Entity Historical Stats**
    - Show previous charges and trends for a given entity
    - "You spent $X at Amazon last month, $Y this month"
    - Frequency of purchases from each merchant

18. **Remember Last Selection**
    - Currently resets to default view on page load
    - Should remember last selected year/month
    - Persist view state (expanded groups, scroll position)

19. **Flat View with Sort and Filter**
    - Option to view all transactions without hierarchy
    - Full sort/filter capability on all columns
    - Toggle between grouped and flat views

20. **Quick Selection UI**
    - "Only these" button to quickly filter to specific transactions
    - Filter by selected entity name, category, or rule

---

## Known Bugs

### P1 - Should Fix

21. **App Pool Restart Required After Data Overwrite**
    - FileSystemWatcher may not detect all file changes
    - Manual IIS app pool restart needed after external data changes
    - May be related to watcher buffer overflow or timing issue

22. **Transaction Grid Display Bug (< 1000px)**
    - Transaction grid doesn't render properly on viewports less than ~1000px wide
    - Bootstrap responsive breakpoints not configured for the grid
    - Affects tablet and small laptop screens

23. **Non-Zero Total Transfers**
    - Inter-account transfers should net to zero
    - Some unmatched transfers remain, causing non-zero totals
    - Investigate matching algorithm edge cases

24. **Edit Scope Validation**
    - Empty category name allowed when creating edit rules
    - No validation on scope filter parameters from user input
    - Could create invalid edits that silently fail

### P2 - Nice to Fix

25. **Chrome Cache Issue**
    - Chrome doesn't refresh HTML even when file is changed on IIS
    - May need cache-busting query parameters on static files
    - Add build-time hash to file references

26. **Selected Month/Year Highlight**
    - Currently selected month is not visually highlighted in navigation
    - CSS class not being applied to the active month pill

---

## Technical Debt

### P2 - Code Improvements

27. **Clean Up TransactionAggregator**
    - Current implementation uses callback chains
    - Should be refactored to iterative code for readability
    - Referenced in FeaturesToDo.html as existing item

28. **Remove Hardcoded Values**
    - Transfer day tolerance hardcoded to 3 days
    - Amount tolerance hardcoded in parent-child matcher
    - These should be configurable per account

29. **Add Unit Tests for Core Logic**
    - Only CommonUtils has test coverage
    - MoneyAI core domain has no unit tests
    - Transaction matching, edit application, and parsing need tests

30. **Add Transaction Source Tracking**
    - Track how each transaction was created: Import, Synthetic, Adjustment, Manual
    - Helps debugging matching and deduplication issues

31. **Improve PayPal Parser Robustness**
    - Current timezone handling is fragile
    - Ignorable activity list may be incomplete
    - Consider using PayPal API instead of CSV export
