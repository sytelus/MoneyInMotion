using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public class AppState
    {
        public ITransactionsRepository Repository { get; private set; }
        public Transactions LatestMerged { get; private set; }
        public TransactionEdits TransactionEdits { get; private set; }


        public AppState(ITransactionsRepository repository)
        {
            this.Repository = repository;
        }

        public void Save()
        {
            var latestMergedLocation = this.Repository.GetNamedLocation(this.Repository.LastestMergedLocationName);
            this.Repository.TransactionsStorage.Save(latestMergedLocation, this.LatestMerged);

            var transactionEditsLocation = this.Repository.GetNamedLocation(this.Repository.TransactionEditsLocationName);
            this.Repository.TransactionEditsStorage.Save(transactionEditsLocation, this.TransactionEdits);
        }

        public void Load()
        {
            var latestMergedLocation = this.Repository.GetNamedLocation(this.Repository.LastestMergedLocationName);
            if (this.Repository.TransactionsStorage.Exists(latestMergedLocation))
                this.LatestMerged = this.Repository.TransactionsStorage.Load(latestMergedLocation);
            else
                this.LatestMerged = new Transactions();

            var transactionEditsLocation = this.Repository.GetNamedLocation(this.Repository.TransactionEditsLocationName);
            if (this.Repository.TransactionsStorage.Exists(transactionEditsLocation))
                this.TransactionEdits = this.Repository.TransactionEditsStorage.Load(transactionEditsLocation);
            else
                this.TransactionEdits = new TransactionEdits(transactionEditsLocation.PortableAddress);
        }

        public void AddAccountConfig(AccountConfig accountConfig)
        {
            this.Repository.AddAccountConfig(accountConfig);
        }

        public void MergeNewStatements()
        {
            var statementLocations = this.Repository.GetStatementLocations();
            foreach (var statementLocation in statementLocations)
            {
                if (this.LatestMerged.ImportInfos.ContainsKey(statementLocation.ImportInfo.Id))
                    MessagePipe.SendMessage("Location {0} skipped".FormatEx(statementLocation.Address));
                else
                {
                    var statementTransactions = this.Repository.TransactionsStorage.Load(statementLocation);

                    var oldCount = this.LatestMerged.Count;
                    this.LatestMerged.Merge(statementTransactions);

                    MessagePipe.SendMessage("{0} transactions found ({1} new) in {2}".FormatEx(statementTransactions.Count,
                        this.LatestMerged.Count - oldCount, statementLocation.Address));
                }
            }
        }

    }
}
