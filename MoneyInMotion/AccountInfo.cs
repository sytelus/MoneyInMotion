using System;
using System.Runtime.Serialization;
using CommonUtils;

namespace MoneyInMotion
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
        public AccountInfo(AccountType type, string Id, string title, string instituteName)
        {
            if (string.IsNullOrEmpty(Id))
                throw new ArgumentNullException("Id", "Account Id must be specified");

            Type = type;
            InstituteName = instituteName;
            Title = title;
            this.Id = Id;
        }

    }
}