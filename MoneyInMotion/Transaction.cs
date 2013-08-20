using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using CommonUtils;

namespace MoneyInMotion
{
    public class Transaction
    {
        public string TransactionType { get; private set; }
        public DateTime? TransactionDate { get; private set; }
        public DateTime? PostDate { get; private set; }
        public string EntityName { get; private set; }
        public decimal Amount { get; private set; }
        public string ID { get; private set; }
        public string RawLine { get; private set; }
        public string AccountName { get; private set; }
    
        public Transaction(string[] headerColumns, string line, string accountName)
        {
            this.RawLine = line;
            AccountName = accountName;
            var columns = Utils.ParseCsvLine(line).ToArray();
            for (var columnIndex = 0; columnIndex < headerColumns.Length; columnIndex++)
            {
                var headerColumn = headerColumns[columnIndex];
                string columnValue = columns[columnIndex];
                switch (headerColumn)
                {
                    case "Type":
                        this.TransactionType = columnValue; break;
                    case "Trans Date":
                        this.TransactionDate = DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal); break;
                    case "Post Date":
                        this.PostDate = DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal); break;
                    case "Description":
                        this.EntityName = columnValue; break;
                    case "Amount":
                        this.Amount = Decimal.Parse(columnValue, NumberStyles.Currency); break;
                    default:
                        throw new Exception("Heade column '{0}' is not recognized".FormatEx(headerColumn));
                }
            }

            this.ID = Utils.GetMD5HashString(string.Join("\t", accountName.Trim().ToUpperInvariant(), line.Trim().ToUpperInvariant()));
        }
    }
}
