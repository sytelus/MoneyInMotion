using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using CommonUtils;

namespace MoneyInMotion
{
    public class Transactions
    {
        private readonly IList<Transaction> transactions = new List<Transaction>();
        private readonly HashSet<string> transactionIDs = new HashSet<string>();

        public ICollection<Transaction> Items
        {
            get { return transactions; }
        }

        public bool AddFromConfigFile(string accountConfigFilePath)
        {
            var accountConfig = AccountConfig.Load(accountConfigFilePath);

            var fileFilters = accountConfig.GetValue(AccountConfig.ConfigName.ScanSubFolders, "*.csv")
                .Split(Utils.SemiColonDelimiter, StringSplitOptions.RemoveEmptyEntries);

            var accountName = accountConfig.GetValue(AccountConfig.ConfigName.AccountName);

            var configPath = Path.GetDirectoryName(accountConfigFilePath);

            foreach (var fileFilter in fileFilters)
            {
                var files = Directory.GetFiles(configPath, fileFilter, SearchOption.TopDirectoryOnly);
                foreach (var file in files)
                {
                    var transactionsFromFile = GetTransactionsFromFile(file, accountName).ToList();
                    var oldTransactionCount = this.transactions.Count;
                    this.transactions.AddRange(transactionsFromFile.Where(s => !this.transactionIDs.Contains(s.ID)));
                    this.transactionIDs.AddRange(transactionsFromFile.Select(s => s.ID));

                    MessagePipe<int, int, string>.SendMessage("Loaded {1} transactions ({2} new) from {0}".FormatEx(accountConfigFilePath, transactionsFromFile.Count, this.transactions.Count - oldTransactionCount));
                }
            }

            return bool.Parse(accountConfig.GetValue(AccountConfig.ConfigName.ScanSubFolders, bool.FalseString));
        }

        private IEnumerable<Transaction> GetTransactionsFromFile(string file, string accountName)
        {
            var lines = File.ReadAllLines(file).RemoveNullOrEmpty();
            var headerColumns = (string[])null;
            foreach (var line in lines)
            {
                if (headerColumns == null)
                    headerColumns = Utils.ParseCsvLine(line).ToArray();
                else
                {
                    var transaction = new Transaction(headerColumns, line, accountName);
                    yield return transaction;
                }
            }
        }
    }
}
