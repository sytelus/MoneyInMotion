using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public static class MoneyAIUtils
    {
        public static void SaveLatestMerged(ITransactionsRepository repository, Transactions latestMerged)
        {
            var latestMergedLocation = repository.GetNamedLocation(repository.LastestMergedTransactionsName);
            repository.Save(latestMerged, latestMergedLocation);
        }

        public static Transactions GetLatestMerged(ITransactionsRepository repository)
        {
            Transactions latestMerged;
            var latestMergedLocation = repository.GetNamedLocation(repository.LastestMergedTransactionsName);
            if (repository.TransactionsExists(latestMergedLocation))
                latestMerged = repository.Load(latestMergedLocation);
            else
                latestMerged = new Transactions();

            return latestMerged;
        }

        public static void MergeNewStatements(ITransactionsRepository repository, Transactions latestMerged)
        {
            var statementLocations = repository.GetStatementLocations();
            foreach (var statementLocation in statementLocations)
            {
                if (latestMerged.ImportInfos.ContainsKey(statementLocation.ImportInfo.Id))
                    MessagePipe.SendMessage("Location {0} skipped".FormatEx(statementLocation.Address));
                else
                {
                    var statementTransactions = repository.Load(statementLocation);

                    var oldCount = latestMerged.Count;
                    latestMerged.Merge(statementTransactions);

                    MessagePipe.SendMessage("{0} transactions found ({1} new) in {2}".FormatEx(statementTransactions.Count,
                        latestMerged.Count - oldCount, statementLocation.Address));
                }
            }
        }

    }
}
