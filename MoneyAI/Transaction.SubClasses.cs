using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public partial class Transaction
    {
        [DataContract]
        public class EditedValues
        {
            [DataMember(EmitDefaultValue = false)]
            public EditValue<TransactionReason> TransactionReason { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public EditValue<DateTime> TransactionDate { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public EditValue<decimal> Amount { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public EditValue<string> EntityName { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public EditValue<Boolean> IsFlagged { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public EditValue<string> Note { get; internal set; }

            [DataMember(EmitDefaultValue = false)]
            public EditValue<string[]> CategoryPath { get; internal set; }

            internal void Merge(EditedValues other)
            {
                // There are 3 possibilities for user intent:
                // 1. Apply my edit to existing edit. This may void or unvoid existing edit or add one if it didn't existed before.
                // 2. Don't do anything to existing edit.
                // 3. Remove any existing edit.
                // 
                // #1 is covered when EditValue is not null and IsVoided is not null.
                // #2 is covered when EditValue object is null.
                // #3 is covered when EditValue is not null and IsVoided is null.
                
                if (other.TransactionReason != null)
                    if (other.TransactionReason.IsVoided == null)
                        this.TransactionReason = null;
                    else
                        this.TransactionReason = other.TransactionReason;

                if (other.TransactionDate != null)
                    if (other.TransactionDate.IsVoided == null)
                        this.TransactionDate = null;
                    else
                        this.TransactionDate = other.TransactionDate;

                if (other.Amount != null)
                    if (other.Amount.IsVoided == null)
                        this.Amount = null;
                    else
                        this.Amount = other.Amount;

                if (other.EntityName != null)
                    if (other.EntityName.IsVoided == null)
                        this.EntityName = null;
                    else
                        this.EntityName = other.EntityName;

                if (other.IsFlagged != null)
                    if (other.IsFlagged.IsVoided == null)
                        this.IsFlagged = null;
                    else
                        this.IsFlagged = other.IsFlagged;

                if (other.Note != null)
                    if (other.Note.IsVoided == null)
                        this.Note = null;
                    else
                        this.Note = other.Note;

                if (other.CategoryPath != null)
                    if (other.CategoryPath.IsVoided == null)
                        this.CategoryPath = null;
                    else
                        this.CategoryPath = other.CategoryPath;
            }
        }

        [DataContract]
        public class EditValue<T>
        {
            [DataMember]
            public bool? IsVoided { get; private set; }

            [DataMember]
            public T Value { get; private set; }

            public readonly static EditValue<T> VoidedEditValue = new EditValue<T>(default(T), true);

            private EditValue(T value, bool isVoided)
            {
                this.Value = value;
                this.IsVoided = isVoided;
            }

            public T GetValueOrDefault(T defaultValue)
            {
                return this.IsVoided.IsFalse() ? this.Value : defaultValue;
            }

            internal EditValue(T value)
                : this(value, false)
            {
            }
        }
    }
}
