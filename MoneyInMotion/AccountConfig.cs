using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using CommonUtils;

namespace MoneyInMotion
{
    public class AccountConfig
    {
        public enum ConfigName
        {
            AccountType,
            FileFilters,
            ScanSubFolders,
            AccountName
        }

        private IDictionary<string,string> values;

        public static AccountConfig Load(string configFilePath)
        {
            var config = new AccountConfig();
            config.values = File.ReadAllLines(configFilePath)
                .RemoveNullOrEmpty()
                .Select(l => l.Split(Utils.TabDelimiter, StringSplitOptions.None))
                .ToDictionary(cs => cs[0], cs => cs[1]);

            return config;
        }

        public string GetValue(ConfigName name, string defaultValue)
        {
            return this.values.GetValueOrDefault(name.ToString(), defaultValue);
        }

        public string GetValue(ConfigName name)
        {
            return this.values[name.ToString()];
        }
    }
}