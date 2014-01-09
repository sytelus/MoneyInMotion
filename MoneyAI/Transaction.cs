using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Claims;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using CommonUtils;

namespace MoneyAI
{
    [Flags]
    public enum TransactionReason
    {
        Purchase = 0, 
        Adjustment = 1, 
        Fee = 2, 
        InterAccountPayment = 4, 
        Return = 8,
        InterAccountTransfer = 16,
        PointsCredit = 32,
        OtherCredit = 64,
        CheckPayment = 128,
        CheckRecieved = 256,
        AtmWithdrawal = 512,
        Interest = 1024,
        LoanPayment = 2048,

        NetOutgoing = Purchase | Fee | CheckPayment | AtmWithdrawal | LoanPayment,
        NetIncoming = Return | PointsCredit | OtherCredit | CheckRecieved | Interest,
        NetInterAccount = InterAccountPayment | InterAccountTransfer
    }

    [DataContract]
    public partial class Transaction
    {
        [DataMember(IsRequired = true, Name = "transactionReason")]
        public TransactionReason TransactionReason { get; private set; }

        [DataMember(IsRequired = true, Name = "transactionDate")]
        public DateTime TransactionDate { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "postedDate")]
        public DateTime? PostedDate { get; private set; }

        [DataMember(IsRequired = true, Name = "entityName")]
        public string EntityName { get; private set; }

        [DataMember(IsRequired = true, Name = "amount")]
        public decimal Amount { get; private set; }

        [DataMember(IsRequired = true, Name = "contentHash")]
        public string ContentHash { get; private set; }

        [DataMember(IsRequired = true, Name = "accountId")]
        public string AccountId { get; private set; }

        [DataMember(IsRequired = true, Name = "importId")]
        public string ImportId { get; private set; }

        [DataMember(IsRequired = true, Name = "auditInfo")]
        public AuditInfo AuditInfo { get; private set; }

        [DataMember(IsRequired = true, Name = "id")] 
        public string Id { get; private set; }

        [DataMember(IsRequired = true, Name = "lineNumber")] 
        public int LineNumber { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "mergedEdit")]
        public TransactionEdit.EditedValues MergedEdit { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "appliedEditIdsDescending")]
        internal LinkedList<string> AppliedEditIdsDescending { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "entityNameNormalized")]
        public string EntityNameNormalized { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "entityNameTokens")]   //TODO: could be eliminated from serialization if OnDeserialized is handled
        public string[] EntityNameTokens { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "instituteReference")]
        public string InstituteReference { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "providerCategoryName")]
        public string ProviderCategoryName { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "phoneNumber")]
        public string PhoneNumber { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "address")]
        public string Address { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "subAccountName")]
        public string SubAccountName { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "otherInfo")]
        public string OtherInfo { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "accountNumber")]
        public string AccountNumber { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "checkReference")]
        public string CheckReference { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "providerAttributes")]
        public Dictionary<string, string> ProviderAttributes { get; set; }


        //Parent child properties
        [DataMember(EmitDefaultValue = false, Name = "requiresParent")]
        public bool RequiresParent { get; private set; }
        [DataMember(EmitDefaultValue = false, Name = "parentId")]
        public string ParentId { get; private set; }
        [DataMember(EmitDefaultValue = false, Name = "children")]
        private List<Transaction> children;
        public IEnumerable<Transaction> Children { get { return this.children; } }
        [DataMember(EmitDefaultValue = false, Name = "hasMissingChild")]
        public bool HasMissingChild { get; set; }


        public Transaction Clone()
        {
            //TODO: faster clonning
            var serializedData = JsonSerializer<Transaction>.Serialize(this);
            return JsonSerializer<Transaction>.Deserialize(serializedData);
        }

        //This is kept internal because otherwise edit won't get tracked
        internal void ApplyEdit(TransactionEdit edit)
        {
            if (this.MergedEdit == null)
            {
                this.MergedEdit = new TransactionEdit.EditedValues(edit.Values);
                this.AppliedEditIdsDescending = new LinkedList<string>();
            }
            else
                this.MergedEdit.Merge(edit.Values);

            this.InvalidateCachedValues();

            this.AuditInfo = new AuditInfo(this.AuditInfo, true);

            this.AppliedEditIdsDescending.AddItemFirst(edit.Id);
        }

        private void InvalidateCachedValues()
        {
            this.cachedDisplayCategory = null;
            this.cachedCategoryPath = null;
            this.cachedCorrectedTransactionDate = null;
        }

        public Transaction(string importId, AccountInfo accountInfo, int lineNumber, ImportedValues importedValues)
        {
            this.AuditInfo = new AuditInfo();

            this.ImportId = importId;
            this.AccountId = accountInfo.Id;
            this.RequiresParent = accountInfo.RequiresParent;

            importedValues.Validate();

            this.Amount = importedValues.Amount.Value;
            this.EntityName = importedValues.EntityName;
            this.EntityNameNormalized = importedValues.EntityNameNormalized ?? GetEntityNameNormalized(this.EntityName);
            this.EntityNameTokens = (this.EntityName ?? string.Empty).Split(null);
            this.PostedDate = importedValues.PostedDate;
            this.TransactionDate = importedValues.TransactionDate.Value;
            this.TransactionReason = importedValues.TransactionReason.Value;
            this.InstituteReference = importedValues.InstituteReference;
            this.ProviderCategoryName = importedValues.ProviderCategoryName;
            this.PhoneNumber = importedValues.PhoneNumber;
            this.Address = importedValues.Address;
            this.SubAccountName = importedValues.SubAccountName;
            this.OtherInfo = importedValues.OtherInfo;
            this.AccountNumber = importedValues.AccountNumber;
            this.CheckReference = importedValues.CheckReference;
            this.ProviderAttributes = importedValues.ProviderAttributes;

            this.LineNumber = lineNumber;
            this.ContentHash = Utils.GetMD5HashString(string.Join("\t", this.GetContent()), true);
            this.Id = Utils.GetMD5HashString(string.Join("\t", this.GetContent().Concat(lineNumber.ToStringInvariant(), this.InstituteReference)), true);

            this.Validate();
        }

        private IEnumerable<string> GetContent()
        {
            return Utils.AsEnumerable(
                this.AccountId, this.TransactionReason.ToString(),
                this.Amount.ToString(), this.EntityName.EmptyIfNull().ToUpperInvariant()
                , this.PostedDate.IfNotNullValue(p => p.ToString("u")), this.TransactionDate.ToString("u"), this.InstituteReference);
        }

        private void Validate()
        {
            var errors = string.Empty;
            if (this.ImportId == null)
                errors = errors.Append("ImportId must have value.", " ");
            if (string.IsNullOrEmpty(this.AccountId))
                errors = errors.Append("AccountId must have value.", " ");
            if (string.IsNullOrEmpty(this.EntityName))
                errors = errors.Append("EntityName must have value.", " ");
            if (this.Amount > 0 && (this.TransactionReason & TransactionReason.NetOutgoing) > 0)
                errors = errors.Append("Transaction amount is positive {0} but it is set for outgoing TransactionReason {1}".FormatEx(this.Amount, this.TransactionReason), " ");
            if (this.Amount < 0 && (this.TransactionReason & TransactionReason.NetIncoming) > 0)
                errors = errors.Append("Transaction amount is positive {0} but it is set for incoming TransactionReason {1}".FormatEx(this.Amount, this.TransactionReason), " ");

            if (!string.IsNullOrEmpty(errors))
                throw new InvalidDataException(errors);
        }

        public string SerializeToJson()
        {
            return JsonSerializer<Transaction>.Serialize(this);
        }
        public static Transaction DeserializeFromJson(string serializedData)
        {
            return JsonSerializer<Transaction>.Deserialize(serializedData);
        }

        internal void AddChild(Transaction childTx)
        {
            childTx.ParentId = this.Id;
            if (this.children == null)
                this.children = new List<Transaction>();

            this.children.Add(childTx);
        }
    }
}
