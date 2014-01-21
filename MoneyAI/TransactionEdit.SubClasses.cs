using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public partial class TransactionEdit
    {
        public enum ScopeType : int
        {
             None = 0, All = 1, TransactionId = 2,
             EntityName = 3, EntityNameNormalized = 4, EntityNameAnyTokens = 5, EntityNameAllTokens = 6,
             AccountId = 7, TransactionReason = 8, AmountRange = 9
        }

        [DataContract]
        public class ScopeFilter
        {
            [DataMember(IsRequired = true, Name = "type")]
            public ScopeType Type { get; private set; }

            [DataMember(IsRequired = true, Name = "parameters")]
            public string[] Parameters { get; private set; }

            [DataMember(EmitDefaultValue = false, Name = "referenceParameters")]
            public string[] ReferenceParameters { get; private set; }

            [DataMember(IsRequired = true, Name = "contentHash")]
            public string ContentHash { get; private set; }

            public ScopeFilter(ScopeType scopeType, string[] scopeParameters, string[] referenceParameters)
            {
                var errors = Validate(scopeType, scopeParameters);
                if (!string.IsNullOrEmpty(errors))
                    throw new Exception("EditScope parameters are invalid: {0}".FormatEx(errors));

                this.Type = scopeType;
                this.Parameters = scopeParameters;
                this.ContentHash = Utils.GetMD5HashString(this.Parameters.Concat(((int)scopeType).ToStringInvariant()).ToDelimitedString("\t"), 
                    true);
            }

            public static string GetScopeHash(ScopeType scopeType, IEnumerable<string> scopeParameters)
            {
                return Utils.GetMD5HashString(string.Join("\t", 
                    ((int)scopeType).ToStringInvariant().AsEnumerable()
                        .Concat(scopeParameters.EmptyIfNull())));
            }


            private readonly static Dictionary<string, Tuple<int, int>> minMaxParametersLength = new Dictionary<string, Tuple<int, int>>() 
            { 
                {ScopeType.None.ToString(), Tuple.Create(0, 0)} , {ScopeType.All.ToString(), Tuple.Create(0, 0)},
                {ScopeType.TransactionId.ToString(), Tuple.Create(1, int.MaxValue)} , {ScopeType.EntityName.ToString(), Tuple.Create(1, int.MaxValue)},
                {ScopeType.EntityNameNormalized.ToString(), Tuple.Create(1, int.MaxValue)} , {ScopeType.EntityNameAnyTokens.ToString(), Tuple.Create(1, int.MaxValue)},
                {ScopeType.EntityNameAllTokens.ToString(), Tuple.Create(1, int.MaxValue)} , {ScopeType.AccountId.ToString(), Tuple.Create(1, int.MaxValue)},
                {ScopeType.TransactionReason.ToString(), Tuple.Create(1, int.MaxValue)} , {ScopeType.AmountRange.ToString(), Tuple.Create(2, 2)}
            };
            //TODO: include reference parameter validation
            public static string Validate(ScopeType scopeType, string[] scopeParameters)
            {
                string errors = "";
                var parametersLength = minMaxParametersLength[scopeType.ToString()];
                if (scopeParameters.Length < parametersLength.Item1 || scopeParameters.Length > parametersLength.Item2)
                    errors += "ScopeType {0} must have atleast {1} parameters and no more than {2} but it has {3}".FormatEx(scopeType.ToString(), parametersLength.Item1, parametersLength.Item2, scopeParameters.Length);

                return errors;
            }
        }

        /// <summary>
        /// This class should be immutable outside of library
        /// </summary>
        [DataContract]
        public class EditedValues
        {
            [DataMember(EmitDefaultValue = false, Name = "transactionReason")]
            public Transaction.EditValue<TransactionReason> TransactionReason { get; internal set; }

            [DataMember(EmitDefaultValue = false, Name = "transactionDate")]
            public Transaction.EditValue<DateTime> TransactionDate { get; internal set; }

            [DataMember(EmitDefaultValue = false, Name = "amount")]
            public Transaction.EditValue<decimal> Amount { get; internal set; }

            [DataMember(EmitDefaultValue = false, Name = "entityName")]
            public Transaction.EditValue<string> EntityName { get; internal set; }

            [DataMember(EmitDefaultValue = false, Name = "isFlagged")]
            public Transaction.EditValue<Boolean> IsFlagged { get; internal set; }

            [DataMember(EmitDefaultValue = false, Name = "note")]
            public Transaction.EditValue<string> Note { get; internal set; }

            [DataMember(EmitDefaultValue = false, Name = "categoryPath")]
            public Transaction.EditValue<string[]> CategoryPath { get; internal set; }


            internal EditedValues(EditedValues cloneFrom = null)
            {
                if (cloneFrom == null)
                    return; //leave everyting to default

                this.TransactionReason = cloneFrom.TransactionReason;
                this.TransactionDate = cloneFrom.TransactionDate;
                this.Amount = cloneFrom.Amount;
                this.EntityName = cloneFrom.EntityName;
                this.IsFlagged = cloneFrom.IsFlagged;
                this.Note = cloneFrom.Note;
                this.CategoryPath = cloneFrom.CategoryPath;
            }

            internal void Merge(EditedValues other)
            {
                // There are 3 possibilities for user intent:
                // 1. Apply my new value to existing edit. 
                // 2. Leave current edited value alone.
                // 3. Remove any existing edited value and restore to original.
                // 
                // #1 is covered when EditValue is not null and IsVoided is false.
                // #2 is covered when EditValue object is null.
                // #3 is covered when EditValue is not null and IsVoided is true.

                if (other.TransactionReason != null)
                    this.TransactionReason = other.TransactionReason.IsVoided ? null : other.TransactionReason;

                if (other.TransactionDate != null)
                    this.TransactionDate = other.TransactionDate.IsVoided ? null : other.TransactionDate;

                if (other.Amount != null)
                    this.Amount = other.Amount.IsVoided ? null : other.Amount;

                if (other.EntityName != null)
                    this.EntityName = other.EntityName.IsVoided ? null : other.EntityName;

                if (other.IsFlagged != null)
                    this.IsFlagged = other.IsFlagged.IsVoided ? null : other.IsFlagged;

                if (other.Note != null)
                    this.Note = other.Note.IsVoided ? null : other.Note;

                if (other.CategoryPath != null)
                    this.CategoryPath = other.CategoryPath.IsVoided ? null : other.CategoryPath;
            }

        }

    }
}
