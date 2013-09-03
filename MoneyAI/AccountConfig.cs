using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using CommonUtils;
using System.Runtime.Serialization;

namespace MoneyAI
{
    [DataContract]
    public class AccountConfig
    {
        [DataMember] private AccountInfo accountInfo;
        [DataMember] private string[] fileFilters = new[] { "*.csv" };
        [DataMember] private bool scanSubFolders = true;

        public AccountConfig(AccountInfo accountInfo)
        {
            this.accountInfo = accountInfo;
        }

        public AccountInfo AccountInfo
        {
            get { return accountInfo; }
            set { accountInfo = value; }
        }

        public string[] FileFilters
        {
            get { return fileFilters; }
            set { fileFilters = value; }
        }

        public bool ScanSubFolders
        {
            get { return scanSubFolders; }
            set { scanSubFolders = value; }
        }

        public static AccountConfig DeserializeFromJson(string serializedAccountConfig)
        {
            return JsonSerializer<AccountConfig>.Deserialize(serializedAccountConfig);
        }

        public string SerializeToJson()
        {
            return JsonSerializer<AccountConfig>.Serialize(this);
        }
    }
}