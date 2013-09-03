using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Claims;
using System.Security.Principal;
using System.Text;
using CommonUtils;

namespace MoneyAI
{
    public enum TransactionReason
    {
        Purchase, Adjustment, Fee, Payment, Return
    }

    [DataContract]
    public class Transaction
    {
        [DataMember] public TransactionReason TransactionReason { get; private set; }
        [DataMember] public DateTime? TransactionDate { get; private set; }
        [DataMember] public DateTime? PostDate { get; private set; }
        [DataMember] public string EntityName { get; private set; }
        [DataMember] public decimal? Amount { get; private set; }
        [DataMember] public string ContentHash { get; private set; }
        [DataMember] public string RawData { get; private set; }
        [DataMember] public string AccountId { get; private set; }
        [DataMember] public string ImportId { get; private set; }
        [DataMember] public DateTime CreateDate { get; private set; }
        [DataMember] public string CreatedBy { get; private set; }
        [DataMember] public DateTime? UpdateDate { get; private set; }
        [DataMember] public string UpdatedBy { get; private set; }       
        [DataMember] public string Id { get; private set; }       
        [DataMember] public int LineNumber { get; private set; }       
        
        private Transaction()
        {
            this.CreateDate = DateTime.UtcNow;
            this.CreatedBy = WindowsIdentity.GetCurrent().IfNotNull(i => i.Name);
        }

        public static Transaction CreateFromCsvLine(string[] headerColumns, string line, string accountId, string importId, int lineNumber)
        {
            var transaction = new Transaction();
            transaction.RawData = line;
            transaction.ImportId = importId;
            transaction.AccountId = accountId;
            var columns = Utils.ParseCsvLine(line).ToArray();
            for (var columnIndex = 0; columnIndex < headerColumns.Length; columnIndex++)
            {
                var headerColumn = headerColumns[columnIndex];
                var columnValue = columns[columnIndex];
                switch (headerColumn)
                {
                    case "Type":
                        transaction.TransactionReason = GetTransactionType(columnValue); break;
                    case "Trans Date":
                        transaction.TransactionDate = DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal); break;
                    case "Post Date":
                        transaction.PostDate = DateTime.Parse(columnValue, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal); break;
                    case "Description":
                        transaction.EntityName = columnValue; break;
                    case "Amount":
                        transaction.Amount = Decimal.Parse(columnValue, NumberStyles.Currency); break;
                    default:
                        throw new Exception("Heade column '{0}' is not recognized".FormatEx(headerColumn));
                }
            }
            transaction.LineNumber = lineNumber;
            transaction.ContentHash = Utils.GetMD5HashString(string.Join("\t", transaction.GetContent()));
            transaction.Id = Utils.GetMD5HashString(string.Join("\t", transaction.GetContent().Concat(lineNumber.ToStringInvariant())));

            transaction.Validate();
            return transaction;
        }

        private IEnumerable<string> GetContent()
        {
            return Utils.AsEnumerable(
                this.AccountId, this.TransactionReason.ToString(),
                this.Amount.ToString(), this.EntityName.EmptyIfNull().ToUpperInvariant()
                , this.PostDate.ToStringNullSafe(), this.TransactionDate.ToStringNullSafe());
        }

        private void Validate()
        {
            var errors = string.Empty;
            if (this.ImportId == null)
                errors += "LocationHash must have value.";
            if (string.IsNullOrEmpty(this.AccountId))
                errors += "AccountInfo.Id must have value.";
            if (this.Amount == null)
                errors += "Amount must have value.";
            if (this.PostDate == null && this.TransactionDate == null)
                errors += "Either PostDate Or TransactionDate must have value.";
            if (string.IsNullOrEmpty(this.EntityName))
                errors += "EntityName must have value.";

            if (!string.IsNullOrEmpty(errors))
                throw new InvalidDataException(errors);
        }

        private static TransactionReason GetTransactionType(string rawTransactionType)
        {
            switch (rawTransactionType.ToUpperInvariant())
            {
                case "SALE":
                    return TransactionReason.Purchase;
                case "PAYMENT":
                    return TransactionReason.Payment;
                case "ADJUSTMENT":
                    return TransactionReason.Adjustment;
                case "RETURN":
                    return TransactionReason.Return;
                case "FEE":
                    return TransactionReason.Fee;
                default:
                    throw new ArgumentException("rawTransactionType {0} is not known".FormatEx(rawTransactionType), "rawTransactionType");
            }
        }

        public string SerializeToJson()
        {
            return JsonSerializer<Transaction>.Serialize(this);
        }
        public static Transaction DeserializeFromJson(string serializedTransaction)
        {
            return JsonSerializer<Transaction>.Deserialize(serializedTransaction);
        }
    }
}
