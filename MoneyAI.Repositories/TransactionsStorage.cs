using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories
{
    public class TransactionsStorage : IStorage<Transactions>
    {
        private readonly IStorage<TransactionEdits> editsStorage;

        internal TransactionsStorage(IStorage<TransactionEdits> editsStorage)
        {
            this.editsStorage = editsStorage;
        }

        public Transactions Load(ILocation location)
        {
            switch (location.ContentType)
            {
                case ContentType.Csv:
                    var csvTransactions = new Transactions(location.PortableAddress);
                    AddTransactionsFromCsvFile(csvTransactions, location.Address, location.AccountConfig.AccountInfo, location.ImportInfo); ;
                    return csvTransactions;
                case ContentType.Json:
                    var serializedData = System.IO.File.ReadAllText(location.Address);
                    return Transactions.DeserializeFromJson(serializedData);
                case ContentType.None:
                default:
                    throw new ArgumentException("location.ContentType value {0} is not supported for loading transaction".FormatEx(location.ContentType));
            }
        }

        public void Save(ILocation location, Transactions transactions, ILocation auxilaryComponentLocation = null)
        {
            var serializedData = transactions.SerializeToJson();
            File.WriteAllText(location.Address, serializedData);

            MessagePipe.SendMessage("Saved {0}".FormatEx(location.Address));

            if (auxilaryComponentLocation != null)
            {
                var edits = transactions.GetClonedEdits();
                this.editsStorage.Save(auxilaryComponentLocation, edits);
            }
        }

        public bool Exists(ILocation location)
        {
            return System.IO.File.Exists(location.Address);
        }

        private static void AddTransactionsFromCsvFile(Transactions transactions, string file, AccountInfo accountInfo, ImportInfo importInfo)
        {
            var lines = System.IO.File.ReadLines(file).RemoveNullOrEmpty().ToList();
            var headerColumns = (string[])null;
            for (var lineNumber = 0; lineNumber < lines.Count; lineNumber++)
            {
                var line = lines[lineNumber];
                if (headerColumns == null)
                    headerColumns = Utils.ParseCsvLine(line).ToArray();
                else
                    transactions.AddFromCsvLine(headerColumns, line, lineNumber, accountInfo, importInfo);
            }
        }
    }
}
