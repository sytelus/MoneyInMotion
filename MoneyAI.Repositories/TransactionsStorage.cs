﻿using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using MoneyAI.Repositories.StatementParsers;

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
            if (location.AccountConfig == null)
            {
                var serializedData = System.IO.File.ReadAllText(location.Address);
                return Transactions.DeserializeFromJson(serializedData);
            }
            else
            {
                var transactions = new Transactions(location.PortableAddress);
                AddTransactionsFromFile(transactions, location.Address, location.AccountConfig.AccountInfo, location.ImportInfo);
                return transactions;
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
        private static StatementParserBase GetStatementFileParser(AccountInfo accountInfo, string statementFilePath)
        {
            StatementParserBase parser = null;

            switch(accountInfo.InstituteName)
            {
                case "AmericanExpress":
                    parser = new AmexParser(statementFilePath);
                    break;
                case "BarclayBank":
                    parser = new BarclayParser(statementFilePath);
                    break;
                case "Amazon":
                    if (accountInfo.Type == AccountInfo.AccountType.OrderHistory)
                        parser = new AmazonOrdersParser(statementFilePath);
                    break;
                case "Etsy":
                    if (accountInfo.Type == AccountInfo.AccountType.OrderHistory)
                        parser = new EtsyBuyerParser(statementFilePath);
                    break;
                case "Paypal":
                    if (accountInfo.Type == AccountInfo.AccountType.EPayment)
                        parser = new PayPalParser(statementFilePath);
                    break;
                default:
                    parser = new GenericStatementParser(statementFilePath, new [] { ".csv" });
                    break;
            }

            if (parser == null)
                throw new Exception("Parser for institute '{0}', type '{1}', file '{2}' is not supported".FormatEx(accountInfo.InstituteName, accountInfo.Type.ToString(), statementFilePath));
            else
                return parser;
        }

        private static void AddTransactionsFromFile(Transactions transactions, string statementFilePath, 
            AccountInfo accountInfo, ImportInfo importInfo)
        {
            var parser = GetStatementFileParser(accountInfo, statementFilePath);
            foreach (var importedValues in parser.GetTransactionImportedValues())
            {
                var transaction = new Transaction(importInfo.Id, accountInfo, importedValues);
                transactions.AddNew(transaction, accountInfo, importInfo, true);
            }
        }
    }
}
