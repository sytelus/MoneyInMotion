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
        [DataMember(IsRequired = true)]
        public TransactionReason TransactionReason { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public DateTime? TransactionDate { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public DateTime? PostDate { get; private set; }

        [DataMember(IsRequired = true)]
        public string EntityName { get; private set; }

        [DataMember(IsRequired = true)]
        public decimal? Amount { get; private set; }

        [DataMember(IsRequired = true)]
        public string ContentHash { get; private set; }

        [DataMember(IsRequired = true)]
        public string AccountId { get; private set; }

        [DataMember(IsRequired = true)]
        public string ImportId { get; private set; }

        [DataMember(IsRequired = true)]
        public AuditInfo AuditInfo { get; private set; }

        [DataMember(IsRequired = true)] 
        public string Id { get; private set; }       

        [DataMember(IsRequired = true)] 
        public int LineNumber { get; private set; }     

        [DataMember(EmitDefaultValue = false)] 
        public string[] CategoryPath { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public Correction UserCorrection { get; private set; }

        [DataMember(EmitDefaultValue = false)]
        public IDictionary<int,string> Edits { get; private set; }

        [DataMember(EmitDefaultValue = false)] private int editSequenceNumber;

        private string cachedEntityNameNormalized = null;
        public string EntityNameNormalized
        {
            get
            {
                if (cachedEntityNameNormalized == null)
                    cachedEntityNameNormalized = GetEntityNameNormalized(this.EntityName) ?? string.Empty;

                return cachedEntityNameNormalized;
            }
        }

        private static string GetEntityNameNormalized(string entityName)
        {
            entityName = entityName ?? string.Empty;
            var cleanedName = Utils.RemoveNonAlphaNumericChars(entityName);
            if (cleanedName.Length == 0)
                cleanedName = entityName.Trim();

            return cleanedName.ToTitleCase();
        }

        [DataContract]
        public class Correction
        {
            [DataMember(EmitDefaultValue = false)]
            public TransactionReason? TransactionReason { get; internal set; }
            [DataMember(EmitDefaultValue = false)]
            public DateTime? TransactionDate { get; internal set; }
            [DataMember(EmitDefaultValue = false)]
            public decimal? Amount { get; internal set; }
            [DataMember(EmitDefaultValue = false)]
            public string EntityName { get; internal set; }

            internal IEnumerable<string> GetContent()
            {
                return Utils.AsEnumerable(
                    this.TransactionReason.ToStringNullSafe(),
                    this.Amount.ToStringNullSafe(), this.EntityName.EmptyIfNull().ToUpperInvariant(),
                    this.TransactionDate.ToStringNullSafe());
            }
        }

        private void ApplyCategoryPath(string[] categoryPath)
        {
            if (categoryPath != null && categoryPath.Length == 0)
                this.CategoryPath = null;
            else
                this.CategoryPath = categoryPath;
        }

        private void ApplyCorrection(Correction correction, Correction overlayOnCorrection = null)
        {
            this.UserCorrection = this.UserCorrection ?? new Correction();
            this.UserCorrection.TransactionDate = correction.TransactionDate ?? overlayOnCorrection.IfNotNull(c => c.TransactionDate);
            this.UserCorrection.TransactionReason = correction.TransactionReason ?? overlayOnCorrection.IfNotNull(c => c.TransactionReason);
            this.UserCorrection.Amount = correction.Amount ?? overlayOnCorrection.IfNotNull(c => c.Amount);
            this.UserCorrection.EntityName = correction.EntityName ?? overlayOnCorrection.IfNotNull(c => c.EntityName);
        }

        public void ApplyEdit(TransactionEdit edit)
        {
            if (edit.CategoryPath != null)
            {
                this.ApplyCategoryPath(edit.CategoryPath);
                this.AddEdit(edit);
            }

            if (edit.UserCorrection != null)
            {
                this.ApplyCorrection(edit.UserCorrection);
                this.AddEdit(edit);
            }
        }

        private void AddEdit(TransactionEdit edit)
        {
            this.Edits = this.Edits ?? new Dictionary<int, string>();
            this.editSequenceNumber += 1;
            this.Edits.Add(this.editSequenceNumber, edit.ContentHash);
        }

        private Transaction()
        {
            this.AuditInfo = AuditInfo.Create();
        }

        public static Transaction CreateFromCsvLine(string[] headerColumns, string line, string accountId, string importId, int lineNumber)
        {
            var transaction = new Transaction();
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
        public static Transaction DeserializeFromJson(string serializedData)
        {
            return JsonSerializer<Transaction>.Deserialize(serializedData);
        }
    }
}
