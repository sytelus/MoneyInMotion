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
        public IRepository Repository { get; private set; }
        public Transactions LatestMerged { get; private set; }

        public AppState(IRepository repository)
        {
            this.Repository = repository;
        }

        public void SaveLatestMerged(bool saveEdits)
        {
            var latestMergedLocation = this.Repository.GetNamedLocation(this.Repository.LastestMergedLocationName);
            var transactionEditsLocation = this.Repository.GetNamedLocation(this.Repository.LastestMergedEditsLocationName);

            this.Repository.TransactionsStorage.Save(latestMergedLocation, this.LatestMerged, saveEdits ? transactionEditsLocation : null);
        }

        public void LoadLatestMerged()
        {
            var latestMergedLocation = this.Repository.GetNamedLocation(this.Repository.LastestMergedLocationName);
            if (this.Repository.TransactionsStorage.Exists(latestMergedLocation))
                this.LatestMerged = this.Repository.TransactionsStorage.Load(latestMergedLocation);
            else
                this.LatestMerged = new Transactions(this.Repository.LastestMergedLocationName);
        }

        public bool EditsExists()
        {
            var transactionEditsLocation = this.Repository.GetNamedLocation(this.Repository.LastestMergedEditsLocationName);
            return this.Repository.TransactionsStorage.Exists(transactionEditsLocation);
        }

        public void ApplyEditsToLatestMerged(ILocation location = null)
        {
            var transactionEditsLocation = location ?? this.Repository.GetNamedLocation(this.Repository.LastestMergedEditsLocationName);
            if (this.Repository.TransactionsStorage.Exists(transactionEditsLocation))
            {
                var edits = this.Repository.TransactionEditsStorage.Load(transactionEditsLocation);
                this.LatestMerged.Apply(edits);
            }
            else throw new Exception("Edits were not found at location {0}".FormatEx(location.Address));
        }

        public void AddAccountConfig(AccountConfig accountConfig)
        {
            this.Repository.AddAccountConfig(accountConfig);
        }

        public void MergeNewStatements()
        {
            var statementLocations = this.Repository.GetStatementLocations();
            bool isAnyMerged = false;
            foreach (var statementLocation in statementLocations)
            {
                if (this.LatestMerged.HasImportInfo(statementLocation.ImportInfo.Id))
                    MessagePipe.SendMessage("Location {0} skipped".FormatEx(statementLocation.Address));
                else
                {
                    var statementTransactions = this.Repository.TransactionsStorage.Load(statementLocation);

                    var oldCount = this.LatestMerged.AllParentChildTransactions.Count();
                    this.LatestMerged.Merge(statementTransactions, false);

                    isAnyMerged = true;

                    MessagePipe.SendMessage("{0} transactions found ({1} new) in {2}".FormatEx(statementTransactions.AllParentChildTransactions.Count(),
                        this.LatestMerged.AllParentChildTransactions.Count() - oldCount, statementLocation.Address));
                }
            }

            if (isAnyMerged)
                this.LatestMerged.MatchTransactions();
        }

    }
}
