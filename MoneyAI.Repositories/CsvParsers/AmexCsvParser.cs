using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories.CsvParsers
{
    internal class AmexCsvParser : CsvParserBase
    {
        protected override HeaderColumn[] GetHeaderColumns(string[] columns, out string[] transformedColumns)
        {
            transformedColumns = this.TransformColumns(columns);   //Amex does not have header

            var columnTypes = new CsvColumnType[] { CsvColumnType.TransactionDate, CsvColumnType.InstituteReference, CsvColumnType.Amount, 
                CsvColumnType.EntityName, CsvColumnType.Address, CsvColumnType.PhoneNumber, CsvColumnType.ProviderCategoryName, CsvColumnType.ProviderAttribute
                , CsvColumnType.TransactionReason};

            return columnTypes.Select(t => new HeaderColumn { ColumnType = t, ColumnName = t.ToString() }).ToArray();
        }

        protected override string[] TransformColumns(string[] columns)
        {
            string phoneNumber, categoryName, otherInfo;
            ExtractOtherInfo(columns[4], out phoneNumber, out categoryName, out otherInfo);

            var transformedColumns = new string[] 
            {
                columns[0], ExtractReferenceNumber(columns[1]), columns[2], columns[3], ExtractAddress(columns[3]), phoneNumber, categoryName, otherInfo,
                null
            };

            return transformedColumns;
        }

        protected override TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues, string[] columnValues)
        {
            var entityName = importedValues.EntityName;
            var amount = importedValues.Amount.Value;
            if (amount > 0 && entityName != null && entityName.IndexOf("AUTOPAY PAYMENT", StringComparison.InvariantCultureIgnoreCase) >= 0)
                return TransactionReason.InterAccountPayment;
            else 
                return base.InferTransactionReason(importedValues, columnValues);
        }

        static readonly string[] multiSpaceDelimiter = new string[] { "  " };
        private void ExtractOtherInfo(string columnValue, out string phoneNumber, out string categoryName, out string otherInfo)
        {
            otherInfo = columnValue;
            phoneNumber = null;
            categoryName = null;
            if (columnValue != null)
            {
                var parts = columnValue.Split(multiSpaceDelimiter, StringSplitOptions.RemoveEmptyEntries).Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
                if (parts.Length == 2)
                {
                    if (parts[1].Any(c => Char.IsLetter(c)))
                        categoryName = parts[1];
                    else if (parts[1].Any(c => Char.IsDigit(c) || c == '-'))
                        phoneNumber = parts[1];
                }
            }
        }

        private string ExtractAddress(string columnValue)
        {
            return null;
        }

        static readonly string[] referencePrefix = new string[] { "Reference: " };
        private static string ExtractReferenceNumber(string columnValue)
        {
            if (columnValue != null)
            {
                var parts = columnValue.Split(referencePrefix, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 2)
                    return parts[1];
                else
                    return null;
            }
            else return null;
        }
    }
}
