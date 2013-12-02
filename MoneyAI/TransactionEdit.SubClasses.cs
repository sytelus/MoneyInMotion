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
             None = 0, All = 1,
             EntityName = 2, EntityNameNormalized = 3, EntityNameAnyTokens = 4,
             TransactionId = 100
        }

        [DataContract]
        public class EditScope
        {
            [DataMember(IsRequired = true, Name = "type")]
            public ScopeType Type { get; private set; }

            [DataMember(EmitDefaultValue = false, Name = "parameters")]
            public string[] Parameters { get; private set; }

            public EditScope(ScopeType scopeType, string[] scopeParameters)
            {
                var errors = Validate(scopeType, scopeParameters);
                if (errors != null)
                    throw new Exception("EditScope parameters are invalid: {0}".FormatEx(errors));

                this.Type = scopeType;
                this.Parameters = scopeParameters;
            }

            public static string GetScopeHash(ScopeType scopeType, IEnumerable<string> scopeParameters)
            {
                return Utils.GetMD5HashString(string.Join("\t", 
                    ((int)scopeType).ToStringInvariant().AsEnumerable()
                        .Concat(scopeParameters.EmptyIfNull())));
            }

            public static string Validate(ScopeType scopeType, string[] scopeParameters)
            {
                string errors = null;
                switch (scopeType)
                {
                    case ScopeType.TransactionId:
                        if (scopeParameters.IsNullOrEmpty())
                            errors = errors.Append("1 or more Scope Parameters are required for Scope Type {0}".FormatEx(scopeType));
                        break;
                    case ScopeType.EntityName:
                        if (scopeParameters.IsNullOrEmpty() || scopeParameters.Length > 1)
                            errors = errors.Append("Only 1 Scope Parameter must be supplied for Scope Type {0}".FormatEx(scopeType));
                        break;
                    case ScopeType.EntityNameAnyTokens:
                        if (scopeParameters.IsNullOrEmpty())
                            errors = errors.Append("1 or more Scope Parameters are required for Scope Type {0}".FormatEx(scopeType));
                        break;
                    case ScopeType.EntityNameNormalized:
                        if (scopeParameters.IsNullOrEmpty() || scopeParameters.Length > 1)
                            errors = errors.Append("Only 1 Scope Parameter must be supplied for Scope Type {0}".FormatEx(scopeType));
                        break;
                    case ScopeType.None:
                    case ScopeType.All:
                        if (!scopeParameters.IsNullOrEmpty())
                            errors = errors.Append("Zero Scope Parameters are expected for Scope Type {0}".FormatEx(scopeType));
                        break;
                    default:
                        throw new NotSupportedException("Edit Scope Type {0} is not supported".FormatEx(scopeType));
                }
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
