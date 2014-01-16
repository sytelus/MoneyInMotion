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
        ExpenseAdjustment = 1 << 0,
        Fee = 1 << 1,
        InterAccountPayment = 1 << 2,
        Return = 1 << 3,
        InterAccountTransfer = 1 << 4,
        PointsCredit = 1 << 5,
        OtherCredit = 1 << 6,
        CheckPayment = 1 << 7,
        CheckRecieved = 1 << 8,
        AtmWithdrawal = 1 << 9,
        Interest = 1 << 10,
        LoanPayment = 1 << 11,
        DiscountRecieved = 1 << 12,
        IncomeAdjustment = 1 << 13,
        MatchAdjustmentCredit = 1 << 14,
        MatchAdjustmentDebit = 1 << 15,
        PayMentRecieved = 1 << 16,

        //Used temporarily for transaction creation but this value should never be assigned to transaction (its validated)
        UnknownAdjustment = ExpenseAdjustment | IncomeAdjustment,

        NetOutgoing = Purchase | Fee | CheckPayment | AtmWithdrawal | LoanPayment | ExpenseAdjustment | MatchAdjustmentDebit,
        NetIncoming = Return | PointsCredit | OtherCredit | CheckRecieved | Interest | DiscountRecieved | IncomeAdjustment | MatchAdjustmentCredit | PayMentRecieved,
        NetInterAccount = InterAccountPayment | InterAccountTransfer
    }

    public enum LineItemType
    {
        None = 0, ItemSubtotal = 1, Tax = 2, Shipping = 3, Promotions = 4
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

        [DataMember(IsRequired = false, Name = "lineNumber")] 
        public int? LineNumber { get; private set; }

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
        [DataMember(EmitDefaultValue = false, Name = "accountNumber")]
        public string AccountNumber { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "checkReference")]
        public string CheckReference { get; set; }
        [DataMember(EmitDefaultValue = false, Name = "providerAttributes")]
        public Dictionary<string, string> ProviderAttributes { get; set; }

        [DataMember(EmitDefaultValue = false, Name = "lineItemType")]
        public LineItemType LineItemType { get; private set; }
        [DataMember(EmitDefaultValue = false, Name = "parentChildMatchFilter")]
        public string ParentChildMatchFilter { get; private set; }

        //Parent child properties
        [DataMember(EmitDefaultValue = false, Name = "requiresParent")]
        public bool RequiresParent { get; private set; }
        [DataMember(EmitDefaultValue = false, Name = "parentId")]
        public string ParentId { get; private set; }
        [DataMember(EmitDefaultValue = false, Name = "children")]
        private Dictionary<string, Transaction> children;
        public IEnumerable<Transaction> Children { get { return children != null ? this.children.Values : Enumerable.Empty<Transaction>() ; } }
        [DataMember(EmitDefaultValue = false, Name = "hasMissingChild")]
        public bool HasMissingChild { get; private set; }

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

        public Transaction(string importId, AccountInfo accountInfo, ImportedValues importedValues)
        {
            importedValues.Validate();

            this.AuditInfo = new AuditInfo();

            this.ImportId = importId;
            this.AccountId = accountInfo.Id;

            this.RequiresParent = importedValues.RequiresParent ?? accountInfo.RequiresParent;
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
            this.AccountNumber = importedValues.AccountNumber;
            this.CheckReference = importedValues.CheckReference;
            this.ProviderAttributes = importedValues.ProviderAttributes;
            this.LineItemType = importedValues.LineItemType;
            this.ParentChildMatchFilter = importedValues.ParentChildMatchFilter;

            this.LineNumber = importedValues.LineNumber;
            this.ContentHash = Utils.GetMD5HashString(string.Join("\t", this.GetContent()), true);
            this.Id = Utils.GetMD5HashString(string.Join("\t", this.GetContent().Concat(importedValues.LineNumber.ToStringInvariant(string.Empty)
                , this.InstituteReference)), true);

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
                errors = errors.Append("Transaction amount is positive {0} but it is set for outgoing TransactionReason {1}. ".FormatEx(this.Amount, this.TransactionReason), " ");
            if (this.Amount < 0 && (this.TransactionReason & TransactionReason.NetIncoming) > 0)
                errors = errors.Append("Transaction amount is positive {0} but it is set for incoming TransactionReason {1}. ".FormatEx(this.Amount, this.TransactionReason), " ");
            if (this.TransactionReason == TransactionReason.UnknownAdjustment)
                errors = errors.Append(" TransactionReason should not be UnknownAdjustment.", " ");

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
            if (childTx.ParentId != null)
                throw new Exception("Cannot add child transaction {0} to parent {1} because it already has other parent {3}"
                    .FormatEx(childTx.Id, this.Id, childTx.ParentId));

            childTx.ParentId = this.Id;
            if (this.children == null)
                this.children = new Dictionary<string, Transaction>();

            this.children.Add(childTx.Id, childTx);
            this.HasMissingChild = true;    //We won't set it to false until CompleteParent call has been made
        }


        internal bool CompleteParent(out decimal missingChildAmount)
        {
            //TODO: Do we need this.children != null check?
            missingChildAmount = this.Amount - this.children.Values.Sum(tx => tx.Amount);
            this.HasMissingChild = missingChildAmount != 0;

            return !this.HasMissingChild;
        }

        public override string ToString()
        {
            return string.Concat(this.Amount.ToCurrencyString(), " ,", this.TransactionDate.ToShortDateString(), " ,", this.EntityName);
        }
    }
}
