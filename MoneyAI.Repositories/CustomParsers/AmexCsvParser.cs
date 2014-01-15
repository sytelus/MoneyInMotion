using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories.CustomParsers
{
    internal class AmexCsvParser : CsvTransactionFileParser
    {
        public AmexCsvParser(string csvFilePath): base(csvFilePath)
        {

        }

        protected override void TransformHeaderColumnNames(string[] columns, out string[] headerColumnsTransformed, out string[] dataColumns)
        {
            headerColumnsTransformed = new string[] { "transaction date", "amex reference", "amount",  "description", "other info"};
            dataColumns = columns;
        }

        protected override void SetCalculatedAttributes(Transaction.ImportedValues importedValues)
        {
            base.SetCalculatedAttributes(importedValues);

            string phoneNumber, categoryName;
            ExtractOtherInfo(importedValues.ProviderAttributes["other info"], out phoneNumber, out categoryName);

            importedValues.PhoneNumber = phoneNumber;
            importedValues.ProviderCategoryName = categoryName;
            importedValues.Address = ExtractAddress(importedValues.EntityName);
            importedValues.InstituteReference = ExtractReferenceNumber(importedValues.ProviderAttributes["amex reference"]);
        }

        protected override TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues)
        {
            var entityName = importedValues.EntityName;
            var amount = importedValues.Amount.Value;
            if (amount > 0 && entityName != null && entityName.IndexOf("AUTOPAY PAYMENT", StringComparison.InvariantCultureIgnoreCase) >= 0)
                return TransactionReason.InterAccountPayment;
            else 
                return base.InferTransactionReason(importedValues);
        }

        static readonly string[] multiSpaceDelimiter = new string[] { "  " };
        private void ExtractOtherInfo(string columnValue, out string phoneNumber, out string categoryName)
        {
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
