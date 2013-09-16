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
        public class EditValue<T>
        {
            [DataMember]
            public bool IsVoided { get; private set; }

            [DataMember]
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
    }
}
