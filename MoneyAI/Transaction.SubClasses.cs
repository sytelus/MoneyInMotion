using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.IO;

namespace MoneyAI
{
    public partial class Transaction
    {
        [DataContract]
        public class EditValue<T>
        {
            [DataMember(Name = "isVoided")]
            public bool IsVoided { get; private set; }

            [DataMember(Name = "value")]
            public T Value { get; private set; }

            public readonly static EditValue<T> VoidedEditValue = new EditValue<T>(default(T), true);

            private EditValue(T value, bool isVoided)
            {
                this.Value = value;
                this.IsVoided = isVoided;
            }

            public T GetValueOrDefault(T defaultValue = default(T))
            {
                return !this.IsVoided ? this.Value : defaultValue;
            }

            internal EditValue(T value) : this(value, false)
            {
            }
        }

        public class ImportedValues
        {
            public Decimal? Amount { get; set; }
            public DateTime? PostedDate { get; set; }
            public DateTime? TransactionDate { get; set; }
            public string EntityName { get; set; }
            public string EntityNameNormalized { get; set; }
            public TransactionReason? TransactionReason { get; set; }

            public string InstituteReference { get; set; }
            public string ProviderCategoryName { get; set; }
            public string PhoneNumber { get; set; }
            public string Address { get; set; }
            public string SubAccountName { get; set; }
            public string AccountNumber { get; set; }
            public string CheckReference { get; set; }
            public bool? RequiresParent { get; set; }
            public Dictionary<string, string> ProviderAttributes { get; set; }

            public void Validate()
            {
                var errors = string.Empty;
                if (this.Amount == null)
                    errors = errors.Append("Amount must have value.", " ");
                if (this.TransactionDate == null)
                    errors = errors.Append("TransactionDate must have value.", " ");
                if (string.IsNullOrWhiteSpace(this.EntityName))
                    errors = errors.Append("EntityName must have value.", " ");

                if (!string.IsNullOrEmpty(errors))
                    throw new InvalidDataException(errors);
            }
        }
    }
}
