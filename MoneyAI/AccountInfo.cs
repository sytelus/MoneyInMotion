using System;
using System.Runtime.Serialization;
using CommonUtils;
using System.Collections.Generic;

namespace MoneyAI
{
    [DataContract]
    public class AccountInfo
    {
        [Flags]
        public enum AccountType
        {
            CreditCard = 1, BankChecking = 2, BankSavings = 4, 
            OrderHistory = 5, EPayment = 6 /* ex. paypal */
        }

        [DataMember(IsRequired = true)] 
        public string InstituteName { get; private set; }

        [DataMember(EmitDefaultValue = false)] 
        public string Title { get; private set; }

        [DataMember(IsRequired = true)]
        public AccountType Type { get; private set; }

        [DataMember(IsRequired = true)]
        public string Id { get; private set; }

        [DataMember(IsRequired = false)]
        public bool RequiresParent { get; private set; }

        [DataMember(IsRequired = false)]
        public string[] InterAccountNameTags { get; private set; }

        public AccountInfo(AccountType type, string id, string title, string instituteName, bool requiresParent)
        {
            if (string.IsNullOrEmpty(id))
                throw new ArgumentNullException("id", "Account Id must be specified");

            Type = type;
            InstituteName = instituteName;
            Title = title;
            this.Id = id;

            this.RequiresParent = requiresParent;
        }

        public static AccountInfo DeserializeFromJson(string serializedAccountInfo)
        {
            return JsonSerializer<AccountInfo>.Deserialize(serializedAccountInfo);
        }

        internal string SerializeToJson()
        {
            return JsonSerializer<AccountInfo>.Serialize(this);
        }
    }
}