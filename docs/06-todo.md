# MoneyInMotion - TODO Items

## P0 - Must Do

### Finish In-Progress Features

1. **Complete Account Management Page**
   - The Accounts page is currently a placeholder
   - Implement account list display with edit/delete capability
   - Implement account creation form with validation
   - Display import status per account (last import date, transaction count)

2. **Complete Settings Page**
   - The Settings page is currently a placeholder
   - Implement data path configuration form
   - Display current configuration values (data path, statements dir, merged dir)
   - Add port configuration option

3. **Implement Transaction Editing UI**
   - Category edit dialog with autocomplete and scope filter configuration
   - Note edit dialog
   - Flag toggle action
   - Attribute fix dialog (reason, entity name, amount)
   - Bulk edit confirmation showing affected transaction count

4. **Multi-User Audit Identity**
   - The server currently attributes all audit records to the OS user running
     the process (via `setDefaultAuditUser(os.userInfo().username)` at
     startup).
   - When MoneyInMotion is used by multiple users sharing a server, the audit
     trail should instead reflect the authenticated end user. This requires
     adding authentication to the API and threading the user identity through
     each request.

---

## P1 - High Priority Features

5. **Search Functionality**
   - Full-text search across entity names, notes, and categories
   - Search by amount, date range, or account
   - Highlight matching transactions in the list

6. **Support New Amex CSV Format**
   - American Express has changed their CSV export format
   - Verify and update the AmexParser for the new column layout

7. **Category Editor UI**
   - Dedicated UI for managing the category hierarchy
   - Ability to rename, merge, and reorganize categories
   - Category usage statistics (transaction count per category)

8. **Rules/Edits Editor UI**
   - View all existing edit rules
   - Edit or delete existing rules
   - See which transactions are affected by each rule
   - Filter rules by scope type, field, or target entity

9. **Transaction Splitting**
   - Split a single transaction into multiple categories
   - Common need: grocery trip with both food and household items
   - Child transactions that sum to parent amount

---

## P2 - Medium Priority Features

10. **Budgeting System**
    - Set spending limits by category or entity
    - Track actual vs. budget by month/quarter/year
    - Visual indicators when approaching or exceeding budget

11. **Column Sorting and Filtering**
    - Make transaction columns sortable (by amount, date, entity)
    - Add filter capability on the transaction list
    - Leverage @tanstack/react-table for column features

12. **Show Total Deficit/Savings**
    - Display running totals for month, quarter, and year
    - Show savings rate (income - expenses / income)
    - Historical trend visualization

13. **Entity Historical Stats**
    - Show previous charges and trends for a given entity
    - "You spent $X at Amazon last month, $Y this month"
    - Frequency of purchases from each merchant

14. **Remember Last Selection**
    - Persist last selected year/month across page loads
    - Persist expanded group state in localStorage
    - Restore scroll position on navigation

15. **Flat View with Sort and Filter**
    - Toggle between hierarchical grouped view and flat list view
    - Full sort/filter capability on all columns in flat view

16. **Mobile Responsive Layout**
    - The left and right sidebars are hidden on small screens but no alternative navigation is provided
    - Add mobile navigation (hamburger menu, bottom sheet, or tabs)
    - Responsive transaction row layout for narrow viewports

---

## Known Issues

### P1 - Should Fix

17. **Non-Zero Total Transfers**
    - Inter-account transfers should net to zero
    - Some unmatched transfers remain, causing non-zero totals
    - Investigate matching algorithm edge cases

18. **Edit Scope Validation**
    - Empty category name allowed when creating edit rules
    - No validation on scope filter parameters from user input
    - Could create invalid edits that silently fail

### P2 - Nice to Fix

19. **Selected Month Highlight**
    - Currently selected month should be visually highlighted in the YearMonthNav sidebar
    - Active state styling needed in the accordion

---

## Technical Improvements

### P2 - Code Quality

20. **Expand Test Coverage**
    - Core domain logic needs comprehensive unit tests (matching, edit application, aggregation)
    - Server API endpoints need integration tests
    - Web components need component tests with @testing-library/react

21. **Remove Hardcoded Values**
    - Transfer day tolerance hardcoded to 3 days
    - Amount tolerance hardcoded in parent-child matcher
    - These should be configurable per account via AccountConfig

22. **Add Transaction Source Tracking**
    - Track how each transaction was created: Import, Synthetic, Adjustment, Manual
    - Helps debugging matching and deduplication issues

23. **Improve PayPal Parser Robustness**
    - Current timezone handling is fragile
    - Ignorable activity list may be incomplete
    - Consider supporting PayPal API export format

24. **API Error Responses**
    - Standardize error response format across all endpoints
    - Include request ID for debugging
    - Add structured error codes beyond HTTP status

25. **Production Deployment**
    - Add Dockerfile for containerized deployment
    - Add environment variable documentation for production configuration
    - Add health check endpoint
