using System;
using System.Runtime.Serialization;
using CommonUtils;

namespace MoneyAI
{
    [DataContract]
    public class AccountInfo
    {
        [Flags]
        public enum AccountType
        {
            CreditCard = 1, BankChecking = 2, BankSavings = 4, Bank = BankChecking | BankSavings
        }

        [DataMember] public string InstituteName { get; private set; }
        [DataMember] public string Title { get; private set; }
        [DataMember] public AccountType Type { get; private set; }
        [DataMember] public string Id { get; private set; }
        public AccountInfo(AccountType type, string id, string title, string instituteName)
        {
            if (string.IsNullOrEmpty(id))
                throw new ArgumentNullException("id", "Account Id must be specified");

            Type = type;
            InstituteName = instituteName;
            Title = title;
            this.Id = id;
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