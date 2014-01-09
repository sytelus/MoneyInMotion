using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using MoneyAI.Repositories.CsvParsers;

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

        //TODO: make this configurable plugins
        private static CsvParserBase GetCsvParser(AccountInfo accountInfo)
        {
            CsvParserBase parser = null;

            switch(accountInfo.InstituteName)
            {
                case "ChaseBank":
                    parser = new ChaseCsvParser();
                    break;
                case "OpusBank":
                    parser= new OpusBankCsvParser();
                    break;
                case "AmericanExpress":
                    parser = new AmexCsvParser();
                    break;
                case "BarclayBank":
                    parser = new ChaseCsvParser();
                    break;
                case "Amazon":
                    if (accountInfo.Type == AccountInfo.AccountType.OrderHistory)
                        parser = new AmazonOrdersCsvParser();
                    break;
            }

            if (parser == null)
                throw new Exception("CsvParser for institute {0} and type {1} is not supported".FormatEx(accountInfo.InstituteName, accountInfo.Type.ToString()));
            else
                return parser;
        }

        private static void AddTransactionsFromCsvFile(Transactions transactions, string file, AccountInfo accountInfo, ImportInfo importInfo)
        {
            var csvParser = GetCsvParser(accountInfo);
            var lines = System.IO.File.ReadLines(file).RemoveNullOrEmpty();
            var lineNumber = 0;
            foreach (var line in lines)
            {
                var importedValues = csvParser.GetTransactionImportedValues(line);
                if (importedValues != null)
                {
                    var transaction = new Transaction(importInfo.Id, accountInfo, lineNumber, importedValues);
                    transactions.AddNew(transaction, accountInfo, importInfo, true);
                }
                lineNumber++;
            }

            transactions.MatchParentChild();
        }
    }
}
