﻿using System;
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
             None = 0, EntityName = 1, EntityNameNormalized = 2, TransactionId = 3, All = 4
        }

        public class EditScope
        {
            [DataMember(IsRequired = true)]
            public ScopeType Type { get; private set; }

            [DataMember(EmitDefaultValue = false)]
            public string[] Parameters { get; private set; }

            [DataMember(IsRequired = true)]
            public string Id { get; private set; }

            public EditScope(ScopeType scopeType, string[] scopeParameters)
            {
                this.Type = scopeType;
                this.Parameters = scopeParameters;

                this.Id = GetScopeHash(scopeType, scopeParameters);
            }

            private static string GetScopeHash(ScopeType scopeType, IEnumerable<string> scopeParameters)
            {
                return Utils.GetMD5HashString(string.Join("\t", scopeType.ToString().AsEnumerable().Concat(scopeParameters.EmptyIfNull())));
            }


        }

        [DataContract]
        public class EditedValues
        {
            [DataMember(EmitDefaultValue = false)]
            public Transaction.EditValue<TransactionReason> TransactionReason { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public Transaction.EditValue<DateTime> TransactionDate { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public Transaction.EditValue<decimal> Amount { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public Transaction.EditValue<string> EntityName { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public Transaction.EditValue<Boolean> IsFlagged { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public Transaction.EditValue<string> Note { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public Transaction.EditValue<string[]> CategoryPath { get; internal set; }


            internal EditedValues(EditedValues other = null)
            {
                if (other == null)
                    return; //leave everyting to default

                this.TransactionReason = other.TransactionReason;
                this.TransactionDate = other.TransactionDate;
                this.Amount = other.Amount;
                this.EntityName = other.EntityName;
                this.IsFlagged = other.IsFlagged;
                this.Note = other.Note;
                this.CategoryPath = other.CategoryPath;
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
