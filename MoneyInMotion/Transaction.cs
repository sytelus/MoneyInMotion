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

namespace MoneyInMotion
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
        [DataMember] public string Id { get; private set; }
        [DataMember] public string RawData { get; private set; }
        [DataMember] public AccountInfo AccountInfo { get; private set; }
        [DataMember] public ImportInfo ImportInfo { get; private set; }
        [DataMember] public DateTime CreateDate { get; private set; }
        [DataMember] public string CreatedBy { get; private set; }
        [DataMember] public DateTime? UpdateDate { get; private set; }
        [DataMember] public string UpdatedBy { get; private set; }        
        
        private Transaction()
        {
            this.CreateDate = DateTime.UtcNow;
            this.CreatedBy = WindowsIdentity.GetCurrent().IfNotNull(i => i.Name);
        }

        public static Transaction CreateFromCsvLine(string[] headerColumns, string line, AccountInfo accountInfo, ImportInfo importInfo)
        {
            var transaction = new Transaction();
            transaction.RawData = line;
            transaction.ImportInfo = importInfo;
            transaction.AccountInfo = accountInfo;
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

            transaction.Id = Utils.GetMD5HashString(string.Join("\t", transaction.AccountInfo.Id, transaction.TransactionReason.ToString(),
                transaction.Amount.ToString(), transaction.EntityName.EmptyIfNull().ToUpperInvariant()
                , transaction.PostDate.ToStringNullSafe(), transaction.TransactionDate.ToStringNullSafe()));

            transaction.Validate();
            return transaction;
        }

        private void Validate()
        {
            var errors = string.Empty;
            if (this.ImportInfo == null)
                errors += "LocationHash must have value.";
            if (string.IsNullOrEmpty(this.AccountInfo.Id))
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
